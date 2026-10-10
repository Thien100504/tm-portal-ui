import api, { setTokens, clearTokens } from '@/lib/axios';

/**
 * Authentication API service
 */
const authService = {
  /**
   * Login with email and password
   */
  async login(data) {
    // Backend OAuth2 expects application/x-www-form-urlencoded with username and password
    const formData = new URLSearchParams();
    formData.append('username', data.email);
    formData.append('password', data.password);

    const response = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const tokens = response.data;
    setTokens(tokens.access_token, tokens.refresh_token);
    return tokens;
  },

  /**
   * Register a new user account
   */
  async register(data) {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  /**
   * Logout - invalidate tokens on server and clear local storage
   */
  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      clearTokens();
    }
  },

  /**
   * Refresh the access token using the stored refresh token
   */
  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    const response = await api.post('/auth/refresh', {
      refresh_token: refreshToken,
    });
    const tokens = response.data;
    setTokens(tokens.access_token, tokens.refresh_token);
    return tokens;
  },

  /**
   * Get the currently authenticated user's profile
   */
  async getMe() {
    const response = await api.get('/users/me');
    return response.data;
  },
};

export default authService;
