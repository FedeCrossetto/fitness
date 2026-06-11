import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastData {
  id: number;
  kind: ToastKind;
  message: string;
}

interface UiState {
  addMenuVisible: boolean;
  toast: ToastData | null;

  openAddMenu: () => void;
  closeAddMenu: () => void;
  showToast: (kind: ToastKind, message: string) => void;
  hideToast: () => void;
}

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiStore = create<UiState>((set) => ({
  addMenuVisible: false,
  toast: null,

  openAddMenu: () => set({ addMenuVisible: true }),
  closeAddMenu: () => set({ addMenuVisible: false }),

  showToast: (kind, message) => {
    if (toastTimer) clearTimeout(toastTimer);
    toastSeq += 1;
    set({ toast: { id: toastSeq, kind, message } });
    toastTimer = setTimeout(() => set({ toast: null }), 3000);
  },

  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null });
  },
}));
