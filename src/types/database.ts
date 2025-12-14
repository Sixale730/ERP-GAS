// Tipos generados para el schema ERP de Supabase

export type Database = {
  erp: {
    Tables: {
      categorias: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          categoria_padre_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          categoria_padre_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          categoria_padre_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      almacenes: {
        Row: {
          id: string
          codigo: string
          nombre: string
          direccion: string | null
          telefono: string | null
          responsable: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          codigo: string
          nombre: string
          direccion?: string | null
          telefono?: string | null
          responsable?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          codigo?: string
          nombre?: string
          direccion?: string | null
          telefono?: string | null
          responsable?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      listas_precios: {
        Row: {
          id: string
          codigo: string
          nombre: string
          moneda: string
          is_default: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          codigo: string
          nombre: string
          moneda?: string
          is_default?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          codigo?: string
          nombre?: string
          moneda?: string
          is_default?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      proveedores: {
        Row: {
          id: string
          codigo: string
          razon_social: string
          nombre_comercial: string | null
          rfc: string | null
          direccion: string | null
          telefono: string | null
          email: string | null
          contacto_nombre: string | null
          dias_credito: number
          notas: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          codigo: string
          razon_social: string
          nombre_comercial?: string | null
          rfc?: string | null
          direccion?: string | null
          telefono?: string | null
          email?: string | null
          contacto_nombre?: string | null
          dias_credito?: number
          notas?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          codigo?: string
          razon_social?: string
          nombre_comercial?: string | null
          rfc?: string | null
          direccion?: string | null
          telefono?: string | null
          email?: string | null
          contacto_nombre?: string | null
          dias_credito?: number
          notas?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      productos: {
        Row: {
          id: string
          sku: string
          codigo_barras: string | null
          nombre: string
          descripcion: string | null
          categoria_id: string | null
          unidad_medida: string
          proveedor_principal_id: string | null
          costo_promedio: number
          stock_minimo: number
          stock_maximo: number
          numero_parte: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          codigo_barras?: string | null
          nombre: string
          descripcion?: string | null
          categoria_id?: string | null
          unidad_medida?: string
          proveedor_principal_id?: string | null
          costo_promedio?: number
          stock_minimo?: number
          stock_maximo?: number
          numero_parte?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          codigo_barras?: string | null
          nombre?: string
          descripcion?: string | null
          categoria_id?: string | null
          unidad_medida?: string
          proveedor_principal_id?: string | null
          costo_promedio?: number
          stock_minimo?: number
          stock_maximo?: number
          numero_parte?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      precios_productos: {
        Row: {
          id: string
          producto_id: string
          lista_precio_id: string
          precio: number
          precio_con_iva: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          producto_id: string
          lista_precio_id: string
          precio: number
          precio_con_iva?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          producto_id?: string
          lista_precio_id?: string
          precio?: number
          precio_con_iva?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      inventario: {
        Row: {
          id: string
          producto_id: string
          almacen_id: string
          cantidad: number
          cantidad_reservada: number
          updated_at: string
        }
        Insert: {
          id?: string
          producto_id: string
          almacen_id: string
          cantidad?: number
          cantidad_reservada?: number
          updated_at?: string
        }
        Update: {
          id?: string
          producto_id?: string
          almacen_id?: string
          cantidad?: number
          cantidad_reservada?: number
          updated_at?: string
        }
      }
      clientes: {
        Row: {
          id: string
          codigo: string
          nombre_comercial: string
          telefono: string | null
          email: string | null
          direccion: string | null
          contacto_nombre: string | null
          razon_social: string | null
          rfc: string | null
          regimen_fiscal: string | null
          uso_cfdi: string
          codigo_postal_fiscal: string | null
          lista_precio_id: string | null
          dias_credito: number
          limite_credito: number
          saldo_pendiente: number
          notas: string | null
          is_active: boolean
          moneda: 'USD' | 'MXN'
          // Campos de envío
          direccion_envio: string | null
          ciudad_envio: string | null
          estado_envio: string | null
          codigo_postal_envio: string | null
          contacto_envio: string | null
          telefono_envio: string | null
          // Campos de pago predeterminados
          forma_pago: string | null
          metodo_pago: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          codigo: string
          nombre_comercial: string
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          contacto_nombre?: string | null
          razon_social?: string | null
          rfc?: string | null
          regimen_fiscal?: string | null
          uso_cfdi?: string
          codigo_postal_fiscal?: string | null
          lista_precio_id?: string | null
          dias_credito?: number
          limite_credito?: number
          saldo_pendiente?: number
          notas?: string | null
          is_active?: boolean
          moneda?: 'USD' | 'MXN'
          // Campos de envío
          direccion_envio?: string | null
          ciudad_envio?: string | null
          estado_envio?: string | null
          codigo_postal_envio?: string | null
          contacto_envio?: string | null
          telefono_envio?: string | null
          // Campos de pago predeterminados
          forma_pago?: string | null
          metodo_pago?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          codigo?: string
          nombre_comercial?: string
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          contacto_nombre?: string | null
          razon_social?: string | null
          rfc?: string | null
          regimen_fiscal?: string | null
          uso_cfdi?: string
          codigo_postal_fiscal?: string | null
          lista_precio_id?: string | null
          dias_credito?: number
          limite_credito?: number
          saldo_pendiente?: number
          notas?: string | null
          is_active?: boolean
          moneda?: 'USD' | 'MXN'
          // Campos de envío
          direccion_envio?: string | null
          ciudad_envio?: string | null
          estado_envio?: string | null
          codigo_postal_envio?: string | null
          contacto_envio?: string | null
          telefono_envio?: string | null
          // Campos de pago predeterminados
          forma_pago?: string | null
          metodo_pago?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cotizaciones: {
        Row: {
          id: string
          folio: string
          cliente_id: string
          almacen_id: string
          lista_precio_id: string | null
          fecha: string
          vigencia_dias: number
          status: string
          subtotal: number
          descuento_porcentaje: number
          descuento_monto: number
          iva: number
          total: number
          notas: string | null
          terminos_condiciones: string | null
          vendedor_id: string | null
          factura_id: string | null
          tipo_cambio: number | null
          margen_aplicado: number | null
          moneda: 'USD' | 'MXN'
          // Datos CFDI (copiados del cliente)
          cfdi_rfc: string | null
          cfdi_razon_social: string | null
          cfdi_regimen_fiscal: string | null
          cfdi_uso_cfdi: string | null
          cfdi_codigo_postal: string | null
          // Datos de envío
          envio_direccion: string | null
          envio_ciudad: string | null
          envio_estado: string | null
          envio_codigo_postal: string | null
          envio_contacto: string | null
          envio_telefono: string | null
          // Datos de pago
          forma_pago: string | null
          metodo_pago: string | null
          condiciones_pago: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          folio: string
          cliente_id: string
          almacen_id: string
          lista_precio_id?: string | null
          fecha?: string
          vigencia_dias?: number
          status?: string
          subtotal?: number
          descuento_porcentaje?: number
          descuento_monto?: number
          iva?: number
          total?: number
          notas?: string | null
          terminos_condiciones?: string | null
          vendedor_id?: string | null
          factura_id?: string | null
          tipo_cambio?: number | null
          margen_aplicado?: number | null
          moneda?: 'USD' | 'MXN'
          // Datos CFDI (copiados del cliente)
          cfdi_rfc?: string | null
          cfdi_razon_social?: string | null
          cfdi_regimen_fiscal?: string | null
          cfdi_uso_cfdi?: string | null
          cfdi_codigo_postal?: string | null
          // Datos de envío
          envio_direccion?: string | null
          envio_ciudad?: string | null
          envio_estado?: string | null
          envio_codigo_postal?: string | null
          envio_contacto?: string | null
          envio_telefono?: string | null
          // Datos de pago
          forma_pago?: string | null
          metodo_pago?: string | null
          condiciones_pago?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          folio?: string
          cliente_id?: string
          almacen_id?: string
          lista_precio_id?: string | null
          fecha?: string
          vigencia_dias?: number
          status?: string
          subtotal?: number
          descuento_porcentaje?: number
          descuento_monto?: number
          iva?: number
          total?: number
          notas?: string | null
          terminos_condiciones?: string | null
          vendedor_id?: string | null
          factura_id?: string | null
          tipo_cambio?: number | null
          margen_aplicado?: number | null
          moneda?: 'USD' | 'MXN'
          // Datos CFDI (copiados del cliente)
          cfdi_rfc?: string | null
          cfdi_razon_social?: string | null
          cfdi_regimen_fiscal?: string | null
          cfdi_uso_cfdi?: string | null
          cfdi_codigo_postal?: string | null
          // Datos de envío
          envio_direccion?: string | null
          envio_ciudad?: string | null
          envio_estado?: string | null
          envio_codigo_postal?: string | null
          envio_contacto?: string | null
          envio_telefono?: string | null
          // Datos de pago
          forma_pago?: string | null
          metodo_pago?: string | null
          condiciones_pago?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cotizacion_items: {
        Row: {
          id: string
          cotizacion_id: string
          producto_id: string
          descripcion: string | null
          cantidad: number
          precio_unitario: number
          descuento_porcentaje: number
          subtotal: number
          costo_base: number | null
          created_at: string
        }
        Insert: {
          id?: string
          cotizacion_id: string
          producto_id: string
          descripcion?: string | null
          cantidad: number
          precio_unitario: number
          descuento_porcentaje?: number
          subtotal?: number
          costo_base?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          cotizacion_id?: string
          producto_id?: string
          descripcion?: string | null
          cantidad?: number
          precio_unitario?: number
          descuento_porcentaje?: number
          subtotal?: number
          costo_base?: number | null
          created_at?: string
        }
      }
      facturas: {
        Row: {
          id: string
          folio: string
          serie: string
          cliente_id: string
          almacen_id: string
          cotizacion_id: string | null
          fecha: string
          fecha_vencimiento: string | null
          status: string
          cliente_rfc: string | null
          cliente_razon_social: string | null
          cliente_regimen_fiscal: string | null
          cliente_uso_cfdi: string | null
          subtotal: number
          descuento_monto: number
          iva: number
          total: number
          monto_pagado: number
          saldo: number
          notas: string | null
          vendedor_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          folio: string
          serie?: string
          cliente_id: string
          almacen_id: string
          cotizacion_id?: string | null
          fecha?: string
          fecha_vencimiento?: string | null
          status?: string
          cliente_rfc?: string | null
          cliente_razon_social?: string | null
          cliente_regimen_fiscal?: string | null
          cliente_uso_cfdi?: string | null
          subtotal?: number
          descuento_monto?: number
          iva?: number
          total?: number
          monto_pagado?: number
          saldo?: number
          notas?: string | null
          vendedor_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          folio?: string
          serie?: string
          cliente_id?: string
          almacen_id?: string
          cotizacion_id?: string | null
          fecha?: string
          fecha_vencimiento?: string | null
          status?: string
          cliente_rfc?: string | null
          cliente_razon_social?: string | null
          cliente_regimen_fiscal?: string | null
          cliente_uso_cfdi?: string | null
          subtotal?: number
          descuento_monto?: number
          iva?: number
          total?: number
          monto_pagado?: number
          saldo?: number
          notas?: string | null
          vendedor_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      pagos: {
        Row: {
          id: string
          folio: string
          factura_id: string
          fecha: string
          monto: number
          metodo_pago: string | null
          referencia: string | null
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          folio: string
          factura_id: string
          fecha?: string
          monto: number
          metodo_pago?: string | null
          referencia?: string | null
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          folio?: string
          factura_id?: string
          fecha?: string
          monto?: number
          metodo_pago?: string | null
          referencia?: string | null
          notas?: string | null
          created_at?: string
        }
      }
      configuracion: {
        Row: {
          id: string
          clave: string
          valor: any
          descripcion: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clave: string
          valor: any
          descripcion?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clave?: string
          valor?: any
          descripcion?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ordenes_compra: {
        Row: {
          id: string
          folio: string
          proveedor_id: string
          almacen_destino_id: string
          fecha: string
          fecha_esperada: string | null
          status: 'borrador' | 'enviada' | 'parcialmente_recibida' | 'recibida' | 'cancelada'
          moneda: 'USD' | 'MXN'
          tipo_cambio: number | null
          subtotal: number
          iva: number
          total: number
          notas: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          folio: string
          proveedor_id: string
          almacen_destino_id: string
          fecha?: string
          fecha_esperada?: string | null
          status?: 'borrador' | 'enviada' | 'parcialmente_recibida' | 'recibida' | 'cancelada'
          moneda?: 'USD' | 'MXN'
          tipo_cambio?: number | null
          subtotal?: number
          iva?: number
          total?: number
          notas?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          folio?: string
          proveedor_id?: string
          almacen_destino_id?: string
          fecha?: string
          fecha_esperada?: string | null
          status?: 'borrador' | 'enviada' | 'parcialmente_recibida' | 'recibida' | 'cancelada'
          moneda?: 'USD' | 'MXN'
          tipo_cambio?: number | null
          subtotal?: number
          iva?: number
          total?: number
          notas?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      orden_compra_items: {
        Row: {
          id: string
          orden_compra_id: string
          producto_id: string
          cantidad_solicitada: number
          cantidad_recibida: number
          precio_unitario: number
          descuento_porcentaje: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          orden_compra_id: string
          producto_id: string
          cantidad_solicitada: number
          cantidad_recibida?: number
          precio_unitario: number
          descuento_porcentaje?: number
          subtotal?: number
          created_at?: string
        }
        Update: {
          id?: string
          orden_compra_id?: string
          producto_id?: string
          cantidad_solicitada?: number
          cantidad_recibida?: number
          precio_unitario?: number
          descuento_porcentaje?: number
          subtotal?: number
          created_at?: string
        }
      }
      recepciones_orden: {
        Row: {
          id: string
          orden_compra_id: string
          orden_compra_item_id: string
          fecha_recepcion: string
          cantidad_recibida: number
          numero_lote: string | null
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          orden_compra_id: string
          orden_compra_item_id: string
          fecha_recepcion?: string
          cantidad_recibida: number
          numero_lote?: string | null
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          orden_compra_id?: string
          orden_compra_item_id?: string
          fecha_recepcion?: string
          cantidad_recibida?: number
          numero_lote?: string | null
          notas?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      v_productos_stock: {
        Row: {
          id: string
          sku: string
          nombre: string
          descripcion: string | null
          categoria_nombre: string | null
          proveedor_nombre: string | null
          stock_total: number
          reservado_total: number
          disponible_total: number
        }
      }
      v_cotizaciones: {
        Row: {
          id: string
          folio: string
          cliente_codigo: string
          cliente_nombre: string
          cliente_rfc: string | null
          almacen_nombre: string
          fecha: string
          status: string
          status_actual: string
          total: number
        }
      }
      v_facturas: {
        Row: {
          id: string
          folio: string
          cliente_codigo: string
          cliente_nombre: string
          almacen_nombre: string
          fecha: string
          status: string
          status_actual: string
          total: number
          saldo: number
          dias_vencida: number
        }
      }
      v_ordenes_compra: {
        Row: {
          id: string
          folio: string
          fecha: string
          fecha_esperada: string | null
          status: string
          status_label: string
          moneda: 'USD' | 'MXN'
          tipo_cambio: number | null
          subtotal: number
          iva: number
          total: number
          notas: string | null
          proveedor_id: string
          proveedor_codigo: string
          proveedor_nombre: string
          almacen_id: string
          almacen_codigo: string
          almacen_nombre: string
          total_items: number
          items_completos: number
          created_at: string
          updated_at: string
        }
      }
      v_movimientos: {
        Row: {
          id: string
          producto_id: string
          almacen_origen_id: string | null
          almacen_destino_id: string | null
          tipo: 'entrada' | 'salida'
          cantidad: number
          referencia_tipo: string | null
          referencia_id: string | null
          notas: string | null
          created_at: string
          sku: string
          producto_nombre: string
          almacen_origen: string | null
          almacen_destino: string | null
        }
      }
    }
    Functions: {
      generar_folio: {
        Args: { tipo: string }
        Returns: string
      }
      cotizacion_a_factura: {
        Args: { p_cotizacion_id: string }
        Returns: string
      }
      recalcular_totales_cotizacion: {
        Args: { p_cotizacion_id: string }
        Returns: void
      }
      recalcular_totales_factura: {
        Args: { p_factura_id: string }
        Returns: void
      }
      registrar_recepcion: {
        Args: {
          p_orden_compra_item_id: string
          p_cantidad: number
          p_notas?: string | null
          p_numero_lote?: string | null
        }
        Returns: string
      }
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['erp']['Tables']> = Database['erp']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['erp']['Tables']> = Database['erp']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['erp']['Tables']> = Database['erp']['Tables'][T]['Update']
export type Views<T extends keyof Database['erp']['Views']> = Database['erp']['Views'][T]['Row']

// Alias for common types
export type Categoria = Tables<'categorias'>
export type Almacen = Tables<'almacenes'>
export type ListaPrecio = Tables<'listas_precios'>
export type Proveedor = Tables<'proveedores'>
export type Producto = Tables<'productos'>
export type PrecioProducto = Tables<'precios_productos'>
export type Inventario = Tables<'inventario'>
export type Cliente = Tables<'clientes'>
export type Cotizacion = Tables<'cotizaciones'>
export type CotizacionItem = Tables<'cotizacion_items'>
export type Factura = Tables<'facturas'>
export type Pago = Tables<'pagos'>
export type Configuracion = Tables<'configuracion'>

// Tipos específicos para configuraciones
export interface ConfigTipoCambio {
  valor: number
  fecha: string
}

export interface ConfigMargenGanancia {
  porcentaje: number
}

// View types
export type ProductoStock = Views<'v_productos_stock'>
export type CotizacionView = Views<'v_cotizaciones'>
export type FacturaView = Views<'v_facturas'>
export type OrdenCompraView = Views<'v_ordenes_compra'>
export type MovimientoView = Views<'v_movimientos'>

// Ordenes de compra types
export type OrdenCompra = Tables<'ordenes_compra'>
export type OrdenCompraItem = Tables<'orden_compra_items'>
export type RecepcionOrden = Tables<'recepciones_orden'>

// Configuracion de margenes por categoria
export interface ConfigMargenesCategoria {
  global: number
  por_categoria: Record<string, number>
}
