import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  FiltrosTransacciones,
  TransaccionCreada,
  TransaccionCreate,
  TransaccionOut,
} from "./types";

const BASE = "/api/transacciones";

export const transaccionesApi = {
  listar: (filtros: FiltrosTransacciones = {}) =>
    apiFetch<TransaccionOut[]>(BASE, {
      query: {
        fecha_inicio: filtros.fecha_inicio,
        fecha_fin: filtros.fecha_fin,
        nino_id: filtros.nino_id,
        grupo: filtros.grupo,
        busqueda: filtros.busqueda,
      },
    }),
  crear: (data: TransaccionCreate) =>
    apiFetch<TransaccionCreada>(BASE, { method: "POST", body: data }),
  reembolsar: (id: number) =>
    apiFetch<TransaccionOut>(`${BASE}/${id}/reembolsar`, { method: "POST" }),
};

export function useTransacciones(filtros: FiltrosTransacciones = {}) {
  return useQuery<TransaccionOut[]>({
    queryKey: ["transacciones", filtros],
    queryFn: () => transaccionesApi.listar(filtros),
  });
}

export function useCrearTransaccion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transaccionesApi.crear,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["transacciones"] });
      qc.invalidateQueries({ queryKey: ["ninos"] });
      qc.invalidateQueries({ queryKey: ["estadisticas"] });
      qc.invalidateQueries({ queryKey: ["ninos", vars.nino_id, "info"] });
    },
  });
}

export function useReembolsar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transaccionesApi.reembolsar,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transacciones"] });
      qc.invalidateQueries({ queryKey: ["ninos"] });
      qc.invalidateQueries({ queryKey: ["estadisticas"] });
    },
  });
}
