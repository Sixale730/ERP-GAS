/**
 * API Route para Reiniciar Sistema Transaccional
 * GET /api/admin/reiniciar-sistema - Obtener conteos actuales
 * POST /api/admin/reiniciar-sistema - Ejecutar reinicio
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const CONFIRM_PHRASE = 'CONFIRMO REINICIAR SISTEMA'

interface ReiniciarRequest {
  confirmacion: string
}

// GET: Obtener conteos de registros a eliminar
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Consultar conteos actuales en paralelo
    const [
      cotizaciones,
      facturas,
      ordenes,
      pagos,
      movimientos,
      recepciones,
    ] = await Promise.all([
      supabase.schema('erp').from('cotizaciones').select('*', { count: 'exact', head: true }),
      supabase.schema('erp').from('facturas').select('*', { count: 'exact', head: true }),
      supabase.schema('erp').from('ordenes_compra').select('*', { count: 'exact', head: true }),
      supabase.schema('erp').from('pagos').select('*', { count: 'exact', head: true }),
      supabase.schema('erp').from('movimientos_inventario').select('*', { count: 'exact', head: true }),
      supabase.schema('erp').from('recepciones_orden').select('*', { count: 'exact', head: true }),
    ])

    return NextResponse.json({
      success: true,
      conteos: {
        cotizaciones: cotizaciones.count || 0,
        facturas: facturas.count || 0,
        ordenes_compra: ordenes.count || 0,
        pagos: pagos.count || 0,
        movimientos_inventario: movimientos.count || 0,
        recepciones_orden: recepciones.count || 0,
      }
    })
  } catch (error) {
    console.error('Error al obtener conteos:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener conteos' },
      { status: 500 }
    )
  }
}

// POST: Ejecutar reinicio del sistema
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Verificar que el usuario sea super_admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { data: erpUser } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('rol')
      .eq('auth_user_id', user.id)
      .single()

    if (!erpUser || erpUser.rol !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Solo super_admin puede reiniciar el sistema' },
        { status: 403 }
      )
    }

    const body: ReiniciarRequest = await request.json()

    // Validar confirmacion textual exacta
    if (body.confirmacion !== CONFIRM_PHRASE) {
      return NextResponse.json(
        { success: false, error: 'Confirmacion incorrecta. Debe escribir la frase exacta.' },
        { status: 400 }
      )
    }

    // Llamar a la funcion SQL que hace el reinicio atomico
    const { data, error } = await supabase.schema('erp').rpc('reiniciar_sistema_transaccional')

    if (error) {
      console.error('Error al reiniciar sistema:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // La funcion SQL retorna un objeto jsonb
    if (data && typeof data === 'object' && 'success' in data) {
      if (!data.success) {
        return NextResponse.json(
          { success: false, error: data.error || 'Error desconocido en la funcion SQL' },
          { status: 500 }
        )
      }
      return NextResponse.json(data)
    }

    return NextResponse.json({
      success: true,
      mensaje: 'Sistema reiniciado exitosamente',
      fecha_ejecucion: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error en API reiniciar:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
