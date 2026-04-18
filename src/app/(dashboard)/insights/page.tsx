'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  Card, Collapse, Tag, Button, Space, Typography, Empty, Select, Input,
  Badge, Tooltip, Skeleton, Drawer, InputNumber, Switch, Alert, Divider, message, Grid,
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
  RiseOutlined,
  FallOutlined,
  MinusOutlined,
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

function getTendenciaIcon(tendencia?: 'subiendo' | 'bajando' | 'estable') {
  if (!tendencia) return null
  if (tendencia === 'subiendo') return <RiseOutlined style={{ fontSize: 18, color: '#8c8c8c' }} />
  if (tendencia === 'bajando') return <FallOutlined style={{ fontSize: 18, color: '#8c8c8c' }} />
  return <MinusOutlined style={{ fontSize: 16, color: '#bfbfbf' }} />
}

const SEVERITY_ORDER: InsightSeveridad[] = ['critico', 'alerta', 'info', 'oportunidad']

// ─── Insight Card ────────────────────────────────────────────────────────────

function InsightCard({ insight, onDismiss }: { insight: InsightItem; onDismiss: (key: string) => void }) {
  const color = SEVERIDAD_COLOR[insight.severidad]
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.sm
  return (
    <Card
      size="small"
      style={{ marginBottom: 8, borderLeft: `4px solid ${color}`, animation: 'fadeIn 0.3s ease-out' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: isMobile ? 8 : 16,
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        {/* Header compacto en mobile: metrica + dismiss arriba del texto */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Text strong style={{ fontSize: 18, lineHeight: 1.1, color, wordBreak: 'break-word' }}>
              {formatMetrica(insight.metrica.valor, insight.metrica.unidad)}
            </Text>
            <Tooltip title="Descartar">
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => onDismiss(insight.key)}
                style={{ color: '#bfbfbf', fontSize: 12, width: 24, height: 24 }}
              />
            </Tooltip>
          </div>
        )}

        {/* Izquierda: Título + Mensaje + Acción */}
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4, lineHeight: 1.4 }}>
            {insight.titulo}
          </Text>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8, lineHeight: 1.5 }}>
            {insight.mensaje}
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Tag style={{ margin: 0, fontSize: 11 }}>{TIPO_LABEL[insight.tipo] || insight.tipo}</Tag>
            {insight.accion && (
              <Button type="link" size="small" href={insight.accion.ruta} style={{ padding: 0, fontSize: 13, height: 'auto' }}>
                {insight.accion.label} <RightOutlined style={{ fontSize: 10 }} />
              </Button>
            )}
            {isMobile && insight.metrica.tendencia && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {getTendenciaIcon(insight.metrica.tendencia)}
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                  {insight.metrica.tendencia}
                </Text>
              </span>
            )}
          </div>
        </div>

        {/* Derecha (solo desktop): Métrica + Tendencia + Descartar */}
        {!isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 4, maxWidth: '40%' }}>
            <Tooltip title="Descartar">
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => onDismiss(insight.key)}
                style={{ color: '#bfbfbf', fontSize: 12, width: 24, height: 24 }}
              />
            </Tooltip>
            <div style={{ textAlign: 'right' }}>
              <Text strong style={{ fontSize: 22, lineHeight: 1.1, color, wordBreak: 'break-word' }}>
                {formatMetrica(insight.metrica.valor, insight.metrica.unidad)}
              </Text>
              {insight.metrica.tendencia && (
                <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  {getTendenciaIcon(insight.metrica.tendencia)}
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                    {insight.metrica.tendencia}
                  </Text>
                </div>
              )}
            </div>
          </div>
        )}
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

  const grouped = useMemo(() => {
    const groups: { severidad: InsightSeveridad; items: InsightItem[] }[] = []
    for (const sev of SEVERITY_ORDER) {
      const items = filtrados.filter((i) => i.severidad === sev)
      if (items.length > 0) groups.push({ severidad: sev, items })
    }
    return groups
  }, [filtrados])

  const defaultActiveKey = useMemo(() => {
    if (grouped.some((g) => g.severidad === 'critico')) return ['critico']
    if (grouped.length > 0) return [grouped[0].severidad]
    return []
  }, [grouped])

  if (isLoading) {
    return (
      <div>
        <Title level={2}>Insights</Title>
        <Skeleton.Input active style={{ width: '100%', height: 56, marginBottom: 16 }} />
        <Card style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 600, height: 32 }} />
        </Card>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} style={{ marginBottom: 12 }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        ))}
      </div>
    )
  }

  const numCriticos = insights.filter((i) => i.severidad === 'critico').length
  const numAlertas = insights.filter((i) => i.severidad === 'alerta').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Title level={2} style={{ margin: 0 }}>Insights</Title>
          <Badge
            count={insights.length}
            style={{
              backgroundColor: numCriticos > 0 ? '#cf1322' : numAlertas > 0 ? '#faad14' : '#52c41a',
            }}
          />
        </Space>
        <Button icon={<SettingOutlined />} onClick={() => setConfigOpen(true)}>
          Configurar
        </Button>
      </div>

      {/* Banner contextual */}
      {insights.length === 0 ? (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="Todo esta en orden"
          description="No se detectaron situaciones que requieran atencion."
          style={{ marginBottom: 16 }}
        />
      ) : numCriticos > 0 ? (
        <Alert
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
          message={`${numCriticos} situacion${numCriticos > 1 ? 'es' : ''} critica${numCriticos > 1 ? 's' : ''} requiere${numCriticos > 1 ? 'n' : ''} atencion inmediata`}
          description={numAlertas > 0 ? `Ademas hay ${numAlertas} alerta${numAlertas > 1 ? 's' : ''} activa${numAlertas > 1 ? 's' : ''}.` : undefined}
          style={{ marginBottom: 16 }}
        />
      ) : numAlertas > 0 ? (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`${numAlertas} alerta${numAlertas > 1 ? 's' : ''} activa${numAlertas > 1 ? 's' : ''}`}
          description={`${insights.length} insights activos en total.`}
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          icon={<BulbOutlined />}
          message="Todo bajo control"
          description={`${insights.length} recomendacion${insights.length > 1 ? 'es' : ''} disponible${insights.length > 1 ? 's' : ''}.`}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Filtros */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <Select value={filtroTipo} onChange={setFiltroTipo} options={TIPO_OPTIONS} style={{ width: 180 }} />
          <Select value={filtroSeveridad} onChange={setFiltroSeveridad} options={SEVERIDAD_OPTIONS} style={{ width: 200 }} />
          <Input placeholder="Buscar en insights..." prefix={<SearchOutlined />} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} allowClear style={{ width: 250 }} />
        </Space>
      </Card>

      {/* Lista de insights agrupados por severidad */}
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
        <Collapse
          defaultActiveKey={defaultActiveKey}
          style={{ background: 'transparent', border: 'none' }}
          items={grouped.map((group) => ({
            key: group.severidad,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: SEVERIDAD_COLOR[group.severidad], fontSize: 16 }}>
                  {SEVERIDAD_ICON[group.severidad]}
                </span>
                <Text strong style={{ fontSize: 15 }}>
                  {SEVERIDAD_LABEL[group.severidad]}
                </Text>
                <Badge
                  count={group.items.length}
                  style={{ backgroundColor: SEVERIDAD_COLOR[group.severidad] }}
                />
              </div>
            ),
            children: (
              <div style={{ paddingTop: 4 }}>
                {group.items.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} onDismiss={handleDismiss} />
                ))}
              </div>
            ),
            style: {
              marginBottom: 12,
              borderRadius: 8,
              border: `1px solid ${SEVERIDAD_COLOR[group.severidad]}20`,
              overflow: 'hidden',
            },
          }))}
        />
      )}

      {/* Drawer de configuración */}
      <ConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  )
}
