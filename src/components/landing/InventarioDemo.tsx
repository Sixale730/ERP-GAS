'use client'

import { useState, useMemo } from 'react'
import { Card, Table, Tag, Row, Col, Statistic, Button, Space, Input, message } from 'antd'
import {
  ShoppingOutlined,
  WarningOutlined,
  MinusCircleOutlined,
  DollarOutlined,
  SearchOutlined,
  PlusOutlined,
  MinusOutlined,
} from '@ant-design/icons'

interface Producto {
  sku: string
  nombre: string
  almacen: string
  qty: number
  min: number
  max: number
  costo: number
}

const datosIniciales: Producto[] = [
  { sku: 'PROD-001', nombre: 'Producto Ejemplo A', almacen: 'Almacén Principal', qty: 45, min: 10, max: 100, costo: 250 },
  { sku: 'PROD-002', nombre: 'Producto Ejemplo B', almacen: 'Almacén Principal', qty: 3, min: 5, max: 50, costo: 180 },
  { sku: 'PROD-003', nombre: 'Servicio de Instalación', almacen: 'Almacén Principal', qty: 0, min: 0, max: 0, costo: 0 },
  { sku: 'PROD-004', nombre: 'Insumo General C', almacen: 'Bodega', qty: -2, min: 5, max: 30, costo: 320 },
  { sku: 'PROD-005', nombre: 'Accesorio D', almacen: 'Almacén Principal', qty: 18, min: 5, max: 40, costo: 95 },
  { sku: 'PROD-006', nombre: 'Equipo E', almacen: 'Bodega', qty: 7, min: 2, max: 20, costo: 1500 },
  { sku: 'PROD-007', nombre: 'Refacción F', almacen: 'Almacén Principal', qty: 2, min: 8, max: 25, costo: 440 },
  { sku: 'PROD-008', nombre: 'Material G', almacen: 'Bodega', qty: 60, min: 10, max: 80, costo: 75 },
]

type Filtro = 'todos' | 'bajo' | 'negativo'

function getNivel(qty: number, min: number): { label: string; color: string } {
  if (qty < 0) return { label: 'Negativo', color: 'red' }
  if (qty === 0) return { label: 'Sin Stock', color: 'default' }
  if (min > 0 && qty <= min) return { label: 'Stock Bajo', color: 'orange' }
  return { label: 'Normal', color: 'green' }
}

