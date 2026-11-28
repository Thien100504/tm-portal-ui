import { create } from 'zustand';

const KEY = 'assistant-sidebar-open';

function readOpen() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function writeOpen(open) {
  try {
    localStorage.setItem(KEY, open ? '1' : '0');
  } catch {
    // storage unavailable (private mode): the sidebar just won't stay open across reloads
  }
}

/** Whether the AI assistant sidebar is open; remembered per browser. */
export const useAssistantStore = create((set, get) => ({
  open: readOpen(),
  setOpen: (open) => {
    writeOpen(open);
    set({ open });
  },
  toggle: () => get().setOpen(!get().open),
}));
