import type { InsightRule, InsightItem, InsightContext } from '../types'

interface CotRow { id: string; folio: string; fecha: string; total: number; cliente_id: string | null }

export const cotizacionesEstancadasRule: InsightRule = {
  key: 'cotizaciones-estancadas',
  titulo: 'Cotizaciones estancadas',
  tipo: 'ventas',
  severidadDefault: 'alerta',
  umbralDefault: 30,
  requiereModulo: 'cotizaciones',
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, umbrales } = ctx
    const diasUmbral = umbrales.get('cotizaciones-estancadas') ?? 30

    const { data, error } = await supabase
      .schema('erp')
      .from('cotizaciones')
      .select('id, folio, fecha, total, cliente_id')
      .eq('organizacion_id', orgId)
      .eq('status', 'propuesta')

    const rows = (data || []) as CotRow[]
    if (error || rows.length === 0) return []

    const hoy = new Date()
    const estancadas = rows.filter((c) => {
      const dias = Math.ceil((hoy.getTime() - new Date(c.fecha).getTime()) / (1000 * 60 * 60 * 24))
      return dias >= diasUmbral
    })

    if (estancadas.length === 0) return []

    const valorTotal = estancadas.reduce((sum, c) => sum + Number(c.total || 0), 0)
    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
    const severidad = estancadas.length >= 5 ? 'critico' as const : 'alerta' as const

    const ejemplos = estancadas
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      .slice(0, 3)
      .map((c) => {
        const dias = Math.ceil((hoy.getTime() - new Date(c.fecha).getTime()) / (1000 * 60 * 60 * 24))
        return `${c.folio} (${dias} dias)`
      })
      .join(', ')

    const mensaje = `${estancadas.length} cotizaciones con mas de ${diasUmbral} dias sin convertir. Valor total: ${fmt(valorTotal)}. Las mas antiguas: ${ejemplos}.`

    return [{
      id: crypto.randomUUID(),
      key: 'cotizaciones-estancadas',
      tipo: 'ventas',
      severidad,
      titulo: 'Cotizaciones estancadas',
      mensaje,
      metrica: { valor: estancadas.length, unidad: 'cotizaciones' },
      accion: { label: 'Ver cotizaciones pendientes', ruta: '/cotizaciones' },
      generado_en: new Date().toISOString(),
    }]
  },
}
