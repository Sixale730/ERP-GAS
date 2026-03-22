'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, Button, Input, InputNumber, Typography, Tag, Space, Modal, Row, Col, message, Result } from 'antd'
import {
  ShopOutlined,
  SearchOutlined,
  PlusOutlined,
  MinusOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CreditCardOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  PoweroffOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

// ─── Datos ficticios ────────────────────────────────────────────────────────

interface Producto {
  sku: string
  nombre: string
  unidad: string
  precio: number
}

const PRODUCTOS_DEMO: Producto[] = [
  { sku: 'PROD-001', nombre: 'Alimento Perro Premium 5kg', unidad: 'PZA', precio: 285.00 },
  { sku: 'PROD-002', nombre: 'Collar Ajustable Mediano', unidad: 'PZA', precio: 89.00 },
  { sku: 'PROD-003', nombre: 'Shampoo Mascota 500ml', unidad: 'PZA', precio: 145.00 },
  { sku: 'PROD-004', nombre: 'Juguete Interactivo Gato', unidad: 'PZA', precio: 65.00 },
  { sku: 'PROD-005', nombre: 'Arena Sanitaria 4kg', unidad: 'PZA', precio: 120.00 },
  { sku: 'PROD-006', nombre: 'Vitaminas Caninas 30tab', unidad: 'PZA', precio: 195.00 },
  { sku: 'PROD-007', nombre: 'Comedero Acero Inox', unidad: 'PZA', precio: 175.00 },
  { sku: 'PROD-008', nombre: 'Correa Retráctil 5m', unidad: 'PZA', precio: 320.00 },
  { sku: 'PROD-009', nombre: 'Antiparasitario Pipeta', unidad: 'PZA', precio: 98.00 },
  { sku: 'PROD-010', nombre: 'Cama Mascota Mediana', unidad: 'PZA', precio: 450.00 },
]

interface CartItem {
  producto: Producto
  cantidad: number
}

type Paso = 'caja' | 'turno' | 'pos'
type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'

const formatMoney = (n: number) => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Componente ─────────────────────────────────────────────────────────────

export default function POSDemo() {
  const [paso, setPaso] = useState<Paso>('caja')
  const [cajaSeleccionada, setCajaSeleccionada] = useState('')
  const [fondoInicial, setFondoInicial] = useState<number>(500)
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<CartItem[]>([])
  const [cobroModal, setCobroModal] = useState(false)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [montoRecibido, setMontoRecibido] = useState<number>(0)
  const [ventaCompletada, setVentaCompletada] = useState(false)
  const [ticketNum, setTicketNum] = useState(1)
  const [horaInicio, setHoraInicio] = useState('')

  useEffect(() => {
    setHoraInicio(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))
  }, [paso])

  const productosFiltrados = useMemo(() => {
    if (!busqueda) return PRODUCTOS_DEMO
    const q = busqueda.toLowerCase()
    return PRODUCTOS_DEMO.filter(p => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
  }, [busqueda])

  const totales = useMemo(() => {
    const subtotal = carrito.reduce((s, item) => s + item.producto.precio * item.cantidad, 0)
    const iva = subtotal * 0.16
    const total = subtotal + iva
    return { subtotal, iva, total }
  }, [carrito])

  const agregarProducto = (producto: Producto) => {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.producto.sku === producto.sku)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 }
        return next
      }
      return [...prev, { producto, cantidad: 1 }]
    })
  }

  const cambiarCantidad = (sku: string, delta: number) => {
    setCarrito(prev => {
      const next = prev.map(i => i.producto.sku === sku ? { ...i, cantidad: i.cantidad + delta } : i)
      return next.filter(i => i.cantidad > 0)
    })
  }

  const eliminarItem = (sku: string) => {
    setCarrito(prev => prev.filter(i => i.producto.sku !== sku))
  }

  const handleCobrar = () => {
    setMontoRecibido(Math.ceil(totales.total / 10) * 10)
    setCobroModal(true)
  }

  const confirmarPago = () => {
    if (metodoPago === 'efectivo' && montoRecibido < totales.total) {
      message.error('El monto recibido es menor al total')
      return
    }
    setCobroModal(false)
    setVentaCompletada(true)
  }

  const nuevaVenta = () => {
    setVentaCompletada(false)
    setCarrito([])
    setBusqueda('')
    setTicketNum(prev => prev + 1)
  }

  const seleccionarCaja = (nombre: string) => {
    setCajaSeleccionada(nombre)
    setPaso('turno')
  }

  const cerrarTurno = () => {
    setPaso('caja')
    setCarrito([])
    setBusqueda('')
    setVentaCompletada(false)
    setCajaSeleccionada('')
    setTicketNum(1)
  }

  // ─── Paso 1: Selector de caja ─────────────────────────────────────────────
  if (paso === 'caja') {
    return (
      <div style={{ background: '#f5f5f5', minHeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 500 }}>
          <ShopOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
          <Title level={3} style={{ marginBottom: 24 }}>Selecciona una Caja</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Card
                hoverable
                onClick={() => seleccionarCaja('Caja Principal')}
                style={{ borderRadius: 12, textAlign: 'center' }}
              >
                <ShopOutlined style={{ fontSize: 32, color: '#1677ff', marginBottom: 8 }} />
                <div style={{ fontWeight: 600 }}>Caja Principal</div>
                <Tag style={{ marginTop: 4 }}>CAJA-01</Tag>
              </Card>
            </Col>
            <Col span={12}>
              <Card
                hoverable
                onClick={() => seleccionarCaja('Caja 2')}
                style={{ borderRadius: 12, textAlign: 'center' }}
              >
                <ShopOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
                <div style={{ fontWeight: 600 }}>Caja 2</div>
                <Tag style={{ marginTop: 4 }}>CAJA-02</Tag>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    )
  }

  // ─── Paso 2: Abrir turno ──────────────────────────────────────────────────
  if (paso === 'turno') {
    return (
      <div style={{ background: '#f5f5f5', minHeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Card style={{ width: 400, borderRadius: 12 }}>
          <Title level={4} style={{ marginBottom: 20 }}>
            <ClockCircleOutlined style={{ marginRight: 8 }} />
            Abrir Turno — {cajaSeleccionada}
          </Title>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Fondo inicial de caja</Text>
            <InputNumber
              prefix="$"
              value={fondoInicial}
              onChange={(v) => setFondoInicial(v ?? 500)}
              style={{ width: '100%' }}
              size="large"
              min={0}
              precision={2}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Vendedor</Text>
            <Input value="Demo Vendedor" disabled size="large" />
          </div>
          <Button
            type="primary"
            block
            size="large"
            style={{ background: '#52c41a', borderColor: '#52c41a', height: 48 }}
            onClick={() => setPaso('pos')}
          >
            Abrir Turno
          </Button>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => setPaso('caja')}>
              Cambiar caja
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ─── Paso 3: Terminal POS ─────────────────────────────────────────────────

  if (ventaCompletada) {
    return (
      <div style={{ background: '#f5f5f5', minHeight: 500 }}>
        {/* Top bar */}
        <div style={{ background: '#001529', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
            {cajaSeleccionada} | Demo Vendedor | Turno desde {horaInicio}
          </span>
          <Button size="small" danger onClick={cerrarTurno} icon={<PoweroffOutlined />}>Cerrar Turno</Button>
        </div>
        <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 450 }}>
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title={`Venta registrada · Ticket #${String(ticketNum).padStart(4, '0')}`}
            subTitle={
              <div style={{ textAlign: 'left', maxWidth: 350, margin: '0 auto' }}>
                <div style={{ borderBottom: '1px dashed #d9d9d9', paddingBottom: 8, marginBottom: 8 }}>
                  {carrito.map(item => (
                    <div key={item.producto.sku} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{item.cantidad}x {item.producto.nombre}</span>
                      <span>{formatMoney(item.producto.precio * item.cantidad)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 16 }}>
                  <span>TOTAL</span>
                  <span style={{ color: '#1677ff' }}>{formatMoney(totales.total)}</span>
                </div>
                <div style={{ marginTop: 8, color: '#595959' }}>
                  Método: <Tag>{metodoPago.charAt(0).toUpperCase() + metodoPago.slice(1)}</Tag>
                </div>
              </div>
            }
            extra={
              <Button type="primary" size="large" onClick={nuevaVenta}>
                Nueva venta
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: 500 }}>
      {/* Top bar */}
      <div style={{ background: '#001529', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
          {cajaSeleccionada} | Demo Vendedor | Turno desde {horaInicio}
        </span>
        <Button size="small" danger onClick={cerrarTurno} icon={<PoweroffOutlined />}>Cerrar Turno</Button>
      </div>

      <div style={{ display: 'flex', minHeight: 460 }}>
        {/* ─── Panel izquierdo: Productos ──────────────────────────── */}
        <div style={{ flex: 1, padding: 12, overflowY: 'auto', borderRight: '1px solid #f0f0f0' }}>
          <Input
            placeholder="Buscar por SKU o nombre..."
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            allowClear
            size="small"
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {productosFiltrados.map(p => (
              <div
                key={p.sku}
                onClick={() => agregarProducto(p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  borderRadius: 6,
                  border: '1px solid #f0f0f0',
                  background: '#fff',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f5ff')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <Tag color="blue" style={{ fontSize: 10, marginRight: 8 }}>{p.sku}</Tag>
                <span style={{ flex: 1, fontSize: 13 }}>{p.nombre}</span>
                <span style={{ color: '#595959', fontSize: 11, marginRight: 8 }}>{p.unidad}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#1677ff' }}>{formatMoney(p.precio)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Panel derecho: Carrito ───────────────────────────────── */}
        <div style={{ width: 340, display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: 13 }}>
            Carrito ({carrito.reduce((s, i) => s + i.cantidad, 0)} items)
          </div>

          {/* Items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {carrito.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bbb', padding: 40, fontSize: 13 }}>
                Haz clic en un producto para agregarlo
              </div>
            ) : (
              carrito.map(item => (
                <div
                  key={item.producto.sku}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 4px',
                    borderBottom: '1px solid #f5f5f5',
                    gap: 6,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.producto.nombre}
                    </div>
                    <div style={{ fontSize: 11, color: '#595959' }}>
                      {formatMoney(item.producto.precio)} c/u
                    </div>
                  </div>
                  <Space size={2}>
                    <Button
                      size="small"
                      icon={<MinusOutlined />}
                      onClick={() => cambiarCantidad(item.producto.sku, -1)}
                      style={{ width: 24, height: 24, minWidth: 24, padding: 0 }}
                    />
                    <span style={{ display: 'inline-block', width: 24, textAlign: 'center', fontSize: 13, fontWeight: 500 }}>
                      {item.cantidad}
                    </span>
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => cambiarCantidad(item.producto.sku, 1)}
                      style={{ width: 24, height: 24, minWidth: 24, padding: 0 }}
                    />
                  </Space>
                  <span style={{ width: 70, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>
                    {formatMoney(item.producto.precio * item.cantidad)}
                  </span>
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => eliminarItem(item.producto.sku)}
                    style={{ width: 24, height: 24, minWidth: 24, padding: 0 }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Footer totales */}
          <div style={{ borderTop: '2px solid #f0f0f0', padding: 12, background: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#595959', marginBottom: 4 }}>
              <span>Subtotal</span>
              <span>{formatMoney(totales.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#595959', marginBottom: 8 }}>
              <span>IVA (16%)</span>
              <span>{formatMoney(totales.iva)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, color: '#1677ff', marginBottom: 12 }}>
              <span>TOTAL</span>
              <span>{formatMoney(totales.total)}</span>
            </div>
            <Button
              type="primary"
              block
              size="large"
              disabled={carrito.length === 0}
              onClick={handleCobrar}
              style={{ height: 48, fontSize: 16 }}
            >
              F2 Cobrar
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Modal de cobro ────────────────────────────────────────── */}
      <Modal
        open={cobroModal}
        onCancel={() => setCobroModal(false)}
        footer={null}
        title="Cobrar venta"
        width={420}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Método de pago</Text>
          <Space wrap>
            {([
              { key: 'efectivo' as MetodoPago, icon: <DollarOutlined />, label: 'Efectivo' },
              { key: 'tarjeta' as MetodoPago, icon: <CreditCardOutlined />, label: 'Tarjeta' },
              { key: 'transferencia' as MetodoPago, icon: <SwapOutlined />, label: 'Transferencia' },
              { key: 'mixto' as MetodoPago, icon: <DollarOutlined />, label: 'Mixto' },
            ]).map(m => (
              <Button
                key={m.key}
                type={metodoPago === m.key ? 'primary' : 'default'}
                icon={m.icon}
                onClick={() => setMetodoPago(m.key)}
                size="large"
              >
                {m.label}
              </Button>
            ))}
          </Space>
        </div>

        {metodoPago === 'efectivo' && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Monto recibido</Text>
            <InputNumber
              prefix="$"
              value={montoRecibido}
              onChange={v => setMontoRecibido(v ?? 0)}
              style={{ width: '100%' }}
              size="large"
              min={0}
              precision={2}
            />
            {montoRecibido >= totales.total && (
              <div style={{ marginTop: 8, color: '#52c41a', fontWeight: 600 }}>
                Cambio: {formatMoney(montoRecibido - totales.total)}
              </div>
            )}
          </div>
        )}

        <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, color: '#1677ff' }}>
            <span>TOTAL</span>
            <span>{formatMoney(totales.total)}</span>
          </div>
        </div>

        <Button
          type="primary"
          block
          size="large"
          style={{ background: '#52c41a', borderColor: '#52c41a', height: 48 }}
          onClick={confirmarPago}
        >
          <CheckCircleOutlined /> Confirmar pago
        </Button>
      </Modal>
    </div>
  )
}
