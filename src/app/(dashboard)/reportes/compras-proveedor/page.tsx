'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, TeamOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useComprasPorProveedor, type ComprasPorProveedorRow } from '@/lib/hooks/queries/useReportesCompras'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function ReporteComprasProveedorPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([dayjs().startOf('month'), dayjs().endOf('month')])
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null
  const { data: proveedores = [], isLoading } = useComprasPorProveedor(fechaDesde, fechaHasta, organizacion?.id)

  const stats = useMemo(() => {
    const totalComprado = proveedores.reduce((s, p) => s + p.total, 0)
    const numProveedores = proveedores.length
    const numOrdenes = proveedores.reduce((s, p) => s + p.num_ordenes, 0)
    const top = proveedores[0]?.proveedor_nombre || '-'
    return { totalComprado, numProveedores, numOrdenes, top }
  }, [proveedores])

  const totalGeneral = useMemo(() => proveedores.reduce((s, p) => s + p.total, 0), [proveedores])

  const columns: ColumnsType<ComprasPorProveedorRow> = useMemo(() => [
    { title: 'Proveedor', dataIndex: 'proveedor_nombre', key: 'proveedor_nombre', sorter: (a, b) => a.proveedor_nombre.localeCompare(b.proveedor_nombre) },
    { title: 'RFC', dataIndex: 'proveedor_rfc', key: 'proveedor_rfc', width: 140, render: (v: string | null) => v || '-' },
    { title: 'Ordenes', dataIndex: 'num_ordenes', key: 'num_ordenes', width: 100, align: 'center', sorter: (a, b) => a.num_ordenes - b.num_ordenes },
    { title: 'Subtotal', dataIndex: 'subtotal', key: 'subtotal', width: 140, align: 'right', render: (v: number) => formatMoneySimple(v) },
    { title: 'IVA', dataIndex: 'iva', key: 'iva', width: 120, align: 'right', render: (v: number) => formatMoneySimple(v) },
    { title: 'Total', dataIndex: 'total', key: 'total', width: 150, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.total - b.total, defaultSortOrder: 'descend' },
    { title: '% del Total', key: 'pct', width: 110, align: 'right', render: (_: unknown, r: ComprasPorProveedorRow) => totalGeneral > 0 ? `${((r.total / totalGeneral) * 100).toFixed(1)}%` : '0%' },
  ], [totalGeneral])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'Proveedor', dataIndex: 'proveedor_nombre' },
          { titulo: 'RFC', dataIndex: 'proveedor_rfc' },
          { titulo: 'Num Ordenes', dataIndex: 'num_ordenes', formato: 'numero' },
          { titulo: 'Subtotal', dataIndex: 'subtotal', formato: 'moneda' },
          { titulo: 'IVA', dataIndex: 'iva', formato: 'moneda' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
        ],
        datos: proveedores as unknown as Record<string, unknown>[],
        nombreArchivo: `compras-por-proveedor-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Compras por Proveedor',
        tituloReporte: 'COMPRAS POR PROVEEDOR',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [
          { etiqueta: 'Total Comprado', valor: stats.totalComprado, formato: 'moneda' },
          { etiqueta: 'Num Proveedores', valor: stats.numProveedores, formato: 'numero' },
          { etiqueta: 'Num Ordenes', valor: stats.numOrdenes, formato: 'numero' },
        ],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><TeamOutlined /> Compras por Proveedor</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card><Statistic title="Total Comprado" value={stats.totalComprado} precision={2} prefix="$" valueStyle={{ color: '#eb2f96' }} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Proveedores" value={stats.numProveedores} prefix={<TeamOutlined />} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Total Ordenes" value={stats.numOrdenes} valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>
      <Card>
        <Space style={{ marginBottom: 16 }}><RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" /></Space>
        <Table dataSource={proveedores} columns={columns} rowKey="proveedor_id" scroll={{ x: 900 }} pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} proveedores` }} />
      </Card>
    </div>
  )
}
