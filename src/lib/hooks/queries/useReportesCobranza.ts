import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { fetchDescripcionesFacturas } from './useReportesHelpers'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EstadoCuentaMovimiento {
  fecha: string
  tipo: 'factura' | 'pago'
  folio: string
  descripcion: string
  cargo: number
  abono: number
  saldo: number
}

export interface EstadoCuentaResumen {
  saldo_actual: number
  total_facturado: number
  total_pagado: number
  facturas_abiertas: number
}

export interface PagoRecibidoRow {
  id: string
  folio: string
  fecha: string
  monto: number
  metodo_pago: string | null
  referencia: string | null
  notas: string | null
  factura_folio: string
  cliente_nombre: string
  sucursal_nombre: string | null
  productos_desc: string | null
}

// ─── R4: Estado de Cuenta por Cliente ─────────────────────────────────────────

export function useEstadoCuentaCliente(
  clienteId: string | null,
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined
) {
  return useQuery({
    queryKey: ['reporte-estado-cuenta', clienteId, fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      // Obtener facturas del cliente
      let fq = supabase
        .schema('erp')
        .from('v_facturas')
        .select('id, folio, fecha, total, monto_pagado, saldo, status, sucursal_nombre')
        .eq('organizacion_id', orgId!)
        .eq('cliente_id', clienteId!)
        .not('status', 'eq', 'cancelada')
        .order('fecha', { ascending: true })

      if (fechaDesde) fq = fq.gte('fecha', fechaDesde)
      if (fechaHasta) fq = fq.lte('fecha', fechaHasta)

      const { data: facturas, error: fErr } = await fq
      if (fErr) throw fErr

      // Obtener pagos del cliente (a través de las facturas)
      const facturaIds = (facturas || []).map((f) => f.id)
      let pagos: { folio: string; fecha: string; monto: number; factura_id: string; referencia: string | null }[] = []

      if (facturaIds.length > 0) {
        const { data: pagosData, error: pErr } = await supabase
          .schema('erp')
          .from('pagos')
          .select('folio, fecha, monto, factura_id, referencia')
          .in('factura_id', facturaIds)
          .order('fecha', { ascending: true })

        if (pErr) throw pErr
        pagos = pagosData || []
      }

      // Construir mapa de factura_id -> folio
      const facturaFolioMap = new Map((facturas || []).map((f) => [f.id, f.folio]))

      // Obtener descripciones de productos
      const descMap = await fetchDescripcionesFacturas(facturaIds)

      // Combinar en movimientos cronológicos
      const movimientos: Omit<EstadoCuentaMovimiento, 'saldo'>[] = []

      for (const f of facturas || []) {
        const prodDesc = descMap.get(f.id)
        const sucInfo = (f as Record<string, unknown>).sucursal_nombre ? ` [${(f as Record<string, unknown>).sucursal_nombre}]` : ''
        const desc = prodDesc
          ? `${f.folio}: ${prodDesc}${sucInfo}`
          : `Factura ${f.folio}${sucInfo}`
        movimientos.push({
          fecha: f.fecha,
          tipo: 'factura',
          folio: f.folio,
          descripcion: desc,
          cargo: Number(f.total || 0),
          abono: 0,
        })
      }

      for (const p of pagos) {
        movimientos.push({
          fecha: p.fecha,
          tipo: 'pago',
          folio: p.folio,
          descripcion: `Pago a ${facturaFolioMap.get(p.factura_id) || 'factura'}${p.referencia ? ` (Ref: ${p.referencia})` : ''}`,
          cargo: 0,
          abono: Number(p.monto || 0),
        })
      }

      // Ordenar por fecha
      movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha))

      // Calcular saldo corrido
      let saldoAcumulado = 0
      const resultado: EstadoCuentaMovimiento[] = movimientos.map((m) => {
        saldoAcumulado += m.cargo - m.abono
        return { ...m, saldo: saldoAcumulado }
      })

      // Resumen
      const resumen: EstadoCuentaResumen = {
        saldo_actual: saldoAcumulado,
        total_facturado: movimientos.filter((m) => m.tipo === 'factura').reduce((s, m) => s + m.cargo, 0),
        total_pagado: movimientos.filter((m) => m.tipo === 'pago').reduce((s, m) => s + m.abono, 0),
        facturas_abiertas: (facturas || []).filter((f) => Number(f.saldo) > 0).length,
      }

      return { movimientos: resultado, resumen }
    },
    enabled: !!clienteId && !!orgId,
  })
}

// ─── R5: Pagos Recibidos ──────────────────────────────────────────────────────

export function usePagosRecibidos(
  fechaDesde: string | null,
  fechaHasta: string | null,
  orgId: string | undefined
) {
  return useQuery({
    queryKey: ['reporte-pagos-recibidos', fechaDesde, fechaHasta, orgId],
    queryFn: async () => {
      const supabase = getSupabaseClient()

      // Obtener pagos con factura y cliente info
      let q = supabase
        .schema('erp')
        .from('pagos')
        .select('id, folio, fecha, monto, metodo_pago, referencia, notas, factura_id')
        .eq('organizacion_id', orgId!)
        .order('fecha', { ascending: false })

      if (fechaDesde) q = q.gte('fecha', fechaDesde)
      if (fechaHasta) q = q.lte('fecha', fechaHasta)

      const { data: pagos, error } = await q
      if (error) throw error
      if (!pagos || pagos.length === 0) return []

      // Obtener facturas para folio, cliente y sucursal
      const facturaIds = Array.from(new Set(pagos.map((p) => p.factura_id)))
      const { data: facturas } = await supabase
        .schema('erp')
        .from('v_facturas')
        .select('id, folio, cliente_nombre, sucursal_nombre')
        .in('id', facturaIds)

      const facturaMap = new Map((facturas || []).map((f) => [f.id, f]))

      // Obtener descripciones de productos
      const descMap = await fetchDescripcionesFacturas(facturaIds)

      return pagos.map((p): PagoRecibidoRow => {
        const factura = facturaMap.get(p.factura_id)
        return {
          id: p.id,
          folio: p.folio,
          fecha: p.fecha,
          monto: Number(p.monto),
          metodo_pago: p.metodo_pago,
          referencia: p.referencia,
          notas: p.notas,
          factura_folio: factura?.folio || '-',
          cliente_nombre: factura?.cliente_nombre || 'Desconocido',
          sucursal_nombre: (factura as Record<string, unknown>)?.sucursal_nombre as string | null || null,
          productos_desc: descMap.get(p.factura_id) || null,
        }
      })
    },
    enabled: !!fechaDesde && !!fechaHasta && !!orgId,
  })
}
