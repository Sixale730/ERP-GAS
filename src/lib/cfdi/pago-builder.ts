/**
 * Generador de XML CFDI 4.0 Tipo P (Complemento de Pago 2.0)
 * Genera el XML para complementos de pago segun el estandar del SAT
 */

import { create } from 'xmlbuilder2'
import { CFDIEmisor, CFDIReceptor, DatosPagoCFDI, DocumentoRelacionadoPago } from './types'

// Namespaces para CFDI 4.0 + Complemento de Pago 2.0
const PAGO_NAMESPACES = {
  'xmlns:cfdi': 'http://www.sat.gob.mx/cfd/4',
  'xmlns:pago20': 'http://www.sat.gob.mx/Pagos20',
  'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  'xsi:schemaLocation': [
    'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd',
    'http://www.sat.gob.mx/Pagos20 http://www.sat.gob.mx/sitio_internet/cfd/Pagos/Pagos20.xsd',
  ].join(' '),
}

function formatDecimal(value: number, decimals: number = 2): string {
  return value.toFixed(decimals)
}

function formatFechaPago(fecha: string): string {
  // Formato CFDI: YYYY-MM-DDTHH:MM:SS
  const date = new Date(fecha)
  const offset = -6 * 60 // Mexico UTC-6
  const localDate = new Date(date.getTime() + offset * 60 * 1000)
  return localDate.toISOString().slice(0, 19)
}

interface ComplementoPagoParams {
  emisor: CFDIEmisor
  receptor: CFDIReceptor
  pagos: DatosPagoCFDI[]
  serie?: string
  folio?: string
  lugarExpedicion: string
}

interface ComplementoPagoResult {
  xml: string
  montoTotalPagos: number
  totalTrasladosBaseIVA16: number
  totalTrasladosImpuestoIVA16: number
}

/**
 * Genera el XML del Complemento de Pago 2.0 (CFDI Tipo P)
 */
export function generarXmlComplementoPago(params: ComplementoPagoParams): ComplementoPagoResult {
  const { emisor, receptor, pagos, serie, folio, lugarExpedicion } = params

  let montoTotalPagos = 0
  let totalTrasladosBaseIVA16 = 0
  let totalTrasladosImpuestoIVA16 = 0

  // Calcular totales globales
  for (const pago of pagos) {
    montoTotalPagos += pago.monto
    for (const doc of pago.documentos) {
      const baseIva = doc.base_iva || (doc.monto_pagado / 1.16) * 1 // Base sin IVA
      const importeIva = doc.importe_iva || baseIva * 0.16
      totalTrasladosBaseIVA16 += baseIva
      totalTrasladosImpuestoIVA16 += importeIva
    }
  }

  const doc = create({ version: '1.0', encoding: 'UTF-8' })

  // Comprobante tipo P
  const comprobante = doc.ele('cfdi:Comprobante', {
    ...PAGO_NAMESPACES,
    Version: '4.0',
    ...(serie && { Serie: serie }),
    ...(folio && { Folio: folio }),
    Fecha: formatFechaPago(new Date().toISOString()),
    SubTotal: '0',
    Moneda: 'XXX', // Siempre XXX para tipo P
    Total: '0',
    TipoDeComprobante: 'P',
    Exportacion: '01',
    LugarExpedicion: lugarExpedicion,
  })

  // Emisor
  comprobante.ele('cfdi:Emisor', {
    Rfc: emisor.Rfc,
    Nombre: emisor.Nombre,
    RegimenFiscal: emisor.RegimenFiscal,
  })

  // Receptor (UsoCFDI siempre CP01 para pagos)
  comprobante.ele('cfdi:Receptor', {
    Rfc: receptor.Rfc,
    Nombre: receptor.Nombre,
    DomicilioFiscalReceptor: receptor.DomicilioFiscalReceptor,
    RegimenFiscalReceptor: receptor.RegimenFiscalReceptor,
    UsoCFDI: 'CP01', // Pagos
  })

  // Concepto fijo para tipo P
  const conceptos = comprobante.ele('cfdi:Conceptos')
  conceptos.ele('cfdi:Concepto', {
    ClaveProdServ: '84111506', // Servicios de facturacion
    Cantidad: '1',
    ClaveUnidad: 'ACT', // Actividad
    Descripcion: 'Pago',
    ValorUnitario: '0',
    Importe: '0',
    ObjetoImp: '01', // No objeto de impuesto
  })

  // Complemento de Pago 2.0
  const complemento = comprobante.ele('cfdi:Complemento')
  const pagosNode = complemento.ele('pago20:Pagos', {
    Version: '2.0',
    TotalRetencionesIVA: undefined,
    TotalTrasladosBaseIVA16: formatDecimal(totalTrasladosBaseIVA16),
    TotalTrasladosImpuestoIVA16: formatDecimal(totalTrasladosImpuestoIVA16),
  })

  // Totales
  pagosNode.ele('pago20:Totales', {
    TotalTrasladosBaseIVA16: formatDecimal(totalTrasladosBaseIVA16),
    TotalTrasladosImpuestoIVA16: formatDecimal(totalTrasladosImpuestoIVA16),
    MontoTotalPagos: formatDecimal(montoTotalPagos),
  })

  // Cada pago
  for (const pago of pagos) {
    const pagoNode = pagosNode.ele('pago20:Pago', {
      FechaPago: formatFechaPago(pago.fecha_pago),
      FormaDePagoP: pago.forma_pago,
      MonedaP: pago.moneda,
      ...(pago.moneda !== 'MXN' && pago.tipo_cambio && {
        TipoCambioP: formatDecimal(pago.tipo_cambio, 4),
      }),
      Monto: formatDecimal(pago.monto),
    })

    // Documentos relacionados
    for (const docRel of pago.documentos) {
      const equivalenciaDR = docRel.moneda === pago.moneda ? '1' :
        (pago.tipo_cambio ? formatDecimal(pago.tipo_cambio, 4) : '1')

      const baseIva = docRel.base_iva || (docRel.monto_pagado / 1.16)
      const importeIva = docRel.importe_iva || baseIva * 0.16

      const docNode = pagoNode.ele('pago20:DoctoRelacionado', {
        IdDocumento: docRel.uuid_cfdi,
        ...(docRel.serie && { Serie: docRel.serie }),
        Folio: docRel.folio.replace(/[^0-9]/g, ''),
        MonedaDR: docRel.moneda,
        EquivalenciaDR: equivalenciaDR,
        MetodoDePagoDR: 'PPD',
        NumParcialidad: String(docRel.num_parcialidad),
        ImpSaldoAnt: formatDecimal(docRel.saldo_anterior),
        ImpPagado: formatDecimal(docRel.monto_pagado),
        ImpSaldoInsoluto: formatDecimal(docRel.saldo_insoluto),
        ObjetoImpDR: '02', // Si objeto de impuesto
      })

      // Impuestos del documento relacionado
      const impuestosDR = docNode.ele('pago20:ImpuestosDR')
      const trasladosDR = impuestosDR.ele('pago20:TrasladosDR')
      trasladosDR.ele('pago20:TrasladoDR', {
        BaseDR: formatDecimal(baseIva),
        ImpuestoDR: '002', // IVA
        TipoFactorDR: 'Tasa',
        TasaOCuotaDR: '0.160000',
        ImporteDR: formatDecimal(importeIva),
      })
    }

    // Impuestos del pago (totales)
    let pagoBaseIva = 0
    let pagoImporteIva = 0
    for (const docRel of pago.documentos) {
      pagoBaseIva += docRel.base_iva || (docRel.monto_pagado / 1.16)
      pagoImporteIva += docRel.importe_iva || (docRel.monto_pagado / 1.16) * 0.16
    }

    const impuestosP = pagoNode.ele('pago20:ImpuestosP')
    const trasladosP = impuestosP.ele('pago20:TrasladosP')
    trasladosP.ele('pago20:TrasladoP', {
      BaseP: formatDecimal(pagoBaseIva),
      ImpuestoP: '002',
      TipoFactorP: 'Tasa',
      TasaOCuotaP: '0.160000',
      ImporteP: formatDecimal(pagoImporteIva),
    })
  }

  const xml = doc.end({ prettyPrint: false })

  return {
    xml,
    montoTotalPagos,
    totalTrasladosBaseIVA16,
    totalTrasladosImpuestoIVA16,
  }
}

