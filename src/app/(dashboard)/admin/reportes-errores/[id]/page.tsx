'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Tag, Typography, Space, Button, Descriptions, Input, Select, message, Result,
  Skeleton, Divider,
} from 'antd'
import { ArrowLeftOutlined, BugOutlined, CheckOutlined, StopOutlined, EditOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/lib/hooks/useAuth'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  useActualizarStatusReporte,
  type ReporteError,
  type ReporteStatus,
  type ReportePrioridad,
} from '@/lib/hooks/queries/useReportesErrores'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const STATUS_META: Record<ReporteStatus, { label: string; color: string }> = {
  nuevo:        { label: 'Nuevo',        color: 'red' },
  en_revision:  { label: 'En revisión',  color: 'orange' },
  resuelto:     { label: 'Resuelto',     color: 'green' },
  descartado:   { label: 'Descartado',   color: 'default' },
}

const PRIORIDAD_OPTIONS: { value: ReportePrioridad; label: string; color: string }[] = [
  { value: 'baja',    label: 'Baja',    color: 'default' },
  { value: 'normal',  label: 'Normal',  color: 'blue' },
  { value: 'alta',    label: 'Alta',    color: 'orange' },
  { value: 'critica', label: 'Critica', color: 'red' },
]

interface ReporteCompleto extends ReporteError {
  stack: string | null
  contexto: Record<string, unknown> | null
  user_agent: string | null
  viewport: string | null
}

