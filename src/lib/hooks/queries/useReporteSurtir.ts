'use client'

import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

/**
 * Reporte "Ordenes de Venta a Surtir".
 *
 * Ejecuta una asignacion FIFO (por antiguedad de OV) sobre el stock fisico
 * para determinar, por cada linea de cada OV abierta:
 *   - si se cubre con el almacen asignado,
 *   - si se cubre desde otros almacenes,
 *   - cuanto queda pendiente,
 *   - y en caso de pendiente, la OC mas antigua que incluye ese material.
 *
 * IMPORTANTE: se usa `cantidad` (stock fisico) de v_inventario_detalle, NO
 * `cantidad - cantidad_reservada`. El reservado dinamico del sistema se
 * calcula precisamente desde las OVs que estamos asignando aqui; restarlo
 * duplicaria la reserva.
 */

export type EstadoSurtido =
  | 'completo'
  | 'completo_otro_almacen'
  | 'parcial'
  | 'sin_stock'
  | 'servicio'

export interface AllocAlmacen {
  almacen_id: string
  almacen_nombre: string
  cantidad: number
  es_almacen_asignado: boolean
}

export interface AllocOCSugerida {
  orden_compra_id: string
  folio: string
  created_at: string
  fecha_esperada: string | null
  proveedor_nombre: string
  pendiente_oc: number
  cubre_unidades: number
}

export interface AllocLinea {
  item_id: string
  producto_id: string
  sku: string
  producto_nombre: string
  es_servicio: boolean
  cantidad_solicitada: number
  asignaciones: AllocAlmacen[]
  cantidad_asignada_almacen_ov: number
  cantidad_asignada_otros: number
  cantidad_faltante: number
  oc_sugerida: AllocOCSugerida | null
  estado: EstadoSurtido
}

export interface AllocOV {
  ov_id: string
  folio: string
  fecha: string
  created_at: string
  cliente_id: string
  cliente_nombre: string
  almacen_id: string | null
  almacen_nombre: string | null
  total: number
  lineas: AllocLinea[]
  total_lineas: number
  lineas_completas: number
  lineas_parciales: number
  lineas_sin_stock: number
  estado_global: EstadoSurtido
}

export interface ReporteSurtirResultado {
  ovs: AllocOV[]
  resumen: {
    total_ovs: number
    ovs_completas: number
    ovs_parciales: number
    ovs_sin_stock: number
    lineas_total: number
    lineas_con_faltante: number
    productos_unicos_con_faltante: number
  }
}

export interface ReporteSurtirFiltros {
  clienteId?: string | null
  almacenAsignadoId?: string | null
  fechaDesde?: string | null
  fechaHasta?: string | null
}

// ── Inputs de la funcion pura allocateFIFO ───────────────────────────────

interface OVInput {
  id: string
  folio: string
  fecha: string
  created_at: string
  cliente_id: string
  cliente_nombre: string
  almacen_id: string | null
  almacen_nombre: string | null
  total: number
}

interface ItemInput {
  id: string
  cotizacion_id: string
  producto_id: string
  cantidad: number
}

interface ProductoInput {
  id: string
  sku: string
  nombre: string
  es_servicio: boolean
}

interface InventarioInput {
  producto_id: string
  almacen_id: string
  almacen_nombre: string
  cantidad: number
  prioridad: number | null
}

interface OCInput {
  id: string
  folio: string
  created_at: string
  fecha_esperada: string | null
  proveedor_nombre: string
}

interface OCItemInput {
  orden_compra_id: string
  producto_id: string
  cantidad_solicitada: number
  cantidad_recibida: number
}

export interface AllocateFIFOInput {
  ovs: OVInput[]
  items: ItemInput[]
  productos: ProductoInput[]
  inventario: InventarioInput[]
  ocs: OCInput[]
  ocItems: OCItemInput[]
}

// ── Funcion pura: asignacion FIFO ────────────────────────────────────────

