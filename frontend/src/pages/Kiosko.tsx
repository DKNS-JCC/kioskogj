import { useMemo, useState } from "react";
import { Search, Plus, Minus, CreditCard, ChevronRight, Lock } from "lucide-react";
import { useCartStore } from "../store/cartStore";
import { useNinos, useNinoInfo } from "../api/ninos";
import { useProductos } from "../api/productos";
import { useCrearTransaccion } from "../api/transacciones";
import { useCastigosActivos } from "../api/castigos";
import { ApiError } from "../api/client";
import { toast } from "../store/toastStore";
import { cn } from "../lib/cn";
import { eur } from "../lib/format";
import CategoriaIcon from "../components/CategoriaIcon";
import type { NinoOut } from "../api/types";

export default function Kiosko() {
  const { selectedNino, setSelectedNino, items, addQty, total, clearCart } =
    useCartStore();
  const [busqueda, setBusqueda] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState<number | null>(null);

  const { data: ninos = [], isLoading: cargandoNinos } = useNinos();
  const { data: productos = [], isLoading: cargandoProds } = useProductos(true);
  const { data: castigos = {} } = useCastigosActivos();
  const crearTx = useCrearTransaccion();

  const grupos = useMemo(
    () => [...new Set(ninos.map((n) => n.grupo))].sort((a, b) => a - b),
    [ninos]
  );

  const ninosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ninos
      .filter((n) => grupoFiltro === null || n.grupo === grupoFiltro)
      .filter(
        (n) =>
          q === "" ||
          `${n.nombre} ${n.apellidos}`.toLowerCase().includes(q)
      )
      .sort((a, b) => a.grupo - b.grupo || a.nombre.localeCompare(b.nombre));
  }, [ninos, busqueda, grupoFiltro]);

  function castigado(n: NinoOut): boolean {
    const hasta = castigos[String(n.id)];
    return hasta != null && hasta > Date.now();
  }

  // ─── Lista de niños ───────────────────────────────────────────────
  if (!selectedNino) {
    return (
      <div className="space-y-4 p-2 pb-24">
        <h1 className="text-[34px] font-bold text-black tracking-tight leading-none mt-2 px-2">
          Kiosko
        </h1>

        <div className="relative px-2">
          <Search
            className="absolute left-4 top-2 text-[#8E8E93] w-[18px] h-[18px]"
            strokeWidth={2}
          />
          <input
            type="text"
            placeholder="Buscar niño/a"
            className="w-full pl-10 pr-4 py-1.5 bg-[#e4e4e5] rounded-[10px] focus:ring-2 focus:ring-[#007AFF] outline-none text-[17px] placeholder-[#8E8E93]"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {/* Chips de grupo */}
        {grupos.length > 0 && (
          <div className="flex gap-2 px-2 overflow-x-auto hidden-scrollbar pb-1">
            <Chip activo={grupoFiltro === null} onClick={() => setGrupoFiltro(null)}>
              Todos
            </Chip>
            {grupos.map((g) => (
              <Chip
                key={g}
                activo={grupoFiltro === g}
                onClick={() => setGrupoFiltro(g)}
              >
                Grupo {g}
              </Chip>
            ))}
          </div>
        )}

        {cargandoNinos ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007AFF]" />
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden shadow-sm mt-2">
            {ninosFiltrados.map((nino, index) => {
              const bloqueado = castigado(nino);
              return (
                <button
                  key={nino.id}
                  onClick={() => {
                    if (bloqueado) {
                      toast.warn(`${nino.nombre} está castigado.`);
                      return;
                    }
                    setSelectedNino(nino);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
                    bloqueado
                      ? "bg-[#FF3B30]/8 cursor-not-allowed"
                      : "active:bg-[#e5e5ea]",
                    index !== ninosFiltrados.length - 1 && "border-b border-[#c6c6c8]"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {bloqueado && <Lock size={16} className="text-[#FF3B30] shrink-0" />}
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "font-normal text-[17px] tracking-tight truncate",
                          bloqueado ? "text-[#FF3B30]" : "text-black"
                        )}
                      >
                        {nino.nombre} {nino.apellidos}
                      </div>
                      <div className="text-[13px] text-[#8E8E93] mt-0.5">
                        Grupo {nino.grupo}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <div
                      className={cn(
                        "font-normal text-[17px]",
                        nino.dinero <= 0 ? "text-[#FF3B30]" : "text-[#8E8E93]"
                      )}
                    >
                      {eur(nino.dinero)}
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#C7C7CC]" />
                  </div>
                </button>
              );
            })}
            {!cargandoNinos && ninosFiltrados.length === 0 && (
              <p className="px-4 py-6 text-center text-[#8e8e93]">No hay niños.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Carrito del niño seleccionado ──────────────────────────────
  const totalActual = total();
  const saldoRestante = selectedNino.dinero - totalActual;

  return (
    <div className="flex flex-col h-full space-y-5 p-2 pb-40">
      <CompradorActivo
        nino={selectedNino}
        saldoRestante={saldoRestante}
        onCambiar={() => setSelectedNino(null)}
      />

      <div className="flex-1 px-2">
        <h2 className="text-[#8E8E93] text-[13px] uppercase tracking-wide ml-3 mb-1.5">
          Catálogo
        </h2>
        {cargandoProds ? (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007AFF]" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {productos.map((prod) => (
              <button
                key={prod.id}
                onClick={() => addQty(prod, 1)}
                className="bg-white p-4 rounded-[14px] shadow-sm border border-transparent active:border-[#c6c6c8] active:bg-[#e5e5ea] flex flex-col items-center justify-center transition-all"
              >
                {prod.imagen ? (
                  <img 
                    src={prod.imagen.startsWith('http') ? prod.imagen : `http://localhost:8000${prod.imagen}`} 
                    alt="" 
                    className="w-[52px] h-[52px] object-cover rounded-full mb-3 border border-[#e5e5ea]" 
                  />
                ) : (
                  <CategoriaIcon categoria={prod.categoria} size={52} className="mb-3" />
                )}
                <div className="font-normal text-[15px] text-black text-center leading-tight line-clamp-2 min-h-[2.2rem]">
                  {prod.nombre}
                </div>
                <div className="text-[#8E8E93] font-normal text-[15px] mt-1">
                  {eur(prod.precio)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-[64px] left-0 right-0 p-4 bg-white/95 backdrop-blur-xl border-t border-[#c6c6c8] shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-20 rounded-t-3xl">
          <div className="max-w-2xl mx-auto">
            <div className="max-h-[30vh] overflow-y-auto mb-3 -mx-4 px-4 hidden-scrollbar divide-y divide-[#c6c6c8]">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  {item.imagen ? (
                    <img 
                      src={item.imagen.startsWith('http') ? item.imagen : `http://localhost:8000${item.imagen}`} 
                      alt="" 
                      className="w-[36px] h-[36px] object-cover rounded-full border border-[#e5e5ea]" 
                    />
                  ) : (
                    <CategoriaIcon
                      categoria={item.categoria}
                      size={36}
                      fondoSolido={false}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-normal text-[15px] text-black truncate">{item.nombre}</p>
                    <p className="text-[12px] text-[#8E8E93]">
                      {eur(item.precio * item.cantidad)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => addQty(item, -5)}
                      disabled={item.cantidad <= 1}
                      className="w-[34px] h-[34px] rounded-full bg-[#f2f2f7] text-[#FF3B30] text-[12px] font-bold active:bg-[#e5e5ea] disabled:opacity-40"
                      aria-label="Quitar 5"
                    >
                      −5
                    </button>
                    <div className="flex items-center bg-[#f2f2f7] rounded-full px-1 py-1">
                      <button
                        onClick={() => addQty(item, -1)}
                        className="w-[28px] h-[28px] bg-white rounded-full shadow-sm flex items-center justify-center text-black active:bg-[#e5e5ea]"
                        aria-label="Quitar 1"
                      >
                        <Minus className="w-[16px] h-[16px]" />
                      </button>
                      <span className="font-semibold text-[15px] w-7 text-center tabular-nums">
                        {item.cantidad}
                      </span>
                      <button
                        onClick={() => addQty(item, 1)}
                        className="w-[28px] h-[28px] bg-white rounded-full shadow-sm flex items-center justify-center text-black active:bg-[#e5e5ea]"
                        aria-label="Añadir 1"
                      >
                        <Plus className="w-[16px] h-[16px]" />
                      </button>
                    </div>
                    <button
                      onClick={() => addQty(item, 5)}
                      disabled={item.cantidad >= 99}
                      className="w-[34px] h-[34px] rounded-full bg-[#f2f2f7] text-[#007AFF] text-[12px] font-bold active:bg-[#e5e5ea] disabled:opacity-40"
                      aria-label="Añadir 5"
                    >
                      +5
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                crearTx.mutate(
                  {
                    nino_id: selectedNino.id,
                    productos: items.map((i) => ({ id: i.id, cantidad: i.cantidad })),
                  },
                  {
                    onSuccess: (resp) => {
                      toast.ok(`Cobrado ${eur(resp.total)}.`);
                      if (resp.aviso_cota) {
                        toast.warn("¡El niño ha pasado la cota diaria!");
                      }
                      clearCart();
                    },
                    onError: (e) => {
                      const msg =
                        e instanceof ApiError ? e.message : "Error al cobrar.";
                      toast.error(msg);
                    },
                  }
                );
              }}
              disabled={crearTx.isPending || saldoRestante < 0}
              className={cn(
                "w-full py-[14px] rounded-[14px] flex items-center justify-center space-x-2 font-semibold text-[17px] text-white transition-opacity",
                saldoRestante < 0
                  ? "bg-[#C7C7CC] cursor-not-allowed"
                  : "bg-[#007AFF] active:opacity-75"
              )}
            >
              <CreditCard className="w-[22px] h-[22px]" strokeWidth={2} />
              <span>
                {crearTx.isPending ? "Procesando..." : `Cobrar ${eur(totalActual)}`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm whitespace-nowrap font-medium transition-colors",
        activo
          ? "bg-[#007AFF] text-white"
          : "bg-[#e9e9eb] text-[#3c3c43]"
      )}
    >
      {children}
    </button>
  );
}

function CompradorActivo({
  nino,
  saldoRestante,
  onCambiar,
}: {
  nino: NinoOut;
  saldoRestante: number;
  onCambiar: () => void;
}) {
  const { data: info } = useNinoInfo(nino.id);

  return (
    <div className="px-2">
      <h2 className="text-[#8E8E93] text-[13px] uppercase tracking-wide ml-3 mb-1.5">
        Comprador
      </h2>
      <div className="bg-white rounded-xl overflow-hidden shadow-sm">
        <div className="flex justify-between items-center p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-normal text-[17px] text-black tracking-tight">
                {nino.nombre} {nino.apellidos}
              </span>
              {info?.comprado_hoy && (
                <span className="text-[10px] uppercase font-semibold text-[#007AFF] bg-[#007AFF]/10 px-1.5 py-0.5 rounded">
                  hoy
                </span>
              )}
            </div>
            <button
              onClick={onCambiar}
              className="text-[13px] text-[#007AFF] mt-0.5 active:opacity-60"
            >
              Cambiar cliente
            </button>
          </div>
          <div className="text-right">
            <div className="text-[13px] text-[#8E8E93]">Saldo</div>
            <div
              className={cn(
                "font-medium text-[17px]",
                saldoRestante < 0 ? "text-[#FF3B30]" : "text-[#007AFF]"
              )}
            >
              {eur(saldoRestante)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
