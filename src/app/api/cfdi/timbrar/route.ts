/**
 * API Route para Timbrar CFDI
 * POST /api/cfdi/timbrar
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  generarPreCFDI,
  generarCadenaOriginal,
  agregarSelloYCertificado,
  validarDatosFactura,
} from '@/lib/cfdi/xml-builder'
import { firmarCFDI } from '@/lib/cfdi/sello'
import { timbrar } from '@/lib/cfdi/finkok/stamp'
import { DatosFacturaCFDI, ItemFacturaCFDI } from '@/lib/cfdi/types'
import { isFinkokConfigured, getFinkokConfigError } from '@/lib/config/finkok'

interface TimbrarRequest {
  factura_id: string
}

interface FacturaDB {
  id: string
  folio: string
  serie: string | null
  fecha: string
  fecha_vencimiento: string | null
  subtotal: number
  descuento_monto: number
  iva: number
  total: number
  notas: string | null
  cliente_rfc: string | null
  cliente_razon_social: string | null
  cliente_regimen_fiscal: string | null
  cliente_uso_cfdi: string | null
  status_sat: string | null
  uuid_cfdi: string | null
  cliente_id: string | null
}

interface ClienteDB {
  codigo_postal_fiscal: string | null
  forma_pago: string | null
  metodo_pago: string | null
  moneda: string | null
}

interface FacturaItemDB {
  id: string
  producto_id: string | null
  descripcion: string | null
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  subtotal: number
  productos: {
    sku: string | null
    nombre: string
  } | null
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

    // Obtener factura_id del body
    const body: TimbrarRequest = await request.json()
    const { factura_id } = body

    if (!factura_id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere factura_id' },
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
        `
        id,
        folio,
        serie,
        fecha,
        fecha_vencimiento,
        subtotal,
        descuento_monto,
        iva,
        total,
        notas,
        cliente_rfc,
        cliente_razon_social,
        cliente_regimen_fiscal,
        cliente_uso_cfdi,
        status_sat,
        uuid_cfdi,
        cliente_id
      `
      )
      .eq('id', factura_id)
      .single<FacturaDB>()

    if (errorFactura || !factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que no este ya timbrada
    if (factura.status_sat === 'timbrado' && factura.uuid_cfdi) {
      return NextResponse.json(
        {
          success: false,
          error: 'La factura ya esta timbrada',
          uuid: factura.uuid_cfdi,
        },
        { status: 400 }
      )
    }

    // Obtener datos adicionales del cliente
    let clienteData: ClienteDB | null = null
    if (factura.cliente_id) {
      const { data } = await supabase
        .schema('erp')
        .from('clientes')
        .select('codigo_postal_fiscal, forma_pago, metodo_pago, moneda')
        .eq('id', factura.cliente_id)
        .single<ClienteDB>()
      clienteData = data
    }

    // Obtener items de la factura
    const { data: items, error: errorItems } = await supabase
      .schema('erp')
      .from('factura_items')
      .select(
        `
        id,
        producto_id,
        descripcion,
        cantidad,
        precio_unitario,
        descuento_porcentaje,
        subtotal,
        productos (
          sku,
          nombre
        )
      `
      )
      .eq('factura_id', factura_id)
      .returns<FacturaItemDB[]>()

    if (errorItems || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'La factura no tiene items' },
        { status: 400 }
      )
    }

    // Preparar datos para CFDI
    const datosFactura: DatosFacturaCFDI = {
      id: factura.id,
      folio: factura.folio,
      serie: factura.serie || undefined,
      fecha: factura.fecha,
      fecha_vencimiento: factura.fecha_vencimiento || undefined,
      subtotal: factura.subtotal,
      descuento_monto: factura.descuento_monto,
      iva: factura.iva,
      total: factura.total,
      moneda: (clienteData?.moneda as 'MXN' | 'USD') || 'MXN',
      forma_pago: clienteData?.forma_pago || '99',
      metodo_pago: (clienteData?.metodo_pago as 'PUE' | 'PPD') || 'PUE',
      notas: factura.notas || undefined,
      cliente_rfc: factura.cliente_rfc || '',
      cliente_razon_social: factura.cliente_razon_social || '',
      cliente_regimen_fiscal: factura.cliente_regimen_fiscal || '616',
      cliente_uso_cfdi: factura.cliente_uso_cfdi || 'G03',
      cliente_codigo_postal: clienteData?.codigo_postal_fiscal || '00000',
      items: items.map(
        (item): ItemFacturaCFDI => ({
          sku: item.productos?.sku || undefined,
          descripcion: item.descripcion || item.productos?.nombre || 'Producto',
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
        })
      ),
    }

    // Validar datos
    const erroresValidacion = validarDatosFactura(datosFactura)
    if (erroresValidacion.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos incompletos para CFDI',
          detalles: erroresValidacion,
        },
        { status: 400 }
      )
    }

    // 1. Generar XML pre-CFDI
    const xmlPreCFDI = generarPreCFDI(datosFactura)

    // 2. Generar cadena original
    const cadenaOriginal = generarCadenaOriginal(datosFactura)

    // 3. Firmar CFDI
    const resultadoFirma = await firmarCFDI(xmlPreCFDI, cadenaOriginal)

    if (!resultadoFirma.success) {
      return NextResponse.json(
        {
          success: false,
          error: resultadoFirma.error || 'Error al firmar el CFDI',
        },
        { status: 500 }
      )
    }

    // 4. Agregar sello y certificado al XML
    const xmlFirmado = agregarSelloYCertificado(
      xmlPreCFDI,
      resultadoFirma.sello!,
      resultadoFirma.certificadoBase64!,
      resultadoFirma.noCertificado!
    )

    // 5. Timbrar con Finkok
    const resultadoTimbrado = await timbrar(xmlFirmado)

    if (!resultadoTimbrado.success) {
      return NextResponse.json(
        {
          success: false,
          error: resultadoTimbrado.error || 'Error al timbrar',
          codigo: resultadoTimbrado.codigo_error,
        },
        { status: 500 }
      )
    }

    // 6. Guardar en base de datos
    const { error: errorUpdate } = await supabase
      .schema('erp')
      .from('facturas')
      .update({
        uuid_cfdi: resultadoTimbrado.uuid,
        xml_cfdi: resultadoTimbrado.xml,
        xml_sin_timbrar: xmlFirmado,
        fecha_timbrado: resultadoTimbrado.fecha_timbrado,
        certificado_emisor: resultadoFirma.noCertificado,
        certificado_sat: resultadoTimbrado.certificado_sat,
        sello_cfdi: resultadoFirma.sello,
        sello_sat: resultadoTimbrado.sello_sat,
        cadena_original: resultadoTimbrado.cadena_original,
        status_sat: 'timbrado',
      })
      .eq('id', factura_id)

    if (errorUpdate) {
      // El timbrado fue exitoso pero fallo guardar en BD
      // Retornar los datos para que se puedan guardar manualmente
      console.error('Error al guardar timbrado en BD:', errorUpdate)
      return NextResponse.json({
        success: true,
        uuid: resultadoTimbrado.uuid,
        xml: resultadoTimbrado.xml,
        fecha_timbrado: resultadoTimbrado.fecha_timbrado,
        warning:
          'El CFDI fue timbrado pero hubo un error al guardar en la base de datos',
      })
    }

    return NextResponse.json({
      success: true,
      uuid: resultadoTimbrado.uuid,
      fecha_timbrado: resultadoTimbrado.fecha_timbrado,
      message: 'CFDI timbrado exitosamente',
    })
  } catch (error) {
    console.error('Error en API timbrar:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno',
      },
      { status: 500 }
    )
  }
}
