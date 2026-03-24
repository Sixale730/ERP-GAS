'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Divider } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, FileTextOutlined } from '@ant-design/icons'
import { useEstadoResultados } from '@/lib/hooks/queries/useReportesFinanzas'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

function LineaResultado({ label, valor, bold, color, indent }: { label: string; valor: number; bold?: boolean; color?: string; indent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', paddingLeft: indent ? 32 : 16, borderBottom: '1px solid #f0f0f0' }}>
      <Text strong={bold} style={{ color }}>{label}</Text>
      <Text strong={bold} style={{ color }}>{formatMoneySimple(valor)}</Text>
    </div>
  )
}

export default function ReporteEstadoResultadosPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([dayjs().startOf('month'), dayjs().endOf('month')])
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null
  const { data, isLoading } = useEstadoResultados(fechaDesde, fechaHasta, organizacion?.id)

  const handleExportarExcel = async () => {
    if (!data) return
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'Concepto', dataIndex: 'concepto' },
          { titulo: 'Monto', dataIndex: 'monto', formato: 'moneda' },
        ],
        datos: [
          { concepto: 'Ingresos por Ventas', monto: data.ingresos },
          { concepto: '(-) Costo de Ventas', monto: data.costo_ventas },
          { concepto: '= Utilidad Bruta', monto: data.utilidad_bruta },
          { concepto: 'Margen Bruto %', monto: data.margen_bruto_pct },
        ],
        nombreArchivo: `estado-resultados-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Estado de Resultados',
        tituloReporte: 'ESTADO DE RESULTADOS SIMPLIFICADO',
        subtitulo: fechaDesde && fechaHasta ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}` : undefined,
        resumen: [
          { etiqueta: 'Ingresos', valor: data.ingresos, formato: 'moneda' },
          { etiqueta: 'Utilidad Bruta', valor: data.utilidad_bruta, formato: 'moneda' },
          { etiqueta: 'Margen Bruto', valor: data.margen_bruto_pct, formato: 'numero' },
        ],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><FileTextOutlined /> Estado de Resultados</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel} disabled={!data}>Exportar Excel</Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space><RangePicker value={fechaRange} onChange={(d) => setFechaRange(d as [dayjs.Dayjs | null, dayjs.Dayjs | null])} format="DD/MM/YYYY" /></Space>
      </Card>

      {data && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={6}><Card><Statistic title="Ingresos" value={data.ingresos} precision={2} prefix="$" valueStyle={{ color: '#52c41a' }} /></Card></Col>
            <Col xs={24} sm={6}><Card><Statistic title="Costo de Ventas" value={data.costo_ventas} precision={2} prefix="$" valueStyle={{ color: '#f5222d' }} /></Card></Col>
            <Col xs={24} sm={6}><Card><Statistic title="Utilidad Bruta" value={data.utilidad_bruta} precision={2} prefix="$" valueStyle={{ color: data.utilidad_bruta >= 0 ? '#1890ff' : '#f5222d' }} /></Card></Col>
            <Col xs={24} sm={6}><Card><Statistic title="Margen Bruto" value={data.margen_bruto_pct} precision={1} suffix="%" valueStyle={{ color: '#722ed1' }} /></Card></Col>
          </Row>

          <Card title="Estado de Resultados Simplificado">
            <LineaResultado label="Ingresos por Ventas" valor={data.ingresos} bold />
            <Divider style={{ margin: '4px 0' }} />
            <LineaResultado label="(-) Costo de Ventas" valor={data.costo_ventas} indent color="#f5222d" />
            <Divider style={{ margin: '4px 0' }} />
            <LineaResultado label="= Utilidad Bruta" valor={data.utilidad_bruta} bold color={data.utilidad_bruta >= 0 ? '#52c41a' : '#f5222d'} />
            <div style={{ padding: '12px 16px', background: '#fafafa', marginTop: 8, borderRadius: 4 }}>
              <Text type="secondary">
                Basado en {data.num_facturas} facturas y {data.num_productos_vendidos} unidades vendidas.
                Margen bruto: {data.margen_bruto_pct}%
              </Text>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
