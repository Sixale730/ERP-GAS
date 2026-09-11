/**
 * Autenticacion de las rutas /api/bot/* (asistente de Telegram).
 *
 * Bearer con el JWT del usuario dedicado del bot. El token viaja al cliente de
 * Supabase para que apliquen RLS y los permisos del usuario, igual que en la
 * web. Nunca se usa service_role.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type Accion = 'ver' | 'crear' | 'editar' | 'eliminar'

export interface SesionBot {
  supabase: SupabaseClient
  usuario: { id: string; nombre: string; organizacion_id: string }
}

/** Devuelve la sesion, o la respuesta de error lista para regresar. */
export async function autenticarBot(
  request: NextRequest,
  modulo: string,
  accion: Accion,
): Promise<SesionBot | NextResponse> {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  if (!token) return NextResponse.json({ success: false, error: 'Falta el token' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error: errUser } = await supabase.auth.getUser()
  if (errUser || !user) {
    return NextResponse.json({ success: false, error: 'Token invalido o expirado' }, { status: 401 })
  }

  const { data: erpUser } = await supabase
    .schema('erp')
    .from('usuarios')
    .select('id, nombre, rol, permisos, organizacion_id, is_active')
    .eq('auth_user_id', user.id)
    .single()
  if (!erpUser || !erpUser.is_active) {
    return NextResponse.json({ success: false, error: 'Usuario no autorizado' }, { status: 403 })
  }

  const { getPermisosEfectivos } = await import('@/lib/permisos')
  const permisos = getPermisosEfectivos(erpUser.rol, erpUser.permisos) as unknown as Record<
    string,
    Partial<Record<Accion, boolean>> | undefined
  >
  if (!permisos[modulo]?.[accion]) {
    return NextResponse.json({ success: false, error: `Sin permiso para ${accion} ${modulo}` }, { status: 403 })
  }

  return {
    supabase,
    usuario: { id: erpUser.id, nombre: erpUser.nombre, organizacion_id: erpUser.organizacion_id },
  }
}
