import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import Modal from "./Modal";
import { useAuthStore } from "../../store/authStore";
import { configuracionApi } from "../../api/configuracion";
import { ApiError } from "../../api/client";

interface PinDialogProps {
  open: boolean;
  /** Se llama cuando el PIN se ha validado correctamente y guardado en el store. */
  onValidado: () => void;
  /** Se llama si el usuario cancela (solo si cancelable=true). */
  onCancelar?: () => void;
  cancelable?: boolean;
  titulo?: string;
}

/**
 * Pide un PIN admin y lo valida llamando POST /api/configuracion con cuerpo vacio.
 * Si el backend responde 200, el PIN queda guardado en authStore.
 * Si responde 401, mostramos error.
 */
export default function PinDialog({
  open,
  onValidado,
  onCancelar,
  cancelable = false,
  titulo = "Introduce el PIN admin",
}: PinDialogProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      // Foco con un tick de retraso para evitar peleas con la animacion del modal.
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function validar() {
    if (pin.length < 4) {
      setError("El PIN tiene al menos 4 dígitos.");
      return;
    }
    setValidando(true);
    setError(null);
    // Guardamos primero, asi apiFetch lo lee del store.
    useAuthStore.getState().setPin(pin);
    try {
      // Cuerpo vacio: no cambia nada, solo valida que el PIN es correcto.
      await configuracionApi.actualizar({});
      onValidado();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("PIN incorrecto.");
      } else {
        setError(e instanceof Error ? e.message : "Error de red.");
        useAuthStore.getState().clearPin();
      }
    } finally {
      setValidando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onCancelar?.()}
      obligatorio={!cancelable}
      titulo={titulo}
      size="sm"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#f2f2f7] flex items-center justify-center">
          <Lock size={26} className="text-[#8e8e93]" />
        </div>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void validar();
          }}
          className="w-full text-center text-3xl tracking-[0.5em] py-3 border-2 border-[#e5e5ea] rounded-xl focus:outline-none focus:border-[#007AFF]"
          placeholder="••••"
        />
        {error && <p className="text-sm text-[#FF3B30]">{error}</p>}
        <div className="flex gap-2 w-full">
          {cancelable && (
            <button
              onClick={() => onCancelar?.()}
              className="flex-1 py-3 rounded-xl bg-[#e9e9eb] text-[#1c1c1e] font-medium"
              disabled={validando}
            >
              Cancelar
            </button>
          )}
          <button
            onClick={() => void validar()}
            disabled={validando || pin.length < 4}
            className="flex-1 py-3 rounded-xl bg-[#007AFF] text-white font-semibold disabled:opacity-50"
          >
            {validando ? "Validando..." : "Entrar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
