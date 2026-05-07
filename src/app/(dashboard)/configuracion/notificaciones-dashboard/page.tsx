'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Button, Space, Typography, Tag, Modal, Form, Input, Select,
  DatePicker, Switch, message, Popconfirm, Alert
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  RocketOutlined, ThunderboltOutlined, ToolOutlined, InfoCircleOutlined,
  EyeOutlined, BellOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  useDashboardNotificacionesAdmin,
  useUpsertDashboardNotificacion,
  useDeleteDashboardNotificacion,
  type DashboardNotificacion,
  type DashboardNotificacionTipo,
} from '@/lib/hooks/queries/useDashboardNotificaciones'
import DashboardNotificacionesBanner from '@/components/dashboard/DashboardNotificacionesBanner'

const { Title, Text } = Typography
const { TextArea } = Input

const TIPO_OPCIONES: { value: DashboardNotificacionTipo; label: string; color: string }[] = [
  { value: 'nuevo', label: 'Nuevo (verde)', color: 'green' },
  { value: 'mejora', label: 'Mejora (azul)', color: 'blue' },
  { value: 'fix', label: 'Fix (naranja)', color: 'orange' },
  { value: 'aviso', label: 'Aviso (gris)', color: 'default' },
]

const ROLES_OPCIONES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin_cliente', label: 'Admin Cliente' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'compras', label: 'Compras' },
  { value: 'contador', label: 'Contador' },
]

