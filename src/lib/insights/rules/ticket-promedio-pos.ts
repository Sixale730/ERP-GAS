import type { InsightRule, InsightItem, InsightContext } from '../types'

interface PosRow { total: number; created_at: string }

export const ticketPromedioPosRule: InsightRule = {
  key: 'ticket-pos-bajando',
  titulo: 'Ticket promedio POS bajando',
  tipo: 'pos',
  severidadDefault: 'info',
  umbralDefault: 10, // % de caída semana vs semana
  requiereModulo: 'pos',
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, umbrales } = ctx
    const umbralPct = umbrales.get('ticket-pos-bajando') ?? 10

    const hoy = new Date()
    const diaSemana = hoy.getDay() // 0=domingo
    // Solo generar si la semana actual tiene ≥3 días
    const diasDeSemana = diaSemana === 0 ? 7 : diaSemana
    if (diasDeSemana < 3) return []

    // Semana actual: desde el lunes pasado
    const lunesActual = new Date(hoy)
    lunesActual.setDate(hoy.getDate() - (diasDeSemana - 1))
    lunesActual.setHours(0, 0, 0, 0)

    // Semana anterior: lunes a domingo
    const lunesAnterior = new Date(lunesActual)
    lunesAnterior.setDate(lunesActual.getDate() - 7)
    const domingoAnterior = new Date(lunesActual)
    domingoAnterior.setDate(lunesActual.getDate() - 1)
    domingoAnterior.setHours(23, 59, 59, 999)

    const fechaActualDesde = lunesActual.toISOString()
    const fechaAntDesde = lunesAnterior.toISOString()
    const fechaAntHasta = domingoAnterior.toISOString()

    // Ventas semana actual
    const { data: dataActual } = await supabase
      .schema('erp').from('ventas_pos').select('total, created_at')
      .eq('organizacion_id', orgId).eq('status', 'completada')
      .gte('created_at', fechaActualDesde)

    const ventasActuales = (dataActual || []) as PosRow[]

    // Ventas semana anterior
    const { data: dataAnterior } = await supabase
      .schema('erp').from('ventas_pos').select('total, created_at')
      .eq('organizacion_id', orgId).eq('status', 'completada')
      .gte('created_at', fechaAntDesde).lte('created_at', fechaAntHasta)

    const ventasAnteriores = (dataAnterior || []) as PosRow[]

    if (ventasAnteriores.length === 0 || ventasActuales.length === 0) return []

    const totalActual = ventasActuales.reduce((s, v) => s + Number(v.total || 0), 0)
    const totalAnterior = ventasAnteriores.reduce((s, v) => s + Number(v.total || 0), 0)

    const ticketActual = totalActual / ventasActuales.length
    const ticketAnterior = totalAnterior / ventasAnteriores.length

    if (ticketAnterior <= 0) return []

    const caida = ((ticketAnterior - ticketActual) / ticketAnterior) * 100
    if (caida < umbralPct) return []

    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
    const severidad = caida > 20 ? 'alerta' as const : 'info' as const

    const mensaje = `El ticket promedio bajo de ${fmt(ticketAnterior)} a ${fmt(ticketActual)} (-${Math.round(caida)}%) esta semana vs la anterior. ${ventasActuales.length} ventas esta semana vs ${ventasAnteriores.length} la semana pasada.`

    return [{
      id: crypto.randomUUID(),
      key: 'ticket-pos-bajando',
      tipo: 'pos',
      severidad,
      titulo: 'Ticket promedio POS bajando',
      mensaje,
      metrica: { valor: Math.round(caida), unidad: '%', tendencia: 'bajando' },
      accion: { label: 'Ver ventas POS', ruta: '/reportes/ventas-pos' },
      generado_en: new Date().toISOString(),
    }]
  },
}
