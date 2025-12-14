/**
 * Generador de XML CFDI 4.0
 * Genera el XML pre-CFDI segun el estandar del SAT
 */

import { create } from 'xmlbuilder2'
import {
  DatosFacturaCFDI,
  ItemFacturaCFDI,
  CLAVES_PROD_SERV,
  CLAVES_UNIDAD,
} from './types'
import { EMPRESA, EMPRESA_PRUEBAS } from '../config/empresa'
import { getFinkokConfig } from '../config/finkok'

// Namespaces del CFDI 4.0
const CFDI_NAMESPACES = {
  'xmlns:cfdi': 'http://www.sat.gob.mx/cfd/4',
  'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  'xsi:schemaLocation':
    'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd',
}

/**
 * Formatea un numero a 2 decimales como string
 */
function formatDecimal(value: number, decimals: number = 2): string {
  return value.toFixed(decimals)
}

/**
 * Formatea fecha en formato ISO para CFDI: YYYY-MM-DDTHH:MM:SS
 */
function formatFechaCFDI(fecha?: string): string {
  const date = fecha ? new Date(fecha) : new Date()
  // Ajustar a zona horaria de Mexico (UTC-6)
  const offset = -6 * 60 // minutos
  const localDate = new Date(date.getTime() + offset * 60 * 1000)
  return localDate.toISOString().slice(0, 19)
}

/**
 * Obtiene los datos del emisor (empresa) segun el ambiente
 */
function getEmisor(): typeof EMPRESA {
  const config = getFinkokConfig()
  return config.environment === 'demo' ? EMPRESA_PRUEBAS : EMPRESA
}

/**
 * Calcula el IVA de un importe
 */
function calcularIVA(importe: number, tasa: number = 0.16): number {
  return importe * tasa
}

/**
 * Genera el XML pre-CFDI 4.0 (sin sello ni certificado)
 */
export function generarPreCFDI(factura: DatosFacturaCFDI): string {
  const emisor = getEmisor()

  // Calcular totales de impuestos
  const baseIVA = factura.subtotal - factura.descuento_monto
  const totalIVA = calcularIVA(baseIVA)

  // Crear documento XML
  const doc = create({ version: '1.0', encoding: 'UTF-8' })

  const comprobante = doc.ele('cfdi:Comprobante', {
    ...CFDI_NAMESPACES,
    Version: '4.0',
    Serie: factura.serie || 'A',
    Folio: factura.folio.replace(/[^0-9]/g, ''), // Solo numeros
    Fecha: formatFechaCFDI(factura.fecha),
    FormaPago: factura.forma_pago || '99', // Por definir
    SubTotal: formatDecimal(factura.subtotal),
    ...(factura.descuento_monto > 0 && {
      Descuento: formatDecimal(factura.descuento_monto),
    }),
    Moneda: factura.moneda || 'MXN',
    ...(factura.moneda === 'USD' &&
      factura.tipo_cambio && {
        TipoCambio: formatDecimal(factura.tipo_cambio, 4),
      }),
    Total: formatDecimal(factura.total),
    TipoDeComprobante: 'I', // Ingreso
    Exportacion: '01', // No aplica
    MetodoPago: factura.metodo_pago || 'PUE',
    LugarExpedicion: emisor.codigoPostal,
    // Sello y Certificado se agregan despues de firmar
  })

  // Emisor
  comprobante.ele('cfdi:Emisor', {
    Rfc: emisor.rfc,
    Nombre: emisor.nombre,
    RegimenFiscal: emisor.regimenFiscal,
  })

  // Receptor
  comprobante.ele('cfdi:Receptor', {
    Rfc: factura.cliente_rfc || 'XAXX010101000', // RFC generico si no hay
    Nombre: factura.cliente_razon_social,
    DomicilioFiscalReceptor: factura.cliente_codigo_postal || '00000',
    RegimenFiscalReceptor: factura.cliente_regimen_fiscal || '616',
    UsoCFDI: factura.cliente_uso_cfdi || 'G03',
  })

  // Conceptos
  const conceptos = comprobante.ele('cfdi:Conceptos')

  for (const item of factura.items) {
    const valorUnitario = item.precio_unitario
    const importe = item.cantidad * valorUnitario
    const descuento = importe * (item.descuento_porcentaje / 100)
    const baseImpuesto = importe - descuento
    const ivaItem = calcularIVA(baseImpuesto)

    const concepto = conceptos.ele('cfdi:Concepto', {
      ClaveProdServ: item.clave_prod_serv || CLAVES_PROD_SERV.PRODUCTO_GENERAL,
      ...(item.sku && { NoIdentificacion: item.sku }),
      Cantidad: formatDecimal(item.cantidad, 6),
      ClaveUnidad: item.clave_unidad || CLAVES_UNIDAD.PIEZA,
      ...(item.unidad && { Unidad: item.unidad }),
      Descripcion: item.descripcion,
      ValorUnitario: formatDecimal(valorUnitario, 6),
      Importe: formatDecimal(importe),
      ...(descuento > 0 && { Descuento: formatDecimal(descuento) }),
      ObjetoImp: '02', // Si objeto de impuesto
    })

    // Impuestos del concepto
    const impuestosConcepto = concepto.ele('cfdi:Impuestos')
    const trasladosConcepto = impuestosConcepto.ele('cfdi:Traslados')

    trasladosConcepto.ele('cfdi:Traslado', {
      Base: formatDecimal(baseImpuesto),
      Impuesto: '002', // IVA
      TipoFactor: 'Tasa',
      TasaOCuota: '0.160000',
      Importe: formatDecimal(ivaItem),
    })
  }

  // Impuestos totales
  const impuestos = comprobante.ele('cfdi:Impuestos', {
    TotalImpuestosTrasladados: formatDecimal(totalIVA),
  })

  const traslados = impuestos.ele('cfdi:Traslados')
  traslados.ele('cfdi:Traslado', {
    Base: formatDecimal(baseIVA),
    Impuesto: '002',
    TipoFactor: 'Tasa',
    TasaOCuota: '0.160000',
    Importe: formatDecimal(totalIVA),
  })

  // Generar XML string
  const xml = doc.end({ prettyPrint: false })

  return xml
}

