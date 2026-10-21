import { create } from 'zustand';

export const useWorkspaceStore = create((set) => ({
  activeWorkspaceId: localStorage.getItem('active-workspace-id') || '',
  setActiveWorkspaceId: (id) => {
    localStorage.setItem('active-workspace-id', id);
    set({ activeWorkspaceId: id });
  },
}));
