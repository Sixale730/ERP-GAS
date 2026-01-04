import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST: Crear primer super admin
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

    // Verificar si ya existe algun super_admin
    const { data: existingSuperAdmin } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('id')
      .eq('rol', 'super_admin')
      .limit(1)
      .single()

    if (existingSuperAdmin) {
      return NextResponse.json(
        { error: 'Ya existe un super admin en el sistema' },
        { status: 400 }
      )
    }

    // Crear el super admin usando la funcion de la base de datos
    const { data, error } = await supabase.rpc('crear_super_admin_inicial', {
      p_auth_user_id: user.id,
      p_email: user.email,
      p_nombre: user.user_metadata?.full_name || user.email,
      p_avatar_url: user.user_metadata?.avatar_url || null,
    })

    if (error) {
      console.error('Error creando super admin:', error)
      return NextResponse.json(
        { error: 'Error al crear super admin' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Super admin creado exitosamente',
      userId: data,
    })
  } catch (error) {
    console.error('Error en setup:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// GET: Verificar si necesita setup inicial
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Verificar si ya existe algun super_admin
    const { data: existingSuperAdmin } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('id')
      .eq('rol', 'super_admin')
      .limit(1)
      .single()

    return NextResponse.json({
      needsSetup: !existingSuperAdmin,
    })
  } catch (error) {
    console.error('Error verificando setup:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
