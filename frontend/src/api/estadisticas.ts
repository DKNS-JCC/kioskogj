import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { EstadisticasOut } from "./types";

export const estadisticasApi = {
  obtener: () => apiFetch<EstadisticasOut>("/api/estadisticas"),
};

export function useEstadisticas() {
  return useQuery<EstadisticasOut>({
    queryKey: ["estadisticas"],
    queryFn: estadisticasApi.obtener,
    staleTime: 30_000,
  });
}
