/**
 * Generador de PDF SAT-compliant para CFDI 4.0
 * Incluye QR code, sellos digitales y cadena original
 */

import type jsPDF from 'jspdf'

// Catalogos SAT para labels legibles
const FORMAS_PAGO: Record<string, string> = {
  '01': 'Efectivo', '02': 'Cheque nominativo', '03': 'Transferencia electronica',
  '04': 'Tarjeta de credito', '05': 'Monedero electronico', '06': 'Dinero electronico',
  '08': 'Vales de despensa', '12': 'Dacion en pago', '13': 'Pago por subrogacion',
  '14': 'Pago por consignacion', '15': 'Condonacion', '17': 'Compensacion',
  '23': 'Novacion', '24': 'Confusion', '25': 'Remision de deuda',
  '26': 'Prescripcion o caducidad', '27': 'A satisfaccion del acreedor',
  '28': 'Tarjeta de debito', '29': 'Tarjeta de servicios', '30': 'Aplicacion de anticipos',
  '31': 'Intermediario pagos', '99': 'Por definir',
}

const METODOS_PAGO: Record<string, string> = {
  PUE: 'Pago en Una sola Exhibicion',
  PPD: 'Pago en Parcialidades o Diferido',
}

const REGIMENES_FISCALES: Record<string, string> = {
  '601': 'General de Ley PM', '603': 'PM sin Fines Lucrativos',
  '605': 'Sueldos y Salarios', '606': 'Arrendamiento',
  '607': 'Demás ingresos', '608': 'Consolidacion',
  '610': 'Residentes en el Extranjero', '611': 'Dividendos',
  '612': 'PF Actividades Empresariales', '614': 'Intereses',
  '616': 'Sin obligaciones fiscales', '620': 'Sociedades Cooperativas',
  '621': 'Incorporacion Fiscal', '622': 'Actividades Agricolas',
  '623': 'Opcional Grupos de Sociedades', '624': 'Coordinados',
  '625': 'Regimen RESICO', '626': 'RESICO',
}

const USOS_CFDI: Record<string, string> = {
  G01: 'Adquisicion de mercancias', G02: 'Devoluciones/descuentos',
  G03: 'Gastos en general', I01: 'Construcciones',
  I02: 'Mobiliario y equipo', I03: 'Equipo de transporte',
  I04: 'Equipo de computo', I08: 'Otra maquinaria',
  D01: 'Honorarios medicos', S01: 'Sin efectos fiscales',
  CP01: 'Pagos', CN01: 'Nomina',
}

// Colores
const COLOR_PRIMARIO: [number, number, number] = [41, 128, 185]
const COLOR_GRIS: [number, number, number] = [100, 100, 100]
const COLOR_BORDE: [number, number, number] = [200, 200, 200]

export interface PdfCfdiData {
  // Factura
  folio: string
  serie?: string
  fecha: string
  // Emisor
  emisor: { rfc: string; nombre: string; regimenFiscal: string; codigoPostal: string }
  // Receptor
  receptor: { rfc: string; nombre: string; codigoPostal: string; regimenFiscal: string; usoCfdi: string }
  // Items
  conceptos: {
    claveProdServ?: string
    descripcion: string
    cantidad: number
    claveUnidad?: string
    valorUnitario: number
    importe: number
    descuento?: number
  }[]
  // Totales
  subtotal: number
  descuento?: number
  iva: number
  total: number
  moneda: string
  metodoPago: string
  formaPago: string
  // Timbre (solo si timbrada)
  uuid?: string
  fechaTimbrado?: string
  selloCfdi?: string
  selloSat?: string
  certificadoSat?: string
  cadenaOriginal?: string
}

function truncateSello(sello: string, chars: number = 30): string {
  if (!sello || sello.length <= chars * 2) return sello || ''
  return sello.substring(0, chars) + '...' + sello.substring(sello.length - chars)
}

