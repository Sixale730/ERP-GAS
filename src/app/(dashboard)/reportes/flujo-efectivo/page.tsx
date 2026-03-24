'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, FundOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useFlujoEfectivo, type FlujoEfectivoRow } from '@/lib/hooks/queries/useReportesFinanzas'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function ReporteFlujoEfectivoPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([dayjs().startOf('year'), dayjs().endOf('month')])
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null
  const { data: rows = [], isLoading } = useFlujoEfectivo(fechaDesde, fechaHasta, organizacion?.id)

  const stats = useMemo(() => {
    const totalIng = rows.reduce((s, r) => s + r.ingresos, 0)
    const totalEgr = rows.reduce((s, r) => s + r.egresos, 0)
    const neto = totalIng - totalEgr
    return { totalIng, totalEgr, neto }
  }, [rows])

  const columns: ColumnsType<FlujoEfectivoRow> = useMemo(() => [
    { title: 'Periodo', dataIndex: 'periodo_label', key: 'periodo_label', width: 160 },
    { title: 'Ingresos', dataIndex: 'ingresos', key: 'ingresos', width: 150, align: 'right', render: (v: number) => <Text style={{ color: '#52c41a' }}>{formatMoneySimple(v)}</Text> },
    { title: 'Egresos', dataIndex: 'egresos', key: 'egresos', width: 150, align: 'right', render: (v: number) => <Text style={{ color: '#f5222d' }}>{formatMoneySimple(v)}</Text> },
    { title: 'Flujo Neto', dataIndex: 'neto', key: 'neto', width: 150, align: 'right', render: (v: number) => <Text strong style={{ color: v >= 0 ? '#52c41a' : '#f5222d' }}>{v >= 0 ? '+' : ''}{formatMoneySimple(v)}</Text> },
    { title: 'Acumulado', dataIndex: 'acumulado', key: 'acumulado', width: 150, align: 'right', render: (v: number) => <Text style={{ color: v >= 0 ? '#1890ff' : '#f5222d' }}>{formatMoneySimple(v)}</Text> },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'Periodo', dataIndex: 'periodo_label' },
          { titulo: 'Ingresos', dataIndex: 'ingresos', formato: 'moneda' },
          { titulo: 'Egresos', dataIndex: 'egresos', formato: 'moneda' },
          { titulo: 'Flujo Neto', dataIndex: 'neto', formato: 'moneda' },
          { titulo: 'Acumulado', dataIndex: 'acumulado', formato: 'moneda' },
        ],
        datos: rows as unknown as Record<string, unknown>[],
        nombreArchivo: `flujo-efectivo-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Flujo de Efectivo',
        tituloReporte: 'REPORTE DE FLUJO DE EFECTIVO',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [
          { etiqueta: 'Total Ingresos', valor: stats.totalIng, formato: 'moneda' },
          { etiqueta: 'Total Egresos', valor: stats.totalEgr, formato: 'moneda' },
          { etiqueta: 'Flujo Neto', valor: stats.neto, formato: 'moneda' },
        ],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><FundOutlined /> Flujo de Efectivo</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card><Statistic title="Total Ingresos" value={stats.totalIng} precision={2} prefix="$" valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Total Egresos" value={stats.totalEgr} precision={2} prefix="$" valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Flujo Neto" value={stats.neto} precision={2} prefix={stats.neto >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} valueStyle={{ color: stats.neto >= 0 ? '#52c41a' : '#f5222d' }} /></Card></Col>
      </Row>
      <Card>
        <Space style={{ marginBottom: 16 }}><RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" /></Space>
        <Table dataSource={rows} columns={columns} rowKey="periodo" pagination={false} scroll={{ x: 700 }} locale={{ emptyText: 'No hay datos en el periodo' }} />
      </Card>
    </div>
  )
}
