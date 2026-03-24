'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, RollbackOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useDevolucionesCancelaciones, type DevolucionRow } from '@/lib/hooks/queries/useReportesVentas'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple, formatDate } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function ReporteDevolucionesPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const modulosActivos: string[] = organizacion?.modulos_activos || []
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([dayjs().startOf('month'), dayjs().endOf('month')])
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null
  const { data: rows = [], isLoading } = useDevolucionesCancelaciones(fechaDesde, fechaHasta, organizacion?.id, modulosActivos)

  const stats = useMemo(() => {
    const total = rows.length
    const monto = rows.reduce((s, r) => s + r.monto, 0)
    const facturas = rows.filter((r) => r.tipo === 'factura').length
    const pos = rows.filter((r) => r.tipo === 'pos').length
    return { total, monto, facturas, pos }
  }, [rows])

  const columns: ColumnsType<DevolucionRow> = useMemo(() => [
    { title: 'Fecha', dataIndex: 'fecha', key: 'fecha', width: 110, render: (v: string) => formatDate(v), sorter: (a, b) => a.fecha.localeCompare(b.fecha) },
    { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', width: 100, align: 'center', render: (v: string) => <Tag color={v === 'factura' ? 'blue' : 'orange'}>{v === 'factura' ? 'Factura' : 'POS'}</Tag> },
    { title: 'Folio', dataIndex: 'folio', key: 'folio', width: 130 },
    { title: 'Cliente', dataIndex: 'cliente_nombre', key: 'cliente_nombre', ellipsis: true },
    { title: 'Sucursal', dataIndex: 'sucursal_nombre', key: 'sucursal_nombre', width: 130, ellipsis: true, render: (v: string | null) => v || '-', sorter: (a, b) => (a.sucursal_nombre || '').localeCompare(b.sucursal_nombre || '') },
    { title: 'Productos', dataIndex: 'productos_desc', key: 'productos_desc', width: 200, ellipsis: true, render: (v: string | null) => v || '-', sorter: (a, b) => (a.productos_desc || '').localeCompare(b.productos_desc || '') },
    { title: 'Monto', dataIndex: 'monto', key: 'monto', width: 140, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.monto - b.monto, defaultSortOrder: 'descend' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110, align: 'center', render: (v: string) => <Tag color="red">{v}</Tag> },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'Fecha', dataIndex: 'fecha_fmt' },
          { titulo: 'Tipo', dataIndex: 'tipo' },
          { titulo: 'Folio', dataIndex: 'folio' },
          { titulo: 'Cliente', dataIndex: 'cliente_nombre' },
          { titulo: 'Sucursal', dataIndex: 'sucursal_nombre' },
          { titulo: 'Productos', dataIndex: 'productos_desc' },
          { titulo: 'Monto', dataIndex: 'monto', formato: 'moneda' },
          { titulo: 'Status', dataIndex: 'status' },
        ],
        datos: rows.map((r) => ({ ...r, fecha_fmt: formatDate(r.fecha) })),
        nombreArchivo: `devoluciones-cancelaciones-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Devoluciones',
        tituloReporte: 'DEVOLUCIONES Y CANCELACIONES',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [{ etiqueta: 'Total Cancelaciones', valor: stats.total, formato: 'numero' }, { etiqueta: 'Monto Total', valor: stats.monto, formato: 'moneda' }],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><RollbackOutlined /> Devoluciones y Cancelaciones</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card><Statistic title="Total Cancelaciones" value={stats.total} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Monto Cancelado" value={stats.monto} precision={2} prefix="$" valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Facturas" value={stats.facturas} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="POS" value={stats.pos} valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>
      <Card><Space style={{ marginBottom: 16 }}><RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" /></Space>
        <Table dataSource={rows} columns={columns} rowKey="id" scroll={{ x: 1030 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} registros` }} /></Card>
    </div>
  )
}
