'use client'

import { Card, Col, Row, Space, Tag, Typography } from 'antd'
import { CloudDownloadOutlined, DesktopOutlined, WindowsOutlined } from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

type DescargaItem = {
  key: string
  archivo: string
  titulo: string
  plataforma: string
  version: string
  tamanoMB: number
  descripcion: string
  icono: React.ReactNode
}

const DESCARGAS: DescargaItem[] = [
  {
    key: 'desktop-windows-x64',
    archivo: '/descargas/CUANTY-ERP-Setup-0.1.0-x64.exe',
    titulo: 'CUANTY ERP — App de Escritorio',
    plataforma: 'Windows x64',
    version: '0.1.0',
    tamanoMB: 2.27,
    descripcion: 'Instalador para Windows. Te permite usar el ERP como una aplicación nativa de escritorio, sin abrir el navegador. Igual de rápido y siempre actualizado.',
    icono: <WindowsOutlined style={{ fontSize: 32, color: '#0078D4' }} />,
  },
]

function descargar(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = url.split('/').pop() ?? ''
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export default function DescargasPage() {
  return (
    <div>
      <Space direction="vertical" size={4} style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <CloudDownloadOutlined style={{ marginRight: 8 }} />
          Descargas
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Aplicaciones e instaladores oficiales de CUANTY ERP.
        </Paragraph>
      </Space>

      <Row gutter={[16, 16]}>
        {DESCARGAS.map((d) => (
          <Col key={d.key} xs={24} sm={12} lg={8}>
            <Card hoverable onClick={() => descargar(d.archivo)} style={{ height: '100%' }}>
              <Space align="start" size={16}>
                <div>{d.icono}</div>
                <Space direction="vertical" size={4} style={{ flex: 1 }}>
                  <Text strong style={{ fontSize: 15 }}>{d.titulo}</Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {d.descripcion}
                  </Text>
                  <Space size={6} wrap style={{ marginTop: 4 }}>
                    <Tag color="blue" icon={<DesktopOutlined />}>{d.plataforma}</Tag>
                    <Tag>v{d.version}</Tag>
                    <Tag color="green" icon={<CloudDownloadOutlined />}>
                      Descargar · {d.tamanoMB} MB
                    </Tag>
                  </Space>
                </Space>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ marginTop: 24 }} size="small">
        <Space direction="vertical" size={4}>
          <Text strong>¿Cómo instalar?</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            1. Haz click en la tarjeta para descargar el instalador.<br />
            2. Ejecuta el archivo descargado y sigue el asistente (Siguiente → Siguiente → Finalizar).<br />
            3. Abre <Text code>CUANTY ERP</Text> desde el menú de inicio o el escritorio.<br />
            4. Inicia sesión con la misma cuenta que usas en la versión web.
          </Text>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            Si Windows muestra una advertencia de SmartScreen al ejecutar el instalador, da click en{' '}
            <Text code>Más información</Text> → <Text code>Ejecutar de todas formas</Text>. Esto es normal
            mientras el certificado de firma de código se da de alta.
          </Text>
        </Space>
      </Card>
    </div>
  )
}
