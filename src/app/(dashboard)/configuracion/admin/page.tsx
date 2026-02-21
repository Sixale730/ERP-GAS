'use client'

import { useState, useEffect } from 'react'
import {
  Card, Typography, Space, Button, Alert, Modal, Input,
  Descriptions, Divider, message, Spin, Tag, Switch, List, Tooltip
} from 'antd'
import {
  WarningOutlined, DeleteOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, ReloadOutlined, AppstoreOutlined, LockOutlined
} from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useModulos, modulosKeys } from '@/lib/hooks/useModulos'
import { MODULOS_REGISTRO, TODOS_LOS_MODULOS, getDependientes } from '@/lib/config/modulos'
import type { Modulo } from '@/lib/hooks/usePermisos'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resultado, setResultado] = useState<any>(null)

  // Module management state
  const { modulosGlobales, loading: loadingModulos } = useModulos()
  const [modulosHabilitados, setModulosHabilitados] = useState<Set<string>>(new Set())
  const [savingModulos, setSavingModulos] = useState(false)
  const [depModalOpen, setDepModalOpen] = useState(false)
  const [pendingToggle, setPendingToggle] = useState<{ modulo: Modulo; activar: boolean; dependientes: Modulo[] } | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    cargarConteos()
  }, [])

  // Sync local state with server data
  useEffect(() => {
    if (!loadingModulos) {
      setModulosHabilitados(new Set(modulosGlobales))
    }
  }, [loadingModulos, modulosGlobales])

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
    } catch {
      message.error('Error de conexion')
    } finally {
      setReseteando(false)
    }
  }

  // --- Module toggle logic ---

  const handleModuloToggle = (modulo: Modulo, activar: boolean) => {
    if (!activar) {
      // Disabling: check dependents
      const dependientes = getDependientes(modulo).filter((d) => modulosHabilitados.has(d))
      if (dependientes.length > 0) {
        setPendingToggle({ modulo, activar, dependientes })
        setDepModalOpen(true)
        return
      }
    }
    applyToggle(modulo, activar, [])
  }

  const applyToggle = (modulo: Modulo, activar: boolean, alsoDisable: Modulo[]) => {
    setModulosHabilitados((prev) => {
      const next = new Set(prev)
      if (activar) {
        next.add(modulo)
        // Also enable dependencies
        const info = MODULOS_REGISTRO[modulo]
        for (const dep of info.dependencias) {
          next.add(dep)
        }
      } else {
        next.delete(modulo)
        for (const d of alsoDisable) {
          next.delete(d)
        }
      }
      return next
    })
  }

  const confirmDisableWithDeps = () => {
    if (pendingToggle) {
      applyToggle(pendingToggle.modulo, false, pendingToggle.dependientes)
    }
    setDepModalOpen(false)
    setPendingToggle(null)
  }

  const handleGuardarModulos = async () => {
    setSavingModulos(true)
    try {
      const supabase = getSupabaseClient()
      const modulosArray = TODOS_LOS_MODULOS.filter((m) => modulosHabilitados.has(m))

      const { error } = await supabase
        .schema('erp')
        .from('configuracion')
        .upsert(
          { clave: 'modulos_habilitados', valor: { modulos: modulosArray } },
          { onConflict: 'clave' }
        )

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: modulosKeys.global })
      message.success('Modulos actualizados correctamente')
    } catch (err) {
      console.error('Error saving modules:', err)
      message.error('Error al guardar modulos')
    } finally {
      setSavingModulos(false)
    }
  }

  const hasModuloChanges = (() => {
    if (loadingModulos) return false
    const currentSet = new Set(modulosGlobales)
    if (currentSet.size !== modulosHabilitados.size) return true
    const habilitadosArr = Array.from(modulosHabilitados)
    for (let i = 0; i < habilitadosArr.length; i++) {
      if (!currentSet.has(habilitadosArr[i])) return true
    }
    return false
  })()

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

      {/* ==================== MODULOS DEL SISTEMA ==================== */}
      <Card
        title={
          <Space>
            <AppstoreOutlined style={{ color: '#1890ff' }} />
            Modulos del Sistema
          </Space>
        }
        style={{ marginBottom: 24 }}
        loading={loadingModulos}
      >
        <Alert
          type="info"
          message="Controla que modulos estan disponibles en todo el sistema"
          description="Al deshabilitar un modulo, desaparece del menu y se bloquea el acceso directo para todas las organizaciones."
          showIcon
          style={{ marginBottom: 16 }}
        />

        <List
          dataSource={TODOS_LOS_MODULOS}
          renderItem={(modulo) => {
            const info = MODULOS_REGISTRO[modulo]
            const activo = modulosHabilitados.has(modulo)
            const isCore = info.core

            return (
              <List.Item
                actions={[
                  isCore ? (
                    <Tooltip key="lock" title="Modulo esencial, no se puede deshabilitar">
                      <Switch checked disabled />
                    </Tooltip>
                  ) : (
                    <Switch
                      key="switch"
                      checked={activo}
                      onChange={(checked) => handleModuloToggle(modulo, checked)}
                    />
                  ),
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {info.label}
                      {isCore && (
                        <Tag icon={<LockOutlined />} color="default">
                          Esencial
                        </Tag>
                      )}
                      {!activo && !isCore && (
                        <Tag color="red">Deshabilitado</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">{info.descripcion}</Text>
                      {info.dependencias.length > 0 && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Depende de: {info.dependencias.map((d) => MODULOS_REGISTRO[d].label).join(', ')}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )
          }}
        />

        <Divider />

        <Button
          type="primary"
          onClick={handleGuardarModulos}
          loading={savingModulos}
          disabled={!hasModuloChanges}
        >
          Guardar Modulos
        </Button>
        {hasModuloChanges && (
          <Text type="warning" style={{ marginLeft: 12 }}>
            Hay cambios sin guardar
          </Text>
        )}
      </Card>

      {/* ==================== REINICIO DE SISTEMA ==================== */}

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

      {/* Modal: confirmar reinicio */}
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

      {/* Modal: advertencia de dependencias */}
      <Modal
        title="Advertencia de dependencias"
        open={depModalOpen}
        onCancel={() => {
          setDepModalOpen(false)
          setPendingToggle(null)
        }}
        onOk={confirmDisableWithDeps}
        okText="Deshabilitar todos"
        okButtonProps={{ danger: true }}
        cancelText="Cancelar"
      >
        {pendingToggle && (
          <>
            <Paragraph>
              Si desactivas <Text strong>{MODULOS_REGISTRO[pendingToggle.modulo].label}</Text>, tambien se desactivaran los siguientes modulos que dependen de el:
            </Paragraph>
            <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
              {pendingToggle.dependientes.map((dep) => (
                <Tag key={dep} color="orange">
                  {MODULOS_REGISTRO[dep].label}
                </Tag>
              ))}
            </Space>
          </>
        )}
      </Modal>
    </div>
  )
}
