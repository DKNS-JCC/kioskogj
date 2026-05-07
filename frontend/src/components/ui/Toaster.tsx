import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, type LucideIcon } from "lucide-react";
import { useToastStore, type ToastTipo } from "../../store/toastStore";
import { cn } from "../../lib/cn";

const ESTILOS: Record<ToastTipo, { fondo: string; texto: string; icono: LucideIcon }> = {
  ok: { fondo: "bg-[#34C759]", texto: "text-white", icono: CheckCircle2 },
  warn: { fondo: "bg-[#FFCC00]", texto: "text-[#1c1c1e]", icono: AlertTriangle },
  error: { fondo: "bg-[#FF3B30]", texto: "text-white", icono: AlertCircle },
  info: { fondo: "bg-[#007AFF]", texto: "text-white", icono: Info },
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none w-[92%] max-w-md pt-safe">
      {toasts.map((t) => {
        const { fondo, texto, icono: Icono } = ESTILOS[t.tipo];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 animate-slide-down",
              fondo,
              texto
            )}
          >
            <Icono size={20} />
            <p className="flex-1 text-sm leading-snug">{t.mensaje}</p>
            <button
              onClick={() => dismiss(t.id)}
              className={cn("opacity-80 hover:opacity-100", texto)}
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
