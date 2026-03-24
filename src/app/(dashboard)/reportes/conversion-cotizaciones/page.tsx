'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Input } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, FunnelPlotOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useConversionCotizaciones, type ConversionCotizacionRow } from '@/lib/hooks/queries/useReportesVentas'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple, formatDate } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Search } = Input

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  borrador: { color: 'default', label: 'Borrador' },
  enviada: { color: 'blue', label: 'Enviada' },
  aceptada: { color: 'cyan', label: 'Aceptada' },
  facturada: { color: 'green', label: 'Facturada' },
  rechazada: { color: 'red', label: 'Rechazada' },
  vencida: { color: 'orange', label: 'Vencida' },
}

export default function ReporteConversionCotizacionesPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().subtract(3, 'month').startOf('month'),
    dayjs().endOf('month'),
  ])
  const [busqueda, setBusqueda] = useState('')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: cotizaciones = [], isLoading } = useConversionCotizaciones(fechaDesde, fechaHasta, organizacion?.id)

  const filteredData = useMemo(() => {
    if (!busqueda.trim()) return cotizaciones
    const term = busqueda.toLowerCase()
    return cotizaciones.filter(
      (c) =>
        c.folio.toLowerCase().includes(term) ||
        c.cliente_nombre.toLowerCase().includes(term) ||
        (c.vendedor_nombre || '').toLowerCase().includes(term)
    )
  }, [cotizaciones, busqueda])

  const stats = useMemo(() => {
    const total = filteredData.length
    const facturadas = filteredData.filter((c) => c.status === 'facturada').length
    const tasa = total > 0 ? (facturadas / total) * 100 : 0
    const valorTotal = filteredData.reduce((s, c) => s + Number(c.total || 0), 0)
    const valorConvertido = filteredData.filter((c) => c.status === 'facturada').reduce((s, c) => s + Number(c.total || 0), 0)
    return { total, facturadas, tasa, valorTotal, valorConvertido }
  }, [filteredData])

  const columns: ColumnsType<ConversionCotizacionRow> = useMemo(
    () => [
      { title: 'Folio', dataIndex: 'folio', key: 'folio', width: 130, sorter: (a, b) => a.folio.localeCompare(b.folio) },
      { title: 'Fecha', dataIndex: 'fecha', key: 'fecha', width: 110, render: (v: string) => formatDate(v), sorter: (a, b) => a.fecha.localeCompare(b.fecha) },
      { title: 'Cliente', dataIndex: 'cliente_nombre', key: 'cliente_nombre', ellipsis: true },
      { title: 'Vendedor', dataIndex: 'vendedor_nombre', key: 'vendedor_nombre', width: 150, render: (v: string | null) => v || '-' },
      { title: 'Total', dataIndex: 'total', key: 'total', width: 140, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => Number(a.total) - Number(b.total) },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        align: 'center',
        render: (val: string) => {
          const config = STATUS_TAG[val] || { color: 'default', label: val }
          return <Tag color={config.color}>{config.label}</Tag>
        },
        filters: Object.entries(STATUS_TAG).map(([k, v]) => ({ text: v.label, value: k })),
        onFilter: (value, record) => record.status === value,
      },
      {
        title: 'Convertida',
        key: 'convertida',
        width: 100,
        align: 'center',
        render: (_: unknown, r: ConversionCotizacionRow) =>
          r.status === 'facturada' ? <Tag color="green">Si</Tag> : <Tag color="default">No</Tag>,
      },
    ],
    []
  )

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'Folio', dataIndex: 'folio' },
          { titulo: 'Fecha', dataIndex: 'fecha_fmt' },
          { titulo: 'Cliente', dataIndex: 'cliente_nombre' },
          { titulo: 'Vendedor', dataIndex: 'vendedor_nombre' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
          { titulo: 'Status', dataIndex: 'status_label' },
          { titulo: 'Convertida', dataIndex: 'convertida' },
        ],
        datos: filteredData.map((r) => ({
          ...r,
          fecha_fmt: formatDate(r.fecha),
          status_label: STATUS_TAG[r.status]?.label || r.status,
          convertida: r.status === 'facturada' ? 'Si' : 'No',
        })),
        nombreArchivo: `conversion-cotizaciones-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Conversion Cotizaciones',
        tituloReporte: 'REPORTE DE CONVERSION DE COTIZACIONES',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [
          { etiqueta: 'Total Cotizaciones', valor: stats.total, formato: 'numero' },
          { etiqueta: 'Facturadas', valor: stats.facturadas, formato: 'numero' },
          { etiqueta: 'Tasa Conversion (%)', valor: stats.tasa, formato: 'numero' },
          { etiqueta: 'Valor Convertido', valor: stats.valorConvertido, formato: 'moneda' },
        ],
      })
    } finally {
      setGenerandoExcel(false)
    }
  }

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button>
          <Title level={2} style={{ margin: 0 }}><FunnelPlotOutlined /> Conversion de Cotizaciones</Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card><Statistic title="Total Cotizaciones" value={stats.total} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Facturadas" value={stats.facturadas} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Tasa Conversion" value={stats.tasa} precision={1} suffix="%" valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Valor Convertido" value={stats.valorConvertido} precision={2} prefix="$" valueStyle={{ color: '#fa8c16' }} /></Card></Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" />
          <Search placeholder="Buscar folio, cliente o vendedor..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 280 }} />
        </Space>
        <Table dataSource={filteredData} columns={columns} rowKey="id" scroll={{ x: 900 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} cotizaciones` }} />
      </Card>
    </div>
  )
}
