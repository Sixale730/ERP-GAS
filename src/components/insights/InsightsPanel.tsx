'use client'

import { useMemo } from 'react'
import { Card, Tag, Button, Space, Typography, Skeleton, Badge, Tooltip } from 'antd'
import {
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  BulbOutlined,
  RightOutlined,
  CloseOutlined,
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

function InsightRow({ insight, onDismiss }: { insight: InsightItem; onDismiss: (key: string) => void }) {
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

// ─── Panel principal ─────────────────────────────────────────────────────────

export default function InsightsPanel() {
  const { data: insights, isLoading, total } = useInsights()
  const dismissMutation = useDismissInsight()

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
        <InsightRow key={insight.id} insight={insight} onDismiss={handleDismiss} />
      ))}
    </Card>
  )
}
