import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Package,
  type LucideIcon,
} from "lucide-react";
import Tabs from "../components/ui/Tabs";
import Modal from "../components/ui/Modal";
import PinDialog from "../components/ui/PinDialog";
import Input from "../components/ui/Input";
import Switch from "../components/ui/Switch";
import { confirmar } from "../components/ui/ConfirmDialog";
import NinoForm from "../components/forms/NinoForm";
import ProductoForm from "../components/forms/ProductoForm";
import {
  useNinos,
  useCrearNino,
  useActualizarNino,
  useBorrarNino,
  useLimpiarNinos,
} from "../api/ninos";
import {
  useProductos,
  useCrearProducto,
  useActualizarProducto,
  useBorrarProducto,
  useSubirImagenProducto,
} from "../api/productos";
import {
  useConfiguracion,
  useActualizarConfiguracion,
} from "../api/configuracion";
import { descargarBackup } from "../api/backup";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import { eur } from "../lib/format";
import CategoriaIcon from "../components/CategoriaIcon";
import type { NinoOut, ProductoOut } from "../api/types";

type TabKey = "ninos" | "productos" | "config";

export default function Ajustes() {
  const pin = useAuthStore((s) => s.pin);
  const clearPin = useAuthStore((s) => s.clearPin);
  const [tab, setTab] = useState<TabKey>("ninos");

  if (!pin) {
    return <PinDialog open onValidado={() => undefined} />;
  }

  return (
    <div className="p-4 pb-24 max-w-3xl mx-auto flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1c1c1e]">Ajustes</h1>
        <button
          onClick={async () => {
            const ok = await confirmar({
              titulo: "Cerrar sesión admin",
              mensaje: "Tendrás que volver a introducir el PIN para gestionar.",
              textoConfirmar: "Cerrar sesión",
              tono: "advertencia",
            });
            if (ok) {
              clearPin();
              toast.info("Sesión admin cerrada.");
            }
          }}
          className="flex items-center gap-1.5 text-sm text-[#007AFF] font-medium"
        >
          <LogOut size={16} /> Cerrar sesión
        </button>
      </header>

      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        options={[
          { label: "Niños", value: "ninos" },
          { label: "Productos", value: "productos" },
          { label: "Configuración", value: "config" },
        ]}
      />

      {tab === "ninos" && <NinosTab />}
      {tab === "productos" && <ProductosTab />}
      {tab === "config" && <ConfigTab />}
    </div>
  );
}

// ───────────────────────────────────────────────── Niños tab ─────────────

