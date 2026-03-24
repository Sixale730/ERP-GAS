import type { InsightRule, InsightItem, InsightContext } from '../types'

export const puntoReordenRule: InsightRule = {
  key: 'punto-reorden',
  titulo: 'Punto de reorden urgente',
  tipo: 'inventario',
  severidadDefault: 'alerta',
  umbralDefault: 1,
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, umbrales } = ctx
    const umbral = umbrales.get('punto-reorden') ?? 1

    const { data, error } = await supabase
      .schema('erp')
      .from('v_inventario_detalle')
      .select('producto_id, sku, producto_nombre, almacen_nombre, cantidad, stock_minimo, stock_maximo, nivel_stock')
      .eq('organizacion_id', orgId)
      .in('nivel_stock', ['bajo', 'sin_stock'])

    const rows = (data || []) as Array<{
      producto_id: string; sku: string; producto_nombre: string; almacen_nombre: string
      cantidad: number; stock_minimo: number; stock_maximo: number; nivel_stock: string
    }>

    if (error || rows.length < umbral) return []

    const sinStock = rows.filter((r) => r.nivel_stock === 'sin_stock')
    const bajoStock = rows.filter((r) => r.nivel_stock === 'bajo')
    const totalAfectados = rows.length

    const cantidadSugerida = rows.reduce((sum, r) => {
      const actual = Number(r.cantidad || 0)
      const maximo = Number(r.stock_maximo || 0)
      return sum + Math.max(0, maximo - actual)
    }, 0)

    const severidad = sinStock.length > 0 ? 'critico' as const : 'alerta' as const

    const partes: string[] = []
    if (sinStock.length > 0) partes.push(`${sinStock.length} sin stock`)
    if (bajoStock.length > 0) partes.push(`${bajoStock.length} por debajo del minimo`)

    const ejemplos = rows
      .sort((a, b) => Number(a.cantidad || 0) - Number(b.cantidad || 0))
      .slice(0, 3)
      .map((r) => `${r.producto_nombre} (${r.cantidad} uds en ${r.almacen_nombre})`)
      .join(', ')

    const mensaje = `${totalAfectados} productos necesitan reabastecimiento: ${partes.join(', ')}. Ejemplos: ${ejemplos}. Sugerencia de compra: ${cantidadSugerida} unidades totales.`

    return [{
      id: crypto.randomUUID(),
      key: 'punto-reorden',
      tipo: 'inventario',
      severidad,
      titulo: 'Punto de reorden urgente',
      mensaje,
      metrica: { valor: totalAfectados, unidad: 'productos' },
      accion: { label: 'Ver reporte punto de reorden', ruta: '/reportes/punto-reorden' },
      generado_en: new Date().toISOString(),
    }]
  },
}
