'use client'

import { useEffect, useState, useMemo } from 'react'
import { Table, Button, Modal, Form, Input, Space, Card, Typography, message, Popconfirm, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Almacen, InsertTables } from '@/types/database'

const { Title } = Typography

export default function AlmacenesPage() {
  const [loading, setLoading] = useState(true)
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadAlmacenes()
  }, [])

  const loadAlmacenes = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('almacenes')
        .select('*')
        .eq('is_active', true)
        .order('codigo')

      if (error) throw error
      setAlmacenes(data || [])
    } catch (error) {
      console.error('Error loading almacenes:', error)
      message.error('Error al cargar almacenes')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (values: InsertTables<'almacenes'>) => {
    const supabase = getSupabaseClient()

    try {
      if (editingId) {
        const { error } = await supabase
          .schema('erp')
          .from('almacenes')
          .update(values)
          .eq('id', editingId)

        if (error) throw error
        message.success('Almacén actualizado')
      } else {
        const { error } = await supabase
          .schema('erp')
          .from('almacenes')
          .insert(values)

        if (error) throw error
        message.success('Almacén creado')
      }

      setModalOpen(false)
      form.resetFields()
      setEditingId(null)
      loadAlmacenes()
    } catch (error: any) {
      console.error('Error saving almacen:', error)
      message.error(error.message || 'Error al guardar almacén')
    }
  }

  const handleEdit = (record: Almacen) => {
    setEditingId(record.id)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseClient()

    try {
      const { error } = await supabase
        .schema('erp')
        .from('almacenes')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
      message.success('Almacén eliminado')
      loadAlmacenes()
    } catch (error) {
      console.error('Error deleting almacen:', error)
      message.error('Error al eliminar almacén')
    }
  }

  const columns = useMemo<ColumnsType<Almacen>>(() => [
    {
      title: 'Código',
      dataIndex: 'codigo',
      key: 'codigo',
      width: 100,
    },
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
    },
    {
      title: 'Dirección',
      dataIndex: 'direccion',
      key: 'direccion',
      ellipsis: true,
    },
    {
      title: 'Teléfono',
      dataIndex: 'telefono',
      key: 'telefono',
      width: 130,
    },
    {
      title: 'Responsable',
      dataIndex: 'responsable',
      key: 'responsable',
      width: 150,
    },
    {
      title: 'Activo',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active) => active ? 'Sí' : 'No',
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title="¿Eliminar almacén?"
            onConfirm={() => handleDelete(record.id)}
            okText="Sí"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>Almacenes</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingId(null)
            form.resetFields()
            setModalOpen(true)
          }}
        >
          Nuevo Almacén
        </Button>
      </div>

      <Card>
        <Table
          dataSource={almacenes}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 800 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingId ? 'Editar Almacén' : 'Nuevo Almacén'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
          setEditingId(null)
        }}
        onOk={() => form.submit()}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ is_active: true }}
        >
          <Form.Item
            name="codigo"
            label="Código"
            rules={[{ required: true, message: 'El código es requerido' }]}
          >
            <Input placeholder="ALM-001" />
          </Form.Item>
          <Form.Item
            name="nombre"
            label="Nombre"
            rules={[{ required: true, message: 'El nombre es requerido' }]}
          >
            <Input placeholder="Almacén Central" />
          </Form.Item>
          <Form.Item name="direccion" label="Dirección">
            <Input.TextArea rows={2} placeholder="Dirección completa" />
          </Form.Item>
          <Form.Item name="telefono" label="Teléfono">
            <Input placeholder="55-1234-5678" />
          </Form.Item>
          <Form.Item name="responsable" label="Responsable">
            <Input placeholder="Nombre del responsable" />
          </Form.Item>
          <Form.Item name="is_active" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
