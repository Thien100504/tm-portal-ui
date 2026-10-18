import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  accessToken: localStorage.getItem('access_token'),
  isInitialized: false,

  setAuth: (user, token) => {
    localStorage.setItem('access_token', token);
    set({
      user,
      accessToken: token,
      isAuthenticated: true,
      isInitialized: true,
    });
  },

  clearAuth: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isInitialized: true,
    });
  },

  setUser: (user) => {
    set({ user, isInitialized: true });
  },

  setInitialized: () => {
    set({ isInitialized: true });
  },
}));
