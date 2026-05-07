'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Button, Space, Typography, Tag, Input, Select, Row, Col, Statistic, Tooltip
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined, TruckOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, LinkOutlined, DollarOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  useGuiasEnvio, buildTrackingUrl, PAQUETERIA_LABELS, STATUS_LABELS, STATUS_COLORS,
  type GuiaEnvio, type GuiaStatus, type GuiaPaqueteria,
} from '@/lib/hooks/queries/useGuiasEnvio'
import { formatMoneyMXN, formatDate } from '@/lib/utils/format'
import { PageHeaderActions } from '@/components/common/PageHeaderActions'
import { ResponsiveListTable } from '@/components/common/ResponsiveListTable'
import { RangePickerConPresets } from '@/components/common/RangePickerConPresets'
import type { Dayjs } from 'dayjs'

const { Text } = Typography

export default function EnviosPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<GuiaStatus | null>(null)
  const [paqueteriaFilter, setPaqueteriaFilter] = useState<GuiaPaqueteria | null>(null)
  const [fechaRange, setFechaRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)

  const { data: guias = [], isLoading } = useGuiasEnvio({
    status: statusFilter,
    paqueteria: paqueteriaFilter,
    search,
    fechaDesde: fechaRange?.[0]?.format('YYYY-MM-DD') ?? null,
    fechaHasta: fechaRange?.[1]?.format('YYYY-MM-DD') ?? null,
  })

  // KPIs simples
  const kpis = useMemo(() => {
    const enTransito = guias.filter(g => g.status === 'en_paqueteria' || g.status === 'en_transito').length
    const entregados = guias.filter(g => g.status === 'entregado').length
    const incidencias = guias.filter(g => g.status === 'incidencia' || g.status === 'devuelto').length
    const totalGastado = guias.reduce((acc, g) => acc + Number(g.costo_real ?? 0), 0)
    return { total: guias.length, enTransito, entregados, incidencias, totalGastado }
  }, [guias])

  const columns: ColumnsType<GuiaEnvio> = useMemo(() => [
    {
      title: 'Folio', dataIndex: 'folio', key: 'folio', width: 140,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 140,
      render: (s: GuiaStatus) => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>,
    },
    {
      title: 'Cliente', dataIndex: 'cliente_nombre', key: 'cliente', width: 220, ellipsis: true,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Paquetería', dataIndex: 'paqueteria', key: 'paq', width: 130,
      render: (p: GuiaPaqueteria) => PAQUETERIA_LABELS[p],
    },
    {
      title: 'Núm. Guía', dataIndex: 'numero_guia', key: 'guia', width: 160,
      render: (g: string | null, r) => {
        if (!g) return <Text type="secondary">—</Text>
        const url = buildTrackingUrl(r.paqueteria, g)
        return url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            <Text code style={{ fontSize: 12 }}>{g}</Text>
            <LinkOutlined style={{ marginLeft: 4, fontSize: 11 }} />
          </a>
        ) : <Text code style={{ fontSize: 12 }}>{g}</Text>
      },
    },
    {
      title: 'Tipo / Pago', key: 'tipopago', width: 150,
      render: (_, r) => (
        <Space size={2} direction="vertical">
          <Tag style={{ fontSize: 10, margin: 0 }}>{r.tipo_entrega === 'ocurre' ? 'Ocurre' : 'Domicilio'}</Tag>
          <Tag color={r.forma_pago_envio === 'pagado' ? 'cyan' : 'magenta'} style={{ fontSize: 10, margin: 0 }}>
            {r.forma_pago_envio === 'pagado' ? 'Pagado' : 'Por cobrar'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Destino', key: 'destino', width: 160, ellipsis: true,
      render: (_, r) => {
        const partes = [r.destino_ciudad, r.destino_estado].filter(Boolean).join(', ')
        return partes || <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Costo', dataIndex: 'costo_real', key: 'costo', width: 100, align: 'right',
      render: (v: number | null) => v != null ? formatMoneyMXN(v) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Cobrado', dataIndex: 'monto_cobrado', key: 'cobrado', width: 100, align: 'right',
      render: (v: number | null) => v != null ? <Text type="success">{formatMoneyMXN(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Despacho', dataIndex: 'fecha_despacho', key: 'fecha', width: 100,
      render: (f: string | null) => f ? formatDate(f) : <Text type="secondary">—</Text>,
    },
    {
      title: '', key: 'acciones', width: 80, fixed: 'right' as const,
      render: (_, r) => (
        <Tooltip title="Ver detalle">
          <Button size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); router.push(`/envios/${r.id}`) }} />
        </Tooltip>
      ),
    },
  ], [router])

  const renderMobile = (r: GuiaEnvio) => (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Text strong>{r.folio}</Text>
        <Tag color={STATUS_COLORS[r.status]} style={{ margin: 0 }}>{STATUS_LABELS[r.status]}</Tag>
      </Space>
      <Text>{r.cliente_nombre || '—'}</Text>
      <Space size={4} wrap>
        <Tag style={{ fontSize: 10 }}>{PAQUETERIA_LABELS[r.paqueteria]}</Tag>
        <Tag style={{ fontSize: 10 }}>{r.tipo_entrega === 'ocurre' ? 'Ocurre' : 'Domicilio'}</Tag>
        <Tag color={r.forma_pago_envio === 'pagado' ? 'cyan' : 'magenta'} style={{ fontSize: 10 }}>
          {r.forma_pago_envio === 'pagado' ? 'Pagado' : 'Por cobrar'}
        </Tag>
      </Space>
      {r.numero_guia && <Text code style={{ fontSize: 11 }}>{r.numero_guia}</Text>}
      <Space style={{ justifyContent: 'space-between', width: '100%', fontSize: 12 }}>
        <span>{r.fecha_despacho ? formatDate(r.fecha_despacho) : '—'}</span>
        <Text type="secondary">{r.costo_real != null ? formatMoneyMXN(r.costo_real) : ''}</Text>
      </Space>
    </Space>
  )

  return (
    <div>
      <PageHeaderActions
        titulo="Envíos / Guías"
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push('/envios/nueva')}
          >
            Nueva guía
          </Button>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Total guías" value={kpis.total} prefix={<TruckOutlined />} valueStyle={{ color: '#1677ff' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="En tránsito" value={kpis.enTransito} valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Entregados" value={kpis.entregados} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Incidencias"
              value={kpis.incidencias}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: kpis.incidencias > 0 ? '#cf1322' : '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={8}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Folio, núm. guía, cliente, ciudad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v ?? null)}
            options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
          <Select
            placeholder="Paquetería"
            allowClear
            style={{ width: 180 }}
            value={paqueteriaFilter}
            onChange={(v) => setPaqueteriaFilter(v ?? null)}
            options={Object.entries(PAQUETERIA_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
          <RangePickerConPresets
            value={fechaRange}
            onChange={(d) => setFechaRange(d as [Dayjs | null, Dayjs | null] | null)}
            placeholder={['Desde', 'Hasta']}
            format="DD/MM/YYYY"
          />
          <Tooltip title={`Gasto total en envíos del periodo: ${formatMoneyMXN(kpis.totalGastado)}`}>
            <Tag color="blue" icon={<DollarOutlined />} style={{ fontSize: 13, padding: '4px 10px' }}>
              {formatMoneyMXN(kpis.totalGastado)} gastado
            </Tag>
          </Tooltip>
        </Space>
      </Card>

      <Card>
        <ResponsiveListTable<GuiaEnvio>
          dataSource={guias}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 25, showTotal: (t) => `${t} guías` }}
          scroll={{ x: 1500 }}
          mobileRender={renderMobile}
          onMobileItemClick={(r) => router.push(`/envios/${r.id}`)}
        />
      </Card>
    </div>
  )
}
