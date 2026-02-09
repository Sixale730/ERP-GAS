'use client'

import { useRouter } from 'next/navigation'
import { Row, Col, Card, Statistic, Table, Tag, Typography, Button, Space } from 'antd'
import {
  ShoppingOutlined,
  DollarOutlined,
  FileTextOutlined,
  WarningOutlined,
  ShoppingCartOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useDashboard } from '@/lib/hooks/queries/useDashboard'
import { DashboardSkeleton } from '@/components/common/Skeletons'
import { formatMoney, formatMoneyMXN } from '@/lib/utils/format'

const { Title } = Typography

export default function DashboardPage() {
  const router = useRouter()

  // React Query hook
  const { data, isLoading, isError } = useDashboard()

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

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (isError || !data) {
    return (
      <div>
        <Title level={2}>Dashboard</Title>
        <Card>
          <p>Error al cargar el dashboard. Por favor, recarga la pagina.</p>
        </Card>
      </div>
    )
  }

  const { stats, productosStockBajo, facturasRecientes } = data

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
        <Space>
          <Button
            icon={<FileTextOutlined />}
            onClick={() => router.push('/cotizaciones?status=propuesta')}
          >
            Ver Pendientes
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push('/cotizaciones/nueva')}
          >
            Nueva Cotización
          </Button>
        </Space>
      </div>

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
          <Card
            hoverable
            onClick={() => router.push('/cotizaciones')}
            style={{ cursor: 'pointer' }}
          >
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
              formatter={(value) => formatMoneyMXN(Number(value))}
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
