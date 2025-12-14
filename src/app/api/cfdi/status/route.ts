/**
 * API Route para Consultar Status de CFDI
 * GET /api/cfdi/status?factura_id=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSatStatus } from '@/lib/cfdi/finkok/cancel'
import { verificarConexion } from '@/lib/cfdi/finkok/client'
import { verificarCertificados } from '@/lib/cfdi/sello'
import {
  isFinkokConfigured,
  getFinkokConfig,
} from '@/lib/config/finkok'
import { EMPRESA, EMPRESA_PRUEBAS } from '@/lib/config/empresa'

interface FacturaDB {
  id: string
  folio: string
  uuid_cfdi: string | null
  status_sat: string | null
  cliente_rfc: string | null
  total: number
  fecha_timbrado: string | null
  xml_cfdi: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const factura_id = searchParams.get('factura_id')
    const verificar = searchParams.get('verificar') // Para verificar config sin factura

    // Si solo quiere verificar la configuracion
    if (verificar === 'config') {
      const configStatus = {
        finkok_configurado: isFinkokConfigured(),
        ambiente: getFinkokConfig().environment,
        certificados: verificarCertificados(),
        conexion: null as Awaited<ReturnType<typeof verificarConexion>> | null,
      }

      // Solo verificar conexion si hay credenciales
      if (configStatus.finkok_configurado) {
        configStatus.conexion = await verificarConexion()
      }

      return NextResponse.json({
        success: true,
        config: configStatus,
      })
    }

    // Requiere factura_id para consultar status
    if (!factura_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Se requiere factura_id o verificar=config',
        },
        { status: 400 }
      )
    }

    // Conectar a Supabase
    const supabase = await createServerSupabaseClient()

    // Obtener datos de la factura
    const { data: factura, error: errorFactura } = await supabase
      .schema('erp')
      .from('facturas')
      .select(
        'id, folio, uuid_cfdi, status_sat, cliente_rfc, total, fecha_timbrado, xml_cfdi'
      )
      .eq('id', factura_id)
      .single<FacturaDB>()

    if (errorFactura || !factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    // Si no esta timbrada, retornar status local
    if (!factura.uuid_cfdi) {
      return NextResponse.json({
        success: true,
        factura_id: factura.id,
        folio: factura.folio,
        status_local: factura.status_sat || 'pendiente',
        timbrado: false,
        message: 'La factura no ha sido timbrada',
      })
    }

    // Si esta timbrada y hay credenciales, consultar al SAT
    let statusSAT = null
    if (isFinkokConfigured() && factura.cliente_rfc) {
      const config = getFinkokConfig()
      const empresa = config.environment === 'demo' ? EMPRESA_PRUEBAS : EMPRESA

      statusSAT = await getSatStatus(
        factura.uuid_cfdi,
        empresa.rfc,
        factura.cliente_rfc,
        factura.total.toFixed(2)
      )
    }

    return NextResponse.json({
      success: true,
      factura_id: factura.id,
      folio: factura.folio,
      uuid: factura.uuid_cfdi,
      status_local: factura.status_sat,
      fecha_timbrado: factura.fecha_timbrado,
      timbrado: true,
      tiene_xml: Boolean(factura.xml_cfdi),
      status_sat: statusSAT?.success
        ? {
            estado: statusSAT.status,
            es_cancelable: statusSAT.es_cancelable,
            estado_cancelacion: statusSAT.estado_cancelacion,
          }
        : null,
    })
  } catch (error) {
    console.error('Error en API status:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno',
      },
      { status: 500 }
    )
  }
}

/**
 * POST para descargar el XML de una factura
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { factura_id } = body

    if (!factura_id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere factura_id' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    const { data: factura, error } = await supabase
      .schema('erp')
      .from('facturas')
      .select('folio, uuid_cfdi, xml_cfdi')
      .eq('id', factura_id)
      .single<{ folio: string; uuid_cfdi: string | null; xml_cfdi: string | null }>()

    if (error || !factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    if (!factura.xml_cfdi) {
      return NextResponse.json(
        { success: false, error: 'La factura no tiene XML' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      folio: factura.folio,
      uuid: factura.uuid_cfdi,
      xml: factura.xml_cfdi,
    })
  } catch (error) {
    console.error('Error al obtener XML:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno',
      },
      { status: 500 }
    )
  }
}