/**
 * Valida los datos para generar un complemento de pago
 */
export function validarComplementoPago(params: ComplementoPagoParams): {
  valido: boolean
  errores: string[]
} {
  const errores: string[] = []

  if (!params.emisor.Rfc) errores.push('Falta el RFC del emisor')
  if (!params.receptor.Rfc) errores.push('Falta el RFC del receptor')
  if (!params.receptor.DomicilioFiscalReceptor) errores.push('Falta el domicilio fiscal del receptor')
  if (!params.lugarExpedicion) errores.push('Falta el lugar de expedicion')

  if (!params.pagos || params.pagos.length === 0) {
    errores.push('Se requiere al menos un pago')
  } else {
    for (let i = 0; i < params.pagos.length; i++) {
      const pago = params.pagos[i]
      if (pago.monto <= 0) errores.push(`Pago ${i + 1}: El monto debe ser mayor a 0`)
      if (!pago.forma_pago) errores.push(`Pago ${i + 1}: Falta la forma de pago`)
      if (!pago.fecha_pago) errores.push(`Pago ${i + 1}: Falta la fecha del pago`)

      if (!pago.documentos || pago.documentos.length === 0) {
        errores.push(`Pago ${i + 1}: Se requiere al menos un documento relacionado`)
      } else {
        for (let j = 0; j < pago.documentos.length; j++) {
          const doc = pago.documentos[j]
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          if (!doc.uuid_cfdi || !uuidRegex.test(doc.uuid_cfdi)) {
            errores.push(`Pago ${i + 1}, Doc ${j + 1}: UUID invalido`)
          }
          if (doc.monto_pagado <= 0) {
            errores.push(`Pago ${i + 1}, Doc ${j + 1}: Monto pagado debe ser mayor a 0`)
          }
          if (doc.saldo_insoluto < 0) {
            errores.push(`Pago ${i + 1}, Doc ${j + 1}: Saldo insoluto no puede ser negativo`)
          }
          if (doc.monto_pagado > doc.saldo_anterior) {
            errores.push(`Pago ${i + 1}, Doc ${j + 1}: El monto pagado excede el saldo anterior`)
          }
        }
      }
    }
  }

  return { valido: errores.length === 0, errores }
}
