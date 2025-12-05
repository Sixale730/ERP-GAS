import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { EMPRESA } from '@/lib/config/empresa'
import { formatMoneyCurrency, formatDate } from './format'
import { type CodigoMoneda } from '@/lib/config/moneda'

// Opciones de moneda para PDFs
export interface OpcionesMoneda {
  moneda: CodigoMoneda
  tipoCambio?: number // Solo aplica si moneda es MXN
}

// Helper para formatear montos con la moneda seleccionada
function formatMontoConMoneda(amount: number, opciones: OpcionesMoneda): string {
  return formatMoneyCurrency(amount, opciones.moneda, opciones.tipoCambio)
}

// Tipos para cotizaciones
interface CotizacionPDF {
  folio: string
  fecha: string
  fecha_vencimiento?: string
  cliente_nombre: string
  cliente_rfc?: string | null
  almacen_nombre: string
  subtotal: number
  descuento_porcentaje: number
  descuento_monto: number
  iva: number
  total: number
  notas?: string | null
}

interface ItemPDF {
  sku?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje?: number
  subtotal: number
}

// Tipos para facturas
interface FacturaPDF {
  folio: string
  fecha: string
  fecha_vencimiento?: string
  cliente_nombre: string
  cliente_rfc?: string | null
  almacen_nombre: string
  subtotal: number
  descuento_porcentaje: number
  descuento_monto: number
  iva: number
  total: number
  saldo?: number
  notas?: string | null
  cotizacion_folio?: string | null
}

// Colores
const COLOR_PRIMARIO: [number, number, number] = [41, 128, 185] // Azul
const COLOR_GRIS: [number, number, number] = [100, 100, 100]

/**
 * Genera el encabezado de la empresa
 */
