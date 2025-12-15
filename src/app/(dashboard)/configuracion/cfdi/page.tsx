'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Space,
  Tag,
  Descriptions,
  Alert,
  Spin,
  Divider,
  Row,
  Col,
} from 'antd'
import {
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExperimentOutlined,
  CloudServerOutlined,
} from '@ant-design/icons'
import CSDUploader from '@/components/cfdi/CSDUploader'
import { CSD_PRUEBAS } from '@/lib/config/finkok'

const { Title, Text } = Typography

interface CSDStatus {
  success: boolean
  rfc: string
  tieneCSD: boolean
  ambiente: 'demo' | 'production'
  message: string
}

export default function ConfiguracionCFDIPage() {
  const [loading, setLoading] = useState(true)
  const [csdStatus, setCsdStatus] = useState<CSDStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const verificarCSD = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/cfdi/csd')
      const data = await response.json()

      if (data.success) {
        setCsdStatus(data)
      } else {
        setError(data.message || 'Error al verificar CSD')
      }
    } catch (err) {
      setError('Error de conexion al verificar CSD')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    verificarCSD()
  }, [])

  const handleCSDUploadSuccess = () => {
    verificarCSD()
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <SafetyCertificateOutlined /> Configuracion CFDI
        </Title>
        <Text type="secondary">
          Gestiona los certificados de sello digital y configuracion de timbrado
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          {/* Estado de CSD */}
          <Card
            title={
              <Space>
                <CloudServerOutlined />
                Estado de Certificados
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin />
                <br />
                <Text type="secondary">Verificando estado...</Text>
              </div>
            ) : error ? (
              <Alert type="error" message={error} showIcon />
            ) : csdStatus ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="Ambiente">
                    {csdStatus.ambiente === 'demo' ? (
                      <Tag icon={<ExperimentOutlined />} color="orange">
                        Demo / Pruebas
                      </Tag>
                    ) : (
                      <Tag icon={<CloudServerOutlined />} color="green">
                        Produccion
                      </Tag>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="RFC Emisor">
                    <Text code>{csdStatus.rfc}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Estado CSD">
                    {csdStatus.tieneCSD ? (
                      <Tag icon={<CheckCircleOutlined />} color="success">
                        Activo
                      </Tag>
                    ) : (
                      <Tag icon={<CloseCircleOutlined />} color="error">
                        No Cargado
                      </Tag>
                    )}
                  </Descriptions.Item>
                </Descriptions>

                {!csdStatus.tieneCSD && (
                  <Alert
                    type="warning"
                    message="Sin certificados"
                    description="Debes cargar los certificados CSD para poder timbrar facturas."
                    showIcon
                  />
                )}
              </Space>
            ) : null}
          </Card>

          {/* Info del emisor de pruebas */}
          {csdStatus?.ambiente === 'demo' && (
            <Card
              title={
                <Space>
                  <ExperimentOutlined />
                  Datos del Emisor de Pruebas
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="RFC">
                  <Text code>{CSD_PRUEBAS.rfc}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Razon Social">
                  {CSD_PRUEBAS.nombre}
                </Descriptions.Item>
                <Descriptions.Item label="Regimen Fiscal">
                  {CSD_PRUEBAS.regimenFiscal} - General de Ley PM
                </Descriptions.Item>
                <Descriptions.Item label="Codigo Postal">
                  {CSD_PRUEBAS.codigoPostal}
                </Descriptions.Item>
              </Descriptions>

              <Divider />

              <Alert
                type="info"
                message="Ambiente de Pruebas"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>Los CFDI generados son validos solo para pruebas</li>
                    <li>No tienen validez fiscal ante el SAT</li>
                    <li>Usa los receptores de prueba SAT para timbrar</li>
                  </ul>
                }
                showIcon
              />
            </Card>
          )}
        </Col>

        <Col xs={24} lg={12}>
          {/* Cargador de CSD */}
          <CSDUploader onSuccess={handleCSDUploadSuccess} />
        </Col>
      </Row>
    </div>
  )
}
