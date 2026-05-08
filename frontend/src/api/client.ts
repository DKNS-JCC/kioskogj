import { useAuthStore } from "../store/authStore";

export class ApiError extends Error {
  status: number;
  codigo: string;
  detail: unknown;

  constructor(status: number, codigo: string, mensaje: string, detail?: unknown) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detail = detail;
  }
}

interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Si true, inyecta header X-Admin-Pin desde authStore. Si falta el PIN, lanza ApiError 401. */
  requireAdminPin?: boolean;
  /** Query params. Los valores undefined/null se omiten. */
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function construirUrl(path: string, query?: FetchOptions["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined = undefined;

  if (opts.body !== undefined) {
    if (opts.body instanceof FormData) {
      // No seteamos Content-Type para FormData, el navegador lo hace por nosotros con el boundary
      body = opts.body;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
  }

  if (opts.requireAdminPin) {
    const pin = useAuthStore.getState().pin;
    if (!pin) {
      throw new ApiError(401, "pin_ausente", "Falta el PIN admin.");
    }
    headers["X-Admin-Pin"] = pin;
  }

  const url = construirUrl(path, opts.query);
  const respuesta = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: body,
    signal: opts.signal,
  });

  // 204 No Content: no parseamos cuerpo.
  if (respuesta.status === 204) {
    return undefined as T;
  }

  const texto = await respuesta.text();
  let datos: unknown = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }

  if (!respuesta.ok) {
    // Backend devuelve { detail: "..." } o { detail: { codigo, mensaje } }.
    let codigo = "error";
    let mensaje = `Error ${respuesta.status}`;
    let detailRaw: unknown = undefined;
    if (datos && typeof datos === "object" && "detail" in datos) {
      detailRaw = (datos as { detail: unknown }).detail;
      if (typeof detailRaw === "string") {
        mensaje = detailRaw;
      } else if (detailRaw && typeof detailRaw === "object") {
        const d = detailRaw as { codigo?: string; mensaje?: string };
        codigo = d.codigo ?? codigo;
        mensaje = d.mensaje ?? mensaje;
      }
    }
    // PIN incorrecto: limpia el store para forzar re-login.
    if (respuesta.status === 401 && opts.requireAdminPin) {
      useAuthStore.getState().clearPin();
    }
    throw new ApiError(respuesta.status, codigo, mensaje, detailRaw);
  }

  return datos as T;
}
