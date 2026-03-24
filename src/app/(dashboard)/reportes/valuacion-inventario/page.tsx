'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Typography, Spin, Row, Col, Statistic, Space, Button, Select, Input } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, AccountBookOutlined, InboxOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useValuacionInventario, type ValuacionInventarioRow } from '@/lib/hooks/queries/useReportesInventario'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple, formatNumber } from '@/lib/utils/format'
import { getSupabaseClient } from '@/lib/supabase/client'
import dayjs from 'dayjs'

const { Title } = Typography
const { Search } = Input

interface AlmacenOption {
  id: string
  nombre: string
}

export default function ReporteValuacionInventarioPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [almacenId, setAlmacenId] = useState<string | null>(null)
  const [almacenes, setAlmacenes] = useState<AlmacenOption[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  // Cargar almacenes
  useEffect(() => {
    async function load() {
      if (!organizacion?.id) return
      const supabase = getSupabaseClient()
      const { data } = await supabase
        .schema('erp')
        .from('almacenes')
        .select('id, nombre')
        .eq('organizacion_id', organizacion.id)
        .eq('is_active', true)
        .order('nombre')
      setAlmacenes(data || [])
    }
    load()
  }, [organizacion?.id])

  const { data: inventario = [], isLoading } = useValuacionInventario(almacenId, organizacion?.id)

  const filteredData = useMemo(() => {
    if (!busqueda.trim()) return inventario
    const term = busqueda.toLowerCase()
    return inventario.filter(
      (r) => r.sku.toLowerCase().includes(term) || r.nombre.toLowerCase().includes(term)
    )
  }, [inventario, busqueda])

  const stats = useMemo(() => {
    const valorTotal = filteredData.reduce((s, r) => s + r.valor_total, 0)
    const numProductos = filteredData.length
    const valorPromedio = numProductos > 0 ? valorTotal / numProductos : 0
    const totalUnidades = filteredData.reduce((s, r) => s + r.cantidad, 0)
    return { valorTotal, numProductos, valorPromedio, totalUnidades }
  }, [filteredData])

  const valorGeneral = useMemo(() => inventario.reduce((s, r) => s + r.valor_total, 0), [inventario])

  const columns: ColumnsType<ValuacionInventarioRow> = useMemo(
    () => [
      {
        title: 'SKU',
        dataIndex: 'sku',
        key: 'sku',
        width: 120,
        sorter: (a, b) => a.sku.localeCompare(b.sku),
      },
      {
        title: 'Producto',
        dataIndex: 'nombre',
        key: 'nombre',
        ellipsis: true,
        sorter: (a, b) => a.nombre.localeCompare(b.nombre),
      },
      {
        title: 'Almacen',
        dataIndex: 'almacen_nombre',
        key: 'almacen_nombre',
        width: 140,
      },
      {
        title: 'Cantidad',
        dataIndex: 'cantidad',
        key: 'cantidad',
        width: 100,
        align: 'center',
        render: (val: number) => formatNumber(val),
        sorter: (a, b) => a.cantidad - b.cantidad,
      },
      {
        title: 'Costo Unitario',
        dataIndex: 'costo_unitario',
        key: 'costo_unitario',
        width: 140,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
        sorter: (a, b) => a.costo_unitario - b.costo_unitario,
      },
      {
        title: 'Valor Total',
        dataIndex: 'valor_total',
        key: 'valor_total',
        width: 160,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
        sorter: (a, b) => a.valor_total - b.valor_total,
        defaultSortOrder: 'descend',
      },
      {
        title: '% del Total',
        key: 'porcentaje',
        width: 110,
        align: 'right',
        render: (_: unknown, record: ValuacionInventarioRow) =>
          valorGeneral > 0 ? `${((record.valor_total / valorGeneral) * 100).toFixed(1)}%` : '0%',
      },
    ],
    [valorGeneral]
  )

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const exportData = filteredData.map((row) => ({
        ...row,
        porcentaje: valorGeneral > 0 ? ((row.valor_total / valorGeneral) * 100).toFixed(1) + '%' : '0%',
      }))

      await exportarExcel({
        columnas: [
          { titulo: 'SKU', dataIndex: 'sku' },
          { titulo: 'Producto', dataIndex: 'nombre' },
          { titulo: 'Almacen', dataIndex: 'almacen_nombre' },
          { titulo: 'Cantidad', dataIndex: 'cantidad', formato: 'numero' },
          { titulo: 'Costo Unitario', dataIndex: 'costo_unitario', formato: 'moneda' },
          { titulo: 'Valor Total', dataIndex: 'valor_total', formato: 'moneda' },
          { titulo: '% del Total', dataIndex: 'porcentaje' },
        ],
        datos: exportData,
        nombreArchivo: `valuacion-inventario-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Valuacion Inventario',
        tituloReporte: 'REPORTE DE VALUACION DE INVENTARIO',
        subtitulo: almacenId
          ? `Almacen: ${almacenes.find((a) => a.id === almacenId)?.nombre || ''}`
          : 'Todos los almacenes',
        resumen: [
          { etiqueta: 'Valor Total', valor: stats.valorTotal, formato: 'moneda' },
          { etiqueta: 'Num. Productos', valor: stats.numProductos, formato: 'numero' },
          { etiqueta: 'Total Unidades', valor: stats.totalUnidades, formato: 'numero' },
          { etiqueta: 'Valor Promedio', valor: stats.valorPromedio, formato: 'moneda' },
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
          <Title level={2} style={{ margin: 0 }}><AccountBookOutlined /> Valuacion de Inventario</Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>
          Exportar Excel
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Valor Total" value={stats.valorTotal} precision={2} prefix="$" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Productos en Stock" value={stats.numProductos} prefix={<InboxOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Total Unidades" value={stats.totalUnidades} valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Valor Promedio" value={stats.valorPromedio} precision={2} prefix="$" valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="Todos los almacenes"
            value={almacenId}
            onChange={setAlmacenId}
            style={{ width: 220 }}
            allowClear
            options={almacenes.map((a) => ({ value: a.id, label: a.nombre }))}
          />
          <Search placeholder="Buscar SKU o producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 250 }} />
        </Space>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey={(r) => `${r.producto_id}-${r.almacen_id}`}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} items` }}
          locale={{ emptyText: 'No hay inventario' }}
          summary={() => {
            if (filteredData.length === 0) return null
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}><strong>TOTAL</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="center"><strong>{formatNumber(stats.totalUnidades)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right" />
                  <Table.Summary.Cell index={5} align="right"><strong>{formatMoneySimple(stats.valorTotal)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right"><strong>100%</strong></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )
          }}
        />
      </Card>
    </div>
  )
}
