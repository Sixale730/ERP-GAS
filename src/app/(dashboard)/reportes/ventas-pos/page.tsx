'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Select, Space, Button, DatePicker
} from 'antd'
import {
  ArrowLeftOutlined,
  FileExcelOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useVentasPOSReporte, type VentaPOSReporte } from '@/lib/hooks/queries/useReportesNuevos'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatDateTime, formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

const METODO_PAGO_TAG: Record<string, { color: string; label: string }> = {
  efectivo: { color: 'green', label: 'Efectivo' },
  tarjeta: { color: 'blue', label: 'Tarjeta' },
  transferencia: { color: 'purple', label: 'Transferencia' },
  mixto: { color: 'orange', label: 'Mixto' },
}

export default function ReporteVentasPOSPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [metodoPagoFilter, setMetodoPagoFilter] = useState<string | null>(null)
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: ventas = [], isLoading, refetch } = useVentasPOSReporte(fechaDesde, fechaHasta, organizacion?.id)

  const filteredData = useMemo(() => {
    if (!metodoPagoFilter) return ventas
    return ventas.filter(v => v.metodo_pago === metodoPagoFilter)
  }, [ventas, metodoPagoFilter])

  const stats = useMemo(() => {
    const totalVendido = filteredData.reduce((sum, v) => sum + (v.total || 0), 0)
    const numVentas = filteredData.length
    const ticketPromedio = numVentas > 0 ? totalVendido / numVentas : 0
    return { totalVendido, numVentas, ticketPromedio }
  }, [filteredData])

  const columns: ColumnsType<VentaPOSReporte> = useMemo(() => [
    {
      title: 'Folio',
      dataIndex: 'folio',
      key: 'folio',
      width: 120,
      sorter: (a, b) => (a.folio || '').localeCompare(b.folio || ''),
    },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (val: string) => formatDateTime(val),
      sorter: (a, b) => (a.created_at || '').localeCompare(b.created_at || ''),
    },
    {
      title: 'Forma de Pago',
      dataIndex: 'metodo_pago',
      key: 'metodo_pago',
      width: 130,
      align: 'center',
      render: (val: string) => {
        const config = METODO_PAGO_TAG[val] || { color: 'default', label: val }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 130,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
      sorter: (a, b) => (a.subtotal || 0) - (b.subtotal || 0),
    },
    {
      title: 'IVA',
      dataIndex: 'iva',
      key: 'iva',
      width: 110,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 140,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
      sorter: (a, b) => (a.total || 0) - (b.total || 0),
    },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const { data: freshData } = await refetch()
      const fresh = freshData || []

      const toExport = metodoPagoFilter
        ? fresh.filter(v => v.metodo_pago === metodoPagoFilter)
        : fresh

      const exportData = toExport.map(item => ({
        ...item,
        fecha_fmt: formatDateTime(item.created_at),
        metodo_pago_label: METODO_PAGO_TAG[item.metodo_pago]?.label || item.metodo_pago,
      }))

      const totalVendido = exportData.reduce((sum, i) => sum + (i.total || 0), 0)
      const ticketPromedio = exportData.length > 0 ? totalVendido / exportData.length : 0

      await exportarExcel({
        columnas: [
          { titulo: 'Folio', dataIndex: 'folio' },
          { titulo: 'Fecha', dataIndex: 'fecha_fmt' },
          { titulo: 'Forma de Pago', dataIndex: 'metodo_pago_label' },
          { titulo: 'Subtotal', dataIndex: 'subtotal', formato: 'moneda' },
          { titulo: 'IVA', dataIndex: 'iva', formato: 'moneda' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
        ],
        datos: exportData,
        nombreArchivo: `reporte-ventas-pos-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Ventas POS',
        tituloReporte: 'REPORTE DE VENTAS POS',
        subtitulo: fechaDesde && fechaHasta
          ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
          : undefined,
        resumen: [
          { etiqueta: 'Total Vendido', valor: totalVendido, formato: 'moneda' },
          { etiqueta: 'Num. Ventas', valor: exportData.length, formato: 'numero' },
          { etiqueta: 'Ticket Promedio', valor: ticketPromedio, formato: 'moneda' },
        ],
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            <ShoppingCartOutlined /> Reporte de Ventas POS
          </Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>
          Exportar Excel
        </Button>
      </div>

      {/* Estadisticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Vendido"
              value={stats.totalVendido}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Num. Ventas"
              value={stats.numVentas}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Ticket Promedio"
              value={stats.ticketPromedio}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabla */}
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker
            value={fechaRange}
            onChange={(dates) => setFechaRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
            format="DD/MM/YYYY"
            placeholder={['Fecha desde', 'Fecha hasta']}
          />
          <Select
            placeholder="Metodo de pago"
            value={metodoPagoFilter}
            onChange={setMetodoPagoFilter}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: 'efectivo', label: 'Efectivo' },
              { value: 'tarjeta', label: 'Tarjeta' },
              { value: 'transferencia', label: 'Transferencia' },
              { value: 'mixto', label: 'Mixto' },
            ]}
          />
        </Space>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 800 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} registros`,
          }}
          locale={{ emptyText: 'No hay ventas POS en el periodo' }}
        />
      </Card>
    </div>
  )
}
