import { useMemo, useState } from "react";
import { ChevronLeft, Minus, Plus, Send, User, Check, Trash2, Package } from "lucide-react";
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
import type { ProductoOut, PedidoNinoCreate } from "../api/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface LineaCarrito {
  producto: ProductoOut;
  cantidad: number;
}

type Paso = "grupo" | "ninos" | "lineas";

export default function NuevoPedidoModal({ open, onClose }: Props) {
  const { data: ninos = [] } = useNinos();
  const { data: productos = [] } = useProductos(true);
  const crear = useCrearPedido();

  const [grupo, setGrupo] = useState<number | null>(null);
  const [ninosSeleccionados, setNinosSeleccionados] = useState<number[]>([]);
  // Mapa de nino_id -> lista de líneas
  const [carrito, setCarrito] = useState<Record<number, LineaCarrito[]>>({});
  const [nota, setNota] = useState("");
  const [paso, setPaso] = useState<Paso>("grupo");

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

  const total = Object.values(carrito)
    .flat()
    .reduce((s, l) => s + l.producto.precio * l.cantidad, 0);

  function reset() {
    setGrupo(null);
    setNinosSeleccionados([]);
    setCarrito({});
    setNota("");
    setPaso("grupo");
  }

  function cerrar() {
    reset();
    onClose();
  }

  function toggleNino(id: number) {
    setNinosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function atras() {
    if (paso === "lineas") setPaso("ninos");
    else if (paso === "ninos") setPaso("grupo");
  }

  function irALineas() {
    if (ninosSeleccionados.length > 0) {
      // Inicializar carrito para los nuevos niños si no estaban
      const nuevoCarrito = { ...carrito };
      for (const id of ninosSeleccionados) {
        if (!nuevoCarrito[id]) nuevoCarrito[id] = [];
      }
      setCarrito(nuevoCarrito);
      setPaso("lineas");
    }
  }

  function addQty(ninoId: number, prod: ProductoOut, n: number) {
    setCarrito((prev) => {
      const lineas = prev[ninoId] || [];
      const idx = lineas.findIndex((l) => l.producto.id === prod.id);
      
      let nuevasLineas: LineaCarrito[];
      if (idx === -1) {
        nuevasLineas = n > 0 ? [...lineas, { producto: prod, cantidad: n }] : lineas;
      } else {
        const nuevaCant = lineas[idx].cantidad + n;
        if (nuevaCant <= 0) nuevasLineas = lineas.filter((_, i) => i !== idx);
        else nuevasLineas = lineas.map((l, i) => (i === idx ? { ...l, cantidad: Math.min(nuevaCant, 99) } : l));
      }
      
      return { ...prev, [ninoId]: nuevasLineas };
    });
  }

  function addQtyGlobal(prod: ProductoOut, n: number) {
    for (const id of ninosSeleccionados) {
      addQty(id, prod, n);
    }
    toast.ok(`Añadido ${prod.nombre} a todos`);
  }

  async function enviar() {
    if (ninosSeleccionados.length === 0 || total === 0) return;
    
    const ninosPayload: PedidoNinoCreate[] = ninosSeleccionados
      .filter(id => (carrito[id]?.length || 0) > 0)
      .map((id) => ({
        nino_id: id,
        lineas: carrito[id].map((l) => ({
          producto_id: l.producto.id,
          cantidad: l.cantidad,
        })),
      }));

    if (ninosPayload.length === 0) {
        toast.warn("Añade productos a algún niño.");
        return;
    }

    try {
      await crear.mutateAsync({
        grupo: grupo!,
        ninos: ninosPayload,
        nota: nota.trim() || null,
      });
      toast.ok(`Pedido del Grupo ${grupo} enviado.`);
      cerrar();
    } catch (e) {
        const msg = e instanceof ApiError ? (typeof e.message === 'string' ? e.message : (e.message as any).mensaje) : "Error.";
        toast.error(msg);
    }
  }

  const titulos: Record<Paso, string> = {
    grupo: "Nuevo pedido — Grupo",
    ninos: `Grupo ${grupo} — Niños`,
    lineas: `Grupo ${grupo} — Productos`,
  };

  return (
    <Modal open={open} onClose={cerrar} titulo={titulos[paso]} size="lg">
      <div className="flex flex-col gap-4">
        {paso !== "grupo" && (
          <button
            onClick={atras}
            className="self-start inline-flex items-center gap-1 text-sm text-[#007AFF] -mt-1 font-medium"
          >
            <ChevronLeft size={16} /> Atrás
          </button>
        )}

        {paso === "grupo" && (
          <div className="grid grid-cols-3 gap-2">
            {grupos.map((g) => (
              <button
                key={g}
                onClick={() => { setGrupo(g); setPaso("ninos"); }}
                className="py-6 rounded-2xl bg-[#f2f2f7] active:bg-[#e5e5ea] flex flex-col items-center gap-1"
              >
                <span className="text-xl font-bold text-[#1c1c1e]">G{g}</span>
                <span className="text-xs text-[#8e8e93]">
                  {ninos.filter((n) => n.grupo === g).length} niños
                </span>
              </button>
            ))}
          </div>
        )}

        {paso === "ninos" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto p-1">
              {ninosGrupo.map((n) => {
                const sel = ninosSeleccionados.includes(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => toggleNino(n.id)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all",
                      sel ? "border-[#007AFF] bg-[#007AFF]/5" : "border-transparent bg-[#f2f2f7]"
                    )}
                  >
                    <div className="text-left">
                      <p className="font-semibold text-[#1c1c1e] text-sm">{n.nombre}</p>
                      <p className="text-[10px] text-[#8e8e93]">{n.apellidos}</p>
                    </div>
                    {sel && <Check size={18} className="text-[#007AFF]" />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={irALineas}
              disabled={ninosSeleccionados.length === 0}
              className="w-full py-3 rounded-xl bg-[#007AFF] text-white font-bold disabled:opacity-50 mt-2"
            >
              Continuar con {ninosSeleccionados.length} niños
            </button>
          </div>
        )}

        {paso === "lineas" && (
          <div className="flex flex-col gap-4">
             {/* Catálogo Global */}
             <div className="bg-[#f2f2f7] p-3 rounded-2xl">
                <p className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-wider mb-2 flex items-center gap-1">
                   <Package size={12} /> Añadir a TODOS los seleccionados
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {productos.map(p => (
                        <button
                            key={p.id}
                            onClick={() => addQtyGlobal(p, 1)}
                            className="shrink-0 w-24 p-2 bg-white rounded-xl shadow-sm flex flex-col items-center gap-1 active:scale-95 transition-transform"
                        >
                            <CategoriaIcon categoria={p.categoria} size={24} />
                            <p className="text-[10px] font-bold text-[#1c1c1e] text-center line-clamp-1">{p.nombre}</p>
                        </button>
                    ))}
                </div>
             </div>

             {/* Por niño */}
             <div className="flex flex-col gap-4 max-h-[40vh] overflow-y-auto pr-1">
                {ninosSeleccionados.map(id => {
                    const nino = ninos.find(n => n.id === id);
                    if (!nino) return null;
                    const lineas = carrito[id] || [];
                    return (
                        <div key={id} className="bg-white border border-[#e5e5ea] rounded-2xl overflow-hidden">
                            <div className="px-3 py-2 bg-[#fafafa] border-b border-[#e5e5ea] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <User size={14} className="text-[#8e8e93]" />
                                    <span className="text-xs font-bold text-[#1c1c1e]">{nino.nombre}</span>
                                </div>
                                <button 
                                    onClick={() => setCarrito(prev => ({...prev, [id]: []}))}
                                    className="text-[#FF3B30] p-1 active:opacity-50"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            
                            {lineas.length === 0 ? (
                                <p className="text-center py-4 text-[11px] text-[#8e8e93]">Sin productos.</p>
                            ) : (
                                <div className="divide-y divide-[#f2f2f7]">
                                    {lineas.map(l => (
                                        <div key={l.producto.id} className="flex items-center px-3 py-2 gap-2">
                                            <span className="flex-1 text-[11px] text-[#1c1c1e] font-medium truncate">{l.producto.nombre}</span>
                                            <div className="flex items-center bg-[#f2f2f7] rounded-full scale-90 origin-right">
                                                <button onClick={() => addQty(id, l.producto, -1)} className="w-6 h-6 flex items-center justify-center"><Minus size={12}/></button>
                                                <span className="w-5 text-center text-xs font-bold">{l.cantidad}</span>
                                                <button onClick={() => addQty(id, l.producto, 1)} className="w-6 h-6 flex items-center justify-center"><Plus size={12}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {/* Selector individual rápido */}
                            <div className="p-2 border-t border-[#f2f2f7] flex gap-2 overflow-x-auto no-scrollbar">
                                {productos.slice(0, 6).map(p => (
                                    <button 
                                        key={p.id} 
                                        onClick={() => addQty(id, p, 1)}
                                        className="shrink-0 px-2 py-1 bg-[#f2f2f7] rounded-lg text-[9px] font-bold text-[#3c3c43]"
                                    >
                                        + {p.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
             </div>

             <Input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={200}
                placeholder="Nota general (ej: servirlos juntos)"
             />

             <div className="flex items-center gap-2 pt-2">
                <div className="flex-1 text-xs text-[#8e8e93]">
                    Total Grupo: <span className="font-bold text-[#1c1c1e] text-sm tabular-nums">{eur(total)}</span>
                </div>
                <button
                    onClick={enviar}
                    disabled={total === 0 || crear.isPending}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#34C759] text-white text-sm font-bold disabled:opacity-50 shadow-sm"
                >
                    <Send size={14} />
                    {crear.isPending ? "Enviando..." : "Enviar pedido"}
                </button>
             </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
