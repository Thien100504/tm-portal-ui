import { create } from 'zustand';

export const useWorkspaceStore = create((set) => ({
  activeWorkspaceId: localStorage.getItem('active-workspace-id') || '',
  setActiveWorkspaceId: (id) => {
    if (id) {
      localStorage.setItem('active-workspace-id', id);
    } else {
      localStorage.removeItem('active-workspace-id');
    }
    set({ activeWorkspaceId: id || '' });
  },
}));
