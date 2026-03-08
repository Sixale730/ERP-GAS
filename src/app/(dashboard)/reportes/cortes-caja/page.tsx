'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Select, Space, Button, DatePicker
} from 'antd'
import {
  ArrowLeftOutlined,
  FileExcelOutlined,
  DollarOutlined,
  CreditCardOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useCortesReporte, type ResumenTurnoReporte } from '@/lib/hooks/queries/useReportesNuevos'
import { exportarExcel } from '@/lib/utils/excel'
import { formatDateTime, formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function ReporteCortesCajaPage() {
  const router = useRouter()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [cajaFilter, setCajaFilter] = useState<string | null>(null)
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: cortes = [], isLoading, refetch } = useCortesReporte(fechaDesde, fechaHasta)

  const cajasOptions = useMemo(() => {
    const unique = Array.from(new Set(cortes.map(c => c.caja_nombre).filter(Boolean)))
    return unique.map(c => ({ value: c, label: c }))
  }, [cortes])

  const filteredData = useMemo(() => {
    if (!cajaFilter) return cortes
    return cortes.filter(c => c.caja_nombre === cajaFilter)
  }, [cortes, cajaFilter])

  const stats = useMemo(() => {
    const totalEfectivo = filteredData.reduce((sum, c) => sum + (c.total_efectivo || 0), 0)
    const totalTarjeta = filteredData.reduce((sum, c) => sum + (c.total_tarjeta || 0), 0)
    const totalDiferencias = filteredData.reduce((sum, c) => sum + (c.diferencia || 0), 0)
    return { totalEfectivo, totalTarjeta, totalDiferencias }
  }, [filteredData])

  const columns: ColumnsType<ResumenTurnoReporte> = useMemo(() => [
    {
      title: 'Fecha Apertura',
      dataIndex: 'fecha_apertura',
      key: 'fecha_apertura',
      width: 150,
      render: (val: string) => formatDateTime(val),
      sorter: (a, b) => (a.fecha_apertura || '').localeCompare(b.fecha_apertura || ''),
    },
    {
      title: 'Caja',
      dataIndex: 'caja_nombre',
      key: 'caja_nombre',
      width: 130,
    },
    {
      title: 'Usuario',
      dataIndex: 'usuario_nombre',
      key: 'usuario_nombre',
      width: 150,
    },
    {
      title: 'Turno',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (val: string) => (
        <Tag color={val === 'abierto' ? 'green' : 'default'}>
          {val === 'abierto' ? 'Abierto' : 'Cerrado'}
        </Tag>
      ),
    },
    {
      title: 'Num Ventas',
      dataIndex: 'num_ventas',
      key: 'num_ventas',
      width: 100,
      align: 'right',
      sorter: (a, b) => (a.num_ventas || 0) - (b.num_ventas || 0),
    },
    {
      title: 'Total Ventas',
      dataIndex: 'total_ventas',
      key: 'total_ventas',
      width: 140,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
      sorter: (a, b) => (a.total_ventas || 0) - (b.total_ventas || 0),
    },
    {
      title: 'Efectivo',
      dataIndex: 'total_efectivo',
      key: 'total_efectivo',
      width: 130,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
    },
    {
      title: 'Tarjeta',
      dataIndex: 'total_tarjeta',
      key: 'total_tarjeta',
      width: 130,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
    },
    {
      title: 'Diferencia',
      dataIndex: 'diferencia',
      key: 'diferencia',
      width: 130,
      align: 'right',
      render: (val: number | null) => {
        if (val === null) return '-'
        const color = val < 0 ? '#f5222d' : '#52c41a'
        return <span style={{ color, fontWeight: 600 }}>{formatMoneySimple(val)}</span>
      },
      sorter: (a, b) => (a.diferencia || 0) - (b.diferencia || 0),
    },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const { data: freshData } = await refetch()
      const fresh = freshData || []

      const toExport = cajaFilter
        ? fresh.filter(c => c.caja_nombre === cajaFilter)
        : fresh

      const exportData = toExport.map(item => ({
        ...item,
        fecha_apertura_fmt: formatDateTime(item.fecha_apertura),
        status_label: item.status === 'abierto' ? 'Abierto' : 'Cerrado',
      }))

      const totalEfectivo = exportData.reduce((sum, i) => sum + (i.total_efectivo || 0), 0)
      const totalTarjeta = exportData.reduce((sum, i) => sum + (i.total_tarjeta || 0), 0)
      const totalDiferencias = exportData.reduce((sum, i) => sum + (i.diferencia || 0), 0)

      await exportarExcel({
        columnas: [
          { titulo: 'Fecha Apertura', dataIndex: 'fecha_apertura_fmt' },
          { titulo: 'Caja', dataIndex: 'caja_nombre' },
          { titulo: 'Usuario', dataIndex: 'usuario_nombre' },
          { titulo: 'Turno', dataIndex: 'status_label' },
          { titulo: 'Num Ventas', dataIndex: 'num_ventas', formato: 'numero' },
          { titulo: 'Total Ventas', dataIndex: 'total_ventas', formato: 'moneda' },
          { titulo: 'Efectivo', dataIndex: 'total_efectivo', formato: 'moneda' },
          { titulo: 'Tarjeta', dataIndex: 'total_tarjeta', formato: 'moneda' },
          { titulo: 'Diferencia', dataIndex: 'diferencia', formato: 'moneda' },
        ],
        datos: exportData,
        nombreArchivo: `reporte-cortes-caja-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Cortes de Caja',
        tituloReporte: 'REPORTE DE CORTES DE CAJA',
        subtitulo: fechaDesde && fechaHasta
          ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
          : undefined,
        resumen: [
          { etiqueta: 'Total Efectivo', valor: totalEfectivo, formato: 'moneda' },
          { etiqueta: 'Total Tarjeta', valor: totalTarjeta, formato: 'moneda' },
          { etiqueta: 'Total Diferencias', valor: totalDiferencias, formato: 'moneda' },
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
            Reporte de Cortes de Caja
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
              title="Total Efectivo"
              value={stats.totalEfectivo}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Tarjeta"
              value={stats.totalTarjeta}
              precision={2}
              prefix={<CreditCardOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Diferencias"
              value={stats.totalDiferencias}
              precision={2}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.totalDiferencias < 0 ? '#f5222d' : '#52c41a' }}
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
            placeholder="Filtrar por caja"
            value={cajaFilter}
            onChange={setCajaFilter}
            style={{ width: 200 }}
            allowClear
            options={cajasOptions}
          />
        </Space>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1100 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} registros`,
          }}
          locale={{ emptyText: 'No hay cortes de caja en el periodo' }}
        />
      </Card>
    </div>
  )
}
