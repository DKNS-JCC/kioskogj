// Tipos compartidos con el backend (espejo de app/schemas/*).
// Si los Pydantic models cambian, hay que reflejar el cambio aqui.

export interface NinoOut {
  id: number;
  nombre: string;
  apellidos: string;
  grupo: number;
  dinero: number;
  creado_en: string; // ISO datetime
}

export interface NinoCreate {
  nombre: string;
  apellidos: string;
  grupo: number;
  dinero?: number;
}

export type NinoUpdate = Partial<NinoCreate>;

export interface NinoInfo {
  saldo: number;
  comprado_hoy: boolean;
  gastado_hoy: number;
}

export interface FilaImportError {
  fila: number;
  razon: string;
}

export interface ImportResultado {
  creados: number;
  total_filas: number;
  omitidos: FilaImportError[];
}

// Pedidos: flujo en tres fases. Monitor crea (pendiente) → kiosko prepara
// (preparado) → monitor reparte y se cobra (completado).
export type EstadoPedido = "pendiente" | "preparado" | "completado";
export type EstadoLineaPedido =
  | "pendiente"
  | "listo"
  | "entregado"
  | "reemplazado"
  | "descartado";

export interface PedidoLineaCreate {
  producto_id: number;
  cantidad: number;
}

export interface PedidoNinoCreate {
  nino_id: number;
  lineas: PedidoLineaCreate[];
}

export interface PedidoCreate {
  grupo: number;
  ninos: PedidoNinoCreate[];
  nota?: string | null;
}

export interface PedidoLineaOut {
  id: number;
  producto_id: number | null;
  producto_nombre: string;
  producto_precio: number;
  cantidad: number;
  estado: EstadoLineaPedido;
  reemplazo_texto: string | null;
}

export interface PedidoNinoOut {
  id: number;
  nino_id: number | null;
  nino_nombre: string;
  transaccion_id: number | null;
  lineas: PedidoLineaOut[];
}

export interface PedidoOut {
  id: number;
  grupo: number;
  estado: EstadoPedido;
  nota: string | null;
  creado_en: string;
  preparado_en: string | null;
  completado_en: string | null;
  ninos: PedidoNinoOut[];
}

export interface PedidoDuplicadoDetail {
  duplicado: true;
  pedidos_existentes: number[];
}

export interface PedidoLineaUpdate {
  estado: EstadoLineaPedido;
  reemplazo_texto?: string | null;
}

export type CategoriaProducto =
  | "bebida"
  | "snack"
  | "helado"
  | "fruta"
  | "chuche"
  | "otro";

export interface ProductoOut {
  id: number;
  nombre: string;
  precio: number;
  activo: boolean;
  categoria: CategoriaProducto | null;
  imagen?: string | null;
  creado_en: string;
}

export interface ProductoCreate {
  nombre: string;
  precio: number;
  activo?: boolean;
  categoria?: CategoriaProducto | null;
}

export type ProductoUpdate = Partial<ProductoCreate>;

export interface LineaCompra {
  id: number; // producto_id
  cantidad: number;
}

export interface TransaccionCreate {
  nino_id: number;
  productos: LineaCompra[];
}

export interface TransaccionCreada {
  id: number;
  total: number;
  saldo_restante: number;
  aviso_cota: boolean;
}

export interface ProductoEnTx {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
}

export interface TransaccionOut {
  id: number;
  nino_id: number | null;
  nino_nombre: string;
  productos: ProductoEnTx[];
  total: number;
  fecha_hora: string;
  reembolsada: boolean;
}

export interface HistorialLinea {
  transaccion_id: number;
  fecha_hora: string;
  producto_id: number;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
  reembolsada: boolean;
}

// Mapas: { nino_id: hasta_ms } / { nino_id: count }. Las claves vienen como string en JSON.
export type CastigoActivoMap = Record<string, number>;
export type CastigoHistoricoMap = Record<string, number>;

export interface ConfiguracionOut {
  cota_diaria: number;
}

export interface ConfiguracionUpdate {
  cota_diaria?: number;
  pin_admin?: string;
}

export interface TopNino {
  nino_id: number | null;
  nino_nombre: string;
  total: number;
}

export interface VentasDia {
  fecha: string; // YYYY-MM-DD
  total: number;
}

export interface EstadisticasOut {
  total_ventas: number;
  ventas_hoy: number;
  top_ninos: TopNino[];
  ventas_por_dia: VentasDia[];
}

export interface FiltrosTransacciones {
  fecha_inicio?: string; // ISO
  fecha_fin?: string; // ISO
  nino_id?: number;
  grupo?: number;
  busqueda?: string;
}
