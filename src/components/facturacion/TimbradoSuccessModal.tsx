'use client'

import { Modal, Button, Space, Typography } from 'antd'
import { CheckCircleOutlined, FilePdfOutlined, DownloadOutlined } from '@ant-design/icons'

const { Text, Title } = Typography

interface TimbradoSuccessModalProps {
  open: boolean
  uuid: string
  onClose: () => void
  onDownloadPdf: () => void
  onDownloadXml: () => void
}

export default function TimbradoSuccessModal({
  open,
  uuid,
  onClose,
  onDownloadPdf,
  onDownloadXml,
}: TimbradoSuccessModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      centered
      destroyOnClose
    >
      <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
        <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
        <Title level={3} style={{ marginTop: 16, marginBottom: 8 }}>
          CFDI Timbrado Exitosamente
        </Title>
        <Text type="secondary">El comprobante ha sido timbrado ante el SAT</Text>

        <div style={{
          margin: '24px 0',
          padding: '12px 16px',
          background: '#f6ffed',
          border: '1px solid #b7eb8f',
          borderRadius: 8,
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>UUID del Timbre Fiscal</Text>
          <div style={{ marginTop: 4 }}>
            <Text code copyable style={{ fontSize: 13, wordBreak: 'break-all' }}>
              {uuid}
            </Text>
          </div>
        </div>

        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            block
            size="large"
            onClick={onDownloadPdf}
          >
            Descargar PDF
          </Button>
          <Button
            icon={<DownloadOutlined />}
            block
            onClick={onDownloadXml}
          >
            Descargar XML
          </Button>
          <Button block onClick={onClose}>
            Cerrar
          </Button>
        </Space>
      </div>
    </Modal>
  )
}
