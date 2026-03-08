'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Row, Col, Card, Statistic, Table, Tag, Typography, Button, Space } from 'antd'
import {
  ShoppingOutlined,
  DollarOutlined,
  WarningOutlined,
  PlayCircleOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useDashboardPOS } from '@/lib/hooks/queries/useDashboard'
import { useAuth } from '@/lib/hooks/useAuth'
import { DashboardSkeleton } from '@/components/common/Skeletons'
import { formatMoneyMXN } from '@/lib/utils/format'

const { Title } = Typography

export default function DashboardPOS() {
  const router = useRouter()
  const { organizacion, loading: authLoading } = useAuth()
  const { data, isLoading, isError } = useDashboardPOS(organizacion?.id)

  const ventasColumns = useMemo(() => [
    {
      title: 'Folio',
      dataIndex: 'folio',
      key: 'folio',
    },
    {
      title: 'Caja',
      dataIndex: 'caja_nombre',
      key: 'caja_nombre',
    },
    {
      title: 'Cajero',
      dataIndex: 'cajero_nombre',
      key: 'cajero_nombre',
    },
    {
      title: 'Pago',
      dataIndex: 'metodo_pago',
      key: 'metodo_pago',
      render: (metodo: string) => {
        const colors: Record<string, string> = {
          efectivo: 'green',
          tarjeta: 'blue',
          transferencia: 'purple',
          mixto: 'orange',
        }
        return <Tag color={colors[metodo] || 'default'}>{metodo}</Tag>
      },
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (total: number) => formatMoneyMXN(total),
    },
    {
      title: 'Hora',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => {
        const d = new Date(date)
        return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      },
    },
  ], [])

  const productosColumns = useMemo(() => [
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
  ], [])

  if (authLoading || isLoading) {
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

  const { stats, ultimasVentas, productosStockBajo } = data

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
        <Space>
          <Button
            icon={<UnorderedListOutlined />}
            onClick={() => router.push('/pos/ventas')}
          >
            Ver Ventas
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => router.push('/pos')}
          >
            Iniciar Turno
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Ventas Hoy"
              value={stats.ventasHoy}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Ingreso Hoy"
              value={stats.ingresoHoy}
              prefix={<DollarOutlined />}
              precision={2}
              formatter={(value) => formatMoneyMXN(Number(value))}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
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
              value={stats.stockBajo}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.stockBajo > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Últimas Ventas del Día" extra={<ShoppingOutlined style={{ color: '#1890ff' }} />}>
            <Table
              dataSource={ultimasVentas}
              columns={ventasColumns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'No hay ventas hoy' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Productos con Stock Bajo" extra={<WarningOutlined style={{ color: '#faad14' }} />}>
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
      </Row>
    </div>
  )
}
