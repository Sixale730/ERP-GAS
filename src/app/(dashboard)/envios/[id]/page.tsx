'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Button, Space, Typography, Tag, Descriptions, Spin, Divider, Row, Col,
  Statistic, message, Popconfirm, Empty, Alert
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, LinkOutlined,
  TruckOutlined, CheckCircleOutlined, FileTextOutlined, SendOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  useGuiaEnvio, useDeleteGuiaEnvio, useUpsertGuiaEnvio, useRegistrarEnvioCompartido,
  buildTrackingUrl, PAQUETERIA_LABELS, STATUS_LABELS, STATUS_COLORS,
  type GuiaStatus, type GuiaEnviadoPor,
} from '@/lib/hooks/queries/useGuiasEnvio'
import { formatMoneyMXN, formatDate, formatDateTime } from '@/lib/utils/format'
import GuiaEnvioForm from '@/components/envios/GuiaEnvioForm'
import CompartirGuiaModal from '@/components/envios/CompartirGuiaModal'

const { Title, Text } = Typography

const TIPO_ENTREGA_LABELS: Record<'ocurre' | 'domicilio', string> = {
  ocurre: 'Ocurre (recoge en sucursal)',
  domicilio: 'A domicilio',
}

const FORMA_PAGO_LABELS: Record<'pagado' | 'por_cobrar', string> = {
  pagado: 'Pagado por SOLAC',
  por_cobrar: 'Por cobrar al destinatario',
}

