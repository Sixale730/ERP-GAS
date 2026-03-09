'use client'

import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

// Query keys factory
export const serviciosKeys = {
  all: ['servicios'] as const,
  reporte: (orgId?: string | null) => [...serviciosKeys.all, 'reporte', orgId] as const,
  movimientos: (productoId?: string, orgId?: string | null) => [...serviciosKeys.all, 'movimientos', { productoId, orgId }] as const,
}

// ============ REPORTE DE SERVICIOS ============

export interface ServicioConUso {
  id: string
  sku: string
  nombre: string
  categoria_nombre: string | null
  unidad_medida: string
  total_usado: number
  usado_mes: number
  ultima_fecha_uso: string | null
}

export interface ReporteServiciosData {
  servicios: ServicioConUso[]
  stats: {
    totalServicios: number
    serviciosUsadosMes: number
    totalUnidadesConsumidas: number
  }
}

export function useReporteServicios(orgId?: string | null) {
  return useQuery({
    queryKey: serviciosKeys.reporte(orgId),
    queryFn: async (): Promise<ReporteServiciosData> => {
      const supabase = getSupabaseClient()

      let serviciosQuery = supabase
        .schema('erp')
        .from('v_productos_stock')
        .select('id, sku, nombre, categoria_nombre, unidad_medida')
        .eq('es_servicio', true)
        .order('nombre')

      if (orgId) {
        serviciosQuery = serviciosQuery.eq('organizacion_id', orgId)
      }

      const { data: serviciosData, error: serviciosError } = await serviciosQuery

      if (serviciosError) throw serviciosError

      const servicios = serviciosData || []
      const servicioIds = servicios.map(s => s.id)

      if (servicioIds.length === 0) {
        return {
          servicios: [],
          stats: {
            totalServicios: 0,
            serviciosUsadosMes: 0,
            totalUnidadesConsumidas: 0,
          }
        }
      }

      let movQuery = supabase
        .schema('erp')
        .from('movimientos_inventario')
        .select('producto_id, cantidad, tipo, created_at')
        .in('producto_id', servicioIds)
        .order('created_at', { ascending: false })

      if (orgId) {
        movQuery = movQuery.eq('organizacion_id', orgId)
      }

      const { data: movimientos, error: movError } = await movQuery

      if (movError) throw movError

      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      // Construir mapa de movimientos por producto_id (O(M) en vez de O(N*M))
      const movsPorProducto = new Map<string, typeof movimientos>()
      for (const m of movimientos || []) {
        const arr = movsPorProducto.get(m.producto_id)
        if (arr) {
          arr.push(m)
        } else {
          movsPorProducto.set(m.producto_id, [m])
        }
      }

      const serviciosConUso: ServicioConUso[] = servicios.map(servicio => {
        const movsServicio = movsPorProducto.get(servicio.id) || []

        let totalUsado = 0
        let usadoMes = 0
        let ultimaFechaUso: string | null = null

        for (const m of movsServicio) {
          if (m.tipo === 'salida') {
            totalUsado += m.cantidad
            if (new Date(m.created_at) >= inicioMes) {
              usadoMes += m.cantidad
            }
            if (!ultimaFechaUso) {
              ultimaFechaUso = m.created_at
            }
          }
        }

        return {
          id: servicio.id,
          sku: servicio.sku,
          nombre: servicio.nombre,
          categoria_nombre: servicio.categoria_nombre,
          unidad_medida: servicio.unidad_medida,
          total_usado: totalUsado,
          usado_mes: usadoMes,
          ultima_fecha_uso: ultimaFechaUso,
        }
      })

      const serviciosUsadosMes = serviciosConUso.filter(s => s.usado_mes > 0).length
      const totalUnidadesConsumidas = serviciosConUso.reduce((sum, s) => sum + s.total_usado, 0)

      return {
        servicios: serviciosConUso,
        stats: {
          totalServicios: servicios.length,
          serviciosUsadosMes,
          totalUnidadesConsumidas,
        }
      }
    },
    staleTime: 1000 * 60 * 2,
  })
}

// ============ MOVIMIENTOS DE SERVICIOS ============

export function useMovimientosServicios(productoId?: string, limit = 50, orgId?: string | null) {
  return useQuery({
    queryKey: [...serviciosKeys.movimientos(productoId, orgId), { limit }],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      let servicioIds: string[] = []

      if (productoId) {
        servicioIds = [productoId]
      } else {
        let prodQuery = supabase
          .schema('erp')
          .from('productos')
          .select('id')
          .eq('es_servicio', true)

        if (orgId) {
          prodQuery = prodQuery.eq('organizacion_id', orgId)
        }

        const { data: servicios } = await prodQuery
        servicioIds = (servicios || []).map(s => s.id)
      }

      if (servicioIds.length === 0) return []

      let movQuery = supabase
        .schema('erp')
        .from('v_movimientos')
        .select('*')
        .in('producto_id', servicioIds)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (orgId) {
        movQuery = movQuery.eq('organizacion_id', orgId)
      }

      const { data, error } = await movQuery

      if (error) throw error
      return data || []
    },
    staleTime: 1000 * 60 * 1,
  })
}
