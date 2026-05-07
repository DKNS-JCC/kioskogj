import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { ProductoCreate, ProductoOut, ProductoUpdate } from "./types";

const BASE = "/api/productos";

export const productosApi = {
  listar: (soloActivos?: boolean) =>
    apiFetch<ProductoOut[]>(BASE, {
      query: soloActivos !== undefined ? { activo: soloActivos } : undefined,
    }),
  crear: (data: ProductoCreate) =>
    apiFetch<ProductoOut>(BASE, { method: "POST", body: data }),
  actualizar: (id: number, data: ProductoUpdate) =>
    apiFetch<ProductoOut>(`${BASE}/${id}`, { method: "PUT", body: data }),
  subirImagen: (id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<ProductoOut>(`${BASE}/${id}/imagen`, {
      method: "POST",
      body: formData,
    });
  },
  borrar: (id: number) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
};

export const claves = {
  todos: (soloActivos?: boolean) =>
    soloActivos === undefined ? (["productos"] as const) : (["productos", { soloActivos }] as const),
};

export function useProductos(soloActivos?: boolean) {
  return useQuery<ProductoOut[]>({
    queryKey: claves.todos(soloActivos),
    queryFn: () => productosApi.listar(soloActivos),
  });
}

export function useCrearProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productosApi.crear,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["productos"] }),
  });
}

export function useActualizarProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProductoUpdate }) =>
      productosApi.actualizar(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["productos"] }),
  });
}

export function useSubirImagenProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      productosApi.subirImagen(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["productos"] }),
  });
}

export function useBorrarProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productosApi.borrar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["productos"] }),
  });
}
