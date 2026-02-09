import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Permisos default por rol (duplicado de usePermisos.ts para uso server-side)
const ALL = { ver: true, crear: true, editar: true, eliminar: true }
const VIEW_ONLY = { ver: true, crear: false, editar: false, eliminar: false }
const VCE = { ver: true, crear: true, editar: true, eliminar: false }
const NONE = { ver: false, crear: false, editar: false, eliminar: false }

const PERMISOS_DEFAULT: Record<string, Record<string, { ver: boolean; crear: boolean; editar: boolean; eliminar: boolean }>> = {
  super_admin: { productos: ALL, inventario: ALL, clientes: ALL, cotizaciones: ALL, ordenes_venta: ALL, facturas: ALL, compras: ALL, reportes: ALL, catalogos: ALL, configuracion: ALL },
  admin_cliente: { productos: ALL, inventario: ALL, clientes: ALL, cotizaciones: ALL, ordenes_venta: ALL, facturas: ALL, compras: ALL, reportes: ALL, catalogos: ALL, configuracion: VCE },
  vendedor: { productos: VIEW_ONLY, inventario: VIEW_ONLY, clientes: VCE, cotizaciones: VCE, ordenes_venta: VCE, facturas: VIEW_ONLY, compras: NONE, reportes: VIEW_ONLY, catalogos: VIEW_ONLY, configuracion: NONE },
  compras: { productos: ALL, inventario: ALL, clientes: VIEW_ONLY, cotizaciones: VIEW_ONLY, ordenes_venta: VIEW_ONLY, facturas: VIEW_ONLY, compras: ALL, reportes: VIEW_ONLY, catalogos: VCE, configuracion: NONE },
  contador: { productos: VIEW_ONLY, inventario: VIEW_ONLY, clientes: VCE, cotizaciones: VIEW_ONLY, ordenes_venta: VIEW_ONLY, facturas: ALL, compras: VIEW_ONLY, reportes: ALL, catalogos: VIEW_ONLY, configuracion: NONE },
}

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

    const { solicitudId, accion, rol, notas, permisos } = body

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

      // Validar rol permitido
      if (!['super_admin', 'admin_cliente', 'vendedor', 'compras', 'contador'].includes(rolAsignado)) {
        return NextResponse.json({ error: 'Rol no válido' }, { status: 400 })
      }

      // Solo super_admin puede asignar super_admin
      if (rolAsignado === 'super_admin' && erpUser.rol !== 'super_admin') {
        return NextResponse.json({ error: 'Solo super_admin puede crear otros super_admin' }, { status: 403 })
      }

      // admin_cliente puede asignar vendedor, compras, contador
      if (erpUser.rol === 'admin_cliente' && !['vendedor', 'compras', 'contador'].includes(rolAsignado)) {
        return NextResponse.json({ error: 'Solo puedes asignar roles: vendedor, compras, contador' }, { status: 403 })
      }

      // Determinar si los permisos son custom o default
      const defaults = PERMISOS_DEFAULT[rolAsignado as keyof typeof PERMISOS_DEFAULT]
      const isDefaultPermisos = !permisos || JSON.stringify(permisos) === JSON.stringify(defaults)
      const permisosToSave = isDefaultPermisos ? null : permisos

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
          permisos: permisosToSave,
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
