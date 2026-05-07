import {
  Apple,
  Candy,
  Cookie,
  GlassWater,
  IceCream,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { CategoriaProducto } from "../api/types";

interface PresetCategoria {
  valor: CategoriaProducto;
  label: string;
  icono: LucideIcon;
  /** Color base de la categoria (iOS palette). Se usa para fondo del badge. */
  color: string;
}

export const CATEGORIAS: PresetCategoria[] = [
  { valor: "bebida", label: "Bebida", icono: GlassWater, color: "#007AFF" },
  { valor: "snack", label: "Snack", icono: Cookie, color: "#FF9500" },
  { valor: "helado", label: "Helado", icono: IceCream, color: "#FF2D92" },
  { valor: "fruta", label: "Fruta", icono: Apple, color: "#34C759" },
  { valor: "chuche", label: "Chuche", icono: Candy, color: "#AF52DE" },
  { valor: "otro", label: "Otro", icono: Package, color: "#8E8E93" },
];

const POR_VALOR: Record<CategoriaProducto, PresetCategoria> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.valor, c])
) as Record<CategoriaProducto, PresetCategoria>;

const FALLBACK: PresetCategoria = POR_VALOR.otro;

/** Devuelve el preset de una categoria. Si la cadena no coincide, devuelve `otro`. */
export function preset(categoria: CategoriaProducto | string | null | undefined): PresetCategoria {
  if (!categoria) return FALLBACK;
  return POR_VALOR[categoria as CategoriaProducto] ?? FALLBACK;
}
