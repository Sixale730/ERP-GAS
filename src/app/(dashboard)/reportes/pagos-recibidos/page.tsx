'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Select, Input } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, DollarOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { usePagosRecibidos, type PagoRecibidoRow } from '@/lib/hooks/queries/useReportesCobranza'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple, formatDate } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Search } = Input

const METODO_PAGO_TAG: Record<string, { color: string; label: string }> = {
  efectivo: { color: 'green', label: 'Efectivo' },
  tarjeta: { color: 'blue', label: 'Tarjeta' },
  transferencia: { color: 'purple', label: 'Transferencia' },
  cheque: { color: 'orange', label: 'Cheque' },
}

export default function ReportePagosRecibidosPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [metodoPagoFilter, setMetodoPagoFilter] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: pagos = [], isLoading } = usePagosRecibidos(fechaDesde, fechaHasta, organizacion?.id)

  const filteredData = useMemo(() => {
    let result = pagos
    if (metodoPagoFilter) {
      result = result.filter((p) => p.metodo_pago === metodoPagoFilter)
    }
    if (busqueda.trim()) {
      const term = busqueda.toLowerCase()
      result = result.filter(
        (p) =>
          p.cliente_nombre.toLowerCase().includes(term) ||
          p.folio.toLowerCase().includes(term) ||
          p.factura_folio.toLowerCase().includes(term)
      )
    }
    return result
  }, [pagos, metodoPagoFilter, busqueda])

  const stats = useMemo(() => {
    const totalRecibido = filteredData.reduce((sum, p) => sum + p.monto, 0)
    const numPagos = filteredData.length
    const pagoPromedio = numPagos > 0 ? totalRecibido / numPagos : 0
    // Método más usado
    const metodoCounts = new Map<string, number>()
    for (const p of filteredData) {
      const m = p.metodo_pago || 'otro'
      metodoCounts.set(m, (metodoCounts.get(m) || 0) + 1)
    }
    let metodoTop = '-'
    let maxCount = 0
    metodoCounts.forEach((c, m) => {
      if (c > maxCount) { maxCount = c; metodoTop = METODO_PAGO_TAG[m]?.label || m }
    })
    return { totalRecibido, numPagos, pagoPromedio, metodoTop }
  }, [filteredData])

  const columns: ColumnsType<PagoRecibidoRow> = useMemo(
    () => [
      {
        title: 'Folio',
        dataIndex: 'folio',
        key: 'folio',
        width: 120,
        sorter: (a, b) => a.folio.localeCompare(b.folio),
      },
      {
        title: 'Fecha',
        dataIndex: 'fecha',
        key: 'fecha',
        width: 110,
        render: (val: string) => formatDate(val),
        sorter: (a, b) => a.fecha.localeCompare(b.fecha),
      },
      {
        title: 'Cliente',
        dataIndex: 'cliente_nombre',
        key: 'cliente_nombre',
        sorter: (a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre),
      },
      {
        title: 'Sucursal',
        dataIndex: 'sucursal_nombre',
        key: 'sucursal_nombre',
        width: 130,
        ellipsis: true,
        render: (val: string | null) => val || '-',
      },
      {
        title: 'Factura',
        dataIndex: 'factura_folio',
        key: 'factura_folio',
        width: 120,
      },
      {
        title: 'Productos',
        dataIndex: 'productos_desc',
        key: 'productos_desc',
        width: 200,
        ellipsis: true,
        render: (val: string | null) => val || '-',
      },
      {
        title: 'Monto',
        dataIndex: 'monto',
        key: 'monto',
        width: 140,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
        sorter: (a, b) => a.monto - b.monto,
        defaultSortOrder: 'descend',
      },
      {
        title: 'Metodo',
        dataIndex: 'metodo_pago',
        key: 'metodo_pago',
        width: 130,
        align: 'center',
        render: (val: string) => {
          const config = METODO_PAGO_TAG[val] || { color: 'default', label: val || 'Otro' }
          return <Tag color={config.color}>{config.label}</Tag>
        },
      },
      {
        title: 'Referencia',
        dataIndex: 'referencia',
        key: 'referencia',
        width: 150,
        render: (val: string | null) => val || '-',
      },
    ],
    []
  )

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const exportData = filteredData.map((row) => ({
        ...row,
        fecha_fmt: formatDate(row.fecha),
        metodo_label: METODO_PAGO_TAG[row.metodo_pago || '']?.label || row.metodo_pago || 'Otro',
      }))

      await exportarExcel({
        columnas: [
          { titulo: 'Folio', dataIndex: 'folio' },
          { titulo: 'Fecha', dataIndex: 'fecha_fmt' },
          { titulo: 'Cliente', dataIndex: 'cliente_nombre' },
          { titulo: 'Sucursal', dataIndex: 'sucursal_nombre' },
          { titulo: 'Factura', dataIndex: 'factura_folio' },
          { titulo: 'Productos', dataIndex: 'productos_desc' },
          { titulo: 'Monto', dataIndex: 'monto', formato: 'moneda' },
          { titulo: 'Metodo', dataIndex: 'metodo_label' },
          { titulo: 'Referencia', dataIndex: 'referencia' },
        ],
        datos: exportData,
        nombreArchivo: `pagos-recibidos-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Pagos Recibidos',
        tituloReporte: 'REPORTE DE PAGOS RECIBIDOS',
        subtitulo:
          fechaDesde && fechaHasta
            ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
            : undefined,
        resumen: [
          { etiqueta: 'Total Recibido', valor: stats.totalRecibido, formato: 'moneda' },
          { etiqueta: 'Num. Pagos', valor: stats.numPagos, formato: 'numero' },
          { etiqueta: 'Pago Promedio', valor: stats.pagoPromedio, formato: 'moneda' },
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
          <Title level={2} style={{ margin: 0 }}><DollarOutlined /> Pagos Recibidos</Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>
          Exportar Excel
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Total Recibido" value={stats.totalRecibido} precision={2} prefix="$" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Num. Pagos" value={stats.numPagos} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Pago Promedio" value={stats.pagoPromedio} precision={2} prefix="$" valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Metodo mas Usado" value={stats.metodoTop} valueStyle={{ color: '#fa8c16', fontSize: 18 }} /></Card>
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
          <Select
            placeholder="Metodo de pago"
            value={metodoPagoFilter}
            onChange={setMetodoPagoFilter}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: 'efectivo', label: 'Efectivo' },
              { value: 'tarjeta', label: 'Tarjeta' },
              { value: 'transferencia', label: 'Transferencia' },
              { value: 'cheque', label: 'Cheque' },
            ]}
          />
          <Search placeholder="Buscar cliente o folio..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 250 }} />
        </Space>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} pagos` }}
          locale={{ emptyText: 'No hay pagos en el periodo' }}
        />
      </Card>
    </div>
  )
}
