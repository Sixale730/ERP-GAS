import type { InsightRule, InsightItem, InsightContext } from '../types'

interface VentaRow { vendedor_nombre: string | null; total: number }

export const vendedorBajoRendimientoRule: InsightRule = {
  key: 'vendedor-bajo-rendimiento',
  titulo: 'Vendedor bajo rendimiento',
  tipo: 'ventas',
  severidadDefault: 'alerta',
  umbralDefault: 30, // % por debajo del promedio
  requiereAlguno: ['facturas', 'pos'],
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, modulosActivos, umbrales } = ctx
    const umbralPct = umbrales.get('vendedor-bajo-rendimiento') ?? 30

    const hoy = new Date()
    if (hoy.getDate() < 7) return []

    const mesInicio = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const tieneFacturas = modulosActivos.includes('facturas')
    const tienePOS = modulosActivos.includes('pos')

    const vendedorMap = new Map<string, { total: number; ventas: number }>()

    const acumular = (rows: VentaRow[]) => {
      for (const r of rows) {
        const nombre = r.vendedor_nombre || 'Sin vendedor'
        if (nombre === 'Sin vendedor') continue
        const existing = vendedorMap.get(nombre)
        if (existing) {
          existing.total += Number(r.total || 0)
          existing.ventas++
        } else {
          vendedorMap.set(nombre, { total: Number(r.total || 0), ventas: 1 })
        }
      }
    }

    if (tieneFacturas) {
      const { data } = await supabase
        .schema('erp').from('v_facturas')
        .select('vendedor_nombre, total')
        .eq('organizacion_id', orgId).not('status', 'eq', 'cancelada')
        .gte('fecha', mesInicio)
      acumular((data || []) as VentaRow[])
    }

    if (tienePOS) {
      const { data } = await supabase
        .schema('erp').from('ventas_pos')
        .select('vendedor_nombre, total')
        .eq('organizacion_id', orgId).eq('status', 'completada')
        .gte('created_at', `${mesInicio}T00:00:00`)
      acumular((data || []) as VentaRow[])
    }

    // Necesitamos al menos 2 vendedores para comparar
    if (vendedorMap.size < 2) return []

    // Calcular promedio
    let totalGeneral = 0
    vendedorMap.forEach((v) => { totalGeneral += v.total })
    const promedio = totalGeneral / vendedorMap.size
    const limiteInferior = promedio * (1 - umbralPct / 100)

    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
    const insights: InsightItem[] = []

    vendedorMap.forEach((datos, nombre) => {
      if (datos.total < limiteInferior) {
        const pctBajo = Math.round(((promedio - datos.total) / promedio) * 100)

        insights.push({
          id: crypto.randomUUID(),
          key: `vendedor-bajo-${nombre.replace(/\s+/g, '-').toLowerCase().slice(0, 30)}`,
          tipo: 'ventas',
          severidad: 'alerta',
          titulo: `${nombre} bajo rendimiento`,
          mensaje: `${nombre} vendio ${fmt(datos.total)} este mes, ${pctBajo}% por debajo del promedio del equipo (${fmt(promedio)}). ${datos.ventas} ventas realizadas.`,
          metrica: { valor: pctBajo, unidad: '%', tendencia: 'bajando' },
          accion: { label: 'Ver ventas por vendedor', ruta: '/reportes/ventas-vendedor' },
          generado_en: new Date().toISOString(),
        })
      }
    })

    return insights.sort((a, b) => b.metrica.valor - a.metrica.valor).slice(0, 3)
  },
}