export default function EnvioDetallePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data, isLoading } = useGuiaEnvio(id)
  const deleteMut = useDeleteGuiaEnvio()
  const upsertMut = useUpsertGuiaEnvio()
  const registrarShare = useRegistrarEnvioCompartido()

  const [editMode, setEditMode] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
  }

  if (!data) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/envios')}>Volver</Button>
        <Empty description="Guía no encontrada" style={{ marginTop: 50 }} />
      </div>
    )
  }

  const { guia, cotizaciones } = data

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync(id)
      message.success('Guía eliminada')
      router.push('/envios')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar'
      message.error(msg)
    }
  }

  const cambiarStatus = async (nuevoStatus: GuiaStatus) => {
    try {
      const updates: Record<string, unknown> = { status: nuevoStatus }
      if (nuevoStatus === 'entregado' && !guia.fecha_entrega) {
        updates.fecha_entrega = new Date().toISOString()
      }
      await upsertMut.mutateAsync({
        id,
        cliente_id: guia.cliente_id,
        cliente_nombre_libre: guia.cliente_nombre_libre,
        direccion_envio_id: guia.direccion_envio_id,
        paqueteria: guia.paqueteria,
        numero_guia: guia.numero_guia,
        referencia_externa: guia.referencia_externa,
        tipo_entrega: guia.tipo_entrega,
        forma_pago_envio: guia.forma_pago_envio,
        atencion_a: guia.atencion_a,
        destino_ciudad: guia.destino_ciudad,
        destino_estado: guia.destino_estado,
        destino_cp: guia.destino_cp,
        peso_kg: guia.peso_kg,
        medidas_cm: guia.medidas_cm,
        bultos: guia.bultos,
        valor_declarado: guia.valor_declarado,
        costo_real: guia.costo_real,
        monto_cobrado: guia.monto_cobrado,
        status: nuevoStatus,
        fecha_despacho: guia.fecha_despacho,
        fecha_estimada: guia.fecha_estimada,
        fecha_entrega: (updates.fecha_entrega as string) ?? guia.fecha_entrega,
        enviado_a_cliente_por: guia.enviado_a_cliente_por,
        notas: guia.notas,
        factura_id: guia.factura_id,
        cotizaciones_ids: cotizaciones.map(c => c.id),
      })
      message.success(`Status actualizado: ${STATUS_LABELS[nuevoStatus]}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar status'
      message.error(msg)
    }
  }

  const trackingUrl = buildTrackingUrl(guia.paqueteria, guia.numero_guia)
  const margen = guia.costo_real != null && guia.monto_cobrado != null
    ? guia.monto_cobrado - guia.costo_real
    : null

  // ============ MODO EDICIÓN ============
  if (editMode) {
    return (
      <div>
        <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setEditMode(false)}>Volver al detalle</Button>
            <Title level={2} style={{ margin: 0 }}>Editar guía {guia.folio}</Title>
          </Space>
        </Space>
        <GuiaEnvioForm
          initialData={guia}
          initialCotizacionesIds={cotizaciones.map(c => c.id)}
          onCancel={() => setEditMode(false)}
        />
      </div>
    )
  }

  // ============ MODO VISTA ============
  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/envios')}>Volver</Button>
          <Title level={2} style={{ margin: 0 }}>{guia.folio}</Title>
          <Tag color={STATUS_COLORS[guia.status]} style={{ fontSize: 14, padding: '4px 12px' }}>
            {STATUS_LABELS[guia.status]}
          </Tag>
        </Space>
        <Space wrap>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => setShareOpen(true)}
            style={{ background: '#25D366', borderColor: '#25D366' }}
          >
            Compartir con cliente
          </Button>
          <Button icon={<EditOutlined />} onClick={() => setEditMode(true)}>Editar</Button>
          <Popconfirm title="¿Eliminar guía?" description="Esta acción no se puede deshacer." onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />}>Eliminar</Button>
          </Popconfirm>
        </Space>
      </Space>

      {/* Acciones rápidas de status */}
      {guia.status !== 'entregado' && guia.status !== 'devuelto' && (
        <Alert
          type="info"
          showIcon={false}
          style={{ marginBottom: 16 }}
          message={
            <Space wrap>
              <Text strong>Cambiar status:</Text>
              {guia.status !== 'en_transito' && (
                <Button size="small" icon={<TruckOutlined />} onClick={() => cambiarStatus('en_transito')} loading={upsertMut.isPending}>
                  Marcar en tránsito
                </Button>
              )}
              <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => cambiarStatus('entregado')} loading={upsertMut.isPending}>
                Marcar entregado
              </Button>
              {guia.status !== 'incidencia' && (
                <Button size="small" danger onClick={() => cambiarStatus('incidencia')} loading={upsertMut.isPending}>
                  Marcar incidencia
                </Button>
              )}
            </Space>
          }
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Datos del envío" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="Cliente">{guia.cliente_nombre || '—'}</Descriptions.Item>
              <Descriptions.Item label="Atención">{guia.atencion_a || '—'}</Descriptions.Item>
              <Descriptions.Item label="Paquetería">{PAQUETERIA_LABELS[guia.paqueteria]}</Descriptions.Item>
              <Descriptions.Item label="Núm. guía">
                {guia.numero_guia ? (
                  trackingUrl ? (
                    <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                      <Text code>{guia.numero_guia}</Text> <LinkOutlined />
                    </a>
                  ) : <Text code>{guia.numero_guia}</Text>
                ) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Tipo de entrega"><Tag>{TIPO_ENTREGA_LABELS[guia.tipo_entrega]}</Tag></Descriptions.Item>
              <Descriptions.Item label="Forma de pago">
                <Tag color={guia.forma_pago_envio === 'pagado' ? 'cyan' : 'magenta'}>{FORMA_PAGO_LABELS[guia.forma_pago_envio]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Destino">
                {[guia.destino_ciudad, guia.destino_estado, guia.destino_cp ? `CP ${guia.destino_cp}` : null]
                  .filter(Boolean).join(', ') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Referencia externa">{guia.referencia_externa || '—'}</Descriptions.Item>
              <Descriptions.Item label="Peso">{guia.peso_kg != null ? `${guia.peso_kg} kg` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Bultos">{guia.bultos}</Descriptions.Item>
              <Descriptions.Item label="Medidas">
                {guia.medidas_cm
                  ? `${guia.medidas_cm.ancho ?? '?'} × ${guia.medidas_cm.alto ?? '?'} × ${guia.medidas_cm.largo ?? '?'} cm`
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Valor declarado">
                {guia.valor_declarado != null ? formatMoneyMXN(guia.valor_declarado) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Despacho">{guia.fecha_despacho ? formatDateTime(guia.fecha_despacho) : '—'}</Descriptions.Item>
              <Descriptions.Item label="Entrega estimada">{guia.fecha_estimada ? formatDate(guia.fecha_estimada) : '—'}</Descriptions.Item>
              <Descriptions.Item label="Entrega real">{guia.fecha_entrega ? formatDateTime(guia.fecha_entrega) : '—'}</Descriptions.Item>
              <Descriptions.Item label="Compartido a cliente">
                {guia.enviado_a_cliente_por
                  ? <Tag>{guia.enviado_a_cliente_por === 'no_enviado' ? 'No enviado aún' : guia.enviado_a_cliente_por}</Tag>
                  : '—'}
              </Descriptions.Item>
            </Descriptions>
            {guia.notas && (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary">Notas:</Text>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{guia.notas}</div>
              </>
            )}
          </Card>

          <Card title={<Space><FileTextOutlined /> Órdenes de venta vinculadas</Space>}>
            {cotizaciones.length === 0 ? (
              <Empty description="Sin OVs ligadas" />
            ) : (
              cotizaciones.map(cot => (
                <Card.Grid
                  key={cot.id}
                  hoverable
                  onClick={() => router.push(`/cotizaciones/${cot.id}`)}
                  style={{ width: '100%', cursor: 'pointer' }}
                >
                  <Space style={{ justifyContent: 'space-between', display: 'flex' }}>
                    <Space>
                      <Text strong>{cot.folio}</Text>
                      <Tag>{cot.status}</Tag>
                    </Space>
                    <Text>{formatMoneyMXN(cot.total)}</Text>
                  </Space>
                </Card.Grid>
              ))
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Costos" style={{ marginBottom: 16 }}>
            <Statistic
              title="Costo real (SOLAC pagó)"
              value={guia.costo_real ?? 0}
              prefix="$"
              precision={2}
              valueStyle={{ color: '#cf1322', fontSize: 18 }}
            />
            <Divider style={{ margin: '12px 0' }} />
            <Statistic
              title="Cobrado al cliente"
              value={guia.monto_cobrado ?? 0}
              prefix="$"
              precision={2}
              valueStyle={{ color: '#52c41a', fontSize: 18 }}
            />
            <Divider style={{ margin: '12px 0' }} />
            <Statistic
              title={margen != null && margen >= 0 ? 'Margen' : 'Pérdida'}
              value={margen ?? 0}
              prefix="$"
              precision={2}
              valueStyle={{ color: margen != null && margen >= 0 ? '#1677ff' : '#cf1322', fontSize: 16 }}
            />
          </Card>

          <Card title="Auditoría" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Creado">{guia.created_at ? dayjs(guia.created_at).format('DD/MM/YYYY HH:mm') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Actualizado">{guia.updated_at ? dayjs(guia.updated_at).format('DD/MM/YYYY HH:mm') : '—'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <CompartirGuiaModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        guia={guia}
        onRegisterShare={async (canal: GuiaEnviadoPor) => {
          await registrarShare.mutateAsync({ guiaId: id, canal })
        }}
      />
    </div>
  )
}
