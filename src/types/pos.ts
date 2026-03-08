// Tipos para el módulo POS

export interface Caja {
  id: string
  almacen_id: string
  codigo: string
  nombre: string
  lista_precio_id: string | null
  cliente_default_id: string | null
  ticket_encabezado: string | null
  ticket_pie: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  organizacion_id: string
}

export interface TurnoCaja {
  id: string
  caja_id: string
  usuario_id: string
  usuario_nombre: string | null
  fecha_apertura: string
  fecha_cierre: string | null
  monto_apertura: number
  monto_cierre_esperado: number | null
  monto_cierre_real: number | null
  diferencia: number | null
  status: 'abierto' | 'cerrado'
  notas_cierre: string | null
  created_at: string
  updated_at: string
  organizacion_id: string
}

export interface VentaPOS {
  id: string
  folio: string
  turno_caja_id: string
  almacen_id: string
  cliente_id: string
  subtotal: number
  descuento_porcentaje: number
  descuento_monto: number
  iva: number
  total: number
  metodo_pago: string
  monto_efectivo: number
  monto_tarjeta: number
  monto_transferencia: number
  cambio: number
  referencia_pago: string | null
  factura_id: string | null
  requiere_factura: boolean
  vendedor_id: string | null
  vendedor_nombre: string | null
  notas: string | null
  status: 'completada' | 'cancelada'
  cancelada_por: string | null
  motivo_cancelacion: string | null
  created_at: string
  updated_at: string
  organizacion_id: string
}

export interface VentaPOSItem {
  id: string
  venta_pos_id: string
  producto_id: string
  descripcion: string | null
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  subtotal: number
  created_at: string
  organizacion_id: string
}

// Vista v_ventas_pos
export interface VentaPOSView extends VentaPOS {
  cliente_nombre: string | null
  cliente_rfc: string | null
  almacen_nombre: string | null
  caja_nombre: string | null
  caja_codigo: string | null
  cajero_nombre: string | null
}

// Vista v_resumen_turno
export interface ResumenTurno extends TurnoCaja {
  caja_nombre: string | null
  caja_codigo: string | null
  almacen_nombre: string | null
  num_ventas: number
  num_canceladas: number
  total_ventas: number
  total_efectivo: number
  total_tarjeta: number
  total_transferencia: number
  total_cambio: number
  entradas_caja: number
  salidas_caja: number
}

// Item del carrito (estado local)
export interface POSCartItem {
  key: string // producto_id + timestamp para unicidad
  producto_id: string
  sku: string
  nombre: string
  codigo_barras: string | null
  precio_unitario: number
  cantidad: number
  descuento_porcentaje: number
  subtotal: number
  unidad_medida: string
  es_granel: boolean // true para KG
  tasa_ieps: number
}

// Producto con precio para búsqueda POS
export interface ProductoPOS {
  id: string
  sku: string
  nombre: string
  codigo_barras: string | null
  unidad_medida: string
  es_servicio: boolean
  stock_total: number | null
  precio: number | null
  precio_con_iva: number | null
  tasa_ieps: number
}

// Params para registrar venta RPC
export interface RegistrarVentaParams {
  p_turno_caja_id: string
  p_almacen_id: string
  p_cliente_id: string
  p_items: Array<{
    producto_id: string
    descripcion: string
    cantidad: number
    precio_unitario: number
    descuento_porcentaje: number
    tasa_ieps: number
  }>
  p_descuento_porcentaje?: number
  p_metodo_pago?: string
  p_monto_efectivo?: number
  p_monto_tarjeta?: number
  p_monto_transferencia?: number
  p_referencia_pago?: string
  p_requiere_factura?: boolean
  p_vendedor_id?: string
  p_vendedor_nombre?: string
  p_notas?: string
  p_organizacion_id?: string
}
