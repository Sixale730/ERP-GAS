import dayjs from 'dayjs'

// ── Interfaces ──────────────────────────────────────────────

export interface ColumnaExportar {
  titulo: string
  key: string
}

// ── Campos numéricos que reciben formato moneda ─────────────

const CAMPOS_MONEDA = new Set(['total', 'saldo', 'monto', 'subtotal', 'iva', 'precio', 'precio_con_iva', 'costo'])

// ── exportarExcel ───────────────────────────────────────────

export async function exportarExcel(
  nombre: string,
  columnas: ColumnaExportar[],
  datos: Record<string, unknown>[],
) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CUANTY ERP'
  wb.created = new Date()

  const ws = wb.addWorksheet(nombre, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  // Header row
  const headerRow = ws.addRow(columnas.map((c) => c.titulo))
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'B4B4B4' } },
    }
  })
  headerRow.height = 24

  // Data rows
  datos.forEach((row) => {
    const values = columnas.map((c) => row[c.key] ?? '')
    const dataRow = ws.addRow(values)

    dataRow.eachCell((cell, colNumber) => {
      const col = columnas[colNumber - 1]
      cell.font = { name: 'Calibri', size: 10 }
      cell.alignment = { vertical: 'middle' }

      if (CAMPOS_MONEDA.has(col.key) && typeof cell.value === 'number') {
        cell.numFmt = '$#,##0.00'
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
      }
    })
  })

  // Auto-fit column widths
  columnas.forEach((col, idx) => {
    const wsCol = ws.getColumn(idx + 1)
    let maxLen = col.titulo.length
    datos.forEach((row) => {
      const len = String(row[col.key] ?? '').length
      if (len > maxLen) maxLen = len
    })
    wsCol.width = Math.min(Math.max(maxLen + 3, 10), 45)
  })

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }]

  // Auto-filter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1 + datos.length, column: columnas.length },
  }

  // Download
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  descargarBlob(blob, `${nombre}_${dayjs().format('YYYY-MM-DD')}.xlsx`)
}

// ── exportarPDF ─────────────────────────────────────────────

export async function exportarPDF(
  nombre: string,
  columnas: ColumnaExportar[],
  datos: Record<string, unknown>[],
) {
  const { default: jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const orientation = columnas.length > 5 ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'letter' })

  // Title
  const fecha = dayjs().format('DD/MM/YYYY HH:mm')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(nombre, 14, 15)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generado: ${fecha}`, 14, 21)

  // Table
  const head = [columnas.map((c) => c.titulo)]
  const body = datos.map((row) =>
    columnas.map((c) => {
      const val = row[c.key]
      if (CAMPOS_MONEDA.has(c.key) && typeof val === 'number') {
        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
      return val != null ? String(val) : ''
    }),
  )

  autoTable(doc, {
    startY: 26,
    head,
    body,
    headStyles: {
      fillColor: [22, 119, 255], // #1677ff
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    styles: {
      cellPadding: 2,
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
    },
    margin: { left: 14, right: 14 },
  })

  doc.save(`${nombre}_${dayjs().format('YYYY-MM-DD')}.pdf`)
}

// ── Helper ──────────────────────────────────────────────────

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
