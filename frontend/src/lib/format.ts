const NF_EUR = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const eur = (n: number): string => NF_EUR.format(n);

export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

export function fechaSolo(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { dateStyle: "short" });
}
