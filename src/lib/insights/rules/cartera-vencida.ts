import type { InsightRule, InsightItem, InsightContext } from '../types'

interface FactRow {
  id: string; folio: string; cliente_nombre: string | null; cliente_id: string | null
  saldo: number; dias_vencida: number
}

export const carteraVencidaRule: InsightRule = {
  key: 'cartera-vencida',
  titulo: 'Cartera vencida',
  tipo: 'cobranza',
  severidadDefault: 'alerta',
  umbralDefault: 50000,
  requiereModulo: 'facturas',
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, umbrales, cache } = ctx
    const umbralCritico = umbrales.get('cartera-vencida') ?? 50000

    // Usar cache compartido si disponible, sino query directa
    let rows: FactRow[]
    if (cache?.facturas90d) {
      rows = cache.facturas90d
        .filter(f => f.status === 'pendiente' || f.status === 'parcial')
        .map(f => ({ id: f.id, folio: '', cliente_nombre: f.cliente_nombre, cliente_id: f.cliente_id, saldo: Number(f.saldo), dias_vencida: Number(f.dias_vencida) }))
    } else {
      const { data, error } = await supabase
        .schema('erp')
        .from('v_facturas')
        .select('id, folio, cliente_nombre, cliente_id, saldo, dias_vencida')
        .eq('organizacion_id', orgId)
        .in('status', ['pendiente', 'parcial'])
      if (error) return []
      rows = (data || []) as FactRow[]
    }

    if (rows.length === 0) return []

    const vencidas = rows.filter((f) => {
      const saldo = Number(f.saldo || 0)
      const diasVencida = Number(f.dias_vencida || 0)
      return saldo > 0 && diasVencida > 0
    })

    if (vencidas.length === 0) return []

    const totalVencido = vencidas.reduce((sum, f) => sum + Number(f.saldo || 0), 0)

    const porCliente = new Map<string, { nombre: string; saldo: number }>()
    for (const f of vencidas) {
      const key = f.cliente_id || f.cliente_nombre || 'desconocido'
      const existing = porCliente.get(key)
      if (existing) existing.saldo += Number(f.saldo || 0)
      else porCliente.set(key, { nombre: f.cliente_nombre || 'Sin cliente', saldo: Number(f.saldo || 0) })
    }

    const topClientes = Array.from(porCliente.values()).sort((a, b) => b.saldo - a.saldo).slice(0, 3)
    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
    const clientesDesc = topClientes.map((c) => `${c.nombre} (${fmt(c.saldo)})`).join(', ')
    const maxDias = Math.max(...vencidas.map((f) => Number(f.dias_vencida || 0)))
    const severidad = totalVencido > umbralCritico ? 'critico' as const : 'alerta' as const

    const mensaje = `${vencidas.length} facturas vencidas por ${fmt(totalVencido)}. La mas antigua tiene ${maxDias} dias de atraso. Principales: ${clientesDesc}.`

    return [{
      id: crypto.randomUUID(),
      key: 'cartera-vencida',
      tipo: 'cobranza',
      severidad,
      titulo: 'Cartera vencida',
      mensaje,
      metrica: { valor: totalVencido, unidad: '$' },
      accion: { label: 'Ver cartera vencida', ruta: '/reportes/cartera-vencida' },
      generado_en: new Date().toISOString(),
    }]
  },
}
