'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export type GuiaPaqueteria =
  | 'paquetexpress'
  | 'estafeta'
  | 'tres_guerras'
  | 'dhl'
  | 'fedex'
  | 'castores'
  | 'propio'
  | 'otro'

export type GuiaTipoEntrega = 'ocurre' | 'domicilio'
export type GuiaFormaPago = 'pagado' | 'por_cobrar'
export type GuiaStatus = 'en_paqueteria' | 'en_transito' | 'entregado' | 'incidencia' | 'devuelto'
export type GuiaEnviadoPor = 'whatsapp' | 'email' | 'manual' | 'no_enviado'

export interface GuiaMedidas {
  ancho?: number
  alto?: number
  largo?: number
}

export interface GuiaEnvio {
  id: string
  folio: string
  organizacion_id: string
  cliente_id: string | null
  cliente_nombre_libre: string | null
  direccion_envio_id: string | null
  paqueteria: GuiaPaqueteria
  numero_guia: string | null
  referencia_externa: string | null
  tipo_entrega: GuiaTipoEntrega
  forma_pago_envio: GuiaFormaPago
  atencion_a: string | null
  destino_ciudad: string | null
  destino_estado: string | null
  destino_cp: string | null
  peso_kg: number | null
  medidas_cm: GuiaMedidas | null
  bultos: number
  valor_declarado: number | null
  costo_real: number | null
  monto_cobrado: number | null
  status: GuiaStatus
  fecha_despacho: string | null
  fecha_estimada: string | null
  fecha_entrega: string | null
  enviado_a_cliente_por: GuiaEnviadoPor | null
  fecha_enviado_cliente: string | null
  ticket_url: string | null
  acuse_url: string | null
  notas: string | null
  factura_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joins (no en DB, agregados en hook)
  cliente_nombre?: string | null
}

export const guiasEnvioKeys = {
  all: ['guias-envio'] as const,
  lists: () => [...guiasEnvioKeys.all, 'list'] as const,
  list: (filters: GuiasEnvioListFilters) => [...guiasEnvioKeys.lists(), filters] as const,
  detail: (id: string) => [...guiasEnvioKeys.all, 'detail', id] as const,
  byCotizacion: (cotizacionId: string) => [...guiasEnvioKeys.all, 'cotizacion', cotizacionId] as const,
}

export interface GuiasEnvioListFilters {
  status?: GuiaStatus | null
  paqueteria?: GuiaPaqueteria | null
  search?: string
  fechaDesde?: string | null
  fechaHasta?: string | null
}

const SELECT_COLS = `
  id, folio, organizacion_id, cliente_id, cliente_nombre_libre, direccion_envio_id,
  paqueteria, numero_guia, referencia_externa, tipo_entrega, forma_pago_envio,
  atencion_a, destino_ciudad, destino_estado, destino_cp,
  peso_kg, medidas_cm, bultos, valor_declarado,
  costo_real, monto_cobrado,
  status, fecha_despacho, fecha_estimada, fecha_entrega,
  enviado_a_cliente_por, fecha_enviado_cliente,
  ticket_url, acuse_url, notas, factura_id,
  created_by, created_at, updated_at,
  clientes:cliente_id (nombre_comercial)
`

interface GuiaRowFromDB extends Omit<GuiaEnvio, 'cliente_nombre'> {
  clientes?: { nombre_comercial: string | null } | null
}

function mapRow(row: GuiaRowFromDB): GuiaEnvio {
  return {
    ...row,
    cliente_nombre: row.clientes?.nombre_comercial ?? row.cliente_nombre_libre ?? null,
  }
}

