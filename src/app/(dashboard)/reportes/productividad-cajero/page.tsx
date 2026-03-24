'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, IdcardOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useProductividadCajero, type ProductividadCajeroRow } from '@/lib/hooks/queries/useReportesPOS'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function ReporteProductividadCajeroPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([dayjs().startOf('month'), dayjs().endOf('month')])
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null
  const { data: cajeros = [], isLoading } = useProductividadCajero(fechaDesde, fechaHasta, organizacion?.id)

  const stats = useMemo(() => {
    const top = cajeros[0]?.vendedor_nombre || '-'
    const totalCajeros = cajeros.length
    const promedioTurno = cajeros.length > 0 ? cajeros.reduce((s, c) => s + c.ventas_por_turno, 0) / cajeros.length : 0
    const ticketProm = cajeros.length > 0 ? cajeros.reduce((s, c) => s + c.ticket_promedio, 0) / cajeros.length : 0
    return { top, totalCajeros, promedioTurno, ticketProm }
  }, [cajeros])

  const columns: ColumnsType<ProductividadCajeroRow> = useMemo(() => [
    { title: 'Cajero', dataIndex: 'vendedor_nombre', key: 'vendedor_nombre', sorter: (a, b) => a.vendedor_nombre.localeCompare(b.vendedor_nombre) },
    { title: 'Turnos', dataIndex: 'num_turnos', key: 'num_turnos', width: 90, align: 'center' },
    { title: 'Total Ventas', dataIndex: 'total_ventas', key: 'total_ventas', width: 150, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.total_ventas - b.total_ventas, defaultSortOrder: 'descend' },
    { title: 'Tickets', dataIndex: 'num_tickets', key: 'num_tickets', width: 90, align: 'center' },
    { title: 'Ticket Prom.', dataIndex: 'ticket_promedio', key: 'ticket_promedio', width: 130, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.ticket_promedio - b.ticket_promedio },
    { title: 'Venta/Turno', dataIndex: 'ventas_por_turno', key: 'ventas_por_turno', width: 140, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.ventas_por_turno - b.ventas_por_turno },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'Cajero', dataIndex: 'vendedor_nombre' },
          { titulo: 'Turnos', dataIndex: 'num_turnos', formato: 'numero' },
          { titulo: 'Total Ventas', dataIndex: 'total_ventas', formato: 'moneda' },
          { titulo: 'Tickets', dataIndex: 'num_tickets', formato: 'numero' },
          { titulo: 'Ticket Promedio', dataIndex: 'ticket_promedio', formato: 'moneda' },
          { titulo: 'Venta/Turno', dataIndex: 'ventas_por_turno', formato: 'moneda' },
        ],
        datos: cajeros as unknown as Record<string, unknown>[],
        nombreArchivo: `productividad-cajero-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Productividad Cajero',
        tituloReporte: 'PRODUCTIVIDAD POR CAJERO',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [
          { etiqueta: 'Total Cajeros', valor: stats.totalCajeros, formato: 'numero' },
          { etiqueta: 'Promedio Venta/Turno', valor: stats.promedioTurno, formato: 'moneda' },
          { etiqueta: 'Ticket Promedio General', valor: stats.ticketProm, formato: 'moneda' },
        ],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><IdcardOutlined /> Productividad por Cajero</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card><Statistic title="Cajero Top" value={stats.top} valueStyle={{ color: '#52c41a', fontSize: 16 }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Cajeros Activos" value={stats.totalCajeros} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Prom. Venta/Turno" value={stats.promedioTurno} precision={2} prefix="$" valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Ticket Prom. General" value={stats.ticketProm} precision={2} prefix="$" valueStyle={{ color: '#fa8c16' }} /></Card></Col>
      </Row>
      <Card><Space style={{ marginBottom: 16 }}><RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" /></Space>
        <Table dataSource={cajeros} columns={columns} rowKey="vendedor_nombre" scroll={{ x: 700 }} pagination={{ pageSize: 20, showTotal: (t) => `${t} cajeros` }} /></Card>
    </div>
  )
}
