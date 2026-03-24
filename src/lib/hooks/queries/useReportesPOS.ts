import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface HorarioVentaRow {
  hora: number
  hora_label: string
  total_ventas: number
  num_transacciones: number
  ticket_promedio: number
}

export interface ProductividadCajeroRow {
  vendedor_nombre: string
  num_turnos: number
  total_ventas: number
  num_tickets: number
  ticket_promedio: number
  ventas_por_turno: number
}

// ─── R21: Análisis de Horarios ────────────────────────────────────────────────

export function useAnalisisHorarios(
  fechaDesde: string | null, fechaHasta: string | null, orgId: string | undefined
) {
  return useQuery({
    queryKey: ['reporte-analisis-horarios', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let q = supabase.schema('erp').from('ventas_pos')
        .select('created_at, total')
        .eq('status', 'completada').eq('organizacion_id', orgId!)
      if (fechaDesde) q = q.gte('created_at', `${fechaDesde}T00:00:00`)
      if (fechaHasta) q = q.lte('created_at', `${fechaHasta}T23:59:59`)

      const { data, error } = await q
      if (error) throw error

      const porHora = new Map<number, { total: number; count: number }>()
      for (const v of data || []) {
        const hora = new Date(v.created_at).getHours()
        const ex = porHora.get(hora)
        if (ex) { ex.total += Number(v.total || 0); ex.count++ }
        else { porHora.set(hora, { total: Number(v.total || 0), count: 1 }) }
      }

      const resultado: HorarioVentaRow[] = []
      for (let h = 0; h < 24; h++) {
        const vals = porHora.get(h)
        if (vals) {
          resultado.push({
            hora: h,
            hora_label: `${String(h).padStart(2, '0')}:00 - ${String(h).padStart(2, '0')}:59`,
            total_ventas: vals.total,
            num_transacciones: vals.count,
            ticket_promedio: vals.count > 0 ? vals.total / vals.count : 0,
          })
        }
      }
      return resultado
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}

// ─── R22: Productividad por Cajero ────────────────────────────────────────────

export function useProductividadCajero(
  fechaDesde: string | null, fechaHasta: string | null, orgId: string | undefined
) {
  return useQuery({
    queryKey: ['reporte-productividad-cajero', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      // Ventas POS
      let vq = supabase.schema('erp').from('ventas_pos')
        .select('vendedor_nombre, total')
        .eq('status', 'completada').eq('organizacion_id', orgId!)
      if (fechaDesde) vq = vq.gte('created_at', `${fechaDesde}T00:00:00`)
      if (fechaHasta) vq = vq.lte('created_at', `${fechaHasta}T23:59:59`)
      const { data: ventas } = await vq

      // Turnos
      let tq = supabase.schema('erp').from('v_resumen_turno')
        .select('usuario_nombre').eq('organizacion_id', orgId!)
      if (fechaDesde) tq = tq.gte('fecha_apertura', `${fechaDesde}T00:00:00`)
      if (fechaHasta) tq = tq.lte('fecha_apertura', `${fechaHasta}T23:59:59`)
      const { data: turnos } = await tq

      // Contar turnos por cajero
      const turnosMap = new Map<string, number>()
      for (const t of turnos || []) {
        const name = t.usuario_nombre || 'Sin nombre'
        turnosMap.set(name, (turnosMap.get(name) || 0) + 1)
      }

      // Agrupar ventas por cajero
      const ventasMap = new Map<string, { total: number; count: number }>()
      for (const v of ventas || []) {
        const name = v.vendedor_nombre || 'Sin vendedor'
        const ex = ventasMap.get(name)
        if (ex) { ex.total += Number(v.total || 0); ex.count++ }
        else { ventasMap.set(name, { total: Number(v.total || 0), count: 1 }) }
      }

      const resultado: ProductividadCajeroRow[] = []
      const allNames = new Set<string>()
      ventasMap.forEach((_, n) => allNames.add(n))
      turnosMap.forEach((_, n) => allNames.add(n))

      allNames.forEach((name) => {
        const vData = ventasMap.get(name) || { total: 0, count: 0 }
        const numTurnos = turnosMap.get(name) || 1
        resultado.push({
          vendedor_nombre: name,
          num_turnos: numTurnos,
          total_ventas: vData.total,
          num_tickets: vData.count,
          ticket_promedio: vData.count > 0 ? vData.total / vData.count : 0,
          ventas_por_turno: numTurnos > 0 ? vData.total / numTurnos : 0,
        })
      })

      return resultado.sort((a, b) => b.total_ventas - a.total_ventas)
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}
