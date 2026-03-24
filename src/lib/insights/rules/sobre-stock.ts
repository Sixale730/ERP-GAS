import type { InsightRule, InsightItem, InsightContext } from '../types'

interface StockRow { id: string; sku: string; nombre: string; stock_total: number }
interface MovRow { producto_id: string; cantidad: number }

export const sobreStockRule: InsightRule = {
  key: 'sobre-stock',
  titulo: 'Productos con exceso de inventario',
  tipo: 'inventario',
  severidadDefault: 'alerta',
  umbralDefault: 8, // meses de supply
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, umbrales } = ctx
    const mesesUmbral = umbrales.get('sobre-stock') ?? 8

    // Stock actual por producto
    const { data: stockData } = await supabase
      .schema('erp')
      .from('v_productos_stock')
      .select('id, sku, nombre, stock_total')
      .eq('organizacion_id', orgId)
      .gt('stock_total', 0)

    const productos = (stockData || []) as StockRow[]
    if (productos.length === 0) return []

    // Salidas en últimos 90 días
    const hace90Dias = new Date()
    hace90Dias.setDate(hace90Dias.getDate() - 90)
    const fechaDesde = hace90Dias.toISOString().split('T')[0]

    const { data: movData } = await supabase
      .schema('erp')
      .from('v_movimientos')
      .select('producto_id, cantidad')
      .eq('organizacion_id', orgId)
      .eq('tipo', 'salida')
      .gte('fecha', fechaDesde)

    // Agrupar salidas por producto
    const salidasMap = new Map<string, number>()
    for (const m of (movData || []) as MovRow[]) {
      salidasMap.set(m.producto_id, (salidasMap.get(m.producto_id) || 0) + Number(m.cantidad || 0))
    }

    // Calcular meses de inventario
    const sobrestock: { sku: string; nombre: string; stock: number; meses: number }[] = []

    for (const p of productos) {
      const salidas90d = salidasMap.get(p.id) || 0
      const salidasMes = salidas90d / 3 // promedio mensual
      const mesesInv = salidasMes > 0 ? p.stock_total / salidasMes : 999

      if (mesesInv >= mesesUmbral) {
        sobrestock.push({ sku: p.sku, nombre: p.nombre, stock: p.stock_total, meses: Math.round(mesesInv) })
      }
    }

    if (sobrestock.length === 0) return []

    sobrestock.sort((a, b) => b.meses - a.meses)
    const tieneCriticos = sobrestock.some((p) => p.meses > 12)
    const severidad = tieneCriticos ? 'critico' as const : 'alerta' as const

    const top3 = sobrestock.slice(0, 3)
      .map((p) => `${p.nombre} (${p.stock} uds, ${p.meses === 999 ? 'sin ventas' : p.meses + ' meses'})`)
      .join(', ')

    const mensaje = `${sobrestock.length} productos con inventario para ${mesesUmbral}+ meses al ritmo actual de ventas. Considere promociones o ajustar compras. Principales: ${top3}.`

    return [{
      id: crypto.randomUUID(),
      key: 'sobre-stock',
      tipo: 'inventario',
      severidad,
      titulo: 'Exceso de inventario',
      mensaje,
      metrica: { valor: sobrestock.length, unidad: 'productos' },
      accion: { label: 'Ver rotacion de inventario', ruta: '/reportes/rotacion-inventario' },
      generado_en: new Date().toISOString(),
    }]
  },
}
