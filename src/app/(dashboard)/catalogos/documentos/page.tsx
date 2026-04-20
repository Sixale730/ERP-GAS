'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Col, Empty, Row, Space, Tag, Typography } from 'antd'
import { FileTextOutlined, FilePdfOutlined } from '@ant-design/icons'
import { useAuth } from '@/lib/hooks/useAuth'

const { Title, Paragraph, Text } = Typography

const SOLAC_RFC = 'MOCD830414SL4'

type DocumentoItem = {
  key: string
  ruta: string
  titulo: string
  descripcion: string
  icono: React.ReactNode
  soloOrgRfc?: string
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
                onClick={() => router.push(doc.ruta)}
                style={{ height: '100%' }}
              >
                <Space align="start" size={16}>
                  <div>{doc.icono}</div>
                  <Space direction="vertical" size={4} style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 15 }}>{doc.titulo}</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {doc.descripcion}
                    </Text>
                    {doc.soloOrgRfc && (
                      <Tag color="blue" style={{ marginTop: 4 }}>
                        Exclusivo {organizacion?.nombre || 'organización'}
                      </Tag>
                    )}
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
