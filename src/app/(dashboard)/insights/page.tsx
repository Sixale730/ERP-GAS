'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  Card, Row, Col, Statistic, Tag, Button, Space, Typography, Empty, Select, Input,
  Badge, Tooltip, Skeleton, Drawer, InputNumber, Switch, Alert, Divider, message,
} from 'antd'
import {
  BulbOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  RightOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useInsights, useDismissInsight, useInsightConfig, useSaveInsightConfig } from '@/lib/hooks/queries/useInsights'
import type { InsightConfigUpdate } from '@/lib/hooks/queries/useInsights'
import { useAuth } from '@/lib/hooks/useAuth'
import type { InsightItem, InsightTipo, InsightSeveridad } from '@/lib/insights/types'
import { SEVERIDAD_TAG_COLOR, SEVERIDAD_COLOR } from '@/lib/insights/types'
import { ALL_RULES } from '@/lib/insights/engine'

const { Title, Text } = Typography

// ─── Constantes ──────────────────────────────────────────────────────────────

const SEVERIDAD_ICON: Record<InsightSeveridad, React.ReactNode> = {
  critico: <CloseCircleOutlined />,
  alerta: <WarningOutlined />,
  info: <InfoCircleOutlined />,
  oportunidad: <BulbOutlined />,
}

const SEVERIDAD_LABEL: Record<InsightSeveridad, string> = {
  critico: 'Critico',
  alerta: 'Alerta',
  info: 'Info',
  oportunidad: 'Oportunidad',
}

const TIPO_OPTIONS: { value: InsightTipo | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos los tipos' },
  { value: 'inventario', label: 'Inventario' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'cobranza', label: 'Cobranza' },
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'pos', label: 'Punto de Venta' },
]

const SEVERIDAD_OPTIONS: { value: InsightSeveridad | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todas las severidades' },
  { value: 'critico', label: 'Critico' },
  { value: 'alerta', label: 'Alerta' },
  { value: 'info', label: 'Info' },
  { value: 'oportunidad', label: 'Oportunidad' },
]

const TIPO_LABEL: Record<string, string> = {
  inventario: 'Inventario',
  ventas: 'Ventas',
  cobranza: 'Cobranza',
  finanzas: 'Finanzas',
  pos: 'Punto de Venta',
}

const UMBRAL_UNIDAD: Record<string, string> = {
  'punto-reorden': 'productos min.',
  'capital-retenido': 'dias',
  'cliente-perdiendo-volumen': '%',
  'cotizaciones-estancadas': 'dias',
  'cartera-vencida': '$ MXN',
  'sobre-stock': 'meses',
  'categoria-declive': '%',
  'vendedor-bajo-rendimiento': '%',
  'margen-negativo': '%',
  'ticket-pos-bajando': '%',
  'rotacion-anormal': '%',
  'producto-estrella-cayendo': '',
  'flujo-efectivo-riesgo': '$ MXN',
  'abc-cliente-degradandose': '',
  'horarios-oportunidad': '%',
}

// ─── Formateo ────────────────────────────────────────────────────────────────

function formatMetrica(valor: number, unidad: string): string {
  if (unidad === '$') {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor)
  }
  if (unidad === '%') return `${valor}%`
  return `${valor} ${unidad}`
}

// ─── Insight Card ────────────────────────────────────────────────────────────

