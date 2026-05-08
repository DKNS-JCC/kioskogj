import { useMemo, useState } from "react";
import {
  Check,
  ChefHat,
  ChevronDown,
  ChevronRight,
  Plus,
  Replace,
  Trash2,
  Truck,
  X,
  User,
} from "lucide-react";
import {
  usePedidos,
  useActualizarLinea,
  useCompletarPedido,
  useBorrarPedido,
  useMarcarPreparado,
} from "../api/pedidos";
import { ApiError } from "../api/client";
import { eur, fechaCorta } from "../lib/format";
import { cn } from "../lib/cn";
import { toast } from "../store/toastStore";
import { confirmar } from "../components/ui/ConfirmDialog";
import CategoriaIcon from "../components/CategoriaIcon";
import NuevoPedidoModal from "../components/NuevoPedidoModal";
import type {
  EstadoLineaPedido,
  EstadoPedido,
  PedidoLineaOut,
  PedidoOut,
  PedidoNinoOut,
} from "../api/types";

// Tres fases visibles. Cada una muestra distintos pedidos y distintas acciones.
type Fase = EstadoPedido;

const FASES: { v: Fase; label: string }[] = [
  { v: "pendiente", label: "Por preparar" },
  { v: "preparado", label: "Por repartir" },
  { v: "completado", label: "Completados" },
];

