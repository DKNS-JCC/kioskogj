import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  titulo?: string;
  children: React.ReactNode;
  /** Tamano horizontal aproximado. Por defecto md. */
  size?: "sm" | "md" | "lg";
  /** Si true, no cierra al pulsar fuera ni con Esc. Util para forzar interaccion (PinDialog). */
  obligatorio?: boolean;
}

const SIZE: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export default function Modal({
  open,
  onClose,
  titulo,
  children,
  size = "md",
  obligatorio = false,
}: ModalProps) {
  useEffect(() => {
    if (!open || obligatorio) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, obligatorio, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in"
      onClick={obligatorio ? undefined : onClose}
    >
      <div
        className={cn(
          "w-full sm:rounded-2xl rounded-t-2xl bg-white shadow-xl flex flex-col max-h-[90vh] animate-slide-up",
          SIZE[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(titulo || !obligatorio) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5ea]">
            <h2 className="text-lg font-semibold text-[#1c1c1e]">{titulo}</h2>
            {!obligatorio && (
              <button
                onClick={onClose}
                className="text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
                aria-label="Cerrar"
              >
                <X size={22} />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