export default function ReporteErrorDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const actualizar = useActualizarStatusReporte()

  const [reporte, setReporte] = useState<ReporteCompleto | null>(null)
  const [loading, setLoading] = useState(true)
  const [nota, setNota] = useState('')
  const [prioridad, setPrioridad] = useState<ReportePrioridad>('normal')
  const [editandoNota, setEditandoNota] = useState(false)

  useEffect(() => {
    let active = true
    const fetchReporte = async () => {
      setLoading(true)
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('reportes_errores')
        .select('*')
        .eq('id', id)
        .single()
      if (!active) return
      if (error || !data) {
        setReporte(null)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = data as any
        setReporte(row as ReporteCompleto)
        setNota(row.nota_admin ?? '')
        setPrioridad((row.prioridad as ReportePrioridad) ?? 'normal')
      }
      setLoading(false)
    }
    fetchReporte()
    return () => { active = false }
  }, [id])

  if (!authLoading && !isAdmin) {
    return (
      <Result
        status="403"
        title="Acceso denegado"
        subTitle="Solo administradores pueden acceder a esta sección."
        extra={<Button onClick={() => router.push('/dashboard')}>Volver al Dashboard</Button>}
      />
    )
  }

  if (loading) {
    return (
      <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
    )
  }

  if (!reporte) {
    return (
      <Result
        status="404"
        title="Reporte no encontrado"
        subTitle="El reporte no existe o no tienes permiso para verlo."
        extra={<Button onClick={() => router.push('/admin/reportes-errores')}>Volver a la lista</Button>}
      />
    )
  }

  const handleStatusChange = async (
    status: ReporteStatus,
    opts: { nota?: string; prioridad?: ReportePrioridad } = {}
  ) => {
    try {
      await actualizar.mutateAsync({
        id: reporte.id,
        status,
        nota_admin: opts.nota ?? nota,
        prioridad: opts.prioridad ?? prioridad,
      })
      message.success('Reporte actualizado')
      // Refrescar local
      const supabase = getSupabaseClient()
      const { data } = await supabase.schema('erp').from('reportes_errores').select('*').eq('id', id).single()
      if (data) setReporte(data as ReporteCompleto)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Error al actualizar')
    }
  }

  const handleGuardarNota = async () => {
    try {
      await actualizar.mutateAsync({
        id: reporte.id,
        status: reporte.status,
        nota_admin: nota,
        prioridad,
      })
      setEditandoNota(false)
      message.success('Cambios guardados')
      const supabase = getSupabaseClient()
      const { data } = await supabase.schema('erp').from('reportes_errores').select('*').eq('id', id).single()
      if (data) setReporte(data as ReporteCompleto)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/admin/reportes-errores')}>
          Volver
        </Button>
        <Tag color={STATUS_META[reporte.status].color}>{STATUS_META[reporte.status].label}</Tag>
        <Tag color={PRIORIDAD_OPTIONS.find(p => p.value === reporte.prioridad)?.color || 'default'}>
          Prioridad: {reporte.prioridad}
        </Tag>
      </div>
      <Title level={3} style={{ marginTop: 0 }}>
        <BugOutlined /> Reporte de error
      </Title>

      <Card title="Acciones" style={{ marginBottom: 16 }}>
        <Space wrap>
          {reporte.status !== 'en_revision' && reporte.status !== 'resuelto' && (
            <Button onClick={() => handleStatusChange('en_revision')}>
              Marcar en revisión
            </Button>
          )}
          {reporte.status !== 'resuelto' && (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => handleStatusChange('resuelto')}
            >
              Marcar como resuelto
            </Button>
          )}
          {reporte.status !== 'descartado' && reporte.status !== 'resuelto' && (
            <Button
              icon={<StopOutlined />}
              danger
              onClick={() => handleStatusChange('descartado')}
            >
              Descartar
            </Button>
          )}
          {(reporte.status === 'resuelto' || reporte.status === 'descartado') && (
            <Button icon={<UndoOutlined />} onClick={() => handleStatusChange('nuevo')}>
              Reabrir
            </Button>
          )}
          <Divider type="vertical" />
          <Text type="secondary" style={{ fontSize: 12 }}>Prioridad:</Text>
          <Select<ReportePrioridad>
            value={prioridad}
            onChange={(v) => setPrioridad(v)}
            style={{ width: 130 }}
            options={PRIORIDAD_OPTIONS.map(p => ({ value: p.value, label: p.label }))}
          />
          <Button onClick={handleGuardarNota} disabled={prioridad === reporte.prioridad && nota === (reporte.nota_admin ?? '')}>
            Guardar prioridad/nota
          </Button>
        </Space>
        {reporte.resolved_at && (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Resuelto el {dayjs(reporte.resolved_at).format('DD/MM/YYYY HH:mm')}
            </Text>
          </div>
        )}
      </Card>

      <Card title="Lo que reportó el usuario" style={{ marginBottom: 16 }}>
        <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>
          {reporte.descripcion_usuario}
        </Paragraph>
        {reporte.pasos_reproduccion && (
          <>
            <Text strong>Pasos para reproducir:</Text>
            <Paragraph style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
              {reporte.pasos_reproduccion}
            </Paragraph>
          </>
        )}
      </Card>

      <Card
        title="Nota interna del admin"
        style={{ marginBottom: 16 }}
        extra={
          !editandoNota ? (
            <Button size="small" icon={<EditOutlined />} onClick={() => setEditandoNota(true)}>
              Editar
            </Button>
          ) : null
        }
      >
        {editandoNota ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <TextArea
              autoFocus
              rows={4}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Esta nota es visible para el reportante cuando se marca como resuelto"
              maxLength={5000}
              showCount
            />
            <Space>
              <Button type="primary" onClick={handleGuardarNota} loading={actualizar.isPending}>
                Guardar
              </Button>
              <Button onClick={() => { setNota(reporte.nota_admin ?? ''); setEditandoNota(false) }}>
                Cancelar
              </Button>
            </Space>
          </Space>
        ) : (
          <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0, color: reporte.nota_admin ? undefined : '#aaa' }}>
            {reporte.nota_admin || 'Sin nota. Clic en Editar para agregar.'}
          </Paragraph>
        )}
      </Card>

      <Card title="Contexto técnico">
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Reportante">
            {reporte.usuario_nombre} ({reporte.usuario_email})
            {reporte.usuario_rol && <Tag style={{ marginLeft: 8 }}>{reporte.usuario_rol}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Fecha">
            {dayjs(reporte.created_at).format('DD/MM/YYYY HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="Ruta">
            <Text code>{reporte.ruta ?? '—'}</Text>
            {reporte.ruta && (
              <Button
                size="small"
                type="link"
                onClick={() => router.push(reporte.ruta!)}
              >
                Ir
              </Button>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Origen">{reporte.origen}</Descriptions.Item>
          <Descriptions.Item label="User agent">
            <Text style={{ fontSize: 11 }}>{reporte.user_agent ?? '—'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Viewport">{reporte.viewport ?? '—'}</Descriptions.Item>
          {reporte.mensaje_tecnico && (
            <Descriptions.Item label="Mensaje técnico">
              <Text code style={{ fontSize: 12 }}>{reporte.mensaje_tecnico}</Text>
            </Descriptions.Item>
          )}
          {reporte.stack && (
            <Descriptions.Item label="Stack trace">
              <pre style={{
                fontSize: 11,
                background: '#fafafa',
                padding: 8,
                borderRadius: 4,
                maxHeight: 300,
                overflow: 'auto',
                margin: 0,
              }}>{reporte.stack}</pre>
            </Descriptions.Item>
          )}
          {reporte.contexto && Object.keys(reporte.contexto).length > 0 && (
            <Descriptions.Item label="Contexto adicional">
              <pre style={{
                fontSize: 11,
                background: '#fafafa',
                padding: 8,
                borderRadius: 4,
                maxHeight: 200,
                overflow: 'auto',
                margin: 0,
              }}>{JSON.stringify(reporte.contexto, null, 2)}</pre>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    </div>
  )
}
