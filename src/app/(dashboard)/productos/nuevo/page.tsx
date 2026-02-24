'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Form, Input, Select, InputNumber, Button, Space, Typography, message, Spin, Switch, Alert
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title } = Typography
const { TextArea } = Input

interface Categoria {
  id: string
  nombre: string
}

interface Proveedor {
  id: string
  nombre_comercial: string
  codigo: string
}

export default function NuevoProductoPage() {
  const router = useRouter()
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])

  useEffect(() => {
    loadCatalogos()
  }, [])

  const loadCatalogos = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      const [catRes, provRes] = await Promise.all([
        supabase.schema('erp').from('categorias').select('id, nombre').eq('is_active', true).order('nombre'),
        supabase.schema('erp').from('proveedores').select('id, codigo, nombre_comercial').eq('is_active', true).order('nombre_comercial'),
      ])

      setCategorias(catRes.data || [])
      setProveedores(provRes.data || [])

      // Set default values
      form.setFieldsValue({
        unidad_medida: 'PZA',
        moneda: 'USD',
        stock_minimo: 0,
        stock_maximo: 0,
        es_servicio: false,
      })
    } catch (error) {
      console.error('Error loading catalogos:', error)
      message.error('Error al cargar catálogos')
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
      const { data, error } = await supabase
        .schema('erp')
        .from('productos')
        .insert({
          sku: values.sku,
          codigo_barras: values.codigo_barras || null,
          numero_parte: values.numero_parte || null,
          nombre: values.nombre,
          descripcion: values.descripcion || null,
          categoria_id: values.categoria_id || null,
          proveedor_principal_id: values.proveedor_principal_id || null,
          unidad_medida: values.unidad_medida,
          moneda: values.moneda || 'USD',
          stock_minimo: values.es_servicio ? 0 : (values.stock_minimo || 0),
          stock_maximo: values.es_servicio ? 0 : (values.stock_maximo || 0),
          es_servicio: values.es_servicio || false,
          costo_promedio: 0,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      message.success('Producto creado exitosamente')
      router.push(`/productos/${data.id}`)
    } catch (error: any) {
      console.error('Error saving producto:', error)
      if (error.code === '23505') {
        message.error('Ya existe un producto con ese SKU')
      } else {
        message.error(error.message || 'Error al crear producto')
      }
    } finally {
      clearTimeout(safetyTimeout)
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/productos')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            Nuevo Producto
          </Title>
        </Space>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ maxWidth: 800 }}
        >
          <Form.Item
            name="sku"
            label="SKU"
            rules={[{ required: true, message: 'SKU es requerido' }]}
          >
            <Input placeholder="Código único del producto" />
          </Form.Item>

          <Form.Item
            name="codigo_barras"
            label="Código de Barras"
          >
            <Input placeholder="Código de barras (opcional)" />
          </Form.Item>

          <Form.Item
            name="numero_parte"
            label="Número de Parte"
          >
            <Input placeholder="Número de parte del fabricante/proveedor (opcional)" />
          </Form.Item>

          <Form.Item
            name="nombre"
            label="Nombre"
            rules={[{ required: true, message: 'Nombre es requerido' }]}
          >
            <Input placeholder="Nombre del producto" />
          </Form.Item>

          <Form.Item
            name="descripcion"
            label="Descripción"
          >
            <TextArea rows={3} placeholder="Descripción del producto (opcional)" />
          </Form.Item>

          <Form.Item
            name="categoria_id"
            label="Categoría"
          >
            <Select
              placeholder="Seleccionar categoría"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
            />
          </Form.Item>

          <Form.Item
            name="proveedor_principal_id"
            label="Proveedor Principal"
          >
            <Select
              placeholder="Seleccionar proveedor"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={proveedores.map(p => ({ value: p.id, label: `${p.codigo} - ${p.nombre_comercial}` }))}
            />
          </Form.Item>

          <Form.Item
            name="unidad_medida"
            label="Unidad de Medida"
            rules={[{ required: true, message: 'Unidad es requerida' }]}
          >
            <Select
              placeholder="Seleccionar unidad"
              options={[
                { value: 'PZA', label: 'Pieza (PZA)' },
                { value: 'KG', label: 'Kilogramo (KG)' },
                { value: 'LT', label: 'Litro (LT)' },
                { value: 'MT', label: 'Metro (MT)' },
                { value: 'CAJA', label: 'Caja' },
                { value: 'PAQ', label: 'Paquete' },
                { value: 'SRV', label: 'Servicio (SRV)' },
                { value: 'HR', label: 'Hora (HR)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="moneda"
            label="Moneda de Costo"
            rules={[{ required: true, message: 'Moneda es requerida' }]}
          >
            <Select
              options={[
                { value: 'USD', label: 'USD - Dólar Americano' },
                { value: 'MXN', label: 'MXN - Peso Mexicano' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="es_servicio"
            label="Es Servicio"
            valuePropName="checked"
            tooltip="Los servicios no tienen control de inventario (min/max) y no generan alertas de stock bajo"
          >
            <Switch checkedChildren="Sí" unCheckedChildren="No" />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.es_servicio !== curr.es_servicio}>
            {({ getFieldValue }) => {
              const esServicio = getFieldValue('es_servicio')
              if (esServicio) {
                return (
                  <Alert
                    message="Producto tipo Servicio"
                    description="Los servicios no tienen control de stock mínimo/máximo y no aparecen en alertas de faltantes."
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )
              }
              return (
                <Space size="large">
                  <Form.Item
                    name="stock_minimo"
                    label="Stock Mínimo"
                  >
                    <InputNumber min={0} placeholder="0" style={{ width: 150 }} />
                  </Form.Item>

                  <Form.Item
                    name="stock_maximo"
                    label="Stock Máximo"
                  >
                    <InputNumber min={0} placeholder="0" style={{ width: 150 }} />
                  </Form.Item>
                </Space>
              )
            }}
          </Form.Item>

          <Form.Item style={{ marginTop: 24 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
              >
                Crear Producto
              </Button>
              <Button onClick={() => router.push('/productos')}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
