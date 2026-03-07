// Utilidad para imprimir tickets en impresora termica 80mm

export function printTicket(ventaData: Record<string, unknown>, cajaNombre: string) {
  const items = (ventaData.items || []) as Array<{
    nombre: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    unidad_medida: string
  }>

  const folio = ventaData.folio || ventaData.venta_folio || 'S/N'
  const total = Number(ventaData.total || 0)
  const subtotal = Number(ventaData.subtotal || 0)
  const iva = Number(ventaData.iva || 0)
  const descuentoMonto = Number(ventaData.descuentoMonto || ventaData.descuento_monto || 0)
  const metodoPago = String(ventaData.metodo_pago || ventaData.metodo || 'efectivo')
  const montoEfectivo = Number(ventaData.monto_efectivo || 0)
  const cambio = Number(ventaData.cambio || 0)
  const fecha = new Date().toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const lineWidth = 42 // chars for 80mm at ~monospace

  const pad = (left: string, right: string, width = lineWidth) => {
    const space = width - left.length - right.length
    return left + ' '.repeat(Math.max(1, space)) + right
  }

  const center = (text: string, width = lineWidth) => {
    const space = Math.max(0, width - text.length)
    const left = Math.floor(space / 2)
    return ' '.repeat(left) + text
  }

  const line = '='.repeat(lineWidth)
  const dashLine = '-'.repeat(lineWidth)

  let ticket = ''
  ticket += line + '\n'
  ticket += center(cajaNombre) + '\n'
  ticket += line + '\n'
  ticket += `Folio: ${folio}\n`
  ticket += `Fecha: ${fecha}\n`
  ticket += dashLine + '\n'

  for (const item of items) {
    const qty = item.unidad_medida === 'KG'
      ? `${item.cantidad.toFixed(3)}kg`
      : `${item.cantidad}x`
    const desc = item.nombre.length > 24 ? item.nombre.slice(0, 24) + '..' : item.nombre
    ticket += `${qty} ${desc}\n`
    ticket += pad('', `$${item.subtotal.toFixed(2)}`) + '\n'
  }

  ticket += dashLine + '\n'
  ticket += pad('Subtotal:', `$${subtotal.toFixed(2)}`) + '\n'
  if (descuentoMonto > 0) {
    ticket += pad('Descuento:', `-$${descuentoMonto.toFixed(2)}`) + '\n'
  }
  ticket += pad('IVA 16%:', `$${iva.toFixed(2)}`) + '\n'
  ticket += line + '\n'
  ticket += pad('TOTAL:', `$${total.toFixed(2)}`) + '\n'
  ticket += line + '\n'

  const metodoLabel = metodoPago === 'efectivo' ? 'Efectivo'
    : metodoPago === 'tarjeta' ? 'Tarjeta'
    : metodoPago === 'transferencia' ? 'Transferencia'
    : 'Mixto'
  ticket += pad('Pago:', metodoLabel) + '\n'

  if (metodoPago === 'efectivo' || metodoPago === 'mixto') {
    if (montoEfectivo > 0) {
      ticket += pad('Recibido:', `$${montoEfectivo.toFixed(2)}`) + '\n'
    }
    if (cambio > 0) {
      ticket += pad('Cambio:', `$${cambio.toFixed(2)}`) + '\n'
    }
  }

  ticket += '\n'
  ticket += center('Gracias por su compra!') + '\n'
  ticket += '\n\n'

  // Print via hidden iframe
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '-10000px'
  iframe.style.width = '80mm'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          margin: 0;
          padding: 4mm;
          width: 72mm;
        }
        pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
      </style>
    </head>
    <body>
      <pre>${ticket}</pre>
    </body>
    </html>
  `)
  doc.close()

  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()

  // Clean up after a delay
  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 2000)
}
