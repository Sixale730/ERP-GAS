'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Select, Space, Button, DatePicker
} from 'antd'
import {
  ArrowLeftOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  DollarOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useFacturasSaldos, type FacturaSaldoRow } from '@/lib/hooks/queries/useReportesNuevos'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatDate, formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  pendiente: { color: 'orange', label: 'Pendiente' },
  parcial: { color: 'blue', label: 'Parcial' },
  pagada: { color: 'green', label: 'Pagada' },
  cancelada: { color: 'red', label: 'Cancelada' },
}

export default function ReporteFacturasSaldosPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: facturas = [], isLoading, refetch } = useFacturasSaldos(fechaDesde, fechaHasta, organizacion?.id, statusFilter)

  const stats = useMemo(() => {
    const totalFacturado = facturas.reduce((sum, f) => sum + (f.total || 0), 0)
    const cobrado = facturas.reduce((sum, f) => sum + (f.monto_pagado || 0), 0)
    const pendiente = facturas.reduce((sum, f) => sum + (f.saldo || 0), 0)
    return { totalFacturado, cobrado, pendiente }
  }, [facturas])

  const columns: ColumnsType<FacturaSaldoRow> = useMemo(() => [
    {
      title: 'Folio',
      dataIndex: 'folio',
      key: 'folio',
      width: 120,
      sorter: (a, b) => (a.folio || '').localeCompare(b.folio || ''),
    },
    {
      title: 'Orden Venta',
      dataIndex: 'cotizacion_folio',
      key: 'cotizacion_folio',
      width: 130,
      render: (val: string | null) => val || '-',
      sorter: (a, b) => (a.cotizacion_folio || '').localeCompare(b.cotizacion_folio || ''),
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha',
      key: 'fecha',
      width: 110,
      render: (val: string) => formatDate(val),
      sorter: (a, b) => (a.fecha || '').localeCompare(b.fecha || ''),
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente_nombre',
      key: 'cliente_nombre',
      ellipsis: true,
      sorter: (a, b) => (a.cliente_nombre || '').localeCompare(b.cliente_nombre || ''),
    },
    {
      title: 'Sucursal',
      dataIndex: 'sucursal_nombre',
      key: 'sucursal_nombre',
      width: 130,
      ellipsis: true,
      render: (val: string | null) => val || '-',
      sorter: (a, b) => (a.sucursal_nombre || '').localeCompare(b.sucursal_nombre || ''),
    },
    {
      title: 'Productos',
      dataIndex: 'productos_desc',
      key: 'productos_desc',
      width: 200,
      ellipsis: true,
      render: (val: string | null) => val || '-',
      sorter: (a, b) => (a.productos_desc || '').localeCompare(b.productos_desc || ''),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 140,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
      sorter: (a, b) => (a.total || 0) - (b.total || 0),
    },
    {
      title: 'Pagado',
      dataIndex: 'monto_pagado',
      key: 'monto_pagado',
      width: 140,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
      sorter: (a, b) => (a.monto_pagado || 0) - (b.monto_pagado || 0),
    },
    {
      title: 'Saldo',
      dataIndex: 'saldo',
      key: 'saldo',
      width: 140,
      align: 'right',
      render: (val: number) => (
        <span style={{ color: val > 0 ? '#f5222d' : undefined, fontWeight: val > 0 ? 600 : undefined }}>
          {formatMoneySimple(val)}
        </span>
      ),
      sorter: (a, b) => (a.saldo || 0) - (b.saldo || 0),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      align: 'center',
      render: (status: string) => {
        const config = STATUS_TAG[status] || { color: 'default', label: status }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const { data: freshData } = await refetch()
      const fresh = freshData || []

      const exportData = fresh.map(item => ({
        ...item,
        fecha_fmt: formatDate(item.fecha),
        status_label: STATUS_TAG[item.status]?.label || item.status,
      }))

      const totalFacturado = exportData.reduce((sum, i) => sum + (i.total || 0), 0)
      const cobrado = exportData.reduce((sum, i) => sum + (i.monto_pagado || 0), 0)
      const pendiente = exportData.reduce((sum, i) => sum + (i.saldo || 0), 0)

      await exportarExcel({
        columnas: [
          { titulo: 'Folio', dataIndex: 'folio' },
          { titulo: 'Orden Venta', dataIndex: 'cotizacion_folio' },
          { titulo: 'Fecha', dataIndex: 'fecha_fmt' },
          { titulo: 'Cliente', dataIndex: 'cliente_nombre' },
          { titulo: 'Sucursal', dataIndex: 'sucursal_nombre' },
          { titulo: 'Productos', dataIndex: 'productos_desc' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
          { titulo: 'Pagado', dataIndex: 'monto_pagado', formato: 'moneda' },
          { titulo: 'Saldo', dataIndex: 'saldo', formato: 'moneda' },
          { titulo: 'Status', dataIndex: 'status_label' },
        ],
        datos: exportData,
        nombreArchivo: `reporte-facturas-saldos-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Facturas y Saldos',
        tituloReporte: 'REPORTE DE FACTURAS Y SALDOS',
        subtitulo: fechaDesde && fechaHasta
          ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
          : undefined,
        resumen: [
          { etiqueta: 'Total Facturado', valor: totalFacturado, formato: 'moneda' },
          { etiqueta: 'Cobrado', valor: cobrado, formato: 'moneda' },
          { etiqueta: 'Pendiente', valor: pendiente, formato: 'moneda' },
        ],
        statusDataIndex: 'status_label',
        mapaColorStatus: {
          Pendiente: 'FFF2E8',
          Parcial: 'CCE5FF',
          Pagada: 'C6EFCE',
          Cancelada: 'FFCCCC',
        },
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
            <FileTextOutlined /> Facturas y Saldos
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
              title="Total Facturado"
              value={stats.totalFacturado}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Cobrado"
              value={stats.cobrado}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Pendiente"
              value={stats.pendiente}
              precision={2}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#f5222d' }}
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
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            allowClear
            options={[
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'parcial', label: 'Parcial' },
              { value: 'pagada', label: 'Pagada' },
              { value: 'cancelada', label: 'Cancelada' },
            ]}
          />
        </Space>

        <Table
          dataSource={facturas}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1360 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} registros`,
          }}
          locale={{ emptyText: 'No hay facturas en el periodo' }}
        />
      </Card>
    </div>
  )
}
