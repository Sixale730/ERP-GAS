'use client'

import { useState, useEffect } from 'react'
import {
  Card, Typography, Space, Button, Alert, Modal, Input,
  Descriptions, Divider, message, Spin, Tag
} from 'antd'
import {
  WarningOutlined, DeleteOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, ReloadOutlined
} from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

interface Conteos {
  cotizaciones: number
  facturas: number
  ordenes_compra: number
  pagos: number
  movimientos_inventario: number
  recepciones_orden: number
}

const CONFIRM_PHRASE = 'CONFIRMO REINICIAR SISTEMA'

export default function ConfiguracionAdminPage() {
  const [loading, setLoading] = useState(true)
  const [conteos, setConteos] = useState<Conteos | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [reseteando, setReseteando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  useEffect(() => {
    cargarConteos()
  }, [])

  const cargarConteos = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/reiniciar-sistema')
      const data = await response.json()
      if (data.success) {
        setConteos(data.conteos)
      } else {
        message.error('Error al cargar conteos')
      }
    } catch (error) {
      console.error('Error al cargar conteos:', error)
      message.error('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const totalRegistros = conteos
    ? Object.values(conteos).reduce((a, b) => a + b, 0)
    : 0

  const handleReiniciar = async () => {
    if (confirmText !== CONFIRM_PHRASE) {
      message.error('Escribe la frase de confirmacion exactamente')
      return
    }

    setReseteando(true)
    try {
      const response = await fetch('/api/admin/reiniciar-sistema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmacion: confirmText })
      })

      const data = await response.json()

      if (data.success) {
        setResultado(data)
        setModalOpen(false)
        setConfirmText('')
        message.success('Sistema reiniciado exitosamente')
        cargarConteos()
      } else {
        message.error(data.error || 'Error al reiniciar')
      }
    } catch (error) {
      message.error('Error de conexion')
    } finally {
      setReseteando(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
          Administracion del Sistema
        </Title>
        <Text type="secondary">
          Herramientas administrativas avanzadas. Usar con precaucion.
        </Text>
      </div>

      {resultado && (
        <Alert
          type="success"
          message="Sistema Reiniciado"
          description={`Se eliminaron los datos transaccionales el ${new Date(resultado.fecha_ejecucion).toLocaleString('es-MX')}`}
          showIcon
          closable
          onClose={() => setResultado(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        title={
          <Space>
            <DeleteOutlined style={{ color: '#ff4d4f' }} />
            Reiniciar Sistema Transaccional
          </Space>
        }
      >
        <Alert
          type="error"
          message="ACCION DESTRUCTIVA E IRREVERSIBLE"
          description={
            <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
              <li>Esta accion eliminara TODAS las cotizaciones, facturas, ordenes de compra y pagos</li>
              <li>El inventario se reseteara a cero en todos los almacenes</li>
              <li>Los folios (COT, FAC, OC, PAG) se reiniciaran a 1</li>
              <li>Los saldos pendientes de clientes se pondran en cero</li>
              <li><strong>Esta operacion NO se puede deshacer</strong></li>
            </ul>
          }
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 24 }}
        />

        <Card type="inner" title="Datos que se eliminaran" style={{ marginBottom: 24 }}>
          {conteos && (
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
              <Descriptions.Item label="Cotizaciones">
                <Text strong>{conteos.cotizaciones}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Facturas">
                <Text strong>{conteos.facturas}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ordenes de Compra">
                <Text strong>{conteos.ordenes_compra}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Pagos">
                <Text strong>{conteos.pagos}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Movimientos Inventario">
                <Text strong>{conteos.movimientos_inventario}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Recepciones">
                <Text strong>{conteos.recepciones_orden}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="TOTAL">
                <Text strong type="danger">{totalRegistros} registros</Text>
              </Descriptions.Item>
            </Descriptions>
          )}
        </Card>

        <Card type="inner" title="Datos que se PRESERVARAN" style={{ marginBottom: 24 }}>
          <Space wrap>
            <Tag color="green">Productos</Tag>
            <Tag color="green">Clientes</Tag>
            <Tag color="green">Proveedores</Tag>
            <Tag color="green">Almacenes</Tag>
            <Tag color="green">Categorias</Tag>
            <Tag color="green">Listas de Precios</Tag>
            <Tag color="green">Configuracion</Tag>
            <Tag color="green">Certificados CFDI</Tag>
          </Space>
        </Card>

        <Divider />

        <Space>
          <Button
            danger
            type="primary"
            size="large"
            icon={<DeleteOutlined />}
            onClick={() => setModalOpen(true)}
            disabled={totalRegistros === 0}
          >
            Reiniciar Sistema
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={cargarConteos}
          >
            Actualizar Conteos
          </Button>
        </Space>

        {totalRegistros === 0 && (
          <Alert
            type="info"
            message="No hay datos transaccionales"
            description="El sistema ya esta limpio, no hay nada que reiniciar."
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />
            <span>Confirmar Reinicio del Sistema</span>
          </Space>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setConfirmText('')
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setModalOpen(false)
            setConfirmText('')
          }}>
            Cancelar
          </Button>,
          <Button
            key="confirm"
            danger
            type="primary"
            loading={reseteando}
            disabled={confirmText !== CONFIRM_PHRASE}
            onClick={handleReiniciar}
          >
            Reiniciar Sistema
          </Button>
        ]}
        width={500}
      >
        <Alert
          type="warning"
          message="Esta a punto de eliminar todos los datos transaccionales"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Paragraph>
          Para confirmar, escribe exactamente la siguiente frase:
        </Paragraph>

        <Paragraph code style={{ fontSize: 16, textAlign: 'center' }}>
          {CONFIRM_PHRASE}
        </Paragraph>

        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Escribe la frase de confirmacion..."
          size="large"
          status={confirmText && confirmText !== CONFIRM_PHRASE ? 'error' : undefined}
        />

        {confirmText === CONFIRM_PHRASE && (
          <Alert
            type="success"
            message="Confirmacion correcta"
            icon={<CheckCircleOutlined />}
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>
    </div>
  )
}
