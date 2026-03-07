'use client'

import { useState } from 'react'
import { Table, Typography, Card, Button, Modal, Form, Input, Select, Switch, message, Space, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useCajas } from '@/lib/hooks/queries/usePOS'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Caja } from '@/types/pos'

const { Title } = Typography

// Fetch almacenes for select
function useAlmacenes() {
  return useQuery({
    queryKey: ['almacenes-pos'],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('almacenes')
        .select('id, nombre, codigo')
        .eq('is_active', true)
        .order('nombre')
      if (error) throw error
      return data || []
    },
  })
}

// Fetch listas de precios
function useListasPrecios() {
  return useQuery({
    queryKey: ['listas-precios-pos'],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .schema('erp')
        .from('listas_precios')
        .select('id, nombre, codigo')
        .eq('is_active', true)
        .order('nombre')
      if (error) throw error
      return data || []
    },
  })
}

export default function CajasPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCaja, setEditingCaja] = useState<Caja | null>(null)
  const [form] = Form.useForm()

  const { data: cajas, isLoading } = useCajas()
  const { data: almacenes } = useAlmacenes()
  const { data: listas } = useListasPrecios()
  const { organizacion } = useAuth()
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const supabase = getSupabaseClient()
      if (editingCaja) {
        const { error } = await supabase
          .schema('erp')
          .from('cajas')
          .update(values)
          .eq('id', editingCaja.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .schema('erp')
          .from('cajas')
          .insert({ ...values, organizacion_id: organizacion?.id })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos', 'cajas'] })
      message.success(editingCaja ? 'Caja actualizada' : 'Caja creada')
      setModalOpen(false)
      setEditingCaja(null)
      form.resetFields()
    },
    onError: (err) => {
      message.error(`Error: ${err instanceof Error ? err.message : 'Error'}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('cajas')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos', 'cajas'] })
      message.success('Caja desactivada')
    },
  })

  const handleEdit = (caja: Caja) => {
    setEditingCaja(caja)
    form.setFieldsValue(caja)
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditingCaja(null)
    form.resetFields()
    setModalOpen(true)
  }

  const columns: ColumnsType<Caja> = [
    { title: 'Codigo', dataIndex: 'codigo', width: 100 },
    { title: 'Nombre', dataIndex: 'nombre', width: 150 },
    {
      title: 'Almacen',
      dataIndex: 'almacen_id',
      width: 150,
      render: (id: string) => almacenes?.find(a => a.id === id)?.nombre || id,
    },
    {
      title: 'Lista Precios',
      dataIndex: 'lista_precio_id',
      width: 150,
      render: (id: string | null) => id ? listas?.find(l => l.id === id)?.nombre || '—' : '—',
    },
    {
      title: 'Activa',
      dataIndex: 'is_active',
      width: 80,
      render: (v: boolean) => v ? 'Si' : 'No',
    },
    {
      title: 'Acciones',
      width: 120,
      render: (_: unknown, record: Caja) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="Desactivar caja?" onConfirm={() => deleteMutation.mutate(record.id)} okText="Si" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Cajas POS</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Nueva Caja</Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={cajas}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editingCaja ? 'Editar Caja' : 'Nueva Caja'}
        onCancel={() => { setModalOpen(false); setEditingCaja(null) }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => saveMutation.mutate(values)}
        >
          <Form.Item name="codigo" label="Codigo" rules={[{ required: true }]}>
            <Input placeholder="CAJA-01" />
          </Form.Item>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Caja Principal" />
          </Form.Item>
          <Form.Item name="almacen_id" label="Almacen" rules={[{ required: true }]}>
            <Select
              placeholder="Seleccionar almacen"
              options={almacenes?.map(a => ({ value: a.id, label: `${a.codigo} - ${a.nombre}` }))}
            />
          </Form.Item>
          <Form.Item name="lista_precio_id" label="Lista de Precios">
            <Select
              placeholder="Seleccionar lista"
              allowClear
              options={listas?.map(l => ({ value: l.id, label: l.nombre }))}
            />
          </Form.Item>
          <Form.Item name="ticket_encabezado" label="Encabezado Ticket">
            <Input.TextArea rows={2} placeholder="Texto del encabezado del ticket" />
          </Form.Item>
          <Form.Item name="ticket_pie" label="Pie de Ticket">
            <Input.TextArea rows={2} placeholder="Texto del pie del ticket" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