export function allocateFIFO(input: AllocateFIFOInput): ReporteSurtirResultado {
  const { ovs, items, productos, inventario, ocs, ocItems } = input

  const productosById = new Map<string, ProductoInput>()
  for (const p of productos) productosById.set(p.id, p)

  // Stock restante por (producto, almacen). Se inicia con la cantidad fisica.
  const stockRestante = new Map<string, number>()
  // Almacenes disponibles por producto (para iterar y elegir "otros almacenes").
  const almacenesPorProducto = new Map<string, InventarioInput[]>()

  for (const inv of inventario) {
    const k = `${inv.producto_id}|${inv.almacen_id}`
    stockRestante.set(k, (stockRestante.get(k) ?? 0) + (inv.cantidad ?? 0))
    const arr = almacenesPorProducto.get(inv.producto_id) ?? []
    arr.push(inv)
    almacenesPorProducto.set(inv.producto_id, arr)
  }

  // OCs pendientes por producto, ordenadas por created_at ASC.
  type OCCola = {
    oc: OCInput
    pendiente_original: number
    pendienteRestante: number
  }
  const ocsOrdenadas = [...ocs].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const ocsById = new Map<string, OCInput>()
  for (const oc of ocsOrdenadas) ocsById.set(oc.id, oc)

  const ocsPendientesPorProducto = new Map<string, OCCola[]>()
  for (const it of ocItems) {
    const pend = Math.max((it.cantidad_solicitada ?? 0) - (it.cantidad_recibida ?? 0), 0)
    if (pend <= 0) continue
    const oc = ocsById.get(it.orden_compra_id)
    if (!oc) continue
    const cola = ocsPendientesPorProducto.get(it.producto_id) ?? []
    cola.push({ oc, pendiente_original: pend, pendienteRestante: pend })
    ocsPendientesPorProducto.set(it.producto_id, cola)
  }
  // Ordenar cada cola por created_at de la OC (ASC = mas vieja primero).
  ocsPendientesPorProducto.forEach((cola) => {
    cola.sort((a, b) => a.oc.created_at.localeCompare(b.oc.created_at))
  })

  // Agrupar items por cotizacion.
  const itemsPorOV = new Map<string, ItemInput[]>()
  for (const it of items) {
    const arr = itemsPorOV.get(it.cotizacion_id) ?? []
    arr.push(it)
    itemsPorOV.set(it.cotizacion_id, arr)
  }

  // Ordenar OVs por created_at ASC (FIFO).
  const ovsOrdenadas = [...ovs].sort((a, b) => a.created_at.localeCompare(b.created_at))

  const productosConFaltante = new Set<string>()
  const resultadoOVs: AllocOV[] = []
  let totalLineas = 0
  let lineasConFaltante = 0

  for (const ov of ovsOrdenadas) {
    const lineasItems = itemsPorOV.get(ov.id) ?? []
    const lineasAlloc: AllocLinea[] = []

    for (const it of lineasItems) {
      const prod = productosById.get(it.producto_id)
      const esServicio = prod?.es_servicio === true

      const baseLinea: AllocLinea = {
        item_id: it.id,
        producto_id: it.producto_id,
        sku: prod?.sku ?? '-',
        producto_nombre: prod?.nombre ?? '[Producto eliminado]',
        es_servicio: esServicio,
        cantidad_solicitada: it.cantidad,
        asignaciones: [],
        cantidad_asignada_almacen_ov: 0,
        cantidad_asignada_otros: 0,
        cantidad_faltante: 0,
        oc_sugerida: null,
        estado: 'servicio',
      }

      if (esServicio) {
        lineasAlloc.push(baseLinea)
        continue
      }

      let requerido = it.cantidad

      // 1) Almacen asignado a la OV
      if (ov.almacen_id) {
        const k = `${it.producto_id}|${ov.almacen_id}`
        const disp = stockRestante.get(k) ?? 0
        const tomar = Math.min(disp, requerido)
        if (tomar > 0) {
          stockRestante.set(k, disp - tomar)
          baseLinea.asignaciones.push({
            almacen_id: ov.almacen_id,
            almacen_nombre: ov.almacen_nombre ?? '—',
            cantidad: tomar,
            es_almacen_asignado: true,
          })
          baseLinea.cantidad_asignada_almacen_ov += tomar
          requerido -= tomar
        }
      }

      // 2) Otros almacenes: prioridad ASC, luego stock DESC
      if (requerido > 0) {
        const otros = (almacenesPorProducto.get(it.producto_id) ?? [])
          .filter((a) => a.almacen_id !== ov.almacen_id && (stockRestante.get(`${it.producto_id}|${a.almacen_id}`) ?? 0) > 0)
          .sort((a, b) => {
            const pa = a.prioridad ?? 999
            const pb = b.prioridad ?? 999
            if (pa !== pb) return pa - pb
            const sa = stockRestante.get(`${it.producto_id}|${a.almacen_id}`) ?? 0
            const sb = stockRestante.get(`${it.producto_id}|${b.almacen_id}`) ?? 0
            return sb - sa
          })

        for (const o of otros) {
          if (requerido <= 0) break
          const k = `${it.producto_id}|${o.almacen_id}`
          const disp = stockRestante.get(k) ?? 0
          const tomar = Math.min(disp, requerido)
          if (tomar > 0) {
            stockRestante.set(k, disp - tomar)
            baseLinea.asignaciones.push({
              almacen_id: o.almacen_id,
              almacen_nombre: o.almacen_nombre,
              cantidad: tomar,
              es_almacen_asignado: false,
            })
            baseLinea.cantidad_asignada_otros += tomar
            requerido -= tomar
          }
        }
      }

      // 3) Faltante → OC mas vieja con pendiente
      baseLinea.cantidad_faltante = requerido
      if (requerido > 0) {
        productosConFaltante.add(it.producto_id)
        const cola = ocsPendientesPorProducto.get(it.producto_id)
        if (cola) {
          const candidata = cola.find((c) => c.pendienteRestante > 0)
          if (candidata) {
            const cubre = Math.min(candidata.pendienteRestante, requerido)
            baseLinea.oc_sugerida = {
              orden_compra_id: candidata.oc.id,
              folio: candidata.oc.folio,
              created_at: candidata.oc.created_at,
              fecha_esperada: candidata.oc.fecha_esperada,
              proveedor_nombre: candidata.oc.proveedor_nombre,
              pendiente_oc: candidata.pendiente_original,
              cubre_unidades: cubre,
            }
            candidata.pendienteRestante -= cubre
          }
        }
      }

      // 4) Estado final
      if (requerido === 0) {
        baseLinea.estado = baseLinea.cantidad_asignada_otros > 0 ? 'completo_otro_almacen' : 'completo'
      } else if (baseLinea.asignaciones.length > 0) {
        baseLinea.estado = 'parcial'
      } else {
        baseLinea.estado = 'sin_stock'
      }

      if (baseLinea.cantidad_faltante > 0) lineasConFaltante++
      lineasAlloc.push(baseLinea)
    }

    totalLineas += lineasAlloc.length

    const lineasNoServicio = lineasAlloc.filter((l) => l.estado !== 'servicio')
    const lineasCompletas = lineasNoServicio.filter((l) => l.estado === 'completo' || l.estado === 'completo_otro_almacen').length
    const lineasParciales = lineasNoServicio.filter((l) => l.estado === 'parcial').length
    const lineasSinStock = lineasNoServicio.filter((l) => l.estado === 'sin_stock').length

    let estadoGlobal: EstadoSurtido
    if (lineasNoServicio.length === 0) {
      estadoGlobal = 'servicio'
    } else if (lineasSinStock > 0) {
      estadoGlobal = 'sin_stock'
    } else if (lineasParciales > 0) {
      estadoGlobal = 'parcial'
    } else if (lineasNoServicio.some((l) => l.estado === 'completo_otro_almacen')) {
      estadoGlobal = 'completo_otro_almacen'
    } else {
      estadoGlobal = 'completo'
    }

    resultadoOVs.push({
      ov_id: ov.id,
      folio: ov.folio,
      fecha: ov.fecha,
      created_at: ov.created_at,
      cliente_id: ov.cliente_id,
      cliente_nombre: ov.cliente_nombre,
      almacen_id: ov.almacen_id,
      almacen_nombre: ov.almacen_nombre,
      total: ov.total,
      lineas: lineasAlloc,
      total_lineas: lineasAlloc.length,
      lineas_completas: lineasCompletas,
      lineas_parciales: lineasParciales,
      lineas_sin_stock: lineasSinStock,
      estado_global: estadoGlobal,
    })
  }

  const resumen = {
    total_ovs: resultadoOVs.length,
    ovs_completas: resultadoOVs.filter((o) => o.estado_global === 'completo' || o.estado_global === 'completo_otro_almacen').length,
    ovs_parciales: resultadoOVs.filter((o) => o.estado_global === 'parcial').length,
    ovs_sin_stock: resultadoOVs.filter((o) => o.estado_global === 'sin_stock').length,
    lineas_total: totalLineas,
    lineas_con_faltante: lineasConFaltante,
    productos_unicos_con_faltante: productosConFaltante.size,
  }

  return { ovs: resultadoOVs, resumen }
}

