import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { ConfiguracionOut, ConfiguracionUpdate } from "./types";

const BASE = "/api/configuracion";

export const configuracionApi = {
  /** Devuelve solo claves publicas (cota_diaria). */
  obtener: () => apiFetch<ConfiguracionOut>(BASE),
  /** Acepta cota_diaria y/o pin_admin. Requiere PIN admin. */
  actualizar: (data: ConfiguracionUpdate) =>
    apiFetch<ConfiguracionOut>(BASE, {
      method: "POST",
      body: data,
      requireAdminPin: true,
    }),
};

export function useConfiguracion() {
  return useQuery<ConfiguracionOut>({
    queryKey: ["configuracion"],
    queryFn: configuracionApi.obtener,
  });
}

export function useActualizarConfiguracion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configuracionApi.actualizar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["configuracion"] }),
  });
}
