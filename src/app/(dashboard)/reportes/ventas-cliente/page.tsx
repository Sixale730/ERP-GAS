'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Input } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, TeamOutlined, DollarOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useVentasPorCliente, type VentaPorClienteRow } from '@/lib/hooks/queries/useReportesVentas'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Search } = Input

export default function ReporteVentasClientePage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const modulosActivos: string[] = organizacion?.modulos_activos || []

  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [busqueda, setBusqueda] = useState('')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: ventas = [], isLoading } = useVentasPorCliente(fechaDesde, fechaHasta, organizacion?.id, modulosActivos)

  const filteredData = useMemo(() => {
    if (!busqueda.trim()) return ventas
    const term = busqueda.toLowerCase()
    return ventas.filter((v) => v.cliente_nombre.toLowerCase().includes(term))
  }, [ventas, busqueda])

  const stats = useMemo(() => {
    const totalVendido = filteredData.reduce((sum, v) => sum + v.total, 0)
    const numClientes = filteredData.length
    const ticketPromedio = numClientes > 0 ? totalVendido / numClientes : 0
    const clienteTop = filteredData[0]?.cliente_nombre || '-'
    return { totalVendido, numClientes, ticketPromedio, clienteTop }
  }, [filteredData])

  const totalGeneral = useMemo(() => ventas.reduce((s, v) => s + v.total, 0), [ventas])

  const columns: ColumnsType<VentaPorClienteRow> = useMemo(
    () => [
      {
        title: 'Cliente',
        dataIndex: 'cliente_nombre',
        key: 'cliente_nombre',
        sorter: (a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre),
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
        title: 'Subtotal',
        dataIndex: 'subtotal',
        key: 'subtotal',
        width: 140,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
        sorter: (a, b) => a.subtotal - b.subtotal,
      },
      {
        title: 'IVA',
        dataIndex: 'iva',
        key: 'iva',
        width: 120,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
      },
      {
        title: 'Total',
        dataIndex: 'total',
        key: 'total',
        width: 150,
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
        render: (_: unknown, record: VentaPorClienteRow) =>
          totalGeneral > 0 ? `${((record.total / totalGeneral) * 100).toFixed(1)}%` : '0%',
        sorter: (a, b) => a.total - b.total,
      },
    ],
    [totalGeneral]
  )

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const exportData = filteredData.map((row) => ({
        ...row,
        porcentaje: totalGeneral > 0 ? ((row.total / totalGeneral) * 100).toFixed(1) + '%' : '0%',
      }))

      await exportarExcel({
        columnas: [
          { titulo: 'Cliente', dataIndex: 'cliente_nombre' },
          { titulo: 'Num. Ventas', dataIndex: 'num_ventas', formato: 'numero' },
          { titulo: 'Subtotal', dataIndex: 'subtotal', formato: 'moneda' },
          { titulo: 'IVA', dataIndex: 'iva', formato: 'moneda' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
          { titulo: '% del Total', dataIndex: 'porcentaje' },
        ],
        datos: exportData,
        nombreArchivo: `ventas-por-cliente-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Ventas por Cliente',
        tituloReporte: 'REPORTE DE VENTAS POR CLIENTE',
        subtitulo:
          fechaDesde && fechaHasta
            ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
            : undefined,
        resumen: [
          { etiqueta: 'Total Vendido', valor: stats.totalVendido, formato: 'moneda' },
          { etiqueta: 'Num. Clientes', valor: stats.numClientes, formato: 'numero' },
          { etiqueta: 'Promedio por Cliente', valor: stats.ticketPromedio, formato: 'moneda' },
        ],
      })
    } finally {
      setGenerandoExcel(false)
    }
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button>
          <Title level={2} style={{ margin: 0 }}><TeamOutlined /> Ventas por Cliente</Title>
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
          <Card><Statistic title="Num. Clientes" value={stats.numClientes} prefix={<TeamOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Promedio por Cliente" value={stats.ticketPromedio} precision={2} prefix={<DollarOutlined />} valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker
            value={fechaRange}
            onChange={(dates) => setFechaRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
            format="DD/MM/YYYY"
            placeholder={['Fecha desde', 'Fecha hasta']}
          />
          <Search placeholder="Buscar cliente..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 250 }} />
        </Space>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="cliente_id"
          scroll={{ x: 800 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} clientes` }}
          locale={{ emptyText: 'No hay ventas en el periodo' }}
          summary={() => {
            if (filteredData.length === 0) return null
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><strong>TOTAL</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="center"><strong>{filteredData.reduce((s, r) => s + r.num_ventas, 0)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right"><strong>{formatMoneySimple(filteredData.reduce((s, r) => s + r.subtotal, 0))}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right"><strong>{formatMoneySimple(filteredData.reduce((s, r) => s + r.iva, 0))}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right"><strong>{formatMoneySimple(filteredData.reduce((s, r) => s + r.total, 0))}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right"><strong>100%</strong></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )
          }}
        />
      </Card>
    </div>
  )
}
