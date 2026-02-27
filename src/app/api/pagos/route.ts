/**
 * API Route para Pagos
 * POST /api/pagos - Registrar un pago
 * GET /api/pagos?factura_id=xxx - Listar pagos de una factura
 *
 * El trigger trg_registrar_pago en la BD automaticamente:
 * - Actualiza monto_pagado y saldo en la factura
 * - Cambia status a 'parcial' o 'pagada'
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const FORMAS_PAGO_VALIDAS = ['01', '02', '03', '04', '05', '06', '08', '12', '13', '14', '15', '17', '23', '24', '25', '26', '27', '28', '29', '30', '31', '99']

export async function POST(request: NextRequest) {
  try {
    const { factura_id, monto, fecha, metodo_pago, referencia, notas } = await request.json()

    // Validaciones basicas
    if (!factura_id) {
      return NextResponse.json({ success: false, error: 'Se requiere factura_id' }, { status: 400 })
    }
    if (!monto || monto <= 0) {
      return NextResponse.json({ success: false, error: 'El monto debe ser mayor a 0' }, { status: 400 })
    }
    if (!fecha) {
      return NextResponse.json({ success: false, error: 'Se requiere la fecha del pago' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Verificar autenticacion
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos
    const { data: erpUser } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('rol, permisos')
      .eq('auth_user_id', user.id)
      .single()

    if (!erpUser) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { getPermisosEfectivos } = await import('@/lib/permisos')
    const permisos = getPermisosEfectivos(erpUser.rol, erpUser.permisos)
    if (!permisos.facturas?.editar) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para registrar pagos' },
        { status: 403 }
      )
    }

    // Verificar que la factura existe y obtener saldo
    const { data: factura, error: errorFactura } = await supabase
      .schema('erp')
      .from('facturas')
      .select('id, folio, total, saldo, status, cliente_id, organizacion_id')
      .eq('id', factura_id)
      .single()

    if (errorFactura || !factura) {
      return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 })
    }

    if (factura.status === 'cancelada') {
      return NextResponse.json({ success: false, error: 'No se puede pagar una factura cancelada' }, { status: 400 })
    }

    if (monto > factura.saldo) {
      return NextResponse.json(
        { success: false, error: `El monto ($${monto}) excede el saldo pendiente ($${factura.saldo})` },
        { status: 400 }
      )
    }

    // Generar folio de pago
    const { data: folioData } = await supabase.schema('erp').rpc('generar_folio', { tipo: 'pago' })
    const folio = folioData || `PAG-${Date.now()}`

    // Insertar pago (el trigger trg_registrar_pago actualiza la factura automaticamente)
    const { data: pago, error: errorPago } = await supabase
      .schema('erp')
      .from('pagos')
      .insert({
        factura_id,
        folio,
        monto,
        fecha,
        metodo_pago: metodo_pago || '03', // Transferencia por defecto
        referencia: referencia || null,
        notas: notas || null,
        organizacion_id: factura.organizacion_id,
      })
      .select()
      .single()

    if (errorPago) {
      console.error('Error al registrar pago:', errorPago)
      return NextResponse.json(
        { success: false, error: 'Error al registrar el pago: ' + errorPago.message },
        { status: 500 }
      )
    }

    // Recargar factura actualizada (el trigger ya la actualizo)
    const { data: facturaActualizada } = await supabase
      .schema('erp')
      .from('facturas')
      .select('id, folio, total, saldo, monto_pagado, status')
      .eq('id', factura_id)
      .single()

    return NextResponse.json({
      success: true,
      pago,
      factura_actualizada: facturaActualizada,
      message: `Pago ${folio} registrado exitosamente`,
    })
  } catch (error) {
    console.error('Error en API pagos POST:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const factura_id = searchParams.get('factura_id')

    if (!factura_id) {
      return NextResponse.json({ success: false, error: 'Se requiere factura_id' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Verificar autenticacion
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { data: pagos, error } = await supabase
      .schema('erp')
      .from('pagos')
      .select('*')
      .eq('factura_id', factura_id)
      .order('fecha', { ascending: true })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, pagos: pagos || [] })
  } catch (error) {
    console.error('Error en API pagos GET:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
