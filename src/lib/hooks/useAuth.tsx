'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase/client'

export type UserRole = 'super_admin' | 'admin_cliente' | 'vendedor' | 'compras' | 'contador'

export interface PermisoCRUD {
  ver: boolean
  crear: boolean
  editar: boolean
  eliminar: boolean
}

export type PermisosUsuario = Record<string, PermisoCRUD>

export interface ERPUser {
  id: string
  auth_user_id: string
  organizacion_id: string
  email: string
  nombre: string | null
  avatar_url: string | null
  rol: UserRole
  is_active: boolean
  permisos: PermisosUsuario | null
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

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  isSuperAdmin: boolean
  isAdminCliente: boolean
  isVendedor: boolean
  isCompras: boolean
  isContador: boolean
  isAdmin: boolean
  displayName: string
  avatarUrl: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    erpUser: null,
    organizacion: null,
    session: null,
    loading: true,
    role: null,
    orgId: null,
  })

  const fetchInProgressRef = useRef<Promise<{erpUser: ERPUser | null, organizacion: Organizacion | null}> | null>(null)
  const initialFetchDoneRef = useRef(false)

  const fetchERPUser = useCallback(async () => {
    if (fetchInProgressRef.current) {
      return fetchInProgressRef.current
    }

    const fetchPromise = (async () => {
      const supabase = getSupabaseClient()
      const maxRetries = 2
      const initialDelay = 500
      const timeoutMs = 15000

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rpcPromise = (supabase.rpc as any)('obtener_usuario_actual')
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`RPC timeout after ${timeoutMs}ms`)), timeoutMs)
          )
          const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as { data: unknown; error: unknown }

          if (error) {
            if (attempt < maxRetries - 1) {
              await new Promise(r => setTimeout(r, initialDelay * Math.pow(2, attempt)))
              continue
            }
            return { erpUser: null, organizacion: null }
          }

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
              permisos: row.permisos || null,
            }
            const organizacion: Organizacion | null = row.org_nombre ? {
              id: row.organizacion_id,
              nombre: row.org_nombre,
              codigo: row.org_codigo,
              is_sistema: row.org_is_sistema,
            } : null

            return { erpUser, organizacion }
          }

          return { erpUser: null, organizacion: null }
        } catch (err) {
          if (attempt < maxRetries - 1) {
            await new Promise(r => setTimeout(r, initialDelay * Math.pow(2, attempt)))
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

  // Safety timeout: force loading=false after 6 seconds
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
    const supabase = getSupabaseClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        let role: UserRole | null = null
        let orgId: string | null = null

        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]))
          role = payload.app_role || null
          orgId = payload.org_id || null
        } catch {
          // Error decoding JWT
        }

        initialFetchDoneRef.current = true
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
      } else {
        setState((prev) => ({ ...prev, loading: false }))
      }
    }).catch(() => {
      setState((prev) => ({ ...prev, loading: false }))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || (event === 'SIGNED_IN' && !initialFetchDoneRef.current)) {
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
          // Error decoding JWT
        }

        const { erpUser, organizacion } = await fetchERPUser()

        setState((prev) => ({
          user: session.user,
          erpUser,
          organizacion,
          session,
          loading: false,
          role: erpUser?.rol || role || prev.role,
          orgId: erpUser?.organizacion_id || orgId || prev.orgId,
        }))
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchERPUser])

  const signOut = useCallback(async () => {
    setState({
      user: null,
      erpUser: null,
      organizacion: null,
      session: null,
      loading: true,
      role: null,
      orgId: null,
    })

    try {
      const supabase = getSupabaseClient()
      await supabase.auth.signOut()
    } catch (error) {
      console.error('[useAuth] Error signing out:', error)
    }

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

  const value: AuthContextValue = {
    ...state,
    signOut,
    refreshUser,
    isSuperAdmin: state.role === 'super_admin',
    isAdminCliente: state.role === 'admin_cliente',
    isVendedor: state.role === 'vendedor',
    isCompras: state.role === 'compras',
    isContador: state.role === 'contador',
    isAdmin: state.role === 'super_admin' || state.role === 'admin_cliente',
    displayName: state.erpUser?.nombre || state.user?.email || 'Usuario',
    avatarUrl: state.erpUser?.avatar_url || state.user?.user_metadata?.avatar_url || null,
  }

  return React.createElement(AuthContext.Provider, { value }, children)
}

// Hook: consumes the shared context (single auth subscription for all consumers)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
