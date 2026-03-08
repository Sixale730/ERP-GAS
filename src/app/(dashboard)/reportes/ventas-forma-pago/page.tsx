'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker
} from 'antd'
import {
  ArrowLeftOutlined,
  FileExcelOutlined,
  PieChartOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useVentasFormaPago, type VentaFormaPagoRow } from '@/lib/hooks/queries/useReportesNuevos'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export default function ReporteVentasFormaPagoPage() {
  const router = useRouter()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: datos = [], isLoading, refetch } = useVentasFormaPago(fechaDesde, fechaHasta)

  const stats = useMemo(() => {
    const totalGeneral = datos.reduce((sum, r) => sum + (r.total || 0), 0)
    const numVentasTotal = datos.reduce((sum, r) => sum + (r.num_ventas || 0), 0)
    return { totalGeneral, numVentasTotal }
  }, [datos])

  const dataConPorcentaje = useMemo(() => {
    const totalGeneral = datos.reduce((sum, r) => sum + (r.total || 0), 0)
    return datos.map(r => ({
      ...r,
      porcentaje: totalGeneral > 0 ? (r.total / totalGeneral) * 100 : 0,
    }))
  }, [datos])

  const columns: ColumnsType<VentaFormaPagoRow & { porcentaje: number }> = useMemo(() => [
    {
      title: 'Metodo de Pago',
      dataIndex: 'metodo_pago',
      key: 'metodo_pago',
      width: 200,
      render: (val: string) => capitalize(val),
      sorter: (a, b) => a.metodo_pago.localeCompare(b.metodo_pago),
    },
    {
      title: 'Num. Ventas',
      dataIndex: 'num_ventas',
      key: 'num_ventas',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.num_ventas - b.num_ventas,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 160,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
      sorter: (a, b) => (a.total || 0) - (b.total || 0),
    },
    {
      title: '% del Total',
      dataIndex: 'porcentaje',
      key: 'porcentaje',
      width: 120,
      align: 'right',
      render: (val: number) => `${val.toFixed(1)}%`,
      sorter: (a, b) => a.porcentaje - b.porcentaje,
    },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const { data: freshData } = await refetch()
      const fresh = freshData || []

      const totalGeneral = fresh.reduce((sum, r) => sum + (r.total || 0), 0)
      const numVentasTotal = fresh.reduce((sum, r) => sum + (r.num_ventas || 0), 0)

      const exportData = fresh.map(item => ({
        metodo_pago_label: capitalize(item.metodo_pago),
        num_ventas: item.num_ventas,
        total: item.total,
        porcentaje: totalGeneral > 0 ? ((item.total / totalGeneral) * 100) : 0,
      }))

      await exportarExcel({
        columnas: [
          { titulo: 'Metodo de Pago', dataIndex: 'metodo_pago_label' },
          { titulo: 'Num. Ventas', dataIndex: 'num_ventas', formato: 'numero' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
          { titulo: '% del Total', dataIndex: 'porcentaje', formato: 'porcentaje' },
        ],
        datos: exportData,
        nombreArchivo: `reporte-ventas-forma-pago-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Ventas por Forma de Pago',
        tituloReporte: 'REPORTE DE VENTAS POR FORMA DE PAGO',
        subtitulo: fechaDesde && fechaHasta
          ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
          : undefined,
        resumen: [
          { etiqueta: 'Total General', valor: totalGeneral, formato: 'moneda' },
          { etiqueta: 'Num. Ventas Total', valor: numVentasTotal, formato: 'numero' },
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
            <PieChartOutlined /> Ventas por Forma de Pago
          </Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>
          Exportar Excel
        </Button>
      </div>

      {/* Estadisticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Total General"
              value={stats.totalGeneral}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Num. Ventas Total"
              value={stats.numVentasTotal}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#1890ff' }}
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
        </Space>

        <Table
          dataSource={dataConPorcentaje}
          columns={columns}
          rowKey="metodo_pago"
          loading={isLoading}
          scroll={{ x: 600 }}
          pagination={false}
          locale={{ emptyText: 'No hay datos en el periodo' }}
        />
      </Card>
    </div>
  )
}
