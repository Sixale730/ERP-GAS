import type { InsightRule, InsightItem, InsightContext } from '../types'

interface VentaRow { cliente_id: string | null; cliente_nombre: string | null; total: number }

function clasificarABC(acumulado: number): 'A' | 'B' | 'C' {
  if (acumulado <= 80) return 'A'
  if (acumulado <= 95) return 'B'
  return 'C'
}

function calcularABCClientes(agrupado: Map<string, { nombre: string; total: number }>): Map<string, { nombre: string; clase: 'A' | 'B' | 'C' }> {
  const sorted = Array.from(agrupado.entries()).sort((a, b) => b[1].total - a[1].total)
  const totalGen = sorted.reduce((s, [, v]) => s + v.total, 0)
  if (totalGen <= 0) return new Map()

  let acum = 0
  const result = new Map<string, { nombre: string; clase: 'A' | 'B' | 'C' }>()
  for (const [id, val] of sorted) {
    acum += (val.total / totalGen) * 100
    result.set(id, { nombre: val.nombre, clase: clasificarABC(acum) })
  }
  return result
}

export const abcClienteDegradandoseRule: InsightRule = {
  key: 'abc-cliente-degradandose',
  titulo: 'Cliente ABC degradandose',
  tipo: 'ventas',
  severidadDefault: 'alerta',
  umbralDefault: 0,
  requiereAlguno: ['facturas', 'pos'],
  evaluar: async (ctx: InsightContext): Promise<InsightItem[]> => {
    const { supabase, orgId, modulosActivos } = ctx

    const hoy = new Date()
    if (hoy.getDate() < 7) return []

    const mesActualInicio = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const mesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const mesAnteriorInicio = `${mesAnt.getFullYear()}-${String(mesAnt.getMonth() + 1).padStart(2, '0')}-01`

    const tieneFacturas = modulosActivos.includes('facturas')
    const tienePOS = modulosActivos.includes('pos')

    const actualMap = new Map<string, { nombre: string; total: number }>()
    const anteriorMap = new Map<string, { nombre: string; total: number }>()

    const acumular = (map: Map<string, { nombre: string; total: number }>, rows: VentaRow[]) => {
      for (const r of rows) {
        const key = r.cliente_id || 'sin-cliente'
        if (key === 'sin-cliente') continue
        const nombre = r.cliente_nombre || 'Sin cliente'
        const ex = map.get(key)
        if (ex) ex.total += Number(r.total || 0)
        else map.set(key, { nombre, total: Number(r.total || 0) })
      }
    }

    if (tieneFacturas) {
      const { data: fAct } = await supabase.schema('erp').from('v_facturas')
        .select('cliente_id, cliente_nombre, total')
        .eq('organizacion_id', orgId).not('status', 'eq', 'cancelada').gte('fecha', mesActualInicio)
      acumular(actualMap, (fAct || []) as VentaRow[])

      const { data: fPrev } = await supabase.schema('erp').from('v_facturas')
        .select('cliente_id, cliente_nombre, total')
        .eq('organizacion_id', orgId).not('status', 'eq', 'cancelada')
        .gte('fecha', mesAnteriorInicio).lt('fecha', mesActualInicio)
      acumular(anteriorMap, (fPrev || []) as VentaRow[])
    }

    if (tienePOS) {
      const { data: pAct } = await supabase.schema('erp').from('ventas_pos')
        .select('cliente_id, cliente_nombre, total')
        .eq('organizacion_id', orgId).eq('status', 'completada')
        .gte('created_at', `${mesActualInicio}T00:00:00`)
      acumular(actualMap, (pAct || []) as VentaRow[])

      const { data: pPrev } = await supabase.schema('erp').from('ventas_pos')
        .select('cliente_id, cliente_nombre, total')
        .eq('organizacion_id', orgId).eq('status', 'completada')
        .gte('created_at', `${mesAnteriorInicio}T00:00:00`).lt('created_at', `${mesActualInicio}T00:00:00`)
      acumular(anteriorMap, (pPrev || []) as VentaRow[])
    }

    const abcAnterior = calcularABCClientes(anteriorMap)
    const abcActual = calcularABCClientes(actualMap)

    if (abcAnterior.size === 0) return []

    const abcOrder = { A: 0, B: 1, C: 2 }
    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
    const insights: InsightItem[] = []

    abcAnterior.forEach((prev, clienteId) => {
      const act = abcActual.get(clienteId)
      const claseActual = act?.clase || 'C'
      if (abcOrder[claseActual] > abcOrder[prev.clase]) {
        const totalAnt = anteriorMap.get(clienteId)?.total || 0
        const totalAct = actualMap.get(clienteId)?.total || 0
        const severidad = prev.clase === 'A' && claseActual === 'C' ? 'critico' as const : 'alerta' as const

        insights.push({
          id: crypto.randomUUID(),
          key: `abc-cliente-${clienteId}`,
          tipo: 'ventas',
          severidad,
          titulo: `${prev.nombre} bajo de ${prev.clase} a ${claseActual}`,
          mensaje: `${prev.nombre} paso de cliente ${prev.clase} a ${claseActual}. Compras: ${fmt(totalAnt)} → ${fmt(totalAct)} este mes.`,
          metrica: { valor: totalAnt > 0 ? Math.round(((totalAnt - totalAct) / totalAnt) * 100) : 100, unidad: '%', tendencia: 'bajando' },
          accion: { label: 'Ver ABC de clientes', ruta: '/reportes/abc-clientes' },
          entidades: { cliente_id: clienteId },
          generado_en: new Date().toISOString(),
        })
      }
    })

    return insights.sort((a, b) => b.metrica.valor - a.metrica.valor).slice(0, 3)
  },
}
