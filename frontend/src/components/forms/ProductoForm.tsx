import { useState } from "react";
import Input, { Field } from "../ui/Input";
import Switch from "../ui/Switch";
import { CATEGORIAS } from "../../lib/categorias";
import { cn } from "../../lib/cn";
import type {
  CategoriaProducto,
  ProductoCreate,
  ProductoOut,
  ProductoUpdate,
} from "../../api/types";

interface ProductoFormProps {
  inicial?: ProductoOut;
  onCancelar: () => void;
  onGuardar: (data: ProductoCreate | ProductoUpdate, id?: number, file?: File) => Promise<void>;
}

export default function ProductoForm({ inicial, onCancelar, onGuardar }: ProductoFormProps) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [precio, setPrecio] = useState<string>(
    inicial ? inicial.precio.toFixed(2) : "0.50"
  );
  const [activo, setActivo] = useState<boolean>(inicial?.activo ?? true);
  const [categoria, setCategoria] = useState<CategoriaProducto>(
    (inicial?.categoria as CategoriaProducto) ?? "otro"
  );
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(inicial?.imagen ?? null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImagen(file);
      setPreview(URL.createObjectURL(file));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const precioN = Number.parseFloat(precio);
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!Number.isFinite(precioN) || precioN <= 0) {
      setError("El precio debe ser mayor que 0.");
      return;
    }

    setGuardando(true);
    try {
      await onGuardar(
        { nombre: nombre.trim(), precio: precioN, activo, categoria },
        inicial?.id,
        imagen ?? undefined
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nombre">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={80}
          autoFocus
        />
      </Field>
      <Field label="Precio (€)">
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0.01}
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
        />
      </Field>
      <Field label="Categoría" hint="Cambia el icono y color en el catálogo de Kiosko.">
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIAS.map((c) => {
            const seleccionada = categoria === c.valor;
            const Icono = c.icono;
            return (
              <button
                key={c.valor}
                type="button"
                onClick={() => setCategoria(c.valor)}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all",
                  seleccionada
                    ? "border-[#1c1c1e] bg-white"
                    : "border-transparent bg-[#f2f2f7] active:bg-[#e9e9eb]"
                )}
                style={
                  seleccionada
                    ? { borderColor: c.color }
                    : undefined
                }
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: c.color }}
                >
                  <Icono size={20} strokeWidth={1.7} />
                </span>
                <span className="text-xs font-medium text-[#1c1c1e]">{c.label}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Imagen">
        <div className="flex items-center gap-4">
          {preview && (
            <img
              src={preview.startsWith('blob:') ? preview : `http://localhost:8000${preview}`}
              alt="Preview"
              className="w-16 h-16 object-cover rounded-xl border border-[#e5e5ea]"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="flex-1 text-sm text-[#8e8e93] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#e9e9eb] file:text-[#1c1c1e] hover:file:bg-[#d1d1d6]"
          />
        </div>
      </Field>
      <div className="flex items-center justify-between bg-[#f2f2f7] rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[#1c1c1e]">Visible en kiosko</p>
          <p className="text-xs text-[#8e8e93]">Si lo desactivas, ya no aparece para comprar.</p>
        </div>
        <Switch checked={activo} onChange={setActivo} ariaLabel="Activo" />
      </div>
      {error && <p className="text-sm text-[#FF3B30]">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          className="flex-1 py-3 rounded-xl bg-[#e9e9eb] text-[#1c1c1e] font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="flex-1 py-3 rounded-xl bg-[#007AFF] text-white font-semibold disabled:opacity-50"
        >
          {guardando ? "Guardando..." : inicial ? "Guardar" : "Crear"}
        </button>
      </div>
    </form>
  );
}
