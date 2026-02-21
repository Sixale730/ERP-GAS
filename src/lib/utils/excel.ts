import type ExcelJS from 'exceljs'

// ── Interfaces ──────────────────────────────────────────────

export interface ColumnaExcel {
  titulo: string
  dataIndex: string
  formato?: 'moneda' | 'fecha' | 'porcentaje' | 'numero'
  ancho?: number
}

export interface ResumenEstadistica {
  etiqueta: string
  valor: string | number
  formato?: 'moneda' | 'numero' | 'texto'
}

export interface ExportarExcelParams {
  columnas: ColumnaExcel[]
  datos: Record<string, unknown>[]
  nombreArchivo: string
  nombreHoja?: string
  tituloReporte?: string
  subtitulo?: string
  resumen?: ResumenEstadistica[]
  statusDataIndex?: string
  mapaColorStatus?: Record<string, string>
}

// ── Paleta corporativa ──────────────────────────────────────

const DARK_BLUE = '2B3A4E'
const PRIMARY_BLUE = '2980B9'
const SUMMARY_BG = 'EBF5FB'
const LIGHT_GRAY = 'F5F5F5'
const BORDER_GRAY = 'B4B4B4'
const TEXT_DARK = '333333'
const TEXT_GRAY = '666666'

// ── Helpers ─────────────────────────────────────────────────

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_GRAY } }
  return { top: side, bottom: side, left: side, right: side }
}

