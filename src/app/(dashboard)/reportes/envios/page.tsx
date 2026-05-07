'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Button, Space, Typography, Tag, Row, Col, Statistic, Spin
} from 'antd'
import {
  ArrowLeftOutlined, FileExcelOutlined, TruckOutlined, DollarOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import {
  useGuiasEnvio, PAQUETERIA_LABELS, STATUS_LABELS, STATUS_COLORS,
  type GuiaEnvio, type GuiaPaqueteria,
} from '@/lib/hooks/queries/useGuiasEnvio'
import { formatMoneyMXN, formatDate } from '@/lib/utils/format'
import { exportarExcel } from '@/lib/utils/excel'
import { RangePickerConPresets } from '@/components/common/RangePickerConPresets'

const { Title, Text } = Typography

interface AgregadoPaqueteria {
  paqueteria: GuiaPaqueteria
  cantidad: number
  costo_total: number
  cobrado_total: number
  margen_total: number
}

interface AgregadoMes {
  mes: string  // YYYY-MM
  cantidad: number
  costo_total: number
  cobrado_total: number
  margen_total: number
}

export default function ReporteEnviosPage() {
  const router = useRouter()
  const [fechaRange, setFechaRange] = useState<[Dayjs | null, Dayjs | null]>([
    dayjs().subtract(3, 'month').startOf('month'),
    dayjs().endOf('day'),
  ])
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const { data: guias = [], isLoading } = useGuiasEnvio({
    fechaDesde: fechaRange[0]?.format('YYYY-MM-DD') ?? null,
    fechaHasta: fechaRange[1]?.format('YYYY-MM-DD') ?? null,
  })

  const stats = useMemo(() => {
    const total = guias.length
    const costoTotal = guias.reduce((acc, g) => acc + Number(g.costo_real ?? 0), 0)
    const cobradoTotal = guias.reduce((acc, g) => acc + Number(g.monto_cobrado ?? 0), 0)
    const margenTotal = cobradoTotal - costoTotal
    const margenPct = costoTotal > 0 ? (margenTotal / costoTotal) * 100 : 0
    const entregadas = guias.filter(g => g.status === 'entregado').length
    const incidencias = guias.filter(g => g.status === 'incidencia' || g.status === 'devuelto').length
    return { total, costoTotal, cobradoTotal, margenTotal, margenPct, entregadas, incidencias }
  }, [guias])

  const porPaqueteria = useMemo<AgregadoPaqueteria[]>(() => {
    const map = new Map<GuiaPaqueteria, AgregadoPaqueteria>()
    guias.forEach(g => {
      const cur = map.get(g.paqueteria) ?? {
        paqueteria: g.paqueteria, cantidad: 0, costo_total: 0, cobrado_total: 0, margen_total: 0,
      }
      cur.cantidad += 1
      cur.costo_total += Number(g.costo_real ?? 0)
      cur.cobrado_total += Number(g.monto_cobrado ?? 0)
      cur.margen_total = cur.cobrado_total - cur.costo_total
      map.set(g.paqueteria, cur)
    })
    return Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad)
  }, [guias])

  const porMes = useMemo<AgregadoMes[]>(() => {
    const map = new Map<string, AgregadoMes>()
    guias.forEach(g => {
      if (!g.fecha_despacho) return
      const mes = dayjs(g.fecha_despacho).format('YYYY-MM')
      const cur = map.get(mes) ?? { mes, cantidad: 0, costo_total: 0, cobrado_total: 0, margen_total: 0 }
      cur.cantidad += 1
      cur.costo_total += Number(g.costo_real ?? 0)
      cur.cobrado_total += Number(g.monto_cobrado ?? 0)
      cur.margen_total = cur.cobrado_total - cur.costo_total
      map.set(mes, cur)
    })
    return Array.from(map.values()).sort((a, b) => b.mes.localeCompare(a.mes))
  }, [guias])

  const colsPaq: ColumnsType<AgregadoPaqueteria> = [
    { title: 'Paquetería', dataIndex: 'paqueteria', key: 'paq', render: p => PAQUETERIA_LABELS[p as GuiaPaqueteria] },
    { title: 'Envíos', dataIndex: 'cantidad', key: 'cnt', align: 'right' },
    { title: 'Costo total', dataIndex: 'costo_total', key: 'costo', align: 'right', render: (v: number) => formatMoneyMXN(v) },
    { title: 'Cobrado total', dataIndex: 'cobrado_total', key: 'cob', align: 'right', render: (v: number) => <Text type="success">{formatMoneyMXN(v)}</Text> },
    { title: 'Margen', dataIndex: 'margen_total', key: 'mg', align: 'right',
      render: (v: number) => <Text style={{ color: v >= 0 ? '#1677ff' : '#cf1322' }}>{formatMoneyMXN(v)}</Text> },
  ]

  const colsMes: ColumnsType<AgregadoMes> = [
    { title: 'Mes', dataIndex: 'mes', key: 'mes', render: (m: string) => dayjs(m + '-01').format('MMMM YYYY') },
    { title: 'Envíos', dataIndex: 'cantidad', key: 'cnt', align: 'right' },
    { title: 'Costo', dataIndex: 'costo_total', key: 'costo', align: 'right', render: (v: number) => formatMoneyMXN(v) },
    { title: 'Cobrado', dataIndex: 'cobrado_total', key: 'cob', align: 'right', render: (v: number) => <Text type="success">{formatMoneyMXN(v)}</Text> },
    { title: 'Margen', dataIndex: 'margen_total', key: 'mg', align: 'right',
      render: (v: number) => <Text style={{ color: v >= 0 ? '#1677ff' : '#cf1322' }}>{formatMoneyMXN(v)}</Text> },
  ]

  const colsDetalle: ColumnsType<GuiaEnvio> = [
    { title: 'Folio', dataIndex: 'folio', key: 'folio', width: 130 },
    { title: 'Despacho', dataIndex: 'fecha_despacho', key: 'fecha', width: 100, render: (f: string | null) => f ? formatDate(f) : '—' },
    { title: 'Status', dataIndex: 'status', key: 'st', width: 130, render: (s: GuiaEnvio['status']) => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag> },
    { title: 'Paquetería', dataIndex: 'paqueteria', key: 'paq', width: 130, render: p => PAQUETERIA_LABELS[p as GuiaPaqueteria] },
    { title: 'Cliente', dataIndex: 'cliente_nombre', key: 'cli', width: 200, ellipsis: true, render: (v: string | null) => v || '—' },
    { title: 'Costo', dataIndex: 'costo_real', key: 'costo', width: 110, align: 'right',
      render: (v: number | null) => v != null ? formatMoneyMXN(v) : <Text type="secondary">—</Text> },
    { title: 'Cobrado', dataIndex: 'monto_cobrado', key: 'cob', width: 110, align: 'right',
      render: (v: number | null) => v != null ? <Text type="success">{formatMoneyMXN(v)}</Text> : <Text type="secondary">—</Text> },
    { title: 'Margen', key: 'mg', width: 110, align: 'right',
      render: (_, r) => {
        if (r.costo_real == null || r.monto_cobrado == null) return <Text type="secondary">—</Text>
        const m = Number(r.monto_cobrado) - Number(r.costo_real)
        return <Text style={{ color: m >= 0 ? '#1677ff' : '#cf1322' }}>{formatMoneyMXN(m)}</Text>
      },
    },
  ]

  const handleExport = async () => {
    setGenerandoExcel(true)
    try {
      const datos = guias.map(g => ({
        folio: g.folio,
        fecha_despacho: g.fecha_despacho ? formatDate(g.fecha_despacho) : '',
        status: STATUS_LABELS[g.status],
        paqueteria: PAQUETERIA_LABELS[g.paqueteria],
        numero_guia: g.numero_guia ?? '',
        cliente: g.cliente_nombre ?? '',
        tipo_entrega: g.tipo_entrega,
        forma_pago: g.forma_pago_envio,
        costo: g.costo_real ?? 0,
        cobrado: g.monto_cobrado ?? 0,
        margen: (Number(g.monto_cobrado ?? 0) - Number(g.costo_real ?? 0)),
      }))
      await exportarExcel({
        columnas: [
          { titulo: 'Folio', dataIndex: 'folio' },
          { titulo: 'Despacho', dataIndex: 'fecha_despacho' },
          { titulo: 'Status', dataIndex: 'status' },
          { titulo: 'Paquetería', dataIndex: 'paqueteria' },
          { titulo: 'Núm. guía', dataIndex: 'numero_guia' },
          { titulo: 'Cliente', dataIndex: 'cliente' },
          { titulo: 'Tipo entrega', dataIndex: 'tipo_entrega' },
          { titulo: 'Forma pago', dataIndex: 'forma_pago' },
          { titulo: 'Costo', dataIndex: 'costo', formato: 'moneda' },
          { titulo: 'Cobrado', dataIndex: 'cobrado', formato: 'moneda' },
          { titulo: 'Margen', dataIndex: 'margen', formato: 'moneda' },
        ],
        datos,
        nombreArchivo: `envios-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Envíos',
        tituloReporte: 'REPORTE DE ENVÍOS',
        subtitulo: fechaRange[0] && fechaRange[1]
          ? `Periodo: ${fechaRange[0].format('DD/MM/YYYY')} - ${fechaRange[1].format('DD/MM/YYYY')}`
          : undefined,
        resumen: [
          { etiqueta: 'Total envíos', valor: stats.total, formato: 'numero' },
          { etiqueta: 'Costo total', valor: stats.costoTotal, formato: 'moneda' },
          { etiqueta: 'Cobrado al cliente', valor: stats.cobradoTotal, formato: 'moneda' },
          { etiqueta: 'Margen total', valor: stats.margenTotal, formato: 'moneda' },
          { etiqueta: 'Entregados', valor: stats.entregadas, formato: 'numero' },
          { etiqueta: 'Incidencias', valor: stats.incidencias, formato: 'numero' },
        ],
      })
    } finally {
      setGenerandoExcel(false)
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button>
          <Title level={2} style={{ margin: 0 }}><TruckOutlined /> Reporte de Envíos</Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExport} loading={generandoExcel} disabled={guias.length === 0}>
          Exportar Excel
        </Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePickerConPresets
            value={fechaRange}
            onChange={(d) => setFechaRange(d as [Dayjs | null, Dayjs | null])}
            format="DD/MM/YYYY"
            allowClear={false}
          />
        </Space>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Total envíos" value={stats.total} prefix={<TruckOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Costo total" value={stats.costoTotal} prefix="$" precision={2} valueStyle={{ color: '#cf1322' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Cobrado al cliente" value={stats.cobradoTotal} prefix="$" precision={2} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title={`Margen ${stats.margenPct >= 0 ? '+' : ''}${stats.margenPct.toFixed(1)}%`}
              value={stats.margenTotal}
              prefix="$"
              precision={2}
              valueStyle={{ color: stats.margenTotal >= 0 ? '#1677ff' : '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title={<Space><DollarOutlined /> Por paquetería</Space>} style={{ marginBottom: 16 }}>
            <Table
              rowKey="paqueteria"
              dataSource={porPaqueteria}
              columns={colsPaq}
              pagination={false}
              size="small"
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Por mes" style={{ marginBottom: 16 }}>
            <Table
              rowKey="mes"
              dataSource={porMes}
              columns={colsMes}
              pagination={false}
              size="small"
              loading={isLoading}
            />
          </Card>
        </Col>
      </Row>

      <Card title={`Detalle de envíos (${guias.length})`}>
        <Table
          rowKey="id"
          dataSource={guias}
          columns={colsDetalle}
          loading={isLoading}
          pagination={{ pageSize: 25, showTotal: (t) => `${t} envíos` }}
          scroll={{ x: 1100 }}
          onRow={(r) => ({ onClick: () => router.push(`/envios/${r.id}`), style: { cursor: 'pointer' } })}
        />
      </Card>
    </div>
  )
}
