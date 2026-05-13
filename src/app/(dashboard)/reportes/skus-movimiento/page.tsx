'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, Alert, Tooltip } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, BarChartOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useSkusConMovimiento, type SkuMovimientoRow, type SemaforoSku } from '@/lib/hooks/queries/useReportesInventario'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatNumber } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

const SEMAFORO_CFG: Record<SemaforoSku, { label: string; color: string; emoji: string }> = {
  critico: { label: 'Necesita compra', color: 'red', emoji: '🔴' },
  vigilar: { label: 'Vigilar', color: 'orange', emoji: '🟡' },
  estable: { label: 'Estable', color: 'green', emoji: '🟢' },
}

export default function ReporteSkusMovimientoPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [generandoExcel, setGenerandoExcel] = useState(false)
  const { data: filas = [], isLoading } = useSkusConMovimiento(organizacion?.id)

  const stats = useMemo(() => {
    const total = filas.length
    const criticos = filas.filter((f) => f.semaforo === 'critico').length
    const vigilar = filas.filter((f) => f.semaforo === 'vigilar').length
    const sinMinMax = filas.filter((f) => !f.tiene_min_max).length
    const sinProveedor = filas.filter((f) => !f.tiene_proveedor).length
    return { total, criticos, vigilar, sinMinMax, sinProveedor }
  }, [filas])

  const columns: ColumnsType<SkuMovimientoRow> = useMemo(() => [
    {
      title: 'Semaforo', dataIndex: 'semaforo', key: 'semaforo', width: 100, fixed: 'left',
      render: (v: SemaforoSku) => <Tag color={SEMAFORO_CFG[v].color}>{SEMAFORO_CFG[v].emoji} {SEMAFORO_CFG[v].label}</Tag>,
      filters: [
        { text: '🔴 Necesita compra', value: 'critico' },
        { text: '🟡 Vigilar', value: 'vigilar' },
        { text: '🟢 Estable', value: 'estable' },
      ],
      onFilter: (val, record) => record.semaforo === val,
    },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 130, fixed: 'left', sorter: (a, b) => a.sku.localeCompare(b.sku) },
    { title: 'Producto', dataIndex: 'nombre', key: 'nombre', ellipsis: true, sorter: (a, b) => a.nombre.localeCompare(b.nombre) },
    { title: 'UM', dataIndex: 'unidad_medida', key: 'unidad_medida', width: 70, align: 'center', render: (v: string | null) => v || '-' },
    { title: 'Fisico', dataIndex: 'stock_fisico', key: 'stock_fisico', width: 80, align: 'center', render: (v: number) => formatNumber(v), sorter: (a, b) => a.stock_fisico - b.stock_fisico },
    { title: 'Min', dataIndex: 'stock_minimo', key: 'stock_minimo', width: 70, align: 'center', render: (v: number) => v > 0 ? v : <Text type="secondary">-</Text> },
    { title: 'Max', dataIndex: 'stock_maximo', key: 'stock_maximo', width: 70, align: 'center', render: (v: number) => v > 0 ? v : <Text type="secondary">-</Text> },
    { title: 'Reservado (OVs)', dataIndex: 'reservado', key: 'reservado', width: 110, align: 'center', render: (v: number) => v > 0 ? <Tag color="orange" style={{ margin: 0 }}>{formatNumber(v)}</Tag> : '-', sorter: (a, b) => a.reservado - b.reservado },
    { title: 'En transito (OCs)', dataIndex: 'en_transito', key: 'en_transito', width: 120, align: 'center', render: (v: number) => v > 0 ? <Tag color="cyan" style={{ margin: 0 }}>{formatNumber(v)}</Tag> : '-', sorter: (a, b) => a.en_transito - b.en_transito },
    {
      title: 'Disponible neto', dataIndex: 'disponible_neto', key: 'disponible_neto', width: 130, align: 'center',
      render: (v: number) => <Text strong style={{ color: v < 0 ? '#cf1322' : v === 0 ? '#fa8c16' : '#3f8600' }}>{formatNumber(v)}</Text>,
      sorter: (a, b) => a.disponible_neto - b.disponible_neto,
    },
    {
      title: 'Vendidas 30d', dataIndex: 'vendidas_30d', key: 'vendidas_30d', width: 110, align: 'center',
      render: (v: number) => v > 0 ? <Tag color="blue" style={{ margin: 0 }}>{formatNumber(v)}</Tag> : '-',
      sorter: (a, b) => a.vendidas_30d - b.vendidas_30d, defaultSortOrder: 'descend',
    },
    {
      title: '¿Min/Max?', dataIndex: 'tiene_min_max', key: 'tiene_min_max', width: 90, align: 'center',
      render: (v: boolean) => v
        ? <Tag color="green" style={{ margin: 0 }}>Si</Tag>
        : <Tooltip title="SOLAC necesita configurar minimo y maximo para este SKU"><Tag color="red" style={{ margin: 0 }}>No</Tag></Tooltip>,
      filters: [{ text: 'Sin configurar', value: false }, { text: 'Configurado', value: true }],
      onFilter: (val, record) => record.tiene_min_max === val,
    },
    {
      title: '¿Proveedor?', dataIndex: 'tiene_proveedor', key: 'tiene_proveedor', width: 110, align: 'center',
      render: (v: boolean, record) => v
        ? <Tooltip title={record.proveedor_nombre || ''}><Tag color="green" style={{ margin: 0 }}>Si</Tag></Tooltip>
        : <Tooltip title="Este SKU tuvo movimiento pero no tiene proveedor asignado. SOLAC debe asignarlo en /productos."><Tag color="red" style={{ margin: 0 }}>⚠ Falta</Tag></Tooltip>,
      filters: [{ text: 'Sin proveedor', value: false }, { text: 'Con proveedor', value: true }],
      onFilter: (val, record) => record.tiene_proveedor === val,
    },
    {
      title: 'Proveedor', dataIndex: 'proveedor_nombre', key: 'proveedor_nombre', width: 160, ellipsis: true,
      render: (v: string | null) => v || <Text type="secondary">-</Text>,
    },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const datosExport = filas.map((f) => ({
        ...f,
        semaforo_label: SEMAFORO_CFG[f.semaforo].label,
        tiene_min_max_label: f.tiene_min_max ? 'Si' : 'No',
        tiene_proveedor_label: f.tiene_proveedor ? 'Si' : 'No',
      }))
      await exportarExcel({
        columnas: [
          { titulo: 'Semaforo', dataIndex: 'semaforo_label' },
          { titulo: 'SKU', dataIndex: 'sku' },
          { titulo: 'Producto', dataIndex: 'nombre' },
          { titulo: 'UM', dataIndex: 'unidad_medida' },
          { titulo: 'Stock Fisico', dataIndex: 'stock_fisico', formato: 'numero' },
          { titulo: 'Min', dataIndex: 'stock_minimo', formato: 'numero' },
          { titulo: 'Max', dataIndex: 'stock_maximo', formato: 'numero' },
          { titulo: 'Reservado (OVs)', dataIndex: 'reservado', formato: 'numero' },
          { titulo: 'En transito (OCs)', dataIndex: 'en_transito', formato: 'numero' },
          { titulo: 'Disponible neto', dataIndex: 'disponible_neto', formato: 'numero' },
          { titulo: 'Vendidas 30d', dataIndex: 'vendidas_30d', formato: 'numero' },
          { titulo: 'Tiene Min/Max', dataIndex: 'tiene_min_max_label' },
          { titulo: 'Tiene Proveedor', dataIndex: 'tiene_proveedor_label' },
          { titulo: 'Proveedor', dataIndex: 'proveedor_nombre' },
        ],
        datos: datosExport as unknown as Record<string, unknown>[],
        nombreArchivo: `skus-movimiento-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'SKUs Movimiento',
        tituloReporte: 'SKUs CON MOVIMIENTO (ULTIMOS 30 DIAS)',
        resumen: [
          { etiqueta: 'Total SKUs con movimiento', valor: stats.total, formato: 'numero' },
          { etiqueta: 'Criticos (necesitan compra)', valor: stats.criticos, formato: 'numero' },
          { etiqueta: 'A vigilar', valor: stats.vigilar, formato: 'numero' },
          { etiqueta: 'Sin Min/Max configurado', valor: stats.sinMinMax, formato: 'numero' },
          { etiqueta: 'Sin proveedor asignado', valor: stats.sinProveedor, formato: 'numero' },
        ],
      })
    } finally {
      setGenerandoExcel(false)
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button>
        <Title level={3} style={{ margin: 0 }}><BarChartOutlined /> SKUs con Movimiento (30 dias)</Title>
        <Button icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel} disabled={filas.length === 0}>Exportar Excel</Button>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Diagnostico para configurar el catalogo"
        description={
          <Paragraph style={{ margin: 0 }}>
            Este reporte muestra UNICAMENTE los SKUs que tuvieron actividad real en los ultimos 30 dias:
            ventas (factura/OV), compras (OC creada) o reservas activas. Es el listado que SOLAC debe usar
            para configurar <Text code>stock_minimo</Text>, <Text code>stock_maximo</Text>, costo y proveedor
            en <Text code>/productos</Text>. Los SKUs sin movimiento quedan fuera porque su decision es de negocio (make-to-order).
          </Paragraph>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={4}><Card><Statistic title="Total SKUs" value={stats.total} /></Card></Col>
        <Col xs={12} sm={8} lg={5}><Card><Statistic title="🔴 Necesitan compra" value={stats.criticos} valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col xs={12} sm={8} lg={5}><Card><Statistic title="🟡 Vigilar" value={stats.vigilar} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={12} sm={8} lg={5}><Card><Statistic title="Sin Min/Max" value={stats.sinMinMax} valueStyle={{ color: stats.sinMinMax > 0 ? '#cf1322' : '#3f8600' }} /></Card></Col>
        <Col xs={12} sm={8} lg={5}><Card><Statistic title="Sin proveedor" value={stats.sinProveedor} valueStyle={{ color: stats.sinProveedor > 0 ? '#cf1322' : '#3f8600' }} /></Card></Col>
      </Row>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : (
        <Card>
          <Table
            dataSource={filas}
            columns={columns}
            rowKey="producto_id"
            scroll={{ x: 1500 }}
            pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} SKUs con movimiento` }}
          />
        </Card>
      )}
    </div>
  )
}
