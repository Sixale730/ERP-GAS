'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Input, Select, Space, Button, DatePicker
} from 'antd'
import {
  ContainerOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useReporteOrdenesVenta, type FiltrosReporteOV } from '@/lib/hooks/queries/useReporteOrdenes'
import type { OrdenVentaRow } from '@/lib/hooks/queries/useOrdenesVenta'
import { exportarExcel } from '@/lib/utils/excel'
import { formatDate, formatMoneyCurrency } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  orden_venta: { color: 'blue', label: 'Pendiente' },
  facturada: { color: 'green', label: 'Facturada' },
}

export default function ReporteOrdenesVentaPage() {
  const router = useRouter()
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<FiltrosReporteOV['status']>('todas')
  const [monedaFilter, setMonedaFilter] = useState<FiltrosReporteOV['moneda']>('todas')
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const filtros: FiltrosReporteOV = {
    status: statusFilter,
    moneda: monedaFilter,
    fechaDesde: fechaRange?.[0]?.format('YYYY-MM-DD') ?? null,
    fechaHasta: fechaRange?.[1]?.format('YYYY-MM-DD') ?? null,
  }

  const { data: ordenes = [], isLoading, refetch } = useReporteOrdenesVenta(filtros)

  // Client-side text search filter
  const filteredData = useMemo(() => {
    if (!searchText) return ordenes
    const search = searchText.toLowerCase()
    return ordenes.filter(item =>
      item.folio?.toLowerCase().includes(search) ||
      item.cliente_nombre?.toLowerCase().includes(search) ||
      item.cliente_rfc?.toLowerCase().includes(search)
    )
  }, [ordenes, searchText])

  // Stats
  const stats = useMemo(() => {
    const total = filteredData.length
    const montoTotal = filteredData.reduce((sum, i) => sum + (i.total || 0), 0)
    const pendientes = filteredData.filter(i => i.status === 'orden_venta').length
    const facturadas = filteredData.filter(i => i.status === 'facturada').length
    return { total, montoTotal, pendientes, facturadas }
  }, [filteredData])

  const columns: ColumnsType<OrdenVentaRow> = [
    {
      title: 'Folio',
      dataIndex: 'folio',
      key: 'folio',
      width: 120,
      sorter: (a, b) => (a.folio || '').localeCompare(b.folio || ''),
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha',
      key: 'fecha',
      width: 110,
      render: (val: string) => formatDate(val),
      sorter: (a, b) => (a.fecha || '').localeCompare(b.fecha || ''),
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente_nombre',
      key: 'cliente_nombre',
      ellipsis: true,
      sorter: (a, b) => (a.cliente_nombre || '').localeCompare(b.cliente_nombre || ''),
    },
    {
      title: 'RFC',
      dataIndex: 'cliente_rfc',
      key: 'cliente_rfc',
      width: 140,
      render: (val: string) => val || '-',
    },
    {
      title: 'Almacen',
      dataIndex: 'almacen_nombre',
      key: 'almacen_nombre',
      width: 130,
    },
    {
      title: 'Moneda',
      dataIndex: 'moneda',
      key: 'moneda',
      width: 80,
      align: 'center',
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 140,
      align: 'right',
      sorter: (a, b) => (a.total || 0) - (b.total || 0),
      render: (val: number, record) => formatMoneyCurrency(val, record.moneda),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      align: 'center',
      render: (status: string) => {
        const config = STATUS_TAG[status] || { color: 'default', label: status }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: 'Creado',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      render: (val: string) => formatDate(val, 'DD/MM/YYYY HH:mm'),
    },
  ]

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const { data: freshData } = await refetch()
      const fresh = freshData || []

      // Apply same text filter
      const toExport = searchText
        ? fresh.filter(item => {
            const search = searchText.toLowerCase()
            return (
              item.folio?.toLowerCase().includes(search) ||
              item.cliente_nombre?.toLowerCase().includes(search) ||
              item.cliente_rfc?.toLowerCase().includes(search)
            )
          })
        : fresh

      const exportData = toExport.map(item => ({
          ...item,
          fecha_fmt: formatDate(item.fecha),
          status_label: STATUS_TAG[item.status]?.label || item.status,
          cliente_rfc: item.cliente_rfc || '',
          vendedor_nombre: (item as unknown as Record<string, unknown>).vendedor_nombre || '',
          created_fmt: formatDate(item.created_at, 'DD/MM/YYYY HH:mm'),
        }))

      const montoTotal = exportData.reduce((sum, i) => sum + ((i.total as number) || 0), 0)
      const pendientes = exportData.filter(i => i.status === 'orden_venta').length
      const facturadas = exportData.filter(i => i.status === 'facturada').length

      await exportarExcel({
        columnas: [
          { titulo: 'Folio', dataIndex: 'folio' },
          { titulo: 'Fecha', dataIndex: 'fecha_fmt' },
          { titulo: 'Cliente', dataIndex: 'cliente_nombre' },
          { titulo: 'RFC', dataIndex: 'cliente_rfc' },
          { titulo: 'Almacen', dataIndex: 'almacen_nombre' },
          { titulo: 'Moneda', dataIndex: 'moneda' },
          { titulo: 'Subtotal', dataIndex: 'subtotal', formato: 'moneda' },
          { titulo: 'IVA', dataIndex: 'iva', formato: 'moneda' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
          { titulo: 'Status', dataIndex: 'status_label' },
          { titulo: 'Vendedor', dataIndex: 'vendedor_nombre' },
          { titulo: 'Creado', dataIndex: 'created_fmt' },
        ],
        datos: exportData,
        nombreArchivo: `reporte-ordenes-venta-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Ordenes de Venta',
        tituloReporte: 'REPORTE DE ORDENES DE VENTA',
        resumen: [
          { etiqueta: 'Total Ordenes', valor: exportData.length, formato: 'numero' },
          { etiqueta: 'Monto Total', valor: montoTotal, formato: 'moneda' },
          { etiqueta: 'Pendientes', valor: pendientes, formato: 'numero' },
          { etiqueta: 'Facturadas', valor: facturadas, formato: 'numero' },
        ],
        statusDataIndex: 'status_label',
        mapaColorStatus: {
          Pendiente: 'CCE5FF',
          Facturada: 'C6EFCE',
        },
      })
    } finally {
      setGenerandoExcel(false)
    }
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            <ContainerOutlined /> Reporte de Ordenes de Venta
          </Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>
          Exportar Excel
        </Button>
      </div>

      {/* Estadísticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Ordenes"
              value={stats.total}
              prefix={<ContainerOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Monto Total"
              value={stats.montoTotal}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Pendientes"
              value={stats.pendientes}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Facturadas"
              value={stats.facturadas}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabla */}
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por folio, cliente o RFC..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'pendientes', label: 'Pendientes' },
              { value: 'facturadas', label: 'Facturadas' },
            ]}
          />
          <Select
            placeholder="Moneda"
            value={monedaFilter}
            onChange={setMonedaFilter}
            style={{ width: 120 }}
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'USD', label: 'USD' },
              { value: 'MXN', label: 'MXN' },
            ]}
          />
          <RangePicker
            value={fechaRange}
            onChange={(dates) => setFechaRange(dates)}
            format="DD/MM/YYYY"
            placeholder={['Fecha desde', 'Fecha hasta']}
          />
        </Space>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1100 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} registros`,
          }}
          locale={{ emptyText: 'No hay ordenes de venta' }}
        />
      </Card>
    </div>
  )
}
