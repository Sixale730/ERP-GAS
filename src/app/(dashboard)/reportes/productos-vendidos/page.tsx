'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Typography, Spin, Row, Col, Statistic, Input, Space, Button, DatePicker
} from 'antd'
import {
  ArrowLeftOutlined,
  FileExcelOutlined,
  SearchOutlined,
  ShoppingOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useProductosMasVendidos, type ProductoVendidoRow } from '@/lib/hooks/queries/useReportesNuevos'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function ReporteProductosVendidosPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [searchText, setSearchText] = useState('')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: productos = [], isLoading, refetch } = useProductosMasVendidos(fechaDesde, fechaHasta, organizacion?.id)

  const filteredData = useMemo(() => {
    if (!searchText) return productos
    const lower = searchText.toLowerCase()
    return productos.filter(
      p => (p.sku || '').toLowerCase().includes(lower) || (p.nombre || '').toLowerCase().includes(lower)
    )
  }, [productos, searchText])

  const stats = useMemo(() => {
    const productoTop = filteredData.length > 0 ? filteredData[0].nombre : '-'
    const totalUnidades = filteredData.reduce((sum, p) => sum + (p.unidades_vendidas || 0), 0)
    const totalImporte = filteredData.reduce((sum, p) => sum + (p.importe_total || 0), 0)
    return { productoTop, totalUnidades, totalImporte }
  }, [filteredData])

  const columns: ColumnsType<ProductoVendidoRow & { index?: number }> = useMemo(() => [
    {
      title: '#',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_val, _record, idx) => idx + 1,
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      sorter: (a, b) => (a.sku || '').localeCompare(b.sku || ''),
    },
    {
      title: 'Producto',
      dataIndex: 'nombre',
      key: 'nombre',
      width: 250,
      sorter: (a, b) => (a.nombre || '').localeCompare(b.nombre || ''),
    },
    {
      title: 'Unidad',
      dataIndex: 'unidad_medida',
      key: 'unidad_medida',
      width: 100,
      align: 'center',
    },
    {
      title: 'Unidades Vendidas',
      dataIndex: 'unidades_vendidas',
      key: 'unidades_vendidas',
      width: 140,
      align: 'right',
      sorter: (a, b) => (a.unidades_vendidas || 0) - (b.unidades_vendidas || 0),
    },
    {
      title: 'Importe Total',
      dataIndex: 'importe_total',
      key: 'importe_total',
      width: 150,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
      sorter: (a, b) => (a.importe_total || 0) - (b.importe_total || 0),
    },
    {
      title: 'Num Ventas',
      dataIndex: 'num_ventas',
      key: 'num_ventas',
      width: 110,
      align: 'right',
      sorter: (a, b) => (a.num_ventas || 0) - (b.num_ventas || 0),
    },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const { data: freshData } = await refetch()
      const fresh = freshData || []

      const toExport = searchText
        ? fresh.filter(p => {
            const lower = searchText.toLowerCase()
            return (p.sku || '').toLowerCase().includes(lower) || (p.nombre || '').toLowerCase().includes(lower)
          })
        : fresh

      const exportData = toExport.map((item, idx) => ({
        ...item,
        numero: idx + 1,
      }))

      const totalUnidades = exportData.reduce((sum, i) => sum + (i.unidades_vendidas || 0), 0)
      const totalImporte = exportData.reduce((sum, i) => sum + (i.importe_total || 0), 0)

      await exportarExcel({
        columnas: [
          { titulo: '#', dataIndex: 'numero', formato: 'numero' },
          { titulo: 'SKU', dataIndex: 'sku' },
          { titulo: 'Producto', dataIndex: 'nombre' },
          { titulo: 'Unidad', dataIndex: 'unidad_medida' },
          { titulo: 'Unidades Vendidas', dataIndex: 'unidades_vendidas', formato: 'numero' },
          { titulo: 'Importe Total', dataIndex: 'importe_total', formato: 'moneda' },
          { titulo: 'Num Ventas', dataIndex: 'num_ventas', formato: 'numero' },
        ],
        datos: exportData,
        nombreArchivo: `reporte-productos-vendidos-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Productos Vendidos',
        tituloReporte: 'REPORTE DE PRODUCTOS MAS VENDIDOS',
        subtitulo: fechaDesde && fechaHasta
          ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
          : undefined,
        resumen: [
          { etiqueta: 'Total Unidades', valor: totalUnidades, formato: 'numero' },
          { etiqueta: 'Total Importe', valor: totalImporte, formato: 'moneda' },
          { etiqueta: 'Num. Productos', valor: exportData.length, formato: 'numero' },
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            <ShoppingOutlined /> Productos Mas Vendidos
          </Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>
          Exportar Excel
        </Button>
      </div>

      {/* Estadisticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Producto #1"
              value={stats.productoTop}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Unidades Vendidas"
              value={stats.totalUnidades}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Importe"
              value={stats.totalImporte}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabla */}
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker
            value={fechaRange}
            onChange={(dates) => setFechaRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
            format="DD/MM/YYYY"
            placeholder={['Fecha desde', 'Fecha hasta']}
          />
          <Input
            placeholder="Buscar por SKU o nombre"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
        </Space>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} registros`,
          }}
          locale={{ emptyText: 'No hay productos vendidos en el periodo' }}
        />
      </Card>
    </div>
  )
}
