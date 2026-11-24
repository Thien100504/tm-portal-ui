import axios from 'axios';
import i18n from './i18n';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = '/api/v1';

// ── i18n error translation helper (used inside interceptor) ──────────────────
function translateDetail(detail) {
  if (!detail) return null;
  if (typeof detail === 'string') {
    const t = i18n.t(detail, { defaultValue: '' });
    return t || detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const raw = (d.msg ?? '').replace(/^Value error,\s*/i, '');
        return i18n.t(raw, { defaultValue: '' }) || raw || '';
      })
      .filter(Boolean)
      .join(' · ');
  }
  return null;
}

// Keys for localStorage
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ============================================================
// Token helpers
// ============================================================

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken, refreshToken) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  // Keep the store in sync so token consumers (e.g. the WebSocket hook) pick up the new token
  useAuthStore.setState({ accessToken });
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Tabs share localStorage: when another tab refreshes or clears the tokens,
// update this tab's store too (the WebSocket hook reconnects on a new token)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === ACCESS_TOKEN_KEY) {
      useAuthStore.setState({ accessToken: event.newValue });
    }
  });
}

// Removed trailing slash interceptor because backend no longer uses trailing slashes

// ============================================================
// Request interceptor - attach JWT
// ============================================================

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// Response interceptor - handle 401 & token refresh
// ============================================================

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ── Attach translated message to every error ──────────────────────────
    // Components can use:  err.translatedMessage  OR  getApiError(err) from apiError.js
    const detail = error?.response?.data?.detail;
    if (detail) {
      error.translatedMessage = translateDetail(detail) || undefined;
    }

    // Only attempt refresh on 401, and not on the refresh/login endpoint itself
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        setTokens(data.access_token, data.refresh_token);
        processQueue(null, data.access_token);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh tokens are one-time: if another tab already rotated ours, reuse its
        // tokens. Give that tab a moment to save them before deciding to log out.
        let latestRefreshToken = getRefreshToken();
        if (latestRefreshToken === refreshToken) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          latestRefreshToken = getRefreshToken();
        }
        if (latestRefreshToken && latestRefreshToken !== refreshToken) {
          const latestAccessToken = getAccessToken();
          useAuthStore.setState({ accessToken: latestAccessToken });
          processQueue(null, latestAccessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${latestAccessToken}`;
          }
          return api(originalRequest);
        }
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
