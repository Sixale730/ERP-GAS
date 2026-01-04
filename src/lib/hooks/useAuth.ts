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

  const fetchERPUser = useCallback(async () => {
    console.log('[useAuth] fetchERPUser called - using RPC')
    const supabase = getSupabaseClient()

    console.log('[useAuth] Calling erp.obtener_usuario_actual()...')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('obtener_usuario_actual')

    console.log('[useAuth] RPC result:', { data, error })

    if (error) {
      console.error('[useAuth] RPC error:', error)
      return { erpUser: null, organizacion: null }
    }

    if (data && data.length > 0) {
      const row = data[0]
      const erpUser: ERPUser = {
        id: row.id,
        auth_user_id: row.auth_user_id,
        organizacion_id: row.organizacion_id,
        email: row.email,
        nombre: row.nombre,
        avatar_url: row.avatar_url,
        rol: row.rol as UserRole,
        is_active: row.is_active,
      }
      const organizacion: Organizacion | null = row.org_nombre ? {
        id: row.organizacion_id,
        nombre: row.org_nombre,
        codigo: row.org_codigo,
        is_sistema: row.org_is_sistema,
      } : null

      console.log('[useAuth] Parsed user:', { erpUser, organizacion })
      return { erpUser, organizacion }
    }

    console.log('[useAuth] No user found, returning nulls')
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
        const { erpUser, organizacion } = await fetchERPUser()
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

        const { erpUser, organizacion } = await fetchERPUser()

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
      const { erpUser, organizacion } = await fetchERPUser()
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
