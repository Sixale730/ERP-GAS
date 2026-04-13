/**
 * API Route para gestionar RFCs registrados en Finkok
 * GET - Lista todos los RFCs registrados
 * POST - Registra un nuevo RFC
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCustomers, addClient, getClient } from '@/lib/cfdi/finkok/registration'
import { isFinkokConfigured, getFinkokConfig } from '@/lib/config/finkok'

/** Verifica autenticación y permisos de configuración CFDI */
async function verificarAuthConfig() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 }) }
  }
  const { data: erpUser } = await supabase
    .schema('erp').from('usuarios').select('rol, permisos')
    .eq('auth_user_id', user.id).single()
  if (!erpUser) {
    return { error: NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 }) }
  }
  const { getPermisosEfectivos } = await import('@/lib/permisos')
  const permisos = getPermisosEfectivos(erpUser.rol, erpUser.permisos)
  if (!permisos.configuracion?.editar) {
    return { error: NextResponse.json({ success: false, error: 'No tienes permisos para gestionar CFDI' }, { status: 403 }) }
  }
  return { user, erpUser }
}

export async function GET() {
  try {
    const auth = await verificarAuthConfig()
    if ('error' in auth) return auth.error

    if (!isFinkokConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Finkok no está configurado' },
        { status: 400 }
      )
    }

    const config = getFinkokConfig()
    const result = await getCustomers()

    return NextResponse.json({
      success: result.success,
      ambiente: config.environment,
      users: result.users || [],
      message: result.message,
      error: result.error,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener clientes',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verificarAuthConfig()
    if ('error' in auth) return auth.error

    if (!isFinkokConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Finkok no está configurado' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { taxpayer_id, type_user } = body

    if (!taxpayer_id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere taxpayer_id (RFC)' },
        { status: 400 }
      )
    }

    // Verificar si ya existe
    const existing = await getClient(taxpayer_id)
    if (existing.success && existing.users && existing.users.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'El RFC ya está registrado',
        already_exists: true,
        user: existing.users[0],
      })
    }

    // Registrar nuevo RFC
    // type_user: 'O' = OnDemand (ilimitado), 'P' = Prepago
    const result = await addClient({
      taxpayer_id,
      type_user: type_user || 'O',
    })

    return NextResponse.json({
      success: result.success,
      message: result.message,
      error: result.error,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al registrar RFC',
      },
      { status: 500 }
    )
  }
}
