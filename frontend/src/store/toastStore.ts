import { create } from "zustand";

export type ToastTipo = "info" | "ok" | "warn" | "error";

export interface Toast {
  id: number;
  tipo: ToastTipo;
  mensaje: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (tipo: ToastTipo, mensaje: string, duracionMs?: number) => void;
  dismiss: (id: number) => void;
}

let contador = 0;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (tipo, mensaje, duracionMs = 3500) => {
    const id = ++contador;
    set((s) => ({ toasts: [...s.toasts, { id, tipo, mensaje }] }));
    setTimeout(() => get().dismiss(id), duracionMs);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (m: string) => useToastStore.getState().push("info", m),
  ok: (m: string) => useToastStore.getState().push("ok", m),
  warn: (m: string) => useToastStore.getState().push("warn", m, 5000),
  error: (m: string) => useToastStore.getState().push("error", m, 5000),
};
