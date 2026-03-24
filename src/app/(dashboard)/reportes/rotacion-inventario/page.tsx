'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Input } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, SyncOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useRotacionInventario, type RotacionInventarioRow } from '@/lib/hooks/queries/useReportesInventario'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatNumber } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Search } = Input

export default function ReporteRotacionInventarioPage() {
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

  const { data: productos = [], isLoading } = useRotacionInventario(fechaDesde, fechaHasta, organizacion?.id)

  const filteredData = useMemo(() => {
    if (!busqueda.trim()) return productos
    const term = busqueda.toLowerCase()
    return productos.filter((p) => p.sku.toLowerCase().includes(term) || p.nombre.toLowerCase().includes(term))
  }, [productos, busqueda])

  const stats = useMemo(() => {
    const conVentas = filteredData.filter((p) => p.unidades_vendidas > 0)
    const rotacionProm = conVentas.length > 0 ? conVentas.reduce((s, p) => s + p.rotacion, 0) / conVentas.length : 0
    const diasProm = conVentas.length > 0 ? conVentas.reduce((s, p) => s + p.dias_inventario, 0) / conVentas.length : 0
    const sinRotacion = filteredData.filter((p) => p.unidades_vendidas === 0).length
    const topProducto = filteredData[0]?.nombre || '-'
    return { rotacionProm, diasProm, sinRotacion, topProducto }
  }, [filteredData])

  const columns: ColumnsType<RotacionInventarioRow> = useMemo(
    () => [
      { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120, sorter: (a, b) => a.sku.localeCompare(b.sku) },
      { title: 'Producto', dataIndex: 'nombre', key: 'nombre', ellipsis: true, sorter: (a, b) => a.nombre.localeCompare(b.nombre) },
      { title: 'Stock Actual', dataIndex: 'stock_actual', key: 'stock_actual', width: 120, align: 'center', render: (v: number) => formatNumber(v), sorter: (a, b) => a.stock_actual - b.stock_actual },
      { title: 'Unid. Vendidas', dataIndex: 'unidades_vendidas', key: 'unidades_vendidas', width: 130, align: 'center', render: (v: number) => formatNumber(v), sorter: (a, b) => a.unidades_vendidas - b.unidades_vendidas },
      {
        title: 'Rotacion',
        dataIndex: 'rotacion',
        key: 'rotacion',
        width: 110,
        align: 'center',
        render: (v: number) => {
          const color = v >= 3 ? 'green' : v >= 1 ? 'blue' : v > 0 ? 'orange' : 'red'
          return <Tag color={color}>{v.toFixed(2)}x</Tag>
        },
        sorter: (a, b) => a.rotacion - b.rotacion,
        defaultSortOrder: 'descend',
      },
      {
        title: 'Dias Inventario',
        dataIndex: 'dias_inventario',
        key: 'dias_inventario',
        width: 140,
        align: 'center',
        render: (v: number) => v >= 999 ? <Tag color="red">Sin venta</Tag> : `${v} dias`,
        sorter: (a, b) => a.dias_inventario - b.dias_inventario,
      },
    ],
    []
  )

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'SKU', dataIndex: 'sku' },
          { titulo: 'Producto', dataIndex: 'nombre' },
          { titulo: 'Stock Actual', dataIndex: 'stock_actual', formato: 'numero' },
          { titulo: 'Unid. Vendidas', dataIndex: 'unidades_vendidas', formato: 'numero' },
          { titulo: 'Rotacion (veces)', dataIndex: 'rotacion', formato: 'numero' },
          { titulo: 'Dias Inventario', dataIndex: 'dias_inventario', formato: 'numero' },
        ],
        datos: filteredData.map((r) => ({ ...r, dias_inventario: r.dias_inventario >= 999 ? 'Sin venta' : r.dias_inventario })),
        nombreArchivo: `rotacion-inventario-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Rotacion Inventario',
        tituloReporte: 'REPORTE DE ROTACION DE INVENTARIO',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [
          { etiqueta: 'Rotacion Promedio', valor: stats.rotacionProm, formato: 'numero' },
          { etiqueta: 'Dias Inventario Prom.', valor: stats.diasProm, formato: 'numero' },
          { etiqueta: 'Sin Rotacion', valor: stats.sinRotacion, formato: 'numero' },
        ],
      })
    } finally {
      setGenerandoExcel(false)
    }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><SyncOutlined /> Rotacion de Inventario</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card><Statistic title="Rotacion Promedio" value={stats.rotacionProm} precision={2} suffix="x" valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Dias Inv. Promedio" value={stats.diasProm} precision={0} suffix=" dias" valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Sin Rotacion" value={stats.sinRotacion} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Total Productos" value={filteredData.length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" />
          <Search placeholder="Buscar SKU o producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 250 }} />
        </Space>
        <Table dataSource={filteredData} columns={columns} rowKey="producto_id" scroll={{ x: 800 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} productos` }} />
      </Card>
    </div>
  )
}
