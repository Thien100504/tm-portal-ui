/**
 * apiError.js — API error translation helper
 *
 * The backend returns dot-key error codes as HTTPException `detail` strings
 * (e.g. "task.not_found", "auth.invalid_credentials"). This helper translates
 * those codes using the active i18n locale.
 *
 * Usage:
 *   import { getApiError } from '@/lib/apiError';
 *
 *   onError: (err) => toast.error(getApiError(err))
 */

import i18n from './i18n';

/**
 * Translate a backend API error into a human-readable localized string.
 *
 * Handles two error shapes:
 *  - String detail  → "task.not_found"  (our HTTPException convention)
 *  - Array detail   → Pydantic 422 validation errors [{ msg, loc, type }]
 *
 * @param {Error|unknown} error     - The axios error (or any error object)
 * @param {string}        [fallback] - Fallback if no detail present
 * @returns {string}
 */
export function getApiError(error, fallback = 'An error occurred.') {
  const detail = error?.response?.data?.detail;

  if (!detail) return fallback;

  // ── Pydantic 422 validation errors (array) ──────────────────────────────
  if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => {
        // Pydantic v2 wraps ValueError messages as "Value error, <original>"
        const rawMsg = (d.msg ?? '').replace(/^Value error,\s*/i, '');
        const translated = rawMsg ? i18n.t(rawMsg, { defaultValue: '' }) : '';
        return translated || rawMsg || d.type || '';
      })
      .filter(Boolean);

    return messages.length > 0 ? messages.join(' · ') : fallback;
  }

  // ── String error code (dot-key) ─────────────────────────────────────────
  if (typeof detail === 'string') {
    const translated = i18n.t(detail, { defaultValue: '' });
    // If i18n found a real translation, use it; otherwise show the key itself
    // (better than a generic "An error occurred" when we have the key)
    return translated || detail;
  }

  return fallback;
}

/**
 * Same as getApiError but returns null when there is no translatable detail.
 * Useful when you want to suppress errors silently.
 */
export function getApiErrorOrNull(error) {
  const detail = error?.response?.data?.detail;
  if (!detail) return null;
  return getApiError(error);
}

/**
 * Extract only the HTTP status code from an axios error.
 * @returns {number|null}
 */
export function getApiStatus(error) {
  return error?.response?.status ?? null;
}
