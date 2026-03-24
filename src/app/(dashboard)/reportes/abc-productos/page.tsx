'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Select, Input } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, GoldOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useABCProductos, type ABCProductoRow } from '@/lib/hooks/queries/useReportesFinanzas'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple, formatNumber } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Search } = Input

const ABC_COLOR = { A: 'green', B: 'blue', C: 'orange' } as const

export default function ReporteABCProductosPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const modulosActivos: string[] = organizacion?.modulos_activos || []
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([dayjs().startOf('year'), dayjs().endOf('month')])
  const [clasFilter, setClasFilter] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null
  const { data: productos = [], isLoading } = useABCProductos(fechaDesde, fechaHasta, organizacion?.id, modulosActivos)

  const filteredData = useMemo(() => {
    let result = productos
    if (clasFilter) result = result.filter((p) => p.clasificacion === clasFilter)
    if (busqueda.trim()) {
      const term = busqueda.toLowerCase()
      result = result.filter((p) => p.sku.toLowerCase().includes(term) || p.nombre.toLowerCase().includes(term))
    }
    return result
  }, [productos, clasFilter, busqueda])

  const stats = useMemo(() => {
    const a = productos.filter((p) => p.clasificacion === 'A').length
    const b = productos.filter((p) => p.clasificacion === 'B').length
    const c = productos.filter((p) => p.clasificacion === 'C').length
    const skuTop = productos[0]?.nombre || '-'
    return { a, b, c, total: productos.length, skuTop }
  }, [productos])

  const columns: ColumnsType<ABCProductoRow> = useMemo(() => [
    { title: '#', dataIndex: 'ranking', key: 'ranking', width: 55, align: 'center' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 110 },
    { title: 'Producto', dataIndex: 'nombre', key: 'nombre', ellipsis: true },
    { title: 'Unidades', dataIndex: 'unidades', key: 'unidades', width: 100, align: 'center', render: (v: number) => formatNumber(v) },
    { title: 'Total Vendido', dataIndex: 'total_vendido', key: 'total_vendido', width: 150, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.total_vendido - b.total_vendido },
    { title: '%', dataIndex: 'porcentaje', key: 'porcentaje', width: 80, align: 'right', render: (v: number) => `${v}%` },
    { title: 'Acum.', dataIndex: 'acumulado', key: 'acumulado', width: 90, align: 'right', render: (v: number) => `${v}%` },
    { title: 'Clase', dataIndex: 'clasificacion', key: 'clasificacion', width: 75, align: 'center', render: (v: 'A' | 'B' | 'C') => <Tag color={ABC_COLOR[v]}>{v}</Tag> },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: '#', dataIndex: 'ranking', formato: 'numero' },
          { titulo: 'SKU', dataIndex: 'sku' },
          { titulo: 'Producto', dataIndex: 'nombre' },
          { titulo: 'Unidades', dataIndex: 'unidades', formato: 'numero' },
          { titulo: 'Total Vendido', dataIndex: 'total_vendido', formato: 'moneda' },
          { titulo: '% del Total', dataIndex: 'porcentaje_fmt' },
          { titulo: '% Acumulado', dataIndex: 'acumulado_fmt' },
          { titulo: 'Clasificacion', dataIndex: 'clasificacion' },
        ],
        datos: filteredData.map((r) => ({ ...r, porcentaje_fmt: `${r.porcentaje}%`, acumulado_fmt: `${r.acumulado}%` })),
        nombreArchivo: `abc-productos-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'ABC Productos',
        tituloReporte: 'ANALISIS ABC DE PRODUCTOS (PARETO)',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [
          { etiqueta: 'Productos A', valor: stats.a, formato: 'numero' },
          { etiqueta: 'Productos B', valor: stats.b, formato: 'numero' },
          { etiqueta: 'Productos C', valor: stats.c, formato: 'numero' },
          { etiqueta: 'Total Productos', valor: stats.total, formato: 'numero' },
        ],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><GoldOutlined /> ABC de Productos</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card><Statistic title="Clase A (80%)" value={stats.a} suffix={` de ${stats.total}`} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Clase B (15%)" value={stats.b} suffix={` de ${stats.total}`} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Clase C (5%)" value={stats.c} suffix={` de ${stats.total}`} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Total Productos" value={stats.total} valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" />
          <Select placeholder="Todas las clases" value={clasFilter} onChange={setClasFilter} style={{ width: 160 }} allowClear options={[{ value: 'A', label: 'Clase A' }, { value: 'B', label: 'Clase B' }, { value: 'C', label: 'Clase C' }]} />
          <Search placeholder="Buscar SKU o producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 250 }} />
        </Space>
        <Table dataSource={filteredData} columns={columns} rowKey="producto_id" scroll={{ x: 800 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} productos` }} />
      </Card>
    </div>
  )
}
