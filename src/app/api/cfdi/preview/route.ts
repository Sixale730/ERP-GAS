/**
 * API Route para Preview de CFDI
 * POST /api/cfdi/preview
 *
 * Genera una previsualizacion del CFDI sin timbrarlo.
 * Reutiliza la logica de fetch y generacion del timbrar/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generarPreCFDI, validarDatosFactura } from '@/lib/cfdi/xml-builder'
import { DatosFacturaCFDI, ItemFacturaCFDI } from '@/lib/cfdi/types'
import { getFinkokConfig } from '@/lib/config/finkok'
import { EMPRESA, EMPRESA_PRUEBAS } from '@/lib/config/empresa'

export async function POST(request: NextRequest) {
  try {
    const { factura_id } = await request.json()

    if (!factura_id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere factura_id' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verificar autenticacion
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener datos de la factura
    const { data: factura, error: errorFactura } = await supabase
      .schema('erp')
      .from('facturas')
      .select(`
        id, folio, serie, fecha, fecha_vencimiento,
        subtotal, descuento_monto, iva, total, notas,
        cliente_rfc, cliente_razon_social, cliente_regimen_fiscal, cliente_uso_cfdi,
        status_sat, uuid_cfdi, cliente_id
      `)
      .eq('id', factura_id)
      .single()

    if (errorFactura || !factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
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
      return NextResponse.json(
        { success: false, error: 'La factura no tiene items' },
        { status: 400 }
      )
    }

    // Obtener datos del emisor
    const config = getFinkokConfig()
    const emisor = config.environment === 'demo' ? EMPRESA_PRUEBAS : EMPRESA

    // Preparar datos
    const moneda = (clienteData?.moneda as 'MXN' | 'USD') || 'MXN'
    const formaPago = clienteData?.forma_pago || '99'
    const metodoPago = (clienteData?.metodo_pago as 'PUE' | 'PPD') || 'PUE'

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
      moneda,
      forma_pago: formaPago,
      metodo_pago: metodoPago,
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
    const validaciones = validarDatosFactura(datosFactura)

    // Generar XML preview (sin timbrar)
    let xml = ''
    try {
      xml = generarPreCFDI(datosFactura, { omitirFirma: true })
    } catch (e) {
      validaciones.push(`Error al generar XML: ${e instanceof Error ? e.message : 'Error desconocido'}`)
    }

    // Preparar conceptos para el preview
    const conceptos = items.map((item: any) => {
      const importe = item.cantidad * item.precio_unitario
      const descuento = importe * (item.descuento_porcentaje / 100)
      return {
        descripcion: item.descripcion || item.productos?.nombre || 'Producto',
        cantidad: item.cantidad,
        precioUnitario: item.precio_unitario,
        importe,
        descuento: descuento > 0 ? descuento : undefined,
      }
    })

    return NextResponse.json({
      success: true,
      emisor: {
        rfc: emisor.rfc,
        nombre: emisor.nombre,
        regimenFiscal: emisor.regimenFiscal,
      },
      receptor: {
        rfc: factura.cliente_rfc || '',
        nombre: factura.cliente_razon_social || '',
        codigoPostal: clienteData?.codigo_postal_fiscal || '',
        regimenFiscal: factura.cliente_regimen_fiscal || '616',
        usoCfdi: factura.cliente_uso_cfdi || 'G03',
      },
      conceptos,
      totales: {
        subtotal: factura.subtotal,
        descuento: factura.descuento_monto,
        iva: factura.iva,
        total: factura.total,
      },
      moneda,
      metodoPago,
      formaPago,
      validaciones,
      xml,
    })
  } catch (error) {
    console.error('Error en API preview:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
