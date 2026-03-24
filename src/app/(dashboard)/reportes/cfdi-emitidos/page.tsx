'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Select, Input } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useCFDIEmitidos, type CFDIEmitidoRow } from '@/lib/hooks/queries/useReportesFiscal'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple, formatDate } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Search } = Input

export default function ReporteCFDIEmitidosPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [statusSatFilter, setStatusSatFilter] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: cfdis = [], isLoading } = useCFDIEmitidos(fechaDesde, fechaHasta, organizacion?.id, statusSatFilter)

  const filteredData = useMemo(() => {
    if (!busqueda.trim()) return cfdis
    const term = busqueda.toLowerCase()
    return cfdis.filter(
      (c) =>
        (c.uuid_cfdi || '').toLowerCase().includes(term) ||
        (c.folio || '').toLowerCase().includes(term) ||
        (c.cliente_rfc || '').toLowerCase().includes(term) ||
        (c.cliente_razon_social || '').toLowerCase().includes(term)
    )
  }, [cfdis, busqueda])

  const stats = useMemo(() => {
    const totalEmitidos = cfdis.length
    const vigentes = cfdis.filter((c) => c.status_sat === 'Vigente' || !c.status_sat).length
    const cancelados = cfdis.filter((c) => c.status_sat === 'Cancelado').length
    const montoTotal = cfdis.reduce((s, c) => s + Number(c.total || 0), 0)
    return { totalEmitidos, vigentes, cancelados, montoTotal }
  }, [cfdis])

  const columns: ColumnsType<CFDIEmitidoRow> = useMemo(
    () => [
      {
        title: 'UUID',
        dataIndex: 'uuid_cfdi',
        key: 'uuid_cfdi',
        width: 280,
        render: (val: string) => (
          <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{val}</span>
        ),
      },
      {
        title: 'Folio',
        dataIndex: 'folio',
        key: 'folio',
        width: 120,
        sorter: (a, b) => (a.folio || '').localeCompare(b.folio || ''),
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
        title: 'RFC Receptor',
        dataIndex: 'cliente_rfc',
        key: 'cliente_rfc',
        width: 140,
        render: (val: string | null) => val || '-',
      },
      {
        title: 'Razon Social',
        dataIndex: 'cliente_razon_social',
        key: 'cliente_razon_social',
        ellipsis: true,
        render: (val: string | null) => val || '-',
      },
      {
        title: 'Subtotal',
        dataIndex: 'subtotal',
        key: 'subtotal',
        width: 130,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
      },
      {
        title: 'IVA',
        dataIndex: 'iva',
        key: 'iva',
        width: 110,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
      },
      {
        title: 'Total',
        dataIndex: 'total',
        key: 'total',
        width: 140,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
        sorter: (a, b) => Number(a.total) - Number(b.total),
      },
      {
        title: 'Status SAT',
        dataIndex: 'status_sat',
        key: 'status_sat',
        width: 120,
        align: 'center',
        render: (val: string | null) => {
          if (val === 'Cancelado') return <Tag color="red">Cancelado</Tag>
          return <Tag color="green">{val || 'Vigente'}</Tag>
        },
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
        status_sat_label: row.status_sat || 'Vigente',
      }))

      await exportarExcel({
        columnas: [
          { titulo: 'UUID', dataIndex: 'uuid_cfdi' },
          { titulo: 'Folio', dataIndex: 'folio' },
          { titulo: 'Fecha', dataIndex: 'fecha_fmt' },
          { titulo: 'RFC Receptor', dataIndex: 'cliente_rfc' },
          { titulo: 'Razon Social', dataIndex: 'cliente_razon_social' },
          { titulo: 'Subtotal', dataIndex: 'subtotal', formato: 'moneda' },
          { titulo: 'IVA', dataIndex: 'iva', formato: 'moneda' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
          { titulo: 'Status SAT', dataIndex: 'status_sat_label' },
        ],
        datos: exportData,
        nombreArchivo: `cfdi-emitidos-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'CFDI Emitidos',
        tituloReporte: 'REPORTE DE CFDI EMITIDOS',
        subtitulo:
          fechaDesde && fechaHasta
            ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
            : undefined,
        resumen: [
          { etiqueta: 'Total Emitidos', valor: stats.totalEmitidos, formato: 'numero' },
          { etiqueta: 'Vigentes', valor: stats.vigentes, formato: 'numero' },
          { etiqueta: 'Cancelados', valor: stats.cancelados, formato: 'numero' },
          { etiqueta: 'Monto Total', valor: stats.montoTotal, formato: 'moneda' },
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
          <Title level={2} style={{ margin: 0 }}><SafetyCertificateOutlined /> CFDI Emitidos</Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>
          Exportar Excel
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Total Emitidos" value={stats.totalEmitidos} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Vigentes" value={stats.vigentes} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Cancelados" value={stats.cancelados} valueStyle={{ color: '#f5222d' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Monto Total" value={stats.montoTotal} precision={2} prefix="$" valueStyle={{ color: '#722ed1' }} /></Card>
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
            placeholder="Status SAT"
            value={statusSatFilter}
            onChange={setStatusSatFilter}
            style={{ width: 160 }}
            allowClear
            options={[
              { value: 'Vigente', label: 'Vigente' },
              { value: 'Cancelado', label: 'Cancelado' },
            ]}
          />
          <Search placeholder="Buscar UUID, folio o RFC..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 280 }} />
        </Space>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} CFDI` }}
          locale={{ emptyText: 'No hay CFDI en el periodo' }}
        />
      </Card>
    </div>
  )
}
