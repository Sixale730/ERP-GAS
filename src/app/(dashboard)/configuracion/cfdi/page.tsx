'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Table,
  Button,
  message,
} from 'antd'
import {
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExperimentOutlined,
  CloudServerOutlined,
  UserAddOutlined,
  ReloadOutlined,
  TeamOutlined,
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

interface FinkokUser {
  taxpayer_id: string
  status: 'A' | 'S'
  counter: number
  credit: number
}

export default function ConfiguracionCFDIPage() {
  const [loading, setLoading] = useState(true)
  const [csdStatus, setCsdStatus] = useState<CSDStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Estado para clientes Finkok
  const [finkokUsers, setFinkokUsers] = useState<FinkokUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [registering, setRegistering] = useState(false)

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

  const cargarClientesFinkok = async () => {
    setLoadingUsers(true)
    try {
      const response = await fetch('/api/cfdi/clientes-finkok')
      const data = await response.json()

      if (data.success) {
        setFinkokUsers(data.users || [])
      }
    } catch (err) {
      console.error('Error al cargar clientes Finkok:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const registrarRFC = async (rfc: string) => {
    setRegistering(true)
    try {
      const response = await fetch('/api/cfdi/clientes-finkok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxpayer_id: rfc, type_user: 'O' }),
      })
      const data = await response.json()

      if (data.success) {
        if (data.already_exists) {
          message.info(`El RFC ${rfc} ya estaba registrado`)
        } else {
          message.success(`RFC ${rfc} registrado exitosamente`)
        }
        cargarClientesFinkok()
      } else {
        message.error(data.error || 'Error al registrar RFC')
      }
    } catch (err) {
      message.error('Error de conexion al registrar RFC')
    } finally {
      setRegistering(false)
    }
  }

  useEffect(() => {
    verificarCSD()
    cargarClientesFinkok()
  }, [])

  const handleCSDUploadSuccess = () => {
    verificarCSD()
  }

  // Verificar si el RFC de pruebas está registrado
  const rfcPruebasRegistrado = finkokUsers.some(
    (u) => u.taxpayer_id === CSD_PRUEBAS.rfc
  )

  // Columnas para la tabla de RFCs
  const columnsRFCs = useMemo(() => [
    {
      title: 'RFC',
      dataIndex: 'taxpayer_id',
      key: 'taxpayer_id',
      render: (rfc: string) => <Text code>{rfc}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) =>
        status === 'A' ? (
          <Tag color="success">Activo</Tag>
        ) : (
          <Tag color="default">Suspendido</Tag>
        ),
    },
    {
      title: 'Timbres Usados',
      dataIndex: 'counter',
      key: 'counter',
      render: (counter: number) => counter.toLocaleString(),
    },
    {
      title: 'Timbres Disponibles',
      dataIndex: 'credit',
      key: 'credit',
      render: (credit: number) =>
        credit === 0 ? (
          <Tag color="blue">Ilimitado (OnDemand)</Tag>
        ) : (
          credit.toLocaleString()
        ),
    },
  ], [])

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

      {/* Seccion de RFCs Registrados en Finkok */}
      <Card
        title={
          <Space>
            <TeamOutlined />
            RFCs Registrados en Finkok
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={cargarClientesFinkok}
            loading={loadingUsers}
          >
            Actualizar
          </Button>
        }
        style={{ marginTop: 16 }}
      >
        {/* Alerta si el RFC de pruebas no está registrado (solo en demo) */}
        {csdStatus?.ambiente === 'demo' && !rfcPruebasRegistrado && !loadingUsers && (
          <Alert
            type="warning"
            message="RFC de Pruebas No Registrado"
            description={
              <Space direction="vertical">
                <Text>
                  El RFC emisor de pruebas ({CSD_PRUEBAS.rfc}) no está registrado en tu
                  cuenta de Finkok. Debes registrarlo para poder timbrar.
                </Text>
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={() => registrarRFC(CSD_PRUEBAS.rfc)}
                  loading={registering}
                >
                  Registrar RFC de Pruebas ({CSD_PRUEBAS.rfc})
                </Button>
              </Space>
            }
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Mensaje de éxito si está registrado */}
        {csdStatus?.ambiente === 'demo' && rfcPruebasRegistrado && (
          <Alert
            type="success"
            message="RFC de Pruebas Registrado"
            description={`El RFC ${CSD_PRUEBAS.rfc} está registrado y listo para timbrar.`}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          columns={columnsRFCs}
          dataSource={finkokUsers}
          rowKey="taxpayer_id"
          loading={loadingUsers}
          size="small"
          pagination={false}
          locale={{
            emptyText: 'No hay RFCs registrados',
          }}
        />
      </Card>
    </div>
  )
}