function InsightCard({ insight, onDismiss }: { insight: InsightItem; onDismiss: (key: string) => void }) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 12, borderLeft: `4px solid ${SEVERIDAD_COLOR[insight.severidad]}` }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <Tag color={SEVERIDAD_TAG_COLOR[insight.severidad]} icon={SEVERIDAD_ICON[insight.severidad]} style={{ margin: 0 }}>
              {SEVERIDAD_LABEL[insight.severidad]}
            </Tag>
            <Tag style={{ margin: 0 }}>{insight.tipo}</Tag>
            <Text strong style={{ fontSize: 15 }}>{insight.titulo}</Text>
          </div>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
            {insight.mensaje}
          </Text>
          <Space size={12}>
            <Text style={{ fontSize: 14, fontWeight: 600 }}>
              {formatMetrica(insight.metrica.valor, insight.metrica.unidad)}
              {insight.metrica.tendencia && (
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>({insight.metrica.tendencia})</Text>
              )}
            </Text>
            {insight.accion && (
              <Button type="primary" size="small" href={insight.accion.ruta} ghost>
                {insight.accion.label} <RightOutlined style={{ fontSize: 10 }} />
              </Button>
            )}
          </Space>
        </div>
        <Tooltip title="Descartar insight">
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => onDismiss(insight.key)} style={{ color: '#999', flexShrink: 0 }} />
        </Tooltip>
      </div>
    </Card>
  )
}

// ─── Drawer de Configuración ─────────────────────────────────────────────────

function ConfigDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { organizacion } = useAuth()
  const orgId = organizacion?.id
  const { data: configMap } = useInsightConfig(orgId)
  const saveMutation = useSaveInsightConfig()

  const [localConfig, setLocalConfig] = useState<Record<string, { umbral: number; activo: boolean }>>({})

  // Inicializar con defaults + overrides de DB
  useEffect(() => {
    const initial: Record<string, { umbral: number; activo: boolean }> = {}
    for (const rule of ALL_RULES) {
      initial[rule.key] = {
        umbral: configMap?.get(rule.key) ?? rule.umbralDefault,
        activo: true, // por defecto activo si no hay override
      }
    }
    setLocalConfig(initial)
  }, [configMap])

  const handleSave = async () => {
    const updates: InsightConfigUpdate[] = ALL_RULES.map((rule) => ({
      regla: rule.key,
      umbral: localConfig[rule.key]?.umbral ?? rule.umbralDefault,
      activo: localConfig[rule.key]?.activo ?? true,
    }))

    try {
      await saveMutation.mutateAsync(updates)
      message.success('Configuracion guardada')
      onClose()
    } catch {
      message.error('Error al guardar configuracion')
    }
  }

  const handleResetDefaults = () => {
    const defaults: Record<string, { umbral: number; activo: boolean }> = {}
    for (const rule of ALL_RULES) {
      defaults[rule.key] = { umbral: rule.umbralDefault, activo: true }
    }
    setLocalConfig(defaults)
  }

  // Agrupar reglas por tipo
  const reglasPorTipo = useMemo(() => {
    const grouped = new Map<string, typeof ALL_RULES>()
    for (const rule of ALL_RULES) {
      const arr = grouped.get(rule.tipo) || []
      arr.push(rule)
      grouped.set(rule.tipo, arr)
    }
    return grouped
  }, [])

  return (
    <Drawer
      title={<Space><SettingOutlined /> Configurar Insights</Space>}
      open={open}
      onClose={onClose}
      width={480}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleResetDefaults}>Restaurar defaults</Button>
          <Button type="primary" onClick={handleSave} loading={saveMutation.isPending}>
            Guardar
          </Button>
        </div>
      }
    >
      <Alert
        type="info"
        message="Los umbrales controlan cuando se activa cada insight. Desactiva los que no necesites."
        style={{ marginBottom: 16 }}
        showIcon
      />

      {Array.from(reglasPorTipo.entries()).map(([tipo, reglas]) => (
        <div key={tipo}>
          <Divider orientation="left" style={{ fontSize: 14 }}>
            {TIPO_LABEL[tipo] || tipo}
          </Divider>
          {reglas.map((rule) => {
            const cfg = localConfig[rule.key] || { umbral: rule.umbralDefault, activo: true }
            return (
              <div key={rule.key} style={{ marginBottom: 16, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 13 }}>{rule.titulo}</Text>
                  <Switch
                    size="small"
                    checked={cfg.activo}
                    onChange={(checked) => setLocalConfig((prev) => ({
                      ...prev,
                      [rule.key]: { ...cfg, activo: checked },
                    }))}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Umbral:</Text>
                  <InputNumber
                    size="small"
                    value={cfg.umbral}
                    min={0}
                    disabled={!cfg.activo}
                    style={{ width: 100 }}
                    onChange={(val) => setLocalConfig((prev) => ({
                      ...prev,
                      [rule.key]: { ...cfg, umbral: val ?? rule.umbralDefault },
                    }))}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {UMBRAL_UNIDAD[rule.key] || ''} (default: {rule.umbralDefault})
                  </Text>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </Drawer>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { data: insights, isLoading, total, descartados } = useInsights()
  const dismissMutation = useDismissInsight()

  const [filtroTipo, setFiltroTipo] = useState<InsightTipo | 'todos'>('todos')
  const [filtroSeveridad, setFiltroSeveridad] = useState<InsightSeveridad | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [configOpen, setConfigOpen] = useState(false)

  const handleDismiss = (key: string) => {
    dismissMutation.mutate(key)
  }

  const filtrados = useMemo(() => {
    let result = insights
    if (filtroTipo !== 'todos') result = result.filter((i) => i.tipo === filtroTipo)
    if (filtroSeveridad !== 'todos') result = result.filter((i) => i.severidad === filtroSeveridad)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      result = result.filter((i) => i.titulo.toLowerCase().includes(q) || i.mensaje.toLowerCase().includes(q))
    }
    return result
  }, [insights, filtroTipo, filtroSeveridad, busqueda])

  const stats = useMemo(() => {
    const criticos = insights.filter((i) => i.severidad === 'critico').length
    const alertas = insights.filter((i) => i.severidad === 'alerta').length
    return { total: insights.length, criticos, alertas, descartados }
  }, [insights, descartados])

  if (isLoading) {
    return (
      <div>
        <Title level={2}>Insights</Title>
        <Row gutter={[16, 16]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <Card><Skeleton active paragraph={{ rows: 1 }} /></Card>
            </Col>
          ))}
        </Row>
        <Card style={{ marginTop: 16 }}><Skeleton active paragraph={{ rows: 6 }} /></Card>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Title level={2} style={{ margin: 0 }}>Insights</Title>
          <Badge count={stats.total} style={{ backgroundColor: stats.criticos > 0 ? '#cf1322' : '#faad14' }} />
        </Space>
        <Button icon={<SettingOutlined />} onClick={() => setConfigOpen(true)}>
          Configurar
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Total Activos" value={stats.total} prefix={<BulbOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Criticos" value={stats.criticos} prefix={<CloseCircleOutlined />} valueStyle={{ color: stats.criticos > 0 ? '#cf1322' : '#3f8600' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Alertas" value={stats.alertas} prefix={<WarningOutlined />} valueStyle={{ color: stats.alertas > 0 ? '#faad14' : '#3f8600' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Descartados" value={stats.descartados} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#999' }} /></Card>
        </Col>
      </Row>

      {/* Filtros */}
      <Card style={{ marginTop: 16 }}>
        <Space wrap size={12}>
          <Select value={filtroTipo} onChange={setFiltroTipo} options={TIPO_OPTIONS} style={{ width: 180 }} />
          <Select value={filtroSeveridad} onChange={setFiltroSeveridad} options={SEVERIDAD_OPTIONS} style={{ width: 200 }} />
          <Input placeholder="Buscar en insights..." prefix={<SearchOutlined />} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 250 }} />
        </Space>
      </Card>

      {/* Lista de insights */}
      <div style={{ marginTop: 16 }}>
        {filtrados.length === 0 ? (
          <Card>
            <Empty
              image={<CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />}
              description={
                insights.length === 0
                  ? 'Todo esta en orden. No se detectaron situaciones que requieran atencion.'
                  : 'No hay insights que coincidan con los filtros seleccionados.'
              }
            />
          </Card>
        ) : (
          filtrados.map((insight) => (
            <InsightCard key={insight.id} insight={insight} onDismiss={handleDismiss} />
          ))
        )}
      </div>

      {/* Drawer de configuración */}
      <ConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  )
}
