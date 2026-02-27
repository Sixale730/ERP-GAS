'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Form, Input, Select, InputNumber, Button, Space, Typography, message, Row, Col, Alert
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, ExperimentOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { REGIMENES_FISCALES_SAT, USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from '@/lib/config/sat'
import { MONEDAS, type CodigoMoneda } from '@/lib/config/moneda'
import DireccionFields from '@/components/common/DireccionFields'
import {
  CLIENTES_PRUEBA_SAT,
  getClientesPruebaAgrupados,
  type ClientePruebaSAT,
} from '@/lib/config/clientes-prueba'

const { Title, Text } = Typography
const { TextArea } = Input

interface ListaPrecio {
  id: string
  nombre: string
}

export default function NuevoClientePage() {
  const router = useRouter()
  const { orgId } = useAuth()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([])
  const [isDemo, setIsDemo] = useState(false)

  // Verificar si estamos en ambiente demo
  useEffect(() => {
    const checkDemo = async () => {
      try {
        const response = await fetch('/api/cfdi/clientes-prueba')
        const data = await response.json()
        setIsDemo(data.success && data.ambiente === 'demo')
      } catch {
        setIsDemo(false)
      }
    }
    checkDemo()
  }, [])

  // Pre-llenar con cliente de prueba SAT
  const handlePreFill = (rfc: string) => {
    const cliente = CLIENTES_PRUEBA_SAT.find((c) => c.rfc === rfc)
    if (cliente) {
      form.setFieldsValue({
        nombre_comercial: cliente.razon_social,
        razon_social: cliente.razon_social,
        rfc: cliente.rfc,
        regimen_fiscal: cliente.regimen_fiscal,
        codigo_postal_fiscal: cliente.codigo_postal,
        uso_cfdi: 'G03',
        forma_pago: '99',
        metodo_pago: 'PUE',
      })
      message.success(`Datos de ${cliente.rfc} cargados`)
    }
  }

  // Obtener opciones agrupadas para el Select
  const clientesPruebaOptions = () => {
    const agrupados = getClientesPruebaAgrupados()
    return [
      {
        label: 'Persona Moral',
        options: agrupados.moral.map((c) => ({
          value: c.rfc,
          label: `${c.rfc} - ${c.razon_social}`,
        })),
      },
      {
        label: 'Persona Fisica',
        options: agrupados.fisica.map((c) => ({
          value: c.rfc,
          label: `${c.rfc} - ${c.razon_social}`,
        })),
      },
    ]
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const supabase = getSupabaseClient()

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('listas_precios')
        .select('id, nombre')
        .eq('is_active', true)
        .order('nombre')

      if (!error) {
        setListasPrecios(data || [])
        // Set default lista
        const defaultLista = data?.find(l => (l as any).is_default)
        if (defaultLista) {
          form.setFieldValue('lista_precio_id', defaultLista.id)
        }
      }
    } catch (error) {
      console.error('Error loading listas:', error)
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
      // Generate codigo
      const { data: codigoData, error: folioError } = await supabase.schema('erp').rpc('generar_folio', { tipo: 'cliente' })
      if (folioError) throw folioError
      const codigo = codigoData as string || `CLI-${Date.now()}`

      const { error } = await supabase
        .schema('erp')
        .from('clientes')
        .insert({
          codigo,
          nombre_comercial: values.nombre_comercial,
          razon_social: values.razon_social || null,
          rfc: values.rfc || null,
          regimen_fiscal: values.regimen_fiscal || null,
          uso_cfdi: values.uso_cfdi || null,
          codigo_postal_fiscal: values.codigo_postal_fiscal || null,
          telefono: values.telefono || null,
          email: values.email || null,
          contacto_nombre: values.contacto_nombre || null,
          moneda: values.moneda || 'USD',
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
          // Campos de envío detallados
          calle_envio: values.calle_envio || null,
          numero_exterior_envio: values.numero_exterior_envio || null,
          numero_interior_envio: values.numero_interior_envio || null,
          colonia_envio: values.colonia_envio || null,
          codigo_postal_envio: values.codigo_postal_envio || null,
          ciudad_envio: values.ciudad_envio || null,
          estado_envio: values.estado_envio || null,
          pais_envio: values.pais_envio || null,
          referencias_envio: values.referencias_envio || null,
          contacto_envio: values.contacto_envio || null,
          telefono_envio: values.telefono_envio || null,
          // Campos de pago
          forma_pago: values.forma_pago || null,
          metodo_pago: values.metodo_pago || null,
          is_active: true,
          organizacion_id: orgId,
        })
        .select()
        .single()

      if (error) throw error

      message.success(`Cliente ${codigo} creado`)
      router.push('/clientes')
    } catch (error: any) {
      console.error('Error saving cliente:', error)
      message.error(error.message || 'Error al guardar cliente')
    } finally {
      clearTimeout(safetyTimeout)
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/clientes')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>Nuevo Cliente</Title>
        </Space>
      </div>

      {isDemo && (
        <Alert
          type="info"
          icon={<ExperimentOutlined />}
          message="Ambiente de Pruebas"
          description={
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>
                Puedes pre-llenar el formulario con datos de receptores de prueba del SAT:
              </Text>
              <Select
                placeholder="Seleccionar cliente de prueba SAT..."
                style={{ width: '100%', maxWidth: 500 }}
                options={clientesPruebaOptions()}
                onChange={handlePreFill}
                allowClear
              />
            </Space>
          }
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ maxWidth: 900 }}
        >
          <Title level={5}>Informacion General</Title>
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

          <Title level={5} style={{ marginTop: 24 }}>Direccion de Envio</Title>
          <DireccionFields form={form} prefix="_envio" />
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="contacto_envio" label="Contacto para Envio">
                <Input placeholder="Nombre de quien recibe" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="telefono_envio" label="Telefono Envio">
                <Input placeholder="Teléfono de contacto para entregas" />
              </Form.Item>
            </Col>
          </Row>

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
            <Col xs={24} md={6}>
              <Form.Item name="moneda" label="Moneda de Preferencia" initialValue="USD">
                <Select
                  options={Object.values(MONEDAS).map(m => ({ value: m.codigo, label: `${m.codigo} - ${m.nombre}` }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="lista_precio_id" label="Lista de Precios">
                <Select
                  placeholder="Seleccionar lista"
                  allowClear
                  options={listasPrecios.map(l => ({ value: l.id, label: l.nombre }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="dias_credito" label="Días de Crédito">
                <InputNumber min={0} placeholder="0" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
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
                Guardar Cliente
              </Button>
              <Button onClick={() => router.push('/clientes')}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
