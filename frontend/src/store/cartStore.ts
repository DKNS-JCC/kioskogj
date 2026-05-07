import { create } from "zustand";
import type { NinoOut, ProductoOut } from "../api/types";

interface CartItem extends ProductoOut {
  cantidad: number;
}

interface CartStore {
  selectedNino: NinoOut | null;
  items: CartItem[];
  setSelectedNino: (nino: NinoOut | null) => void;
  /** Añade `n` unidades del producto al carrito. Si `n < 0`, las resta;
   *  si la cantidad resultante es ≤ 0, retira la línea. */
  addQty: (producto: ProductoOut, n: number) => void;
  addItem: (producto: ProductoOut) => void;
  removeItem: (productoId: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  selectedNino: null,
  items: [],
  setSelectedNino: (nino) => set({ selectedNino: nino }),
  addQty: (producto, n) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === producto.id);
      if (!existing) {
        if (n <= 0) return state;
        return { items: [...state.items, { ...producto, cantidad: n }] };
      }
      const nuevaCantidad = existing.cantidad + n;
      if (nuevaCantidad <= 0) {
        return { items: state.items.filter((i) => i.id !== producto.id) };
      }
      // FastAPI valida cantidad <= 99 por línea, recortamos preventivamente.
      const recortada = Math.min(nuevaCantidad, 99);
      return {
        items: state.items.map((i) =>
          i.id === producto.id ? { ...i, cantidad: recortada } : i
        ),
      };
    }),
  addItem: (producto) => get().addQty(producto, 1),
  removeItem: (productoId) => {
    const item = get().items.find((i) => i.id === productoId);
    if (item) get().addQty(item, -1);
  },
  clearCart: () => set({ selectedNino: null, items: [] }),
  total: () => get().items.reduce((sum, item) => sum + item.precio * item.cantidad, 0),
}));
