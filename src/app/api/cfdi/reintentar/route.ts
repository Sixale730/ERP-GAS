/**
 * API Route para Reintentar Timbrado CFDI
 * POST /api/cfdi/reintentar
 *
 * Reintenta el timbrado de una factura que tuvo un error previo.
 * Regenera el XML con datos actuales y vuelve a enviar a Finkok.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generarPreCFDI, validarDatosFactura } from '@/lib/cfdi/xml-builder'
import { signStamp } from '@/lib/cfdi/finkok/stamp'
import { DatosFacturaCFDI, ItemFacturaCFDI } from '@/lib/cfdi/types'
import { isFinkokConfigured, getFinkokConfigError } from '@/lib/config/finkok'
import { parsearErrorCfdi, generarRespuestaError } from '@/lib/cfdi/error-catalog'

export async function POST(request: NextRequest) {
  try {
    if (!isFinkokConfigured()) {
      return NextResponse.json(
        { success: false, error: getFinkokConfigError() || 'Finkok no esta configurado' },
        { status: 400 }
      )
    }

    const { factura_id } = await request.json()

    if (!factura_id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere factura_id' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verificar autenticacion y permisos
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

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
        { success: false, error: 'No tienes permisos para timbrar facturas' },
        { status: 403 }
      )
    }

    // Obtener factura
    const { data: factura, error: errorFactura } = await supabase
      .schema('erp')
      .from('facturas')
      .select(`
        id, folio, serie, fecha, fecha_vencimiento,
        subtotal, descuento_monto, iva, total, notas,
        cliente_rfc, cliente_razon_social, cliente_regimen_fiscal, cliente_uso_cfdi,
        status_sat, uuid_cfdi, cliente_id, error_timbrado
      `)
      .eq('id', factura_id)
      .single()

    if (errorFactura || !factura) {
      return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 })
    }

    // Verificar que sea elegible para reintento
    if (factura.status_sat === 'timbrado' && factura.uuid_cfdi) {
      return NextResponse.json(
        { success: false, error: 'La factura ya esta timbrada', uuid: factura.uuid_cfdi },
        { status: 400 }
      )
    }

    // Obtener datos del cliente
    let clienteData: { codigo_postal_fiscal: string | null; forma_pago: string | null; metodo_pago: string | null; moneda: string | null } | null = null
    if (factura.cliente_id) {
      const { data } = await supabase
        .schema('erp')
        .from('clientes')
        .select('codigo_postal_fiscal, forma_pago, metodo_pago, moneda')
        .eq('id', factura.cliente_id)
        .single()
      clienteData = data
    }

    // Obtener items
    const { data: items, error: errorItems } = await supabase
      .schema('erp')
      .from('factura_items')
      .select(`
        id, producto_id, descripcion, cantidad,
        precio_unitario, descuento_porcentaje, subtotal,
        productos (sku, nombre)
      `)
      .eq('factura_id', factura_id)

    if (errorItems || !items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'La factura no tiene items' }, { status: 400 })
    }

    // Preparar datos
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
      items: items.map((item: any): ItemFacturaCFDI => ({
        sku: item.productos?.sku || undefined,
        descripcion: item.descripcion || item.productos?.nombre || 'Producto',
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento_porcentaje: item.descuento_porcentaje,
        subtotal: item.subtotal,
      })),
    }

    // Validar datos
    const erroresValidacion = validarDatosFactura(datosFactura)
    if (erroresValidacion.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Datos incompletos para CFDI', detalles: erroresValidacion },
        { status: 400 }
      )
    }

    // Regenerar XML y timbrar
    const xmlSinFirmar = generarPreCFDI(datosFactura, { omitirFirma: true })
    const resultado = await signStamp(xmlSinFirmar)

    if (!resultado.success) {
      // Parsear error y guardarlo en la factura
      const errorInfo = parsearErrorCfdi(resultado.error || 'Error desconocido')
      const errorData = {
        codigo: resultado.codigo_error || errorInfo.codigo,
        mensaje: resultado.error,
        fecha: new Date().toISOString(),
        info: errorInfo.info,
      }

      await supabase
        .schema('erp')
        .from('facturas')
        .update({
          error_timbrado: errorData,
          status_sat: 'error',
        })
        .eq('id', factura_id)

      const respuesta = generarRespuestaError(resultado.error || '')
      return NextResponse.json(
        {
          success: false,
          error: respuesta.errores[0]?.titulo || resultado.error,
          errorInfo: respuesta.errores[0],
          sugerencias: respuesta.sugerencias,
          detalles: resultado.error,
        },
        { status: 500 }
      )
    }

    // Exito: extraer certificado y sello del XML timbrado
    let noCertificadoEmisor: string | undefined
    let selloEmisor: string | undefined
    if (resultado.xml) {
      const matchCert = resultado.xml.match(/NoCertificado="([^"]+)"/)
      if (matchCert) noCertificadoEmisor = matchCert[1]
      const matchSello = resultado.xml.match(/Sello="([^"]+)"/)
      if (matchSello) selloEmisor = matchSello[1]
    }

    // Guardar en BD
    const { error: errorUpdate } = await supabase
      .schema('erp')
      .from('facturas')
      .update({
        uuid_cfdi: resultado.uuid,
        xml_cfdi: resultado.xml,
        xml_sin_timbrar: xmlSinFirmar,
        fecha_timbrado: resultado.fecha_timbrado,
        certificado_emisor: noCertificadoEmisor,
        certificado_sat: resultado.certificado_sat,
        sello_cfdi: selloEmisor,
        sello_sat: resultado.sello_sat,
        cadena_original: resultado.cadena_original,
        status_sat: 'timbrado',
        error_timbrado: null, // Limpiar error
      })
      .eq('id', factura_id)

    if (errorUpdate) {
      console.error('Error al guardar reintento en BD:', errorUpdate)
      return NextResponse.json({
        success: true,
        uuid: resultado.uuid,
        warning: 'El CFDI fue timbrado pero hubo un error al guardar en la base de datos',
      })
    }

    return NextResponse.json({
      success: true,
      uuid: resultado.uuid,
      fecha_timbrado: resultado.fecha_timbrado,
      message: 'CFDI timbrado exitosamente (reintento)',
    })
  } catch (error) {
    console.error('Error en API reintentar:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
