'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Input, Select, Space, Button
} from 'antd'
import {
  InboxOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  FilePdfOutlined,
  WarningOutlined,
  StopOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAlmacenes, useInventario, type InventarioRow } from '@/lib/hooks/queries/useInventario'
import { generarPDFReporte } from '@/lib/utils/pdf'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const NIVEL_TAG: Record<string, { color: string; label: string }> = {
  bajo: { color: 'red', label: 'Bajo' },
  normal: { color: 'green', label: 'Normal' },
  exceso: { color: 'orange', label: 'Exceso' },
  sin_stock: { color: 'default', label: 'Sin Stock' },
}

export default function ReporteInventarioPage() {
  const router = useRouter()
  const [searchText, setSearchText] = useState('')
  const [almacenFilter, setAlmacenFilter] = useState<string | undefined>(undefined)
  const [nivelFilter, setNivelFilter] = useState<string | undefined>(undefined)

  const { data: almacenes = [] } = useAlmacenes()
  const { data: inventarioResult, isLoading, refetch } = useInventario(almacenFilter || null)
  const inventario = inventarioResult?.data ?? []
  const [generandoPDF, setGenerandoPDF] = useState(false)

  // Filtrar datos
  const filteredData = useMemo(() => {
    return inventario.filter((item) => {
      // Excluir servicios
      if (item.nivel_stock === 'servicio') return false

      // Filtro de búsqueda
      if (searchText) {
        const search = searchText.toLowerCase()
        if (
          !item.sku.toLowerCase().includes(search) &&
          !item.producto_nombre.toLowerCase().includes(search)
        ) {
          return false
        }
      }

      // Filtro de nivel
      if (nivelFilter && item.nivel_stock !== nivelFilter) return false

      return true
    })
  }, [inventario, searchText, nivelFilter])

  // Estadísticas
  const stats = useMemo(() => {
    const productosEnStock = filteredData.filter(i => i.cantidad > 0).length
    const totalUnidades = filteredData.reduce((sum, i) => sum + i.cantidad, 0)
    const stockBajo = filteredData.filter(i => i.nivel_stock === 'bajo').length
    const sinStock = filteredData.filter(i => i.nivel_stock === 'sin_stock').length
    return { productosEnStock, totalUnidades, stockBajo, sinStock }
  }, [filteredData])

  const columns: ColumnsType<InventarioRow> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 100,
    },
    {
      title: 'Producto',
      dataIndex: 'producto_nombre',
      key: 'producto_nombre',
      sorter: (a, b) => a.producto_nombre.localeCompare(b.producto_nombre),
    },
    {
      title: 'Almacen',
      dataIndex: 'almacen_nombre',
      key: 'almacen_nombre',
      width: 140,
    },
    {
      title: 'Cantidad',
      dataIndex: 'cantidad',
      key: 'cantidad',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.cantidad - b.cantidad,
      render: (val: number) => <Text strong>{val}</Text>,
    },
    {
      title: 'Reservado',
      dataIndex: 'cantidad_reservada',
      key: 'cantidad_reservada',
      width: 90,
      align: 'right',
      render: (val: number) => val > 0 ? <Text type="warning">{val}</Text> : <Text type="secondary">0</Text>,
    },
    {
      title: 'Disponible',
      key: 'disponible',
      width: 90,
      align: 'right',
      render: (_, record) => {
        const disponible = record.cantidad - record.cantidad_reservada
        return <Text strong style={{ color: disponible > 0 ? '#52c41a' : '#ff4d4f' }}>{disponible}</Text>
      },
    },
    {
      title: 'Min / Max',
      key: 'min_max',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Text type="secondary">{record.stock_minimo} / {record.stock_maximo}</Text>
      ),
    },
    {
      title: 'Nivel',
      dataIndex: 'nivel_stock',
      key: 'nivel_stock',
      width: 90,
      align: 'center',
      render: (nivel: string) => {
        const config = NIVEL_TAG[nivel] || { color: 'default', label: nivel }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: 'Unidad',
      dataIndex: 'unidad_medida',
      key: 'unidad_medida',
      width: 80,
    },
  ]

  const handleDescargarPDF = async () => {
    setGenerandoPDF(true)
    try {
      const { data: freshResult } = await refetch()
      const freshInventario = freshResult?.data || []

      // Aplicar mismos filtros al dato fresco
      const freshFiltered = freshInventario.filter((item) => {
        if (item.nivel_stock === 'servicio') return false
        if (searchText) {
          const search = searchText.toLowerCase()
          if (
            !item.sku.toLowerCase().includes(search) &&
            !item.producto_nombre.toLowerCase().includes(search)
          ) {
            return false
          }
        }
        if (nivelFilter && item.nivel_stock !== nivelFilter) return false
        return true
      })

      // Calcular stats frescos
      const freshStats = {
        productosEnStock: freshFiltered.filter(i => i.cantidad > 0).length,
        totalUnidades: freshFiltered.reduce((sum, i) => sum + i.cantidad, 0),
        stockBajo: freshFiltered.filter(i => i.nivel_stock === 'bajo').length,
        sinStock: freshFiltered.filter(i => i.nivel_stock === 'sin_stock').length,
      }

      const filtrosAplicados: string[] = []
      if (almacenFilter) {
        const alm = almacenes.find(a => a.id === almacenFilter)
        if (alm) filtrosAplicados.push(`Almacen: ${alm.nombre}`)
      }
      if (nivelFilter) {
        const nivelConfig = NIVEL_TAG[nivelFilter]
        if (nivelConfig) filtrosAplicados.push(`Nivel: ${nivelConfig.label}`)
      }
      if (searchText) {
        filtrosAplicados.push(`Busqueda: ${searchText}`)
      }

      await generarPDFReporte({
        titulo: 'Reporte de Inventario',
        nombreArchivo: `reporte-inventario-${dayjs().format('YYYY-MM-DD')}`,
        orientacion: 'landscape',
        filtrosAplicados: filtrosAplicados.length > 0 ? filtrosAplicados : undefined,
        estadisticas: [
          { label: 'Productos en Stock', valor: freshStats.productosEnStock },
          { label: 'Total Unidades', valor: freshStats.totalUnidades },
          { label: 'Stock Bajo', valor: freshStats.stockBajo },
          { label: 'Sin Stock', valor: freshStats.sinStock },
        ],
        columnas: [
          { titulo: 'SKU', dataIndex: 'sku', width: 100 },
          { titulo: 'Producto', dataIndex: 'producto_nombre' },
          { titulo: 'Almacen', dataIndex: 'almacen_nombre', width: 140 },
          { titulo: 'Cantidad', dataIndex: 'cantidad', width: 90, halign: 'right' },
          { titulo: 'Reservado', dataIndex: 'cantidad_reservada', width: 90, halign: 'right' },
          { titulo: 'Disponible', dataIndex: 'disponible', width: 90, halign: 'right' },
          { titulo: 'Min / Max', dataIndex: 'min_max', width: 100, halign: 'center' },
          { titulo: 'Nivel', dataIndex: 'nivel_stock', width: 90, halign: 'center' },
          { titulo: 'Unidad', dataIndex: 'unidad_medida', width: 80 },
        ],
        datos: freshFiltered.map(item => ({
          ...item,
          disponible: item.cantidad - item.cantidad_reservada,
          min_max: `${item.stock_minimo} / ${item.stock_maximo}`,
        })),
      })
    } finally {
      setGenerandoPDF(false)
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            <InboxOutlined /> Reporte de Inventario Actual
          </Title>
        </Space>
        <Button type="primary" icon={<FilePdfOutlined />} onClick={handleDescargarPDF} loading={generandoPDF}>
          Descargar PDF
        </Button>
      </div>

      {/* Estadísticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Productos en Stock"
              value={stats.productosEnStock}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Unidades"
              value={stats.totalUnidades}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Stock Bajo"
              value={stats.stockBajo}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Sin Stock"
              value={stats.sinStock}
              prefix={<StopOutlined />}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabla */}
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por SKU o nombre..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="Filtrar por almacen"
            value={almacenFilter}
            onChange={setAlmacenFilter}
            style={{ width: 180 }}
            allowClear
            options={almacenes.map(a => ({ value: a.id, label: a.nombre }))}
          />
          <Select
            placeholder="Filtrar por nivel"
            value={nivelFilter}
            onChange={setNivelFilter}
            style={{ width: 150 }}
            allowClear
            options={[
              { value: 'bajo', label: 'Bajo' },
              { value: 'normal', label: 'Normal' },
              { value: 'exceso', label: 'Exceso' },
              { value: 'sin_stock', label: 'Sin Stock' },
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
          locale={{ emptyText: 'No hay inventario registrado' }}
        />
      </Card>
    </div>
  )
}
