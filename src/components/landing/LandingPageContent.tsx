'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Col, Form, Input, Modal, Row, Select, Tag, Typography, message, Space } from 'antd'
import {
  FileTextOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  SafetyCertificateOutlined,
  LoginOutlined,
  RocketOutlined,
  PlayCircleOutlined,
  SendOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
  BankOutlined,
} from '@ant-design/icons'
import DashboardMockup from '@/components/landing/DashboardMockup'
import { generarURLPDFDemo } from '@/components/landing/cotizacion-demo'
import InventarioDemo from '@/components/landing/InventarioDemo'

const { Title, Paragraph, Text } = Typography

const features = [
  {
    icon: <FileTextOutlined style={{ fontSize: 36, color: '#1890ff' }} />,
    title: 'Cotizaciones y OV',
    desc: 'Crea cotizaciones profesionales, conviértelas a órdenes de venta y facturas con un clic. Seguimiento completo del pipeline comercial.',
  },
  {
    icon: <InboxOutlined style={{ fontSize: 36, color: '#52c41a' }} />,
    title: 'Inventario',
    desc: 'Control de stock en tiempo real, multi-almacén, alertas de stock bajo y trazabilidad completa de movimientos.',
  },
  {
    icon: <ShoppingCartOutlined style={{ fontSize: 36, color: '#faad14' }} />,
    title: 'Punto de Venta',
    desc: 'POS integrado con lector de códigos, cobro rápido, cortes de caja y sincronización automática con inventario.',
  },
  {
    icon: <SafetyCertificateOutlined style={{ fontSize: 36, color: '#722ed1' }} />,
    title: 'CFDI 4.0',
    desc: 'Timbrado de facturas directo con el SAT. Complementos de pago, cancelaciones y descarga de XML/PDF.',
  },
]

const giros = [
  'Distribuidores', 'Retail', 'Manufactura', 'Servicios', 'Alimentos y Bebidas',
  'Construcción', 'Tecnología', 'Automotriz', 'Farmacéutica', 'Textil',
  'Logística', 'Agro', 'Papelerías', 'Ferreterías', 'Refaccionarias',
]

