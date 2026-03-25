import type { InsightRule, InsightItem, InsightContext } from '../types'

interface PosRow { created_at: string; total: number }

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

export const horariosOportunidadPosRule: InsightRule = {
  key: 'horarios-oportunidad',
  titulo: 'Oportunidad en horarios POS',
  tipo: 'pos',
  severidadDefault: 'oportunidad',
  umbralDefault: 30, // % menos que promedio
  requiereModulo: 'pos',
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, umbrales } = ctx
    const umbralPct = umbrales.get('horarios-oportunidad') ?? 30

    // Ventas de los últimos 30 días
    const hace30 = new Date()
    hace30.setDate(hace30.getDate() - 30)

    const { data } = await supabase
      .schema('erp').from('ventas_pos').select('created_at, total')
      .eq('organizacion_id', orgId).eq('status', 'completada')
      .gte('created_at', hace30.toISOString())

    const ventas = (data || []) as PosRow[]
    if (ventas.length < 20) return [] // necesitamos datos suficientes

    // Agrupar por día de semana
    const porDia = new Map<number, { total: number; count: number; dias: Set<string> }>()

    for (const v of ventas) {
      const fecha = new Date(v.created_at)
      const dia = fecha.getDay() // 0-6
      const fechaStr = fecha.toISOString().split('T')[0]

      const entry = porDia.get(dia) || { total: 0, count: 0, dias: new Set<string>() }
      entry.total += Number(v.total || 0)
      entry.count++
      entry.dias.add(fechaStr)
      porDia.set(dia, entry)
    }

    // Calcular promedio diario por día de semana
    const promediosPorDia = new Map<number, number>()
    let totalGeneral = 0
    let numDiasUnicos = 0

    porDia.forEach((entry, dia) => {
      const numDiasTipo = entry.dias.size // cuántos martes hubo, etc.
      if (numDiasTipo > 0) {
        promediosPorDia.set(dia, entry.total / numDiasTipo)
        totalGeneral += entry.total
        numDiasUnicos += numDiasTipo
      }
    })

    if (numDiasUnicos === 0) return []
    const promedioGeneral = totalGeneral / numDiasUnicos
    const limiteInferior = promedioGeneral * (1 - umbralPct / 100)

    // Detectar días débiles
    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
    const diasDebiles: { dia: string; promedio: number; pctMenos: number }[] = []

    promediosPorDia.forEach((promDia, diaNum) => {
      if (promDia < limiteInferior) {
        const pct = Math.round(((promedioGeneral - promDia) / promedioGeneral) * 100)
        diasDebiles.push({ dia: DIAS_SEMANA[diaNum], promedio: promDia, pctMenos: pct })
      }
    })

    if (diasDebiles.length === 0) return []

    diasDebiles.sort((a, b) => b.pctMenos - a.pctMenos)
    const diasDesc = diasDebiles
      .map((d) => `${d.dia} (${d.pctMenos}% menos, ${fmt(d.promedio)}/dia)`)
      .join(', ')

    const mensaje = `${diasDebiles.length} dias de la semana tienen ${umbralPct}%+ menos ventas que el promedio (${fmt(promedioGeneral)}/dia): ${diasDesc}. Considere promociones en estos dias.`

    return [{
      id: crypto.randomUUID(),
      key: 'horarios-oportunidad',
      tipo: 'pos',
      severidad: 'oportunidad',
      titulo: 'Oportunidad en dias de baja venta',
      mensaje,
      metrica: { valor: diasDebiles.length, unidad: 'dias' },
      accion: { label: 'Ver analisis de horarios', ruta: '/reportes/analisis-horarios' },
      generado_en: new Date().toISOString(),
    }]
  },
}
