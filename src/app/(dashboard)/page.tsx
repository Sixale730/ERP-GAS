'use client'

import { useRouter } from 'next/navigation'
import { Row, Col, Card, Statistic, Table, Tag, Typography, Spin, Button, Space } from 'antd'
import {
  ShoppingOutlined,
  DollarOutlined,
  FileTextOutlined,
  WarningOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import { useDashboardData } from '@/lib/hooks/useQueries'
import { formatMoney } from '@/lib/utils/format'

const { Title } = Typography

export default function DashboardPage() {
  const router = useRouter()

  // React Query hook - una sola llamada con caché
  const { data, isLoading: loading, error } = useDashboardData()

  const stats = data?.stats || {
    totalProductos: 0,
    productosStockBajo: 0,
    cotizacionesPendientes: 0,
    facturasPorCobrar: 0,
    totalPorCobrar: 0,
  }
  const productosStockBajo = data?.productosStockBajo || []
  const facturasRecientes = data?.facturasRecientes || []

  const productosColumns = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
    },
    {
      title: 'Producto',
      dataIndex: 'nombre',
      key: 'nombre',
    },
    {
      title: 'Stock',
      dataIndex: 'stock_total',
      key: 'stock_total',
      render: (stock: number) => (
        <Tag color={stock === 0 ? 'red' : 'orange'}>
          {stock} unidades
        </Tag>
      ),
    },
  ]

  const facturasColumns = [
    {
      title: 'Folio',
      dataIndex: 'folio',
      key: 'folio',
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente_nombre',
      key: 'cliente_nombre',
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (total: number) => formatMoney(total),
    },
    {
      title: 'Saldo',
      dataIndex: 'saldo',
      key: 'saldo',
      render: (saldo: number) => (
        <span style={{ color: saldo > 0 ? '#cf1322' : '#3f8600' }}>
          {formatMoney(saldo)}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          pendiente: 'orange',
          parcial: 'blue',
          pagada: 'green',
          cancelada: 'red',
        }
        return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>
      },
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#cf1322' }}>
        Error al cargar el dashboard
      </div>
    )
  }

  return (
    <div>
      <Title level={2}>Dashboard</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Productos"
              value={stats.totalProductos}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Stock Bajo"
              value={stats.productosStockBajo}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.productosStockBajo > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Cotizaciones Pendientes"
              value={stats.cotizacionesPendientes}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Por Cobrar"
              value={stats.totalPorCobrar}
              prefix={<DollarOutlined />}
              precision={2}
              formatter={(value) => formatMoney(Number(value))}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title="Productos con Stock Bajo"
            extra={
              <Space>
                <Button
                  type="primary"
                  size="small"
                  icon={<ShoppingCartOutlined />}
                  onClick={() => router.push('/compras/nueva?stock_bajo=true')}
                  disabled={productosStockBajo.length === 0}
                >
                  Generar OC
                </Button>
                <WarningOutlined style={{ color: '#faad14' }} />
              </Space>
            }
          >
            <Table
              dataSource={productosStockBajo}
              columns={productosColumns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'No hay productos con stock bajo' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Facturas Pendientes" extra={<DollarOutlined style={{ color: '#cf1322' }} />}>
            <Table
              dataSource={facturasRecientes}
              columns={facturasColumns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'No hay facturas pendientes' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