function generarEncabezado(doc: jsPDF, tipo: 'COTIZACION' | 'FACTURA', folio: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20

  // Logo (si existe)
  if (EMPRESA.logo) {
    try {
      doc.addImage(EMPRESA.logo, 'PNG', 14, y, 30, 30)
    } catch {
      // Si falla el logo, continuar sin él
    }
  }

  // Nombre empresa
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLOR_PRIMARIO)
  doc.text(EMPRESA.nombre, EMPRESA.logo ? 50 : 14, y + 5)

  // Datos empresa
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  const xDatos = EMPRESA.logo ? 50 : 14
  doc.text(`RFC: ${EMPRESA.rfc}`, xDatos, y + 12)
  doc.text(EMPRESA.direccion, xDatos, y + 17)
  doc.text(`Tel: ${EMPRESA.telefono} | ${EMPRESA.email}`, xDatos, y + 22)

  // Tipo de documento (derecha)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLOR_PRIMARIO)
  doc.text(tipo === 'COTIZACION' ? 'COTIZACION' : 'FACTURA', pageWidth - 14, y + 5, { align: 'right' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text(folio, pageWidth - 14, y + 14, { align: 'right' })

  // Línea separadora
  y += 35
  doc.setDrawColor(...COLOR_PRIMARIO)
  doc.setLineWidth(0.5)
  doc.line(14, y, pageWidth - 14, y)

  return y + 10
}

/**
 * Genera la sección de datos del cliente
 */
function generarDatosCliente(
  doc: jsPDF,
  y: number,
  data: { cliente_nombre: string; cliente_rfc?: string | null; almacen_nombre: string; fecha: string; fecha_vencimiento?: string }
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const colWidth = (pageWidth - 28) / 2

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('CLIENTE', 14, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text(data.cliente_nombre, 14, y + 6)
  if (data.cliente_rfc) {
    doc.text(`RFC: ${data.cliente_rfc}`, 14, y + 12)
  }
  doc.text(`Almacen: ${data.almacen_nombre}`, 14, y + (data.cliente_rfc ? 18 : 12))

  // Columna derecha - fechas
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('FECHA', 14 + colWidth, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text(formatDate(data.fecha), 14 + colWidth, y + 6)
  if (data.fecha_vencimiento) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('VIGENCIA', 14 + colWidth, y + 14)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLOR_GRIS)
    doc.text(formatDate(data.fecha_vencimiento), 14 + colWidth, y + 20)
  }

  return y + 30
}

/**
 * Genera la tabla de productos
 */
function generarTablaProductos(doc: jsPDF, y: number, items: ItemPDF[], opciones: OpcionesMoneda): number {
  const tableData = items.map(item => [
    item.sku || '-',
    item.descripcion,
    item.cantidad.toString(),
    formatMontoConMoneda(item.precio_unitario, opciones),
    item.descuento_porcentaje ? `${item.descuento_porcentaje}%` : '-',
    formatMontoConMoneda(item.subtotal, opciones),
  ])

  autoTable(doc, {
    startY: y,
    head: [['SKU', 'Descripcion', 'Cant.', 'P. Unitario', 'Desc.', 'Subtotal']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: COLOR_PRIMARIO,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLOR_GRIS,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  return (doc as any).lastAutoTable.finalY + 10
}

/**
 * Genera el resumen de totales
 */
function generarTotales(
  doc: jsPDF,
  y: number,
  totales: { subtotal: number; descuento_porcentaje: number; descuento_monto: number; iva: number; total: number; saldo?: number },
  opciones: OpcionesMoneda
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const xLabel = pageWidth - 80
  const xValue = pageWidth - 14

  doc.setFontSize(10)

  // Subtotal
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text('Subtotal:', xLabel, y)
  doc.text(formatMontoConMoneda(totales.subtotal, opciones), xValue, y, { align: 'right' })

  // Descuento (si hay)
  if (totales.descuento_monto > 0) {
    y += 6
    doc.text(`Descuento (${totales.descuento_porcentaje}%):`, xLabel, y)
    doc.setTextColor(220, 53, 69)
    doc.text(`-${formatMontoConMoneda(totales.descuento_monto, opciones)}`, xValue, y, { align: 'right' })
    doc.setTextColor(...COLOR_GRIS)
  }

  // IVA
  y += 6
  doc.text('IVA (16%):', xLabel, y)
  doc.text(formatMontoConMoneda(totales.iva, opciones), xValue, y, { align: 'right' })

  // Línea
  y += 4
  doc.setDrawColor(...COLOR_GRIS)
  doc.line(xLabel, y, xValue, y)

  // Total
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...COLOR_PRIMARIO)
  doc.text('TOTAL:', xLabel, y)
  doc.text(formatMontoConMoneda(totales.total, opciones), xValue, y, { align: 'right' })

  // Saldo pendiente (solo facturas)
  if (totales.saldo !== undefined && totales.saldo > 0) {
    y += 8
    doc.setFontSize(10)
    doc.setTextColor(220, 53, 69)
    doc.text('Saldo Pendiente:', xLabel, y)
    doc.text(formatMontoConMoneda(totales.saldo, opciones), xValue, y, { align: 'right' })
  }

  return y + 15
}

/**
 * Genera la sección de notas
 */
function generarNotas(doc: jsPDF, y: number, notas: string | null | undefined): number {
  if (!notas) return y

  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('NOTAS:', 14, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  const lines = doc.splitTextToSize(notas, pageWidth - 28)
  doc.text(lines, 14, y + 6)

  return y + 6 + lines.length * 5
}

/**
 * Genera PDF de cotización
 */
export function generarPDFCotizacion(
  cotizacion: CotizacionPDF,
  items: ItemPDF[],
  opciones: OpcionesMoneda = { moneda: 'USD' }
): void {
  const doc = new jsPDF()

  let y = generarEncabezado(doc, 'COTIZACION', cotizacion.folio)
  y = generarDatosCliente(doc, y, cotizacion)

  // Mostrar moneda y tipo de cambio si aplica
  if (opciones.moneda === 'MXN' && opciones.tipoCambio) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLOR_GRIS)
    doc.text(`Tipo de cambio: 1 USD = ${opciones.tipoCambio.toFixed(2)} MXN`, 14, y - 5)
    y += 5
  }

  y = generarTablaProductos(doc, y, items, opciones)
  y = generarTotales(doc, y, cotizacion, opciones)
  generarNotas(doc, y, cotizacion.notas)

  // Pie de página
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_GRIS)
  doc.text('Gracias por su preferencia', doc.internal.pageSize.getWidth() / 2, pageHeight - 10, { align: 'center' })

  doc.save(`${cotizacion.folio}.pdf`)
}

/**
 * Genera PDF de factura
 */
export function generarPDFFactura(
  factura: FacturaPDF,
  items: ItemPDF[],
  opciones: OpcionesMoneda = { moneda: 'USD' }
): void {
  const doc = new jsPDF()

  let y = generarEncabezado(doc, 'FACTURA', factura.folio)
  y = generarDatosCliente(doc, y, factura)

  // Referencia a cotización (si existe)
  if (factura.cotizacion_folio) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLOR_GRIS)
    doc.text(`Ref. Cotizacion: ${factura.cotizacion_folio}`, 14, y - 5)
    y += 5
  }

  // Mostrar moneda y tipo de cambio si aplica
  if (opciones.moneda === 'MXN' && opciones.tipoCambio) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLOR_GRIS)
    doc.text(`Tipo de cambio: 1 USD = ${opciones.tipoCambio.toFixed(2)} MXN`, 14, y - 5)
    y += 5
  }

  y = generarTablaProductos(doc, y, items, opciones)
  y = generarTotales(doc, y, { ...factura, saldo: factura.saldo }, opciones)
  generarNotas(doc, y, factura.notas)

  // Pie de página
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_GRIS)
  doc.text('Gracias por su preferencia', doc.internal.pageSize.getWidth() / 2, pageHeight - 10, { align: 'center' })

  doc.save(`${factura.folio}.pdf`)
}
