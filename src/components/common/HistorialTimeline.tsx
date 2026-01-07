'use client'

import { useEffect, useState } from 'react'
import { Timeline, Typography, Spin, Empty, Tag } from 'antd'
import {
  PlusCircleOutlined,
  EditOutlined,
  SwapOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  UserOutlined
} from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { DocumentoTipo, AccionTipo } from '@/lib/utils/historial'
import dayjs from 'dayjs'

const { Text } = Typography

interface HistorialItem {
  id: string
  documento_tipo: DocumentoTipo
  documento_id: string
  documento_folio: string | null
  usuario_id: string | null
  usuario_nombre: string | null
  accion: AccionTipo
  descripcion: string | null
  created_at: string
}

interface HistorialTimelineProps {
  documentoTipo: DocumentoTipo
  documentoId: string
}

const accionConfig: Record<AccionTipo, { color: string; icon: React.ReactNode }> = {
  creado: { color: 'green', icon: <PlusCircleOutlined /> },
  editado: { color: 'blue', icon: <EditOutlined /> },
  status_cambiado: { color: 'orange', icon: <SwapOutlined /> },
  cancelado: { color: 'red', icon: <CloseCircleOutlined /> },
  convertido: { color: 'purple', icon: <SyncOutlined /> },
}

const accionLabels: Record<AccionTipo, string> = {
  creado: 'Creado',
  editado: 'Editado',
  status_cambiado: 'Estado cambiado',
  cancelado: 'Cancelado',
  convertido: 'Convertido',
}

export default function HistorialTimeline({ documentoTipo, documentoId }: HistorialTimelineProps) {
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistorial = async () => {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .schema('erp')
        .from('historial_documentos')
        .select('*')
        .eq('documento_tipo', documentoTipo)
        .eq('documento_id', documentoId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[HistorialTimeline] Error:', error)
      } else {
        setHistorial(data || [])
      }
      setLoading(false)
    }

    fetchHistorial()
  }, [documentoTipo, documentoId])

  if (loading) {
    return <Spin size="small" />
  }

  if (historial.length === 0) {
    return <Empty description="Sin historial" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  return (
    <Timeline
      items={historial.map((item) => {
        const config = accionConfig[item.accion] || { color: 'gray', icon: null }

        return {
          color: config.color,
          dot: config.icon,
          children: (
            <div>
              <div style={{ marginBottom: 4 }}>
                <Tag color={config.color}>{accionLabels[item.accion]}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}
                </Text>
              </div>
              {item.descripcion && (
                <Text style={{ display: 'block', marginBottom: 4 }}>{item.descripcion}</Text>
              )}
              {item.usuario_nombre && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <UserOutlined style={{ marginRight: 4 }} />
                  {item.usuario_nombre}
                </Text>
              )}
            </div>
          ),
        }
      })}
    />
  )
}
