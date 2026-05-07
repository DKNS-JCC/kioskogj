import { preset } from "../lib/categorias";
import { cn } from "../lib/cn";
import type { CategoriaProducto } from "../api/types";

interface Props {
  categoria: CategoriaProducto | string | null | undefined;
  /** Tamaño del cuadrado contenedor en px. */
  size?: number;
  /** Si true, el icono se ve sobre el color base como fondo solido (Kiosko grande).
   *  Si false, fondo tintado claro y icono al color (lista compacta). */
  fondoSolido?: boolean;
  className?: string;
}

export default function CategoriaIcon({
  categoria,
  size = 52,
  fondoSolido = true,
  className,
}: Props) {
  const { icono: Icono, color } = preset(categoria);
  const iconSize = Math.round(size * 0.5);

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shrink-0",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: fondoSolido ? color : `${color}1F`, // ~12% alpha en hex
        color: fondoSolido ? "#fff" : color,
      }}
      aria-hidden
    >
      <Icono size={iconSize} strokeWidth={1.7} />
    </div>
  );
}
