'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Input, Select, Space, Button
} from 'antd'
import {
  ArrowLeftOutlined,
  FileExcelOutlined,
  SearchOutlined,
  PercentageOutlined,
  TrophyOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMargenUtilidad, type MargenUtilidadRow } from '@/lib/hooks/queries/useReportesNuevos'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography

type MargenRange = 'todos' | 'lt10' | '10-25' | '25-50' | 'gt50'

export default function ReporteMargenUtilidadPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [searchText, setSearchText] = useState('')
  const [margenRange, setMargenRange] = useState<MargenRange>('todos')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const { data: productos = [], isLoading, refetch } = useMargenUtilidad(organizacion?.id)

  const filteredData = useMemo(() => {
    let result = productos

    if (searchText) {
      const lower = searchText.toLowerCase()
      result = result.filter(
        p => (p.sku || '').toLowerCase().includes(lower) || (p.nombre || '').toLowerCase().includes(lower)
      )
    }

    if (margenRange !== 'todos') {
      result = result.filter(p => {
        const m = p.margen_porcentaje || 0
        switch (margenRange) {
          case 'lt10': return m < 10
          case '10-25': return m >= 10 && m <= 25
          case '25-50': return m > 25 && m <= 50
          case 'gt50': return m > 50
          default: return true
        }
      })
    }

    return result
  }, [productos, searchText, margenRange])

  const stats = useMemo(() => {
    const margenPromedio = filteredData.length > 0
      ? filteredData.reduce((sum, p) => sum + (p.margen_porcentaje || 0), 0) / filteredData.length
      : 0
    const productoMasRentable = filteredData.length > 0 ? filteredData[0].nombre : '-'
    const sinPrecio = filteredData.filter(p => !p.precio_venta || p.precio_venta === 0).length
    return { margenPromedio, productoMasRentable, sinPrecio }
  }, [filteredData])

  const columns: ColumnsType<MargenUtilidadRow> = useMemo(() => [
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
      title: 'Costo',
      dataIndex: 'costo_promedio',
      key: 'costo_promedio',
      width: 130,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
      sorter: (a, b) => (a.costo_promedio || 0) - (b.costo_promedio || 0),
    },
    {
      title: 'Precio Venta',
      dataIndex: 'precio_venta',
      key: 'precio_venta',
      width: 130,
      align: 'right',
      render: (val: number | null) => val ? formatMoneySimple(val) : '-',
      sorter: (a, b) => (a.precio_venta || 0) - (b.precio_venta || 0),
    },
    {
      title: 'Margen $',
      dataIndex: 'margen_bruto',
      key: 'margen_bruto',
      width: 130,
      align: 'right',
      render: (val: number) => {
        const color = val >= 0 ? '#52c41a' : '#f5222d'
        return <span style={{ color, fontWeight: 600 }}>{formatMoneySimple(val)}</span>
      },
      sorter: (a, b) => (a.margen_bruto || 0) - (b.margen_bruto || 0),
    },
    {
      title: 'Margen %',
      dataIndex: 'margen_porcentaje',
      key: 'margen_porcentaje',
      width: 120,
      align: 'center',
      render: (val: number) => {
        let color: string
        if (val > 25) color = 'green'
        else if (val >= 10) color = 'orange'
        else color = 'red'
        return <Tag color={color}>{val.toFixed(1)}%</Tag>
      },
      sorter: (a, b) => (a.margen_porcentaje || 0) - (b.margen_porcentaje || 0),
    },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const { data: freshData } = await refetch()
      const fresh = freshData || []

      let toExport = fresh

      if (searchText) {
        const lower = searchText.toLowerCase()
        toExport = toExport.filter(
          p => (p.sku || '').toLowerCase().includes(lower) || (p.nombre || '').toLowerCase().includes(lower)
        )
      }

      if (margenRange !== 'todos') {
        toExport = toExport.filter(p => {
          const m = p.margen_porcentaje || 0
          switch (margenRange) {
            case 'lt10': return m < 10
            case '10-25': return m >= 10 && m <= 25
            case '25-50': return m > 25 && m <= 50
            case 'gt50': return m > 50
            default: return true
          }
        })
      }

      const exportData = toExport.map(item => ({
        ...item,
        margen_porcentaje_fmt: `${(item.margen_porcentaje || 0).toFixed(1)}%`,
      }))

      const margenPromedio = exportData.length > 0
        ? exportData.reduce((sum, i) => sum + (i.margen_porcentaje || 0), 0) / exportData.length
        : 0

      await exportarExcel({
        columnas: [
          { titulo: 'SKU', dataIndex: 'sku' },
          { titulo: 'Producto', dataIndex: 'nombre' },
          { titulo: 'Costo', dataIndex: 'costo_promedio', formato: 'moneda' },
          { titulo: 'Precio Venta', dataIndex: 'precio_venta', formato: 'moneda' },
          { titulo: 'Margen $', dataIndex: 'margen_bruto', formato: 'moneda' },
          { titulo: 'Margen %', dataIndex: 'margen_porcentaje_fmt' },
        ],
        datos: exportData,
        nombreArchivo: `reporte-margen-utilidad-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Margen Utilidad',
        tituloReporte: 'REPORTE DE MARGEN DE UTILIDAD',
        resumen: [
          { etiqueta: 'Margen Promedio', valor: `${margenPromedio.toFixed(1)}%`, formato: 'texto' },
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
            <PercentageOutlined /> Margen de Utilidad
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
              title="Margen Promedio"
              value={stats.margenPromedio}
              precision={1}
              suffix="%"
              prefix={<PercentageOutlined />}
              valueStyle={{ color: stats.margenPromedio >= 25 ? '#52c41a' : stats.margenPromedio >= 10 ? '#faad14' : '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Producto Mas Rentable"
              value={stats.productoMasRentable}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Productos Sin Precio"
              value={stats.sinPrecio}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.sinPrecio > 0 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabla */}
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por SKU o nombre"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="Rango de margen"
            value={margenRange}
            onChange={setMargenRange}
            style={{ width: 180 }}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'lt10', label: '< 10%' },
              { value: '10-25', label: '10% - 25%' },
              { value: '25-50', label: '25% - 50%' },
              { value: 'gt50', label: '> 50%' },
            ]}
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
          locale={{ emptyText: 'No hay datos de margen de utilidad' }}
        />
      </Card>
    </div>
  )
}
