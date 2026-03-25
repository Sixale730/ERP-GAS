import type { InsightRule, InsightItem, InsightContext } from '../types'

interface StockRow { id: string; sku: string; nombre: string; stock_total: number }
interface ProdRow { id: string; categoria_id: string | null }
interface MovRow { producto_id: string; cantidad: number }

export const rotacionAnormalRule: InsightRule = {
  key: 'rotacion-anormal',
  titulo: 'Rotacion anormal de inventario',
  tipo: 'inventario',
  severidadDefault: 'alerta',
  umbralDefault: 50, // % peor que promedio categoría
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, umbrales } = ctx
    const umbralPct = umbrales.get('rotacion-anormal') ?? 50

    // Stock actual
    const { data: stockData } = await supabase
      .schema('erp').from('v_productos_stock').select('id, sku, nombre, stock_total')
      .eq('organizacion_id', orgId).gt('stock_total', 0)

    const productos = (stockData || []) as StockRow[]
    if (productos.length === 0) return []

    // Categoría por producto
    const prodIds = productos.map((p) => p.id)
    const { data: prodData } = await supabase
      .schema('erp').from('productos').select('id, categoria_id')
      .in('id', prodIds)

    const prodCatMap = new Map(((prodData || []) as ProdRow[]).map((p) => [p.id, p.categoria_id]))

    // Salidas últimos 90 días
    const hace90 = new Date()
    hace90.setDate(hace90.getDate() - 90)
    const { data: movData } = await supabase
      .schema('erp').from('v_movimientos').select('producto_id, cantidad')
      .eq('organizacion_id', orgId).eq('tipo', 'salida')
      .gte('fecha', hace90.toISOString().split('T')[0])

    const salidasMap = new Map<string, number>()
    for (const m of (movData || []) as MovRow[]) {
      salidasMap.set(m.producto_id, (salidasMap.get(m.producto_id) || 0) + Number(m.cantidad || 0))
    }

    // Calcular rotación por producto y promediar por categoría
    const rotacionProd = new Map<string, number>() // producto_id → rotacion
    const catRotaciones = new Map<string, number[]>() // categoria_id → [rotaciones]

    for (const p of productos) {
      const salidas = salidasMap.get(p.id) || 0
      const rot = salidas / p.stock_total
      rotacionProd.set(p.id, rot)

      const catId = prodCatMap.get(p.id)
      if (catId) {
        const arr = catRotaciones.get(catId) || []
        arr.push(rot)
        catRotaciones.set(catId, arr)
      }
    }

    // Promedio por categoría
    const catPromedio = new Map<string, number>()
    catRotaciones.forEach((rotaciones, catId) => {
      const avg = rotaciones.reduce((s, r) => s + r, 0) / rotaciones.length
      catPromedio.set(catId, avg)
    })

    // Detectar anormales
    const anormales: { sku: string; nombre: string; rot: number; catAvg: number; desvPct: number }[] = []

    for (const p of productos) {
      const catId = prodCatMap.get(p.id)
      if (!catId) continue
      const avg = catPromedio.get(catId)
      if (!avg || avg <= 0) continue

      const rot = rotacionProd.get(p.id) || 0
      const desv = ((avg - rot) / avg) * 100

      if (desv >= umbralPct) {
        anormales.push({ sku: p.sku, nombre: p.nombre, rot: Math.round(rot * 100) / 100, catAvg: Math.round(avg * 100) / 100, desvPct: Math.round(desv) })
      }
    }

    if (anormales.length === 0) return []

    anormales.sort((a, b) => b.desvPct - a.desvPct)
    const top3 = anormales.slice(0, 3)
      .map((p) => `${p.nombre} (rot ${p.rot}x vs categoria ${p.catAvg}x)`)
      .join(', ')

    const mensaje = `${anormales.length} productos con rotacion ${umbralPct}%+ peor que su categoria. Principales: ${top3}.`

    return [{
      id: crypto.randomUUID(),
      key: 'rotacion-anormal',
      tipo: 'inventario',
      severidad: 'alerta',
      titulo: 'Rotacion anormal de inventario',
      mensaje,
      metrica: { valor: anormales.length, unidad: 'productos' },
      accion: { label: 'Ver rotacion inventario', ruta: '/reportes/rotacion-inventario' },
      generado_en: new Date().toISOString(),
    }]
  },
}
