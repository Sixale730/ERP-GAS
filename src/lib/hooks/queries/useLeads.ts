import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

export type LeadStatus = 'nuevo' | 'contactado' | 'demo_agendada' | 'convertido' | 'descartado'

export interface Lead {
  id: string
  nombre: string
  correo: string
  empresa: string | null
  telefono: string | null
  giro: string | null
  status: LeadStatus
  notas: string | null
  created_at: string
  updated_at: string
}

const LEADS_KEY = ['leads_demo']

export function useLeads(statusFilter?: LeadStatus | null) {
  return useQuery({
    queryKey: [...LEADS_KEY, statusFilter],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      let query = supabase
        .schema('erp')
        .from('leads_demo')
        .select('*')
        .order('created_at', { ascending: false })

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Lead[]
    },
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: LeadStatus; notas?: string }) => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('leads_demo')
        .update(updates)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEADS_KEY })
    },
  })
}
