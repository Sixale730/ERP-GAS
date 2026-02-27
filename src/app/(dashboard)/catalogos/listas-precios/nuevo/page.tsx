'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Form, Input, Select, Switch, Button, Space, Typography, message } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

const { Title } = Typography

export default function NuevaListaPrecioPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const { orgId } = useAuth()
  const [saving, setSaving] = useState(false)

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
          .eq('is_default', true)
      }

      const { error } = await supabase
        .schema('erp')
        .from('listas_precios')
        .insert({
          codigo: values.codigo,
          nombre: values.nombre,
          moneda: values.moneda || 'MXN',
          is_default: values.is_default || false,
          is_active: true,
          organizacion_id: orgId,
        })

      if (error) throw error
      message.success('Lista creada')
      router.push('/catalogos/listas-precios')
    } catch (error: any) {
      console.error('Error:', error)
      message.error(error.message || 'Error al guardar')
    } finally {
      clearTimeout(safetyTimeout)
      setSaving(false)
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/catalogos/listas-precios')}>Volver</Button>
        <Title level={2} style={{ margin: 0 }}>Nueva Lista de Precios</Title>
      </Space>

      <Card style={{ maxWidth: 500 }}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ moneda: 'MXN', is_default: false }}>
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
