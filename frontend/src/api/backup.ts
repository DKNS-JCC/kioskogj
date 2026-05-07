import { useAuthStore } from "../store/authStore";
import { ApiError } from "./client";

/**
 * Descarga la BD como `.db`. No pasamos por apiFetch porque la respuesta es
 * binaria (no JSON). Reusamos el PIN del authStore.
 */
export async function descargarBackup(): Promise<void> {
  const pin = useAuthStore.getState().pin;
  if (!pin) throw new ApiError(401, "pin_ausente", "Falta el PIN admin.");

  const r = await fetch("/api/backup", { headers: { "X-Admin-Pin": pin } });
  if (!r.ok) {
    if (r.status === 401) useAuthStore.getState().clearPin();
    let mensaje = `Error ${r.status}`;
    try {
      const j = await r.json();
      mensaje = j?.detail ?? mensaje;
    } catch {
      /* respuesta no era JSON */
    }
    throw new ApiError(r.status, "backup", mensaje);
  }

  // Sacar el filename del header Content-Disposition si viene; si no, el por defecto.
  const cd = r.headers.get("Content-Disposition") ?? "";
  const m = /filename="?([^";]+)"?/i.exec(cd);
  const nombre = m?.[1] ?? `kiosko-backup-${new Date().toISOString().slice(0, 10)}.db`;

  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
