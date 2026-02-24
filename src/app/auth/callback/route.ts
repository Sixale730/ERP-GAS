import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.error('[auth/callback] exchangeCodeForSession error:', error)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // 1. Verificar si el usuario ya existe en erp.usuarios
        const { data: erpUser } = await supabase
          .schema('erp')
          .from('usuarios')
          .select('id, is_active')
          .eq('auth_user_id', user.id)
          .single()

        if (erpUser) {
          // Usuario existe
          if (!erpUser.is_active) {
            return NextResponse.redirect(
              `${origin}/registro-pendiente?reason=inactive`
            )
          }
          // Usuario activo, ir al dashboard
          return NextResponse.redirect(`${origin}${next}`)
        }

        // 2. Usuario no existe, verificar si está en usuarios_autorizados
        const { data: autorizado } = await supabase
          .schema('erp')
          .from('usuarios_autorizados')
          .select('id, organizacion_id, rol, nombre, estado')
          .ilike('email', user.email!)
          .eq('estado', 'pendiente_registro')
          .limit(1)
          .single()

        if (autorizado) {
          // Está autorizado, crear usuario automáticamente usando RPC
          // (SECURITY DEFINER bypasea RLS para el auto-registro)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: createError } = await (supabase.rpc as any)(
            'registrar_usuario_autorizado',
            {
              p_auth_user_id: user.id,
              p_email: user.email!,
              p_nombre: user.user_metadata?.full_name || autorizado.nombre || user.email,
              p_avatar_url: user.user_metadata?.avatar_url || null,
            }
          )

          if (!createError) {
            // Usuario creado, ir al dashboard
            return NextResponse.redirect(`${origin}${next}`)
          }
        }

        // 3. No autorizado: crear solicitud de acceso vía RPC (maneja idempotencia y rechazos)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: solicitudError } = await (supabase.rpc as any)(
          'crear_solicitud_acceso',
          {
            p_auth_user_id: user.id,
            p_email: user.email!,
            p_nombre: user.user_metadata?.full_name || user.email,
            p_avatar_url: user.user_metadata?.avatar_url || null,
          }
        )

        if (solicitudError) {
          if (solicitudError.message?.includes('rechazada recientemente')) {
            return NextResponse.redirect(`${origin}/registro-pendiente?reason=rejected`)
          }
          // RPC falló, redirigir a formulario manual como fallback
          return NextResponse.redirect(`${origin}/solicitar-acceso`)
        }

        return NextResponse.redirect(`${origin}/solicitud-pendiente`)
      }
    }
  }

  // Error de autenticación
  const errorMsg = code ? 'code_exchange_failed' : 'no_code'
  return NextResponse.redirect(`${origin}/login?error=${errorMsg}`)
}
