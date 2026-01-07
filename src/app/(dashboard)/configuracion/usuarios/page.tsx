'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Typography,
  Alert,
  Divider,
  Badge,
  Avatar,
  Tabs,
} from 'antd'
import {
  UserAddOutlined,
  DeleteOutlined,
  MailOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth, UserRole } from '@/lib/hooks/useAuth'

const { Title, Text } = Typography

interface Usuario {
  id: string
  email: string
  nombre: string | null
  rol: UserRole
  is_active: boolean
  created_at: string
  ultimo_acceso: string | null
}

interface UsuarioAutorizado {
  id: string
  email: string
  rol: UserRole
  nombre: string | null
  estado: string
  created_at: string
}

interface SolicitudAcceso {
  id: string
  email: string
  nombre: string | null
  avatar_url: string | null
  estado: string
  created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organizaciones: any
}

const roleLabels: Record<UserRole, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'purple' },
  admin_cliente: { label: 'Administrador', color: 'blue' },
  vendedor: { label: 'Vendedor', color: 'green' },
}

export default function UsuariosPage() {
  const { isSuperAdmin, orgId, organizacion } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [autorizados, setAutorizados] = useState<UsuarioAutorizado[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudAcceso[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form] = Form.useForm()

  // Opciones de rol - super_admin solo puede ser asignado por super_admin
  const roleOptions = [
    ...(isSuperAdmin ? [{ value: 'super_admin', label: 'Super Admin' }] : []),
    { value: 'admin_cliente', label: 'Administrador' },
    { value: 'vendedor', label: 'Vendedor' },
  ]

  const fetchData = async () => {
    setLoading(true)
    const supabase = getSupabaseClient()

    // Obtener usuarios de la organizacion
    let usuariosQuery = supabase
      .schema('erp')
      .from('usuarios')
      .select('id, email, nombre, rol, is_active, created_at, ultimo_acceso')
      .order('created_at', { ascending: false })

    if (!isSuperAdmin && orgId) {
      usuariosQuery = usuariosQuery.eq('organizacion_id', orgId)
    }

    const { data: usuariosData } = await usuariosQuery
    if (usuariosData) {
      setUsuarios(usuariosData as Usuario[])
    }

    // Obtener emails autorizados (pendientes de registro)
    let autorizadosQuery = supabase
      .schema('erp')
      .from('usuarios_autorizados')
      .select('id, email, rol, nombre, estado, created_at')
      .eq('estado', 'pendiente_registro')
      .order('created_at', { ascending: false })

    if (!isSuperAdmin && orgId) {
      autorizadosQuery = autorizadosQuery.eq('organizacion_id', orgId)
    }

    const { data: autorizadosData } = await autorizadosQuery
    if (autorizadosData) {
      setAutorizados(autorizadosData as UsuarioAutorizado[])
    }

    // Obtener solicitudes de acceso
    try {
      const response = await fetch('/api/solicitudes-acceso')
      const data = await response.json()
      if (data.solicitudes) {
        setSolicitudes(data.solicitudes.filter((s: SolicitudAcceso) => s.estado === 'pendiente'))
      }
    } catch (err) {
      console.error('Error al obtener solicitudes:', err)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, orgId])

  const handleAddAuthorized = async (values: { email: string; rol: UserRole; nombre?: string }) => {
    setAdding(true)
    const supabase = getSupabaseClient()

    try {
      // Verificar que el email no exista ya
      const { data: existingUser } = await supabase
        .schema('erp')
        .from('usuarios')
        .select('id')
        .eq('email', values.email)
        .single()

      if (existingUser) {
        message.error('Este email ya tiene una cuenta')
        return
      }

      // Agregar a usuarios_autorizados
      const { error } = await supabase
        .schema('erp')
        .from('usuarios_autorizados')
        .insert({
          email: values.email,
          rol: values.rol,
          nombre: values.nombre || null,
          organizacion_id: orgId,
          estado: 'pendiente_registro',
        })

      if (error) {
        if (error.code === '23505') {
          message.error('Este email ya esta autorizado')
        } else {
          throw error
        }
        return
      }

      message.success(`Email ${values.email} autorizado`)
      setAddModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Error al autorizar email')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteAutorizado = async (id: string) => {
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .schema('erp')
      .from('usuarios_autorizados')
      .delete()
      .eq('id', id)

    if (error) {
      message.error('Error al eliminar')
    } else {
      message.success('Autorizacion eliminada')
      fetchData()
    }
  }

  const handleToggleActive = async (usuario: Usuario) => {
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .schema('erp')
      .from('usuarios')
      .update({ is_active: !usuario.is_active })
      .eq('id', usuario.id)

    if (error) {
      message.error('Error al actualizar usuario')
    } else {
      message.success(
        usuario.is_active ? 'Usuario desactivado' : 'Usuario activado'
      )
      fetchData()
    }
  }

  const handleDeleteUsuario = async (id: string) => {
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .schema('erp')
      .from('usuarios')
      .delete()
      .eq('id', id)

    if (error) {
      message.error('Error al eliminar usuario')
    } else {
      message.success('Usuario eliminado permanentemente')
      fetchData()
    }
  }

  const handleSolicitud = async (solicitudId: string, accion: 'aprobar' | 'rechazar', rol?: string) => {
    try {
      const response = await fetch('/api/solicitudes-acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitudId, accion, rol }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar solicitud')
      }

      message.success(accion === 'aprobar' ? 'Usuario aprobado' : 'Solicitud rechazada')
      fetchData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Error')
    }
  }

  const usuariosColumns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      render: (nombre: string | null) => nombre || '-',
    },
    {
      title: 'Rol',
      dataIndex: 'rol',
      key: 'rol',
      render: (rol: UserRole) => (
        <Tag color={roleLabels[rol]?.color || 'default'}>
          {roleLabels[rol]?.label || rol}
        </Tag>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) =>
        active ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Activo
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            Inactivo
          </Tag>
        ),
    },
    {
      title: 'Ultimo Acceso',
      dataIndex: 'ultimo_acceso',
      key: 'ultimo_acceso',
      render: (fecha: string | null) =>
        fecha ? new Date(fecha).toLocaleDateString('es-MX') : 'Nunca',
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_: unknown, record: Usuario) => (
        <Space>
          <Popconfirm
            title={record.is_active ? 'Desactivar usuario?' : 'Activar usuario?'}
            description={
              record.is_active
                ? 'El usuario no podra acceder al sistema'
                : 'El usuario podra acceder nuevamente'
            }
            onConfirm={() => handleToggleActive(record)}
          >
            <Button
              size="small"
              danger={record.is_active}
              type={record.is_active ? 'default' : 'primary'}
            >
              {record.is_active ? 'Desactivar' : 'Activar'}
            </Button>
          </Popconfirm>
          {isSuperAdmin && (
            <Popconfirm
              title="Eliminar usuario permanentemente?"
              description="Esta accion no se puede deshacer. Se eliminara el usuario de la base de datos."
              onConfirm={() => handleDeleteUsuario(record.id)}
              okText="Eliminar"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const autorizadosColumns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      render: (nombre: string | null) => nombre || '-',
    },
    {
      title: 'Rol Asignado',
      dataIndex: 'rol',
      key: 'rol',
      render: (rol: UserRole) => (
        <Tag color={roleLabels[rol]?.color || 'default'}>
          {roleLabels[rol]?.label || rol}
        </Tag>
      ),
    },
    {
      title: 'Estado',
      key: 'estado',
      render: () => (
        <Tag icon={<ClockCircleOutlined />} color="processing">
          Pendiente de registro
        </Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_: unknown, record: UsuarioAutorizado) => (
        <Popconfirm
          title="Eliminar autorizacion?"
          description="El usuario ya no podra registrarse"
          onConfirm={() => handleDeleteAutorizado(record.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const solicitudesColumns = [
    {
      title: 'Usuario',
      key: 'usuario',
      render: (_: unknown, record: SolicitudAcceso) => (
        <Space>
          <Avatar src={record.avatar_url} icon={<UserOutlined />} />
          <div>
            <div>{record.nombre || record.email}</div>
            {record.nombre && <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>}
          </div>
        </Space>
      ),
    },
    {
      title: 'Organizacion',
      key: 'organizacion',
      render: (_: unknown, record: SolicitudAcceso) => (
        record.organizaciones?.nombre || '-'
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (fecha: string) => new Date(fecha).toLocaleDateString('es-MX'),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_: unknown, record: SolicitudAcceso) => (
        <Space>
          <Popconfirm
            title="Aprobar solicitud?"
            description="El usuario sera creado como Vendedor"
            onConfirm={() => handleSolicitud(record.id, 'aprobar', 'vendedor')}
          >
            <Button size="small" type="primary" icon={<CheckOutlined />}>
              Aprobar
            </Button>
          </Popconfirm>
          <Popconfirm
            title="Rechazar solicitud?"
            onConfirm={() => handleSolicitud(record.id, 'rechazar')}
          >
            <Button size="small" danger icon={<StopOutlined />}>
              Rechazar
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const tabItems = [
    {
      key: 'usuarios',
      label: 'Usuarios Activos',
      children: (
        <Table
          dataSource={usuarios}
          columns={usuariosColumns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'autorizados',
      label: (
        <Badge count={autorizados.length} offset={[10, 0]}>
          Emails Autorizados
        </Badge>
      ),
      children: (
        <>
          <Alert
            message="Usuarios pre-autorizados"
            description="Estos emails pueden registrarse directamente. Cuando inicien sesion con Google, se les creara su cuenta automaticamente."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table
            dataSource={autorizados}
            columns={autorizadosColumns}
            rowKey="id"
            loading={loading}
            pagination={false}
            locale={{ emptyText: 'No hay emails autorizados pendientes' }}
          />
        </>
      ),
    },
    {
      key: 'solicitudes',
      label: (
        <Badge count={solicitudes.length} offset={[10, 0]}>
          Solicitudes de Acceso
        </Badge>
      ),
      children: (
        <>
          <Alert
            message="Solicitudes pendientes"
            description="Usuarios que intentaron acceder sin estar autorizados. Puedes aprobar o rechazar su acceso."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table
            dataSource={solicitudes}
            columns={solicitudesColumns}
            rowKey="id"
            loading={loading}
            pagination={false}
            locale={{ emptyText: 'No hay solicitudes pendientes' }}
          />
        </>
      ),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Gestion de Usuarios
          </Title>
          {organizacion && !organizacion.is_sistema && (
            <Text type="secondary">{organizacion.nombre}</Text>
          )}
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            Actualizar
          </Button>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setAddModalOpen(true)}
          >
            Agregar Usuario
          </Button>
        </Space>
      </div>

      {isSuperAdmin && (
        <Alert
          message="Modo Super Admin"
          description="Puedes ver y gestionar usuarios de todas las organizaciones."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title="Agregar Usuario Autorizado"
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false)
          form.resetFields()
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddAuthorized}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Ingresa el email' },
              { type: 'email', message: 'Ingresa un email valido' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="usuario@ejemplo.com"
            />
          </Form.Item>

          <Form.Item
            name="nombre"
            label="Nombre (opcional)"
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Nombre del usuario"
            />
          </Form.Item>

          <Form.Item
            name="rol"
            label="Rol"
            rules={[{ required: true, message: 'Selecciona un rol' }]}
            initialValue="vendedor"
          >
            <Select options={roleOptions} />
          </Form.Item>

          <Alert
            message="El usuario podra iniciar sesion con Google usando este email. Su cuenta se creara automaticamente."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Divider />

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setAddModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={adding}>
                Agregar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
