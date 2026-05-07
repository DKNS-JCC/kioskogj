import { useEffect, useState } from "react";
import { cn } from "../lib/cn";

interface CountdownBadgeProps {
  /** Epoch ms hasta cuando dura el castigo. */
  hasta: number;
  /** Se llama cuando el contador llega a cero. */
  onExpirar?: () => void;
  className?: string;
}

function formatear(restanteMs: number): string {
  if (restanteMs <= 0) return "00:00:00";
  const totalSeg = Math.floor(restanteMs / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function CountdownBadge({ hasta, onExpirar, className }: CountdownBadgeProps) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const restante = hasta - ahora;

  useEffect(() => {
    if (restante <= 0) onExpirar?.();
  }, [restante, onExpirar]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs px-2 py-1 rounded-full bg-[#FF3B30]/10 text-[#FF3B30]",
        className
      )}
    >
      {formatear(restante)}
    </span>
  );
}
