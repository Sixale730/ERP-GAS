'use client'

import { useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase/client'

export type UserRole = 'super_admin' | 'admin_cliente' | 'vendedor'

export interface ERPUser {
  id: string
  auth_user_id: string
  organizacion_id: string
  email: string
  nombre: string | null
  avatar_url: string | null
  rol: UserRole
  is_active: boolean
}

export interface Organizacion {
  id: string
  nombre: string
  codigo: string
  is_sistema: boolean
}

interface AuthState {
  user: User | null
  erpUser: ERPUser | null
  organizacion: Organizacion | null
  session: Session | null
  loading: boolean
  role: UserRole | null
  orgId: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    erpUser: null,
    organizacion: null,
    session: null,
    loading: true,
    role: null,
    orgId: null,
  })

  const fetchERPUser = useCallback(async (authUserId: string) => {
    const supabase = getSupabaseClient()

    const { data: erpUser } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()

    if (erpUser) {
      const { data: org } = await supabase
        .schema('erp')
        .from('organizaciones')
        .select('id, nombre, codigo, is_sistema')
        .eq('id', erpUser.organizacion_id)
        .single()

      return { erpUser: erpUser as ERPUser, organizacion: org as Organizacion | null }
    }

    return { erpUser: null, organizacion: null }
  }, [])

  useEffect(() => {
    const supabase = getSupabaseClient()

    // Obtener sesion inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Decodificar JWT para obtener claims
        let role: UserRole | null = null
        let orgId: string | null = null

        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]))
          role = payload.app_role || null
          orgId = payload.org_id || null
        } catch {
          // Error al decodificar JWT
        }

        // Obtener datos del usuario ERP
        const { erpUser, organizacion } = await fetchERPUser(session.user.id)

        setState({
          user: session.user,
          erpUser,
          organizacion,
          session,
          loading: false,
          role: erpUser?.rol || role,
          orgId: erpUser?.organizacion_id || orgId,
        })
      } else {
        setState((prev) => ({ ...prev, loading: false }))
      }
    })

    // Escuchar cambios de auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          erpUser: null,
          organizacion: null,
          session: null,
          loading: false,
          role: null,
          orgId: null,
        })
        return
      }

      if (session) {
        let role: UserRole | null = null
        let orgId: string | null = null

        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]))
          role = payload.app_role || null
          orgId = payload.org_id || null
        } catch {
          // Error al decodificar JWT
        }

        const { erpUser, organizacion } = await fetchERPUser(session.user.id)

        setState({
          user: session.user,
          erpUser,
          organizacion,
          session,
          loading: false,
          role: erpUser?.rol || role,
          orgId: erpUser?.organizacion_id || orgId,
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchERPUser])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [])

  const refreshUser = useCallback(async () => {
    if (state.user) {
      const { erpUser, organizacion } = await fetchERPUser(state.user.id)
      setState((prev) => ({
        ...prev,
        erpUser,
        organizacion,
        role: erpUser?.rol || prev.role,
        orgId: erpUser?.organizacion_id || prev.orgId,
      }))
    }
  }, [state.user, fetchERPUser])

  return {
    ...state,
    signOut,
    refreshUser,
    // Helpers de rol
    isSuperAdmin: state.role === 'super_admin',
    isAdminCliente: state.role === 'admin_cliente',
    isVendedor: state.role === 'vendedor',
    isAdmin: state.role === 'super_admin' || state.role === 'admin_cliente',
    // Info de display
    displayName: state.erpUser?.nombre || state.user?.email || 'Usuario',
    avatarUrl: state.erpUser?.avatar_url || state.user?.user_metadata?.avatar_url || null,
  }
}
