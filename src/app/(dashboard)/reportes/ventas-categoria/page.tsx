'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, AppstoreOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useVentasPorCategoria, type VentaPorCategoriaRow } from '@/lib/hooks/queries/useReportesVentas'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple, formatNumber } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function ReporteVentasCategoriaPage() {
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

  const { data: ventas = [], isLoading } = useVentasPorCategoria(fechaDesde, fechaHasta, organizacion?.id, modulosActivos)

  const stats = useMemo(() => {
    const totalVendido = ventas.reduce((sum, v) => sum + v.total, 0)
    const numCategorias = ventas.length
    const categoriaTop = ventas[0]?.categoria_nombre || '-'
    const top3 = ventas.slice(0, 3).reduce((s, v) => s + v.total, 0)
    const concentracionTop3 = totalVendido > 0 ? (top3 / totalVendido) * 100 : 0
    return { totalVendido, numCategorias, categoriaTop, concentracionTop3 }
  }, [ventas])

  const totalGeneral = useMemo(() => ventas.reduce((s, v) => s + v.total, 0), [ventas])

  const columns: ColumnsType<VentaPorCategoriaRow> = useMemo(
    () => [
      {
        title: 'Categoria',
        dataIndex: 'categoria_nombre',
        key: 'categoria_nombre',
        sorter: (a, b) => a.categoria_nombre.localeCompare(b.categoria_nombre),
      },
      {
        title: 'Unidades Vendidas',
        dataIndex: 'unidades_vendidas',
        key: 'unidades_vendidas',
        width: 150,
        align: 'center',
        render: (val: number) => formatNumber(val),
        sorter: (a, b) => a.unidades_vendidas - b.unidades_vendidas,
      },
      {
        title: 'Productos Distintos',
        dataIndex: 'num_productos_distintos',
        key: 'num_productos_distintos',
        width: 160,
        align: 'center',
        sorter: (a, b) => a.num_productos_distintos - b.num_productos_distintos,
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
        render: (_: unknown, record: VentaPorCategoriaRow) =>
          totalGeneral > 0 ? `${((record.total / totalGeneral) * 100).toFixed(1)}%` : '0%',
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
      }))

      await exportarExcel({
        columnas: [
          { titulo: 'Categoria', dataIndex: 'categoria_nombre' },
          { titulo: 'Unidades Vendidas', dataIndex: 'unidades_vendidas', formato: 'numero' },
          { titulo: 'Productos Distintos', dataIndex: 'num_productos_distintos', formato: 'numero' },
          { titulo: 'Total Vendido', dataIndex: 'total', formato: 'moneda' },
          { titulo: '% del Total', dataIndex: 'porcentaje' },
        ],
        datos: exportData,
        nombreArchivo: `ventas-por-categoria-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Ventas por Categoria',
        tituloReporte: 'REPORTE DE VENTAS POR CATEGORIA',
        subtitulo:
          fechaDesde && fechaHasta
            ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
            : undefined,
        resumen: [
          { etiqueta: 'Total Vendido', valor: stats.totalVendido, formato: 'moneda' },
          { etiqueta: 'Num. Categorias', valor: stats.numCategorias, formato: 'numero' },
          { etiqueta: 'Concentracion Top 3 (%)', valor: stats.concentracionTop3, formato: 'numero' },
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
          <Title level={2} style={{ margin: 0 }}><AppstoreOutlined /> Ventas por Categoria</Title>
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
          <Card><Statistic title="Categorias Activas" value={stats.numCategorias} prefix={<AppstoreOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Concentracion Top 3" value={stats.concentracionTop3} precision={1} suffix="%" valueStyle={{ color: '#722ed1' }} /></Card>
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
          rowKey={(r) => r.categoria_id || 'sin-cat'}
          scroll={{ x: 700 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} categorias` }}
          locale={{ emptyText: 'No hay ventas en el periodo' }}
        />
      </Card>
    </div>
  )
}
