'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, Form, Input, Select, Switch, Button, Space, Typography, message, Spin } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title } = Typography

export default function EditarListaPrecioPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('listas_precios')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      form.setFieldsValue({
        codigo: data.codigo,
        nombre: data.nombre,
        moneda: data.moneda,
        is_default: data.is_default,
      })
    } catch (error) {
      console.error('Error:', error)
      message.error('Error al cargar lista')
      router.push('/catalogos/listas-precios')
    } finally {
      setLoading(false)
    }
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
      // If setting as default, unset other defaults first
      if (values.is_default) {
        await supabase
          .schema('erp')
          .from('listas_precios')
          .update({ is_default: false })
          .neq('id', id)
          .eq('is_default', true)
      }

      const { error } = await supabase
        .schema('erp')
        .from('listas_precios')
        .update({
          codigo: values.codigo,
          nombre: values.nombre,
          moneda: values.moneda,
          is_default: values.is_default || false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
      message.success('Lista actualizada')
      router.push('/catalogos/listas-precios')
    } catch (error: any) {
      console.error('Error:', error)
      message.error(error.message || 'Error al guardar')
    } finally {
      clearTimeout(safetyTimeout)
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/catalogos/listas-precios')}>Volver</Button>
        <Title level={2} style={{ margin: 0 }}>Editar Lista de Precios</Title>
      </Space>

      <Card style={{ maxWidth: 500 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="codigo" label="Código" rules={[{ required: true, message: 'Código requerido' }]}>
            <Input placeholder="Ej: PUBLICO, MAYOREO" />
          </Form.Item>

          <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Nombre requerido' }]}>
            <Input placeholder="Nombre de la lista" />
          </Form.Item>

          <Form.Item name="moneda" label="Moneda">
            <Select
              options={[
                { value: 'MXN', label: 'MXN - Peso Mexicano' },
                { value: 'USD', label: 'USD - Dólar Americano' },
              ]}
            />
          </Form.Item>

          <Form.Item name="is_default" label="Lista por Defecto" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>Guardar</Button>
              <Button onClick={() => router.push('/catalogos/listas-precios')}>Cancelar</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
