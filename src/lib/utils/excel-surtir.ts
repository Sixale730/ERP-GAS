import type ExcelJS from 'exceljs'
import type { AllocOV, EstadoSurtido } from '@/lib/hooks/queries/useReporteSurtir'

const PRIMARY_BLUE = '2980B9'
const DARK_BLUE = '2B3A4E'
const BORDER_GRAY = 'B4B4B4'

const ESTADO_COLOR: Record<EstadoSurtido, string> = {
  completo: 'C6EFCE',
  completo_otro_almacen: 'CCE5FF',
  parcial: 'FFEB9C',
  sin_stock: 'FFC7CE',
  servicio: 'F0F0F0',
}

const ESTADO_LABEL: Record<EstadoSurtido, string> = {
  completo: 'En almacen',
  completo_otro_almacen: 'En otro almacen',
  parcial: 'Parcial',
  sin_stock: 'Sin stock',
  servicio: 'N/A (servicio)',
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_GRAY } }
  return { top: side, bottom: side, left: side, right: side }
}

function formatFecha(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function writeHeader(ws: ExcelJS.Worksheet, titulo: string, numCols: number) {
  ws.mergeCells(1, 1, 1, numCols)
  const c = ws.getCell(1, 1)
  c.value = titulo
  c.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } }
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } }
  c.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 28
}

function writeColumnHeaders(ws: ExcelJS.Worksheet, headers: string[], rowNum: number) {
  const row = ws.getRow(rowNum)
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1)
    cell.value = h
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_BLUE } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = thinBorder()
  })
  row.height = 22
}

function aplicarColorEstado(row: ExcelJS.Row, estado: EstadoSurtido, numCols: number) {
  const color = ESTADO_COLOR[estado]
  for (let i = 1; i <= numCols; i++) {
    const cell = row.getCell(i)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
    cell.border = thinBorder()
    cell.font = { name: 'Calibri', size: 10 }
  }
}

export async function exportarSurtirExcel(ovs: AllocOV[], nombreArchivo: string) {
  const ExcelJSLib = (await import('exceljs')).default
  const wb = new ExcelJSLib.Workbook()
  wb.creator = 'CUANTY ERP'
  wb.created = new Date()

  // ── Hoja 1: Resumen por OV ─────────────────────────────────
  const wsResumen = wb.addWorksheet('Resumen por OV', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 2 }],
  })

  const colsResumen = [
    { h: 'Folio', w: 14 },
    { h: 'Fecha', w: 12 },
    { h: 'Cliente', w: 32 },
    { h: 'Almacen asignado', w: 20 },
    { h: 'Total', w: 14 },
    { h: '# Lineas', w: 10 },
    { h: 'Completas', w: 11 },
    { h: 'Parciales', w: 11 },
    { h: 'Sin stock', w: 11 },
    { h: 'Estado', w: 18 },
  ]
  writeHeader(wsResumen, 'Ordenes de Venta a Surtir — Resumen', colsResumen.length)
  writeColumnHeaders(wsResumen, colsResumen.map((c) => c.h), 2)
  wsResumen.columns = colsResumen.map((c) => ({ width: c.w }))

  ovs.forEach((ov, i) => {
    const row = wsResumen.getRow(3 + i)
    row.getCell(1).value = ov.folio
    row.getCell(2).value = formatFecha(ov.fecha)
    row.getCell(3).value = ov.cliente_nombre
    row.getCell(4).value = ov.almacen_nombre ?? ''
    row.getCell(5).value = ov.total
    row.getCell(5).numFmt = '"$"#,##0.00'
    row.getCell(6).value = ov.total_lineas
    row.getCell(7).value = ov.lineas_completas
    row.getCell(8).value = ov.lineas_parciales
    row.getCell(9).value = ov.lineas_sin_stock
    row.getCell(10).value = ESTADO_LABEL[ov.estado_global]
    aplicarColorEstado(row, ov.estado_global, colsResumen.length)
  })

  wsResumen.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2 + ovs.length, column: colsResumen.length } }

  // ── Hoja 2: Detalle por linea ──────────────────────────────
  const wsDetalle = wb.addWorksheet('Detalle por linea', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 2 }],
  })

  const colsDetalle = [
    { h: 'Folio OV', w: 14 },
    { h: 'Fecha OV', w: 12 },
    { h: 'Cliente', w: 30 },
    { h: 'Almacen OV', w: 18 },
    { h: 'SKU', w: 14 },
    { h: 'Producto', w: 32 },
    { h: 'Pedida', w: 10 },
    { h: 'Asignaciones', w: 40 },
    { h: 'Faltante', w: 10 },
    { h: 'OC folio', w: 14 },
    { h: 'OC fecha', w: 12 },
    { h: 'OC proveedor', w: 26 },
    { h: 'OC cubre', w: 10 },
    { h: 'Estado', w: 18 },
  ]
  writeHeader(wsDetalle, 'Ordenes de Venta a Surtir — Detalle por linea', colsDetalle.length)
  writeColumnHeaders(wsDetalle, colsDetalle.map((c) => c.h), 2)
  wsDetalle.columns = colsDetalle.map((c) => ({ width: c.w }))

  let rowIdx = 3
  for (const ov of ovs) {
    for (const linea of ov.lineas) {
      const row = wsDetalle.getRow(rowIdx++)
      const asignacionesStr = linea.asignaciones
        .map((a) => `${a.almacen_nombre}${a.es_almacen_asignado ? ' [OV]' : ''}: ${a.cantidad}`)
        .join('; ')

      row.getCell(1).value = ov.folio
      row.getCell(2).value = formatFecha(ov.fecha)
      row.getCell(3).value = ov.cliente_nombre
      row.getCell(4).value = ov.almacen_nombre ?? ''
      row.getCell(5).value = linea.sku
      row.getCell(6).value = linea.producto_nombre
      row.getCell(7).value = linea.cantidad_solicitada
      row.getCell(8).value = asignacionesStr
      row.getCell(9).value = linea.cantidad_faltante
      row.getCell(10).value = linea.oc_sugerida?.folio ?? ''
      row.getCell(11).value = linea.oc_sugerida ? formatFecha(linea.oc_sugerida.created_at) : ''
      row.getCell(12).value = linea.oc_sugerida?.proveedor_nombre ?? ''
      row.getCell(13).value = linea.oc_sugerida?.cubre_unidades ?? ''
      row.getCell(14).value = ESTADO_LABEL[linea.estado]
      aplicarColorEstado(row, linea.estado, colsDetalle.length)
    }
  }

  wsDetalle.autoFilter = { from: { row: 2, column: 1 }, to: { row: rowIdx - 1, column: colsDetalle.length } }

  // ── Descargar ──────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
