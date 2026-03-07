'use client'

import { useState } from 'react'
import { Modal, Tabs, InputNumber, Button, Typography, Space, message, Divider, Input } from 'antd'
import { DollarOutlined, CreditCardOutlined, SwapOutlined, SplitCellsOutlined } from '@ant-design/icons'
import { usePOSStore } from '@/store/posStore'
import { useRegistrarVenta } from '@/lib/hooks/queries/usePOS'
import { useAuth } from '@/lib/hooks/useAuth'
import { calcTotals } from './POSCart'
import NumberPad from './NumberPad'

const { Title, Text } = Typography

interface PaymentModalProps {
  open: boolean
  onSuccess: (ventaData: Record<string, unknown>) => void
  onCancel: () => void
}

export default function PaymentModal({ open, onSuccess, onCancel }: PaymentModalProps) {
  const [metodo, setMetodo] = useState('efectivo')
  const [efectivoStr, setEfectivoStr] = useState('')
  const [tarjeta, setTarjeta] = useState(0)
  const [transferencia, setTransferencia] = useState(0)
  const [referencia, setReferencia] = useState('')

  const { items, descuentoGlobal, turnoId, almacenId, clienteDefaultId, clearCart, setLastSaleData } = usePOSStore()
  const { user, erpUser, organizacion } = useAuth()
  const registrarVenta = useRegistrarVenta()

  const { subtotal, descuentoMonto, iva, total } = calcTotals(items, descuentoGlobal)
  const efectivo = Number(efectivoStr) || 0
  const cambio = metodo === 'efectivo' ? Math.max(0, efectivo - total) : 0

  const quickAmounts = [
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500,
  ].filter((v, i, arr) => arr.indexOf(v) === i && v >= total).slice(0, 4)

  const isValid = () => {
    if (metodo === 'efectivo') return efectivo >= total
    if (metodo === 'tarjeta') return true
    if (metodo === 'transferencia') return referencia.trim().length > 0
    if (metodo === 'mixto') return (efectivo + tarjeta + transferencia) >= total
    return false
  }

  const handlePay = async () => {
    if (!turnoId || !almacenId || !clienteDefaultId || !organizacion) return

    const montoEfectivo = metodo === 'efectivo' ? efectivo : metodo === 'mixto' ? efectivo : 0
    const montoTarjeta = metodo === 'tarjeta' ? total : metodo === 'mixto' ? tarjeta : 0
    const montoTransferencia = metodo === 'transferencia' ? total : metodo === 'mixto' ? transferencia : 0

    try {
      const result = await registrarVenta.mutateAsync({
        p_turno_caja_id: turnoId,
        p_almacen_id: almacenId,
        p_cliente_id: clienteDefaultId,
        p_items: items.map(i => ({
          producto_id: i.producto_id,
          descripcion: i.nombre,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          descuento_porcentaje: i.descuento_porcentaje,
        })),
        p_descuento_porcentaje: descuentoGlobal,
        p_metodo_pago: metodo,
        p_monto_efectivo: montoEfectivo,
        p_monto_tarjeta: montoTarjeta,
        p_monto_transferencia: montoTransferencia,
        p_referencia_pago: referencia || undefined,
        p_vendedor_id: user?.id,
        p_vendedor_nombre: erpUser?.nombre || user?.email || undefined,
        p_organizacion_id: organizacion.id,
      })

      const saleData = {
        ...(result || {}),
        items: items.map(i => ({ ...i })),
        total,
        subtotal,
        iva,
        descuentoMonto,
        metodo_pago: metodo,
        monto_efectivo: montoEfectivo,
        monto_tarjeta: montoTarjeta,
        monto_transferencia: montoTransferencia,
        cambio: metodo === 'efectivo' ? Math.max(0, montoEfectivo - total) : 0,
      }

      setLastSaleData(saleData)
      clearCart()
      resetForm()
      message.success('Venta registrada correctamente')
      onSuccess(saleData)
    } catch (err) {
      message.error(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    }
  }

  const resetForm = () => {
    setEfectivoStr('')
    setTarjeta(0)
    setTransferencia(0)
    setReferencia('')
    setMetodo('efectivo')
  }

  const tabItems = [
    {
      key: 'efectivo',
      label: <span><DollarOutlined /> Efectivo</span>,
      children: (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Text type="secondary">Monto recibido</Text>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#1890ff' }}>
              ${efectivo.toFixed(2)}
            </div>
            {efectivo >= total && (
              <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>
                Cambio: ${cambio.toFixed(2)}
              </div>
            )}
          </div>

          <Space wrap style={{ marginBottom: 12, justifyContent: 'center', width: '100%' }}>
            <Button onClick={() => setEfectivoStr(total.toFixed(2))}>Exacto</Button>
            {quickAmounts.map(amt => (
              <Button key={amt} onClick={() => setEfectivoStr(amt.toString())}>${amt}</Button>
            ))}
          </Space>

          <NumberPad
            value={efectivoStr}
            onChange={setEfectivoStr}
            onEnter={isValid() ? handlePay : undefined}
          />
        </div>
      ),
    },
    {
      key: 'tarjeta',
      label: <span><CreditCardOutlined /> Tarjeta</span>,
      children: (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CreditCardOutlined style={{ fontSize: 64, color: '#1890ff', marginBottom: 16 }} />
          <Title level={3}>Cobro con tarjeta</Title>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#1890ff', marginBottom: 16 }}>
            ${total.toFixed(2)}
          </div>
          <Input
            data-pos-input
            placeholder="Referencia (opcional)"
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            style={{ maxWidth: 300, margin: '0 auto' }}
          />
        </div>
      ),
    },
    {
      key: 'transferencia',
      label: <span><SwapOutlined /> Transferencia</span>,
      children: (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <SwapOutlined style={{ fontSize: 64, color: '#722ed1', marginBottom: 16 }} />
          <Title level={3}>Transferencia</Title>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#722ed1', marginBottom: 16 }}>
            ${total.toFixed(2)}
          </div>
          <Input
            data-pos-input
            placeholder="Referencia de transferencia"
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            style={{ maxWidth: 300, margin: '0 auto' }}
          />
        </div>
      ),
    },
    {
      key: 'mixto',
      label: <span><SplitCellsOutlined /> Mixto</span>,
      children: (
        <div style={{ padding: '16px 0' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text>Efectivo</Text>
              <InputNumber
                data-pos-input
                value={efectivo}
                onChange={v => setEfectivoStr(String(v ?? 0))}
                min={0}
                style={{ width: '100%' }}
                size="large"
                prefix="$"
              />
            </div>
            <div>
              <Text>Tarjeta</Text>
              <InputNumber
                data-pos-input
                value={tarjeta}
                onChange={v => setTarjeta(v ?? 0)}
                min={0}
                style={{ width: '100%' }}
                size="large"
                prefix="$"
              />
            </div>
            <div>
              <Text>Transferencia</Text>
              <InputNumber
                data-pos-input
                value={transferencia}
                onChange={v => setTransferencia(v ?? 0)}
                min={0}
                style={{ width: '100%' }}
                size="large"
                prefix="$"
              />
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>Total cubierto:</Text>
              <Text strong style={{ color: (efectivo + tarjeta + transferencia) >= total ? '#52c41a' : '#ff4d4f' }}>
                ${(efectivo + tarjeta + transferencia).toFixed(2)} / ${total.toFixed(2)}
              </Text>
            </div>
          </Space>
        </div>
      ),
    },
  ]

  return (
    <Modal
      open={open}
      title={null}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>Cancelar</Button>,
        <Button
          key="pay"
          type="primary"
          size="large"
          disabled={!isValid()}
          loading={registrarVenta.isPending}
          onClick={handlePay}
          style={{ minWidth: 200, height: 48, fontSize: 18 }}
        >
          Cobrar ${total.toFixed(2)}
        </Button>,
      ]}
      width={480}
      centered
      destroyOnClose
      afterOpenChange={(visible) => { if (!visible) resetForm() }}
    >
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <Text type="secondary">Total a cobrar</Text>
        <Title level={2} style={{ margin: '0 0 8px', color: '#1890ff' }}>${total.toFixed(2)}</Title>
      </div>

      <Tabs
        activeKey={metodo}
        onChange={setMetodo}
        items={tabItems}
        centered
      />
    </Modal>
  )
}
