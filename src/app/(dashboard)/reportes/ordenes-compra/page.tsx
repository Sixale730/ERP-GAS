'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Input, Select, Space, Button, DatePicker
} from 'antd'
import {
  ShoppingCartOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useReporteOrdenesCompra, type FiltrosReporteOC } from '@/lib/hooks/queries/useReporteOrdenes'
import { useProveedoresCompra } from '@/lib/hooks/queries/useOrdenesCompra'
import type { OrdenCompraView } from '@/types/database'
import { exportarExcel } from '@/lib/utils/excel'
import { formatDate, formatMoneyCurrency } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  borrador: { color: 'default', label: 'Borrador' },
  enviada: { color: 'blue', label: 'Enviada' },
  parcialmente_recibida: { color: 'orange', label: 'Parcial' },
  recibida: { color: 'green', label: 'Recibida' },
  cancelada: { color: 'red', label: 'Cancelada' },
}

export default function ReporteOrdenesCompraPage() {
  const router = useRouter()
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todas')
  const [proveedorFilter, setProveedorFilter] = useState<string | undefined>(undefined)
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const filtros: FiltrosReporteOC = {
    status: statusFilter,
    proveedorId: proveedorFilter ?? null,
    fechaDesde: fechaRange?.[0]?.format('YYYY-MM-DD') ?? null,
    fechaHasta: fechaRange?.[1]?.format('YYYY-MM-DD') ?? null,
  }

  const { data: ordenes = [], isLoading, refetch } = useReporteOrdenesCompra(filtros)
  const { data: proveedores = [] } = useProveedoresCompra()

  // Client-side text search filter
  const filteredData = useMemo(() => {
    if (!searchText) return ordenes
    const search = searchText.toLowerCase()
    return ordenes.filter(item =>
      item.folio?.toLowerCase().includes(search) ||
      item.proveedor_nombre?.toLowerCase().includes(search)
    )
  }, [ordenes, searchText])

  // Stats
  const stats = useMemo(() => {
    const total = filteredData.length
    const montoTotal = filteredData.reduce((sum, i) => sum + (i.total || 0), 0)
    const recibidas = filteredData.filter(i => i.status === 'recibida').length
    const pendientes = filteredData.filter(i => i.status === 'enviada' || i.status === 'parcialmente_recibida').length
    return { total, montoTotal, recibidas, pendientes }
  }, [filteredData])

  const columns: ColumnsType<OrdenCompraView> = useMemo(() => [
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
      title: 'Proveedor',
      dataIndex: 'proveedor_nombre',
      key: 'proveedor_nombre',
      ellipsis: true,
      sorter: (a, b) => (a.proveedor_nombre || '').localeCompare(b.proveedor_nombre || ''),
    },
    {
      title: 'Almacen Destino',
      dataIndex: 'almacen_nombre',
      key: 'almacen_nombre',
      width: 140,
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
      title: 'Recepcion',
      key: 'recepcion',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const totalItems = record.total_items || 0
        const completos = record.items_completos || 0
        const pct = totalItems > 0 ? Math.round((completos / totalItems) * 100) : 0
        return <Text type={pct === 100 ? 'success' : 'secondary'}>{pct}%</Text>
      },
    },
    {
      title: 'Fecha Esperada',
      dataIndex: 'fecha_esperada',
      key: 'fecha_esperada',
      width: 120,
      render: (val: string) => val ? formatDate(val) : '-',
    },
  ], [])

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
              item.proveedor_nombre?.toLowerCase().includes(search)
            )
          })
        : fresh

      const exportData = toExport.map(item => {
          const totalItems = item.total_items || 0
          const completos = item.items_completos || 0
          const pct = totalItems > 0 ? Math.round((completos / totalItems) * 100) : 0
          return {
            ...item,
            fecha_fmt: formatDate(item.fecha),
            status_label: STATUS_TAG[item.status]?.label || item.status,
            recepcion_pct: pct,
            fecha_esperada_fmt: item.fecha_esperada ? formatDate(item.fecha_esperada) : '',
            created_fmt: formatDate(item.created_at, 'DD/MM/YYYY HH:mm'),
          }
        })

      const montoTotal = exportData.reduce((sum, i) => sum + ((i.total as number) || 0), 0)
      const recibidas = exportData.filter(i => i.status === 'recibida').length
      const pendientes = exportData.filter(i => i.status === 'enviada' || i.status === 'parcialmente_recibida').length

      await exportarExcel({
        columnas: [
          { titulo: 'Folio', dataIndex: 'folio' },
          { titulo: 'Fecha', dataIndex: 'fecha_fmt' },
          { titulo: 'Proveedor', dataIndex: 'proveedor_nombre' },
          { titulo: 'Almacen Destino', dataIndex: 'almacen_nombre' },
          { titulo: 'Moneda', dataIndex: 'moneda' },
          { titulo: 'Subtotal', dataIndex: 'subtotal', formato: 'moneda' },
          { titulo: 'IVA', dataIndex: 'iva', formato: 'moneda' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
          { titulo: 'Status', dataIndex: 'status_label' },
          { titulo: 'Recepcion %', dataIndex: 'recepcion_pct', formato: 'porcentaje' },
          { titulo: 'Fecha Esperada', dataIndex: 'fecha_esperada_fmt' },
          { titulo: 'Creado', dataIndex: 'created_fmt' },
        ],
        datos: exportData,
        nombreArchivo: `reporte-ordenes-compra-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Ordenes de Compra',
        tituloReporte: 'REPORTE DE ORDENES DE COMPRA',
        resumen: [
          { etiqueta: 'Total Ordenes', valor: exportData.length, formato: 'numero' },
          { etiqueta: 'Monto Total', valor: montoTotal, formato: 'moneda' },
          { etiqueta: 'Recibidas', valor: recibidas, formato: 'numero' },
          { etiqueta: 'Pendientes', valor: pendientes, formato: 'numero' },
        ],
        statusDataIndex: 'status_label',
        mapaColorStatus: {
          Borrador: 'E2E2E2',
          Enviada: 'CCE5FF',
          Parcial: 'FFF3CD',
          Recibida: 'C6EFCE',
          Cancelada: 'F2DCDB',
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
            <ShoppingCartOutlined /> Reporte de Ordenes de Compra
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
              prefix={<ShoppingCartOutlined />}
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
              title="Recibidas"
              value={stats.recibidas}
              prefix={<CheckCircleOutlined />}
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
      </Row>

      {/* Tabla */}
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por folio o proveedor..."
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
              { value: 'borrador', label: 'Borrador' },
              { value: 'enviada', label: 'Enviada' },
              { value: 'parcialmente_recibida', label: 'Parcial' },
              { value: 'recibida', label: 'Recibida' },
              { value: 'cancelada', label: 'Cancelada' },
            ]}
          />
          <Select
            placeholder="Proveedor"
            value={proveedorFilter}
            onChange={setProveedorFilter}
            style={{ width: 200 }}
            allowClear
            options={proveedores.map(p => ({ value: p.id, label: p.razon_social }))}
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
          locale={{ emptyText: 'No hay ordenes de compra' }}
        />
      </Card>
    </div>
  )
}
