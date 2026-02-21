'use client'

import { useState } from 'react'
import { Modal, Button, Space, Typography, Alert, Collapse } from 'antd'
import { WarningOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons'

const { Text, Title } = Typography

interface TimbradoError {
  codigo?: string
  titulo: string
  descripcion: string
  accion: string
  detalles?: string
}

interface TimbradoErrorModalProps {
  open: boolean
  error: TimbradoError
  onClose: () => void
  onRetry: () => void
  onEdit?: () => void
  retryLoading?: boolean
}

export default function TimbradoErrorModal({
  open,
  error,
  onClose,
  onRetry,
  onEdit,
  retryLoading,
}: TimbradoErrorModalProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      centered
      destroyOnClose
    >
      <div style={{ padding: '24px 0 8px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <WarningOutlined style={{ fontSize: 56, color: '#faad14' }} />
          <Title level={3} style={{ marginTop: 16, marginBottom: 4 }}>
            Error al Timbrar
          </Title>
          {error.codigo && (
            <Text type="secondary">Codigo: {error.codigo}</Text>
          )}
        </div>

        <Alert
          type="warning"
          message={error.titulo}
          description={error.descripcion}
          showIcon={false}
          style={{ marginBottom: 16 }}
        />

        <Alert
          type="info"
          message="Accion sugerida"
          description={error.accion}
          showIcon={false}
          style={{ marginBottom: 16 }}
        />

        {error.detalles && (
          <Collapse
            ghost
            items={[{
              key: 'details',
              label: <Text type="secondary" style={{ fontSize: 12 }}>Detalles tecnicos</Text>,
              children: (
                <div style={{
                  padding: 12,
                  background: '#f5f5f5',
                  borderRadius: 6,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 200,
                  overflow: 'auto',
                }}>
                  {error.detalles}
                </div>
              ),
            }]}
          />
        )}

        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="small">
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            block
            size="large"
            loading={retryLoading}
            onClick={onRetry}
          >
            Reintentar Timbrado
          </Button>
          {onEdit && (
            <Button
              icon={<EditOutlined />}
              block
              onClick={onEdit}
            >
              Editar Factura
            </Button>
          )}
          <Button block onClick={onClose}>
            Cerrar
          </Button>
        </Space>
      </div>
    </Modal>
  )
}
