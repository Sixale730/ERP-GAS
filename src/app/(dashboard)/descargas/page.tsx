'use client'

import { Card, Col, Row, Space, Tag, Typography, Divider } from 'antd'
import {
  CloudDownloadOutlined,
  DesktopOutlined,
  WindowsOutlined,
  AndroidOutlined,
  MobileOutlined,
} from '@ant-design/icons'

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
  disponible: boolean
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
    disponible: true,
  },
  {
    key: 'mobile-android',
    archivo: '/descargas/CUANTY-ERP.apk',
    titulo: 'CUANTY ERP — App Móvil',
    plataforma: 'Android',
    version: '0.1.0',
    tamanoMB: 4,
    descripcion: 'Instalador APK para Android. Te permite usar el ERP desde tu celular como aplicación nativa, sin abrir el navegador. Se actualiza automáticamente.',
    icono: <AndroidOutlined style={{ fontSize: 32, color: '#3DDC84' }} />,
    disponible: false, // Activar cuando se suba el APK firmado a /public/descargas/
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
        {DESCARGAS.map((d) => {
          const isDisabled = !d.disponible
          return (
            <Col key={d.key} xs={24} sm={12} lg={8}>
              <Card
                hoverable={!isDisabled}
                onClick={() => !isDisabled && descargar(d.archivo)}
                style={{
                  height: '100%',
                  opacity: isDisabled ? 0.7 : 1,
                  cursor: isDisabled ? 'default' : 'pointer',
                }}
              >
                <Space align="start" size={16}>
                  <div>{d.icono}</div>
                  <Space direction="vertical" size={4} style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 15 }}>{d.titulo}</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {d.descripcion}
                    </Text>
                    <Space size={6} wrap style={{ marginTop: 4 }}>
                      <Tag
                        color={d.plataforma === 'Android' ? 'green' : 'blue'}
                        icon={d.plataforma === 'Android' ? <MobileOutlined /> : <DesktopOutlined />}
                      >
                        {d.plataforma}
                      </Tag>
                      <Tag>v{d.version}</Tag>
                      {d.disponible ? (
                        <Tag color="green" icon={<CloudDownloadOutlined />}>
                          Descargar · {d.tamanoMB} MB
                        </Tag>
                      ) : (
                        <Tag color="orange">Próximamente</Tag>
                      )}
                    </Space>
                  </Space>
                </Space>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Card style={{ marginTop: 24 }} size="small" title="¿Cómo instalar en Windows?">
        <Space direction="vertical" size={4}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            1. Haz click en la tarjeta de Windows para descargar el instalador.<br />
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

      <Card style={{ marginTop: 16 }} size="small" title="¿Cómo instalar en Android?">
        <Space direction="vertical" size={4}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            1. Desde el celular, abre esta página y descarga el archivo <Text code>.apk</Text> de Android.<br />
            2. Cuando lo abras, Android puede mostrar la alerta <Text code>Por seguridad, tu teléfono no permite instalar apps desconocidas</Text>. Da click en <Text code>Configuración</Text> y activa <Text code>Permitir esta fuente</Text>.<br />
            3. Vuelve a abrir el archivo y dale <Text code>Instalar</Text>.<br />
            4. Abre <Text code>CUANTY ERP</Text> desde el menú de apps del celular.<br />
            5. Inicia sesión con la misma cuenta que usas en la versión web.
          </Text>
          <Divider style={{ margin: '12px 0' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            <Text strong>¿No quieres instalar el APK?</Text> Puedes usar el ERP directamente desde el navegador del celular y agregarlo al inicio: en Chrome, abre la página del ERP, toca el menú (3 puntos) → <Text code>Agregar a pantalla de inicio</Text>. Queda como ícono y se abre en modo app, sin instalar nada.
          </Text>
        </Space>
      </Card>
    </div>
  )
}
