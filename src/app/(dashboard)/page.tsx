'use client'

import { useMemo } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Typography, Button, Space } from 'antd'
import {
  ShoppingOutlined,
  DollarOutlined,
  FileTextOutlined,
  WarningOutlined,
  ShoppingCartOutlined,
  PlusOutlined,
  UserAddOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
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
    {
      title: 'Días Venc.',
      dataIndex: 'fecha_vencimiento',
      key: 'dias_vencidos',
      width: 100,
      render: (fechaVenc: string | null) => {
        if (!fechaVenc) return <span style={{ color: '#999' }}>—</span>
        const dias = dayjs().diff(dayjs(fechaVenc), 'day')
        if (dias > 0) return <Tag color="red">{dias}d vencida</Tag>
        if (dias === 0) return <Tag color="orange">Hoy</Tag>
        return <Tag color="green">{Math.abs(dias)}d restantes</Tag>
      },
    },
  ], [])

  const ordenesColumns = useMemo(() => [
    { title: 'Folio', dataIndex: 'folio', key: 'folio' },
    { title: 'Cliente', dataIndex: 'cliente_nombre', key: 'cliente_nombre', ellipsis: true },
    { title: 'Fecha', dataIndex: 'fecha', key: 'fecha', width: 100, render: (f: string) => dayjs(f).format('DD/MM/YYYY') },
    { title: 'Total', dataIndex: 'total', key: 'total', width: 120, align: 'right' as const, render: (v: number) => formatMoneyMXN(v) },
    {
      title: '', key: 'acciones', width: 80,
      render: (_: any, record: any) => (
        <Button type="link" size="small" href={`/cotizaciones/${record.id}/editar`}>
          Surtir
        </Button>
      ),
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

  const { stats, productosStockBajo, facturasRecientes, ordenesPorSurtir } = data

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
        <Space>
          <Button icon={<FileTextOutlined />} href="/cotizaciones?status=propuesta">
            Ver Pendientes
          </Button>
          <Button type="primary" icon={<PlusOutlined />} href="/cotizaciones/nueva">
            Nueva Cotización
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Total Productos"
              value={stats.totalProductos}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Stock Bajo"
              value={stats.productosStockBajo}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.productosStockBajo > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card hoverable style={{ cursor: 'pointer', position: 'relative' }}>
            <Statistic
              title="Cotizaciones Pendientes"
              value={stats.cotizacionesPendientes}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <a href="/cotizaciones" style={{ position: 'absolute', inset: 0, opacity: 0 }} tabIndex={-1} aria-hidden="true" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
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
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Ventas del Mes"
              value={stats.ventasMes}
              prefix={<DollarOutlined />}
              precision={2}
              formatter={(value) => formatMoneyMXN(Number(value))}
              valueStyle={{ color: '#3f8600' }}
            />
            <div style={{ marginTop: 4 }}>
              {stats.ventasMesAnterior > 0 ? (() => {
                const pct = ((stats.ventasMes - stats.ventasMesAnterior) / stats.ventasMesAnterior * 100)
                return (
                  <Tag color={pct >= 0 ? 'green' : 'red'} icon={pct >= 0 ? <RiseOutlined /> : <FallOutlined />}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(1)}% vs mes anterior
                  </Tag>
                )
              })() : <Tag>Sin datos mes anterior</Tag>}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card hoverable style={{ cursor: 'pointer', position: 'relative' }}>
            <Statistic
              title="Órdenes por Surtir"
              value={stats.ordenesPorSurtir}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: stats.ordenesPorSurtir > 0 ? '#faad14' : '#3f8600' }}
            />
            <a href="/ordenes-venta" style={{ position: 'absolute', inset: 0, opacity: 0 }} tabIndex={-1} aria-hidden="true" />
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
                  href="/compras/nueva?stock_bajo=true"
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

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Órdenes por Surtir" extra={<ShoppingCartOutlined style={{ color: '#faad14' }} />}>
            <Table
              dataSource={ordenesPorSurtir}
              columns={ordenesColumns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'No hay órdenes pendientes de surtir' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Acciones Rápidas">
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Button block icon={<PlusOutlined />} href="/cotizaciones/nueva">Nueva Cotización</Button>
              </Col>
              <Col span={12}>
                <Button block icon={<ShoppingCartOutlined />} href="/ordenes-venta/nueva">Nueva Orden de Venta</Button>
              </Col>
              <Col span={12}>
                <Button block icon={<UserAddOutlined />} href="/clientes/nuevo">Nuevo Cliente</Button>
              </Col>
              <Col span={12}>
                <Button block icon={<DollarOutlined />} href="/facturas">Ver Facturas</Button>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
