'use client'

import { useRouter } from 'next/navigation'
import { Card, Button, Space, Typography, Tag, Empty, Spin } from 'antd'
import { TruckOutlined, PlusOutlined, EyeOutlined, LinkOutlined } from '@ant-design/icons'
import {
  useGuiasByCotizacion, buildTrackingUrl,
  PAQUETERIA_LABELS, STATUS_LABELS, STATUS_COLORS,
} from '@/lib/hooks/queries/useGuiasEnvio'
import { formatMoneyMXN, formatDate } from '@/lib/utils/format'

const { Text } = Typography

interface GuiasLigadasCardProps {
  cotizacionId: string
  /** Mostrar boton para crear guia nueva (solo para status orden_venta/facturada) */
  permitirCrear?: boolean
}

export default function GuiasLigadasCard({ cotizacionId, permitirCrear = true }: GuiasLigadasCardProps) {
  const router = useRouter()
  const { data: guias = [], isLoading } = useGuiasByCotizacion(cotizacionId)

  return (
    <Card
      title={
        <Space>
          <TruckOutlined />
          Guías de envío {guias.length > 0 && <Tag color="blue">{guias.length}</Tag>}
        </Space>
      }
      extra={
        permitirCrear && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            onClick={() => router.push(`/envios/nueva?cotizacion_id=${cotizacionId}`)}
          >
            Nueva guía
          </Button>
        )
      }
      style={{ marginBottom: 16 }}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
      ) : guias.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Esta OV todavía no tiene guías de envío"
          style={{ margin: '12px 0' }}
        />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {guias.map(g => {
            const trackingUrl = buildTrackingUrl(g.paqueteria, g.numero_guia)
            return (
              <div
                key={g.id}
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onClick={() => router.push(`/envios/${g.id}`)}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <Space size={6} wrap>
                    <Text strong>{g.folio}</Text>
                    <Tag color={STATUS_COLORS[g.status]} style={{ margin: 0 }}>{STATUS_LABELS[g.status]}</Tag>
                    <Tag style={{ margin: 0, fontSize: 11 }}>{PAQUETERIA_LABELS[g.paqueteria]}</Tag>
                    {g.numero_guia && (
                      trackingUrl ? (
                        <a
                          href={trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Text code style={{ fontSize: 11 }}>{g.numero_guia}</Text> <LinkOutlined style={{ fontSize: 10 }} />
                        </a>
                      ) : <Text code style={{ fontSize: 11 }}>{g.numero_guia}</Text>
                    )}
                  </Space>
                  <Space size={6}>
                    {g.fecha_despacho && <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(g.fecha_despacho)}</Text>}
                    {g.costo_real != null && <Text style={{ fontSize: 12 }}>{formatMoneyMXN(g.costo_real)}</Text>}
                    <Button size="small" type="link" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); router.push(`/envios/${g.id}`) }} />
                  </Space>
                </Space>
              </div>
            )
          })}
        </Space>
      )}
    </Card>
  )
}
