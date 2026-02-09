'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Checkbox,
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
  SettingOutlined,
} from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth, UserRole, PermisosUsuario } from '@/lib/hooks/useAuth'
import { MODULOS, PERMISOS_DEFAULT, Modulo, Accion } from '@/lib/hooks/usePermisos'

const { Title, Text } = Typography

interface Usuario {
  id: string
  email: string
  nombre: string | null
  rol: UserRole
  is_active: boolean
  created_at: string
  ultimo_acceso: string | null
  permisos: PermisosUsuario | null
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
  compras: { label: 'Compras', color: 'orange' },
  contador: { label: 'Contador', color: 'cyan' },
}

const ACCIONES: { key: Accion; label: string }[] = [
  { key: 'ver', label: 'Ver' },
  { key: 'crear', label: 'Crear' },
  { key: 'editar', label: 'Editar' },
  { key: 'eliminar', label: 'Eliminar' },
]

// Componente de tabla de permisos reutilizable
function PermisosTable({
  permisos,
  onChange,
}: {
  permisos: PermisosUsuario
  onChange: (permisos: PermisosUsuario) => void
}) {
  const handleChange = (modulo: Modulo, accion: Accion, checked: boolean) => {
    const updated = { ...permisos }
    updated[modulo] = { ...updated[modulo], [accion]: checked }
    // Si desmarcan "ver", desmarcar todo lo demas del modulo
    if (accion === 'ver' && !checked) {
      updated[modulo] = { ver: false, crear: false, editar: false, eliminar: false }
    }
    onChange(updated)
  }

  const columns = [
    {
      title: 'Modulo',
      dataIndex: 'label',
      key: 'label',
      width: 160,
    },
    ...ACCIONES.map((accion) => ({
      title: accion.label,
      key: accion.key,
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: { key: Modulo; label: string }) => (
        <Checkbox
          checked={permisos[record.key]?.[accion.key] ?? false}
          onChange={(e) => handleChange(record.key, accion.key, e.target.checked)}
        />
      ),
    })),
  ]

  return (
    <Table
      dataSource={MODULOS}
      columns={columns}
      rowKey="key"
      pagination={false}
      size="small"
      bordered
    />
  )
}

