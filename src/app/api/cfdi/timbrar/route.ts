/**
 * API Route para Timbrar CFDI
 * POST /api/cfdi/timbrar
 *
 * Usa sign_stamp de Finkok para que el PAC maneje todo el proceso de firmado.
 * Requiere que los CSD esten cargados en Finkok via /api/cfdi/csd
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  generarPreCFDI,
  validarDatosFactura,
} from '@/lib/cfdi/xml-builder'
import { signStamp } from '@/lib/cfdi/finkok/stamp'
import { DatosFacturaCFDI, ItemFacturaCFDI } from '@/lib/cfdi/types'
import { isFinkokConfigured, getFinkokConfigError, getFinkokConfig } from '@/lib/config/finkok'
import { parsearErrorCfdi, generarRespuestaError } from '@/lib/cfdi/error-catalog'

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
        { success: false, error: 'No tienes permisos para timbrar facturas' },
        { status: 403 }
      )
    }

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

    // Usar sign_stamp de Finkok para AMBOS ambientes
    // Finkok firma el XML con los CSD que tiene almacenados
    // El XML se envia SIN atributos de firma (sin Sello, Certificado, NoCertificado)

    const config = getFinkokConfig()

    // Generar XML SIN atributos de firma (Finkok los agregara)
    const xmlSinFirmar = generarPreCFDI(datosFactura, { omitirFirma: true })

    // DEBUG: Log del XML antes de enviar a Finkok
    console.log('=== CFDI DEBUG ===')
    console.log('Ambiente:', config.environment)
    console.log('XML Length:', xmlSinFirmar.length)
    console.log('Contiene Sello:', xmlSinFirmar.includes('Sello='))
    console.log('Contiene Certificado:', xmlSinFirmar.includes('Certificado='))
    console.log('Contiene NoCertificado:', xmlSinFirmar.includes('NoCertificado='))
    console.log('Primeros 1000 chars:', xmlSinFirmar.substring(0, 1000))
    console.log('==================')

    // Timbrar con sign_stamp (Finkok genera cadena original, firma y timbra)
    const resultadoTimbrado = await signStamp(xmlSinFirmar)

    // Extraer certificado y sello del XML timbrado
    let noCertificadoEmisor: string | undefined
    let selloEmisor: string | undefined

    if (resultadoTimbrado.success && resultadoTimbrado.xml) {
      // Extraer NoCertificado del XML timbrado
      const matchCert = resultadoTimbrado.xml.match(/NoCertificado="([^"]+)"/)
      if (matchCert) {
        noCertificadoEmisor = matchCert[1]
      }
      // Extraer Sello del emisor del XML
      const matchSello = resultadoTimbrado.xml.match(/Sello="([^"]+)"/)
      if (matchSello) {
        selloEmisor = matchSello[1]
      }
    }

    if (!resultadoTimbrado.success) {
      // Parsear error con el catalogo
      const errorParsed = parsearErrorCfdi(resultadoTimbrado.error || 'Error desconocido')
      const respuesta = generarRespuestaError(resultadoTimbrado.error || '')

      // Guardar error en la factura para retry
      const errorData = {
        codigo: resultadoTimbrado.codigo_error || errorParsed.codigo,
        mensaje: resultadoTimbrado.error,
        fecha: new Date().toISOString(),
        info: errorParsed.info,
      }

      await supabase
        .schema('erp')
        .from('facturas')
        .update({
          error_timbrado: errorData,
          status_sat: 'error',
        })
        .eq('id', factura_id)

      return NextResponse.json(
        {
          success: false,
          error: respuesta.errores[0]?.titulo || resultadoTimbrado.error || 'Error al timbrar',
          errorInfo: respuesta.errores[0],
          sugerencias: respuesta.sugerencias,
          detalles: resultadoTimbrado.error,
          codigo: resultadoTimbrado.codigo_error || errorParsed.codigo,
        },
        { status: 500 }
      )
    }

    // Guardar en base de datos y limpiar error_timbrado
    const { error: errorUpdate } = await supabase
      .schema('erp')
      .from('facturas')
      .update({
        uuid_cfdi: resultadoTimbrado.uuid,
        xml_cfdi: resultadoTimbrado.xml,
        xml_sin_timbrar: xmlSinFirmar,
        fecha_timbrado: resultadoTimbrado.fecha_timbrado,
        certificado_emisor: noCertificadoEmisor,
        certificado_sat: resultadoTimbrado.certificado_sat,
        sello_cfdi: selloEmisor,
        sello_sat: resultadoTimbrado.sello_sat,
        cadena_original: resultadoTimbrado.cadena_original,
        status_sat: 'timbrado',
        error_timbrado: null, // Limpiar error previo
      })
      .eq('id', factura_id)

    if (errorUpdate) {
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