function NinosTab() {
  const { data: ninos = [], isLoading } = useNinos();
  const crear = useCrearNino();
  const actualizar = useActualizarNino();
  const borrar = useBorrarNino();
  const limpiar = useLimpiarNinos();

  const [editando, setEditando] = useState<NinoOut | null>(null);
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ninos
      .filter(
        (n) =>
          q === "" ||
          `${n.nombre} ${n.apellidos}`.toLowerCase().includes(q) ||
          String(n.grupo).includes(q)
      )
      .sort((a, b) => a.grupo - b.grupo || a.nombre.localeCompare(b.nombre));
  }, [ninos, busqueda]);

  const grupos = useMemo(() => {
    const mapa = new Map<number, NinoOut[]>();
    for (const n of filtrados) {
      if (!mapa.has(n.grupo)) mapa.set(n.grupo, []);
      mapa.get(n.grupo)!.push(n);
    }
    return [...mapa.entries()].sort(([a], [b]) => a - b);
  }, [filtrados]);

  async function pedirBorrar(n: NinoOut) {
    const ok = await confirmar({
      titulo: "Borrar niño",
      mensaje: `Se borrará a ${n.nombre} ${n.apellidos}. Las transacciones quedarán archivadas en estadísticas.`,
      textoConfirmar: "Borrar",
      tono: "peligro",
    });
    if (!ok) return;
    borrar.mutate(n.id, {
      onSuccess: () => toast.ok("Niño borrado."),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Error."),
    });
  }

  async function pedirLimpiar() {
    const ok = await confirmar({
      titulo: "Borrar TODOS los niños",
      mensaje:
        "Esta acción se usa al cerrar el campamento. Borra todos los niños permanentemente. No se puede deshacer.",
      textoConfirmar: "Sí, borrar todos",
      tono: "peligro",
    });
    if (!ok) return;
    limpiar.mutate(undefined, {
      onSuccess: () => toast.ok("Todos los niños borrados."),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Error."),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <BarraGestion
        total={ninos.length}
        unidad="niños"
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        onCrear={() => setCreando(true)}
        textoCrear="Añadir niño"
      />

      {isLoading && <p className="text-[#8e8e93] text-center py-4">Cargando...</p>}

      {!isLoading && ninos.length === 0 && (
        <EmptyState
          icono={Users}
          titulo="Aún no hay niños"
          mensaje="Añade el primero para empezar a registrar compras."
          textoCta="Añadir niño"
          onCta={() => setCreando(true)}
        />
      )}

      {grupos.length === 0 && ninos.length > 0 && !isLoading && (
        <p className="text-center text-[#8e8e93] py-6 text-sm">
          Ningún niño coincide con "{busqueda}".
        </p>
      )}

      {grupos.map(([grupo, lista]) => (
        <section key={grupo} className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8e8e93] px-1">
            Grupo {grupo} · {lista.length}
          </h3>
          <ul className="bg-white rounded-2xl divide-y divide-[#e5e5ea] overflow-hidden">
            {lista.map((n) => (
              <li key={n.id} className="flex items-center px-4 py-3 gap-3">
                <span className="w-9 h-9 rounded-full bg-[#f2f2f7] flex items-center justify-center text-sm font-semibold text-[#3c3c43]">
                  {n.nombre.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1c1c1e] truncate">
                    {n.nombre} {n.apellidos}
                  </p>
                  <p
                    className={
                      "text-sm " + (n.dinero <= 0 ? "text-[#FF3B30]" : "text-[#8e8e93]")
                    }
                  >
                    {eur(n.dinero)}
                  </p>
                </div>
                <button
                  onClick={() => setEditando(n)}
                  className="p-2 text-[#007AFF] active:opacity-60"
                  aria-label="Editar"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={() => pedirBorrar(n)}
                  className="p-2 text-[#FF3B30] active:opacity-60"
                  aria-label="Borrar"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {ninos.length > 0 && (
        <ZonaPeligrosa>
          <p className="text-sm text-[#1c1c1e]">
            <strong>Limpiar todos los niños.</strong> Borra los {ninos.length} niños
            registrados. Útil al cerrar el campamento.
          </p>
          <button
            onClick={pedirLimpiar}
            disabled={limpiar.isPending}
            className="self-start px-4 py-2 rounded-xl bg-[#FF3B30] text-white text-sm font-semibold disabled:opacity-50"
          >
            {limpiar.isPending ? "Borrando..." : "Limpiar todos"}
          </button>
        </ZonaPeligrosa>
      )}

      <Modal
        open={creando || editando !== null}
        onClose={() => {
          setCreando(false);
          setEditando(null);
        }}
        titulo={editando ? "Editar niño" : "Nuevo niño"}
      >
        <NinoForm
          inicial={editando ?? undefined}
          onCancelar={() => {
            setCreando(false);
            setEditando(null);
          }}
          onGuardar={async (data, id) => {
            if (id !== undefined) {
              await actualizar.mutateAsync({ id, data });
              toast.ok("Niño actualizado.");
            } else {
              await crear.mutateAsync(
                data as Parameters<typeof crear.mutateAsync>[0]
              );
              toast.ok("Niño creado.");
            }
            setCreando(false);
            setEditando(null);
          }}
        />
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────── Productos tab ───────────────

function ProductosTab() {
  const { data: productos = [], isLoading } = useProductos();
  const crear = useCrearProducto();
  const actualizar = useActualizarProducto();
  const borrar = useBorrarProducto();
  const subirImagen = useSubirImagenProducto();

  const [editando, setEditando] = useState<ProductoOut | null>(null);
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos
      .filter((p) => q === "" || p.nombre.toLowerCase().includes(q))
      .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre));
  }, [productos, busqueda]);

  async function pedirBorrar(p: ProductoOut) {
    const ok = await confirmar({
      titulo: "Borrar producto",
      mensaje: `Se borrará "${p.nombre}". Si quieres conservar el histórico, mejor desactívalo.`,
      textoConfirmar: "Borrar",
      tono: "peligro",
    });
    if (!ok) return;
    borrar.mutate(p.id, {
      onSuccess: () => toast.ok("Producto borrado."),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Error."),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <BarraGestion
        total={productos.length}
        unidad="productos"
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        onCrear={() => setCreando(true)}
        textoCrear="Añadir producto"
      />

      {isLoading && <p className="text-[#8e8e93] text-center py-4">Cargando...</p>}

      {!isLoading && productos.length === 0 && (
        <EmptyState
          icono={Package}
          titulo="Aún no hay productos"
          mensaje="Añade los productos del kiosko para que aparezcan en la pantalla de compra."
          textoCta="Añadir producto"
          onCta={() => setCreando(true)}
        />
      )}

      {filtrados.length === 0 && productos.length > 0 && !isLoading && (
        <p className="text-center text-[#8e8e93] py-6 text-sm">
          Ningún producto coincide con "{busqueda}".
        </p>
      )}

      {filtrados.length > 0 && (
        <ul className="bg-white rounded-2xl divide-y divide-[#e5e5ea] overflow-hidden">
          {filtrados.map((p) => (
            <li key={p.id} className="flex items-center px-4 py-3 gap-3">
              {p.imagen ? (
                <img 
                  src={p.imagen.startsWith('http') ? p.imagen : `http://localhost:8000${p.imagen}`} 
                  alt="" 
                  className="w-[36px] h-[36px] object-cover rounded-full border border-[#e5e5ea]" 
                />
              ) : (
                <CategoriaIcon categoria={p.categoria} size={36} fondoSolido={false} />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={
                    "font-medium truncate " +
                    (p.activo ? "text-[#1c1c1e]" : "text-[#8e8e93] line-through")
                  }
                >
                  {p.nombre}
                </p>
                <p className="text-sm text-[#8e8e93]">{eur(p.precio)}</p>
              </div>
              <Switch
                checked={p.activo}
                onChange={(v) =>
                  actualizar.mutate(
                    { id: p.id, data: { activo: v } },
                    {
                      onSuccess: () =>
                        toast.ok(v ? "Producto activado." : "Producto retirado."),
                      onError: (e) =>
                        toast.error(e instanceof Error ? e.message : "Error."),
                    }
                  )
                }
                ariaLabel={p.activo ? "Desactivar" : "Activar"}
              />
              <button
                onClick={() => setEditando(p)}
                className="p-2 text-[#007AFF] active:opacity-60"
                aria-label="Editar"
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={() => pedirBorrar(p)}
                className="p-2 text-[#FF3B30] active:opacity-60"
                aria-label="Borrar"
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={creando || editando !== null}
        onClose={() => {
          setCreando(false);
          setEditando(null);
        }}
        titulo={editando ? "Editar producto" : "Nuevo producto"}
      >
        <ProductoForm
          inicial={editando ?? undefined}
          onCancelar={() => {
            setCreando(false);
            setEditando(null);
          }}
          onGuardar={async (data, id, file) => {
            let pId = id;
            if (pId !== undefined) {
              await actualizar.mutateAsync({ id: pId, data });
              toast.ok("Producto actualizado.");
            } else {
              const res = await crear.mutateAsync(
                data as Parameters<typeof crear.mutateAsync>[0]
              );
              pId = res.id;
              toast.ok("Producto creado.");
            }
            if (file && pId !== undefined) {
              await subirImagen.mutateAsync({ id: pId, file });
              toast.ok("Imagen subida correctamente.");
            }
            setCreando(false);
            setEditando(null);
          }}
        />
      </Modal>
    </div>
  );
}

// ───────────────────────────────────────── Configuración tab ─────────────

function ConfigTab() {
  const { data: cfg } = useConfiguracion();
  const actualizar = useActualizarConfiguracion();
  const setPin = useAuthStore((s) => s.setPin);

  const [cota, setCota] = useState<string>("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [errorCota, setErrorCota] = useState<string | null>(null);
  const [errorPin, setErrorPin] = useState<string | null>(null);

  useEffect(() => {
    if (cfg) setCota(cfg.cota_diaria.toFixed(2));
  }, [cfg]);

  async function guardarCota(e: React.FormEvent) {
    e.preventDefault();
    setErrorCota(null);
    const cotaN = Number.parseFloat(cota);
    if (!Number.isFinite(cotaN) || cotaN < 0) {
      setErrorCota("La cota debe ser un número ≥ 0.");
      return;
    }
    try {
      await actualizar.mutateAsync({ cota_diaria: cotaN });
      toast.ok("Cota actualizada.");
    } catch (e) {
      setErrorCota(e instanceof Error ? e.message : "Error.");
    }
  }

  async function cambiarPin(e: React.FormEvent) {
    e.preventDefault();
    setErrorPin(null);
    if (pinNuevo.length < 4) {
      setErrorPin("El PIN tiene al menos 4 dígitos.");
      return;
    }
    if (pinNuevo !== pinConfirm) {
      setErrorPin("Los PIN no coinciden.");
      return;
    }
    try {
      await actualizar.mutateAsync({ pin_admin: pinNuevo });
      setPin(pinNuevo);
      setPinNuevo("");
      setPinConfirm("");
      toast.ok("PIN actualizado.");
    } catch (e) {
      setErrorPin(e instanceof Error ? e.message : "Error.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={guardarCota} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-[#1c1c1e]">Cota diaria</h2>
          <p className="text-sm text-[#8e8e93] mt-0.5">
            Avisa (sin bloquear) si un niño supera este gasto en un día.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={cota}
            onChange={(e) => setCota(e.target.value)}
            className="flex-1"
          />
          <span className="text-[#8e8e93] text-lg">€</span>
          <button
            type="submit"
            disabled={actualizar.isPending}
            className="px-4 py-2.5 rounded-xl bg-[#007AFF] text-white text-sm font-semibold disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
        {errorCota && <p className="text-sm text-[#FF3B30]">{errorCota}</p>}
      </form>

      <form onSubmit={cambiarPin} className="bg-white rounded-2xl p-4 flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-[#1c1c1e]">Cambiar PIN admin</h2>
          <p className="text-sm text-[#8e8e93] mt-0.5">
            Mínimo 4 dígitos. Se pedirá la próxima vez que entres en Ajustes.
          </p>
        </div>
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={pinNuevo}
          onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g, ""))}
          placeholder="PIN nuevo"
          maxLength={12}
          className="tracking-[0.4em] text-center"
        />
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={pinConfirm}
          onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
          placeholder="Repetir PIN"
          maxLength={12}
          className="tracking-[0.4em] text-center"
        />
        {errorPin && <p className="text-sm text-[#FF3B30]">{errorPin}</p>}
        <button
          type="submit"
          disabled={actualizar.isPending || !pinNuevo}
          className="self-start px-4 py-2.5 rounded-xl bg-[#007AFF] text-white text-sm font-semibold disabled:opacity-50"
        >
          Cambiar PIN
        </button>
      </form>

      <BackupBlock />
    </div>
  );
}

function BackupBlock() {
  const [descargando, setDescargando] = useState(false);

  async function descargar() {
    setDescargando(true);
    try {
      await descargarBackup();
      toast.ok("Backup descargado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al descargar backup.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-[#1c1c1e]">Backup de la base de datos</h2>
        <p className="text-sm text-[#8e8e93] mt-0.5">
          Descarga una copia consistente de la base (SQLite). Hazlo periódicamente,
          sobre todo antes del cierre del campamento.
        </p>
      </div>
      <button
        onClick={descargar}
        disabled={descargando}
        className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#34C759] text-white text-sm font-semibold disabled:opacity-50"
      >
        <Download size={16} />
        {descargando ? "Descargando..." : "Descargar backup"}
      </button>
    </section>
  );
}

// ─────────────────────────────────────────── Auxiliares ──────────────────

function BarraGestion({
  total,
  unidad,
  busqueda,
  setBusqueda,
  onCrear,
  textoCrear,
}: {
  total: number;
  unidad: string;
  busqueda: string;
  setBusqueda: (s: string) => void;
  onCrear: () => void;
  textoCrear: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[#8e8e93]">
          {total} {unidad}
        </p>
        <button
          onClick={onCrear}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#007AFF] text-white text-sm font-medium active:opacity-80"
        >
          <Plus size={16} /> {textoCrear}
        </button>
      </div>
      {total > 0 && (
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93] pointer-events-none"
          />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icono: Icono,
  titulo,
  mensaje,
  textoCta,
  onCta,
}: {
  icono: LucideIcon;
  titulo: string;
  mensaje: string;
  textoCta: string;
  onCta: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-8 flex flex-col items-center text-center gap-3">
      <div className="w-14 h-14 rounded-full bg-[#f2f2f7] flex items-center justify-center">
        <Icono size={26} className="text-[#8e8e93]" />
      </div>
      <h3 className="text-lg font-semibold text-[#1c1c1e]">{titulo}</h3>
      <p className="text-sm text-[#8e8e93] max-w-xs">{mensaje}</p>
      <button
        onClick={onCta}
        className="mt-2 px-4 py-2.5 rounded-xl bg-[#007AFF] text-white text-sm font-semibold"
      >
        {textoCta}
      </button>
    </div>
  );
}

function ZonaPeligrosa({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-2 border border-[#FF3B30]/30 rounded-2xl p-4 bg-[#FF3B30]/[0.03] flex flex-col gap-3">
      <header className="flex items-center gap-2 text-[#FF3B30]">
        <AlertTriangle size={16} />
        <h3 className="text-sm font-semibold uppercase tracking-wide">Zona peligrosa</h3>
      </header>
      {children}
    </section>
  );
}
