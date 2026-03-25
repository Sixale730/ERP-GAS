import type { InsightRule, InsightItem, InsightContext } from '../types'

interface ItemRow { producto_id: string; subtotal: number }
interface ProdInfo { sku: string; nombre: string }

function clasificarABC(acumulado: number): 'A' | 'B' | 'C' {
  if (acumulado <= 80) return 'A'
  if (acumulado <= 95) return 'B'
  return 'C'
}

function calcularABC(agrupado: Map<string, number>): Map<string, 'A' | 'B' | 'C'> {
  const sorted = Array.from(agrupado.entries()).sort((a, b) => b[1] - a[1])
  const total = sorted.reduce((s, [, v]) => s + v, 0)
  if (total <= 0) return new Map()

  let acum = 0
  const result = new Map<string, 'A' | 'B' | 'C'>()
  for (const [id, val] of sorted) {
    acum += (val / total) * 100
    result.set(id, clasificarABC(acum))
  }
  return result
}

export const productoEstrellaCayendoRule: InsightRule = {
  key: 'producto-estrella-cayendo',
  titulo: 'Producto estrella cayendo',
  tipo: 'ventas',
  severidadDefault: 'alerta',
  umbralDefault: 0,
  requiereAlguno: ['facturas', 'pos'],
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, modulosActivos } = ctx

    const hoy = new Date()
    if (hoy.getDate() < 7) return []

    const mesActualInicio = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const mesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const mesAnteriorInicio = `${mesAnt.getFullYear()}-${String(mesAnt.getMonth() + 1).padStart(2, '0')}-01`

    const tieneFacturas = modulosActivos.includes('facturas')
    const tienePOS = modulosActivos.includes('pos')

    const mesActualMap = new Map<string, number>()
    const mesAnteriorMap = new Map<string, number>()

    const acumularItems = (map: Map<string, number>, items: ItemRow[]) => {
      for (const it of items) {
        if (!it.producto_id) continue
        map.set(it.producto_id, (map.get(it.producto_id) || 0) + Number(it.subtotal || 0))
      }
    }

    if (tieneFacturas) {
      const { data: fAct } = await supabase.schema('erp').from('facturas').select('id')
        .eq('organizacion_id', orgId).not('status', 'eq', 'cancelada').gte('fecha', mesActualInicio)
      const idsAct = ((fAct || []) as { id: string }[]).map((f) => f.id)
      if (idsAct.length > 0) {
        const { data } = await supabase.schema('erp').from('factura_items').select('producto_id, subtotal').in('factura_id', idsAct)
        acumularItems(mesActualMap, (data || []) as ItemRow[])
      }

      const { data: fPrev } = await supabase.schema('erp').from('facturas').select('id')
        .eq('organizacion_id', orgId).not('status', 'eq', 'cancelada')
        .gte('fecha', mesAnteriorInicio).lt('fecha', mesActualInicio)
      const idsPrev = ((fPrev || []) as { id: string }[]).map((f) => f.id)
      if (idsPrev.length > 0) {
        const { data } = await supabase.schema('erp').from('factura_items').select('producto_id, subtotal').in('factura_id', idsPrev)
        acumularItems(mesAnteriorMap, (data || []) as ItemRow[])
      }
    }

    if (tienePOS) {
      const { data: vAct } = await supabase.schema('erp').from('ventas_pos').select('id')
        .eq('organizacion_id', orgId).eq('status', 'completada').gte('created_at', `${mesActualInicio}T00:00:00`)
      const idsAct = ((vAct || []) as { id: string }[]).map((v) => v.id)
      if (idsAct.length > 0) {
        const { data } = await supabase.schema('erp').from('venta_pos_items').select('producto_id, subtotal').in('venta_pos_id', idsAct)
        acumularItems(mesActualMap, (data || []) as ItemRow[])
      }

      const { data: vPrev } = await supabase.schema('erp').from('ventas_pos').select('id')
        .eq('organizacion_id', orgId).eq('status', 'completada')
        .gte('created_at', `${mesAnteriorInicio}T00:00:00`).lt('created_at', `${mesActualInicio}T00:00:00`)
      const idsPrev = ((vPrev || []) as { id: string }[]).map((v) => v.id)
      if (idsPrev.length > 0) {
        const { data } = await supabase.schema('erp').from('venta_pos_items').select('producto_id, subtotal').in('venta_pos_id', idsPrev)
        acumularItems(mesAnteriorMap, (data || []) as ItemRow[])
      }
    }

    const abcAnterior = calcularABC(mesAnteriorMap)
    const abcActual = calcularABC(mesActualMap)

    if (abcAnterior.size === 0) return []

    // Detectar degradaciones
    const degradaciones: { id: string; antes: string; ahora: string }[] = []
    const abcOrder = { A: 0, B: 1, C: 2 }

    abcAnterior.forEach((claseAnterior, prodId) => {
      const claseActual = abcActual.get(prodId) || 'C'
      if (abcOrder[claseActual] > abcOrder[claseAnterior]) {
        degradaciones.push({ id: prodId, antes: claseAnterior, ahora: claseActual })
      }
    })

    if (degradaciones.length === 0) return []

    // Obtener info de productos
    const prodIds = degradaciones.map((d) => d.id)
    const { data: prods } = await supabase.schema('erp').from('productos').select('id, sku, nombre').in('id', prodIds)
    const prodMap = new Map(((prods || []) as (ProdInfo & { id: string })[]).map((p) => [p.id, p]))

    // Priorizar A→C > A→B > B→C
    degradaciones.sort((a, b) => {
      const scoreA = (a.antes === 'A' ? 2 : 1) + (a.ahora === 'C' ? 2 : 1)
      const scoreB = (b.antes === 'A' ? 2 : 1) + (b.ahora === 'C' ? 2 : 1)
      return scoreB - scoreA
    })

    const insights: InsightItem[] = degradaciones.slice(0, 5).map((d) => {
      const prod = prodMap.get(d.id)
      const nombre = prod?.nombre || 'Producto desconocido'
      const severidad = d.antes === 'A' && d.ahora === 'C' ? 'critico' as const : 'alerta' as const

      return {
        id: crypto.randomUUID(),
        key: `producto-estrella-${d.id}`,
        tipo: 'ventas' as const,
        severidad,
        titulo: `${nombre} bajo de ${d.antes} a ${d.ahora}`,
        mensaje: `${nombre} (${prod?.sku || '-'}) paso de clase ${d.antes} a ${d.ahora} este mes. Sus ventas cayeron significativamente respecto al periodo anterior.`,
        metrica: { valor: degradaciones.length, unidad: 'productos' },
        accion: { label: 'Ver ABC de productos', ruta: '/reportes/abc-productos' },
        entidades: { producto_id: d.id },
        generado_en: new Date().toISOString(),
      }
    })

    return insights
  },
}
