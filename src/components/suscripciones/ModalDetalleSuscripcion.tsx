'use client'

import { useState } from 'react'
import { Modal, Typography, Row, Col, Card, Button, Divider, Tag, Space } from 'antd'
import { WhatsAppOutlined, FileTextOutlined, CalendarOutlined, CreditCardOutlined } from '@ant-design/icons'
import type { EstadoSuscripcion } from '@/types/suscripciones'
import {
  buildWhatsappLink,
  formatFechaLarga,
  formatMonto,
  SEMAFORO_COLORS,
} from '@/lib/utils/suscripcion'
import { registrarEventoSuscripcion } from '@/lib/hooks/queries/useSuscripcion'
import TerminosCondiciones from './TerminosCondiciones'

const { Text, Paragraph } = Typography

interface Props {
  open: boolean
  estado: EstadoSuscripcion
  onClose: () => void
}

export default function ModalDetalleSuscripcion({ open, estado, onClose }: Props) {
  const [terminosOpen, setTerminosOpen] = useState(false)

  const sem = SEMAFORO_COLORS[estado.color_semaforo]
  const totalMensual = estado.monto_mensual * (1 + estado.iva_porcentaje / 100)
  const totalAnual = estado.monto_anual * (1 + estado.iva_porcentaje / 100)
  const ahorroAnual = estado.monto_mensual * 12 - estado.monto_anual

  const handleWhatsapp = () => {
    registrarEventoSuscripcion('whatsapp_click', { origen: 'modal_detalle' })
    const url = buildWhatsappLink(estado.contacto_whatsapp)
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleOpenTerminos = () => {
    registrarEventoSuscripcion('terminos_abiertos')
    setTerminosOpen(true)
  }

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={680}
        title={
          <Space>
            <CreditCardOutlined style={{ color: '#1890ff' }} />
            <span>Suscripcion del Sistema ERP CUANTY</span>
          </Space>
        }
      >
        {/* Estado actual */}
        <Card size="small" style={{ marginBottom: 16, background: sem.bg, borderColor: sem.border }}>
          <Row gutter={[12, 8]}>
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Fecha de corte</Text>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                <CalendarOutlined /> {formatFechaLarga(estado.fecha_corte)}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Estado / Dias restantes</Text>
              <div style={{ fontSize: 16, fontWeight: 600, color: sem.text }}>
                {sem.icon} {estado.dias_restantes <= 0 ? 'Vencida' : `${estado.dias_restantes} dia${estado.dias_restantes === 1 ? '' : 's'}`}
                <Tag style={{ marginLeft: 8 }} color={estado.estado === 'activa' ? 'green' : estado.estado === 'vencida' ? 'red' : 'orange'}>
                  {estado.estado.toUpperCase()}
                </Tag>
              </div>
            </Col>
          </Row>
        </Card>

        <Divider orientation="left" style={{ marginTop: 0 }}>Condiciones de pago</Divider>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Card
              size="small"
              style={{ borderColor: estado.plan === 'mensual' ? '#1890ff' : undefined }}
              title={<Space>Mensual {estado.plan === 'mensual' && <Tag color="blue">Vigente</Tag>}</Space>}
            >
              <div style={{ fontSize: 24, fontWeight: 700 }}>{formatMonto(estado.monto_mensual)}</div>
              <Text type="secondary">+ IVA {estado.iva_porcentaje}% mensual</Text>
              <div style={{ marginTop: 8 }}>
                <Text>Total con IVA: <b>{formatMonto(totalMensual)}</b></Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card
              size="small"
              style={{ borderColor: estado.plan === 'anual' ? '#1890ff' : undefined }}
              title={
                <Space>
                  Anual
                  {estado.plan === 'anual' && <Tag color="blue">Vigente</Tag>}
                  {ahorroAnual > 0 && <Tag color="green">Ahorra {formatMonto(ahorroAnual)}</Tag>}
                </Space>
              }
              onMouseEnter={() => registrarEventoSuscripcion('plan_anual_visto')}
            >
              <div style={{ fontSize: 24, fontWeight: 700 }}>{formatMonto(estado.monto_anual)}</div>
              <Text type="secondary">+ IVA {estado.iva_porcentaje}% por 12 meses</Text>
              <div style={{ marginTop: 8 }}>
                <Text>Total con IVA: <b>{formatMonto(totalAnual)}</b></Text>
              </div>
            </Card>
          </Col>
        </Row>

        <Divider orientation="left">Forma de pago</Divider>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Transferencia SPEI o deposito bancario. Solicita los datos al administrador del sistema.
        </Paragraph>

        <Divider orientation="left">Despues del corte</Divider>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Si no se confirma el pago en la fecha de corte, el sistema puede entrar en modo
          solo lectura. Podras consultar informacion pero no crear ni modificar registros.
          Se reactiva inmediatamente al confirmar el pago.
        </Paragraph>

        <Divider />

        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Button
            type="primary"
            size="large"
            block
            icon={<WhatsAppOutlined />}
            style={{ background: '#25D366', borderColor: '#25D366' }}
            onClick={handleWhatsapp}
          >
            Contactar al administrador ({estado.contacto_nombre})
          </Button>
          <Button block icon={<FileTextOutlined />} onClick={handleOpenTerminos}>
            Ver terminos y condiciones
          </Button>
        </Space>
      </Modal>

      <Modal
        open={terminosOpen}
        onCancel={() => setTerminosOpen(false)}
        footer={<Button onClick={() => setTerminosOpen(false)}>Cerrar</Button>}
        width={760}
        title="Terminos y Condiciones"
      >
        <TerminosCondiciones />
      </Modal>
    </>
  )
}