// ── Query de datos + hook ────────────────────────────────────────────────

async function fetchReporteSurtir(filtros: ReporteSurtirFiltros): Promise<ReporteSurtirResultado> {
  const supabase = getSupabaseClient()

  // 1) OVs abiertas
  let ovsQuery = supabase
    .schema('erp')
    .from('v_cotizaciones')
    .select('id, folio, fecha, created_at, cliente_id, cliente_nombre, almacen_id, almacen_nombre, total')
    .eq('status', 'orden_venta')
    .like('folio', 'OV-%')
    .order('created_at', { ascending: true })

  if (filtros.clienteId) ovsQuery = ovsQuery.eq('cliente_id', filtros.clienteId)
  if (filtros.almacenAsignadoId) ovsQuery = ovsQuery.eq('almacen_id', filtros.almacenAsignadoId)
  if (filtros.fechaDesde) ovsQuery = ovsQuery.gte('fecha', filtros.fechaDesde)
  if (filtros.fechaHasta) ovsQuery = ovsQuery.lte('fecha', filtros.fechaHasta)

  const { data: ovsRaw, error: errOvs } = await ovsQuery
  if (errOvs) throw errOvs
  const ovs = (ovsRaw ?? []) as OVInput[]

  if (ovs.length === 0) {
    return {
      ovs: [],
      resumen: {
        total_ovs: 0,
        ovs_completas: 0,
        ovs_parciales: 0,
        ovs_sin_stock: 0,
        lineas_total: 0,
        lineas_con_faltante: 0,
        productos_unicos_con_faltante: 0,
      },
    }
  }

  const ovIds = ovs.map((o) => o.id)

  // 2) Items de esas OVs
  const { data: itemsRaw, error: errItems } = await supabase
    .schema('erp')
    .from('cotizacion_items')
    .select('id, cotizacion_id, producto_id, cantidad')
    .in('cotizacion_id', ovIds)

  if (errItems) throw errItems
  const items = (itemsRaw ?? []) as ItemInput[]

  const productoIds = Array.from(new Set(items.map((i) => i.producto_id))).filter(Boolean)

  if (productoIds.length === 0) {
    return allocateFIFO({ ovs, items, productos: [], inventario: [], ocs: [], ocItems: [] })
  }

  // 3, 4, 5) paralelo: productos, inventario, OCs
  const [productosRes, inventarioRes, ocsRes] = await Promise.all([
    supabase
      .schema('erp')
      .from('productos')
      .select('id, sku, nombre, es_servicio')
      .in('id', productoIds),
    supabase
      .schema('erp')
      .from('v_inventario_detalle')
      .select('producto_id, almacen_id, almacen_nombre, cantidad, prioridad')
      .in('producto_id', productoIds),
    supabase
      .schema('erp')
      .from('v_ordenes_compra')
      .select('id, folio, created_at, fecha_esperada, proveedor_nombre, status')
      .in('status', ['enviada', 'parcialmente_recibida'])
      .order('created_at', { ascending: true }),
  ])

  if (productosRes.error) throw productosRes.error
  if (inventarioRes.error) throw inventarioRes.error
  if (ocsRes.error) throw ocsRes.error

  const productos = (productosRes.data ?? []) as ProductoInput[]
  const inventario = (inventarioRes.data ?? []) as InventarioInput[]
  const ocsAll = (ocsRes.data ?? []) as (OCInput & { status: string })[]
  const ocs = ocsAll.map(({ status: _s, ...rest }) => rest)
  const ocIds = ocs.map((o) => o.id)

  let ocItems: OCItemInput[] = []
  if (ocIds.length > 0) {
    const { data: ocItemsRaw, error: errOcItems } = await supabase
      .schema('erp')
      .from('orden_compra_items')
      .select('orden_compra_id, producto_id, cantidad_solicitada, cantidad_recibida')
      .in('orden_compra_id', ocIds)
      .in('producto_id', productoIds)
    if (errOcItems) throw errOcItems
    ocItems = (ocItemsRaw ?? []) as OCItemInput[]
  }

  return allocateFIFO({ ovs, items, productos, inventario, ocs, ocItems })
}

export function useReporteSurtir(filtros: ReporteSurtirFiltros) {
  return useQuery({
    queryKey: ['reportes', 'ordenes-venta-surtir', filtros],
    queryFn: () => fetchReporteSurtir(filtros),
    staleTime: 60_000,
  })
}
