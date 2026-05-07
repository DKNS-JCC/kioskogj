import { useMemo } from "react";
import { Lock, Undo2 } from "lucide-react";
import {
  useCastigosActivos,
  useCastigosHistorico,
  useCastigar,
  useRevocar,
} from "../api/castigos";
import { useNinos } from "../api/ninos";
import CountdownBadge from "../components/CountdownBadge";
import { toast } from "../store/toastStore";
import type { NinoOut } from "../api/types";

export default function Castigos() {
  const { data: ninos = [], isLoading: cargandoNinos } = useNinos();
  const { data: activos = {} } = useCastigosActivos();
  const { data: historico = {} } = useCastigosHistorico();

  const castigar = useCastigar();
  const revocar = useRevocar();

  const grupos = useMemo(() => {
    const mapa = new Map<number, NinoOut[]>();
    for (const n of ninos) {
      if (!mapa.has(n.grupo)) mapa.set(n.grupo, []);
      mapa.get(n.grupo)!.push(n);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    return [...mapa.entries()].sort(([a], [b]) => a - b);
  }, [ninos]);

  return (
    <div className="p-4 pb-24 max-w-3xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1c1c1e]">Castigos</h1>
        <p className="text-sm text-[#8e8e93] mt-1">
          Un castigo dura 12 horas. El niño no podrá comprar mientras esté activo.
        </p>
      </div>

      {cargandoNinos && <p className="text-[#8e8e93]">Cargando...</p>}

      {grupos.map(([grupo, lista]) => (
        <section key={grupo} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8e8e93] px-1">
            Grupo {grupo}
          </h2>
          <div className="bg-white rounded-2xl divide-y divide-[#e5e5ea] overflow-hidden">
            {lista.map((n) => {
              const hasta = activos[String(n.id)];
              const estaActivo = hasta != null && hasta > Date.now();
              const veces = historico[String(n.id)] ?? 0;

              return (
                <div key={n.id} className="flex items-center px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1c1c1e] truncate">
                      {n.nombre} {n.apellidos}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#8e8e93]">
                        {veces === 0 ? "Sin castigos" : `${veces} ${veces === 1 ? "vez" : "veces"} castigado`}
                      </span>
                      {estaActivo && <CountdownBadge hasta={hasta} />}
                    </div>
                  </div>
                  {estaActivo ? (
                    <button
                      onClick={() =>
                        revocar.mutate(n.id, {
                          onSuccess: () => toast.ok("Castigo revocado."),
                          onError: (e) =>
                            toast.error(e instanceof Error ? e.message : "Error."),
                        })
                      }
                      disabled={revocar.isPending}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-sm font-semibold disabled:opacity-50"
                    >
                      <Undo2 size={16} /> Revocar
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        castigar.mutate(n.id, {
                          onSuccess: () => toast.warn(`${n.nombre} castigado 12 h.`),
                          onError: (e) =>
                            toast.error(e instanceof Error ? e.message : "Error."),
                        })
                      }
                      disabled={castigar.isPending}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#FF3B30] text-white text-sm font-semibold disabled:opacity-50"
                    >
                      <Lock size={16} /> Castigar 12h
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {!cargandoNinos && grupos.length === 0 && (
        <p className="text-center text-[#8e8e93] py-8">
          No hay niños. Añádelos desde Ajustes.
        </p>
      )}
    </div>
  );
}
