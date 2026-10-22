import { create } from 'zustand';
import { useWorkspaceStore } from '@/store/workspaceStore';

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
    // The active workspace belongs to the user who is logging out
    useWorkspaceStore.getState().setActiveWorkspaceId('');
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
