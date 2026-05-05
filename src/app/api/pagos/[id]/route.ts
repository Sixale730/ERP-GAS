/**
 * API Route para edicion de un pago existente.
 * PATCH /api/pagos/[id]
 *
 * Solo accesible para super_admin y admin_cliente. Llama a la RPC
 * erp.editar_pago que ajusta saldos en cascada (factura, cliente, sucursal).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const FORMAS_PAGO_VALIDAS = [
  '01', '02', '03', '04', '05', '06', '08', '12', '13', '14', '15',
  '17', '23', '24', '25', '26', '27', '28', '29', '30', '31', '99',
]

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const { monto, fecha, metodo_pago, referencia, notas } = await request.json()

    // Validaciones basicas
    if (!id) {
      return NextResponse.json({ success: false, error: 'Se requiere el id del pago' }, { status: 400 })
    }
    if (monto === undefined || monto === null || Number(monto) <= 0) {
      return NextResponse.json({ success: false, error: 'El monto debe ser mayor a 0' }, { status: 400 })
    }
    if (!fecha) {
      return NextResponse.json({ success: false, error: 'Se requiere la fecha del pago' }, { status: 400 })
    }
    if (metodo_pago && !FORMAS_PAGO_VALIDAS.includes(metodo_pago)) {
      return NextResponse.json({ success: false, error: 'Forma de pago invalida' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { data: erpUser } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('rol, organizacion_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!erpUser) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Gate: solo super_admin y admin_cliente pueden editar pagos
    const ROLES_PERMITIDOS = ['super_admin', 'admin_cliente']
    if (!ROLES_PERMITIDOS.includes(erpUser.rol)) {
      return NextResponse.json(
        { success: false, error: 'Solo administradores pueden editar pagos' },
        { status: 403 }
      )
    }

    // Verificar que el pago pertenece a la organizacion del usuario
    const { data: pago, error: errorPago } = await supabase
      .schema('erp')
      .from('pagos')
      .select('id, factura_id, organizacion_id, folio')
      .eq('id', id)
      .single()

    if (errorPago || !pago) {
      return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })
    }

    if (pago.organizacion_id !== erpUser.organizacion_id && erpUser.rol !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Sin permisos para este pago' }, { status: 403 })
    }

    // Llamar RPC que ajusta saldos en cascada
    const { error: errorRpc } = await supabase.schema('erp').rpc('editar_pago', {
      p_pago_id: id,
      p_monto: Number(monto),
      p_fecha: fecha,
      p_metodo_pago: metodo_pago || '03',
      p_referencia: referencia || null,
      p_notas: notas || null,
    })

    if (errorRpc) {
      console.error('Error al editar pago:', errorRpc)
      return NextResponse.json(
        { success: false, error: 'Error al editar el pago: ' + errorRpc.message },
        { status: 500 }
      )
    }

    // Recargar factura actualizada
    const { data: facturaActualizada } = await supabase
      .schema('erp')
      .from('facturas')
      .select('id, folio, total, saldo, monto_pagado, status')
      .eq('id', pago.factura_id)
      .single()

    return NextResponse.json({
      success: true,
      pago_id: id,
      factura_actualizada: facturaActualizada,
      message: `Pago ${pago.folio} actualizado exitosamente`,
    })
  } catch (error) {
    console.error('Error en API pagos PATCH:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
