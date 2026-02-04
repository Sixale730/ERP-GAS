'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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

  // Ref to deduplicate concurrent fetch requests
  const fetchInProgressRef = useRef<Promise<{erpUser: ERPUser | null, organizacion: Organizacion | null}> | null>(null)
  // Ref to track if initial fetch is done (to skip redundant onAuthStateChange events)
  const initialFetchDoneRef = useRef(false)

  const fetchERPUser = useCallback(async () => {
    // Deduplicate: return existing promise if fetch is in progress
    if (fetchInProgressRef.current) {
      console.log('[useAuth] fetchERPUser - returning existing promise')
      return fetchInProgressRef.current
    }

    const fetchPromise = (async () => {
      console.log('[useAuth] fetchERPUser called - using RPC')
      const supabase = getSupabaseClient()

      // Retry logic optimizado - timeouts más cortos
      const maxRetries = 2
      const initialDelay = 500
      const timeoutMs = 15000  // 15 segundos para evitar timeouts prematuros

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`[useAuth] RPC attempt ${attempt + 1}/${maxRetries}...`)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rpcPromise = (supabase.rpc as any)('obtener_usuario_actual')
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`RPC timeout after ${timeoutMs}ms`)), timeoutMs)
          )
          const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as { data: unknown; error: unknown }

          if (error) {
            console.error(`[useAuth] RPC error (attempt ${attempt + 1}):`, error)
            if (attempt < maxRetries - 1) {
              const delay = initialDelay * Math.pow(2, attempt)
              console.log(`[useAuth] Retrying in ${delay}ms...`)
              await new Promise(r => setTimeout(r, delay))
              continue
            }
            return { erpUser: null, organizacion: null }
          }

          console.log('[useAuth] RPC result:', { data, error })

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (data && (data as any).length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const row = (data as any)[0]
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

        } catch (err) {
          console.error(`[useAuth] RPC exception (attempt ${attempt + 1}):`, err)
          if (attempt < maxRetries - 1) {
            const delay = initialDelay * Math.pow(2, attempt)
            console.log(`[useAuth] Retrying in ${delay}ms...`)
            await new Promise(r => setTimeout(r, delay))
            continue
          }
          return { erpUser: null, organizacion: null }
        }
      }

      return { erpUser: null, organizacion: null }
    })()

    fetchInProgressRef.current = fetchPromise
    const result = await fetchPromise
    fetchInProgressRef.current = null
    return result
  }, [])

  // Timeout de seguridad: si loading se queda en true por más de 6 segundos, forzar a false
  useEffect(() => {
    const timeout = setTimeout(() => {
      setState(prev => {
        if (prev.loading) {
          console.warn('[useAuth] Loading timeout - forcing loading=false after 6s')
          return { ...prev, loading: false }
        }
        return prev
      })
    }, 6000)

    return () => clearTimeout(timeout)
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
        initialFetchDoneRef.current = true // Mark that we're handling initial fetch
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
      console.log('[useAuth] onAuthStateChange:', event)

      // Skip initial auth events - we handle this via getSession()
      if (event === 'INITIAL_SESSION' || (event === 'SIGNED_IN' && !initialFetchDoneRef.current)) {
        console.log(`[useAuth] Skipping ${event} (handled by getSession)`)
        return
      }

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

        setState((prev) => ({
          user: session.user,
          erpUser,
          organizacion,
          session,
          loading: false,
          role: erpUser?.rol || role || prev.role,  // Preservar rol anterior si el nuevo es null
          orgId: erpUser?.organizacion_id || orgId || prev.orgId,  // Preservar orgId anterior
        }))
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchERPUser])

  const signOut = useCallback(async () => {
    // Limpiar estado inmediatamente para evitar re-renders y mostrar spinner
    setState({
      user: null,
      erpUser: null,
      organizacion: null,
      session: null,
      loading: true, // Mostrar loading mientras se cierra sesión
      role: null,
      orgId: null,
    })

    try {
      const supabase = getSupabaseClient()
      await supabase.auth.signOut()
    } catch (error) {
      console.error('[useAuth] Error signing out:', error)
    }

    // Redirigir siempre, incluso si hay error
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
