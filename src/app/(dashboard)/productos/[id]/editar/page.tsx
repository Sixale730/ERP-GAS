'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Form, Input, Select, InputNumber, Button, Space, Typography, message, Spin
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

export default function EditarProductoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // Load producto, categorias, proveedores in parallel
      const [prodRes, catRes, provRes] = await Promise.all([
        supabase.schema('erp').from('productos').select('*').eq('id', id).single(),
        supabase.schema('erp').from('categorias').select('id, nombre').eq('is_active', true).order('nombre'),
        supabase.schema('erp').from('proveedores').select('id, codigo, nombre_comercial').eq('is_active', true).order('nombre_comercial'),
      ])

      if (prodRes.error) throw prodRes.error

      setCategorias(catRes.data || [])
      setProveedores(provRes.data || [])

      // Set form values
      form.setFieldsValue({
        sku: prodRes.data.sku,
        codigo_barras: prodRes.data.codigo_barras,
        nombre: prodRes.data.nombre,
        descripcion: prodRes.data.descripcion,
        categoria_id: prodRes.data.categoria_id,
        proveedor_principal_id: prodRes.data.proveedor_principal_id,
        unidad_medida: prodRes.data.unidad_medida,
        stock_minimo: prodRes.data.stock_minimo,
        stock_maximo: prodRes.data.stock_maximo,
      })
    } catch (error) {
      console.error('Error loading data:', error)
      message.error('Error al cargar producto')
      router.push('/productos')
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
        .from('productos')
        .update({
          sku: values.sku,
          codigo_barras: values.codigo_barras || null,
          nombre: values.nombre,
          descripcion: values.descripcion || null,
          categoria_id: values.categoria_id || null,
          proveedor_principal_id: values.proveedor_principal_id || null,
          unidad_medida: values.unidad_medida,
          stock_minimo: values.stock_minimo || 0,
          stock_maximo: values.stock_maximo || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      message.success('Producto actualizado')
      router.push(`/productos/${id}`)
    } catch (error: any) {
      console.error('Error saving producto:', error)
      message.error(error.message || 'Error al guardar producto')
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/productos/${id}`)}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            Editar Producto
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
              ]}
            />
          </Form.Item>

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
              <Button onClick={() => router.push(`/productos/${id}`)}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
