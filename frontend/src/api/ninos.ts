import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  HistorialLinea,
  NinoCreate,
  NinoInfo,
  NinoOut,
  NinoUpdate,
} from "./types";

const BASE = "/api/ninos";

export const ninosApi = {
  listar: () => apiFetch<NinoOut[]>(BASE),
  crear: (data: NinoCreate) => apiFetch<NinoOut>(BASE, { method: "POST", body: data }),
  actualizar: (id: number, data: NinoUpdate) =>
    apiFetch<NinoOut>(`${BASE}/${id}`, { method: "PUT", body: data }),
  borrar: (id: number) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
  limpiar: () =>
    apiFetch<void>(`${BASE}/limpiar`, { method: "POST", requireAdminPin: true }),
  info: (id: number) => apiFetch<NinoInfo>(`${BASE}/${id}/info`),
  historial: (id: number) => apiFetch<HistorialLinea[]>(`${BASE}/${id}/historial`),
};

export const claves = {
  todos: () => ["ninos"] as const,
  info: (id: number) => ["ninos", id, "info"] as const,
  historial: (id: number) => ["ninos", id, "historial"] as const,
};

export function useNinos(opts?: Partial<UseQueryOptions<NinoOut[]>>) {
  return useQuery<NinoOut[]>({
    queryKey: claves.todos(),
    queryFn: ninosApi.listar,
    ...opts,
  });
}

export function useNinoInfo(id: number | null | undefined) {
  return useQuery<NinoInfo>({
    queryKey: id ? claves.info(id) : ["ninos", "info-disabled"],
    queryFn: () => ninosApi.info(id as number),
    enabled: id != null,
    staleTime: 0,
  });
}

export function useHistorialNino(id: number | null | undefined) {
  return useQuery<HistorialLinea[]>({
    queryKey: id ? claves.historial(id) : ["ninos", "hist-disabled"],
    queryFn: () => ninosApi.historial(id as number),
    enabled: id != null,
  });
}

export function useCrearNino() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ninosApi.crear,
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.todos() }),
  });
}

export function useActualizarNino() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: NinoUpdate }) =>
      ninosApi.actualizar(id, data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: claves.todos() });
      qc.invalidateQueries({ queryKey: claves.info(id) });
    },
  });
}

export function useBorrarNino() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ninosApi.borrar,
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.todos() }),
  });
}

export function useLimpiarNinos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ninosApi.limpiar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ninos"] }),
  });
}
