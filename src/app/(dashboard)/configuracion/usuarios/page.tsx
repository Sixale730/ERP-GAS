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
} from 'antd'
import {
  UserAddOutlined,
  DeleteOutlined,
  MailOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
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

interface Invitacion {
  id: string
  email: string
  rol: UserRole
  expira_at: string
  created_at: string
}

const roleOptions = [
  { value: 'admin_cliente', label: 'Administrador' },
  { value: 'vendedor', label: 'Vendedor' },
]

const roleLabels: Record<UserRole, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'purple' },
  admin_cliente: { label: 'Administrador', color: 'blue' },
  vendedor: { label: 'Vendedor', color: 'green' },
}

export default function UsuariosPage() {
  const { isSuperAdmin, orgId, organizacion } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    const supabase = getSupabaseClient()

    // Obtener usuarios de la organizacion
    const { data: usuariosData } = await supabase
      .schema('erp')
      .from('usuarios')
      .select('id, email, nombre, rol, is_active, created_at, ultimo_acceso')
      .order('created_at', { ascending: false })

    if (usuariosData) {
      setUsuarios(usuariosData as Usuario[])
    }

    // Obtener invitaciones pendientes
    const { data: invitacionesData } = await supabase
      .schema('erp')
      .from('invitaciones')
      .select('id, email, rol, expira_at, created_at')
      .is('usado_at', null)
      .gt('expira_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (invitacionesData) {
      setInvitaciones(invitacionesData as Invitacion[])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleInvite = async (values: { email: string; rol: UserRole }) => {
    setInviting(true)

    try {
      const response = await fetch('/api/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar invitacion')
      }

      message.success(`Invitacion enviada a ${values.email}`)
      setInviteModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Error al enviar invitacion')
    } finally {
      setInviting(false)
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

  const handleDeleteInvitation = async (id: string) => {
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .schema('erp')
      .from('invitaciones')
      .delete()
      .eq('id', id)

    if (error) {
      message.error('Error al eliminar invitacion')
    } else {
      message.success('Invitacion eliminada')
      fetchData()
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
        </Space>
      ),
    },
  ]

  const invitacionesColumns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
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
      title: 'Expira',
      dataIndex: 'expira_at',
      key: 'expira_at',
      render: (fecha: string) => {
        const expira = new Date(fecha)
        const ahora = new Date()
        const diasRestantes = Math.ceil(
          (expira.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)
        )
        return (
          <Space>
            <ClockCircleOutlined />
            {diasRestantes} dias
          </Space>
        )
      },
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_: unknown, record: Invitacion) => (
        <Popconfirm
          title="Eliminar invitacion?"
          onConfirm={() => handleDeleteInvitation(record.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
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
            onClick={() => setInviteModalOpen(true)}
          >
            Invitar Usuario
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

      <Card title="Usuarios Activos" style={{ marginBottom: 24 }}>
        <Table
          dataSource={usuarios}
          columns={usuariosColumns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {invitaciones.length > 0 && (
        <Card title="Invitaciones Pendientes">
          <Table
            dataSource={invitaciones}
            columns={invitacionesColumns}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        </Card>
      )}

      <Modal
        title="Invitar Usuario"
        open={inviteModalOpen}
        onCancel={() => {
          setInviteModalOpen(false)
          form.resetFields()
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleInvite}>
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
            name="rol"
            label="Rol"
            rules={[{ required: true, message: 'Selecciona un rol' }]}
            initialValue="vendedor"
          >
            <Select options={roleOptions} />
          </Form.Item>

          <Alert
            message="El usuario recibira un email con instrucciones para acceder al sistema usando su cuenta de Google."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Divider />

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setInviteModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={inviting}>
                Enviar Invitacion
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