function formatearValorResumen(valor: string | number, formato?: string): string {
  if (formato === 'moneda' && typeof valor === 'number') {
    return `$${valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  if (formato === 'numero' && typeof valor === 'number') {
    return valor.toLocaleString('en-US')
  }
  return String(valor)
}

// ── Función principal ───────────────────────────────────────

export async function exportarExcel({
  columnas,
  datos,
  nombreArchivo,
  nombreHoja = 'Datos',
  tituloReporte,
  subtitulo,
  resumen,
  statusDataIndex,
  mapaColorStatus,
}: ExportarExcelParams) {
  const ExcelJSLib = (await import('exceljs')).default
  const wb = new ExcelJSLib.Workbook()
  wb.creator = 'CUANTY ERP'
  wb.created = new Date()

  const ws = wb.addWorksheet(nombreHoja, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  const totalCols = columnas.length
  const ahora = new Date()
  const fechaStr = `${String(ahora.getDate()).padStart(2, '0')}/${String(ahora.getMonth() + 1).padStart(2, '0')}/${ahora.getFullYear()} ${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}:${String(ahora.getSeconds()).padStart(2, '0')}`

  let currentRow = 1

  // ── 1. Encabezado ───────────────────────────────────────

  if (tituloReporte) {
    // Fila 1: Titulo
    ws.mergeCells(currentRow, 1, currentRow, totalCols)
    const titleCell = ws.getCell(currentRow, 1)
    titleCell.value = tituloReporte
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getRow(currentRow).height = 36
    currentRow++

    // Fila 2: Subtitulo
    ws.mergeCells(currentRow, 1, currentRow, totalCols)
    const subCell = ws.getCell(currentRow, 1)
    subCell.value = subtitulo || nombreHoja
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFFFFF' } }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } }
    subCell.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getRow(currentRow).height = 22
    currentRow++

    // Fila 3: Fecha generacion
    ws.mergeCells(currentRow, 1, currentRow, totalCols)
    const dateCell = ws.getCell(currentRow, 1)
    dateCell.value = `Generado: ${fechaStr}`
    dateCell.font = { name: 'Calibri', size: 9, color: { argb: 'FFFFFF' } }
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } }
    dateCell.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getRow(currentRow).height = 20
    currentRow++

    // Fila 4: Spacer
    ws.getRow(currentRow).height = 8
    currentRow++
  }

  // ── 2. Resumen ejecutivo ────────────────────────────────

  if (resumen && resumen.length > 0) {
    // Fila titulo resumen
    ws.mergeCells(currentRow, 1, currentRow, totalCols)
    const resTitleCell = ws.getCell(currentRow, 1)
    resTitleCell.value = 'RESUMEN EJECUTIVO'
    resTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: PRIMARY_BLUE } }
    resTitleCell.alignment = { vertical: 'middle' }
    ws.getRow(currentRow).height = 22
    currentRow++

    // Fila etiquetas
    const labelRow = ws.getRow(currentRow)
    resumen.forEach((item, idx) => {
      const cell = labelRow.getCell(idx + 1)
      cell.value = item.etiqueta
      cell.font = { name: 'Calibri', size: 9, color: { argb: TEXT_GRAY } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMMARY_BG } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = thinBorder()
    })
    labelRow.height = 20
    currentRow++

    // Fila valores
    const valRow = ws.getRow(currentRow)
    resumen.forEach((item, idx) => {
      const cell = valRow.getCell(idx + 1)
      cell.value = formatearValorResumen(item.valor, item.formato)
      cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: PRIMARY_BLUE } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUMMARY_BG } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = thinBorder()
    })
    valRow.height = 28
    currentRow++

    // Spacer
    ws.getRow(currentRow).height = 8
    currentRow++
  }

  // ── 3. Tabla de datos ───────────────────────────────────

  const headerRowNum = currentRow

  // Header row
  const headerRow = ws.getRow(headerRowNum)
  columnas.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = col.titulo
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_BLUE } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = thinBorder()
  })
  headerRow.height = 24
  currentRow++

  // Data rows
  datos.forEach((row, rowIdx) => {
    const dataRow = ws.getRow(currentRow)

    // Determine status color for this row
    let statusColor: string | undefined
    if (statusDataIndex && mapaColorStatus) {
      const statusVal = String(row[statusDataIndex] ?? '')
      statusColor = mapaColorStatus[statusVal]
    }

    columnas.forEach((col, colIdx) => {
      const cell = dataRow.getCell(colIdx + 1)
      const rawVal = row[col.dataIndex]

      // Set value
      if (rawVal === null || rawVal === undefined) {
        cell.value = ''
      } else if (col.formato === 'porcentaje' && typeof rawVal === 'number') {
        cell.value = rawVal / 100
      } else {
        cell.value = rawVal as ExcelJS.CellValue
      }

      // Font
      cell.font = { name: 'Calibri', size: 10, color: { argb: TEXT_DARK } }

      // Fill: status color > alternating rows
      if (statusColor) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor } }
      } else if (rowIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } }
      }

      // Borders
      cell.border = thinBorder()

      // Number format + alignment
      if (col.formato === 'moneda') {
        cell.numFmt = '$#,##0.00'
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      } else if (col.formato === 'porcentaje') {
        cell.numFmt = '0%'
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      } else if (col.formato === 'numero') {
        cell.numFmt = '#,##0'
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      } else {
        cell.alignment = { vertical: 'middle' }
      }
    })

    currentRow++
  })

  // ── 4. Pie de pagina ────────────────────────────────────

  currentRow++ // blank spacer row
  ws.mergeCells(currentRow, 1, currentRow, totalCols)
  const footerCell = ws.getCell(currentRow, 1)
  footerCell.value = `Documento generado por CUANTY ERP | ${fechaStr}`
  footerCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: TEXT_GRAY } }
  footerCell.alignment = { horizontal: 'center', vertical: 'middle' }

  // ── 5. Configuracion de hoja ────────────────────────────

  // Column widths
  columnas.forEach((col, idx) => {
    const wsCol = ws.getColumn(idx + 1)
    if (col.ancho) {
      wsCol.width = col.ancho
    } else {
      // Auto-fit: max of header length and data content
      let maxLen = col.titulo.length
      datos.forEach(row => {
        const val = row[col.dataIndex]
        const len = String(val ?? '').length
        if (len > maxLen) maxLen = len
      })
      wsCol.width = Math.min(Math.max(maxLen + 4, 10), 45)
    }
  })

  // Freeze panes at table header
  ws.views = [{ state: 'frozen', ySplit: headerRowNum, xSplit: 0 }]

  // Auto-filter on table header range
  const lastDataRow = headerRowNum + datos.length
  ws.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: lastDataRow, column: totalCols },
  }

  // ── 6. Descarga ─────────────────────────────────────────

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreArchivo}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
