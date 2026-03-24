'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Select } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, CalculatorOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useReporteIVA, type IVAMensualRow } from '@/lib/hooks/queries/useReportesFiscal'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function ReporteIVAPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf('year'),
    dayjs().endOf('month'),
  ])
  const [tipoFilter, setTipoFilter] = useState<string | null>(null)
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: rows = [], isLoading } = useReporteIVA(fechaDesde, fechaHasta, organizacion?.id)

  const filteredData = useMemo(() => {
    if (!tipoFilter) return rows
    return rows.filter((r) => r.tipo === tipoFilter)
  }, [rows, tipoFilter])

  const stats = useMemo(() => {
    const trasladado = rows.filter((r) => r.tipo === 'trasladado').reduce((s, r) => s + r.iva, 0)
    const acreditable = rows.filter((r) => r.tipo === 'acreditable').reduce((s, r) => s + r.iva, 0)
    const porPagar = trasladado - acreditable
    return { trasladado, acreditable, porPagar }
  }, [rows])

  const columns: ColumnsType<IVAMensualRow> = useMemo(
    () => [
      {
        title: 'Mes',
        dataIndex: 'mes_label',
        key: 'mes_label',
        width: 160,
        sorter: (a, b) => a.mes.localeCompare(b.mes),
      },
      {
        title: 'Tipo',
        dataIndex: 'tipo',
        key: 'tipo',
        width: 130,
        align: 'center',
        render: (val: string) => (
          <Tag color={val === 'trasladado' ? 'blue' : 'green'}>
            {val === 'trasladado' ? 'Trasladado' : 'Acreditable'}
          </Tag>
        ),
      },
      {
        title: 'Base Gravable',
        dataIndex: 'base_gravable',
        key: 'base_gravable',
        width: 160,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
        sorter: (a, b) => a.base_gravable - b.base_gravable,
      },
      {
        title: 'IVA',
        dataIndex: 'iva',
        key: 'iva',
        width: 140,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
        sorter: (a, b) => a.iva - b.iva,
      },
      {
        title: 'Total',
        dataIndex: 'total',
        key: 'total',
        width: 160,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
        sorter: (a, b) => a.total - b.total,
      },
    ],
    []
  )

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const exportData = filteredData.map((row) => ({
        ...row,
        tipo_label: row.tipo === 'trasladado' ? 'Trasladado' : 'Acreditable',
      }))

      await exportarExcel({
        columnas: [
          { titulo: 'Mes', dataIndex: 'mes_label' },
          { titulo: 'Tipo', dataIndex: 'tipo_label' },
          { titulo: 'Base Gravable', dataIndex: 'base_gravable', formato: 'moneda' },
          { titulo: 'IVA', dataIndex: 'iva', formato: 'moneda' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
        ],
        datos: exportData,
        nombreArchivo: `reporte-iva-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Reporte IVA',
        tituloReporte: 'REPORTE DE IVA - DECLARACION MENSUAL',
        subtitulo:
          fechaDesde && fechaHasta
            ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
            : undefined,
        resumen: [
          { etiqueta: 'IVA Trasladado', valor: stats.trasladado, formato: 'moneda' },
          { etiqueta: 'IVA Acreditable', valor: stats.acreditable, formato: 'moneda' },
          { etiqueta: 'IVA por Pagar', valor: stats.porPagar, formato: 'moneda' },
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
          <Title level={2} style={{ margin: 0 }}><CalculatorOutlined /> Reporte de IVA</Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>
          Exportar Excel
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="IVA Trasladado" value={stats.trasladado} precision={2} prefix="$" valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="IVA Acreditable" value={stats.acreditable} precision={2} prefix="$" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="IVA por Pagar" value={stats.porPagar} precision={2} prefix="$" valueStyle={{ color: stats.porPagar > 0 ? '#f5222d' : '#52c41a' }} /></Card>
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
            placeholder="Tipo de IVA"
            value={tipoFilter}
            onChange={setTipoFilter}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: 'trasladado', label: 'Trasladado' },
              { value: 'acreditable', label: 'Acreditable' },
            ]}
          />
        </Space>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey={(r) => `${r.mes}-${r.tipo}`}
          scroll={{ x: 750 }}
          pagination={false}
          locale={{ emptyText: 'No hay datos en el periodo' }}
        />
      </Card>
    </div>
  )
}
