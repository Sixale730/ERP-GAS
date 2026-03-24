'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Input } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, LineChartOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useHistorialPreciosCompra, type HistorialPrecioCompraRow } from '@/lib/hooks/queries/useReportesCompras'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple, formatDate, formatNumber } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Search } = Input

export default function ReporteHistorialPreciosCompraPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([dayjs().subtract(6, 'month').startOf('month'), dayjs().endOf('month')])
  const [busqueda, setBusqueda] = useState('')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null
  const { data: items = [], isLoading } = useHistorialPreciosCompra(fechaDesde, fechaHasta, organizacion?.id)

  const filteredData = useMemo(() => {
    if (!busqueda.trim()) return items
    const term = busqueda.toLowerCase()
    return items.filter((i) => i.sku.toLowerCase().includes(term) || i.producto_nombre.toLowerCase().includes(term) || i.proveedor_nombre.toLowerCase().includes(term))
  }, [items, busqueda])

  const stats = useMemo(() => {
    const totalItems = filteredData.length
    const productosDistintos = new Set(filteredData.map((i) => i.sku)).size
    const proveedoresDistintos = new Set(filteredData.map((i) => i.proveedor_nombre)).size
    return { totalItems, productosDistintos, proveedoresDistintos }
  }, [filteredData])

  const columns: ColumnsType<HistorialPrecioCompraRow> = useMemo(() => [
    { title: 'Fecha', dataIndex: 'fecha', key: 'fecha', width: 110, render: (v: string) => formatDate(v), sorter: (a, b) => a.fecha.localeCompare(b.fecha) },
    { title: 'OC Folio', dataIndex: 'folio', key: 'folio', width: 120, sorter: (a, b) => a.folio.localeCompare(b.folio) },
    { title: 'Proveedor', dataIndex: 'proveedor_nombre', key: 'proveedor_nombre', width: 180, ellipsis: true, sorter: (a, b) => a.proveedor_nombre.localeCompare(b.proveedor_nombre) },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 110, sorter: (a, b) => a.sku.localeCompare(b.sku) },
    { title: 'Producto', dataIndex: 'producto_nombre', key: 'producto_nombre', ellipsis: true, sorter: (a, b) => a.producto_nombre.localeCompare(b.producto_nombre) },
    { title: 'Cantidad', dataIndex: 'cantidad', key: 'cantidad', width: 100, align: 'center', render: (v: number) => formatNumber(v), sorter: (a, b) => a.cantidad - b.cantidad },
    { title: 'Precio Unit.', dataIndex: 'precio_unitario', key: 'precio_unitario', width: 130, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.precio_unitario - b.precio_unitario },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'Fecha', dataIndex: 'fecha_fmt' },
          { titulo: 'OC Folio', dataIndex: 'folio' },
          { titulo: 'Proveedor', dataIndex: 'proveedor_nombre' },
          { titulo: 'SKU', dataIndex: 'sku' },
          { titulo: 'Producto', dataIndex: 'producto_nombre' },
          { titulo: 'Cantidad', dataIndex: 'cantidad', formato: 'numero' },
          { titulo: 'Precio Unitario', dataIndex: 'precio_unitario', formato: 'moneda' },
        ],
        datos: filteredData.map((r) => ({ ...r, fecha_fmt: formatDate(r.fecha) })),
        nombreArchivo: `historial-precios-compra-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Historial Precios',
        tituloReporte: 'HISTORIAL DE PRECIOS DE COMPRA',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [
          { etiqueta: 'Total Registros', valor: stats.totalItems, formato: 'numero' },
          { etiqueta: 'Productos Distintos', valor: stats.productosDistintos, formato: 'numero' },
          { etiqueta: 'Proveedores', valor: stats.proveedoresDistintos, formato: 'numero' },
        ],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><LineChartOutlined /> Historial Precios de Compra</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card><Statistic title="Total Registros" value={stats.totalItems} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Productos Distintos" value={stats.productosDistintos} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Proveedores" value={stats.proveedoresDistintos} valueStyle={{ color: '#eb2f96' }} /></Card></Col>
      </Row>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" />
          <Search placeholder="Buscar SKU, producto o proveedor..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 280 }} />
        </Space>
        <Table dataSource={filteredData} columns={columns} rowKey="id" scroll={{ x: 900 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} registros` }} />
      </Card>
    </div>
  )
}
