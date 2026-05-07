'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Tag, Tooltip, Space, Typography } from 'antd'
import {
  CloseOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  InfoCircleOutlined,
  RightOutlined,
  LeftOutlined,
  GiftOutlined,
} from '@ant-design/icons'
import {
  useDashboardNotificacionesActivas,
  useDismissDashboardNotificacion,
  type DashboardNotificacion,
  type DashboardNotificacionTipo,
} from '@/lib/hooks/queries/useDashboardNotificaciones'

const { Text } = Typography

const TIPO_CONFIG: Record<
  DashboardNotificacionTipo,
  { color: string; bg: string; border: string; label: string; icon: React.ReactNode }
> = {
  nuevo: {
    color: '#52c41a',
    bg: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
    border: '#b7eb8f',
    label: 'NUEVO',
    icon: <RocketOutlined />,
  },
  mejora: {
    color: '#1677ff',
    bg: 'linear-gradient(135deg, #e6f4ff 0%, #bae0ff 100%)',
    border: '#91caff',
    label: 'MEJORA',
    icon: <ThunderboltOutlined />,
  },
  fix: {
    color: '#fa8c16',
    bg: 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)',
    border: '#ffd591',
    label: 'FIX',
    icon: <ToolOutlined />,
  },
  aviso: {
    color: '#595959',
    bg: 'linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%)',
    border: '#d9d9d9',
    label: 'AVISO',
    icon: <InfoCircleOutlined />,
  },
}

interface DashboardNotificacionesBannerProps {
  /** maxWidth en px, default 380 */
  maxWidth?: number
}

export default function DashboardNotificacionesBanner({ maxWidth = 380 }: DashboardNotificacionesBannerProps) {
  const router = useRouter()
  const { data: notificaciones } = useDashboardNotificacionesActivas()
  const dismissMutation = useDismissDashboardNotificacion()
  const [index, setIndex] = useState(0)

  const items = notificaciones ?? []
  const total = items.length
  const current = items[Math.min(index, Math.max(0, total - 1))]

  const cfg = useMemo(
    () => (current ? TIPO_CONFIG[current.tipo] : null),
    [current]
  )

  if (!current || !cfg) return null

  const handleCta = (n: DashboardNotificacion) => {
    if (n.cta_ruta) router.push(n.cta_ruta)
  }

  const handleDismiss = (id: string) => {
    dismissMutation.mutate(id, {
      onSuccess: () => {
        // Si era el ultimo, el componente desaparece. Si hay mas, ajustar index.
        if (index >= total - 1 && total > 1) setIndex(0)
      },
    })
  }

  return (
    <div
      style={{
        position: 'relative',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 12,
        padding: '10px 14px',
        maxWidth,
        minWidth: 280,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header: tipo tag + close */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Space size={6}>
          <Tag
            color={cfg.color}
            icon={cfg.icon}
            style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}
          >
            {cfg.label}
          </Tag>
          {total > 1 && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              {index + 1} / {total}
            </Text>
          )}
        </Space>
        <Tooltip title="Marcar como visto">
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleDismiss(current.id)}
            loading={dismissMutation.isPending}
            style={{ width: 24, height: 24, padding: 0, color: '#8c8c8c' }}
          />
        </Tooltip>
      </div>

      {/* Title */}
      <div
        style={{ cursor: current.cta_ruta ? 'pointer' : 'default' }}
        onClick={() => current.cta_ruta && handleCta(current)}
      >
        <Text strong style={{ fontSize: 13, color: '#1f1f1f', display: 'block', lineHeight: 1.3 }}>
          {current.titulo}
        </Text>
        {current.descripcion && (
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2, lineHeight: 1.3 }}>
            {current.descripcion}
          </Text>
        )}
      </div>

      {/* Footer: CTA + nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        {current.cta_ruta && current.cta_label ? (
          <Button
            type="link"
            size="small"
            icon={<GiftOutlined />}
            onClick={() => handleCta(current)}
            style={{ padding: 0, height: 22, fontSize: 11, fontWeight: 600, color: cfg.color }}
          >
            {current.cta_label}
          </Button>
        ) : (
          <span />
        )}

        {total > 1 && (
          <Space size={2}>
            <Button
              type="text"
              size="small"
              icon={<LeftOutlined />}
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              style={{ width: 22, height: 22, padding: 0 }}
            />
            <Button
              type="text"
              size="small"
              icon={<RightOutlined />}
              disabled={index === total - 1}
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
              style={{ width: 22, height: 22, padding: 0 }}
            />
          </Space>
        )}
      </div>
    </div>
  )
}