function formatMoneyPdf(amount: number, moneda: string = 'MXN'): string {
  return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`
}

/**
 * Genera el PDF SAT-compliant del CFDI
 */
export async function generarPdfCfdi(data: PdfCfdiData): Promise<jsPDF> {
  const { default: jsPDFLib } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const QRCode = (await import('qrcode')).default

  const doc = new jsPDFLib('p', 'mm', 'letter')
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // === HEADER ===
  doc.setFontSize(16)
  doc.setTextColor(...COLOR_PRIMARIO)
  doc.setFont('helvetica', 'bold')
  doc.text(data.emisor.nombre, margin, y)
  y += 6

  doc.setFontSize(9)
  doc.setTextColor(...COLOR_GRIS)
  doc.setFont('helvetica', 'normal')
  doc.text(`RFC: ${data.emisor.rfc}`, margin, y)

  // Folio y tipo en la esquina derecha
  doc.setFontSize(12)
  doc.setTextColor(...COLOR_PRIMARIO)
  doc.setFont('helvetica', 'bold')
  doc.text(`Factura ${data.serie ? data.serie + '-' : ''}${data.folio}`, pageWidth - margin, y - 6, { align: 'right' })

  doc.setFontSize(8)
  doc.setTextColor(...COLOR_GRIS)
  doc.setFont('helvetica', 'normal')
  doc.text(`Fecha: ${data.fecha}`, pageWidth - margin, y, { align: 'right' })

  if (data.uuid) {
    y += 4
    doc.setFontSize(7)
    doc.text(`UUID: ${data.uuid}`, pageWidth - margin, y, { align: 'right' })
  }
  y += 8

  // Linea separadora
  doc.setDrawColor(...COLOR_PRIMARIO)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // === EMISOR / RECEPTOR ===
  const halfWidth = (contentWidth - 4) / 2

  // Emisor box
  doc.setFillColor(245, 247, 250)
  doc.roundedRect(margin, y, halfWidth, 28, 2, 2, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(60, 60, 60)
  doc.text('EMISOR', margin + 4, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`RFC: ${data.emisor.rfc}`, margin + 4, y + 10)
  doc.text(`Nombre: ${data.emisor.nombre}`, margin + 4, y + 14)
  doc.text(`Regimen: ${REGIMENES_FISCALES[data.emisor.regimenFiscal] || data.emisor.regimenFiscal}`, margin + 4, y + 18)
  doc.text(`C.P.: ${data.emisor.codigoPostal}`, margin + 4, y + 22)

  // Receptor box
  const rxStart = margin + halfWidth + 4
  doc.setFillColor(245, 247, 250)
  doc.roundedRect(rxStart, y, halfWidth, 28, 2, 2, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('RECEPTOR', rxStart + 4, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`RFC: ${data.receptor.rfc}`, rxStart + 4, y + 10)
  doc.text(`Nombre: ${data.receptor.nombre}`, rxStart + 4, y + 14)
  doc.text(`Regimen: ${REGIMENES_FISCALES[data.receptor.regimenFiscal] || data.receptor.regimenFiscal}`, rxStart + 4, y + 18)
  doc.text(`Uso CFDI: ${USOS_CFDI[data.receptor.usoCfdi] || data.receptor.usoCfdi} (${data.receptor.usoCfdi})`, rxStart + 4, y + 22)

  y += 32

  // === DATOS FISCALES ===
  doc.setFillColor(41, 128, 185)
  doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')

  const fiscalLabels = [
    `Forma Pago: ${FORMAS_PAGO[data.formaPago] || data.formaPago} (${data.formaPago})`,
    `Metodo: ${METODOS_PAGO[data.metodoPago] || data.metodoPago}`,
    `Moneda: ${data.moneda}`,
  ]
  const labelSpacing = contentWidth / fiscalLabels.length
  fiscalLabels.forEach((label, i) => {
    doc.text(label, margin + 4 + i * labelSpacing, y + 5.5)
  })

  y += 12

  // === CONCEPTOS TABLE ===
  const tableBody = data.conceptos.map(c => [
    c.claveProdServ || '01010101',
    c.descripcion,
    c.cantidad.toString(),
    c.claveUnidad || 'H87',
    `$${c.valorUnitario.toFixed(2)}`,
    c.descuento ? `$${c.descuento.toFixed(2)}` : '-',
    `$${c.importe.toFixed(2)}`,
  ])

  autoTable(doc, {
    startY: y,
    head: [['Clave SAT', 'Descripcion', 'Cant.', 'Unidad', 'P. Unit.', 'Desc.', 'Importe']],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: COLOR_PRIMARIO,
      fontSize: 7,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 14, halign: 'right' },
      3: { cellWidth: 14 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })

  y = (doc as any).lastAutoTable.finalY + 6

  // === TOTALES ===
  const totalsX = pageWidth - margin - 65
  const totalsWidth = 65

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)

  const drawTotalLine = (label: string, value: string, bold: boolean = false) => {
    if (bold) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
    }
    doc.text(label, totalsX, y)
    doc.text(value, totalsX + totalsWidth, y, { align: 'right' })
    if (bold) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
    }
    y += 5
  }

  drawTotalLine('Subtotal:', formatMoneyPdf(data.subtotal, data.moneda))
  if (data.descuento && data.descuento > 0) {
    drawTotalLine('Descuento:', `-${formatMoneyPdf(data.descuento, data.moneda)}`)
  }
  drawTotalLine('IVA (16%):', formatMoneyPdf(data.iva, data.moneda))
  doc.setDrawColor(...COLOR_GRIS)
  doc.line(totalsX, y - 2, totalsX + totalsWidth, y - 2)
  doc.setTextColor(...COLOR_PRIMARIO)
  drawTotalLine('TOTAL:', formatMoneyPdf(data.total, data.moneda), true)

  y += 4

  // === SELLOS DIGITALES (solo si timbrada) ===
  if (data.uuid && data.selloCfdi) {
    // Check if we need a new page
    if (y > 220) {
      doc.addPage()
      y = margin
    }

    doc.setDrawColor(...COLOR_BORDE)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLOR_PRIMARIO)
    doc.text('SELLO DIGITAL DEL CFDI', margin, y)
    y += 4
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLOR_GRIS)
    const selloCfdiTrunc = truncateSello(data.selloCfdi, 50)
    const selloCfdiLines = doc.splitTextToSize(selloCfdiTrunc, contentWidth)
    doc.text(selloCfdiLines, margin, y)
    y += selloCfdiLines.length * 3 + 3

    if (data.selloSat) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...COLOR_PRIMARIO)
      doc.text('SELLO DIGITAL DEL SAT', margin, y)
      y += 4
      doc.setFontSize(6)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLOR_GRIS)
      const selloSatTrunc = truncateSello(data.selloSat, 50)
      const selloSatLines = doc.splitTextToSize(selloSatTrunc, contentWidth)
      doc.text(selloSatLines, margin, y)
      y += selloSatLines.length * 3 + 3
    }

    if (data.cadenaOriginal) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...COLOR_PRIMARIO)
      doc.text('CADENA ORIGINAL DEL TIMBRE', margin, y)
      y += 4
      doc.setFontSize(6)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLOR_GRIS)
      const cadenaTrunc = truncateSello(data.cadenaOriginal, 60)
      const cadenaLines = doc.splitTextToSize(cadenaTrunc, contentWidth)
      doc.text(cadenaLines, margin, y)
      y += cadenaLines.length * 3 + 3
    }

    // === QR CODE ===
    if (data.uuid && data.selloCfdi) {
      // Check if we need a new page for QR
      if (y > 230) {
        doc.addPage()
        y = margin
      }

      const fe = data.selloCfdi.slice(-8)
      const totalStr = data.total.toFixed(6).padStart(17, '0')
      const qrUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${data.uuid}&re=${data.emisor.rfc}&rr=${data.receptor.rfc}&tt=${totalStr}&fe=${fe}`

      try {
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          width: 150,
          margin: 1,
          errorCorrectionLevel: 'M',
        })

        const qrSize = 30
        doc.addImage(qrDataUrl, 'PNG', margin, y, qrSize, qrSize)

        // Datos del timbre al lado del QR
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLOR_GRIS)
        const qrTextX = margin + qrSize + 6
        let qrTextY = y + 4
        doc.text(`UUID: ${data.uuid}`, qrTextX, qrTextY)
        qrTextY += 4
        doc.text(`Fecha Timbrado: ${data.fechaTimbrado || ''}`, qrTextX, qrTextY)
        qrTextY += 4
        if (data.certificadoSat) {
          doc.text(`No. Certificado SAT: ${data.certificadoSat}`, qrTextX, qrTextY)
          qrTextY += 4
        }
        doc.text('RFC PAC: FIN1203015Q1 (Finkok)', qrTextX, qrTextY)

        y += qrSize + 6
      } catch (e) {
        console.error('Error generando QR:', e)
      }
    }
  }

  // === FOOTER ===
  doc.setFontSize(6)
  doc.setTextColor(180, 180, 180)
  doc.text(
    'Este documento es una representacion impresa de un CFDI',
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: 'center' }
  )

  return doc
}
