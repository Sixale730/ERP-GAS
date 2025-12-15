/**
 * API Route para gestionar RFCs registrados en Finkok
 * GET - Lista todos los RFCs registrados
 * POST - Registra un nuevo RFC
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCustomers, addClient, getClient } from '@/lib/cfdi/finkok/registration'
import { isFinkokConfigured, getFinkokConfig } from '@/lib/config/finkok'

export async function GET() {
  try {
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
