import { useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Upload, AlertTriangle } from "lucide-react";
import Modal from "./ui/Modal";
import { useImportarNinos } from "../api/ninos";
import { descargarCsv } from "../lib/csv";
import { toast } from "../store/toastStore";
import { ApiError } from "../api/client";
import type { ImportResultado } from "../api/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ImportarNinosModal({ open, onClose }: Props) {
  const importar = useImportarNinos();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ImportResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setArchivo(null);
    setResultado(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function cerrar() {
    reset();
    onClose();
  }

  async function enviar() {
    if (!archivo) return;
    setError(null);
    setResultado(null);
    try {
      const r = await importar.mutateAsync(archivo);
      setResultado(r);
      if (r.creados > 0) {
        toast.ok(`${r.creados} niños importados.`);
      } else if (r.total_filas === 0) {
        toast.warn("El archivo no tenía filas.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Error.");
    }
  }

  function descargarPlantilla() {
    descargarCsv(
      [
        { nombre: "Pepe", apellidos: "García López", grupo: 1, dinero: 5.0 },
        { nombre: "María", apellidos: "Sánchez Ruiz", grupo: 2, dinero: 0 },
      ],
      "plantilla-ninos.csv",
      ["nombre", "apellidos", "grupo", "dinero"]
    );
  }

  return (
    <Modal open={open} onClose={cerrar} titulo="Importar niños desde CSV" size="lg">
      <div className="flex flex-col gap-4">
        {!resultado && (
          <>
            <div className="bg-[#f2f2f7] rounded-xl p-3 text-sm text-[#3c3c43]">
              <p className="font-semibold text-[#1c1c1e] mb-1">Formato esperado</p>
              <ul className="list-disc pl-5 space-y-0.5 text-[13px]">
                <li>
                  Columnas: <code className="font-mono">nombre</code>,{" "}
                  <code className="font-mono">apellidos</code>,{" "}
                  <code className="font-mono">grupo</code>,{" "}
                  <code className="font-mono">dinero</code> (opcional).
                </li>
                <li>UTF-8. Separador <code className="font-mono">,</code> o <code className="font-mono">;</code> (auto).</li>
                <li>Las filas con datos inválidos se saltan; el resto se importa.</li>
              </ul>
              <button
                onClick={descargarPlantilla}
                className="mt-3 inline-flex items-center gap-1.5 text-[#007AFF] text-sm font-medium"
              >
                <Download size={14} /> Descargar plantilla
              </button>
            </div>

            <label
              htmlFor="csv-input"
              className="flex flex-col items-center justify-center gap-2 py-8 px-4 border-2 border-dashed border-[#c6c6c8] rounded-2xl cursor-pointer hover:border-[#007AFF] hover:bg-[#007AFF]/5 transition-colors"
            >
              <FileSpreadsheet size={32} className="text-[#8e8e93]" />
              {archivo ? (
                <>
                  <p className="text-[#1c1c1e] font-medium">{archivo.name}</p>
                  <p className="text-xs text-[#8e8e93]">
                    {(archivo.size / 1024).toFixed(1)} KB · pulsa para cambiar
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[#1c1c1e] font-medium">Selecciona un archivo CSV</p>
                  <p className="text-xs text-[#8e8e93]">o pulsa aquí para abrir el explorador</p>
                </>
              )}
              <input
                ref={inputRef}
                id="csv-input"
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>

            {error && <p className="text-sm text-[#FF3B30]">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={cerrar}
                disabled={importar.isPending}
                className="flex-1 py-3 rounded-xl bg-[#e9e9eb] text-[#1c1c1e] font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={enviar}
                disabled={!archivo || importar.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#007AFF] text-white font-semibold disabled:opacity-50"
              >
                <Upload size={16} />
                {importar.isPending ? "Importando..." : "Importar"}
              </button>
            </div>
          </>
        )}

        {resultado && <ResumenImport resultado={resultado} onCerrar={cerrar} onOtro={reset} />}
      </div>
    </Modal>
  );
}

function ResumenImport({
  resultado,
  onCerrar,
  onOtro,
}: {
  resultado: ImportResultado;
  onCerrar: () => void;
  onOtro: () => void;
}) {
  const ok = resultado.creados;
  const fallos = resultado.omitidos.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="w-14 h-14 rounded-full bg-[#34C759]/15 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-[#34C759]" />
        </div>
        <p className="text-lg font-semibold text-[#1c1c1e]">Importación terminada</p>
        <p className="text-sm text-[#8e8e93]">
          {ok} creados · {fallos} omitidos · {resultado.total_filas} filas leídas
        </p>
      </div>

      {fallos > 0 && (
        <div className="bg-[#FF9500]/10 rounded-xl p-3">
          <header className="flex items-center gap-2 mb-2 text-[#FF9500]">
            <AlertTriangle size={16} />
            <h3 className="text-sm font-semibold">Filas omitidas</h3>
          </header>
          <ul className="text-sm text-[#3c3c43] space-y-1 max-h-48 overflow-y-auto">
            {resultado.omitidos.map((o) => (
              <li key={o.fila} className="flex gap-2">
                <span className="font-mono text-[#8e8e93] shrink-0">fila {o.fila}:</span>
                <span>{o.razon}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onOtro}
          className="flex-1 py-3 rounded-xl bg-[#e9e9eb] text-[#1c1c1e] font-medium"
        >
          Importar otro
        </button>
        <button
          onClick={onCerrar}
          className="flex-1 py-3 rounded-xl bg-[#007AFF] text-white font-semibold"
        >
          Hecho
        </button>
      </div>
    </div>
  );
}
