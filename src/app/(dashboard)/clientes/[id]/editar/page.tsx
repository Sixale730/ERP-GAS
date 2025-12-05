'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Form, Input, Select, InputNumber, Button, Space, Typography, message, Spin, Row, Col
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title } = Typography
const { TextArea } = Input

interface ListaPrecio {
  id: string
  nombre: string
}

export default function EditarClientePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([])

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      const [clienteRes, listasRes] = await Promise.all([
        supabase.schema('erp').from('clientes').select('*').eq('id', id).single(),
        supabase.schema('erp').from('listas_precios').select('id, nombre').eq('is_active', true).order('nombre'),
      ])

      if (clienteRes.error) throw clienteRes.error

      setListasPrecios(listasRes.data || [])

      form.setFieldsValue({
        nombre_comercial: clienteRes.data.nombre_comercial,
        razon_social: clienteRes.data.razon_social,
        rfc: clienteRes.data.rfc,
        regimen_fiscal: clienteRes.data.regimen_fiscal,
        uso_cfdi: clienteRes.data.uso_cfdi,
        codigo_postal_fiscal: clienteRes.data.codigo_postal_fiscal,
        telefono: clienteRes.data.telefono,
        email: clienteRes.data.email,
        direccion: clienteRes.data.direccion,
        contacto_nombre: clienteRes.data.contacto_nombre,
        lista_precio_id: clienteRes.data.lista_precio_id,
        dias_credito: clienteRes.data.dias_credito,
        limite_credito: clienteRes.data.limite_credito,
        notas: clienteRes.data.notas,
      })
    } catch (error) {
      console.error('Error loading cliente:', error)
      message.error('Error al cargar cliente')
      router.push('/clientes')
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
        .from('clientes')
        .update({
          nombre_comercial: values.nombre_comercial,
          razon_social: values.razon_social || null,
          rfc: values.rfc || null,
          regimen_fiscal: values.regimen_fiscal || null,
          uso_cfdi: values.uso_cfdi || null,
          codigo_postal_fiscal: values.codigo_postal_fiscal || null,
          telefono: values.telefono || null,
          email: values.email || null,
          direccion: values.direccion || null,
          contacto_nombre: values.contacto_nombre || null,
          lista_precio_id: values.lista_precio_id || null,
          dias_credito: values.dias_credito || 0,
          limite_credito: values.limite_credito || 0,
          notas: values.notas || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      message.success('Cliente actualizado')
      router.push(`/clientes/${id}`)
    } catch (error: any) {
      console.error('Error saving cliente:', error)
      message.error(error.message || 'Error al guardar cliente')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/clientes/${id}`)}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>Editar Cliente</Title>
        </Space>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ maxWidth: 900 }}
        >
          <Title level={5}>Información General</Title>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="nombre_comercial"
                label="Nombre Comercial"
                rules={[{ required: true, message: 'Nombre comercial es requerido' }]}
              >
                <Input placeholder="Nombre comercial del cliente" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="contacto_nombre" label="Nombre de Contacto">
                <Input placeholder="Persona de contacto" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="telefono" label="Teléfono">
                <Input placeholder="Teléfono de contacto" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="email" label="Email">
                <Input type="email" placeholder="correo@ejemplo.com" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="direccion" label="Dirección">
                <TextArea rows={2} placeholder="Dirección completa" />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5} style={{ marginTop: 24 }}>Datos Fiscales</Title>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="razon_social" label="Razón Social">
                <Input placeholder="Razón social para facturación" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="rfc" label="RFC">
                <Input placeholder="RFC del cliente" maxLength={13} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="regimen_fiscal" label="Régimen Fiscal">
                <Select
                  placeholder="Seleccionar régimen"
                  allowClear
                  options={[
                    { value: '601', label: '601 - General de Ley PM' },
                    { value: '603', label: '603 - Personas Morales sin fines de lucro' },
                    { value: '605', label: '605 - Sueldos y salarios' },
                    { value: '606', label: '606 - Arrendamiento' },
                    { value: '612', label: '612 - Personas Físicas con Actividad Empresarial' },
                    { value: '616', label: '616 - Sin obligaciones fiscales' },
                    { value: '621', label: '621 - Incorporación Fiscal' },
                    { value: '625', label: '625 - Régimen de las Actividades Agrícolas' },
                    { value: '626', label: '626 - Régimen Simplificado de Confianza' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="uso_cfdi" label="Uso CFDI">
                <Select
                  placeholder="Seleccionar uso"
                  allowClear
                  options={[
                    { value: 'G01', label: 'G01 - Adquisición de mercancías' },
                    { value: 'G03', label: 'G03 - Gastos en general' },
                    { value: 'P01', label: 'P01 - Por definir' },
                    { value: 'S01', label: 'S01 - Sin efectos fiscales' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="codigo_postal_fiscal" label="C.P. Fiscal">
                <Input placeholder="Código postal" maxLength={5} />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5} style={{ marginTop: 24 }}>Condiciones Comerciales</Title>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="lista_precio_id" label="Lista de Precios">
                <Select
                  placeholder="Seleccionar lista"
                  allowClear
                  options={listasPrecios.map(l => ({ value: l.id, label: l.nombre }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="dias_credito" label="Días de Crédito">
                <InputNumber min={0} placeholder="0" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="limite_credito" label="Límite de Crédito">
                <InputNumber
                  min={0}
                  placeholder="0.00"
                  style={{ width: '100%' }}
                  formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notas" label="Notas" style={{ marginTop: 16 }}>
            <TextArea rows={3} placeholder="Notas adicionales sobre el cliente" />
          </Form.Item>

          <Form.Item style={{ marginTop: 24 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
              >
                Guardar Cambios
              </Button>
              <Button onClick={() => router.push(`/clientes/${id}`)}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