export default function UsuariosPage() {
  const { isSuperAdmin, isAdmin, orgId, organizacion } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [autorizados, setAutorizados] = useState<UsuarioAutorizado[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudAcceso[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form] = Form.useForm()

  // Estado para permisos en el modal de agregar usuario
  const [addPermisos, setAddPermisos] = useState<PermisosUsuario>(
    () => ({ ...PERMISOS_DEFAULT.vendedor })
  )

  // Estado para el modal de editar permisos de usuario activo
  const [permisosModalOpen, setPermisosModalOpen] = useState(false)
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null)
  const [editPermisos, setEditPermisos] = useState<PermisosUsuario>({})
  const [savingPermisos, setSavingPermisos] = useState(false)

  // Estado para el modal de aprobacion de solicitud
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [approvingSolicitud, setApprovingSolicitud] = useState<SolicitudAcceso | null>(null)
  const [approvalRol, setApprovalRol] = useState<UserRole>('vendedor')
  const [approvalPermisos, setApprovalPermisos] = useState<PermisosUsuario>(
    () => ({ ...PERMISOS_DEFAULT.vendedor })
  )
  const [approving, setApproving] = useState(false)

  // Opciones de rol - super_admin solo puede ser asignado por super_admin
  const roleOptions = [
    ...(isSuperAdmin ? [{ value: 'super_admin', label: 'Super Admin' }] : []),
    ...(isSuperAdmin ? [{ value: 'admin_cliente', label: 'Administrador' }] : []),
    { value: 'vendedor', label: 'Vendedor' },
    { value: 'compras', label: 'Compras' },
    { value: 'contador', label: 'Contador' },
  ]

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabaseClient()

    // Obtener usuarios de la organizacion
    let usuariosQuery = supabase
      .schema('erp')
      .from('usuarios')
      .select('id, email, nombre, rol, is_active, created_at, ultimo_acceso, permisos')
      .order('created_at', { ascending: false })

    if (!isSuperAdmin && orgId) {
      usuariosQuery = usuariosQuery.eq('organizacion_id', orgId)
    }

    const { data: usuariosData } = await usuariosQuery
    if (usuariosData) {
      const filteredUsuarios = isSuperAdmin
        ? usuariosData
        : usuariosData.filter((u: Usuario) => u.rol !== 'super_admin')
      setUsuarios(filteredUsuarios as Usuario[])
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
  }, [isSuperAdmin, orgId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Cuando cambia el rol en el formulario de agregar, actualizar permisos defaults
  const handleRolChange = (rol: UserRole) => {
    const defaults = PERMISOS_DEFAULT[rol]
    if (defaults) {
      setAddPermisos({ ...defaults })
    }
  }

  const handleAddAuthorized = async (values: { email: string; rol: UserRole; nombre?: string }) => {
    setAdding(true)
    const supabase = getSupabaseClient()
    const normalizedEmail = values.email.toLowerCase()

    try {
      // Verificar que el email no exista ya
      const { data: existingUser } = await supabase
        .schema('erp')
        .from('usuarios')
        .select('id')
        .ilike('email', normalizedEmail)
        .single()

      if (existingUser) {
        message.error('Este email ya tiene una cuenta')
        return
      }

      // Verificar si los permisos son iguales a los defaults del rol
      const defaults = PERMISOS_DEFAULT[values.rol]
      const isDefault = JSON.stringify(addPermisos) === JSON.stringify(defaults)

      // Agregar a usuarios_autorizados
      const { error } = await supabase
        .schema('erp')
        .from('usuarios_autorizados')
        .insert({
          email: normalizedEmail,
          rol: values.rol,
          nombre: values.nombre || null,
          organizacion_id: orgId,
          estado: 'pendiente_registro',
          permisos: isDefault ? null : addPermisos,
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
      setAddPermisos({ ...PERMISOS_DEFAULT.vendedor })
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('eliminar_usuario', { p_usuario_id: id })

    if (error) {
      message.error(error.message || 'Error al eliminar usuario')
    } else {
      message.success('Usuario eliminado permanentemente')
      fetchData()
    }
  }

  const handleOpenPermisos = (usuario: Usuario) => {
    setEditingUsuario(usuario)
    // Si el usuario tiene permisos custom, usarlos; si no, usar defaults del rol
    const efectivos = usuario.permisos || PERMISOS_DEFAULT[usuario.rol] || PERMISOS_DEFAULT.vendedor
    setEditPermisos({ ...efectivos })
    setPermisosModalOpen(true)
  }

  const handleSavePermisos = async () => {
    if (!editingUsuario) return
    setSavingPermisos(true)
    const supabase = getSupabaseClient()

    // Verificar si los permisos son iguales a los defaults del rol
    const defaults = PERMISOS_DEFAULT[editingUsuario.rol]
    const isDefault = JSON.stringify(editPermisos) === JSON.stringify(defaults)

    const { error } = await supabase
      .schema('erp')
      .from('usuarios')
      .update({ permisos: isDefault ? null : editPermisos })
      .eq('id', editingUsuario.id)

    if (error) {
      message.error('Error al guardar permisos')
    } else {
      message.success('Permisos actualizados')
      setPermisosModalOpen(false)
      setEditingUsuario(null)
      fetchData()
    }
    setSavingPermisos(false)
  }

  const handleOpenApproval = (solicitud: SolicitudAcceso) => {
    setApprovingSolicitud(solicitud)
    setApprovalRol('vendedor')
    setApprovalPermisos({ ...PERMISOS_DEFAULT.vendedor })
    setApprovalModalOpen(true)
  }

  const handleApprovalRolChange = (rol: UserRole) => {
    setApprovalRol(rol)
    setApprovalPermisos({ ...PERMISOS_DEFAULT[rol] })
  }

  const handleSolicitud = async (solicitudId: string, accion: 'aprobar' | 'rechazar', rol?: string, permisos?: PermisosUsuario) => {
    try {
      if (accion === 'aprobar') setApproving(true)

      const response = await fetch('/api/solicitudes-acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitudId, accion, rol, permisos }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar solicitud')
      }

      message.success(accion === 'aprobar' ? 'Usuario aprobado' : 'Solicitud rechazada')
      setApprovalModalOpen(false)
      setApprovingSolicitud(null)
      fetchData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Error')
    } finally {
      setApproving(false)
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
      render: (_: unknown, record: Usuario) => {
        // No mostrar acciones para super_admin si no eres super_admin
        if (record.rol === 'super_admin' && !isSuperAdmin) {
          return <Text type="secondary">-</Text>
        }
        return (
          <Space>
            <Button
              size="small"
              icon={<SettingOutlined />}
              onClick={() => handleOpenPermisos(record)}
              title="Permisos"
            >
              Permisos
            </Button>
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
            {isAdmin && (
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
        )
      },
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
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleOpenApproval(record)}>
            Aprobar
          </Button>
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

      {/* Modal: Agregar Usuario Autorizado */}
      <Modal
        title="Agregar Usuario Autorizado"
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false)
          form.resetFields()
          setAddPermisos({ ...PERMISOS_DEFAULT.vendedor })
        }}
        footer={null}
        width={700}
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
            <Select options={roleOptions} onChange={handleRolChange} />
          </Form.Item>

          <Divider>Permisos de Acceso</Divider>
          <PermisosTable permisos={addPermisos} onChange={setAddPermisos} />

          <Alert
            message="El usuario podra iniciar sesion con Google usando este email. Su cuenta se creara automaticamente."
            type="info"
            showIcon
            style={{ marginTop: 16, marginBottom: 16 }}
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

      {/* Modal: Editar Permisos de Usuario Activo */}
      <Modal
        title={`Permisos - ${editingUsuario?.nombre || editingUsuario?.email || ''}`}
        open={permisosModalOpen}
        onCancel={() => {
          setPermisosModalOpen(false)
          setEditingUsuario(null)
        }}
        width={700}
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => {
              if (editingUsuario) {
                setEditPermisos({ ...PERMISOS_DEFAULT[editingUsuario.rol] })
              }
            }}>
              Restaurar Defaults
            </Button>
            <Button onClick={() => setPermisosModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="primary" loading={savingPermisos} onClick={handleSavePermisos}>
              Guardar
            </Button>
          </Space>
        }
      >
        {editingUsuario && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">
                Rol: <Tag color={roleLabels[editingUsuario.rol]?.color}>{roleLabels[editingUsuario.rol]?.label}</Tag>
                {editingUsuario.permisos && (
                  <Tag color="gold">Permisos personalizados</Tag>
                )}
              </Text>
            </div>
            <PermisosTable permisos={editPermisos} onChange={setEditPermisos} />
          </>
        )}
      </Modal>

      {/* Modal: Aprobar Solicitud de Acceso */}
      <Modal
        title={`Aprobar solicitud - ${approvingSolicitud?.nombre || approvingSolicitud?.email || ''}`}
        open={approvalModalOpen}
        onCancel={() => {
          setApprovalModalOpen(false)
          setApprovingSolicitud(null)
        }}
        width={700}
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => {
              setApprovalPermisos({ ...PERMISOS_DEFAULT[approvalRol] })
            }}>
              Restaurar Defaults
            </Button>
            <Button onClick={() => {
              setApprovalModalOpen(false)
              setApprovingSolicitud(null)
            }}>
              Cancelar
            </Button>
            <Button
              type="primary"
              loading={approving}
              onClick={() => {
                if (approvingSolicitud) {
                  handleSolicitud(approvingSolicitud.id, 'aprobar', approvalRol, approvalPermisos)
                }
              }}
            >
              Aprobar
            </Button>
          </Space>
        }
      >
        {approvingSolicitud && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Avatar src={approvingSolicitud.avatar_url} icon={<UserOutlined />} size={48} />
              <div>
                <div style={{ fontWeight: 500 }}>{approvingSolicitud.nombre || approvingSolicitud.email}</div>
                {approvingSolicitud.nombre && <Text type="secondary">{approvingSolicitud.email}</Text>}
                {approvingSolicitud.organizaciones?.nombre && (
                  <div><Text type="secondary">Organizacion: {approvingSolicitud.organizaciones.nombre}</Text></div>
                )}
              </div>
            </div>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Rol</Text>
              <Select
                value={approvalRol}
                onChange={handleApprovalRolChange}
                options={roleOptions}
                style={{ width: 250 }}
              />
            </div>

            <Divider>Permisos de Acceso</Divider>
            <PermisosTable permisos={approvalPermisos} onChange={setApprovalPermisos} />
          </>
        )}
      </Modal>
    </div>
  )
}
