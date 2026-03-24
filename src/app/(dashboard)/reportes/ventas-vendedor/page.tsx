'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, UserOutlined, DollarOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useVentasPorVendedor, type VentaPorVendedorRow } from '@/lib/hooks/queries/useReportesVentas'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function ReporteVentasVendedorPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const modulosActivos: string[] = organizacion?.modulos_activos || []

  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: ventas = [], isLoading } = useVentasPorVendedor(fechaDesde, fechaHasta, organizacion?.id, modulosActivos)

  const stats = useMemo(() => {
    const totalVendido = ventas.reduce((sum, v) => sum + v.total, 0)
    const numVendedores = ventas.length
    const promedioVendedor = numVendedores > 0 ? totalVendido / numVendedores : 0
    const vendedorTop = ventas[0]?.vendedor_nombre || '-'
    return { totalVendido, numVendedores, promedioVendedor, vendedorTop }
  }, [ventas])

  const totalGeneral = useMemo(() => ventas.reduce((s, v) => s + v.total, 0), [ventas])

  const columns: ColumnsType<VentaPorVendedorRow> = useMemo(
    () => [
      {
        title: 'Vendedor',
        dataIndex: 'vendedor_nombre',
        key: 'vendedor_nombre',
        sorter: (a, b) => a.vendedor_nombre.localeCompare(b.vendedor_nombre),
      },
      {
        title: 'Num. Ventas',
        dataIndex: 'num_ventas',
        key: 'num_ventas',
        width: 120,
        align: 'center',
        sorter: (a, b) => a.num_ventas - b.num_ventas,
      },
      {
        title: 'Total Vendido',
        dataIndex: 'total',
        key: 'total',
        width: 160,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
        sorter: (a, b) => a.total - b.total,
        defaultSortOrder: 'descend',
      },
      {
        title: '% del Total',
        key: 'porcentaje',
        width: 110,
        align: 'right',
        render: (_: unknown, record: VentaPorVendedorRow) =>
          totalGeneral > 0 ? `${((record.total / totalGeneral) * 100).toFixed(1)}%` : '0%',
      },
      {
        title: 'Ticket Promedio',
        key: 'ticket_promedio',
        width: 150,
        align: 'right',
        render: (_: unknown, record: VentaPorVendedorRow) =>
          formatMoneySimple(record.num_ventas > 0 ? record.total / record.num_ventas : 0),
        sorter: (a, b) =>
          (a.num_ventas > 0 ? a.total / a.num_ventas : 0) - (b.num_ventas > 0 ? b.total / b.num_ventas : 0),
      },
    ],
    [totalGeneral]
  )

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const exportData = ventas.map((row) => ({
        ...row,
        porcentaje: totalGeneral > 0 ? ((row.total / totalGeneral) * 100).toFixed(1) + '%' : '0%',
        ticket_promedio: row.num_ventas > 0 ? row.total / row.num_ventas : 0,
      }))

      await exportarExcel({
        columnas: [
          { titulo: 'Vendedor', dataIndex: 'vendedor_nombre' },
          { titulo: 'Num. Ventas', dataIndex: 'num_ventas', formato: 'numero' },
          { titulo: 'Total Vendido', dataIndex: 'total', formato: 'moneda' },
          { titulo: '% del Total', dataIndex: 'porcentaje' },
          { titulo: 'Ticket Promedio', dataIndex: 'ticket_promedio', formato: 'moneda' },
        ],
        datos: exportData,
        nombreArchivo: `ventas-por-vendedor-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Ventas por Vendedor',
        tituloReporte: 'REPORTE DE VENTAS POR VENDEDOR',
        subtitulo:
          fechaDesde && fechaHasta
            ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
            : undefined,
        resumen: [
          { etiqueta: 'Total Vendido', valor: stats.totalVendido, formato: 'moneda' },
          { etiqueta: 'Num. Vendedores', valor: stats.numVendedores, formato: 'numero' },
          { etiqueta: 'Promedio por Vendedor', valor: stats.promedioVendedor, formato: 'moneda' },
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
          <Title level={2} style={{ margin: 0 }}><UserOutlined /> Ventas por Vendedor</Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>
          Exportar Excel
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Total Vendido" value={stats.totalVendido} precision={2} prefix="$" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Vendedores Activos" value={stats.numVendedores} prefix={<UserOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Promedio por Vendedor" value={stats.promedioVendedor} precision={2} prefix={<DollarOutlined />} valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <RangePicker
            value={fechaRange}
            onChange={(dates) => setFechaRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
            format="DD/MM/YYYY"
            placeholder={['Fecha desde', 'Fecha hasta']}
          />
        </Space>

        <Table
          dataSource={ventas}
          columns={columns}
          rowKey="vendedor_nombre"
          scroll={{ x: 700 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} vendedores` }}
          locale={{ emptyText: 'No hay ventas en el periodo' }}
        />
      </Card>
    </div>
  )
}
