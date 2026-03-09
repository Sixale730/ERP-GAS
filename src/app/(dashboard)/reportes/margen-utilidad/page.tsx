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
  DollarOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMargenUtilidad, type MargenUtilidadRow } from '@/lib/hooks/queries/useReportesNuevos'
import { useTipoCambioBanxico } from '@/lib/hooks/queries/useTipoCambioBanxico'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title, Text } = Typography

type MargenRange = 'todos' | 'lt10' | '10-25' | '25-50' | 'gt50'

interface MargenUtilidadProcessed extends MargenUtilidadRow {
  precio_convertido_mxn: number | null
}

function convertirMargen(
  row: MargenUtilidadRow,
  tipoCambio: number | null
): MargenUtilidadProcessed {
  const moneda = row.moneda_precio || 'MXN'

  // MXN: usar valores de la vista tal cual
  if (moneda === 'MXN') {
    return { ...row, precio_convertido_mxn: row.precio_venta }
  }

  // USD sin tipo de cambio: no se puede calcular
  if (!tipoCambio || !row.precio_venta) {
    return {
      ...row,
      precio_convertido_mxn: null,
      margen_bruto: null,
      margen_porcentaje: null,
    }
  }

  // USD con tipo de cambio: convertir y recalcular
  const precioMXN = row.precio_venta * tipoCambio
  const costo = row.costo_promedio || 0

  if (costo <= 0) {
    return { ...row, precio_convertido_mxn: precioMXN, margen_bruto: null, margen_porcentaje: null }
  }

  const margenBruto = precioMXN - costo
  const margenPorcentaje = precioMXN > 0
    ? Math.round((precioMXN - costo) / precioMXN * 10000) / 100
    : null

  return {
    ...row,
    precio_convertido_mxn: precioMXN,
    margen_bruto: margenBruto,
    margen_porcentaje: margenPorcentaje,
  }
}

export default function ReporteMargenUtilidadPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [searchText, setSearchText] = useState('')
  const [margenRange, setMargenRange] = useState<MargenRange>('todos')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const { data: productos = [], isLoading, refetch } = useMargenUtilidad(organizacion?.id)
  const { data: tcData, isLoading: tcLoading } = useTipoCambioBanxico()
  const tipoCambio = tcData?.tipo_cambio ?? null

  // Recalcular márgenes con conversión de moneda
  const datosConvertidos = useMemo(() => {
    return productos.map(p => convertirMargen(p, tipoCambio))
  }, [productos, tipoCambio])

  const hayProductosUSD = useMemo(() => {
    return datosConvertidos.some(p => p.moneda_precio === 'USD')
  }, [datosConvertidos])

  const filteredData = useMemo(() => {
    let result = datosConvertidos

    if (searchText) {
      const lower = searchText.toLowerCase()
      result = result.filter(
        p => (p.sku || '').toLowerCase().includes(lower) || (p.nombre || '').toLowerCase().includes(lower)
      )
    }

    if (margenRange !== 'todos') {
      result = result.filter(p => {
        const m = p.margen_porcentaje ?? null
        if (m == null) return margenRange === 'lt10' // sin margen → menor a 10
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
  }, [datosConvertidos, searchText, margenRange])

  const stats = useMemo(() => {
    // Solo productos con margen calculable (conversión posible)
    const conMargen = filteredData.filter(p => p.margen_porcentaje != null && (p.costo_promedio || 0) > 0 && (p.precio_convertido_mxn || 0) > 0)
    const margenPromedio = conMargen.length > 0
      ? conMargen.reduce((sum, p) => sum + (p.margen_porcentaje ?? 0), 0) / conMargen.length
      : 0
    const productoMasRentable = conMargen.length > 0
      ? conMargen.reduce((best, p) => (p.margen_porcentaje ?? 0) > (best.margen_porcentaje ?? 0) ? p : best).nombre
      : '-'
    const conMargenNegativo = conMargen.filter(p => (p.margen_porcentaje ?? 0) < 0).length
    return { margenPromedio, productoMasRentable, conMargenNegativo, totalConMargen: conMargen.length }
  }, [filteredData])

  const columns: ColumnsType<MargenUtilidadProcessed> = useMemo(() => [
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
      render: (val: number | null) => formatMoneySimple(val ?? 0),
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
      title: 'Moneda',
      dataIndex: 'moneda_precio',
      key: 'moneda_precio',
      width: 90,
      align: 'center',
      render: (val: string | null) => {
        const moneda = val || 'MXN'
        return <Tag color={moneda === 'USD' ? 'blue' : 'default'}>{moneda}</Tag>
      },
      filters: [
        { text: 'MXN', value: 'MXN' },
        { text: 'USD', value: 'USD' },
      ],
      onFilter: (value, record) => (record.moneda_precio || 'MXN') === value,
    },
    {
      title: 'Margen $',
      dataIndex: 'margen_bruto',
      key: 'margen_bruto',
      width: 130,
      align: 'right',
      render: (val: number | null) => {
        if (val == null) return <span style={{ color: '#999' }}>—</span>
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
      render: (val: number | null) => {
        if (val == null) return <span style={{ color: '#999' }}>—</span>
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
      const fresh = (freshData || []).map(p => convertirMargen(p, tipoCambio))

      let toExport = fresh

      if (searchText) {
        const lower = searchText.toLowerCase()
        toExport = toExport.filter(
          p => (p.sku || '').toLowerCase().includes(lower) || (p.nombre || '').toLowerCase().includes(lower)
        )
      }

      if (margenRange !== 'todos') {
        toExport = toExport.filter(p => {
          const m = p.margen_porcentaje ?? null
          if (m == null) return margenRange === 'lt10'
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
        moneda_label: item.moneda_precio || 'MXN',
        margen_porcentaje_fmt: item.margen_porcentaje != null ? `${item.margen_porcentaje.toFixed(1)}%` : '—',
      }))

      const conMargen = exportData.filter(i => i.margen_porcentaje != null && (i.costo_promedio || 0) > 0)
      const margenPromedio = conMargen.length > 0
        ? conMargen.reduce((sum, i) => sum + (i.margen_porcentaje ?? 0), 0) / conMargen.length
        : 0

      await exportarExcel({
        columnas: [
          { titulo: 'SKU', dataIndex: 'sku' },
          { titulo: 'Producto', dataIndex: 'nombre' },
          { titulo: 'Costo (MXN)', dataIndex: 'costo_promedio', formato: 'moneda' },
          { titulo: 'Precio Venta', dataIndex: 'precio_venta', formato: 'moneda' },
          { titulo: 'Moneda', dataIndex: 'moneda_label' },
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
          ...(tipoCambio ? [{ etiqueta: 'TC USD/MXN', valor: `$${tipoCambio.toFixed(2)}`, formato: 'texto' as const }] : []),
        ],
      })
    } finally {
      setGenerandoExcel(false)
    }
  }

  if (isLoading || tcLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div suppressHydrationWarning>
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
              title="Productos con Costo > Precio"
              value={stats.conMargenNegativo}
              suffix={`/ ${stats.totalConMargen} con margen`}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.conMargenNegativo > 0 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Indicador de tipo de cambio */}
      {hayProductosUSD && (
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">
            <DollarOutlined />{' '}
            {tipoCambio
              ? `TC USD/MXN: $${tipoCambio.toFixed(2)} — Los precios en USD se convierten a MXN para calcular el margen.`
              : 'No hay tipo de cambio disponible. Los productos en USD no muestran margen.'}
          </Text>
        </div>
      )}

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
          scroll={{ x: 1000 }}
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
