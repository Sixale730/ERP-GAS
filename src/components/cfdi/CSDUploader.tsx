'use client'

import { useState } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Upload,
  message,
  Alert,
  Space,
  Typography,
  Divider,
} from 'antd'
import {
  UploadOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd/es/upload'

const { Text, Title } = Typography

interface CSDUploaderProps {
  defaultRFC?: string
  onSuccess?: () => void
}

interface FormValues {
  taxpayer_id?: string
  passphrase: string
}

export default function CSDUploader({ defaultRFC, onSuccess }: CSDUploaderProps) {
  const [form] = Form.useForm<FormValues>()
  const [loading, setLoading] = useState(false)
  const [cerFile, setCerFile] = useState<UploadFile | null>(null)
  const [keyFile, setKeyFile] = useState<UploadFile | null>(null)
  const [result, setResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Props para el upload de .cer
  const cerUploadProps: UploadProps = {
    accept: '.cer',
    maxCount: 1,
    beforeUpload: (file) => {
      if (!file.name.endsWith('.cer')) {
        message.error('El archivo debe tener extension .cer')
        return Upload.LIST_IGNORE
      }
      setCerFile(file as unknown as UploadFile)
      return false // No subir automaticamente
    },
    onRemove: () => {
      setCerFile(null)
    },
    fileList: cerFile ? [cerFile] : [],
  }

  // Props para el upload de .key
  const keyUploadProps: UploadProps = {
    accept: '.key',
    maxCount: 1,
    beforeUpload: (file) => {
      if (!file.name.endsWith('.key')) {
        message.error('El archivo debe tener extension .key')
        return Upload.LIST_IGNORE
      }
      setKeyFile(file as unknown as UploadFile)
      return false
    },
    onRemove: () => {
      setKeyFile(null)
    },
    fileList: keyFile ? [keyFile] : [],
  }

  const handleSubmit = async (values: FormValues) => {
    if (!cerFile) {
      message.error('Selecciona el archivo de certificado (.cer)')
      return
    }

    if (!keyFile) {
      message.error('Selecciona el archivo de llave privada (.key)')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('cer', cerFile as unknown as Blob)
      formData.append('key', keyFile as unknown as Blob)
      formData.append('passphrase', values.passphrase)

      if (values.taxpayer_id) {
        formData.append('taxpayer_id', values.taxpayer_id)
      }

      const response = await fetch('/api/cfdi/csd', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setResult({
          type: 'success',
          message: data.message || 'Certificados cargados correctamente',
        })
        message.success('Certificados cargados a Finkok')
        onSuccess?.()
      } else {
        setResult({
          type: 'error',
          message: data.error || data.message || 'Error al cargar certificados',
        })
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error de conexion',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCargarPruebas = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/cfdi/csd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usarPruebas: true }),
      })

      const data = await response.json()

      if (data.success) {
        setResult({
          type: 'success',
          message: data.message || 'Certificados de prueba cargados',
        })
        message.success('Certificados de prueba cargados a Finkok')
        onSuccess?.()
      } else {
        setResult({
          type: 'error',
          message: data.error || data.message || 'Error al cargar certificados',
        })
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error de conexion',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={4}>
            <SafetyCertificateOutlined /> Cargar Certificados CSD
          </Title>
          <Text type="secondary">
            Los certificados se cargan a Finkok para poder timbrar facturas.
            Los archivos no se guardan en nuestro servidor.
          </Text>
        </div>

        {result && (
          <Alert
            type={result.type}
            message={result.type === 'success' ? 'Operacion exitosa' : 'Error'}
            description={result.message}
            showIcon
            closable
            onClose={() => setResult(null)}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ taxpayer_id: defaultRFC }}
        >
          <Form.Item
            label="RFC del Emisor"
            name="taxpayer_id"
            extra="Dejar vacio para usar el RFC de pruebas (EKU9003173C9)"
          >
            <Input placeholder="AAA010101AAA" maxLength={13} />
          </Form.Item>

          <Form.Item
            label="Certificado (.cer)"
            required
            extra="Archivo de certificado publico del SAT"
          >
            <Upload {...cerUploadProps}>
              <Button icon={<SafetyCertificateOutlined />}>
                Seleccionar archivo .cer
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item
            label="Llave Privada (.key)"
            required
            extra="Archivo de llave privada del SAT"
          >
            <Upload {...keyUploadProps}>
              <Button icon={<KeyOutlined />}>
                Seleccionar archivo .key
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item
            label="Contrasena de la Llave"
            name="passphrase"
            rules={[{ required: true, message: 'La contrasena es requerida' }]}
            extra="Contrasena que usaste al generar los CSD en el SAT"
          >
            <Input.Password placeholder="Contrasena de la llave privada" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={loading ? <LoadingOutlined /> : <UploadOutlined />}
                disabled={!cerFile || !keyFile}
              >
                Cargar a Finkok
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Divider>O cargar certificados de prueba</Divider>

        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Para ambiente de desarrollo, puedes cargar los certificados de prueba del SAT
            (RFC: EKU9003173C9).
          </Text>
          <Button
            onClick={handleCargarPruebas}
            loading={loading}
            icon={<CheckCircleOutlined />}
          >
            Cargar CSD de Pruebas
          </Button>
        </div>
      </Space>
    </Card>
  )
}
