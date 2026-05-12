'use client'

import { useEffect, useMemo } from 'react'
import { Card, List, Tag, Typography, Space, Empty, Button, Result, Skeleton } from 'antd'
import { BugOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  useMisReportes,
  useMarcarReporteVisto,
  type ReporteStatus,
  type ReporteError,
} from '@/lib/hooks/queries/useReportesErrores'

const { Title, Text, Paragraph } = Typography

const STATUS_META: Record<ReporteStatus, { label: string; color: string; icon: React.ReactNode }> = {
  nuevo:        { label: 'Nuevo',        color: 'red',     icon: <ClockCircleOutlined /> },
  en_revision:  { label: 'En revisión',  color: 'orange',  icon: <ClockCircleOutlined /> },
  resuelto:     { label: 'Resuelto',     color: 'green',   icon: <CheckCircleOutlined /> },
  descartado:   { label: 'Descartado',   color: 'default', icon: <CheckCircleOutlined /> },
}

export default function MisReportesPage() {
  const { isAdmin, loading: authLoading } = useAuth()
  const { data: reportes, isLoading } = useMisReportes()
  const marcarVisto = useMarcarReporteVisto()

  // Auto-marcar como vistos los resueltos al entrar a la pagina (con pequeno debounce mental: al cargar)
  const idsSinLeer = useMemo(
    () => (reportes ?? [])
      .filter(r => (r.status === 'resuelto' || r.status === 'descartado') && !r.visto_por_reportante)
      .map(r => r.id),
    [reportes]
  )

  useEffect(() => {
    if (!idsSinLeer.length) return
    idsSinLeer.forEach(id => {
      marcarVisto.mutate(id, {
        onError: () => {
          // silencioso: no es critico si falla
        },
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSinLeer.join(',')])

  if (!authLoading && !isAdmin) {
    return (
      <Result
        status="403"
        title="Acceso denegado"
        subTitle="Esta sección solo está disponible para administradores."
        extra={<Button href="/dashboard">Volver al Dashboard</Button>}
      />
    )
  }

  return (
    <div>
      <Title level={2} style={{ marginTop: 0 }}>
        <BugOutlined /> Mis reportes de error
      </Title>
      <Paragraph type="secondary">
        Aquí ves el seguimiento de los errores que has reportado. Cuando se resuelven aparece la nota del equipo de soporte.
      </Paragraph>

      <Card>
        {isLoading || authLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : !reportes || reportes.length === 0 ? (
          <Empty description="Aún no has reportado errores" />
        ) : (
          <List
            dataSource={reportes}
            renderItem={(r: ReporteError) => {
              const meta = STATUS_META[r.status]
              return (
                <List.Item key={r.id} style={{ display: 'block', padding: '14px 8px', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Space>
                      <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>
                      {r.resolved_at && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Atendido el {dayjs(r.resolved_at).format('DD/MM/YYYY HH:mm')}
                        </Text>
                      )}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Reportado el {dayjs(r.created_at).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  </div>
                  <Paragraph style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>
                    {r.descripcion_usuario}
                  </Paragraph>
                  {r.ruta && (
                    <Text code style={{ fontSize: 11 }}>{r.ruta}</Text>
                  )}
                  {r.nota_admin && (
                    <div style={{
                      marginTop: 10,
                      padding: 10,
                      background: r.status === 'resuelto' ? '#f6ffed' : '#fafafa',
                      borderLeft: `3px solid ${r.status === 'resuelto' ? '#52c41a' : '#d9d9d9'}`,
                      borderRadius: 4,
                    }}>
                      <Text strong style={{ fontSize: 12, color: '#666' }}>Nota del equipo:</Text>
                      <Paragraph style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{r.nota_admin}</Paragraph>
                    </div>
                  )}
                </List.Item>
              )
            }}
          />
        )}
      </Card>
    </div>
  )
}
