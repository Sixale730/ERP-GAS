import type { InsightRule, InsightItem, InsightContext } from '../types'

interface PagoRow { fecha: string; monto: number }
interface OCRow { fecha: string; total: number }

export const flujoEfectivoRiesgoRule: InsightRule = {
  key: 'flujo-efectivo-riesgo',
  titulo: 'Flujo de efectivo en riesgo',
  tipo: 'finanzas',
  severidadDefault: 'alerta',
  umbralDefault: 50000, // MXN negativo para critico
  requiereModulo: 'facturas',
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, umbrales } = ctx
    const umbralCritico = umbrales.get('flujo-efectivo-riesgo') ?? 50000

    const hoy = new Date()
    const mesInicio = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`

    // Ingresos: pagos recibidos este mes
    const { data: pagosData } = await supabase
      .schema('erp').from('pagos').select('fecha, monto')
      .eq('organizacion_id', orgId).gte('fecha', mesInicio)

    const ingresos = ((pagosData || []) as PagoRow[]).reduce((s, p) => s + Number(p.monto || 0), 0)

    // Egresos: ordenes de compra recibidas este mes
    const { data: ocData } = await supabase
      .schema('erp').from('ordenes_compra').select('fecha, total')
      .eq('organizacion_id', orgId)
      .in('status', ['recibida', 'parcialmente_recibida'])
      .gte('fecha', mesInicio)

    const egresos = ((ocData || []) as OCRow[]).reduce((s, o) => s + Number(o.total || 0), 0)

    const neto = ingresos - egresos

    // Solo alertar si el flujo es negativo
    if (neto >= 0) return []

    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
    const netoAbs = Math.abs(neto)
    const severidad = netoAbs > umbralCritico ? 'critico' as const : 'alerta' as const

    const mensaje = `Flujo de efectivo negativo este mes: ${fmt(neto)}. Ingresos: ${fmt(ingresos)}, Egresos: ${fmt(egresos)}. Los egresos superan los ingresos en ${fmt(netoAbs)}.`

    return [{
      id: crypto.randomUUID(),
      key: 'flujo-efectivo-riesgo',
      tipo: 'finanzas',
      severidad,
      titulo: 'Flujo de efectivo negativo',
      mensaje,
      metrica: { valor: netoAbs, unidad: '$', tendencia: 'bajando' },
      accion: { label: 'Ver flujo de efectivo', ruta: '/reportes/flujo-efectivo' },
      generado_en: new Date().toISOString(),
    }]
  },
}