/**
 * Genera la cadena original del CFDI para firmado
 * Segun especificacion del SAT Anexo 20
 */
export function generarCadenaOriginal(factura: DatosFacturaCFDI): string {
  const emisor = getEmisor()
  const baseIVA = factura.subtotal - factura.descuento_monto
  const totalIVA = calcularIVA(baseIVA)

  const partes: string[] = [
    // Comprobante
    '4.0',
    factura.serie || 'A',
    factura.folio.replace(/[^0-9]/g, ''),
    formatFechaCFDI(factura.fecha),
    factura.forma_pago || '99',
    formatDecimal(factura.subtotal),
    factura.descuento_monto > 0 ? formatDecimal(factura.descuento_monto) : '',
    factura.moneda || 'MXN',
    factura.moneda === 'USD' && factura.tipo_cambio
      ? formatDecimal(factura.tipo_cambio, 4)
      : '',
    formatDecimal(factura.total),
    'I', // TipoDeComprobante
    '01', // Exportacion
    factura.metodo_pago || 'PUE',
    emisor.codigoPostal,
    // Emisor
    emisor.rfc,
    emisor.nombre,
    emisor.regimenFiscal,
    // Receptor
    factura.cliente_rfc || 'XAXX010101000',
    factura.cliente_razon_social,
    factura.cliente_codigo_postal || '00000',
    factura.cliente_regimen_fiscal || '616',
    factura.cliente_uso_cfdi || 'G03',
  ]

  // Conceptos
  for (const item of factura.items) {
    const valorUnitario = item.precio_unitario
    const importe = item.cantidad * valorUnitario
    const descuento = importe * (item.descuento_porcentaje / 100)
    const baseImpuesto = importe - descuento
    const ivaItem = calcularIVA(baseImpuesto)

    partes.push(
      item.clave_prod_serv || CLAVES_PROD_SERV.PRODUCTO_GENERAL,
      item.sku || '',
      formatDecimal(item.cantidad, 6),
      item.clave_unidad || CLAVES_UNIDAD.PIEZA,
      item.unidad || '',
      item.descripcion,
      formatDecimal(valorUnitario, 6),
      formatDecimal(importe),
      descuento > 0 ? formatDecimal(descuento) : '',
      '02', // ObjetoImp
      // Impuestos del concepto
      formatDecimal(baseImpuesto),
      '002',
      'Tasa',
      '0.160000',
      formatDecimal(ivaItem)
    )
  }

  // Impuestos totales
  partes.push(
    formatDecimal(totalIVA), // TotalImpuestosTrasladados
    formatDecimal(baseIVA), // Base
    '002', // Impuesto
    'Tasa', // TipoFactor
    '0.160000', // TasaOCuota
    formatDecimal(totalIVA) // Importe
  )

  // Filtrar valores vacios y unir con pipes
  const cadena = '||' + partes.filter((p) => p !== '').join('|') + '||'

  return cadena
}

/**
 * Agrega el sello y certificado al XML pre-CFDI
 */
export function agregarSelloYCertificado(
  xml: string,
  sello: string,
  certificado: string,
  noCertificado: string
): string {
  // Insertar atributos en el nodo Comprobante
  const xmlConSello = xml.replace(
    'LugarExpedicion=',
    `NoCertificado="${noCertificado}" Certificado="${certificado}" Sello="${sello}" LugarExpedicion=`
  )

  return xmlConSello
}

/**
 * Valida que una factura tenga los datos minimos para CFDI
 */
export function validarDatosFactura(factura: DatosFacturaCFDI): string[] {
  const errores: string[] = []

  if (!factura.cliente_rfc) {
    errores.push('Falta el RFC del cliente')
  } else if (!/^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(factura.cliente_rfc)) {
    errores.push('El RFC del cliente no tiene un formato valido')
  }

  if (!factura.cliente_razon_social) {
    errores.push('Falta la razon social del cliente')
  }

  if (!factura.cliente_regimen_fiscal) {
    errores.push('Falta el regimen fiscal del cliente')
  }

  if (!factura.cliente_uso_cfdi) {
    errores.push('Falta el uso de CFDI del cliente')
  }

  if (!factura.cliente_codigo_postal) {
    errores.push('Falta el codigo postal fiscal del cliente')
  }

  if (!factura.items || factura.items.length === 0) {
    errores.push('La factura no tiene items')
  }

  if (factura.total <= 0) {
    errores.push('El total de la factura debe ser mayor a 0')
  }

  return errores
}
