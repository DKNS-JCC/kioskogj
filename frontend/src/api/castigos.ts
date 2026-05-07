import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { CastigoActivoMap, CastigoHistoricoMap } from "./types";

export const castigosApi = {
  activos: () => apiFetch<CastigoActivoMap>("/api/castigos"),
  historico: () => apiFetch<CastigoHistoricoMap>("/api/castigos/historico"),
  castigar: (ninoId: number) =>
    apiFetch<{ nino_id: number; hasta: number }>(
      `/api/ninos/${ninoId}/castigar`,
      { method: "POST" }
    ),
  revocar: (ninoId: number) =>
    apiFetch<void>(`/api/ninos/${ninoId}/castigar`, { method: "DELETE" }),
};

export function useCastigosActivos() {
  return useQuery<CastigoActivoMap>({
    queryKey: ["castigos", "activos"],
    queryFn: castigosApi.activos,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useCastigosHistorico() {
  return useQuery<CastigoHistoricoMap>({
    queryKey: ["castigos", "historico"],
    queryFn: castigosApi.historico,
  });
}

export function useCastigar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: castigosApi.castigar,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["castigos"] });
    },
  });
}

export function useRevocar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: castigosApi.revocar,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["castigos"] });
    },
  });
}
