'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Form, Input, Select, InputNumber, Button, Space, Typography, message, Spin, Row, Col
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { REGIMENES_FISCALES_SAT, USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from '@/lib/config/sat'
import DireccionFields from '@/components/common/DireccionFields'
import DireccionEnvioList from '@/components/common/DireccionEnvioList'

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        contacto_nombre: clienteRes.data.contacto_nombre,
        lista_precio_id: clienteRes.data.lista_precio_id,
        dias_credito: clienteRes.data.dias_credito,
        limite_credito: clienteRes.data.limite_credito,
        notas: clienteRes.data.notas,
        // Dirección comercial detallada
        calle: clienteRes.data.calle,
        numero_exterior: clienteRes.data.numero_exterior,
        numero_interior: clienteRes.data.numero_interior,
        colonia: clienteRes.data.colonia,
        codigo_postal: clienteRes.data.codigo_postal,
        ciudad: clienteRes.data.ciudad,
        estado: clienteRes.data.estado,
        pais: clienteRes.data.pais,
        referencias: clienteRes.data.referencias,
        // Campos de pago
        forma_pago: clienteRes.data.forma_pago,
        metodo_pago: clienteRes.data.metodo_pago,
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
          contacto_nombre: values.contacto_nombre || null,
          lista_precio_id: values.lista_precio_id || null,
          dias_credito: values.dias_credito || 0,
          limite_credito: values.limite_credito || 0,
          notas: values.notas || null,
          // Dirección comercial detallada
          calle: values.calle || null,
          numero_exterior: values.numero_exterior || null,
          numero_interior: values.numero_interior || null,
          colonia: values.colonia || null,
          codigo_postal: values.codigo_postal || null,
          ciudad: values.ciudad || null,
          estado: values.estado || null,
          pais: values.pais || null,
          referencias: values.referencias || null,
          // Campos de pago
          forma_pago: values.forma_pago || null,
          metodo_pago: values.metodo_pago || null,
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
          </Row>

          <Title level={5} style={{ marginTop: 24 }}>Direccion Comercial</Title>
          <DireccionFields form={form} prefix="" />

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
                  options={REGIMENES_FISCALES_SAT}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="uso_cfdi" label="Uso CFDI">
                <Select
                  placeholder="Seleccionar uso"
                  allowClear
                  options={USOS_CFDI_SAT}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="codigo_postal_fiscal" label="C.P. Fiscal">
                <Input placeholder="Código postal" maxLength={5} />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5} style={{ marginTop: 24 }}>Direcciones de Envio</Title>
          <Card size="small" style={{ marginBottom: 16 }}>
            <DireccionEnvioList clienteId={id} showAddButton={true} />
          </Card>

          <Title level={5} style={{ marginTop: 24 }}>Preferencias de Pago</Title>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="forma_pago" label="Forma de Pago Predeterminada">
                <Select
                  placeholder="Seleccionar forma de pago"
                  allowClear
                  options={FORMAS_PAGO_SAT}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="metodo_pago" label="Método de Pago Predeterminado">
                <Select
                  placeholder="Seleccionar método de pago"
                  allowClear
                  options={METODOS_PAGO_SAT}
                />
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
                  parser={(value: string | undefined) => Number(value?.replace(/\$\s?|(,*)/g, '') || 0)}
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
