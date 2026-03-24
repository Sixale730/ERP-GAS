'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Typography, Spin, Row, Col, Statistic, Space, Button, Select, Input } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, ReconciliationOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useConciliacionInventario, type ConciliacionRow } from '@/lib/hooks/queries/useReportesInventario'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatNumber } from '@/lib/utils/format'
import { getSupabaseClient } from '@/lib/supabase/client'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Search } = Input

interface AlmacenOption { id: string; nombre: string }

export default function ReporteConciliacionPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [almacenId, setAlmacenId] = useState<string | null>(null)
  const [almacenes, setAlmacenes] = useState<AlmacenOption[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  useEffect(() => {
    async function load() {
      if (!organizacion?.id) return
      const supabase = getSupabaseClient()
      const { data } = await supabase.schema('erp').from('almacenes').select('id, nombre').eq('organizacion_id', organizacion.id).eq('is_active', true).order('nombre')
      setAlmacenes(data || [])
    }
    load()
  }, [organizacion?.id])

  const { data: items = [], isLoading } = useConciliacionInventario(almacenId, organizacion?.id)

  const filteredData = useMemo(() => {
    if (!busqueda.trim()) return items
    const term = busqueda.toLowerCase()
    return items.filter((i) => i.sku.toLowerCase().includes(term) || i.nombre.toLowerCase().includes(term))
  }, [items, busqueda])

  const stats = useMemo(() => {
    const total = filteredData.length
    const totalUnidades = filteredData.reduce((s, r) => s + r.cantidad_sistema, 0)
    return { total, totalUnidades }
  }, [filteredData])

  const columns: ColumnsType<ConciliacionRow> = useMemo(() => [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120, sorter: (a, b) => a.sku.localeCompare(b.sku) },
    { title: 'Producto', dataIndex: 'nombre', key: 'nombre', ellipsis: true },
    { title: 'Almacen', dataIndex: 'almacen_nombre', key: 'almacen_nombre', width: 140 },
    { title: 'Unidad', dataIndex: 'unidad_medida', key: 'unidad_medida', width: 90, align: 'center' },
    { title: 'Cant. Sistema', dataIndex: 'cantidad_sistema', key: 'cantidad_sistema', width: 120, align: 'center', render: (v: number) => formatNumber(v) },
    { title: 'Cant. Fisica', key: 'cantidad_fisica', width: 120, align: 'center', render: () => <Text type="secondary">—</Text> },
    { title: 'Diferencia', key: 'diferencia', width: 110, align: 'center', render: () => <Text type="secondary">—</Text> },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'SKU', dataIndex: 'sku' }, { titulo: 'Producto', dataIndex: 'nombre' },
          { titulo: 'Almacen', dataIndex: 'almacen_nombre' }, { titulo: 'Unidad', dataIndex: 'unidad_medida' },
          { titulo: 'Cantidad Sistema', dataIndex: 'cantidad_sistema', formato: 'numero' },
          { titulo: 'Cantidad Fisica', dataIndex: 'cantidad_fisica' }, { titulo: 'Diferencia', dataIndex: 'diferencia' },
        ],
        datos: filteredData.map((r) => ({ ...r, cantidad_fisica: '', diferencia: '' })),
        nombreArchivo: `conciliacion-inventario-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Conciliacion',
        tituloReporte: 'CONCILIACION DE INVENTARIO FISICO',
        subtitulo: almacenId ? `Almacen: ${almacenes.find((a) => a.id === almacenId)?.nombre || ''}` : 'Todos los almacenes',
        resumen: [{ etiqueta: 'Total Productos', valor: stats.total, formato: 'numero' }, { etiqueta: 'Total Unidades Sistema', valor: stats.totalUnidades, formato: 'numero' }],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><ReconciliationOutlined /> Conciliacion Fisica</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}><Card><Statistic title="Productos en Inventario" value={stats.total} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={12}><Card><Statistic title="Total Unidades (Sistema)" value={stats.totalUnidades} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select placeholder="Seleccionar almacen" value={almacenId} onChange={setAlmacenId} style={{ width: 220 }} allowClear options={almacenes.map((a) => ({ value: a.id, label: a.nombre }))} />
          <Search placeholder="Buscar SKU o producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 250 }} />
        </Space>
        <div style={{ background: '#fffbe6', padding: '8px 16px', borderRadius: 4, marginBottom: 16, border: '1px solid #ffe58f' }}>
          <Text type="warning">Exporta a Excel para llenar las columnas Cantidad Fisica y Diferencia durante el conteo.</Text>
        </div>
        <Table dataSource={filteredData} columns={columns} rowKey={(r) => `${r.producto_id}-${r.almacen_nombre}`} scroll={{ x: 800 }} pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `${t} productos` }} />
      </Card>
    </div>
  )
}
