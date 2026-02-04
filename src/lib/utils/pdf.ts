import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import dayjs from 'dayjs'
import { EMPRESA } from '@/lib/config/empresa'
import { formatMoneyCurrency, formatDate } from './format'
import { type CodigoMoneda } from '@/lib/config/moneda'

// Opciones de moneda para PDFs
export interface OpcionesMoneda {
  moneda: CodigoMoneda
  tipoCambio?: number // Solo aplica si moneda es MXN
}

// Helper para formatear montos con la moneda seleccionada
// NO convierte el monto - los precios ya están guardados en la moneda correcta
function formatMontoConMoneda(amount: number, opciones: OpcionesMoneda): string {
  // No pasar tipoCambio para evitar doble conversión - los precios ya están en la moneda guardada
  return formatMoneyCurrency(amount, opciones.moneda)
}

// Tipos para cotizaciones - exportados para uso externo
export interface CotizacionPDF {
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
  vendedor_nombre?: string | null
}

interface ItemPDF {
  sku?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje?: number
  subtotal: number
}

// Tipos para facturas - exportados para uso externo
export interface FacturaPDF {
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
  vendedor_nombre?: string | null
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
  data: { cliente_nombre: string; cliente_rfc?: string | null; almacen_nombre: string; fecha: string; fecha_vencimiento?: string; vendedor_nombre?: string | null }
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

  // Columna derecha - fechas y vendedor
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('FECHA', 14 + colWidth, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text(formatDate(data.fecha), 14 + colWidth, y + 6)

  let yDerecha = y + 14
  if (data.fecha_vencimiento) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('VIGENCIA', 14 + colWidth, yDerecha)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLOR_GRIS)
    doc.text(formatDate(data.fecha_vencimiento), 14 + colWidth, yDerecha + 6)
    yDerecha += 14
  }

  // Vendedor
  if (data.vendedor_nombre) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('VENDEDOR', 14 + colWidth, yDerecha)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLOR_GRIS)
    doc.text(data.vendedor_nombre, 14 + colWidth, yDerecha + 6)
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
  opciones?: OpcionesMoneda
): void {
  // Si no se pasan opciones, usar la moneda de la cotización o MXN por defecto
  const opcionesFinales: OpcionesMoneda = opciones || {
    moneda: ((cotizacion as any).moneda as CodigoMoneda) || 'MXN'
  }
  const doc = new jsPDF()

  let y = generarEncabezado(doc, 'COTIZACION', cotizacion.folio)
  y = generarDatosCliente(doc, y, cotizacion)

  y = generarTablaProductos(doc, y, items, opcionesFinales)
  y = generarTotales(doc, y, cotizacion, opcionesFinales)
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
  opciones?: OpcionesMoneda
): void {
  // Si no se pasan opciones, usar la moneda de la factura o MXN por defecto
  const opcionesFinales: OpcionesMoneda = opciones || {
    moneda: ((factura as any).moneda as CodigoMoneda) || 'MXN'
  }
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

  y = generarTablaProductos(doc, y, items, opcionesFinales)
  y = generarTotales(doc, y, { ...factura, saldo: factura.saldo }, opcionesFinales)
  generarNotas(doc, y, factura.notas)

  // Pie de página
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_GRIS)
  doc.text('Gracias por su preferencia', doc.internal.pageSize.getWidth() / 2, pageHeight - 10, { align: 'center' })

  doc.save(`${factura.folio}.pdf`)
}

// Tipos para órdenes de compra
interface OrdenCompraPDF {
  folio: string
  fecha: string
  fecha_esperada?: string | null
  proveedor_nombre: string
  proveedor_rfc?: string | null
  proveedor_contacto?: string | null
  almacen_nombre: string
  subtotal: number
  iva: number
  total: number
  notas?: string | null
  moneda?: 'USD' | 'MXN'
}

interface ItemOrdenCompraPDF {
  sku?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  margen_porcentaje?: number
  subtotal: number
}

/**
 * Genera la sección de datos del proveedor
 */
function generarDatosProveedor(
  doc: jsPDF,
  y: number,
  data: {
    proveedor_nombre: string
    proveedor_rfc?: string | null
    proveedor_contacto?: string | null
    almacen_nombre: string
    fecha: string
    fecha_esperada?: string | null
  }
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const colWidth = (pageWidth - 28) / 2

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('PROVEEDOR', 14, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text(data.proveedor_nombre, 14, y + 6)
  if (data.proveedor_rfc) {
    doc.text(`RFC: ${data.proveedor_rfc}`, 14, y + 12)
  }
  if (data.proveedor_contacto) {
    doc.text(`Contacto: ${data.proveedor_contacto}`, 14, y + (data.proveedor_rfc ? 18 : 12))
  }

  // Columna derecha - fechas y almacén
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('FECHA', 14 + colWidth, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text(formatDate(data.fecha), 14 + colWidth, y + 6)

  if (data.fecha_esperada) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('FECHA ESPERADA', 14 + colWidth, y + 14)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLOR_GRIS)
    doc.text(formatDate(data.fecha_esperada), 14 + colWidth, y + 20)
  }

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('ALMACEN DESTINO', 14 + colWidth, y + (data.fecha_esperada ? 28 : 14))
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text(data.almacen_nombre, 14 + colWidth, y + (data.fecha_esperada ? 34 : 20))

  return y + 40
}