export default function NotificacionesDashboardPage() {
  const router = useRouter()
  const { role, orgId } = useAuth()
  const isSuperAdmin = role === 'super_admin'
  const isAdmin = role === 'admin_cliente' || role === 'super_admin'

  const { data: lista = [], isLoading } = useDashboardNotificacionesAdmin()
  const upsertMutation = useUpsertDashboardNotificacion()
  const deleteMutation = useDeleteDashboardNotificacion()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DashboardNotificacion | null>(null)
  const [form] = Form.useForm()
  const [previewValues, setPreviewValues] = useState<DashboardNotificacion | null>(null)

  const handleNuevo = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      tipo: 'nuevo',
      activo: true,
      fecha_inicio: dayjs(),
      organizacion_id: isSuperAdmin ? null : orgId,
    })
    setPreviewValues(null)
    setModalOpen(true)
  }

  const handleEditar = (record: DashboardNotificacion) => {
    setEditing(record)
    form.setFieldsValue({
      titulo: record.titulo,
      descripcion: record.descripcion,
      tipo: record.tipo,
      cta_label: record.cta_label,
      cta_ruta: record.cta_ruta,
      fecha_inicio: dayjs(record.fecha_inicio),
      fecha_fin: record.fecha_fin ? dayjs(record.fecha_fin) : null,
      dirigido_a_roles: record.dirigido_a_roles,
      organizacion_id: record.organizacion_id,
      activo: record.activo,
    })
    setPreviewValues(record)
    setModalOpen(true)
  }

  const handleEliminar = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      message.success('Notificacion eliminada')
    } catch (err: any) {
      message.error(err.message || 'Error al eliminar')
    }
  }

  const handleGuardar = async () => {
    try {
      const values = await form.validateFields()
      await upsertMutation.mutateAsync({
        id: editing?.id,
        titulo: values.titulo,
        descripcion: values.descripcion || null,
        tipo: values.tipo,
        cta_label: values.cta_label || null,
        cta_ruta: values.cta_ruta || null,
        fecha_inicio: values.fecha_inicio.format('YYYY-MM-DD'),
        fecha_fin: values.fecha_fin ? values.fecha_fin.format('YYYY-MM-DD') : null,
        dirigido_a_roles: values.dirigido_a_roles?.length ? values.dirigido_a_roles : null,
        organizacion_id: values.organizacion_id || null,
        activo: values.activo,
      })
      message.success(editing ? 'Notificacion actualizada' : 'Notificacion creada')
      setModalOpen(false)
      setEditing(null)
      form.resetFields()
    } catch (err: any) {
      if (err.errorFields) return // validation errors
      message.error(err.message || 'Error al guardar')
    }
  }

  const handleValuesChange = (_: any, all: any) => {
    if (!all.titulo) return setPreviewValues(null)
    setPreviewValues({
      id: 'preview',
      titulo: all.titulo,
      descripcion: all.descripcion ?? null,
      tipo: all.tipo,
      icono: null,
      cta_label: all.cta_label ?? null,
      cta_ruta: all.cta_ruta ?? null,
      fecha_inicio: all.fecha_inicio?.format('YYYY-MM-DD') ?? '',
      fecha_fin: all.fecha_fin ? all.fecha_fin.format('YYYY-MM-DD') : null,
      dirigido_a_roles: all.dirigido_a_roles ?? null,
      organizacion_id: all.organizacion_id ?? null,
      activo: all.activo,
      created_at: '',
    })
  }

  const columns: ColumnsType<DashboardNotificacion> = useMemo(() => [
    {
      title: 'Tipo', dataIndex: 'tipo', key: 'tipo', width: 100,
      render: (t: DashboardNotificacionTipo) => {
        const cfg = TIPO_OPCIONES.find(o => o.value === t)
        return <Tag color={cfg?.color}>{(cfg?.label.split(' ')[0] || t).toUpperCase()}</Tag>
      },
    },
    {
      title: 'Titulo', dataIndex: 'titulo', key: 'titulo', ellipsis: true, width: 240,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Vigencia', key: 'vigencia', width: 200,
      render: (_, r) => (
        <Text style={{ fontSize: 12 }}>
          {dayjs(r.fecha_inicio).format('DD/MM/YYYY')}
          {r.fecha_fin ? ` → ${dayjs(r.fecha_fin).format('DD/MM/YYYY')}` : ' → sin fin'}
        </Text>
      ),
    },
    {
      title: 'Roles', dataIndex: 'dirigido_a_roles', key: 'roles', width: 180,
      render: (roles: string[] | null) =>
        !roles?.length ? <Text type="secondary" style={{ fontSize: 11 }}>Todos</Text> :
          <Space size={2} wrap>
            {roles.map(r => <Tag key={r} style={{ fontSize: 10 }}>{r}</Tag>)}
          </Space>,
    },
    {
      title: 'Org', dataIndex: 'organizacion_id', key: 'org', width: 100, align: 'center',
      render: (id: string | null) =>
        id ? <Tag color="blue" style={{ fontSize: 10 }}>Especifica</Tag>
           : <Tag style={{ fontSize: 10 }}>Global</Tag>,
    },
    {
      title: 'Estado', dataIndex: 'activo', key: 'activo', width: 90, align: 'center',
      render: (a: boolean) => a ? <Tag color="green">Activo</Tag> : <Tag>Pausado</Tag>,
    },
    {
      title: 'CTA', dataIndex: 'cta_ruta', key: 'cta', width: 140, ellipsis: true,
      render: (ruta: string | null, r) => ruta ? (
        <Text style={{ fontSize: 11 }} code>{ruta}</Text>
      ) : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Acciones', key: 'acciones', width: 130, align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditar(r)}>Editar</Button>
          <Popconfirm title="¿Eliminar notificacion?" onConfirm={() => handleEliminar(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [])

  if (!isAdmin) {
    return (
      <Alert type="error" message="Solo administradores pueden gestionar notificaciones del dashboard." />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/configuracion')}>Volver</Button>
          <Title level={2} style={{ margin: 0 }}><BellOutlined /> Notificaciones del Dashboard</Title>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleNuevo}>
          Nueva notificacion
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        message="Las notificaciones aparecen como banner en el Dashboard arriba a la derecha. Cada usuario puede cerrarlas individualmente."
        style={{ marginBottom: 16 }}
      />

      <Card>
        <Table
          rowKey="id"
          dataSource={lista}
          columns={columns}
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: 'Aun no hay notificaciones. Crea la primera con el boton de arriba.' }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? `Editar: ${editing.titulo}` : 'Nueva notificacion'}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); setPreviewValues(null) }}
        onOk={handleGuardar}
        okText={editing ? 'Guardar cambios' : 'Crear'}
        confirmLoading={upsertMutation.isPending}
        width={700}
        destroyOnClose
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
          <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
            <Form.Item name="titulo" label="Titulo" rules={[{ required: true, max: 120 }]}>
              <Input placeholder="ej. Modulo de Logistica disponible" />
            </Form.Item>
            <Form.Item name="descripcion" label="Descripcion (opcional)">
              <TextArea rows={2} placeholder="Una linea adicional con detalle." />
            </Form.Item>
            <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
              <Select options={TIPO_OPCIONES.map(o => ({ value: o.value, label: o.label }))} />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="cta_label" label="Boton (opcional)">
                <Input placeholder="Probar ahora" maxLength={60} />
              </Form.Item>
              <Form.Item name="cta_ruta" label="Ruta del boton">
                <Input placeholder="/envios" />
              </Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="fecha_inicio" label="Desde" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item name="fecha_fin" label="Hasta (opcional)">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </div>
            <Form.Item name="dirigido_a_roles" label="Dirigido a roles (vacio = todos)">
              <Select mode="multiple" allowClear options={ROLES_OPCIONES} />
            </Form.Item>
            {isSuperAdmin && (
              <Form.Item name="organizacion_id" label="Organizacion (vacio = todas las orgs)">
                <Input placeholder="UUID o vacio para global" />
              </Form.Item>
            )}
            <Form.Item name="activo" label="Activo" valuePropName="checked">
              <Switch checkedChildren="Activo" unCheckedChildren="Pausado" />
            </Form.Item>
          </Form>

          <div>
            <Text type="secondary" style={{ fontSize: 11, marginBottom: 8, display: 'block' }}>
              <EyeOutlined /> Vista previa:
            </Text>
            <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, minHeight: 140 }}>
              {previewValues ? (
                <PreviewBanner notif={previewValues} />
              ) : (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Llena el titulo para ver la vista previa.
                </Text>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/** Preview standalone (sin hook) para mostrar mientras se edita. */
function PreviewBanner({ notif }: { notif: DashboardNotificacion }) {
  const { tipo, titulo, descripcion, cta_label } = notif
  const TIPO_CFG: Record<DashboardNotificacionTipo, { bg: string; border: string; color: string; label: string; icon: React.ReactNode }> = {
    nuevo: { bg: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)', border: '#b7eb8f', color: '#52c41a', label: 'NUEVO', icon: <RocketOutlined /> },
    mejora: { bg: 'linear-gradient(135deg, #e6f4ff 0%, #bae0ff 100%)', border: '#91caff', color: '#1677ff', label: 'MEJORA', icon: <ThunderboltOutlined /> },
    fix: { bg: 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)', border: '#ffd591', color: '#fa8c16', label: 'FIX', icon: <ToolOutlined /> },
    aviso: { bg: 'linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%)', border: '#d9d9d9', color: '#595959', label: 'AVISO', icon: <InfoCircleOutlined /> },
  }
  const cfg = TIPO_CFG[tipo]
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, padding: '10px 14px', maxWidth: 380 }}>
      <Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>
        {cfg.label}
      </Tag>
      <div style={{ marginTop: 6 }}>
        <Text strong style={{ fontSize: 13 }}>{titulo}</Text>
        {descripcion && <div><Text type="secondary" style={{ fontSize: 11 }}>{descripcion}</Text></div>}
      </div>
      {cta_label && (
        <div style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>{cta_label} →</Text>
        </div>
      )}
    </div>
  )
}
