'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, SwapOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useComparativoVentas, type ComparativoVentasRow } from '@/lib/hooks/queries/useReportesVentas'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function ReporteComparativoVentasPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const modulosActivos: string[] = organizacion?.modulos_activos || []

  const [rango1, setRango1] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().subtract(1, 'month').startOf('month'),
    dayjs().subtract(1, 'month').endOf('month'),
  ])
  const [rango2, setRango2] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const desde1 = rango1?.[0]?.format('YYYY-MM-DD') ?? null
  const hasta1 = rango1?.[1]?.format('YYYY-MM-DD') ?? null
  const desde2 = rango2?.[0]?.format('YYYY-MM-DD') ?? null
  const hasta2 = rango2?.[1]?.format('YYYY-MM-DD') ?? null

  const { data: rows = [], isLoading } = useComparativoVentas(desde1, hasta1, desde2, hasta2, organizacion?.id, modulosActivos)

  const totalRow = rows.find((r) => r.periodo === 'TOTAL')
  const dataRows = rows.filter((r) => r.periodo !== 'TOTAL')

  const columns: ColumnsType<ComparativoVentasRow> = useMemo(
    () => [
      { title: 'Periodo', dataIndex: 'periodo', key: 'periodo', sorter: (a, b) => a.periodo.localeCompare(b.periodo) },
      {
        title: 'Periodo 1',
        dataIndex: 'total_p1',
        key: 'total_p1',
        width: 160,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
        sorter: (a, b) => a.total_p1 - b.total_p1,
      },
      {
        title: 'Periodo 2',
        dataIndex: 'total_p2',
        key: 'total_p2',
        width: 160,
        align: 'right',
        render: (val: number) => formatMoneySimple(val),
        sorter: (a, b) => a.total_p2 - b.total_p2,
      },
      {
        title: 'Variacion $',
        dataIndex: 'variacion',
        key: 'variacion',
        width: 150,
        align: 'right',
        sorter: (a, b) => a.variacion - b.variacion,
        render: (val: number) => (
          <Text style={{ color: val >= 0 ? '#52c41a' : '#f5222d' }}>
            {val >= 0 ? '+' : ''}{formatMoneySimple(val)}
          </Text>
        ),
      },
      {
        title: 'Variacion %',
        dataIndex: 'variacion_pct',
        key: 'variacion_pct',
        width: 130,
        align: 'center',
        render: (val: number) => (
          <Tag color={val >= 0 ? 'green' : 'red'} icon={val >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}>
            {val >= 0 ? '+' : ''}{val.toFixed(1)}%
          </Tag>
        ),
        sorter: (a, b) => a.variacion_pct - b.variacion_pct,
      },
    ],
    []
  )

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'Periodo', dataIndex: 'periodo' },
          { titulo: 'Periodo 1', dataIndex: 'total_p1', formato: 'moneda' },
          { titulo: 'Periodo 2', dataIndex: 'total_p2', formato: 'moneda' },
          { titulo: 'Variacion $', dataIndex: 'variacion', formato: 'moneda' },
          { titulo: 'Variacion %', dataIndex: 'variacion_pct_fmt' },
        ],
        datos: rows.map((r) => ({ ...r, variacion_pct_fmt: `${r.variacion_pct >= 0 ? '+' : ''}${r.variacion_pct.toFixed(1)}%` })),
        nombreArchivo: `comparativo-ventas-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Comparativo Ventas',
        tituloReporte: 'COMPARATIVO DE VENTAS',
        subtitulo: `P1: ${desde1} a ${hasta1} | P2: ${desde2} a ${hasta2}`,
        resumen: totalRow ? [
          { etiqueta: 'Total Periodo 1', valor: totalRow.total_p1, formato: 'moneda' },
          { etiqueta: 'Total Periodo 2', valor: totalRow.total_p2, formato: 'moneda' },
          { etiqueta: 'Variacion $', valor: totalRow.variacion, formato: 'moneda' },
        ] : [],
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
          <Title level={2} style={{ margin: 0 }}><SwapOutlined /> Comparativo de Ventas</Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>
          Exportar Excel
        </Button>
      </div>

      {totalRow && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Card><Statistic title="Total Periodo 1" value={totalRow.total_p1} precision={2} prefix="$" valueStyle={{ color: '#1890ff' }} /></Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card><Statistic title="Total Periodo 2" value={totalRow.total_p2} precision={2} prefix="$" valueStyle={{ color: '#722ed1' }} /></Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Variacion"
                value={totalRow.variacion_pct}
                precision={1}
                suffix="%"
                prefix={totalRow.variacion_pct >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                valueStyle={{ color: totalRow.variacion_pct >= 0 ? '#52c41a' : '#f5222d' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Periodo 1</Text>
            <RangePicker value={rango1} onChange={(d) => setRango1(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Periodo 2</Text>
            <RangePicker value={rango2} onChange={(d) => setRango2(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" />
          </div>
        </Space>

        <Table dataSource={dataRows} columns={columns} rowKey="periodo" pagination={false} scroll={{ x: 700 }} locale={{ emptyText: 'Selecciona ambos periodos' }} />
      </Card>
    </div>
  )
}
