'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Select } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, TeamOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useABCClientes, type ABCClienteRow } from '@/lib/hooks/queries/useReportesFinanzas'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

const ABC_COLOR = { A: 'green', B: 'blue', C: 'orange' } as const

export default function ReporteABCClientesPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const modulosActivos: string[] = organizacion?.modulos_activos || []
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([dayjs().startOf('year'), dayjs().endOf('month')])
  const [clasFilter, setClasFilter] = useState<string | null>(null)
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null
  const { data: clientes = [], isLoading } = useABCClientes(fechaDesde, fechaHasta, organizacion?.id, modulosActivos)

  const filteredData = useMemo(() => clasFilter ? clientes.filter((c) => c.clasificacion === clasFilter) : clientes, [clientes, clasFilter])

  const stats = useMemo(() => {
    const a = clientes.filter((c) => c.clasificacion === 'A').length
    const b = clientes.filter((c) => c.clasificacion === 'B').length
    const c = clientes.filter((c) => c.clasificacion === 'C').length
    const totalA = clientes.filter((c) => c.clasificacion === 'A').reduce((s, r) => s + r.total_comprado, 0)
    return { a, b, c, totalA, total: clientes.length }
  }, [clientes])

  const columns: ColumnsType<ABCClienteRow> = useMemo(() => [
    { title: '#', dataIndex: 'ranking', key: 'ranking', width: 60, align: 'center' },
    { title: 'Cliente', dataIndex: 'cliente_nombre', key: 'cliente_nombre', ellipsis: true },
    { title: 'Total Comprado', dataIndex: 'total_comprado', key: 'total_comprado', width: 160, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.total_comprado - b.total_comprado },
    { title: '% del Total', dataIndex: 'porcentaje', key: 'porcentaje', width: 110, align: 'right', render: (v: number) => `${v}%` },
    { title: '% Acumulado', dataIndex: 'acumulado', key: 'acumulado', width: 120, align: 'right', render: (v: number) => `${v}%` },
    { title: 'Clase', dataIndex: 'clasificacion', key: 'clasificacion', width: 80, align: 'center', render: (v: 'A' | 'B' | 'C') => <Tag color={ABC_COLOR[v]}>{v}</Tag> },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: '#', dataIndex: 'ranking', formato: 'numero' },
          { titulo: 'Cliente', dataIndex: 'cliente_nombre' },
          { titulo: 'Total Comprado', dataIndex: 'total_comprado', formato: 'moneda' },
          { titulo: '% del Total', dataIndex: 'porcentaje_fmt' },
          { titulo: '% Acumulado', dataIndex: 'acumulado_fmt' },
          { titulo: 'Clasificacion', dataIndex: 'clasificacion' },
        ],
        datos: filteredData.map((r) => ({ ...r, porcentaje_fmt: `${r.porcentaje}%`, acumulado_fmt: `${r.acumulado}%` })),
        nombreArchivo: `abc-clientes-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'ABC Clientes',
        tituloReporte: 'ANALISIS ABC DE CLIENTES (PARETO)',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [
          { etiqueta: 'Clientes A', valor: stats.a, formato: 'numero' },
          { etiqueta: 'Clientes B', valor: stats.b, formato: 'numero' },
          { etiqueta: 'Clientes C', valor: stats.c, formato: 'numero' },
          { etiqueta: 'Valor Clientes A', valor: stats.totalA, formato: 'moneda' },
        ],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><TeamOutlined /> ABC de Clientes</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card><Statistic title="Clase A (80%)" value={stats.a} suffix={` de ${stats.total}`} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Clase B (15%)" value={stats.b} suffix={` de ${stats.total}`} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Clase C (5%)" value={stats.c} suffix={` de ${stats.total}`} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Valor Clase A" value={stats.totalA} precision={2} prefix="$" valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" />
          <Select placeholder="Todas las clases" value={clasFilter} onChange={setClasFilter} style={{ width: 160 }} allowClear options={[{ value: 'A', label: 'Clase A' }, { value: 'B', label: 'Clase B' }, { value: 'C', label: 'Clase C' }]} />
        </Space>
        <Table dataSource={filteredData} columns={columns} rowKey="cliente_id" scroll={{ x: 700 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} clientes` }} />
      </Card>
    </div>
  )
}