export default function InventarioDemo() {
  const [productos, setProductos] = useState<Producto[]>(datosIniciales)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')

  const cambiarQty = (idx: number, delta: number) => {
    setProductos(prev => {
      const next = [...prev]
      const p = { ...next[idx] }
      p.qty += delta
      next[idx] = p

      if (p.qty < 0) {
        message.warning(`${p.nombre}: cantidad negativa (${p.qty})`)
      } else if (p.min > 0 && p.qty > 0 && p.qty <= p.min) {
        message.warning(`${p.nombre}: stock bajo mínimo (${p.qty}/${p.min})`)
      }

      return next
    })
  }

  const stats = useMemo(() => {
    const total = productos.length
    const stockBajo = productos.filter(p => p.min > 0 && p.qty > 0 && p.qty <= p.min).length
    const negativos = productos.filter(p => p.qty < 0).length
    const valor = productos.reduce((sum, p) => sum + (p.qty > 0 ? p.qty * p.costo : 0), 0)
    return { total, stockBajo, negativos, valor }
  }, [productos])

  const filtrados = useMemo(() => {
    let lista = productos.map((p, i) => ({ ...p, _idx: i }))

    if (busqueda) {
      const q = busqueda.toLowerCase()
      lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    }

    if (filtro === 'bajo') {
      lista = lista.filter(p => p.min > 0 && p.qty > 0 && p.qty <= p.min)
    } else if (filtro === 'negativo') {
      lista = lista.filter(p => p.qty < 0)
    }

    return lista
  }, [productos, filtro, busqueda])

  const columns = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 110,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: 'Producto',
      dataIndex: 'nombre',
      key: 'nombre',
    },
    {
      title: 'Almacén',
      dataIndex: 'almacen',
      key: 'almacen',
      width: 150,
      render: (v: string) => <span style={{ color: '#595959' }}>{v}</span>,
    },
    {
      title: 'Cantidad',
      dataIndex: 'qty',
      key: 'qty',
      width: 140,
      align: 'center' as const,
      render: (qty: number, record: Producto & { _idx: number }) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<MinusOutlined />}
            onClick={() => cambiarQty(record._idx, -1)}
            style={{ width: 28, height: 28, minWidth: 28, padding: 0 }}
          />
          <span
            style={{
              display: 'inline-block',
              minWidth: 32,
              textAlign: 'center',
              fontWeight: 500,
              color: qty < 0 ? '#ff4d4f' : undefined,
            }}
          >
            {qty}
          </span>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => cambiarQty(record._idx, 1)}
            style={{ width: 28, height: 28, minWidth: 28, padding: 0 }}
          />
        </Space>
      ),
    },
    {
      title: 'Mín / Máx',
      key: 'minmax',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: Producto) =>
        record.min === 0 && record.max === 0
          ? <span style={{ color: '#bbb' }}>—</span>
          : <span style={{ color: '#595959', fontSize: 12 }}>{record.min} / {record.max}</span>,
    },
    {
      title: 'Nivel',
      key: 'nivel',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, record: Producto) => {
        const nivel = getNivel(record.qty, record.min)
        return <Tag color={nivel.color}>{nivel.label}</Tag>
      },
    },
  ]

  const filtros: { key: Filtro; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'bajo', label: `Stock Bajo (${stats.stockBajo})` },
    { key: 'negativo', label: `Negativos (${stats.negativos})` },
  ]

  return (
    <div style={{ background: '#f5f5f5', minHeight: 500 }}>
      {/* Top bar */}
      <div
        style={{
          background: '#001529',
          borderRadius: '8px 8px 0 0',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 12 }}>
          CUANTY ERP — Inventario
        </span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Stats */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Total Productos</span>}
                value={stats.total}
                prefix={<ShoppingOutlined />}
                valueStyle={{ color: '#1677ff', fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Stock Bajo</span>}
                value={stats.stockBajo}
                prefix={<WarningOutlined />}
                valueStyle={{ color: stats.stockBajo > 0 ? '#fa8c16' : '#52c41a', fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Stock Negativo</span>}
                value={stats.negativos}
                prefix={<MinusCircleOutlined />}
                valueStyle={{ color: stats.negativos > 0 ? '#ff4d4f' : '#52c41a', fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>Valor Inventario</span>}
                value={stats.valor}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#52c41a', fontSize: 20 }}
                formatter={(v) => `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
              />
            </Card>
          </Col>
        </Row>

        {/* Filtros + búsqueda */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Space size={4}>
            {filtros.map(f => (
              <Button
                key={f.key}
                type={filtro === f.key ? 'primary' : 'default'}
                size="small"
                onClick={() => setFiltro(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </Space>
          <Input
            placeholder="Buscar por SKU o nombre..."
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            size="small"
            style={{ flex: '1 1 180px', minWidth: 150 }}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            allowClear
          />
        </div>

        {/* Tabla */}
        <Card size="small" style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
          <Table
            dataSource={filtrados}
            columns={columns}
            rowKey="sku"
            pagination={false}
            size="small"
            scroll={{ x: 700 }}
            rowClassName={(record) => record.qty < 0 ? 'inv-demo-row-negative' : ''}
            style={{ fontSize: 13 }}
          />
        </Card>
      </div>

      <style>{`
        .inv-demo-row-negative td {
          background-color: #fff2f0 !important;
        }
      `}</style>
    </div>
  )
}
