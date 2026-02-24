'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Form, Input, Select, Button, Space, Typography, message } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title } = Typography
const { TextArea } = Input

interface Categoria {
  id: string
  nombre: string
}

export default function NuevaCategoriaPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [categoriasPadre, setCategoriasPadre] = useState<Categoria[]>([])

  useEffect(() => {
    loadCategorias()
  }, [])

  const loadCategorias = async () => {
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .schema('erp')
      .from('categorias')
      .select('id, nombre')
      .eq('is_active', true)
      .order('nombre')
    setCategoriasPadre(data || [])
  }

  const handleSave = async (values: any) => {
    setSaving(true)
    const supabase = getSupabaseClient()

    // Safety timeout: desbloquear botón si la operación tarda más de 15s
    const safetyTimeout = setTimeout(() => {
      setSaving(false)
      message.error('La operación tardó demasiado. Intenta de nuevo.')
    }, 15000)

    try {
      const { error } = await supabase
        .schema('erp')
        .from('categorias')
        .insert({
          nombre: values.nombre,
          descripcion: values.descripcion || null,
          categoria_padre_id: values.categoria_padre_id || null,
          is_active: true,
        })

      if (error) throw error
      message.success('Categoría creada')
      router.push('/catalogos/categorias')
    } catch (error: any) {
      console.error('Error saving categoria:', error)
      message.error(error.message || 'Error al guardar')
    } finally {
      clearTimeout(safetyTimeout)
      setSaving(false)
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/catalogos/categorias')}>
          Volver
        </Button>
        <Title level={2} style={{ margin: 0 }}>Nueva Categoría</Title>
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
