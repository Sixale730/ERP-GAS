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
      // Verificar si el usuario existe en erp.usuarios
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: erpUser } = await supabase
          .schema('erp')
          .from('usuarios')
          .select('id, is_active')
          .eq('auth_user_id', user.id)
          .single()

        // Si no existe en erp.usuarios, verificar invitacion pendiente
        if (!erpUser) {
          // Buscar invitacion por email
          const { data: invitacion } = await supabase
            .schema('erp')
            .from('invitaciones')
            .select('id, organizacion_id, rol, expira_at')
            .eq('email', user.email)
            .is('usado_at', null)
            .gt('expira_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (invitacion) {
            // Hay invitacion valida, crear usuario automaticamente
            const { error: createError } = await supabase
              .schema('erp')
              .from('usuarios')
              .insert({
                auth_user_id: user.id,
                organizacion_id: invitacion.organizacion_id,
                email: user.email!,
                nombre: user.user_metadata?.full_name || user.email,
                avatar_url: user.user_metadata?.avatar_url || null,
                rol: invitacion.rol,
                is_active: true,
              })

            if (!createError) {
              // Marcar invitacion como usada
              await supabase
                .schema('erp')
                .from('invitaciones')
                .update({ usado_at: new Date().toISOString() })
                .eq('id', invitacion.id)

              // Usuario creado, redirigir al dashboard
              return NextResponse.redirect(`${origin}${next}`)
            }
          }

          // No hay usuario ni invitacion valida
          return NextResponse.redirect(`${origin}/registro-pendiente`)
        }

        // Usuario existe pero esta desactivado
        if (!erpUser.is_active) {
          return NextResponse.redirect(
            `${origin}/registro-pendiente?reason=inactive`
          )
        }

        // Usuario existe y esta activo, redirigir al dashboard
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Error de autenticacion
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