export function useGuiasEnvio(filters: GuiasEnvioListFilters = {}) {
  const { orgId } = useAuth()
  return useQuery({
    queryKey: guiasEnvioKeys.list(filters),
    queryFn: async (): Promise<GuiaEnvio[]> => {
      const supabase = getSupabaseClient()
      let q = supabase.schema('erp').from('guias_envio')
        .select(SELECT_COLS)
        .order('fecha_despacho', { ascending: false, nullsFirst: false })
        .limit(500)

      if (filters.status) q = q.eq('status', filters.status)
      if (filters.paqueteria) q = q.eq('paqueteria', filters.paqueteria)
      if (filters.fechaDesde) q = q.gte('fecha_despacho', `${filters.fechaDesde}T00:00:00`)
      if (filters.fechaHasta) q = q.lte('fecha_despacho', `${filters.fechaHasta}T23:59:59`)
      if (filters.search) {
        const s = filters.search.replace(/[,()]/g, '').trim()
        if (s) q = q.or(`folio.ilike.%${s}%,numero_guia.ilike.%${s}%,cliente_nombre_libre.ilike.%${s}%,destino_ciudad.ilike.%${s}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((r: unknown) => mapRow(r as GuiaRowFromDB))
    },
    enabled: !!orgId,
    staleTime: 1000 * 30,
  })
}

export function useGuiaEnvio(id: string | null) {
  return useQuery({
    queryKey: id ? guiasEnvioKeys.detail(id) : ['guias-envio', 'detail', 'none'],
    queryFn: async (): Promise<{ guia: GuiaEnvio; cotizaciones: { id: string; folio: string; status: string; total: number }[] }> => {
      const supabase = getSupabaseClient()
      const { data: row, error } = await supabase.schema('erp').from('guias_envio')
        .select(SELECT_COLS)
        .eq('id', id!).single()
      if (error) throw error
      const guia = mapRow(row as unknown as GuiaRowFromDB)

      // Cotizaciones (OVs) ligadas
      const { data: pivot } = await supabase.schema('erp')
        .from('guia_envio_cotizaciones')
        .select('cotizacion_id, cotizaciones:cotizacion_id (id, folio, status, total)')
        .eq('guia_id', id!)
      const cotizaciones = (pivot ?? [])
        .map((p: unknown) => {
          const r = p as { cotizaciones: { id: string; folio: string; status: string; total: number } | null }
          return r.cotizaciones
        })
        .filter((c): c is { id: string; folio: string; status: string; total: number } => c !== null)

      return { guia, cotizaciones }
    },
    enabled: !!id,
    staleTime: 1000 * 30,
  })
}

export function useGuiasByCotizacion(cotizacionId: string | null) {
  return useQuery({
    queryKey: cotizacionId ? guiasEnvioKeys.byCotizacion(cotizacionId) : ['guias-envio', 'cotizacion', 'none'],
    queryFn: async (): Promise<GuiaEnvio[]> => {
      const supabase = getSupabaseClient()
      const { data: pivot, error } = await supabase.schema('erp')
        .from('guia_envio_cotizaciones')
        .select(`guia_id, guias:guia_id (${SELECT_COLS})`)
        .eq('cotizacion_id', cotizacionId!)
      if (error) throw error
      return (pivot ?? [])
        .map((p: unknown) => {
          const r = p as { guias: GuiaRowFromDB | null }
          return r.guias ? mapRow(r.guias) : null
        })
        .filter((g): g is GuiaEnvio => g !== null)
    },
    enabled: !!cotizacionId,
    staleTime: 1000 * 30,
  })
}

export interface UpsertGuiaInput {
  id?: string
  cliente_id?: string | null
  cliente_nombre_libre?: string | null
  direccion_envio_id?: string | null
  paqueteria: GuiaPaqueteria
  numero_guia?: string | null
  referencia_externa?: string | null
  tipo_entrega: GuiaTipoEntrega
  forma_pago_envio: GuiaFormaPago
  atencion_a?: string | null
  destino_ciudad?: string | null
  destino_estado?: string | null
  destino_cp?: string | null
  peso_kg?: number | null
  medidas_cm?: GuiaMedidas | null
  bultos?: number
  valor_declarado?: number | null
  costo_real?: number | null
  monto_cobrado?: number | null
  status?: GuiaStatus
  fecha_despacho?: string | null
  fecha_estimada?: string | null
  fecha_entrega?: string | null
  enviado_a_cliente_por?: GuiaEnviadoPor | null
  notas?: string | null
  factura_id?: string | null
  cotizaciones_ids?: string[] // OVs ligadas (para tabla pivot)
}

export function useUpsertGuiaEnvio() {
  const queryClient = useQueryClient()
  const { orgId, erpUser } = useAuth()
  return useMutation({
    mutationFn: async (input: UpsertGuiaInput) => {
      if (!orgId) throw new Error('Sin organizacion')
      const supabase = getSupabaseClient()

      const cotizaciones_ids = input.cotizaciones_ids ?? []
      const dataPayload: Record<string, unknown> = {
        cliente_id: input.cliente_id ?? null,
        cliente_nombre_libre: input.cliente_nombre_libre ?? null,
        direccion_envio_id: input.direccion_envio_id ?? null,
        paqueteria: input.paqueteria,
        numero_guia: input.numero_guia ?? null,
        referencia_externa: input.referencia_externa ?? null,
        tipo_entrega: input.tipo_entrega,
        forma_pago_envio: input.forma_pago_envio,
        atencion_a: input.atencion_a ?? null,
        destino_ciudad: input.destino_ciudad ?? null,
        destino_estado: input.destino_estado ?? null,
        destino_cp: input.destino_cp ?? null,
        peso_kg: input.peso_kg ?? null,
        medidas_cm: input.medidas_cm ?? null,
        bultos: input.bultos ?? 1,
        valor_declarado: input.valor_declarado ?? null,
        costo_real: input.costo_real ?? null,
        monto_cobrado: input.monto_cobrado ?? null,
        status: input.status ?? 'en_paqueteria',
        fecha_despacho: input.fecha_despacho ?? new Date().toISOString(),
        fecha_estimada: input.fecha_estimada ?? null,
        fecha_entrega: input.fecha_entrega ?? null,
        enviado_a_cliente_por: input.enviado_a_cliente_por ?? null,
        notas: input.notas ?? null,
        factura_id: input.factura_id ?? null,
      }

      let guiaId = input.id

      if (input.id) {
        const { error } = await supabase.schema('erp').from('guias_envio')
          .update(dataPayload).eq('id', input.id)
        if (error) throw error
      } else {
        // Generar folio nuevo
        const { data: folioData, error: folioErr } = await supabase.rpc('generar_folio_guia')
        if (folioErr) throw folioErr
        const folio = (folioData as string) || `GUIA-${Date.now()}`

        const { data: inserted, error } = await supabase.schema('erp').from('guias_envio')
          .insert({
            ...dataPayload,
            folio,
            organizacion_id: orgId,
            created_by: erpUser?.id ?? null,
          })
          .select('id')
          .single()
        if (error) throw error
        guiaId = inserted.id
      }

      // Sync tabla pivot guia_envio_cotizaciones
      if (guiaId) {
        // Borrar las que ya no aplican
        if (input.id) {
          await supabase.schema('erp').from('guia_envio_cotizaciones')
            .delete().eq('guia_id', guiaId)
        }
        if (cotizaciones_ids.length > 0) {
          const rows = cotizaciones_ids.map(cid => ({ guia_id: guiaId!, cotizacion_id: cid }))
          const { error: pivotErr } = await supabase.schema('erp')
            .from('guia_envio_cotizaciones').insert(rows)
          if (pivotErr) throw pivotErr
        }
      }

      return { id: guiaId! }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guiasEnvioKeys.all })
    },
  })
}

export function useDeleteGuiaEnvio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient()
      const { error } = await supabase.schema('erp').from('guias_envio').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guiasEnvioKeys.all })
    },
  })
}

/** URL publica de rastreo segun paqueteria + numero. */
export function buildTrackingUrl(paqueteria: GuiaPaqueteria, numero: string | null): string | null {
  if (!numero) return null
  const n = encodeURIComponent(numero.trim())
  switch (paqueteria) {
    case 'paquetexpress': return `https://www.paquetexpress.com.mx/rastreo?guia=${n}`
    case 'estafeta':      return `https://www.estafeta.com/Rastreo/Guia?guia=${n}`
    case 'tres_guerras':  return `https://www.tresguerras.com.mx/?menu=rastreo&guia=${n}`
    case 'dhl':           return `https://www.dhl.com/mx-es/home/tracking.html?tracking-id=${n}`
    case 'fedex':         return `https://www.fedex.com/fedextrack/?tracknumbers=${n}`
    case 'castores':      return `https://www.castores.com.mx/rastreoguia.aspx?guia=${n}`
    default: return null
  }
}

export const PAQUETERIA_LABELS: Record<GuiaPaqueteria, string> = {
  paquetexpress: 'Paquetexpress',
  estafeta: 'Estafeta',
  tres_guerras: 'Tres Guerras',
  dhl: 'DHL',
  fedex: 'FedEx',
  castores: 'Castores',
  propio: 'Transporte propio',
  otro: 'Otro',
}

export const STATUS_LABELS: Record<GuiaStatus, string> = {
  en_paqueteria: 'En paquetería',
  en_transito: 'En tránsito',
  entregado: 'Entregado',
  incidencia: 'Incidencia',
  devuelto: 'Devuelto',
}

export const STATUS_COLORS: Record<GuiaStatus, string> = {
  en_paqueteria: 'orange',
  en_transito: 'blue',
  entregado: 'green',
  incidencia: 'volcano',
  devuelto: 'red',
}
