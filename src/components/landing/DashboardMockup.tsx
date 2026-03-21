'use client'

import { Card, Table, Tag, Row, Col, Statistic } from 'antd'
import {
  DollarOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  RiseOutlined,
} from '@ant-design/icons'

const cotizaciones = [
  { key: '1', folio: 'COT-00001', cliente: 'Empresa Demo S.A.', total: '$12,500.00', status: 'enviada' },
  { key: '2', folio: 'COT-00002', cliente: 'Distribuidora Ejemplo', total: '$8,300.00', status: 'borrador' },
  { key: '3', folio: 'COT-00003', cliente: 'Comercial ABC', total: '$45,200.00', status: 'aprobada' },
  { key: '4', folio: 'COT-00004', cliente: 'Servicios Globales', total: '$3,750.00', status: 'enviada' },
]

const columns = [
  { title: 'Folio', dataIndex: 'folio', key: 'folio' },
  { title: 'Cliente', dataIndex: 'cliente', key: 'cliente' },
  { title: 'Total', dataIndex: 'total', key: 'total', align: 'right' as const },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => {
      const colors: Record<string, string> = {
        borrador: 'default',
        enviada: 'blue',
        aprobada: 'green',
      }
      return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>
    },
  },
]

export default function DashboardMockup() {
  return (
    <div
      style={{
        background: '#f5f5f5',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        maxWidth: 900,
        margin: '0 auto',
        transform: 'perspective(1200px) rotateY(-2deg) rotateX(2deg)',
        border: '1px solid #e8e8e8',
      }}
    >
      {/* Mini top bar */}
      <div
        style={{
          background: '#001529',
          borderRadius: '8px 8px 0 0',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 12 }}>
          CUANTY ERP — Dashboard
        </span>
      </div>

      {/* Stats row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>Ventas del Mes</span>}
              value={156800}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#3f8600', fontSize: 18 }}
              formatter={(v) => `$${Number(v).toLocaleString('es-MX')}`}
            />
            <Tag color="green" style={{ marginTop: 4, fontSize: 10 }}>
              <RiseOutlined /> +12.5%
            </Tag>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>Cotizaciones Activas</span>}
              value={24}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>Productos en Stock</span>}
              value={1847}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>Por Cobrar</span>}
              value={89450}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#cf1322', fontSize: 18 }}
              formatter={(v) => `$${Number(v).toLocaleString('es-MX')}`}
            />
          </Card>
        </Col>
      </Row>

      {/* Cotizaciones table */}
      <Card
        size="small"
        title={<span style={{ fontSize: 13 }}>Cotizaciones Recientes</span>}
        style={{ borderRadius: 8 }}
      >
        <Table
          dataSource={cotizaciones}
          columns={columns}
          pagination={false}
          size="small"
          style={{ fontSize: 12 }}
        />
      </Card>
    </div>
  )
}