export default function LandingPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pdfModal, setPdfModal] = useState(false)
  const [pdfUrl, setPdfUrl] = useState('')
  const [invModal, setInvModal] = useState(false)

  // Limpiar blob URL al desmontar
  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }
  }, [pdfUrl])

  const handleOpenPdfDemo = useCallback(() => {
    const url = generarURLPDFDemo()
    setPdfUrl(url)
    setPdfModal(true)
  }, [])

  const handleClosePdfDemo = useCallback(() => {
    setPdfModal(false)
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl('')
  }, [pdfUrl])

  const handleSubmit = async (values: { nombre: string; empresa?: string; telefono?: string; correo: string; giro?: string }) => {
    setLoading(true)
    try {
      const res = await fetch('/api/leads/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSubmitted(true)
        message.success('Solicitud enviada. Nos pondremos en contacto contigo pronto.')
        form.resetFields()
      } else {
        message.error(data.error || 'Error al enviar. Intenta de nuevo.')
      }
    } catch {
      message.error('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* ─── Navbar ──────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }}>CUANTY ERP</span>
        <a
          href="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 32,
            padding: '0 16px',
            borderRadius: 6,
            background: '#1890ff',
            color: '#fff',
            fontSize: 14,
            fontWeight: 400,
            textDecoration: 'none',
          }}
        >
          <LoginOutlined /> Iniciar sesión
        </a>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────── */}
      <section
        style={{
          background: 'linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%)',
          textAlign: 'center',
          padding: '120px 24px 60px',
        }}
      >
        <div style={{ maxWidth: 700, margin: '0 auto', marginBottom: 48 }}>
          <Tag color="blue" style={{ marginBottom: 16, fontSize: 13, padding: '4px 12px' }}>
            <RocketOutlined /> ERP en la nube para PyMEs mexicanas
          </Tag>
          <Title level={1} style={{ fontSize: 42, marginBottom: 16, lineHeight: 1.2 }}>
            Tu negocio bajo control,{' '}
            <span style={{ color: '#1890ff' }}>simple y poderoso</span>
          </Title>
          <Paragraph style={{ fontSize: 18, color: '#595959', marginBottom: 32 }}>
            Inventario, cotizaciones, facturación CFDI 4.0 y punto de venta en una sola plataforma.
            Sin instalaciones, sin complicaciones.
          </Paragraph>
          <Space size="middle">
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              onClick={() => scrollTo('demo')}
              style={{ height: 48, paddingInline: 32, fontSize: 16 }}
            >
              Solicitar demo
            </Button>
            <Button
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={() => scrollTo('features')}
              style={{ height: 48, paddingInline: 32, fontSize: 16 }}
            >
              Ver cómo funciona
            </Button>
          </Space>
        </div>

        {/* Dashboard Mockup */}
        <div style={{ maxWidth: 950, margin: '0 auto', padding: '0 16px' }}>
          <DashboardMockup />
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Title level={2}>Todo lo que necesitas para operar</Title>
          <Paragraph style={{ fontSize: 16, color: '#595959' }}>
            Módulos diseñados para el flujo real de negocios en México
          </Paragraph>
        </div>
        <Row gutter={[24, 24]}>
          {features.map((f, i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <Card
                hoverable
                style={{
                  height: '100%',
                  textAlign: 'center',
                  borderRadius: 12,
                  border: '1px solid #f0f0f0',
                  background: '#fff',
                  cursor: i <= 1 ? 'pointer' : undefined,
                }}
                styles={{ body: { padding: 24 } }}
                onClick={i === 0 ? handleOpenPdfDemo : i === 1 ? () => setInvModal(true) : undefined}
              >
                <div style={{ marginBottom: 16 }}>{f.icon}</div>
                <Title level={4} style={{ marginBottom: 8 }}>{f.title}</Title>
                <Paragraph style={{ color: '#595959', marginBottom: 0, fontSize: 14 }}>
                  {f.desc}
                </Paragraph>
                {i === 0 && (
                  <span style={{ fontSize: 12, color: '#1677ff', marginTop: 8, display: 'inline-block' }}>Ver ejemplo →</span>
                )}
                {i === 1 && (
                  <span style={{ fontSize: 12, color: '#1677ff', marginTop: 8, display: 'inline-block' }}>Ver demo interactiva →</span>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      {/* ─── Giros ───────────────────────────────────────────────── */}
      <section style={{ padding: '60px 24px', background: '#fafafa' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <Title level={3}>Para cualquier giro de negocio</Title>
          <Paragraph style={{ color: '#595959', marginBottom: 24 }}>
            CUANTY se adapta a las necesidades de tu industria
          </Paragraph>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {giros.map((g) => (
              <Tag
                key={g}
                style={{
                  fontSize: 14,
                  padding: '6px 16px',
                  borderRadius: 20,
                  background: '#fff',
                  border: '1px solid #d9d9d9',
                }}
              >
                {g}
              </Tag>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Demo Form ───────────────────────────────────────────── */}
      <section id="demo" style={{ padding: '40px 24px', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2}>Solicita tu demo gratuita</Title>
          <Paragraph style={{ fontSize: 16, color: '#595959' }}>
            Déjanos tus datos y te mostramos cómo CUANTY puede transformar tu operación
          </Paragraph>
        </div>

        {submitted ? (
          <Card style={{ textAlign: 'center', borderRadius: 12, padding: 24 }}>
            <RocketOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
            <Title level={3}>Solicitud recibida</Title>
            <Paragraph style={{ color: '#595959' }}>
              Nos pondremos en contacto contigo en las próximas 24 horas para agendar tu demo.
            </Paragraph>
            <Button type="primary" onClick={() => setSubmitted(false)}>
              Enviar otra solicitud
            </Button>
          </Card>
        ) : (
          <Card style={{ borderRadius: 12 }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark={false}
            >
              <Form.Item
                name="nombre"
                label="Nombre completo"
                rules={[{ required: true, message: 'Tu nombre es requerido' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="Juan Pérez" size="large" />
              </Form.Item>

              <Form.Item
                name="correo"
                label="Correo electrónico"
                rules={[
                  { required: true, message: 'Tu correo es requerido' },
                  { type: 'email', message: 'Ingresa un correo válido' },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="juan@empresa.com" size="large" />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="empresa" label="Empresa">
                    <Input prefix={<BankOutlined />} placeholder="Mi Empresa S.A." size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="telefono" label="Teléfono">
                    <Input prefix={<PhoneOutlined />} placeholder="55 1234 5678" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="giro" label="Giro de tu negocio">
                <Select placeholder="Selecciona tu industria" size="large" allowClear>
                  {giros.map((g) => (
                    <Select.Option key={g} value={g}>{g}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={loading}
                  icon={<SendOutlined />}
                  style={{ height: 48, fontSize: 16 }}
                >
                  Solicitar demo gratuita
                </Button>
              </Form.Item>
            </Form>
          </Card>
        )}
      </section>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer
        style={{
          background: '#001529',
          color: 'rgba(255,255,255,0.65)',
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ color: '#fff', fontSize: 16 }}>CUANTY ERP</Text>
        </div>
        <Paragraph style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          ERP en la nube para PyMEs mexicanas. Inventario, ventas, facturación y más.
        </Paragraph>
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
          &copy; 2026 CUANTY &middot; Todos los derechos reservados
        </Text>
      </footer>

      {/* ─── Modal PDF Demo ─────────────────────────────────────── */}
      <Modal
        open={pdfModal}
        onCancel={handleClosePdfDemo}
        footer={null}
        width="80vw"
        style={{ top: 20 }}
        styles={{ body: { padding: 0, height: '85vh' } }}
        title="Vista previa — Cotización"
        destroyOnClose
      >
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: '0 0 8px 8px' }}
            title="PDF Demo Cotización"
          />
        )}
      </Modal>

      {/* ─── Modal Inventario Demo ──────────────────────────────── */}
      <Modal
        open={invModal}
        onCancel={() => setInvModal(false)}
        footer={null}
        width="85vw"
        style={{ top: 20 }}
        styles={{ body: { padding: 0 } }}
        title="Demo interactiva — Inventario"
        destroyOnClose
      >
        <InventarioDemo />
      </Modal>
    </div>
  )
}
