import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

/** Extrae el rol del JWT access_token (decodificación local, sin network call) */
function getRoleFromJWT(accessToken: string): string | null {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]))
    return payload?.app_role || null
  } catch {
    return null
  }
}

/**
 * Intenta auto-registrar un usuario que tiene sesión de Supabase Auth
 * y está en usuarios_autorizados pero no en erp.usuarios.
 * Esto cubre el caso donde el auth callback falló en el primer login.
 */
async function tryAutoRegister(supabase: SupabaseClient, user: User): Promise<boolean> {
  try {
    if (!user.email) return false

    // Verificar si está en usuarios_autorizados con estado pendiente
    const { data: autorizado } = await supabase
      .schema('erp' as 'public')
      .from('usuarios_autorizados')
      .select('id')
      .ilike('email', user.email)
      .eq('estado', 'pendiente_registro')
      .maybeSingle()

    if (!autorizado) return false

    // Llamar al RPC para registrar al usuario
    const { error } = await supabase.rpc('registrar_usuario_autorizado', {
      p_auth_user_id: user.id,
      p_email: user.email,
      p_nombre: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
      p_avatar_url: user.user_metadata?.avatar_url || null,
    })

    return !error
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refrescar sesion si existe
  const { data: { user } } = await supabase.auth.getUser()

  // Rutas publicas (no requieren auth)
  const publicRoutes = ['/login', '/auth/callback', '/invitacion', '/registro-pendiente', '/setup', '/solicitar-acceso', '/solicitud-pendiente']
  const isPublicRoute = publicRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Si no hay usuario y la ruta no es publica, redirigir a login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si hay usuario y esta en login, redirigir segun rol
  if (user && request.nextUrl.pathname === '/login') {
    // Determinar rol desde JWT para decidir destino post-login
    const { data: { session } } = await supabase.auth.getSession()
    const loginRole = session?.access_token ? getRoleFromJWT(session.access_token) : null
    if (loginRole === 'super_admin') {
      return NextResponse.redirect(new URL('/modulos', request.url))
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Para rutas protegidas, verificar que el usuario tiene rol en el ERP
  // Usamos el JWT para evitar queries a BD en cada navegación
  if (user && !isPublicRoute) {
    // getSession() lee de cookies (local, sin network call) - seguro tras getUser()
    const { data: { session } } = await supabase.auth.getSession()
    let role = session?.access_token ? getRoleFromJWT(session.access_token) : null

    // Si no hay rol en el JWT, el usuario podría ser nuevo (primer login)
    // Solo en este caso hacemos query a BD
    if (!role) {
      const { data: erpUser } = await supabase
        .schema('erp' as 'public')
        .from('usuarios')
        .select('id, rol, is_active')
        .eq('auth_user_id', user.id)
        .single()

      if (erpUser && erpUser.is_active) {
        role = erpUser.rol
      } else {
        // No existe en erp.usuarios - intentar auto-registro
        const autoRegistered = await tryAutoRegister(supabase, user)
        if (!autoRegistered) {
          return NextResponse.redirect(new URL('/solicitud-pendiente', request.url))
        }
      }
    }

    // Proteger rutas de admin
    if (request.nextUrl.pathname.startsWith('/configuracion/admin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)
     * - icons/ (PWA icons)
     * - api/ routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)',
  ],
}
