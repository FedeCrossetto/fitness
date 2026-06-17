import { create } from 'zustand';
import { todayISO } from '../lib/dates';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastData {
  id: number;
  kind: ToastKind;
  message: string;
}

interface UiState {
  addMenuVisible: boolean;
  toast: ToastData | null;
  /** Fecha activa en el strip del home (YYYY-MM-DD, hora local). */
  activeDate: string;

  openAddMenu: () => void;
  closeAddMenu: () => void;
  showToast: (kind: ToastKind, message: string) => void;
  hideToast: () => void;
  setActiveDate: (date: string) => void;
  resetActiveDate: () => void;
}

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiStore = create<UiState>((set) => ({
  addMenuVisible: false,
  toast: null,
  activeDate: todayISO(),

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

  setActiveDate: (date) => set({ activeDate: date }),
  resetActiveDate: () => set({ activeDate: todayISO() }),
}));
