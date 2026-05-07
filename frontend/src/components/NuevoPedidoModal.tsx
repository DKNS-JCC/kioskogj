import { useMemo, useState } from "react";
import { ChevronLeft, Minus, Plus, Send } from "lucide-react";
import Modal from "./ui/Modal";
import Input from "./ui/Input";
import CategoriaIcon from "./CategoriaIcon";
import { useNinos } from "../api/ninos";
import { useProductos } from "../api/productos";
import { useCrearPedido } from "../api/pedidos";
import { ApiError } from "../api/client";
import { eur } from "../lib/format";
import { cn } from "../lib/cn";
import { toast } from "../store/toastStore";
import type { NinoOut, ProductoOut } from "../api/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface LineaCarrito {
  producto: ProductoOut;
  cantidad: number;
}

type Paso = "grupo" | "nino" | "productos";

export default function NuevoPedidoModal({ open, onClose }: Props) {
  const { data: ninos = [] } = useNinos();
  const { data: productos = [] } = useProductos(true);
  const crear = useCrearPedido();

  const [grupo, setGrupo] = useState<number | null>(null);
  const [nino, setNino] = useState<NinoOut | null>(null);
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [nota, setNota] = useState("");

  const paso: Paso = nino ? "productos" : grupo !== null ? "nino" : "grupo";

  const grupos = useMemo(
    () => [...new Set(ninos.map((n) => n.grupo))].sort((a, b) => a - b),
    [ninos]
  );
  const ninosGrupo = useMemo(
    () =>
      ninos
        .filter((n) => n.grupo === grupo)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [ninos, grupo]
  );

  const total = lineas.reduce((s, l) => s + l.producto.precio * l.cantidad, 0);

  function reset() {
    setGrupo(null);
    setNino(null);
    setLineas([]);
    setNota("");
  }

  function cerrar() {
    reset();
    onClose();
  }

  function atras() {
    if (paso === "productos") {
      setNino(null);
      setLineas([]);
      setNota("");
    } else if (paso === "nino") {
      setGrupo(null);
    }
  }

  function addQty(prod: ProductoOut, n: number) {
    setLineas((prev) => {
      const idx = prev.findIndex((l) => l.producto.id === prod.id);
      if (idx === -1) {
        return n > 0 ? [...prev, { producto: prod, cantidad: n }] : prev;
      }
      const nueva = prev[idx].cantidad + n;
      if (nueva <= 0) return prev.filter((_, i) => i !== idx);
      const recortada = Math.min(nueva, 99);
      return prev.map((l, i) => (i === idx ? { ...l, cantidad: recortada } : l));
    });
  }

  async function enviar() {
    if (!nino || lineas.length === 0) return;
    try {
      await crear.mutateAsync({
        nino_id: nino.id,
        lineas: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
        nota: nota.trim() || null,
      });
      toast.ok(`Pedido para ${nino.nombre} enviado.`);
      cerrar();
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error."
      );
    }
  }

  const titulos: Record<Paso, string> = {
    grupo: "Nuevo pedido — selecciona grupo",
    nino: `Grupo ${grupo} — selecciona niño`,
    productos: nino ? `Pedido para ${nino.nombre}` : "Pedido",
  };

  return (
    <Modal open={open} onClose={cerrar} titulo={titulos[paso]} size="lg">
      <div className="flex flex-col gap-3">
        {paso !== "grupo" && (
          <button
            onClick={atras}
            className="self-start inline-flex items-center gap-1 text-sm text-[#007AFF] -mt-1"
          >
            <ChevronLeft size={16} /> Atrás
          </button>
        )}

        {paso === "grupo" && (
          <>
            {grupos.length === 0 ? (
              <p className="text-center text-[#8e8e93] py-6">
                No hay niños registrados. Añádelos primero en Ajustes.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {grupos.map((g) => {
                  const cuantos = ninos.filter((n) => n.grupo === g).length;
                  return (
                    <button
                      key={g}
                      onClick={() => setGrupo(g)}
                      className="py-6 rounded-2xl bg-[#f2f2f7] active:bg-[#e5e5ea] flex flex-col items-center gap-1"
                    >
                      <span className="text-xl font-bold text-[#1c1c1e]">G{g}</span>
                      <span className="text-xs text-[#8e8e93]">{cuantos} niños</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {paso === "nino" && (
          <ul className="bg-white rounded-2xl divide-y divide-[#e5e5ea] overflow-hidden border border-[#e5e5ea]">
            {ninosGrupo.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => setNino(n)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-[#f2f2f7]"
                >
                  <div>
                    <p className="font-medium text-[#1c1c1e]">
                      {n.nombre} {n.apellidos}
                    </p>
                    <p className="text-xs text-[#8e8e93]">Saldo: {eur(n.dinero)}</p>
                  </div>
                  <ChevronLeft size={18} className="text-[#c7c7cc] rotate-180" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {paso === "productos" && nino && (
          <>
            {/* Catálogo */}
            <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {productos.map((p) => {
                const cant = lineas.find((l) => l.producto.id === p.id)?.cantidad ?? 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addQty(p, 1)}
                    className={cn(
                      "p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-colors",
                      cant > 0
                        ? "border-[#007AFF] bg-[#007AFF]/5"
                        : "border-transparent bg-[#f2f2f7] active:bg-[#e5e5ea]"
                    )}
                  >
                    <CategoriaIcon categoria={p.categoria} size={36} />
                    <p className="text-xs font-medium text-[#1c1c1e] text-center line-clamp-2 min-h-[2rem]">
                      {p.nombre}
                    </p>
                    <p className="text-xs text-[#8e8e93]">{eur(p.precio)}</p>
                    {cant > 0 && (
                      <span className="absolute -translate-y-3 -translate-x-12 text-[10px] font-bold text-white bg-[#007AFF] rounded-full w-5 h-5 flex items-center justify-center">
                        {cant}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Carrito */}
            {lineas.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#e5e5ea] divide-y divide-[#f2f2f7]">
                {lineas.map((l) => (
                  <div key={l.producto.id} className="flex items-center px-3 py-2 gap-3">
                    <span className="flex-1 text-sm text-[#1c1c1e] truncate">
                      {l.producto.nombre}
                    </span>
                    <span className="text-xs text-[#8e8e93] w-14 text-right">
                      {eur(l.producto.precio * l.cantidad)}
                    </span>
                    <div className="flex items-center bg-[#f2f2f7] rounded-full">
                      <button
                        onClick={() => addQty(l.producto, -1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">
                        {l.cantidad}
                      </span>
                      <button
                        onClick={() => addQty(l.producto, 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={200}
              placeholder="Nota opcional (alergia, preferencia, ...)"
            />

            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1 text-sm text-[#1c1c1e]">
                Total estimado:{" "}
                <span className="font-semibold tabular-nums">{eur(total)}</span>
              </div>
              <button
                onClick={enviar}
                disabled={lineas.length === 0 || crear.isPending}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#007AFF] text-white text-sm font-semibold disabled:opacity-50"
              >
                <Send size={14} />
                {crear.isPending ? "Enviando..." : "Enviar al kiosko"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
