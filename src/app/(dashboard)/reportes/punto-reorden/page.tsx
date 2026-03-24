'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, AlertOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { usePuntoReorden, type PuntoReordenRow } from '@/lib/hooks/queries/useReportesInventario'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatNumber } from '@/lib/utils/format'
import dayjs from 'dayjs'
import { useState } from 'react'

const { Title } = Typography

export default function ReportePuntoReordenPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [generandoExcel, setGenerandoExcel] = useState(false)
  const { data: productos = [], isLoading } = usePuntoReorden(organizacion?.id)

  const stats = useMemo(() => {
    const total = productos.length
    const criticos = productos.filter((p) => p.nivel === 'sin_stock').length
    const bajos = productos.filter((p) => p.nivel === 'bajo').length
    const totalSugerido = productos.reduce((s, p) => s + p.cantidad_sugerida, 0)
    return { total, criticos, bajos, totalSugerido }
  }, [productos])

  const columns: ColumnsType<PuntoReordenRow> = useMemo(() => [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120, sorter: (a, b) => a.sku.localeCompare(b.sku) },
    { title: 'Producto', dataIndex: 'nombre', key: 'nombre', ellipsis: true, sorter: (a, b) => a.nombre.localeCompare(b.nombre) },
    { title: 'Almacen', dataIndex: 'almacen_nombre', key: 'almacen_nombre', width: 130, sorter: (a, b) => a.almacen_nombre.localeCompare(b.almacen_nombre) },
    { title: 'Stock Actual', dataIndex: 'stock_actual', key: 'stock_actual', width: 110, align: 'center', render: (v: number) => formatNumber(v), sorter: (a, b) => a.stock_actual - b.stock_actual },
    { title: 'Minimo', dataIndex: 'stock_minimo', key: 'stock_minimo', width: 90, align: 'center', sorter: (a, b) => a.stock_minimo - b.stock_minimo },
    { title: 'Maximo', dataIndex: 'stock_maximo', key: 'stock_maximo', width: 90, align: 'center', sorter: (a, b) => a.stock_maximo - b.stock_maximo },
    { title: 'Sugerido', dataIndex: 'cantidad_sugerida', key: 'cantidad_sugerida', width: 100, align: 'center', render: (v: number) => <Tag color="blue">{formatNumber(v)}</Tag>, sorter: (a, b) => a.cantidad_sugerida - b.cantidad_sugerida, defaultSortOrder: 'descend' },
    { title: 'Nivel', dataIndex: 'nivel', key: 'nivel', width: 100, align: 'center', render: (v: string) => <Tag color={v === 'sin_stock' ? 'red' : 'orange'}>{v === 'sin_stock' ? 'Sin Stock' : 'Bajo'}</Tag> },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'SKU', dataIndex: 'sku' }, { titulo: 'Producto', dataIndex: 'nombre' },
          { titulo: 'Almacen', dataIndex: 'almacen_nombre' }, { titulo: 'Stock Actual', dataIndex: 'stock_actual', formato: 'numero' },
          { titulo: 'Minimo', dataIndex: 'stock_minimo', formato: 'numero' }, { titulo: 'Maximo', dataIndex: 'stock_maximo', formato: 'numero' },
          { titulo: 'Cantidad Sugerida', dataIndex: 'cantidad_sugerida', formato: 'numero' }, { titulo: 'Nivel', dataIndex: 'nivel' },
        ],
        datos: productos as unknown as Record<string, unknown>[],
        nombreArchivo: `punto-reorden-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Punto Reorden',
        tituloReporte: 'PUNTO DE REORDEN',
        resumen: [{ etiqueta: 'Productos por Reordenar', valor: stats.total, formato: 'numero' }, { etiqueta: 'Criticos (Sin Stock)', valor: stats.criticos, formato: 'numero' }, { etiqueta: 'Total Unidades Sugeridas', valor: stats.totalSugerido, formato: 'numero' }],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><AlertOutlined /> Punto de Reorden</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card><Statistic title="Por Reordenar" value={stats.total} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Criticos (Sin Stock)" value={stats.criticos} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Stock Bajo" value={stats.bajos} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Unidades Sugeridas" value={stats.totalSugerido} valueStyle={{ color: '#1890ff' }} /></Card></Col>
      </Row>
      <Card><Table dataSource={productos} columns={columns} rowKey={(r) => `${r.producto_id}-${r.almacen_nombre}`} scroll={{ x: 900 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} productos` }} /></Card>
    </div>
  )
}
