'use client'

import { useMemo, useState } from 'react'
import { Card, Tag, Button, Space, Typography, Skeleton, Badge, Tooltip, Drawer } from 'antd'
import Link from 'next/link'
import {
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  BulbOutlined,
  RightOutlined,
  CloseOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useInsights, useDismissInsight } from '@/lib/hooks/queries/useInsights'
import type { InsightItem, InsightSeveridad } from '@/lib/insights/types'
import { SEVERIDAD_TAG_COLOR } from '@/lib/insights/types'

const { Text } = Typography

// ─── Mapeo de iconos por severidad ───────────────────────────────────────────

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

// ─── Formateo de métrica ─────────────────────────────────────────────────────

function formatMetrica(valor: number, unidad: string): string {
  if (unidad === '$') {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor)
  }
  if (unidad === '%') {
    return `${valor}%`
  }
  return `${valor} ${unidad}`
}

// ─── Componente de un insight individual ─────────────────────────────────────

function InsightRow({
  insight,
  onDismiss,
  onExplain,
}: {
  insight: InsightItem
  onDismiss: (key: string) => void
  onExplain: (i: InsightItem) => void
}) {
  const tieneTrazabilidad = !!(insight.explicacion || insight.parametros_snapshot)
  return (
    <div
      style={{
        padding: '12px 0',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <Tag
            color={SEVERIDAD_TAG_COLOR[insight.severidad]}
            icon={SEVERIDAD_ICON[insight.severidad]}
            style={{ margin: 0 }}
          >
            {SEVERIDAD_LABEL[insight.severidad]}
          </Tag>
          <Text strong style={{ fontSize: 14 }}>{insight.titulo}</Text>
          {tieneTrazabilidad && (
            <Tooltip title="¿Por qué este insight?">
              <Button
                type="text"
                size="small"
                icon={<QuestionCircleOutlined />}
                onClick={() => onExplain(insight)}
                style={{ color: '#1890ff', padding: '0 4px' }}
              />
            </Tooltip>
          )}
        </div>
        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
          {insight.mensaje}
        </Text>
        <Space size={8}>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>
            {formatMetrica(insight.metrica.valor, insight.metrica.unidad)}
          </Text>
          {insight.accion && (
            <Button type="link" size="small" href={insight.accion.ruta} style={{ padding: 0, fontSize: 13 }}>
              {insight.accion.label} <RightOutlined style={{ fontSize: 10 }} />
            </Button>
          )}
        </Space>
      </div>
      <Tooltip title="Descartar">
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={() => onDismiss(insight.key)}
          style={{ color: '#999', flexShrink: 0, marginTop: 2 }}
        />
      </Tooltip>
    </div>
  )
}

function ExplainDrawer({ insight, onClose }: { insight: InsightItem | null; onClose: () => void }) {
  return (
    <Drawer
      title={insight ? `¿Por qué "${insight.titulo}"?` : 'Trazabilidad'}
      placement="right"
      onClose={onClose}
      open={!!insight}
      width={420}
    >
      {insight && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {insight.regla_key && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Regla que generó este insight</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color="blue">{insight.regla_key}</Tag>
              </div>
            </div>
          )}
          {insight.explicacion && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Explicación</Text>
              <div style={{ marginTop: 4, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <Text>{insight.explicacion}</Text>
              </div>
            </div>
          )}
          {insight.parametros_snapshot && Object.keys(insight.parametros_snapshot).length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Parámetros usados al evaluar</Text>
              <div style={{ marginTop: 4 }}>
                {Object.entries(insight.parametros_snapshot).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <Text code style={{ fontSize: 12 }}>{k}</Text>
                    <Text strong style={{ fontSize: 12 }}>{String(v)}</Text>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <Link href="/configuracion/sistema">
              <Button icon={<SettingOutlined />} block>
                Ajustar parámetros del sistema
              </Button>
            </Link>
          </div>
        </Space>
      )}
    </Drawer>
  )
}

// ─── Panel principal ─────────────────────────────────────────────────────────

export default function InsightsPanel() {
  const { data: insights, isLoading, total } = useInsights()
  const dismissMutation = useDismissInsight()
  const [explainItem, setExplainItem] = useState<InsightItem | null>(null)

  const visibles = useMemo(() => insights.slice(0, 5), [insights])

  const handleDismiss = (key: string) => {
    dismissMutation.mutate(key)
  }

  // Contar por severidad para el badge
  const criticos = useMemo(() => insights.filter((i) => i.severidad === 'critico').length, [insights])

  if (isLoading) {
    return (
      <Card
        title={
          <Space>
            <BulbOutlined style={{ color: '#faad14' }} />
            Insights
          </Space>
        }
      >
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    )
  }

  if (!insights || insights.length === 0) {
    return null // No mostrar panel vacío en el dashboard
  }

  return (
    <Card
      title={
        <Space>
          <BulbOutlined style={{ color: '#faad14' }} />
          Insights
          <Badge count={insights.length} style={{ backgroundColor: criticos > 0 ? '#cf1322' : '#faad14' }} />
        </Space>
      }
      extra={
        insights.length > 5 ? (
          <Button type="link" href="/insights" style={{ padding: 0 }}>
            Ver todos ({total})
          </Button>
        ) : null
      }
      styles={{ body: { paddingTop: 0, paddingBottom: 0 } }}
    >
      {visibles.map((insight) => (
        <InsightRow
          key={insight.id}
          insight={insight}
          onDismiss={handleDismiss}
          onExplain={setExplainItem}
        />
      ))}
      <ExplainDrawer insight={explainItem} onClose={() => setExplainItem(null)} />
    </Card>
  )
}
