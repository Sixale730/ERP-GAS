import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COLOR_PRIMARIO: [number, number, number] = [41, 128, 185]
const COLOR_GRIS: [number, number, number] = [100, 100, 100]

function formatFecha(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0')
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

function formatMoney(n: number): string {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function generarURLPDFDemo(): string {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const hoy = new Date()
  const vigencia = new Date(hoy)
  vigencia.setDate(vigencia.getDate() + 30)

  let y = 20

  // ─── Logo placeholder ────────────────────────────────────────────────
  doc.setFillColor(220, 220, 220)
  doc.roundedRect(14, y, 40, 18, 3, 3, 'F')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(150, 150, 150)
  doc.text('TU LOGO', 34, y + 11, { align: 'center' })

  // ─── Nombre empresa ──────────────────────────────────────────────────
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLOR_PRIMARIO)
  doc.text('TU EMPRESA S.A. de C.V.', 60, y + 8)

  // Datos empresa
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text('RFC: XAXX010101000', 60, y + 14)
  doc.text('Av. Principal #123, Col. Centro, CDMX, C.P. 06000', 60, y + 19)
  doc.text('Tel: (55) 1234-5678 | contacto@tuempresa.com', 60, y + 24)

  // ─── Tipo de documento (derecha) ─────────────────────────────────────
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLOR_PRIMARIO)
  doc.text('COTIZACIÓN', pageWidth - 14, y + 8, { align: 'right' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text('COT-DEMO-001', pageWidth - 14, y + 17, { align: 'right' })

  // ─── Línea separadora ────────────────────────────────────────────────
  y += 32
  doc.setDrawColor(...COLOR_PRIMARIO)
  doc.setLineWidth(0.5)
  doc.line(14, y, pageWidth - 14, y)
  y += 6

  // ─── Datos cliente (2 columnas) ──────────────────────────────────────
  const colWidth = (pageWidth - 28) / 2
  const xDer = 14 + colWidth
  const rowH = 5

  const drawRow = (x: number, yPos: number, label: string, value: string, offset: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    doc.text(label, x, yPos)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLOR_GRIS)
    doc.text(value, x + offset, yPos)
  }

  // Columna izquierda
  drawRow(14, y, 'CLIENTE:', 'Tu Cliente S.A. de C.V.', 28)
  y += rowH
  drawRow(14, y, 'RFC:', 'XEXX010101000', 28)
  y += rowH
  drawRow(14, y, 'ATENCIÓN:', 'Nombre del Contacto', 28)

  // Columna derecha
  let yDer = y - rowH * 2
  drawRow(xDer, yDer, 'FECHA:', formatFecha(hoy), 30)
  yDer += rowH
  drawRow(xDer, yDer, 'VIGENCIA:', formatFecha(vigencia), 30)
  yDer += rowH
  drawRow(xDer, yDer, 'VENDEDOR:', 'Juan Pérez', 30)
  yDer += rowH
  drawRow(xDer, yDer, 'CONDICIONES:', '30 días', 30)
  yDer += rowH
  drawRow(xDer, yDer, 'MONEDA:', 'MXN', 30)

  y = Math.max(y, yDer) + 8

  // ─── Tabla de productos ──────────────────────────────────────────────
  const items = [
    { sku: 'PROD-001', desc: 'Laptop Empresarial 15" Core i7 16GB RAM', qty: 5, price: 18500, disc: 0 },
    { sku: 'PROD-002', desc: 'Monitor LED 27" 4K USB-C', qty: 5, price: 8900, disc: 10 },
    { sku: 'PROD-003', desc: 'Docking Station USB-C Triple Display', qty: 5, price: 3200, disc: 0 },
  ]

  const tableData = items.map(item => {
    const subtotal = item.qty * item.price * (1 - item.disc / 100)
    return [
      item.sku,
      item.desc,
      item.qty.toString(),
      formatMoney(item.price),
      item.disc ? `${item.disc}%` : '-',
      formatMoney(subtotal),
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['SKU', 'Descripción', 'Cant.', 'P. Unitario', 'Desc.', 'Subtotal']],
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10

  // ─── Totales ─────────────────────────────────────────────────────────
  // Cálculos
  const subtotalBruto = items.reduce((sum, i) => sum + i.qty * i.price, 0)
  const descuentoTotal = items.reduce((sum, i) => sum + i.qty * i.price * (i.disc / 100), 0)
  const subtotalNeto = subtotalBruto - descuentoTotal
  const iva = subtotalNeto * 0.16
  const total = subtotalNeto + iva

  const xLabel = pageWidth - 80
  const xValue = pageWidth - 14

  const drawTotalRow = (yPos: number, label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 11 : 9)
    doc.setTextColor(bold ? 0 : 100, bold ? 0 : 100, bold ? 0 : 100)
    doc.text(label, xLabel, yPos, { align: 'right' })
    doc.text(value, xValue, yPos, { align: 'right' })
  }

  drawTotalRow(y, 'Subtotal:', formatMoney(subtotalBruto))
  y += 6
  drawTotalRow(y, 'Descuento:', `- ${formatMoney(descuentoTotal)}`)
  y += 6
  drawTotalRow(y, 'IVA (16%):', formatMoney(iva))
  y += 8

  // Línea antes del total
  doc.setDrawColor(...COLOR_PRIMARIO)
  doc.setLineWidth(0.3)
  doc.line(xLabel - 10, y - 3, xValue, y - 3)

  drawTotalRow(y, 'TOTAL:', formatMoney(total), true)
  y += 14

  // ─── Datos bancarios ─────────────────────────────────────────────────
  doc.setFillColor(245, 245, 245)
  doc.roundedRect(14, y, pageWidth - 28, 28, 2, 2, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLOR_PRIMARIO)
  doc.text('DATOS PARA TRANSFERENCIA', 18, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_GRIS)
  doc.text('Banco: BBVA  |  Cuenta: 0123456789  |  CLABE: 012345678901234567', 18, y + 13)
  doc.text('Beneficiario: TU EMPRESA S.A. de C.V.', 18, y + 19)
  doc.text('Referencia: COT-DEMO-001', 18, y + 25)

  y += 36

  // ─── Notas ───────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Notas:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text('Precios sujetos a cambio sin previo aviso. Entrega estimada: 5-7 días hábiles.', 14, y + 6)

  y += 16

  // ─── Footer ──────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(14, y, pageWidth - 14, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLOR_GRIS)
  doc.text('Gracias por su preferencia', pageWidth / 2, y, { align: 'center' })

  doc.setFontSize(7)
  doc.text('Este es un documento de demostración generado por CUANTY ERP', pageWidth / 2, y + 5, { align: 'center' })

  // ─── Retornar blob URL ───────────────────────────────────────────────
  const blob = doc.output('blob')
  return URL.createObjectURL(blob)
}