/**
 * Genera la tabla de productos para orden de compra
 */
function generarTablaProductosOC(doc: jsPDF, y: number, items: ItemOrdenCompraPDF[], opciones: OpcionesMoneda): number {
  const tableData = items.map(item => [
    item.sku || '-',
    item.descripcion,
    item.cantidad.toString(),
    formatMontoConMoneda(item.precio_unitario, opciones),
    item.margen_porcentaje ? `${item.margen_porcentaje}%` : '-',
    formatMontoConMoneda(item.subtotal, opciones),
  ])

  autoTable(doc, {
    startY: y,
    head: [['SKU', 'Descripcion', 'Cant.', 'P. Unitario', 'Margen', 'Subtotal']],
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
 * Genera el resumen de totales para orden de compra (sin descuento)
 */
function generarTotalesOC(
  doc: jsPDF,
  y: number,
  totales: { subtotal: number; iva: number; total: number },
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

  return y + 15
}

/**
 * Genera encabezado para orden de compra
 */
function generarEncabezadoOC(doc: jsPDF, folio: string): number {
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
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLOR_PRIMARIO)
  doc.text('ORDEN DE COMPRA', pageWidth - 14, y + 5, { align: 'right' })

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
 * Genera PDF de orden de compra
 */
export function generarPDFOrdenCompra(
  orden: OrdenCompraPDF,
  items: ItemOrdenCompraPDF[],
  opciones?: OpcionesMoneda
): void {
  // Si no se pasan opciones, usar la moneda de la orden o MXN por defecto
  const opcionesFinales: OpcionesMoneda = opciones || {
    moneda: (orden.moneda as CodigoMoneda) || 'MXN'
  }
  const doc = new jsPDF()

  let y = generarEncabezadoOC(doc, orden.folio)
  y = generarDatosProveedor(doc, y, orden)

  // Mostrar moneda
  if (orden.moneda) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLOR_GRIS)
    doc.text(`Moneda: ${orden.moneda}`, 14, y - 5)
    y += 5
  }

  y = generarTablaProductosOC(doc, y, items, opcionesFinales)
  y = generarTotalesOC(doc, y, orden, opcionesFinales)
  generarNotas(doc, y, orden.notas)

  // Pie de página
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_GRIS)
  doc.text('Documento generado electronicamente', doc.internal.pageSize.getWidth() / 2, pageHeight - 10, { align: 'center' })

  doc.save(`${orden.folio}.pdf`)
}

/**
 * Prepara los datos de una cotización para generar el PDF
 * Calcula la fecha de vencimiento y extrae el vendedor
 */
export function prepararDatosCotizacionPDF(cotData: any): {
  cotizacion: CotizacionPDF
  opciones: OpcionesMoneda
} {
  // Calcular fecha de vencimiento
  const vigenciaDias = cotData.vigencia_dias || 30
  const fechaVencimiento = dayjs(cotData.fecha).add(vigenciaDias, 'day').format('YYYY-MM-DD')

  const cotizacion: CotizacionPDF = {
    folio: cotData.folio,
    fecha: cotData.fecha,
    fecha_vencimiento: fechaVencimiento,
    cliente_nombre: cotData.cliente_nombre,
    cliente_rfc: cotData.cliente_rfc,
    almacen_nombre: cotData.almacen_nombre,
    subtotal: cotData.subtotal,
    descuento_porcentaje: cotData.descuento_porcentaje || 0,
    descuento_monto: cotData.descuento_monto || 0,
    iva: cotData.iva,
    total: cotData.total,
    notas: cotData.notas,
    vendedor_nombre: cotData.vendedor_nombre,
  }

  const opciones: OpcionesMoneda = {
    moneda: cotData.moneda || 'MXN',
    tipoCambio: cotData.tipo_cambio || undefined,
  }

  return { cotizacion, opciones }
}

/**
 * Prepara los datos de una factura para generar el PDF
 */
export function prepararDatosFacturaPDF(facData: any): {
  factura: FacturaPDF
  opciones: OpcionesMoneda
} {
  const factura: FacturaPDF = {
    folio: facData.folio,
    fecha: facData.fecha,
    fecha_vencimiento: facData.fecha_vencimiento,
    cliente_nombre: facData.cliente_nombre,
    cliente_rfc: facData.cliente_rfc,
    almacen_nombre: facData.almacen_nombre,
    subtotal: facData.subtotal,
    descuento_porcentaje: facData.descuento_porcentaje || 0,
    descuento_monto: facData.descuento_monto || 0,
    iva: facData.iva,
    total: facData.total,
    saldo: facData.saldo,
    notas: facData.notas,
    cotizacion_folio: facData.cotizacion_folio,
    vendedor_nombre: facData.vendedor_nombre,
  }

  const opciones: OpcionesMoneda = {
    moneda: facData.moneda || 'USD',
    tipoCambio: facData.moneda === 'MXN' ? (facData.tipo_cambio || undefined) : undefined,
  }

  return { factura, opciones }
}
