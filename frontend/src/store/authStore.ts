import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AuthStore {
  pin: string | null;
  setPin: (pin: string) => void;
  clearPin: () => void;
}

// sessionStorage en lugar de localStorage: el PIN se olvida al cerrar la pestaña.
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      pin: null,
      setPin: (pin) => set({ pin }),
      clearPin: () => set({ pin: null }),
    }),
    {
      name: "kiosko-auth",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
