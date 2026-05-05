'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Col, Empty, Row, Space, Tag, Typography } from 'antd'
import { FileTextOutlined, FilePdfOutlined, BookOutlined, DownloadOutlined } from '@ant-design/icons'
import { useAuth } from '@/lib/hooks/useAuth'

const { Title, Paragraph, Text } = Typography

const SOLAC_RFC = 'MOCD830414SL4'

type DocumentoItem = {
  key: string
  ruta?: string
  descarga?: string
  titulo: string
  descripcion: string
  icono: React.ReactNode
  soloOrgRfc?: string
  badge?: string
}

const DOCUMENTOS: DocumentoItem[] = [
  {
    key: 'entrega-revision',
    ruta: '/catalogos/documentos/entrega-revision',
    titulo: 'Entrega de Material a Revisión',
    descripcion: 'Formato para entregar equipo o módulos al fabricante para diagnóstico y/o reparación.',
    icono: <FilePdfOutlined style={{ fontSize: 28, color: '#2980b9' }} />,
    soloOrgRfc: SOLAC_RFC,
  },
  {
    key: 'prestamo-material',
    ruta: '/catalogos/documentos/prestamo-material',
    titulo: 'Vale de Préstamo de Material',
    descripcion: 'Formato para prestar material al cliente en espera de la orden de compra y documentos de facturación.',
    icono: <FilePdfOutlined style={{ fontSize: 28, color: '#2980b9' }} />,
    soloOrgRfc: SOLAC_RFC,
  },
  {
    key: 'catalogo-2026',
    descarga: '/documentos/Catalogo_SOLAC_2026.pdf',
    titulo: 'Catálogo SOLAC 2026',
    descripcion: 'Catálogo comercial 2026 con la línea de equipos de medición Gas-PAR® G4S y Familia Lemon® para Gas LP.',
    icono: <BookOutlined style={{ fontSize: 28, color: '#1B4F8B' }} />,
    soloOrgRfc: SOLAC_RFC,
    badge: 'Descargar PDF',
  },
]

export default function DocumentosPage() {
  const router = useRouter()
  const { organizacion } = useAuth()

  const documentosVisibles = useMemo(() => {
    const rfc = organizacion?.rfc ?? null
    return DOCUMENTOS.filter((d) => !d.soloOrgRfc || d.soloOrgRfc === rfc)
  }, [organizacion?.rfc])

  return (
    <div>
      <Space direction="vertical" size={4} style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          Documentos
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Formatos imprimibles y plantillas de documentos internos.
        </Paragraph>
      </Space>

      {documentosVisibles.length === 0 ? (
        <Card>
          <Empty
            description={
              <Text type="secondary">
                No hay documentos disponibles para esta organización.
              </Text>
            }
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {documentosVisibles.map((doc) => (
            <Col key={doc.key} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                onClick={() => {
                  if (doc.descarga) {
                    // anchor with download attribute: funciona en navegador
                    // y en webview de Tauri/Electron donde window.open esta bloqueado
                    const a = document.createElement('a')
                    a.href = doc.descarga
                    a.download = doc.descarga.split('/').pop() ?? ''
                    a.rel = 'noopener noreferrer'
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                  } else if (doc.ruta) {
                    router.push(doc.ruta)
                  }
                }}
                style={{ height: '100%' }}
              >
                <Space align="start" size={16}>
                  <div>{doc.icono}</div>
                  <Space direction="vertical" size={4} style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 15 }}>{doc.titulo}</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {doc.descripcion}
                    </Text>
                    <Space size={6} wrap style={{ marginTop: 4 }}>
                      {doc.badge && (
                        <Tag color="green" icon={<DownloadOutlined />}>
                          {doc.badge}
                        </Tag>
                      )}
                      {doc.soloOrgRfc && (
                        <Tag color="blue">
                          Exclusivo {organizacion?.nombre || 'organización'}
                        </Tag>
                      )}
                    </Space>
                  </Space>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}
