import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

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
          .eq('email', user.email)
          .eq('estado', 'pendiente_registro')
          .limit(1)
          .single()

        if (autorizado) {
          // Está autorizado, crear usuario automáticamente
          const { error: createError } = await supabase
            .schema('erp')
            .from('usuarios')
            .insert({
              auth_user_id: user.id,
              organizacion_id: autorizado.organizacion_id,
              email: user.email!,
              nombre: autorizado.nombre || user.user_metadata?.full_name || user.email,
              avatar_url: user.user_metadata?.avatar_url || null,
              rol: autorizado.rol,
              is_active: true,
            })

          if (!createError) {
            // Actualizar estado del registro autorizado
            await supabase
              .schema('erp')
              .from('usuarios_autorizados')
              .update({ estado: 'activo' })
              .eq('id', autorizado.id)

            // Usuario creado, ir al dashboard
            return NextResponse.redirect(`${origin}${next}`)
          }
        }

        // 3. No está autorizado, verificar si ya tiene solicitud pendiente
        const { data: solicitudExistente } = await supabase
          .schema('erp')
          .from('solicitudes_acceso')
          .select('id, estado')
          .eq('auth_user_id', user.id)
          .eq('estado', 'pendiente')
          .limit(1)
          .single()

        if (solicitudExistente) {
          // Ya tiene solicitud pendiente
          return NextResponse.redirect(`${origin}/solicitud-pendiente`)
        }

        // 4. Verificar si tiene solicitud rechazada reciente (últimas 24h)
        const hace24h = new Date()
        hace24h.setHours(hace24h.getHours() - 24)

        const { data: solicitudRechazada } = await supabase
          .schema('erp')
          .from('solicitudes_acceso')
          .select('id')
          .eq('auth_user_id', user.id)
          .eq('estado', 'rechazada')
          .gt('revisado_at', hace24h.toISOString())
          .limit(1)
          .single()

        if (solicitudRechazada) {
          return NextResponse.redirect(
            `${origin}/registro-pendiente?reason=rejected`
          )
        }

        // 5. No tiene autorización ni solicitud, redirigir para solicitar acceso
        return NextResponse.redirect(`${origin}/solicitar-acceso`)
      }
    }
  }

  // Error de autenticación
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
