'use client'

import type { POSCartItem } from '@/types/pos'

interface TicketPreviewProps {
  folio: string
  cajaNombre: string
  cajero: string
  items: POSCartItem[]
  subtotal: number
  descuentoMonto: number
  iva: number
  total: number
  metodoPago: string
  montoEfectivo: number
  cambio: number
  fecha?: string
}

export default function TicketPreview({
  folio,
  cajaNombre,
  cajero,
  items,
  subtotal,
  descuentoMonto,
  iva,
  total,
  metodoPago,
  montoEfectivo,
  cambio,
  fecha,
}: TicketPreviewProps) {
  const displayFecha = fecha || new Date().toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const style: React.CSSProperties = {
    fontFamily: "'Courier New', monospace",
    fontSize: 12,
    lineHeight: 1.4,
    width: 302, // ~80mm at 96dpi
    padding: 8,
    background: '#fff',
    color: '#000',
  }

  return (
    <div style={style}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 4, marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{cajaNombre}</div>
      </div>

      <div style={{ marginBottom: 4 }}>
        <div>Folio: {folio}</div>
        <div>Fecha: {displayFecha}</div>
        <div>Cajero: {cajero}</div>
      </div>

      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: 4 }}>
        {items.map((item, i) => (
          <div key={i} style={{ marginBottom: 2 }}>
            <div>
              {item.es_granel ? `${item.cantidad.toFixed(3)}kg` : `${item.cantidad}x`}
              {' '}
              {item.nombre.length > 26 ? item.nombre.slice(0, 26) + '..' : item.nombre}
            </div>
            <div style={{ textAlign: 'right' }}>${item.subtotal.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal:</span><span>${subtotal.toFixed(2)}</span>
        </div>
        {descuentoMonto > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Descuento:</span><span>-${descuentoMonto.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>IVA 16%:</span><span>${iva.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ borderTop: '2px solid #000', paddingTop: 4, marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
          <span>TOTAL:</span><span>${total.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div>Pago: {metodoPago}</div>
        {montoEfectivo > 0 && <div>Recibido: ${montoEfectivo.toFixed(2)}</div>}
        {cambio > 0 && <div>Cambio: ${cambio.toFixed(2)}</div>}
      </div>

      <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: 4 }}>
        Gracias por su compra!
      </div>
    </div>
  )
}
