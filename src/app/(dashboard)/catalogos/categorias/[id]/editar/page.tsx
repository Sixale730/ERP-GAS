'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, Form, Input, Select, Button, Space, Typography, message, Spin } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title } = Typography
const { TextArea } = Input

interface Categoria {
  id: string
  nombre: string
}

export default function EditarCategoriaPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categoriasPadre, setCategoriasPadre] = useState<Categoria[]>([])

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      const [catRes, padresRes] = await Promise.all([
        supabase.schema('erp').from('categorias').select('*').eq('id', id).single(),
        supabase.schema('erp').from('categorias').select('id, nombre').eq('is_active', true).neq('id', id).order('nombre'),
      ])

      if (catRes.error) throw catRes.error

      setCategoriasPadre(padresRes.data || [])
      form.setFieldsValue({
        nombre: catRes.data.nombre,
        descripcion: catRes.data.descripcion,
        categoria_padre_id: catRes.data.categoria_padre_id,
      })
    } catch (error) {
      console.error('Error loading:', error)
      message.error('Error al cargar categoría')
      router.push('/catalogos/categorias')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: any) => {
    setSaving(true)
    const supabase = getSupabaseClient()

    try {
      const { error } = await supabase
        .schema('erp')
        .from('categorias')
        .update({
          nombre: values.nombre,
          descripcion: values.descripcion || null,
          categoria_padre_id: values.categoria_padre_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
      message.success('Categoría actualizada')
      router.push('/catalogos/categorias')
    } catch (error: any) {
      console.error('Error saving:', error)
      message.error(error.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/catalogos/categorias')}>
          Volver
        </Button>
        <Title level={2} style={{ margin: 0 }}>Editar Categoría</Title>
      </Space>

      <Card style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="nombre"
            label="Nombre"
            rules={[{ required: true, message: 'Nombre es requerido' }]}
          >
            <Input placeholder="Nombre de la categoría" />
          </Form.Item>

          <Form.Item name="categoria_padre_id" label="Categoría Padre">
            <Select
              placeholder="Seleccionar (opcional)"
              allowClear
              options={categoriasPadre.map(c => ({ value: c.id, label: c.nombre }))}
            />
          </Form.Item>

          <Form.Item name="descripcion" label="Descripción">
            <TextArea rows={3} placeholder="Descripción (opcional)" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                Guardar
              </Button>
              <Button onClick={() => router.push('/catalogos/categorias')}>Cancelar</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
