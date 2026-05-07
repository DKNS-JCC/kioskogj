import { create } from "zustand";
import { AlertTriangle, Trash2, HelpCircle, type LucideIcon } from "lucide-react";
import Modal from "./Modal";
import { cn } from "../../lib/cn";

type Tono = "neutro" | "peligro" | "advertencia";

interface ConfirmOpts {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  tono?: Tono;
}

type Pendiente =
  | (ConfirmOpts & { resolver: (ok: boolean) => void })
  | null;

interface ConfirmStore {
  pendiente: Pendiente;
  pedir: (opts: ConfirmOpts, resolver: (ok: boolean) => void) => void;
  cerrar: (ok: boolean) => void;
}

const useConfirmStore = create<ConfirmStore>((set, get) => ({
  pendiente: null,
  pedir: (opts, resolver) => set({ pendiente: { ...opts, resolver } }),
  cerrar: (ok) => {
    const p = get().pendiente;
    if (p) p.resolver(ok);
    set({ pendiente: null });
  },
}));

/**
 * Pide confirmacion al usuario. Devuelve una promesa con true si confirma, false si cancela.
 * Uso: `if (!(await confirmar({titulo, mensaje}))) return;`
 */
export function confirmar(opts: ConfirmOpts): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useConfirmStore.getState().pedir(opts, resolve);
  });
}

const ICONOS: Record<Tono, { icono: LucideIcon; color: string; fondo: string }> = {
  neutro: { icono: HelpCircle, color: "text-[#007AFF]", fondo: "bg-[#007AFF]/10" },
  advertencia: { icono: AlertTriangle, color: "text-[#FF9500]", fondo: "bg-[#FF9500]/10" },
  peligro: { icono: Trash2, color: "text-[#FF3B30]", fondo: "bg-[#FF3B30]/10" },
};

export default function ConfirmDialogRoot() {
  const pendiente = useConfirmStore((s) => s.pendiente);
  const cerrar = useConfirmStore((s) => s.cerrar);

  const open = pendiente !== null;
  const tono = pendiente?.tono ?? "neutro";
  const { icono: Icono, color, fondo } = ICONOS[tono];

  return (
    <Modal open={open} onClose={() => cerrar(false)} size="sm" titulo={pendiente?.titulo}>
      <div className="flex gap-3">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", fondo)}>
          <Icono size={20} className={color} />
        </div>
        <p className="text-[#1c1c1e] flex-1 pt-1">{pendiente?.mensaje}</p>
      </div>
      <div className="flex gap-2 mt-5">
        <button
          onClick={() => cerrar(false)}
          className="flex-1 py-3 rounded-xl bg-[#e9e9eb] text-[#1c1c1e] font-medium"
        >
          {pendiente?.textoCancelar ?? "Cancelar"}
        </button>
        <button
          onClick={() => cerrar(true)}
          className={cn(
            "flex-1 py-3 rounded-xl text-white font-semibold",
            tono === "peligro" ? "bg-[#FF3B30]" : tono === "advertencia" ? "bg-[#FF9500]" : "bg-[#007AFF]"
          )}
        >
          {pendiente?.textoConfirmar ?? "Confirmar"}
        </button>
      </div>
    </Modal>
  );
}
