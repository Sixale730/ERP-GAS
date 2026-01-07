import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  // Si hay usuario y esta en login, redirigir al dashboard
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Si hay usuario pero no tiene rol en el ERP, redirigir a solicitar acceso
  if (user && !isPublicRoute) {
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.access_token) {
      try {
        const payload = JSON.parse(atob(session.access_token.split('.')[1]))
        const role = payload?.app_role

        // Si no tiene rol, no está registrado en el ERP
        if (!role) {
          return NextResponse.redirect(new URL('/solicitar-acceso', request.url))
        }
      } catch {
        // Error al decodificar, redirigir por seguridad
        return NextResponse.redirect(new URL('/solicitar-acceso', request.url))
      }
    }
  }

  // Proteger rutas de admin - verificar rol en el JWT
  if (user && request.nextUrl.pathname.startsWith('/configuracion/admin')) {
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.access_token) {
      try {
        // Decodificar JWT para obtener claims
        const payload = JSON.parse(atob(session.access_token.split('.')[1]))
        const role = payload?.app_role

        if (role !== 'super_admin') {
          // No es super admin, redirigir al dashboard
          return NextResponse.redirect(new URL('/', request.url))
        }
      } catch {
        // Error al decodificar, redirigir por seguridad
        return NextResponse.redirect(new URL('/', request.url))
      }
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
