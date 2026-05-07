import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  Replace,
  Trash2,
  X,
} from "lucide-react";
import {
  usePedidos,
  useActualizarLinea,
  useCompletarPedido,
  useBorrarPedido,
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
} from "../api/types";

export default function Pedidos() {
  const [vista, setVista] = useState<EstadoPedido>("pendiente");
  const [nuevoOpen, setNuevoOpen] = useState(false);

  const { data: pedidos = [], isLoading } = usePedidos({ estado: vista });

  const grupos = useMemo(() => {
    const mapa = new Map<number, PedidoOut[]>();
    for (const p of pedidos) {
      if (!mapa.has(p.grupo)) mapa.set(p.grupo, []);
      mapa.get(p.grupo)!.push(p);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.nino_nombre.localeCompare(b.nino_nombre));
    }
    return [...mapa.entries()].sort(([a], [b]) => a - b);
  }, [pedidos]);

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
        {(
          [
            { v: "pendiente", label: "Pendientes" },
            { v: "completado", label: "Completados" },
          ] as const
        ).map((opt) => {
          const activo = opt.v === vista;
          return (
            <button
              key={opt.v}
              onClick={() => setVista(opt.v)}
              className={cn(
                "flex-1 px-4 py-1.5 text-sm font-medium rounded-md transition-all",
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

      {!isLoading && grupos.length === 0 && (
        <p className="text-center text-[#8e8e93] py-12">
          {vista === "pendiente" ? "No hay pedidos pendientes." : "Aún no hay pedidos completados."}
        </p>
      )}

      {grupos.map(([grupo, lista]) => (
        <SeccionGrupo key={grupo} grupo={grupo} pedidos={lista} vista={vista} />
      ))}

      <NuevoPedidoModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} />
    </div>
  );
}

// ─── Sección por grupo ───────────────────────────────────────────────────

function SeccionGrupo({
  grupo,
  pedidos,
  vista,
}: {
  grupo: number;
  pedidos: PedidoOut[];
  vista: EstadoPedido;
}) {
  // Resumen: solo de pendientes (lo que falta por servir).
  const totales = useMemo(() => {
    if (vista !== "pendiente") return [];
    const acum = new Map<string, number>();
    for (const p of pedidos) {
      for (const l of p.lineas) {
        if (l.estado !== "pendiente") continue;
        acum.set(l.producto_nombre, (acum.get(l.producto_nombre) ?? 0) + l.cantidad);
      }
    }
    return [...acum.entries()].sort((a, b) => b[1] - a[1]);
  }, [pedidos, vista]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8e8e93]">
          Grupo {grupo}
        </h2>
        <span className="text-xs text-[#8e8e93]">
          {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}
        </span>
      </div>

      {totales.length > 0 && (
        <div className="bg-white rounded-2xl p-3 flex flex-wrap gap-1.5">
          <span className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wide self-center mr-1">
            Por servir:
          </span>
          {totales.map(([nombre, qty]) => (
            <span
              key={nombre}
              className="px-2.5 py-1 rounded-full bg-[#007AFF]/10 text-[#007AFF] text-sm font-medium"
            >
              {qty}× {nombre}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {pedidos.map((p) => (
          <TarjetaPedido key={p.id} pedido={p} />
        ))}
      </div>
    </section>
  );
}

// ─── Tarjeta de un pedido ────────────────────────────────────────────────

function TarjetaPedido({ pedido }: { pedido: PedidoOut }) {
  const [abierto, setAbierto] = useState(pedido.estado === "pendiente");

  const total = pedido.lineas
    .filter((l) => l.estado === "entregado" || l.estado === "pendiente")
    .reduce((s, l) => s + l.producto_precio * l.cantidad, 0);

  const completar = useCompletarPedido();
  const borrar = useBorrarPedido();

  const pendientesCount = pedido.lineas.filter((l) => l.estado === "pendiente").length;
  const todasResueltas = pendientesCount === 0;

  async function pedirCompletar() {
    const entregadas = pedido.lineas.filter((l) => l.estado === "entregado");
    const totalCobro = entregadas.reduce(
      (s, l) => s + l.producto_precio * l.cantidad,
      0
    );
    const ok = await confirmar({
      titulo: "Completar pedido",
      mensaje:
        entregadas.length === 0
          ? `No hay líneas entregadas. El pedido se cerrará sin cobrar nada.`
          : `Se cobrarán ${eur(totalCobro)} a ${pedido.nino_nombre} (${entregadas.length} líneas).`,
      textoConfirmar: "Completar",
    });
    if (!ok) return;
    completar.mutate(pedido.id, {
      onSuccess: () => toast.ok("Pedido completado."),
      onError: (e) => {
        const msg = e instanceof ApiError ? e.message : "Error.";
        toast.error(msg);
      },
    });
  }

  async function pedirBorrar() {
    const ok = await confirmar({
      titulo: "Borrar pedido",
      mensaje: `Se descarta el pedido de ${pedido.nino_nombre}. No se cobra nada.`,
      textoConfirmar: "Borrar",
      tono: "peligro",
    });
    if (!ok) return;
    borrar.mutate(pedido.id, {
      onSuccess: () => toast.ok("Pedido borrado."),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Error."),
    });
  }

  return (
    <article className="bg-white rounded-2xl overflow-hidden">
      <button
        onClick={() => setAbierto((s) => !s)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 active:bg-[#f2f2f7]"
      >
        <div className="flex items-center gap-2 min-w-0">
          {abierto ? (
            <ChevronDown size={18} className="text-[#8e8e93] shrink-0" />
          ) : (
            <ChevronRight size={18} className="text-[#8e8e93] shrink-0" />
          )}
          <div className="text-left min-w-0">
            <p className="font-medium text-[#1c1c1e] truncate">{pedido.nino_nombre}</p>
            <p className="text-xs text-[#8e8e93]">
              {pedido.lineas.length} {pedido.lineas.length === 1 ? "línea" : "líneas"} ·{" "}
              {pedido.estado === "pendiente"
                ? `${pendientesCount} pendientes`
                : `Completado ${pedido.completado_en ? fechaCorta(pedido.completado_en) : ""}`}
            </p>
          </div>
        </div>
        <span className="text-sm font-semibold text-[#1c1c1e] tabular-nums">
          {eur(total)}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-[#e5e5ea] flex flex-col">
          <ul className="divide-y divide-[#f2f2f7]">
            {pedido.lineas.map((l) => (
              <FilaLinea
                key={l.id}
                pedidoId={pedido.id}
                linea={l}
                bloqueada={pedido.estado === "completado"}
              />
            ))}
          </ul>
          {pedido.nota && (
            <p className="px-4 py-2 text-xs text-[#8e8e93] italic border-t border-[#f2f2f7]">
              Nota: {pedido.nota}
            </p>
          )}
          {pedido.estado === "pendiente" && (
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
                disabled={!todasResueltas || completar.isPending}
                className="flex-1 py-2 rounded-xl bg-[#34C759] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {completar.isPending
                  ? "Completando..."
                  : todasResueltas
                    ? "Completar pedido"
                    : `Resuelve ${pendientesCount} línea${pendientesCount === 1 ? "" : "s"} antes`}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Línea de pedido (con acciones) ──────────────────────────────────────

function FilaLinea({
  pedidoId,
  linea,
  bloqueada,
}: {
  pedidoId: number;
  linea: PedidoLineaOut;
  bloqueada: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(linea.reemplazo_texto ?? "");
  const actualizar = useActualizarLinea();

  function setEstado(estado: EstadoLineaPedido) {
    actualizar.mutate(
      { pedidoId, lineaId: linea.id, data: { estado } },
      {
        onError: (e) => toast.error(e instanceof Error ? e.message : "Error."),
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
        onError: (e) => toast.error(e instanceof Error ? e.message : "Error."),
      }
    );
  }

  return (
    <li className="px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <CategoriaIcon
          categoria={null /* el catálogo no viaja en la línea; OK gris */}
          size={32}
          fondoSolido={false}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] text-[#1c1c1e] truncate">
            <span className="font-semibold tabular-nums">{linea.cantidad}×</span>{" "}
            {linea.producto_nombre}
          </p>
          <p className="text-xs text-[#8e8e93]">
            {eur(linea.producto_precio)} c/u · {eur(linea.producto_precio * linea.cantidad)}{" "}
            {linea.estado === "reemplazado" && linea.reemplazo_texto && (
              <span className="text-[#FF9500]"> · → {linea.reemplazo_texto}</span>
            )}
          </p>
        </div>
        <BadgeEstado estado={linea.estado} />
      </div>

      {!bloqueada && !editando && linea.estado === "pendiente" && (
        <div className="flex gap-2">
          <BotonAccion onClick={() => setEstado("entregado")} icono={Check} variante="ok">
            Entregar
          </BotonAccion>
          <BotonAccion onClick={() => setEditando(true)} icono={Replace} variante="warn">
            Reemplazar
          </BotonAccion>
          <BotonAccion onClick={() => setEstado("descartado")} icono={X} variante="neutro">
            Descartar
          </BotonAccion>
        </div>
      )}

      {!bloqueada && editando && (
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

      {!bloqueada && !editando && linea.estado !== "pendiente" && (
        <button
          onClick={() => setEstado("pendiente")}
          className="self-start text-xs text-[#007AFF] underline-offset-2 hover:underline"
        >
          Volver a pendiente
        </button>
      )}
    </li>
  );
}

function BadgeEstado({ estado }: { estado: EstadoLineaPedido }) {
  const cfg = {
    pendiente: { label: "Pendiente", color: "bg-[#8e8e93]/15 text-[#8e8e93]" },
    entregado: { label: "Entregado", color: "bg-[#34C759]/15 text-[#34C759]" },
    reemplazado: { label: "Reemplazado", color: "bg-[#FF9500]/15 text-[#FF9500]" },
    descartado: { label: "Descartado", color: "bg-[#FF3B30]/15 text-[#FF3B30]" },
  } as const;
  const { label, color } = cfg[estado];
  return (
    <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0", color)}>
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
        "flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold",
        colores[variante]
      )}
    >
      <Icono size={14} />
      {children}
    </button>
  );
}

// Reuse to avoid TS unused warnings
void CheckCircle2;