export default function Pedidos() {
  const [vista, setVista] = useState<Fase>("pendiente");
  const [nuevoOpen, setNuevoOpen] = useState(false);

  const { data: pedidos = [], isLoading } = usePedidos({ estado: vista });

  const pedidosOrdenados = useMemo(() => {
    return [...pedidos].sort((a, b) => {
      if (a.grupo !== b.grupo) return a.grupo - b.grupo;
      return new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime();
    });
  }, [pedidos]);

  const vacioMsg: Record<Fase, string> = {
    pendiente: "No hay pedidos por preparar.",
    preparado: "No hay pedidos por repartir.",
    completado: "Aún no hay pedidos completados.",
  };

  return (
    <div className="p-4 pb-24 max-w-3xl mx-auto flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1c1c1e]">Pedidos</h1>
        <button
          onClick={() => setNuevoOpen(true)}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#007AFF] text-white text-sm font-semibold active:opacity-80"
        >
          <Plus size={16} /> Nuevo pedido
        </button>
      </header>

      <div className="inline-flex rounded-lg bg-[#e9e9eb] p-1">
        {FASES.map((opt) => {
          const activo = opt.v === vista;
          return (
            <button
              key={opt.v}
              onClick={() => setVista(opt.v)}
              className={cn(
                "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                activo
                  ? "bg-white text-[#1c1c1e] shadow-sm"
                  : "text-[#3c3c43]/80"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {isLoading && <p className="text-[#8e8e93] text-center py-8">Cargando...</p>}

      {!isLoading && pedidosOrdenados.length === 0 && (
        <p className="text-center text-[#8e8e93] py-12">{vacioMsg[vista]}</p>
      )}

      {pedidosOrdenados.map((p) => (
        <TarjetaPedido key={p.id} pedido={p} fase={vista} />
      ))}

      <NuevoPedidoModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} />
    </div>
  );
}

// ─── Tarjeta de un pedido (Grupo) ────────────────────────────────────────

function TarjetaPedido({ pedido, fase }: { pedido: PedidoOut; fase: Fase }) {
  const [abierto, setAbierto] = useState(fase !== "completado");

  const lineasTotales = pedido.ninos.flatMap((n) => n.lineas);

  // Cuenta de líneas por hacer en cada fase.
  const lineasPorResolver =
    fase === "pendiente"
      ? lineasTotales.filter((l) => l.estado === "pendiente").length
      : fase === "preparado"
        ? lineasTotales.filter((l) => l.estado === "listo" || l.estado === "reemplazado").length
        : 0;

  // Total estimado: lo que aún cuenta como "vivo" + lo entregado.
  const total = lineasTotales
    .filter((l) =>
      l.estado === "pendiente" ||
      l.estado === "listo" ||
      l.estado === "reemplazado" ||
      l.estado === "entregado"
    )
    .reduce((s, l) => s + l.producto_precio * l.cantidad, 0);

  const preparar = useMarcarPreparado();
  const completar = useCompletarPedido();
  const borrar = useBorrarPedido();

  // Resumen agregado de productos para el kiosko (qué hay que servir en bloque).
  const resumenAgregado = useMemo(() => {
    if (fase !== "pendiente") return [];
    const acum = new Map<string, number>();
    for (const l of lineasTotales) {
      if (l.estado !== "pendiente") continue;
      acum.set(l.producto_nombre, (acum.get(l.producto_nombre) ?? 0) + l.cantidad);
    }
    return [...acum.entries()].sort((a, b) => b[1] - a[1]);
  }, [lineasTotales, fase]);

  async function pedirPreparar() {
    if (lineasPorResolver > 0) return;
    const ok = await confirmar({
      titulo: "Marcar como preparado",
      mensaje: `El monitor del Grupo ${pedido.grupo} podrá venir a recoger y repartir.`,
      textoConfirmar: "Marcar preparado",
    });
    if (!ok) return;
    preparar.mutate(pedido.id, {
      onSuccess: () => toast.ok("Pedido preparado."),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Error."),
    });
  }

  async function pedirCompletar() {
    const entregadas = lineasTotales.filter((l) => l.estado === "entregado");
    const ok = await confirmar({
      titulo: "Completar y cobrar",
      mensaje:
        entregadas.length === 0
          ? `No hay líneas entregadas. El pedido del Grupo ${pedido.grupo} se cerrará sin cobrar nada.`
          : `Se generarán las transacciones correspondientes para los niños del Grupo ${pedido.grupo}.`,
      textoConfirmar: "Completar todo",
    });
    if (!ok) return;
    completar.mutate(pedido.id, {
      onSuccess: () => toast.ok("Pedido completado."),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Error."),
    });
  }

  async function pedirBorrar() {
    const ok = await confirmar({
      titulo: "Borrar pedido",
      mensaje: `Se descartará el pedido del Grupo ${pedido.grupo}. No se cobrará nada.`,
      textoConfirmar: "Borrar",
      tono: "peligro",
    });
    if (!ok) return;
    borrar.mutate(pedido.id, {
      onSuccess: () => toast.ok("Pedido borrado."),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Error."),
    });
  }

  const subtitulo =
    fase === "pendiente"
      ? `${lineasPorResolver} pendientes`
      : fase === "preparado"
        ? `${lineasPorResolver} por repartir`
        : `Completado ${pedido.completado_en ? fechaCorta(pedido.completado_en) : ""}`;

  return (
    <article className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#e5e5ea]">
      <button
        onClick={() => setAbierto((s) => !s)}
        className="w-full flex items-center justify-between gap-3 px-4 py-4 active:bg-[#f2f2f7]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] font-bold shrink-0">
            {pedido.grupo}
          </div>
          <div className="text-left min-w-0">
            <p className="font-bold text-[#1c1c1e]">Grupo {pedido.grupo}</p>
            <p className="text-xs text-[#8e8e93]">
              {pedido.ninos.length} {pedido.ninos.length === 1 ? "niño" : "niños"} · {subtitulo}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right tabular-nums">
             <p className="text-sm font-semibold text-[#1c1c1e]">{eur(total)}</p>
             <p className="text-[10px] text-[#8e8e93]">{new Date(pedido.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
          </div>
          {abierto ? <ChevronDown size={18} className="text-[#8e8e93]" /> : <ChevronRight size={18} className="text-[#8e8e93]" />}
        </div>
      </button>

      {abierto && (
        <div className="border-t border-[#e5e5ea] flex flex-col">
          {resumenAgregado.length > 0 && (
            <div className="px-4 py-3 bg-[#f2f2f7]/50 flex flex-wrap gap-1.5 border-b border-[#e5e5ea]">
              <span className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-wider self-center mr-1">
                A PREPARAR EN BLOQUE:
              </span>
              {resumenAgregado.map(([nombre, qty]) => (
                <span
                  key={nombre}
                  className="px-2 py-0.5 rounded-md bg-white border border-[#e5e5ea] text-[#1c1c1e] text-[11px] font-medium"
                >
                  {qty}× {nombre}
                </span>
              ))}
            </div>
          )}

          <div className="divide-y divide-[#f2f2f7]">
            {pedido.ninos.map((n) => (
              <SeccionNino key={n.id} pedidoId={pedido.id} nino={n} fase={fase} />
            ))}
          </div>

          {pedido.nota && (
            <p className="px-4 py-2 text-xs text-[#8e8e93] italic border-t border-[#f2f2f7]">
              Nota: {pedido.nota}
            </p>
          )}

          {fase === "pendiente" && (
            <div className="flex gap-2 p-3 border-t border-[#e5e5ea] bg-[#fafafa]">
              <button
                onClick={pedirBorrar}
                className="px-3 py-2 rounded-xl bg-white text-[#FF3B30] text-sm font-medium border border-[#e5e5ea]"
              >
                <Trash2 size={14} className="inline -mt-0.5 mr-1" />
                Borrar
              </button>
              <button
                onClick={pedirPreparar}
                disabled={lineasPorResolver > 0 || preparar.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-xl bg-[#FF9500] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChefHat size={14} />
                {preparar.isPending
                  ? "Marcando..."
                  : lineasPorResolver === 0
                    ? "Marcar preparado"
                    : `Resuelve ${lineasPorResolver} línea${lineasPorResolver === 1 ? "" : "s"} antes`}
              </button>
            </div>
          )}

          {fase === "preparado" && (
            <div className="flex gap-2 p-3 border-t border-[#e5e5ea] bg-[#fafafa]">
              <button
                onClick={pedirBorrar}
                className="px-3 py-2 rounded-xl bg-white text-[#FF3B30] text-sm font-medium border border-[#e5e5ea]"
              >
                <Trash2 size={14} className="inline -mt-0.5 mr-1" />
                Borrar
              </button>
              <button
                onClick={pedirCompletar}
                disabled={lineasPorResolver > 0 || completar.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-xl bg-[#34C759] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Truck size={14} />
                {completar.isPending
                  ? "Cobrando..."
                  : lineasPorResolver === 0
                    ? "Completar y cobrar"
                    : `Reparte ${lineasPorResolver} línea${lineasPorResolver === 1 ? "" : "s"} antes`}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Sección de un niño dentro del pedido ────────────────────────────────

function SeccionNino({
  pedidoId,
  nino,
  fase,
}: {
  pedidoId: number;
  nino: PedidoNinoOut;
  fase: Fase;
}) {
  // Total mostrado: incluye lo que sigue "vivo" en la fase actual.
  const totalNino = nino.lineas
    .filter((l) =>
      l.estado === "pendiente" ||
      l.estado === "listo" ||
      l.estado === "reemplazado" ||
      l.estado === "entregado"
    )
    .reduce((s, l) => s + l.producto_precio * l.cantidad, 0);

  return (
    <div className="flex flex-col">
      <div className="px-4 py-2 bg-[#fafafa] flex items-center justify-between border-b border-[#f2f2f7]">
        <div className="flex items-center gap-2">
           <User size={14} className="text-[#8e8e93]" />
           <span className="text-sm font-semibold text-[#3c3c43]">{nino.nino_nombre}</span>
        </div>
        <span className="text-xs font-medium text-[#8e8e93]">{eur(totalNino)}</span>
      </div>
      <ul className="divide-y divide-[#f2f2f7]">
        {nino.lineas.map((l) => (
          <FilaLinea key={l.id} pedidoId={pedidoId} linea={l} fase={fase} />
        ))}
      </ul>
    </div>
  );
}

// ─── Línea de pedido (con acciones según fase) ───────────────────────────

function FilaLinea({
  pedidoId,
  linea,
  fase,
}: {
  pedidoId: number;
  linea: PedidoLineaOut;
  fase: Fase;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(linea.reemplazo_texto ?? "");
  const actualizar = useActualizarLinea();

  function setEstado(estado: EstadoLineaPedido) {
    actualizar.mutate(
      { pedidoId, lineaId: linea.id, data: { estado } },
      {
        onError: (e) => toast.error(e instanceof ApiError ? e.message : "Error."),
      }
    );
  }

  function confirmarReemplazo() {
    if (!texto.trim()) {
      toast.warn("Escribe con qué se reemplaza.");
      return;
    }
    actualizar.mutate(
      {
        pedidoId,
        lineaId: linea.id,
        data: { estado: "reemplazado", reemplazo_texto: texto.trim() },
      },
      {
        onSuccess: () => setEditando(false),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : "Error."),
      }
    );
  }

  // Acciones disponibles para esta línea en la fase actual.
  const acciones: AccionLinea[] = (() => {
    if (fase === "completado") return [];
    if (fase === "pendiente") {
      // Kiosko prepara.
      if (linea.estado === "pendiente") {
        return ["listo", "reemplazar", "descartado"];
      }
      // Ya resuelta por kiosko: solo permitir volver a pendiente.
      return ["volver"];
    }
    // fase === "preparado": monitor reparte.
    if (linea.estado === "listo" || linea.estado === "reemplazado") {
      return ["entregado", "descartado"];
    }
    if (linea.estado === "entregado" || linea.estado === "descartado") {
      // Volver al estado anterior natural (listo) por si fue un error.
      return ["volver_a_listo"];
    }
    return [];
  })();

  return (
    <li className="px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <CategoriaIcon categoria={null} size={32} fondoSolido={false} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-[#1c1c1e] truncate">
            <span className="font-semibold tabular-nums">{linea.cantidad}×</span>{" "}
            {linea.producto_nombre}
          </p>
          <p className="text-[11px] text-[#8e8e93]">
            {eur(linea.producto_precio)} c/u · {eur(linea.producto_precio * linea.cantidad)}
            {linea.estado === "reemplazado" && linea.reemplazo_texto && (
              <span className="text-[#FF9500]"> · → {linea.reemplazo_texto}</span>
            )}
          </p>
        </div>
        <BadgeEstado estado={linea.estado} />
      </div>

      {!editando && acciones.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {acciones.includes("listo") && (
            <BotonAccion onClick={() => setEstado("listo")} icono={Check} variante="ok">
              Listo
            </BotonAccion>
          )}
          {acciones.includes("reemplazar") && (
            <BotonAccion onClick={() => setEditando(true)} icono={Replace} variante="warn">
              Reemplazar
            </BotonAccion>
          )}
          {acciones.includes("entregado") && (
            <BotonAccion onClick={() => setEstado("entregado")} icono={Check} variante="ok">
              Entregado
            </BotonAccion>
          )}
          {acciones.includes("descartado") && (
            <BotonAccion onClick={() => setEstado("descartado")} icono={X} variante="neutro">
              Descartar
            </BotonAccion>
          )}
          {acciones.includes("volver") && (
            <button
              onClick={() => setEstado("pendiente")}
              className="text-[11px] text-[#007AFF] font-medium hover:underline"
            >
              Volver a pendiente
            </button>
          )}
          {acciones.includes("volver_a_listo") && (
            <button
              onClick={() => setEstado("listo")}
              className="text-[11px] text-[#007AFF] font-medium hover:underline"
            >
              Volver a listo
            </button>
          )}
        </div>
      )}

      {editando && (
        <div className="flex gap-2 items-center">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="¿Con qué se reemplazó?"
            autoFocus
            maxLength={120}
            className="flex-1 px-3 py-2 border border-[#e5e5ea] rounded-xl text-sm outline-none focus:border-[#FF9500] bg-white"
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmarReemplazo();
              if (e.key === "Escape") setEditando(false);
            }}
          />
          <button
            onClick={confirmarReemplazo}
            disabled={actualizar.isPending}
            className="px-3 py-2 rounded-xl bg-[#FF9500] text-white text-sm font-semibold"
          >
            OK
          </button>
          <button
            onClick={() => setEditando(false)}
            className="px-3 py-2 rounded-xl bg-[#e9e9eb] text-[#1c1c1e] text-sm"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </li>
  );
}

type AccionLinea =
  | "listo"
  | "reemplazar"
  | "entregado"
  | "descartado"
  | "volver"
  | "volver_a_listo";

function BadgeEstado({ estado }: { estado: EstadoLineaPedido }) {
  const cfg: Record<EstadoLineaPedido, { label: string; color: string }> = {
    pendiente: { label: "Pnd", color: "bg-[#8e8e93]/15 text-[#8e8e93]" },
    listo: { label: "Listo", color: "bg-[#5AC8FA]/20 text-[#0A84FF]" },
    entregado: { label: "Ok", color: "bg-[#34C759]/15 text-[#34C759]" },
    reemplazado: { label: "Rep", color: "bg-[#FF9500]/15 text-[#FF9500]" },
    descartado: { label: "X", color: "bg-[#FF3B30]/15 text-[#FF3B30]" },
  };
  const { label, color } = cfg[estado];
  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-full shrink-0", color)}>
      {label}
    </span>
  );
}

function BotonAccion({
  onClick,
  icono: Icono,
  variante,
  children,
}: {
  onClick: () => void;
  icono: typeof Check;
  variante: "ok" | "warn" | "neutro";
  children: React.ReactNode;
}) {
  const colores = {
    ok: "bg-[#34C759]/10 text-[#34C759]",
    warn: "bg-[#FF9500]/10 text-[#FF9500]",
    neutro: "bg-[#8e8e93]/10 text-[#8e8e93]",
  } as const;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-tight",
        colores[variante]
      )}
    >
      <Icono size={12} />
      {children}
    </button>
  );
}
