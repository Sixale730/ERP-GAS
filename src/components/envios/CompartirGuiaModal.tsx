'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Modal, Tabs, Input, Button, Space, Typography, Tag, Alert, message
} from 'antd'
import { CopyOutlined, WhatsAppOutlined, MailOutlined, SendOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useConfigValue } from '@/lib/hooks/queries/useConfiguracionSistema'
import {
  variablesFromGuia, renderTemplate,
  formatPhoneForWhatsApp, isValidPhoneForWhatsApp,
  buildWhatsAppUrl, buildMailtoUrl,
} from '@/lib/utils/compartir-guia'
import type { GuiaEnvio, GuiaEnviadoPor } from '@/lib/hooks/queries/useGuiasEnvio'

const { Text, Paragraph } = Typography

interface CompartirGuiaModalProps {
  open: boolean
  onClose: () => void
  guia: GuiaEnvio
  /** Callback para registrar en BD el canal usado */
  onRegisterShare: (canal: GuiaEnviadoPor) => Promise<void>
}

export default function CompartirGuiaModal({
  open, onClose, guia, onRegisterShare
}: CompartirGuiaModalProps) {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email'>('whatsapp')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [registrando, setRegistrando] = useState(false)

  // Plantillas desde configuracion_sistema (con fallback sensato)
  const plantillaWA = useConfigValue<string>(
    'envios', 'plantilla_whatsapp',
    'Hola {atencion},\n\n¡Su pedido va en camino!\n\n📦 Guía: {numero_guia}\n🚚 Paquetería: {paqueteria}\n📍 Destino: {ciudad}, {estado}\n\nRastrea aquí:\n{tracking_url}\n\n— SOLAC'
  )
  const plantillaEmailSubject = useConfigValue<string>(
    'envios', 'plantilla_email_subject',
    'Su pedido está en camino — Guía {numero_guia}'
  )
  const plantillaEmailBody = useConfigValue<string>(
    'envios', 'plantilla_email_body',
    'Estimado(a) {cliente},\n\nLe informamos que su pedido ha sido despachado.\n\n— SOLAC'
  )

  // Cargar tel/email del cliente si existe en catalogo
  useEffect(() => {
    if (!open) return
    setTelefono('')
    setEmail('')
    if (!guia.cliente_id) return
    const supabase = getSupabaseClient()
    supabase.schema('erp').from('clientes')
      .select('telefono, email')
      .eq('id', guia.cliente_id)
      .single()
      .then(({ data }) => {
        if (data?.telefono) setTelefono(String(data.telefono))
        if (data?.email) setEmail(String(data.email))
      })
  }, [open, guia.cliente_id])

  // Variables y mensaje renderizado
  const vars = useMemo(
    () => variablesFromGuia(guia) as unknown as Record<string, string>,
    [guia],
  )

  const mensajeWA = useMemo(() => renderTemplate(plantillaWA, vars), [plantillaWA, vars])
  const emailSubject = useMemo(() => renderTemplate(plantillaEmailSubject, vars), [plantillaEmailSubject, vars])
  const emailBody = useMemo(() => renderTemplate(plantillaEmailBody, vars), [plantillaEmailBody, vars])

  // Telefono normalizado
  const telFmt = useMemo(() => formatPhoneForWhatsApp(telefono), [telefono])
  const telValido = isValidPhoneForWhatsApp(telFmt)

  const handleSendWhatsApp = async () => {
    if (!telValido) {
      message.warning('Ingresa un teléfono válido (mínimo 10 dígitos).')
      return
    }
    const url = buildWhatsAppUrl(telFmt, mensajeWA)
    window.open(url, '_blank', 'noopener,noreferrer')
    setRegistrando(true)
    try {
      await onRegisterShare('whatsapp')
      message.success('Compartido por WhatsApp. Recuerda darle "Enviar" en la app.')
    } catch {
      // ignore — no rompe la accion principal
    } finally {
      setRegistrando(false)
      onClose()
    }
  }

  const handleSendEmail = async () => {
    if (!email.trim()) {
      message.warning('Ingresa un email válido.')
      return
    }
    const url = buildMailtoUrl(email.trim(), emailSubject, emailBody)
    window.open(url, '_blank', 'noopener,noreferrer')
    setRegistrando(true)
    try {
      await onRegisterShare('email')
      message.success('Cliente de correo abierto. Recuerda darle "Enviar".')
    } catch {
      // ignore
    } finally {
      setRegistrando(false)
      onClose()
    }
  }

  const handleCopy = async () => {
    const texto = activeTab === 'whatsapp' ? mensajeWA : `${emailSubject}\n\n${emailBody}`
    try {
      await navigator.clipboard.writeText(texto)
      message.success('Mensaje copiado al portapapeles')
      await onRegisterShare('manual')
      onClose()
    } catch {
      message.error('No se pudo copiar al portapapeles')
    }
  }

  const destinatarioMostrar = guia.cliente_nombre || guia.cliente_nombre_libre || 'cliente sin nombre'

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={<Space><SendOutlined /> Compartir guía {guia.folio}</Space>}
      width={640}
      footer={null}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={<>Destinatario: <Text strong>{destinatarioMostrar}</Text> — Guía <Text code>{guia.numero_guia ?? '(sin asignar)'}</Text></>}
      />

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'whatsapp' | 'email')}
        items={[
          {
            key: 'whatsapp',
            label: <Space><WhatsAppOutlined style={{ color: '#25D366' }} /> WhatsApp</Space>,
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ fontSize: 12 }}>Teléfono del destinatario:</Text>
                  <Input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="ej. 33 1013 1166 o +52 33 1013 1166"
                    style={{ marginTop: 4 }}
                    addonBefore={telValido ? <Tag color="green" style={{ margin: 0 }}>OK</Tag> : <Tag color="orange" style={{ margin: 0 }}>Pendiente</Tag>}
                  />
                  {telefono && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      WhatsApp llamará a: +{telFmt}
                      {!telValido && telefono.trim() && ' — formato no válido (debe tener 10+ dígitos)'}
                    </Text>
                  )}
                </div>

                <div>
                  <Text strong style={{ fontSize: 12 }}>Vista previa del mensaje:</Text>
                  <Paragraph
                    style={{
                      marginTop: 4, marginBottom: 0, padding: 12,
                      background: '#f6ffed', border: '1px solid #b7eb8f',
                      borderRadius: 8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13,
                    }}
                  >
                    {mensajeWA}
                  </Paragraph>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    Edita la plantilla en /configuracion/sistema → tab Envíos.
                  </Text>
                </div>

                <Space style={{ marginTop: 8 }}>
                  <Button
                    type="primary"
                    icon={<WhatsAppOutlined />}
                    onClick={handleSendWhatsApp}
                    loading={registrando}
                    disabled={!telValido}
                    style={{ background: '#25D366', borderColor: '#25D366' }}
                  >
                    Abrir WhatsApp
                  </Button>
                  <Button icon={<CopyOutlined />} onClick={handleCopy}>
                    Copiar mensaje
                  </Button>
                </Space>
              </Space>
            ),
          },
          {
            key: 'email',
            label: <Space><MailOutlined style={{ color: '#FF8C42' }} /> Email</Space>,
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ fontSize: 12 }}>Email del destinatario:</Text>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@correo.com"
                    type="email"
                    style={{ marginTop: 4 }}
                  />
                </div>

                <div>
                  <Text strong style={{ fontSize: 12 }}>Asunto:</Text>
                  <Paragraph
                    style={{
                      marginTop: 4, marginBottom: 8, padding: '8px 12px',
                      background: '#fff7e6', border: '1px solid #ffd591',
                      borderRadius: 8, fontSize: 13,
                    }}
                  >
                    {emailSubject}
                  </Paragraph>

                  <Text strong style={{ fontSize: 12 }}>Cuerpo:</Text>
                  <Paragraph
                    style={{
                      marginTop: 4, marginBottom: 0, padding: 12,
                      background: '#fff7e6', border: '1px solid #ffd591',
                      borderRadius: 8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13,
                    }}
                  >
                    {emailBody}
                  </Paragraph>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    Edita las plantillas en /configuracion/sistema → tab Envíos.
                  </Text>
                </div>

                <Space style={{ marginTop: 8 }}>
                  <Button
                    type="primary"
                    icon={<MailOutlined />}
                    onClick={handleSendEmail}
                    loading={registrando}
                    disabled={!email.trim()}
                  >
                    Abrir cliente de correo
                  </Button>
                  <Button icon={<CopyOutlined />} onClick={handleCopy}>
                    Copiar asunto + cuerpo
                  </Button>
                </Space>
              </Space>
            ),
          },
        ]}
      />
    </Modal>
  )
}
