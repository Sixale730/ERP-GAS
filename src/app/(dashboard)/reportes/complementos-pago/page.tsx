'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Input } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, FileDoneOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useComplementosPago, type ComplementoPagoRow } from '@/lib/hooks/queries/useReportesFiscal'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple, formatDate } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Search } = Input

export default function ReporteComplementosPagoPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([dayjs().startOf('month'), dayjs().endOf('month')])
  const [busqueda, setBusqueda] = useState('')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null
  const { data: pagos = [], isLoading } = useComplementosPago(fechaDesde, fechaHasta, organizacion?.id)

  const filteredData = useMemo(() => {
    if (!busqueda.trim()) return pagos
    const term = busqueda.toLowerCase()
    return pagos.filter((p) => p.folio_pago.toLowerCase().includes(term) || p.factura_folio.toLowerCase().includes(term) || (p.cliente_rfc || '').toLowerCase().includes(term) || p.cliente_nombre.toLowerCase().includes(term))
  }, [pagos, busqueda])

  const stats = useMemo(() => {
    const total = filteredData.length
    const montoTotal = filteredData.reduce((s, p) => s + p.monto, 0)
    const conUUID = filteredData.filter((p) => p.uuid_factura).length
    const sinUUID = total - conUUID
    return { total, montoTotal, conUUID, sinUUID }
  }, [filteredData])

  const columns: ColumnsType<ComplementoPagoRow> = useMemo(() => [
    { title: 'Fecha Pago', dataIndex: 'fecha_pago', key: 'fecha_pago', width: 110, render: (v: string) => formatDate(v), sorter: (a, b) => a.fecha_pago.localeCompare(b.fecha_pago) },
    { title: 'Folio Pago', dataIndex: 'folio_pago', key: 'folio_pago', width: 120 },
    { title: 'Factura', dataIndex: 'factura_folio', key: 'factura_folio', width: 120 },
    { title: 'UUID Factura', dataIndex: 'uuid_factura', key: 'uuid_factura', width: 260, render: (v: string | null) => v ? <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{v}</span> : <Tag color="orange">Sin CFDI</Tag> },
    { title: 'RFC', dataIndex: 'cliente_rfc', key: 'cliente_rfc', width: 140, render: (v: string | null) => v || '-' },
    { title: 'Monto', dataIndex: 'monto', key: 'monto', width: 140, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.monto - b.monto, defaultSortOrder: 'descend' },
    { title: 'Metodo', dataIndex: 'metodo_pago', key: 'metodo_pago', width: 120, render: (v: string | null) => v || '-' },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'Fecha Pago', dataIndex: 'fecha_fmt' },
          { titulo: 'Folio Pago', dataIndex: 'folio_pago' },
          { titulo: 'Factura', dataIndex: 'factura_folio' },
          { titulo: 'UUID Factura', dataIndex: 'uuid_factura' },
          { titulo: 'RFC', dataIndex: 'cliente_rfc' },
          { titulo: 'Monto', dataIndex: 'monto', formato: 'moneda' },
          { titulo: 'Metodo', dataIndex: 'metodo_pago' },
        ],
        datos: filteredData.map((r) => ({ ...r, fecha_fmt: formatDate(r.fecha_pago) })),
        nombreArchivo: `complementos-pago-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Complementos Pago',
        tituloReporte: 'REPORTE DE COMPLEMENTOS DE PAGO',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [
          { etiqueta: 'Total Pagos', valor: stats.total, formato: 'numero' },
          { etiqueta: 'Monto Total', valor: stats.montoTotal, formato: 'moneda' },
          { etiqueta: 'Con CFDI', valor: stats.conUUID, formato: 'numero' },
          { etiqueta: 'Sin CFDI', valor: stats.sinUUID, formato: 'numero' },
        ],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><FileDoneOutlined /> Complementos de Pago</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card><Statistic title="Total Pagos" value={stats.total} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Monto Total" value={stats.montoTotal} precision={2} prefix="$" valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Con CFDI" value={stats.conUUID} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Sin CFDI" value={stats.sinUUID} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
      </Row>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" />
          <Search placeholder="Buscar folio, RFC..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 250 }} />
        </Space>
        <Table dataSource={filteredData} columns={columns} rowKey="id" scroll={{ x: 1100 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} pagos` }} />
      </Card>
    </div>
  )
}
