import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Download, Trophy, Undo2 } from "lucide-react";
import { useEstadisticas } from "../api/estadisticas";
import { useTransacciones, useReembolsar } from "../api/transacciones";
import { useNinos } from "../api/ninos";
import { descargarCsv } from "../lib/csv";
import { eur, fechaCorta } from "../lib/format";
import { toast } from "../store/toastStore";
import { confirmar } from "../components/ui/ConfirmDialog";
import type { FiltrosTransacciones, TransaccionOut } from "../api/types";

export default function Estadisticas() {
  const { data: stats } = useEstadisticas();
  const { data: ninos = [] } = useNinos();

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [grupo, setGrupo] = useState<string>("");
  const [ninoId, setNinoId] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");

  const filtros: FiltrosTransacciones = useMemo(
    () => ({
      // Las fechas locales del input se mandan como ISO; el backend las interpreta como naive datetime.
      // Para fecha_fin, sumamos 1 dia para incluir el dia entero (la query usa "<").
      fecha_inicio: fechaInicio ? new Date(fechaInicio + "T00:00:00").toISOString() : undefined,
      fecha_fin: fechaFin
        ? new Date(new Date(fechaFin + "T00:00:00").getTime() + 24 * 3600 * 1000).toISOString()
        : undefined,
      grupo: grupo ? Number(grupo) : undefined,
      nino_id: ninoId ? Number(ninoId) : undefined,
      busqueda: busqueda.trim() || undefined,
    }),
    [fechaInicio, fechaFin, grupo, ninoId, busqueda]
  );

  const { data: transacciones = [], isLoading } = useTransacciones(filtros);
  const reembolsar = useReembolsar();

  const grupos = useMemo(
    () => [...new Set(ninos.map((n) => n.grupo))].sort((a, b) => a - b),
    [ninos]
  );

  function exportar() {
    if (transacciones.length === 0) {
      toast.warn("No hay transacciones para exportar.");
      return;
    }
    const filas = transacciones.map((tx) => ({
      id: tx.id,
      fecha_hora: tx.fecha_hora,
      nino: tx.nino_nombre,
      productos: tx.productos.map((p) => `${p.cantidad}x ${p.nombre}`).join(" | "),
      total: tx.total.toFixed(2),
      reembolsada: tx.reembolsada ? "sí" : "no",
    }));
    const hoy = new Date().toISOString().slice(0, 10);
    descargarCsv(filas, `transacciones_${hoy}.csv`);
    toast.ok("CSV descargado.");
  }

  return (
    <div className="p-4 pb-24 max-w-5xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-[#1c1c1e]">Estadísticas</h1>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 gap-3">
        <Card titulo="Total ventas" valor={stats ? eur(stats.total_ventas) : "—"} />
        <Card titulo="Ventas hoy" valor={stats ? eur(stats.ventas_hoy) : "—"} />
      </div>

      {/* Top 5 niños */}
      <section className="bg-white rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={18} className="text-[#FFCC00]" />
          <h2 className="font-semibold text-[#1c1c1e]">Top 5 niños</h2>
        </div>
        {stats?.top_ninos.length === 0 ? (
          <p className="text-sm text-[#8e8e93]">Sin datos todavía.</p>
        ) : (
          <ol className="flex flex-col">
            {stats?.top_ninos.map((t, i) => (
              <li
                key={t.nino_id ?? `borrado-${i}`}
                className="flex items-center justify-between py-2 border-b border-[#f2f2f7] last:border-0"
              >
                <span className="flex items-center gap-2">
                  <span className="w-6 text-center font-mono text-sm text-[#8e8e93]">
                    {i + 1}
                  </span>
                  <span className="text-[#1c1c1e]">{t.nino_nombre}</span>
                </span>
                <span className="font-medium text-[#1c1c1e]">{eur(t.total)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Chart por dia */}
      <section className="bg-white rounded-2xl p-4">
        <h2 className="font-semibold text-[#1c1c1e] mb-3">Últimos 10 días</h2>
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={stats?.ventas_por_dia ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f7" />
              <XAxis
                dataKey="fecha"
                tick={{ fontSize: 11, fill: "#8e8e93" }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis tick={{ fontSize: 11, fill: "#8e8e93" }} />
              <Tooltip
                formatter={(v: number) => eur(v)}
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e5ea" }}
              />
              <Bar dataKey="total" fill="#007AFF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tabla de transacciones */}
      <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-[#1c1c1e]">Transacciones</h2>
          <button
            onClick={exportar}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#34C759] text-white text-sm font-medium"
          >
            <Download size={16} /> Exportar CSV
          </button>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="filtro"
            placeholder="Desde"
          />
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="filtro"
            placeholder="Hasta"
          />
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className="filtro">
            <option value="">Todos los grupos</option>
            {grupos.map((g) => (
              <option key={g} value={g}>
                Grupo {g}
              </option>
            ))}
          </select>
          <select value={ninoId} onChange={(e) => setNinoId(e.target.value)} className="filtro">
            <option value="">Todos los niños</option>
            {ninos.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre} {n.apellidos}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="filtro"
          />
        </div>

        {isLoading && <p className="text-[#8e8e93]">Cargando...</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#8e8e93] text-xs uppercase tracking-wide">
                <th className="py-2 pr-2">Fecha</th>
                <th className="py-2 pr-2">Niño</th>
                <th className="py-2 pr-2">Productos</th>
                <th className="py-2 pr-2 text-right">Total</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {transacciones.map((tx) => (
                <FilaTx
                  key={tx.id}
                  tx={tx}
                  onReembolsar={async () => {
                    const ok = await confirmar({
                      titulo: "Reembolsar transacción",
                      mensaje: `Se devolverán ${eur(tx.total)} a ${tx.nino_nombre}.`,
                      textoConfirmar: "Reembolsar",
                      tono: "advertencia",
                    });
                    if (!ok) return;
                    reembolsar.mutate(tx.id, {
                      onSuccess: () => toast.ok("Transacción reembolsada."),
                      onError: (e) =>
                        toast.error(e instanceof Error ? e.message : "Error al reembolsar."),
                    });
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && transacciones.length === 0 && (
          <p className="text-center text-[#8e8e93] py-4">
            No hay transacciones que coincidan con los filtros.
          </p>
        )}
      </section>

      <style>{`
        .filtro {
          padding: 8px 10px;
          border: 1px solid #e5e5ea;
          border-radius: 10px;
          font-size: 14px;
          background: white;
          outline: none;
          min-width: 0;
        }
        .filtro:focus { border-color: #007AFF; }
      `}</style>
    </div>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-white rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-[#8e8e93]">{titulo}</p>
      <p className="text-2xl font-bold text-[#1c1c1e] mt-1">{valor}</p>
    </div>
  );
}

function FilaTx({ tx, onReembolsar }: { tx: TransaccionOut; onReembolsar: () => void }) {
  const productos = tx.productos.map((p) => `${p.cantidad}× ${p.nombre}`).join(", ");
  return (
    <tr className="border-t border-[#f2f2f7]">
      <td className="py-2 pr-2 whitespace-nowrap text-[#3c3c43]">{fechaCorta(tx.fecha_hora)}</td>
      <td className="py-2 pr-2">
        <span className="text-[#1c1c1e]">{tx.nino_nombre}</span>
        {tx.reembolsada && (
          <span className="ml-2 text-[10px] uppercase font-semibold text-[#8e8e93] bg-[#e9e9eb] px-1.5 py-0.5 rounded">
            reembolsada
          </span>
        )}
      </td>
      <td className="py-2 pr-2 text-[#3c3c43] max-w-xs truncate" title={productos}>
        {productos}
      </td>
      <td className="py-2 pr-2 text-right font-medium text-[#1c1c1e] whitespace-nowrap">
        {eur(tx.total)}
      </td>
      <td className="py-2 text-right">
        {!tx.reembolsada && (
          <button
            onClick={onReembolsar}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FF3B30]/10 text-[#FF3B30] text-xs font-semibold"
          >
            <Undo2 size={14} /> Reembolsar
          </button>
        )}
      </td>
    </tr>
  );
}
