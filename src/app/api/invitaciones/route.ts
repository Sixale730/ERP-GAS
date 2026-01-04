import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

// Generar token unico
function generateToken(): string {
  return randomBytes(32).toString('hex')
}

// POST: Crear invitacion
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Verificar autenticacion
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener usuario del ERP
    const { data: erpUser } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('id, organizacion_id, rol')
      .eq('auth_user_id', user.id)
      .single()

    if (!erpUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Solo admin_cliente o super_admin pueden invitar
    if (!['super_admin', 'admin_cliente'].includes(erpUser.rol)) {
      return NextResponse.json(
        { error: 'No tienes permisos para invitar usuarios' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, rol } = body

    if (!email || !rol) {
      return NextResponse.json(
        { error: 'Email y rol son requeridos' },
        { status: 400 }
      )
    }

    // Validar rol permitido
    if (!['admin_cliente', 'vendedor'].includes(rol)) {
      return NextResponse.json({ error: 'Rol no valido' }, { status: 400 })
    }

    // admin_cliente solo puede invitar vendedores
    if (erpUser.rol === 'admin_cliente' && rol !== 'vendedor') {
      return NextResponse.json(
        { error: 'Solo puedes invitar vendedores' },
        { status: 403 }
      )
    }

    // Verificar que el email no tenga ya un usuario
    const { data: existingUser } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email ya tiene una cuenta' },
        { status: 400 }
      )
    }

    // Verificar que no haya invitacion pendiente
    const { data: existingInvitation } = await supabase
      .schema('erp')
      .from('invitaciones')
      .select('id')
      .eq('email', email)
      .is('usado_at', null)
      .gt('expira_at', new Date().toISOString())
      .single()

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'Ya existe una invitacion pendiente para este email' },
        { status: 400 }
      )
    }

    // Crear invitacion
    const token = generateToken()
    const expira = new Date()
    expira.setDate(expira.getDate() + 7) // Expira en 7 dias

    const { error: insertError } = await supabase
      .schema('erp')
      .from('invitaciones')
      .insert({
        organizacion_id: erpUser.organizacion_id,
        email,
        rol,
        token,
        invitado_por: erpUser.id,
        expira_at: expira.toISOString(),
      })

    if (insertError) {
      console.error('Error al crear invitacion:', insertError)
      return NextResponse.json(
        { error: 'Error al crear invitacion' },
        { status: 500 }
      )
    }

    // TODO: Enviar email con el link de invitacion
    // Por ahora solo devolvemos el token para testing
    const inviteUrl = `${request.nextUrl.origin}/invitacion/${token}`

    return NextResponse.json({
      success: true,
      message: 'Invitacion creada',
      inviteUrl, // Solo para desarrollo/testing
    })
  } catch (error) {
    console.error('Error en API invitaciones:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// GET: Verificar invitacion por token
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token requerido' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    const { data: invitacion, error } = await supabase
      .schema('erp')
      .from('invitaciones')
      .select(
        `
        id,
        email,
        rol,
        expira_at,
        organizacion:organizacion_id (
          id,
          nombre,
          codigo
        )
      `
      )
      .eq('token', token)
      .is('usado_at', null)
      .gt('expira_at', new Date().toISOString())
      .single()

    if (error || !invitacion) {
      return NextResponse.json(
        { error: 'Invitacion no valida o expirada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      valid: true,
      email: invitacion.email,
      rol: invitacion.rol,
      organizacion: invitacion.organizacion,
    })
  } catch (error) {
    console.error('Error verificando invitacion:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
