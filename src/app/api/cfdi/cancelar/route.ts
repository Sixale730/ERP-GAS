/**
 * API Route para Cancelar CFDI
 * POST /api/cfdi/cancelar
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cancel } from '@/lib/cfdi/finkok/cancel'
import {
  isFinkokConfigured,
  getFinkokConfigError,
  MotivoCancelacion,
  MOTIVOS_CANCELACION,
  getFinkokConfig,
} from '@/lib/config/finkok'
import { EMPRESA, EMPRESA_PRUEBAS } from '@/lib/config/empresa'

interface CancelarRequest {
  factura_id: string
  motivo: MotivoCancelacion
  uuid_sustitucion?: string
}

interface FacturaDB {
  id: string
  folio: string
  uuid_cfdi: string | null
  status_sat: string | null
  cliente_rfc: string | null
  total: number
}

export async function POST(request: NextRequest) {
  try {
    // Verificar configuracion de Finkok
    if (!isFinkokConfigured()) {
      const error = getFinkokConfigError()
      return NextResponse.json(
        {
          success: false,
          error: error || 'Finkok no esta configurado',
        },
        { status: 400 }
      )
    }

    // Obtener datos del body
    const body: CancelarRequest = await request.json()
    const { factura_id, motivo, uuid_sustitucion } = body

    if (!factura_id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere factura_id' },
        { status: 400 }
      )
    }

    if (!motivo || !MOTIVOS_CANCELACION[motivo]) {
      return NextResponse.json(
        {
          success: false,
          error: 'Se requiere un motivo de cancelacion valido (01, 02, 03, 04)',
        },
        { status: 400 }
      )
    }

    // Si motivo es 01, requiere UUID de sustitucion
    if (motivo === '01' && !uuid_sustitucion) {
      return NextResponse.json(
        {
          success: false,
          error: 'El motivo 01 requiere el UUID de la factura que sustituye',
        },
        { status: 400 }
      )
    }

    // Conectar a Supabase
    const supabase = await createServerSupabaseClient()

    // Verificar permisos del usuario (facturas.editar)
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
      .select('rol, permisos')
      .eq('auth_user_id', user.id)
      .single()

    if (!erpUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permiso facturas.editar
    const { getPermisosEfectivos } = await import('@/lib/permisos')
    const permisos = getPermisosEfectivos(erpUser.rol, erpUser.permisos)
    if (!permisos.facturas?.editar) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para cancelar facturas' },
        { status: 403 }
      )
    }

    // Obtener datos de la factura
    const { data: factura, error: errorFactura } = await supabase
      .schema('erp')
      .from('facturas')
      .select('id, folio, uuid_cfdi, status_sat, cliente_rfc, total')
      .eq('id', factura_id)
      .single<FacturaDB>()

    if (errorFactura || !factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que este timbrada
    if (factura.status_sat !== 'timbrado' || !factura.uuid_cfdi) {
      return NextResponse.json(
        {
          success: false,
          error: 'La factura no esta timbrada o ya fue cancelada',
        },
        { status: 400 }
      )
    }

    // Obtener RFC del emisor segun ambiente
    const config = getFinkokConfig()
    const empresa = config.environment === 'demo' ? EMPRESA_PRUEBAS : EMPRESA

    // Cancelar con Finkok
    const resultado = await cancel(
      factura.uuid_cfdi,
      empresa.rfc,
      motivo,
      uuid_sustitucion
    )

    if (!resultado.success) {
      return NextResponse.json(
        {
          success: false,
          error: resultado.error || 'Error al cancelar',
          codigo: resultado.codigo_error,
        },
        { status: 500 }
      )
    }

    // Actualizar en base de datos
    const { error: errorUpdate } = await supabase
      .schema('erp')
      .from('facturas')
      .update({
        status_sat: 'cancelado',
        acuse_cancelacion: resultado.acuse,
        motivo_cancelacion: motivo,
        uuid_sustitucion: uuid_sustitucion || null,
        // Tambien actualizar el status general de la factura
        status: 'cancelada',
      })
      .eq('id', factura_id)

    if (errorUpdate) {
      console.error('Error al guardar cancelacion en BD:', errorUpdate)
      return NextResponse.json({
        success: true,
        acuse: resultado.acuse,
        warning:
          'El CFDI fue cancelado pero hubo un error al guardar en la base de datos',
      })
    }

    return NextResponse.json({
      success: true,
      acuse: resultado.acuse,
      fecha_cancelacion: resultado.fecha_cancelacion,
      message: `CFDI cancelado exitosamente. Motivo: ${MOTIVOS_CANCELACION[motivo]}`,
    })
  } catch (error) {
    console.error('Error en API cancelar:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno',
      },
      { status: 500 }
    )
  }
}
