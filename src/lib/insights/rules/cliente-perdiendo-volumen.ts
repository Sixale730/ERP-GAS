import type { InsightRule, InsightItem, InsightContext } from '../types'

interface VentaRow { cliente_id: string | null; cliente_nombre: string | null; total: number }

export const clientePerdiendoVolumenRule: InsightRule = {
  key: 'cliente-perdiendo-volumen',
  titulo: 'Cliente perdiendo volumen',
  tipo: 'ventas',
  severidadDefault: 'alerta',
  umbralDefault: 25,
  requiereAlguno: ['facturas', 'pos'],
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, modulosActivos, umbrales } = ctx
    const umbralPct = umbrales.get('cliente-perdiendo-volumen') ?? 25

    const hoy = new Date()
    if (hoy.getDate() < 7) return []

    const mesActualInicio = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const mesAnteriorInicio = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}-01`

    const tieneFacturas = modulosActivos.includes('facturas')
    const tienePOS = modulosActivos.includes('pos')

    const mesActualMap = new Map<string, { nombre: string; total: number }>()
    const mesAnteriorMap = new Map<string, { nombre: string; total: number }>()

    const acumular = (map: Map<string, { nombre: string; total: number }>, rows: VentaRow[]) => {
      for (const r of rows) {
        const key = r.cliente_id || 'sin-cliente'
        const nombre = r.cliente_nombre || 'Sin cliente'
        const existing = map.get(key)
        if (existing) existing.total += Number(r.total || 0)
        else map.set(key, { nombre, total: Number(r.total || 0) })
      }
    }

    if (tieneFacturas) {
      const { data: factActual } = await supabase
        .schema('erp').from('v_facturas')
        .select('cliente_id, cliente_nombre, total')
        .eq('organizacion_id', orgId).not('status', 'eq', 'cancelada')
        .gte('fecha', mesActualInicio)
      acumular(mesActualMap, (factActual || []) as VentaRow[])

      const { data: factAnterior } = await supabase
        .schema('erp').from('v_facturas')
        .select('cliente_id, cliente_nombre, total')
        .eq('organizacion_id', orgId).not('status', 'eq', 'cancelada')
        .gte('fecha', mesAnteriorInicio).lt('fecha', mesActualInicio)
      acumular(mesAnteriorMap, (factAnterior || []) as VentaRow[])
    }

    if (tienePOS) {
      const { data: posActual } = await supabase
        .schema('erp').from('ventas_pos')
        .select('cliente_id, cliente_nombre, total')
        .eq('organizacion_id', orgId).eq('status', 'completada')
        .gte('created_at', `${mesActualInicio}T00:00:00`)
      acumular(mesActualMap, (posActual || []) as VentaRow[])

      const { data: posAnterior } = await supabase
        .schema('erp').from('ventas_pos')
        .select('cliente_id, cliente_nombre, total')
        .eq('organizacion_id', orgId).eq('status', 'completada')
        .gte('created_at', `${mesAnteriorInicio}T00:00:00`)
        .lt('created_at', `${mesActualInicio}T00:00:00`)
      acumular(mesAnteriorMap, (posAnterior || []) as VentaRow[])
    }

    const insights: InsightItem[] = []
    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)

    mesAnteriorMap.forEach((anterior, clienteId) => {
      if (clienteId === 'sin-cliente') return
      const actual = mesActualMap.get(clienteId)
      const totalActual = actual?.total ?? 0
      const totalAnterior = anterior.total
      if (totalAnterior <= 0) return

      const caida = ((totalAnterior - totalActual) / totalAnterior) * 100
      if (caida >= umbralPct) {
        insights.push({
          id: crypto.randomUUID(),
          key: `cliente-volumen-${clienteId}`,
          tipo: 'ventas',
          severidad: 'alerta',
          titulo: `${anterior.nombre} comprando menos`,
          mensaje: `${anterior.nombre} compro ${Math.round(caida)}% menos este mes (${fmt(totalAnterior)} → ${fmt(totalActual)}). Revisar si requiere seguimiento comercial.`,
          metrica: { valor: Math.round(caida), unidad: '%', tendencia: 'bajando' },
          accion: { label: 'Ver ventas por cliente', ruta: '/reportes/ventas-cliente' },
          entidades: { cliente_id: clienteId },
          generado_en: new Date().toISOString(),
        })
      }
    })

    return insights.sort((a, b) => b.metrica.valor - a.metrica.valor).slice(0, 5)
  },
}
