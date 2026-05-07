import { useState } from "react";
import Input, { Field } from "../ui/Input";
import type { NinoCreate, NinoOut, NinoUpdate } from "../../api/types";

interface NinoFormProps {
  inicial?: NinoOut;
  onCancelar: () => void;
  onGuardar: (data: NinoCreate | NinoUpdate, id?: number) => Promise<void>;
}

export default function NinoForm({ inicial, onCancelar, onGuardar }: NinoFormProps) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [apellidos, setApellidos] = useState(inicial?.apellidos ?? "");
  const [grupo, setGrupo] = useState<string>(inicial ? String(inicial.grupo) : "1");
  const [dinero, setDinero] = useState<string>(
    inicial ? inicial.dinero.toFixed(2) : "0.00"
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const grupoN = Number.parseInt(grupo, 10);
    const dineroN = Number.parseFloat(dinero);

    if (!nombre.trim() || !apellidos.trim()) {
      setError("Nombre y apellidos son obligatorios.");
      return;
    }
    if (!Number.isFinite(grupoN) || grupoN <= 0) {
      setError("El grupo debe ser un entero mayor que 0.");
      return;
    }
    if (!Number.isFinite(dineroN) || dineroN < 0) {
      setError("El dinero no puede ser negativo.");
      return;
    }

    setGuardando(true);
    try {
      await onGuardar(
        {
          nombre: nombre.trim(),
          apellidos: apellidos.trim(),
          grupo: grupoN,
          dinero: dineroN,
        },
        inicial?.id
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
      <Field label="Apellidos">
        <Input
          value={apellidos}
          onChange={(e) => setApellidos(e.target.value)}
          maxLength={120}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Grupo">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
          />
        </Field>
        <Field label="Saldo (€)">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={dinero}
            onChange={(e) => setDinero(e.target.value)}
          />
        </Field>
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
