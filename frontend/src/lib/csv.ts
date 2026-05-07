function escapar(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const s = String(valor);
  // RFC 4180: si contiene coma, comillas o saltos de linea, va entre comillas
  // y las comillas internas se duplican.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function aCsv(filas: Record<string, unknown>[], cabeceras?: string[]): string {
  if (filas.length === 0) return "";
  const cols = cabeceras ?? Object.keys(filas[0]);
  const lineas = [cols.map(escapar).join(",")];
  for (const fila of filas) {
    lineas.push(cols.map((c) => escapar(fila[c])).join(","));
  }
  return lineas.join("\r\n");
}

export function descargarCsv(
  filas: Record<string, unknown>[],
  nombreArchivo: string,
  cabeceras?: string[]
): void {
  const csv = aCsv(filas, cabeceras);
  // BOM para que Excel detecte UTF-8 con tildes.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
