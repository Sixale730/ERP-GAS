'use client'

import { Button, InputNumber, Popconfirm, Empty } from 'antd'
import { DeleteOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { usePOSStore } from '@/store/posStore'

export default function POSCart() {
  const { items, updateQuantity, removeItem, descuentoGlobal } = usePOSStore()

  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0)
  const descuentoMonto = subtotal * descuentoGlobal / 100
  const baseIVA = subtotal - descuentoMonto
  const iva = Math.round(baseIVA * 0.16 * 100) / 100
  const total = Math.round((baseIVA + iva) * 100) / 100

  if (items.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
        <Empty description="Carrito vacio" />
        <p style={{ textAlign: 'center', color: '#999', marginTop: 8 }}>
          Escanea o busca un producto para comenzar
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Items list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {items.map((item) => (
          <div
            key={item.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid #f0f0f0',
              gap: 8,
            }}
          >
            {/* Product info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.nombre}
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                {item.sku} · ${item.precio_unitario.toFixed(2)} / {item.unidad_medida}
              </div>
            </div>

            {/* Quantity controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Button
                size="small"
                icon={<MinusOutlined />}
                onClick={() => updateQuantity(item.key, item.cantidad - (item.es_granel ? 0.1 : 1))}
              />
              <InputNumber
                data-pos-input
                size="small"
                value={item.cantidad}
                onChange={(v) => updateQuantity(item.key, v ?? 0)}
                min={0.001}
                step={item.es_granel ? 0.1 : 1}
                style={{ width: 60, textAlign: 'center' }}
                controls={false}
              />
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => updateQuantity(item.key, item.cantidad + (item.es_granel ? 0.1 : 1))}
              />
            </div>

            {/* Subtotal */}
            <div style={{ width: 80, textAlign: 'right', fontWeight: 600 }}>
              ${item.subtotal.toFixed(2)}
            </div>

            {/* Delete */}
            <Popconfirm title="Quitar del carrito?" onConfirm={() => removeItem(item.key)} okText="Si" cancelText="No">
              <Button size="small" danger icon={<DeleteOutlined />} type="text" />
            </Popconfirm>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div style={{ borderTop: '2px solid #1890ff', paddingTop: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Subtotal ({items.length} items)</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {descuentoGlobal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#f5222d' }}>
            <span>Descuento ({descuentoGlobal}%)</span>
            <span>-${descuentoMonto.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#999' }}>
          <span>IVA (16%)</span>
          <span>${iva.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, fontWeight: 700, color: '#1890ff' }}>
          <span>TOTAL</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

// Helper exportado para calcular totales desde fuera
export function calcTotals(items: Array<{ subtotal: number }>, descuentoGlobal: number) {
  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0)
  const descuentoMonto = subtotal * descuentoGlobal / 100
  const baseIVA = subtotal - descuentoMonto
  const iva = Math.round(baseIVA * 0.16 * 100) / 100
  const total = Math.round((baseIVA + iva) * 100) / 100
  return { subtotal, descuentoMonto, iva, total }
}
