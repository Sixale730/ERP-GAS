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
    console.log('[useAuth] fetchERPUser called with authUserId:', authUserId)
    const supabase = getSupabaseClient()

    console.log('[useAuth] Querying erp.usuarios...')
    const { data: erpUser, error: userError } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()

    console.log('[useAuth] erp.usuarios result:', { erpUser, userError })

    if (erpUser) {
      console.log('[useAuth] Querying erp.organizaciones for org_id:', erpUser.organizacion_id)
      const { data: org, error: orgError } = await supabase
        .schema('erp')
        .from('organizaciones')
        .select('id, nombre, codigo, is_sistema')
        .eq('id', erpUser.organizacion_id)
        .single()

      console.log('[useAuth] erp.organizaciones result:', { org, orgError })

      return { erpUser: erpUser as ERPUser, organizacion: org as Organizacion | null }
    }

    console.log('[useAuth] No erpUser found, returning nulls')
    return { erpUser: null, organizacion: null }
  }, [])

  useEffect(() => {
    console.log('[useAuth] useEffect started')
    const supabase = getSupabaseClient()

    // Obtener sesion inicial
    console.log('[useAuth] Calling getSession...')
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[useAuth] getSession result:', { hasSession: !!session, userId: session?.user?.id })
      if (session) {
        // Decodificar JWT para obtener claims
        let role: UserRole | null = null
        let orgId: string | null = null

        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]))
          role = payload.app_role || null
          orgId = payload.org_id || null
          console.log('[useAuth] JWT claims:', { app_role: role, org_id: orgId })
        } catch (e) {
          console.log('[useAuth] Error decoding JWT:', e)
        }

        // Obtener datos del usuario ERP
        console.log('[useAuth] Calling fetchERPUser...')
        const { erpUser, organizacion } = await fetchERPUser(session.user.id)
        console.log('[useAuth] fetchERPUser returned:', { hasErpUser: !!erpUser, hasOrg: !!organizacion })

        console.log('[useAuth] Setting state with loading: false')
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
        console.log('[useAuth] No session, setting loading: false')
        setState((prev) => ({ ...prev, loading: false }))
      }
    }).catch((err) => {
      console.error('[useAuth] getSession error:', err)
      setState((prev) => ({ ...prev, loading: false }))
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
