'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Form, Input, InputNumber, Button, Space, Typography, message, Row, Col } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

const { Title } = Typography
const { TextArea } = Input

export default function NuevoProveedorPage() {
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
      const { error } = await supabase
        .schema('erp')
        .from('proveedores')
        .insert({
          codigo: values.codigo,
          razon_social: values.razon_social,
          nombre_comercial: values.nombre_comercial || null,
          rfc: values.rfc || null,
          direccion: values.direccion || null,
          telefono: values.telefono || null,
          email: values.email || null,
          contacto_nombre: values.contacto_nombre || null,
          dias_credito: values.dias_credito || 0,
          notas: values.notas || null,
          is_active: true,
          organizacion_id: orgId,
        })

      if (error) throw error
      message.success('Proveedor creado')
      router.push('/catalogos/proveedores')
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/catalogos/proveedores')}>Volver</Button>
        <Title level={2} style={{ margin: 0 }}>Nuevo Proveedor</Title>
      </Space>

      <Card style={{ maxWidth: 800 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="codigo" label="Código" rules={[{ required: true, message: 'Código requerido' }]}>
                <Input placeholder="Ej: PROV-001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="razon_social" label="Razón Social" rules={[{ required: true, message: 'Razón social requerida' }]}>
                <Input placeholder="Razón social del proveedor" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="nombre_comercial" label="Nombre Comercial">
                <Input placeholder="Nombre comercial (opcional)" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="rfc" label="RFC">
                <Input placeholder="RFC" maxLength={13} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="telefono" label="Teléfono">
                <Input placeholder="Teléfono" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="email" label="Email">
                <Input type="email" placeholder="correo@ejemplo.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="contacto_nombre" label="Persona de Contacto">
                <Input placeholder="Nombre del contacto" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="dias_credito" label="Días de Crédito">
                <InputNumber min={0} placeholder="0" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="direccion" label="Dirección">
                <TextArea rows={2} placeholder="Dirección completa" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="notas" label="Notas">
                <TextArea rows={2} placeholder="Notas adicionales" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>Guardar</Button>
              <Button onClick={() => router.push('/catalogos/proveedores')}>Cancelar</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
