'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, InputNumber, Input } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, StopOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useProductosSinMovimiento, type ProductoSinMovimientoRow } from '@/lib/hooks/queries/useReportesInventario'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple, formatDate, formatNumber } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Search } = Input

export default function ReporteProductosSinMovimientoPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [diasMinimos, setDiasMinimos] = useState(30)
  const [busqueda, setBusqueda] = useState('')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const { data: productos = [], isLoading } = useProductosSinMovimiento(diasMinimos, organizacion?.id)

  const filteredData = useMemo(() => {
    if (!busqueda.trim()) return productos
    const term = busqueda.toLowerCase()
    return productos.filter((p) => p.sku.toLowerCase().includes(term) || p.nombre.toLowerCase().includes(term))
  }, [productos, busqueda])

  const stats = useMemo(() => {
    const total = filteredData.length
    const valorRetenido = filteredData.reduce((s, p) => s + p.valor_retenido, 0)
    const unidades = filteredData.reduce((s, p) => s + p.cantidad, 0)
    const maxDias = filteredData.length > 0 ? filteredData[0].dias_sin_movimiento : 0
    return { total, valorRetenido, unidades, maxDias }
  }, [filteredData])

  const columns: ColumnsType<ProductoSinMovimientoRow> = useMemo(
    () => [
      { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120, sorter: (a, b) => a.sku.localeCompare(b.sku) },
      { title: 'Producto', dataIndex: 'nombre', key: 'nombre', ellipsis: true },
      { title: 'Almacen', dataIndex: 'almacen_nombre', key: 'almacen_nombre', width: 130 },
      { title: 'Cantidad', dataIndex: 'cantidad', key: 'cantidad', width: 100, align: 'center', render: (v: number) => formatNumber(v) },
      { title: 'Costo Unit.', dataIndex: 'costo_unitario', key: 'costo_unitario', width: 120, align: 'right', render: (v: number) => formatMoneySimple(v) },
      { title: 'Valor Retenido', dataIndex: 'valor_retenido', key: 'valor_retenido', width: 140, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.valor_retenido - b.valor_retenido },
      {
        title: 'Ultimo Mov.',
        dataIndex: 'ultimo_movimiento',
        key: 'ultimo_movimiento',
        width: 120,
        render: (v: string | null) => v ? formatDate(v) : <Text type="secondary">Nunca</Text>,
      },
      {
        title: 'Dias Sin Mov.',
        dataIndex: 'dias_sin_movimiento',
        key: 'dias_sin_movimiento',
        width: 130,
        align: 'center',
        render: (v: number) => {
          const color = v >= 180 ? 'red' : v >= 90 ? 'orange' : 'blue'
          return <Tag color={color}>{v >= 999 ? 'Nunca vendido' : `${v} dias`}</Tag>
        },
        sorter: (a, b) => a.dias_sin_movimiento - b.dias_sin_movimiento,
        defaultSortOrder: 'descend',
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
          { titulo: 'Almacen', dataIndex: 'almacen_nombre' },
          { titulo: 'Cantidad', dataIndex: 'cantidad', formato: 'numero' },
          { titulo: 'Costo Unitario', dataIndex: 'costo_unitario', formato: 'moneda' },
          { titulo: 'Valor Retenido', dataIndex: 'valor_retenido', formato: 'moneda' },
          { titulo: 'Ultimo Movimiento', dataIndex: 'ultimo_mov_fmt' },
          { titulo: 'Dias Sin Movimiento', dataIndex: 'dias_sin_movimiento', formato: 'numero' },
        ],
        datos: filteredData.map((r) => ({ ...r, ultimo_mov_fmt: r.ultimo_movimiento ? formatDate(r.ultimo_movimiento) : 'Nunca' })),
        nombreArchivo: `productos-sin-movimiento-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Sin Movimiento',
        tituloReporte: 'PRODUCTOS SIN MOVIMIENTO',
        subtitulo: `Minimo ${diasMinimos} dias sin salida`,
        resumen: [
          { etiqueta: 'Total Productos', valor: stats.total, formato: 'numero' },
          { etiqueta: 'Valor Retenido', valor: stats.valorRetenido, formato: 'moneda' },
          { etiqueta: 'Total Unidades', valor: stats.unidades, formato: 'numero' },
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
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><StopOutlined /> Productos Sin Movimiento</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card><Statistic title="Productos Sin Mov." value={stats.total} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Valor Retenido" value={stats.valorRetenido} precision={2} prefix="$" valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Total Unidades" value={stats.unidades} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Max Dias Sin Mov." value={stats.maxDias >= 999 ? 'Nunca' : stats.maxDias} valueStyle={{ color: '#722ed1', fontSize: stats.maxDias >= 999 ? 18 : undefined }} /></Card></Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Space><Text>Minimo dias sin movimiento:</Text><InputNumber min={1} max={365} value={diasMinimos} onChange={(v) => setDiasMinimos(v || 30)} style={{ width: 80 }} /></Space>
          <Search placeholder="Buscar SKU o producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 250 }} />
        </Space>
        <Table dataSource={filteredData} columns={columns} rowKey={(r) => `${r.producto_id}-${r.almacen_nombre}`} scroll={{ x: 1000 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} productos` }} />
      </Card>
    </div>
  )
}
