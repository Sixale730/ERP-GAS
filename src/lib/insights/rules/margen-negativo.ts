import type { InsightRule, InsightItem, InsightContext } from '../types'

interface MargenRow {
  id: string; sku: string; nombre: string
  costo_promedio: number; precio_venta: number
  margen_bruto: number; margen_porcentaje: number | null
}

export const margenNegativoRule: InsightRule = {
  key: 'margen-negativo',
  titulo: 'Productos con margen negativo',
  tipo: 'finanzas',
  severidadDefault: 'critico',
  umbralDefault: 0, // margen % umbral
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId } = ctx

    const { data, error } = await supabase
      .schema('erp')
      .from('v_margen_utilidad')
      .select('id, sku, nombre, costo_promedio, precio_venta, margen_bruto, margen_porcentaje')
      .eq('organizacion_id', orgId)

    const rows = (data || []) as MargenRow[]
    if (error || rows.length === 0) return []

    // Filtrar productos con margen negativo
    const negativos = rows.filter((r) => {
      const margen = Number(r.margen_porcentaje ?? r.margen_bruto ?? 0)
      return margen < 0
    })

    if (negativos.length === 0) return []

    // Ordenar por peor margen
    negativos.sort((a, b) => Number(a.margen_porcentaje || 0) - Number(b.margen_porcentaje || 0))

    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(v)

    const top3 = negativos.slice(0, 3).map((p) => {
      const pct = Number(p.margen_porcentaje || 0).toFixed(1)
      return `${p.nombre} (${pct}%, costo ${fmt(Number(p.costo_promedio || 0))} vs precio ${fmt(Number(p.precio_venta || 0))})`
    }).join(', ')

    // Calcular pérdida estimada mensual (simplificada)
    const perdidaTotal = negativos.reduce((sum, p) => sum + Math.abs(Number(p.margen_bruto || 0)), 0)

    const mensaje = `${negativos.length} productos se venden por debajo del costo. Perdida estimada por unidad vendida: ${fmt(perdidaTotal)}. Los peores: ${top3}.`

    return [{
      id: crypto.randomUUID(),
      key: 'margen-negativo',
      tipo: 'finanzas',
      severidad: 'critico',
      titulo: 'Productos con margen negativo',
      mensaje,
      metrica: { valor: negativos.length, unidad: 'productos' },
      accion: { label: 'Ver margen de utilidad', ruta: '/reportes/margen-utilidad' },
      generado_en: new Date().toISOString(),
    }]
  },
}
