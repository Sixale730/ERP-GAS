import type { InsightRule, InsightItem, InsightContext } from '../types'

interface CatRow { id: string; nombre: string }
interface ProdRow { id: string; categoria_id: string | null }
interface ItemRow { producto_id: string; subtotal: number }

export const categoriaDeclineRule: InsightRule = {
  key: 'categoria-declive',
  titulo: 'Categoria en declive',
  tipo: 'ventas',
  severidadDefault: 'alerta',
  umbralDefault: 15, // % de caída
  requiereAlguno: ['facturas', 'pos'],
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, modulosActivos, umbrales } = ctx
    const umbralPct = umbrales.get('categoria-declive') ?? 15

    const hoy = new Date()
    if (hoy.getDate() < 7) return []

    const mesActualInicio = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const mesAnteriorInicio = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}-01`

    // Categorías
    const { data: catData } = await supabase
      .schema('erp').from('categorias').select('id, nombre').eq('organizacion_id', orgId)
    const categorias = (catData || []) as CatRow[]
    if (categorias.length === 0) return []

    const catMap = new Map(categorias.map((c) => [c.id, c.nombre]))

    // Productos → categoría
    const { data: prodData } = await supabase
      .schema('erp').from('productos').select('id, categoria_id')
      .eq('organizacion_id', orgId).eq('is_active', true)
    const prodCatMap = new Map(((prodData || []) as ProdRow[]).map((p) => [p.id, p.categoria_id]))

    const tieneFacturas = modulosActivos.includes('facturas')
    const tienePOS = modulosActivos.includes('pos')

    const mesActualCat = new Map<string, number>()
    const mesAnteriorCat = new Map<string, number>()

    const acumularItems = (map: Map<string, number>, items: ItemRow[]) => {
      for (const it of items) {
        if (!it.producto_id) continue
        const catId = prodCatMap.get(it.producto_id)
        if (!catId) continue
        map.set(catId, (map.get(catId) || 0) + Number(it.subtotal || 0))
      }
    }

    // Facturas
    if (tieneFacturas) {
      // Mes actual
      const { data: factActual } = await supabase.schema('erp').from('facturas').select('id')
        .eq('organizacion_id', orgId).not('status', 'eq', 'cancelada').gte('fecha', mesActualInicio)
      const idsActual = ((factActual || []) as { id: string }[]).map((f) => f.id)
      if (idsActual.length > 0) {
        const { data: items } = await supabase.schema('erp').from('factura_items')
          .select('producto_id, subtotal').in('factura_id', idsActual)
        acumularItems(mesActualCat, (items || []) as ItemRow[])
      }

      // Mes anterior
      const { data: factAnt } = await supabase.schema('erp').from('facturas').select('id')
        .eq('organizacion_id', orgId).not('status', 'eq', 'cancelada')
        .gte('fecha', mesAnteriorInicio).lt('fecha', mesActualInicio)
      const idsAnt = ((factAnt || []) as { id: string }[]).map((f) => f.id)
      if (idsAnt.length > 0) {
        const { data: items } = await supabase.schema('erp').from('factura_items')
          .select('producto_id, subtotal').in('factura_id', idsAnt)
        acumularItems(mesAnteriorCat, (items || []) as ItemRow[])
      }
    }

    // POS
    if (tienePOS) {
      const { data: posActual } = await supabase.schema('erp').from('ventas_pos').select('id')
        .eq('organizacion_id', orgId).eq('status', 'completada').gte('created_at', `${mesActualInicio}T00:00:00`)
      const idsActual = ((posActual || []) as { id: string }[]).map((v) => v.id)
      if (idsActual.length > 0) {
        const { data: items } = await supabase.schema('erp').from('venta_pos_items')
          .select('producto_id, subtotal').in('venta_pos_id', idsActual)
        acumularItems(mesActualCat, (items || []) as ItemRow[])
      }

      const { data: posAnt } = await supabase.schema('erp').from('ventas_pos').select('id')
        .eq('organizacion_id', orgId).eq('status', 'completada')
        .gte('created_at', `${mesAnteriorInicio}T00:00:00`).lt('created_at', `${mesActualInicio}T00:00:00`)
      const idsAnt = ((posAnt || []) as { id: string }[]).map((v) => v.id)
      if (idsAnt.length > 0) {
        const { data: items } = await supabase.schema('erp').from('venta_pos_items')
          .select('producto_id, subtotal').in('venta_pos_id', idsAnt)
        acumularItems(mesAnteriorCat, (items || []) as ItemRow[])
      }
    }

    // Comparar
    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
    const insights: InsightItem[] = []

    mesAnteriorCat.forEach((totalAnt, catId) => {
      if (totalAnt <= 0) return
      const totalAct = mesActualCat.get(catId) ?? 0
      const caida = ((totalAnt - totalAct) / totalAnt) * 100

      if (caida >= umbralPct) {
        const nombre = catMap.get(catId) || 'Sin categoria'
        const severidad = caida > 30 ? 'critico' as const : 'alerta' as const

        insights.push({
          id: crypto.randomUUID(),
          key: `categoria-declive-${catId}`,
          tipo: 'ventas',
          severidad,
          titulo: `${nombre} en declive`,
          mensaje: `Las ventas de ${nombre} cayeron ${Math.round(caida)}% respecto al mes anterior (${fmt(totalAnt)} → ${fmt(totalAct)}).`,
          metrica: { valor: Math.round(caida), unidad: '%', tendencia: 'bajando' },
          accion: { label: 'Ver ventas por categoria', ruta: '/reportes/ventas-categoria' },
          generado_en: new Date().toISOString(),
        })
      }
    })

    return insights.sort((a, b) => b.metrica.valor - a.metrica.valor).slice(0, 3)
  },
}
