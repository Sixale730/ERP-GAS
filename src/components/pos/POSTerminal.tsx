'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button, Typography, Space, message, Popconfirm, InputNumber, Modal } from 'antd'
import {
  LogoutOutlined,
  DollarOutlined,
  DeleteOutlined,
  PrinterOutlined,
  PercentageOutlined,
} from '@ant-design/icons'
import { usePOSStore } from '@/store/posStore'
import { useTurnoActivo } from '@/lib/hooks/queries/usePOS'
import { buscarPorCodigoBarras } from '@/lib/hooks/queries/usePOS'
import { useAuth } from '@/lib/hooks/useAuth'
import BarcodeInput from './BarcodeInput'
import ProductSearch from './ProductSearch'
import POSCart from './POSCart'
import PaymentModal from './PaymentModal'
import CloseShiftModal from './CloseShiftModal'
import ScaleDisplay from './ScaleDisplay'
import { printTicket } from '@/lib/utils/ticket-printer'
import type { ProductoPOS } from '@/types/pos'

const { Text } = Typography

export default function POSTerminal() {
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [closeShiftOpen, setCloseShiftOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountValue, setDiscountValue] = useState(0)

  const {
    items, addItem, clearCart, cajaId,
    listaPrecioId, cajaNombre, descuentoGlobal, setDescuentoGlobal,
    clearCajaContext, lastSaleData, pesoBascula,
  } = usePOSStore()
  const { erpUser } = useAuth()
  const { data: turno } = useTurnoActivo(cajaId || undefined)

  // Barcode scan handler
  const handleScan = useCallback(async (barcode: string) => {
    try {
      const producto = await buscarPorCodigoBarras(barcode, listaPrecioId || undefined)
      if (!producto) {
        message.warning(`Producto no encontrado: ${barcode}`)
        return
      }
      if (producto.unidad_medida === 'KG' && pesoBascula) {
        addItem(producto, pesoBascula)
      } else {
        addItem(producto)
      }
      message.success(`${producto.nombre} agregado`)
    } catch {
      message.error('Error al buscar producto')
    }
  }, [addItem, listaPrecioId, pesoBascula])

  // Product selection from search
  const handleSelectProduct = useCallback((product: ProductoPOS) => {
    if (product.unidad_medida === 'KG' && pesoBascula) {
      addItem(product, pesoBascula)
    } else {
      addItem(product)
    }
  }, [addItem, pesoBascula])

  const handlePrintLast = useCallback(() => {
    if (lastSaleData) {
      printTicket(lastSaleData, cajaNombre || 'POS')
    }
  }, [lastSaleData, cajaNombre])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (paymentOpen || closeShiftOpen) return

      switch (e.key) {
        case 'F2':
          e.preventDefault()
          if (items.length > 0) setPaymentOpen(true)
          break
        case 'F4':
          e.preventDefault()
          if (items.length > 0) clearCart()
          break
        case 'F8':
          e.preventDefault()
          handlePrintLast()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [items.length, paymentOpen, closeShiftOpen, clearCart, handlePrintLast])

  const handlePaymentSuccess = (ventaData: Record<string, unknown>) => {
    setPaymentOpen(false)
    printTicket(ventaData, cajaNombre || 'POS')
  }

  const handleCloseShiftSuccess = () => {
    setCloseShiftOpen(false)
    clearCajaContext()
  }

  const handleApplyDiscount = () => {
    setDescuentoGlobal(discountValue)
    setDiscountOpen(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: '#001529',
        color: '#fff',
      }}>
        <Space>
          <Text strong style={{ color: '#fff', fontSize: 16 }}>{cajaNombre}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)' }}>|</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)' }}>
            {erpUser?.nombre || 'Usuario'}
          </Text>
          {turno && (
            <>
              <Text style={{ color: 'rgba(255,255,255,0.65)' }}>|</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)' }}>
                Turno desde {new Date(turno.fecha_apertura).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </>
          )}
        </Space>

        <Space>
          {lastSaleData && (
            <Button
              type="text"
              icon={<PrinterOutlined />}
              style={{ color: '#fff' }}
              onClick={handlePrintLast}
            >
              F8 Reimprimir
            </Button>
          )}
          <Button
            type="primary"
            danger
            icon={<LogoutOutlined />}
            onClick={() => setCloseShiftOpen(true)}
          >
            Cerrar Turno
          </Button>
        </Space>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel - Products */}
        <div style={{
          flex: '0 0 60%',
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          borderRight: '1px solid #f0f0f0',
          overflow: 'hidden',
        }}>
          <BarcodeInput onScan={handleScan} disabled={paymentOpen || closeShiftOpen} />
          <ProductSearch
            listaPrecioId={listaPrecioId}
            onSelectProduct={handleSelectProduct}
          />
          <ScaleDisplay />
        </div>

        {/* Right panel - Cart */}
        <div style={{
          flex: '0 0 40%',
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          overflow: 'hidden',
        }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <POSCart />
          </div>

          {/* Action buttons */}
          {items.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <Button
                icon={<PercentageOutlined />}
                onClick={() => { setDiscountValue(descuentoGlobal); setDiscountOpen(true) }}
                style={{ flex: 1 }}
              >
                Descuento
              </Button>
              <Popconfirm
                title="Cancelar venta actual?"
                onConfirm={clearCart}
                okText="Si"
                cancelText="No"
              >
                <Button danger icon={<DeleteOutlined />} style={{ flex: 1 }}>
                  F4 Cancelar
                </Button>
              </Popconfirm>
              <Button
                type="primary"
                size="large"
                icon={<DollarOutlined />}
                onClick={() => setPaymentOpen(true)}
                style={{ flex: 2, height: 48, fontSize: 18, fontWeight: 700 }}
              >
                F2 Cobrar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <PaymentModal
        open={paymentOpen}
        onSuccess={handlePaymentSuccess}
        onCancel={() => setPaymentOpen(false)}
      />

      <CloseShiftModal
        open={closeShiftOpen}
        onSuccess={handleCloseShiftSuccess}
        onCancel={() => setCloseShiftOpen(false)}
      />

      <Modal
        open={discountOpen}
        title="Descuento global"
        onCancel={() => setDiscountOpen(false)}
        onOk={handleApplyDiscount}
        okText="Aplicar"
        width={300}
        centered
      >
        <InputNumber
          data-pos-input
          value={discountValue}
          onChange={v => setDiscountValue(v ?? 0)}
          min={0}
          max={100}
          suffix="%"
          size="large"
          style={{ width: '100%' }}
          autoFocus
        />
      </Modal>
    </div>
  )
}
