import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Obtener solicitudes de acceso (para admins)
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener usuario ERP para verificar permisos
    const { data: erpUser } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('id, organizacion_id, rol')
      .eq('auth_user_id', user.id)
      .single()

    if (!erpUser || !['super_admin', 'admin_cliente'].includes(erpUser.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // Obtener solicitudes según el rol
    let query = supabase
      .schema('erp')
      .from('solicitudes_acceso')
      .select(`
        id,
        email,
        nombre,
        avatar_url,
        estado,
        created_at,
        revisado_at,
        notas,
        organizaciones:organizacion_id (id, nombre, codigo)
      `)
      .order('created_at', { ascending: false })

    // Si no es super_admin, solo ver solicitudes de su organización
    if (erpUser.rol !== 'super_admin') {
      query = query.eq('organizacion_id', erpUser.organizacion_id)
    }

    const { data: solicitudes, error } = await query

    if (error) {
      console.error('Error al obtener solicitudes:', error)
      return NextResponse.json({ error: 'Error al obtener solicitudes' }, { status: 500 })
    }

    return NextResponse.json({ solicitudes })
  } catch (err) {
    console.error('Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: Aprobar o rechazar solicitud
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const { solicitudId, accion, rol, notas } = body

    if (!solicitudId || !accion || !['aprobar', 'rechazar'].includes(accion)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener usuario ERP para verificar permisos
    const { data: erpUser } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('id, organizacion_id, rol')
      .eq('auth_user_id', user.id)
      .single()

    if (!erpUser || !['super_admin', 'admin_cliente'].includes(erpUser.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // Obtener la solicitud
    const { data: solicitud } = await supabase
      .schema('erp')
      .from('solicitudes_acceso')
      .select('*')
      .eq('id', solicitudId)
      .single()

    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    // Verificar que puede gestionar esta solicitud
    if (erpUser.rol !== 'super_admin' && solicitud.organizacion_id !== erpUser.organizacion_id) {
      return NextResponse.json({ error: 'Sin permisos para esta solicitud' }, { status: 403 })
    }

    if (accion === 'aprobar') {
      // Determinar rol a asignar
      const rolAsignado = rol || 'vendedor'

      // admin_cliente solo puede asignar vendedor
      if (erpUser.rol === 'admin_cliente' && rolAsignado !== 'vendedor') {
        return NextResponse.json({ error: 'Solo puedes asignar rol vendedor' }, { status: 403 })
      }

      // Crear usuario en erp.usuarios
      const { error: createError } = await supabase
        .schema('erp')
        .from('usuarios')
        .insert({
          auth_user_id: solicitud.auth_user_id,
          organizacion_id: solicitud.organizacion_id,
          email: solicitud.email,
          nombre: solicitud.nombre,
          avatar_url: solicitud.avatar_url,
          rol: rolAsignado,
          is_active: true,
        })

      if (createError) {
        console.error('Error al crear usuario:', createError)
        return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
      }

      // Actualizar solicitud como aprobada
      await supabase
        .schema('erp')
        .from('solicitudes_acceso')
        .update({
          estado: 'aprobada',
          revisado_por: erpUser.id,
          revisado_at: new Date().toISOString(),
          notas: notas || null,
        })
        .eq('id', solicitudId)

      return NextResponse.json({
        success: true,
        message: 'Usuario aprobado y creado correctamente'
      })
    } else {
      // Rechazar solicitud
      await supabase
        .schema('erp')
        .from('solicitudes_acceso')
        .update({
          estado: 'rechazada',
          revisado_por: erpUser.id,
          revisado_at: new Date().toISOString(),
          notas: notas || null,
        })
        .eq('id', solicitudId)

      return NextResponse.json({
        success: true,
        message: 'Solicitud rechazada'
      })
    }
  } catch (err) {
    console.error('Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
