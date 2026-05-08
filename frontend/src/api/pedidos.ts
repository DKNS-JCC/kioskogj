import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  EstadoPedido,
  PedidoCreate,
  PedidoLineaOut,
  PedidoLineaUpdate,
  PedidoOut,
} from "./types";

const BASE = "/api/pedidos";

export const pedidosApi = {
  listar: (filtros: { estado?: EstadoPedido; grupo?: number } = {}) =>
    apiFetch<PedidoOut[]>(BASE, {
      query: { estado: filtros.estado, grupo: filtros.grupo },
    }),
  detalle: (id: number) => apiFetch<PedidoOut>(`${BASE}/${id}`),
  crear: (data: PedidoCreate, confirmarDuplicado = false) =>
    apiFetch<PedidoOut>(BASE, {
      method: "POST",
      body: data,
      query: confirmarDuplicado ? { confirmar_duplicado: true } : undefined,
    }),
  actualizarLinea: (pedidoId: number, lineaId: number, data: PedidoLineaUpdate) =>
    apiFetch<PedidoLineaOut>(`${BASE}/${pedidoId}/lineas/${lineaId}`, {
      method: "PUT",
      body: data,
    }),
  preparar: (id: number) =>
    apiFetch<PedidoOut>(`${BASE}/${id}/preparar`, { method: "POST" }),
  completar: (id: number) =>
    apiFetch<PedidoOut>(`${BASE}/${id}/completar`, { method: "POST" }),
  borrar: (id: number) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
};

export function usePedidos(filtros: { estado?: EstadoPedido; grupo?: number } = {}) {
  return useQuery<PedidoOut[]>({
    queryKey: ["pedidos", filtros],
    queryFn: () => pedidosApi.listar(filtros),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useCrearPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { data: PedidoCreate; confirmarDuplicado?: boolean }) =>
      pedidosApi.crear(vars.data, vars.confirmarDuplicado ?? false),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pedidos"] }),
  });
}

export function useActualizarLinea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      pedidoId: number;
      lineaId: number;
      data: PedidoLineaUpdate;
    }) => pedidosApi.actualizarLinea(vars.pedidoId, vars.lineaId, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pedidos"] }),
  });
}

export function useMarcarPreparado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pedidosApi.preparar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pedidos"] }),
  });
}

export function useCompletarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pedidosApi.completar,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["ninos"] });
      qc.invalidateQueries({ queryKey: ["transacciones"] });
      qc.invalidateQueries({ queryKey: ["estadisticas"] });
    },
  });
}

export function useBorrarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pedidosApi.borrar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pedidos"] }),
  });
}
