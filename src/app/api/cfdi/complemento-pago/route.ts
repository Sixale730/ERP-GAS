/**
 * API Route para Complemento de Pago CFDI
 * POST /api/cfdi/complemento-pago
 *
 * Genera y timbra un CFDI tipo P (Complemento de Pago 2.0)
 * para facturas con metodo de pago PPD
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { signStamp } from '@/lib/cfdi/finkok/stamp'
import { generarXmlComplementoPago, validarComplementoPago } from '@/lib/cfdi/pago-builder'
import { CFDIEmisor, CFDIReceptor, DatosPagoCFDI, DocumentoRelacionadoPago } from '@/lib/cfdi/types'
import { isFinkokConfigured, getFinkokConfigError, getFinkokConfig } from '@/lib/config/finkok'
import { EMPRESA, EMPRESA_PRUEBAS } from '@/lib/config/empresa'
import { parsearErrorCfdi } from '@/lib/cfdi/error-catalog'

export async function POST(request: NextRequest) {
  try {
    if (!isFinkokConfigured()) {
      return NextResponse.json(
        { success: false, error: getFinkokConfigError() || 'Finkok no esta configurado' },
        { status: 400 }
      )
    }

    const { pago_id } = await request.json()

    if (!pago_id) {
      return NextResponse.json({ success: false, error: 'Se requiere pago_id' }, { status: 400 })
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
        { success: false, error: 'No tienes permisos para generar complementos de pago' },
        { status: 403 }
      )
    }

    // Obtener datos del pago
    const { data: pago, error: errorPago } = await supabase
      .schema('erp')
      .from('pagos')
      .select('*')
      .eq('id', pago_id)
      .single()

    if (errorPago || !pago) {
      return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 })
    }

    // Verificar que no tenga ya complemento
    if (pago.uuid_complemento_pago) {
      return NextResponse.json(
        { success: false, error: 'Este pago ya tiene un complemento timbrado', uuid: pago.uuid_complemento_pago },
        { status: 400 }
      )
    }

    // Obtener factura asociada
    const { data: factura, error: errorFactura } = await supabase
      .schema('erp')
      .from('facturas')
      .select(`
        id, folio, serie, total, saldo, moneda, tipo_cambio,
        uuid_cfdi, status_sat,
        cliente_id, cliente_rfc, cliente_razon_social, cliente_regimen_fiscal, cliente_uso_cfdi
      `)
      .eq('id', pago.factura_id)
      .single()

    if (errorFactura || !factura) {
      return NextResponse.json({ success: false, error: 'Factura asociada no encontrada' }, { status: 404 })
    }

    // Verificar que la factura este timbrada
    if (!factura.uuid_cfdi || factura.status_sat !== 'timbrado') {
      return NextResponse.json(
        { success: false, error: 'La factura debe estar timbrada para generar un complemento de pago' },
        { status: 400 }
      )
    }

    // Obtener datos del cliente (codigo postal)
    let codigoPostalReceptor = '00000'
    if (factura.cliente_id) {
      const { data: cliente } = await supabase
        .schema('erp')
        .from('clientes')
        .select('codigo_postal_fiscal, metodo_pago')
        .eq('id', factura.cliente_id)
        .single()

      if (cliente) {
        codigoPostalReceptor = cliente.codigo_postal_fiscal || '00000'
      }
    }

    // Calcular numero de parcialidad (contar pagos previos)
    const { count } = await supabase
      .schema('erp')
      .from('pagos')
      .select('id', { count: 'exact', head: true })
      .eq('factura_id', pago.factura_id)
      .lt('created_at', pago.created_at)

    const numParcialidad = (count || 0) + 1

    // Calcular saldo anterior (saldo actual + monto de este pago)
    const saldoAnterior = factura.saldo + pago.monto
    const saldoInsoluto = factura.saldo

    // Preparar datos del emisor y receptor
    const config = getFinkokConfig()
    const empresaData = config.environment === 'demo' ? EMPRESA_PRUEBAS : EMPRESA

    const emisor: CFDIEmisor = {
      Rfc: empresaData.rfc,
      Nombre: empresaData.nombre,
      RegimenFiscal: empresaData.regimenFiscal,
    }

    const receptor: CFDIReceptor = {
      Rfc: factura.cliente_rfc || 'XAXX010101000',
      Nombre: factura.cliente_razon_social || '',
      DomicilioFiscalReceptor: codigoPostalReceptor,
      RegimenFiscalReceptor: factura.cliente_regimen_fiscal || '616',
      UsoCFDI: 'CP01',
    }

    const monedaFactura = (factura.moneda as 'MXN' | 'USD') || 'MXN'

    // Calcular IVA proporcional al pago
    const proporcion = pago.monto / factura.total
    const baseIvaPago = (factura.total / 1.16) * proporcion
    const importeIvaPago = baseIvaPago * 0.16

    const documentoRelacionado: DocumentoRelacionadoPago = {
      uuid_cfdi: factura.uuid_cfdi,
      folio: factura.folio,
      serie: factura.serie || undefined,
      moneda: monedaFactura,
      tipo_cambio: factura.tipo_cambio || undefined,
      metodo_pago: 'PPD',
      num_parcialidad: numParcialidad,
      saldo_anterior: saldoAnterior,
      monto_pagado: pago.monto,
      saldo_insoluto: saldoInsoluto,
      base_iva: baseIvaPago,
      importe_iva: importeIvaPago,
    }

    const pagoData: DatosPagoCFDI = {
      fecha_pago: pago.fecha,
      forma_pago: pago.metodo_pago || '03',
      moneda: monedaFactura,
      tipo_cambio: monedaFactura !== 'MXN' ? (factura.tipo_cambio || undefined) : undefined,
      monto: pago.monto,
      documentos: [documentoRelacionado],
    }

    const complementoParams = {
      emisor,
      receptor,
      pagos: [pagoData],
      lugarExpedicion: empresaData.codigoPostal,
    }

    // Validar
    const validacion = validarComplementoPago(complementoParams)
    if (!validacion.valido) {
      return NextResponse.json(
        { success: false, error: 'Datos invalidos para complemento de pago', detalles: validacion.errores },
        { status: 400 }
      )
    }

    // Generar XML
    const resultado = generarXmlComplementoPago(complementoParams)

    // Timbrar con Finkok (sign_stamp maneja el firmado)
    const resultadoTimbrado = await signStamp(resultado.xml)

    if (!resultadoTimbrado.success) {
      const errorInfo = parsearErrorCfdi(resultadoTimbrado.error || 'Error desconocido')
      return NextResponse.json(
        {
          success: false,
          error: errorInfo.info?.titulo || resultadoTimbrado.error || 'Error al timbrar complemento',
          detalles: resultadoTimbrado.error,
          codigo: resultadoTimbrado.codigo_error || errorInfo.codigo,
        },
        { status: 500 }
      )
    }

    // Guardar UUID y XML del complemento en el pago
    const { error: errorUpdate } = await supabase
      .schema('erp')
      .from('pagos')
      .update({
        uuid_complemento_pago: resultadoTimbrado.uuid,
        xml_complemento: resultadoTimbrado.xml,
      })
      .eq('id', pago_id)

    if (errorUpdate) {
      console.error('Error al guardar complemento en BD:', errorUpdate)
      return NextResponse.json({
        success: true,
        uuid: resultadoTimbrado.uuid,
        warning: 'Complemento timbrado pero hubo error al guardar en BD',
      })
    }

    return NextResponse.json({
      success: true,
      uuid: resultadoTimbrado.uuid,
      fecha_timbrado: resultadoTimbrado.fecha_timbrado,
      message: 'Complemento de pago timbrado exitosamente',
    })
  } catch (error) {
    console.error('Error en API complemento-pago:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
