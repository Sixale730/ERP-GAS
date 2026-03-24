'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, FieldTimeOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAnalisisHorarios, type HorarioVentaRow } from '@/lib/hooks/queries/useReportesPOS'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function ReporteAnalisisHorariosPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([dayjs().startOf('month'), dayjs().endOf('month')])
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null
  const { data: rows = [], isLoading } = useAnalisisHorarios(fechaDesde, fechaHasta, organizacion?.id)

  const stats = useMemo(() => {
    if (rows.length === 0) return { horaPico: '-', horaMenos: '-', ventasPico: 0, totalTrans: 0 }
    const sorted = [...rows].sort((a, b) => b.total_ventas - a.total_ventas)
    const horaPico = sorted[0]?.hora_label || '-'
    const horaMenos = sorted[sorted.length - 1]?.hora_label || '-'
    const ventasPico = sorted[0]?.total_ventas || 0
    const totalTrans = rows.reduce((s, r) => s + r.num_transacciones, 0)
    return { horaPico, horaMenos, ventasPico, totalTrans }
  }, [rows])

  const maxVenta = useMemo(() => Math.max(...rows.map((r) => r.total_ventas), 1), [rows])

  const columns: ColumnsType<HorarioVentaRow> = useMemo(() => [
    { title: 'Hora', dataIndex: 'hora_label', key: 'hora_label', width: 150, sorter: (a, b) => a.hora - b.hora },
    { title: 'Transacciones', dataIndex: 'num_transacciones', key: 'num_transacciones', width: 130, align: 'center', sorter: (a, b) => a.num_transacciones - b.num_transacciones },
    { title: 'Total Ventas', dataIndex: 'total_ventas', key: 'total_ventas', width: 150, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.total_ventas - b.total_ventas, defaultSortOrder: 'descend' },
    { title: 'Ticket Promedio', dataIndex: 'ticket_promedio', key: 'ticket_promedio', width: 140, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.ticket_promedio - b.ticket_promedio },
    {
      title: 'Intensidad', key: 'intensidad', width: 200,
      render: (_: unknown, r: HorarioVentaRow) => {
        const pct = (r.total_ventas / maxVenta) * 100
        const color = pct >= 70 ? '#f5222d' : pct >= 40 ? '#fa8c16' : '#52c41a'
        return <div style={{ background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${pct}%`, background: color, height: 20, borderRadius: 4 }} /></div>
      },
    },
  ], [maxVenta])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'Hora', dataIndex: 'hora_label' },
          { titulo: 'Transacciones', dataIndex: 'num_transacciones', formato: 'numero' },
          { titulo: 'Total Ventas', dataIndex: 'total_ventas', formato: 'moneda' },
          { titulo: 'Ticket Promedio', dataIndex: 'ticket_promedio', formato: 'moneda' },
        ],
        datos: rows as unknown as Record<string, unknown>[],
        nombreArchivo: `analisis-horarios-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Analisis Horarios',
        tituloReporte: 'ANALISIS DE HORARIOS DE VENTA',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [{ etiqueta: 'Hora Pico', valor: stats.horaPico as unknown as number }, { etiqueta: 'Total Transacciones', valor: stats.totalTrans, formato: 'numero' }, { etiqueta: 'Ventas Hora Pico', valor: stats.ventasPico, formato: 'moneda' }],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><FieldTimeOutlined /> Analisis de Horarios</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card><Statistic title="Hora Pico" value={stats.horaPico} valueStyle={{ color: '#f5222d', fontSize: 16 }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Hora Menos Activa" value={stats.horaMenos} valueStyle={{ color: '#52c41a', fontSize: 16 }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Ventas Hora Pico" value={stats.ventasPico} precision={2} prefix="$" valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Total Transacciones" value={stats.totalTrans} valueStyle={{ color: '#1890ff' }} /></Card></Col>
      </Row>
      <Card><Space style={{ marginBottom: 16 }}><RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" /></Space>
        <Table dataSource={rows} columns={columns} rowKey="hora" pagination={false} scroll={{ x: 700 }} /></Card>
    </div>
  )
}
