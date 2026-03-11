'use client'

import { useMemo } from 'react'
import Link from 'next/link'
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
import { useTipoCambioBanxico } from '@/lib/hooks/queries/useTipoCambioBanxico'
import { useAuth } from '@/lib/hooks/useAuth'
import { DashboardSkeleton } from '@/components/common/Skeletons'
import { formatMoneyMXN, formatMoneyUSD } from '@/lib/utils/format'
import DashboardPOS from '@/components/dashboard/DashboardPOS'

const { Title } = Typography

export default function DashboardPage() {
  const { loading: authLoading, organizacion } = useAuth()

  const esPOS = organizacion?.codigo === 'MASCOTIENDA'

  // React Query hook — se dispara inmediatamente (en paralelo con auth)
  const { data, isLoading, isError } = useDashboard()

  // Auto-fetch tipo de cambio on dashboard mount (fire-and-forget)
  useTipoCambioBanxico()

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

  const facturasColumns = useMemo(() => [
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
      render: (total: number, record: any) => record.moneda === 'MXN' ? formatMoneyMXN(total) : formatMoneyUSD(total),
    },
    {
      title: 'Saldo',
      dataIndex: 'saldo',
      key: 'saldo',
      render: (saldo: number, record: any) => (
        <span style={{ color: saldo > 0 ? '#cf1322' : '#3f8600' }}>
          {record.moneda === 'MXN' ? formatMoneyMXN(saldo) : formatMoneyUSD(saldo)}
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
  ], [])

  if (esPOS) {
    return <DashboardPOS />
  }

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

  const { stats, productosStockBajo, facturasRecientes } = data

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
        <Space>
          <Link href="/cotizaciones?status=propuesta">
            <Button icon={<FileTextOutlined />}>
              Ver Pendientes
            </Button>
          </Link>
          <Link href="/cotizaciones/nueva">
            <Button type="primary" icon={<PlusOutlined />}>
              Nueva Cotización
            </Button>
          </Link>
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
          <Link href="/cotizaciones" style={{ textDecoration: 'none' }}>
          <Card hoverable>
            <Statistic
              title="Cotizaciones Pendientes"
              value={stats.cotizacionesPendientes}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
          </Link>
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
                <Link href="/compras/nueva?stock_bajo=true">
                  <Button
                    type="primary"
                    size="small"
                    icon={<ShoppingCartOutlined />}
                    disabled={productosStockBajo.length === 0}
                  >
                    Generar OC
                  </Button>
                </Link>
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
