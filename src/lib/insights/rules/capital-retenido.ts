import type { InsightRule, InsightItem, InsightContext } from '../types'

interface InvRow { producto_id: string; sku: string; producto_nombre: string; almacen_nombre: string; cantidad: number }
interface ProdRow { id: string; costo_promedio: number }
interface MovRow { producto_id: string; fecha: string }

export const capitalRetenidoRule: InsightRule = {
  key: 'capital-retenido',
  titulo: 'Capital retenido en inventario',
  tipo: 'inventario',
  severidadDefault: 'alerta',
  umbralDefault: 90,
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, umbrales } = ctx
    const diasMinimos = umbrales.get('capital-retenido') ?? 90

    const { data: inventario } = await supabase
      .schema('erp')
      .from('v_inventario_detalle')
      .select('producto_id, sku, producto_nombre, almacen_nombre, cantidad')
      .eq('organizacion_id', orgId)
      .gt('cantidad', 0)

    const invRows = (inventario || []) as InvRow[]
    if (invRows.length === 0) return []

    const productoIds = Array.from(new Set(invRows.map((i) => i.producto_id)))
    const { data: productos } = await supabase
      .schema('erp')
      .from('productos')
      .select('id, costo_promedio')
      .in('id', productoIds)

    const costoMap = new Map<string, number>(
      ((productos || []) as ProdRow[]).map((p) => [p.id, Number(p.costo_promedio || 0)])
    )

    const { data: movimientos } = await supabase
      .schema('erp')
      .from('v_movimientos')
      .select('producto_id, fecha')
      .eq('organizacion_id', orgId)
      .eq('tipo', 'salida')
      .order('fecha', { ascending: false })
      .limit(1000)

    const ultimoMovMap = new Map<string, string>()
    for (const m of (movimientos || []) as MovRow[]) {
      if (!ultimoMovMap.has(m.producto_id)) {
        ultimoMovMap.set(m.producto_id, m.fecha)
      }
    }

    const hoy = new Date()
    let valorRetenido = 0
    let productosAfectados = 0
    const topProductos: { nombre: string; valor: number }[] = []

    for (const row of invRows) {
      const ultimoMov = ultimoMovMap.get(row.producto_id) || null
      let diasSin = 999
      if (ultimoMov) {
        diasSin = Math.ceil((hoy.getTime() - new Date(ultimoMov).getTime()) / (1000 * 60 * 60 * 24))
      }

      if (diasSin >= diasMinimos) {
        const costo = costoMap.get(row.producto_id) || 0
        const cantidad = Number(row.cantidad || 0)
        const valor = cantidad * costo
        valorRetenido += valor
        productosAfectados++
        topProductos.push({ nombre: row.producto_nombre, valor })
      }
    }

    if (productosAfectados === 0) return []

    topProductos.sort((a, b) => b.valor - a.valor)
    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
    const top3 = topProductos.slice(0, 3).map((p) => `${p.nombre} (${fmt(p.valor)})`).join(', ')
    const severidad = valorRetenido > 100000 ? 'critico' as const : 'alerta' as const
    const mensaje = `${fmt(valorRetenido)} en inventario sin movimiento en ${diasMinimos}+ dias. ${productosAfectados} productos afectados. Los principales: ${top3}.`

    return [{
      id: crypto.randomUUID(),
      key: 'capital-retenido',
      tipo: 'inventario',
      severidad,
      titulo: 'Capital retenido en inventario sin movimiento',
      mensaje,
      metrica: { valor: valorRetenido, unidad: '$' },
      accion: { label: 'Ver productos sin movimiento', ruta: '/reportes/productos-sin-movimiento' },
      generado_en: new Date().toISOString(),
    }]
  },
}
