'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Form, Input, Select, InputNumber, Button, Space, Typography, message, Spin, Switch, Alert,
  Table, Popconfirm, Divider
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, SaveOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { usePreciosProducto, useDeletePrecioProducto, type PrecioConLista } from '@/lib/hooks/usePreciosProductos'
import { useListasPrecios } from '@/lib/hooks/queries/useCatalogos'
import PrecioProductoModal from '@/components/precios/PrecioProductoModal'

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

  // Estado para modal de precios
  const [precioModalOpen, setPrecioModalOpen] = useState(false)
  const [editingPrecio, setEditingPrecio] = useState<PrecioConLista | null>(null)

  // Hooks para precios
  const { data: precios = [], isLoading: loadingPrecios } = usePreciosProducto(id)
  const { data: listasPrecios = [] } = useListasPrecios()
  const deletePrecio = useDeletePrecioProducto()

  // Calcular listas disponibles (las que no tienen precio asignado)
  const listasDisponibles = useMemo(() => {
    const idsConPrecio = new Set(precios.map(p => p.lista_precio_id))
    return listasPrecios.filter(l => !idsConPrecio.has(l.id))
  }, [precios, listasPrecios])

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
        numero_parte: prodRes.data.numero_parte,
        nombre: prodRes.data.nombre,
        descripcion: prodRes.data.descripcion,
        categoria_id: prodRes.data.categoria_id,
        proveedor_principal_id: prodRes.data.proveedor_principal_id,
        unidad_medida: prodRes.data.unidad_medida,
        moneda: prodRes.data.moneda || 'USD',
        stock_minimo: prodRes.data.stock_minimo,
        stock_maximo: prodRes.data.stock_maximo,
        es_servicio: prodRes.data.es_servicio || false,
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

  // Handlers de precios
  const handleEditPrecio = (precio: PrecioConLista) => {
    setEditingPrecio(precio)
    setPrecioModalOpen(true)
  }

  const handleAddPrecio = () => {
    setEditingPrecio(null)
    setPrecioModalOpen(true)
  }

  const handleDeletePrecio = async (precio: PrecioConLista) => {
    try {
      await deletePrecio.mutateAsync({ id: precio.id, producto_id: id })
      message.success('Precio eliminado')
    } catch (error: any) {
      message.error(error.message || 'Error al eliminar precio')
    }
  }

  // Columnas de la tabla de precios
  const preciosColumns: ColumnsType<PrecioConLista> = [
    {
      title: 'Lista de Precios',
      dataIndex: 'lista_nombre',
      key: 'lista_nombre',
    },
    {
      title: 'Precio (sin IVA)',
      dataIndex: 'precio',
      key: 'precio',
      align: 'right',
      render: (val: number) => new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(val),
    },
    {
      title: 'Precio c/IVA',
      dataIndex: 'precio_con_iva',
      key: 'precio_con_iva',
      align: 'right',
      render: (val: number | null, record) => {
        const precio = val ?? record.precio * 1.16
        return new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
        }).format(precio)
      },
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditPrecio(record)}
            size="small"
          />
          <Popconfirm
            title="¿Eliminar este precio?"
            onConfirm={() => handleDeletePrecio(record)}
            okText="Sí"
            cancelText="No"
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

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
                Guardar Cambios
              </Button>
              <Button onClick={() => router.push(`/productos/${id}`)}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Divider />

        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>Precios por Lista</Title>
          {listasDisponibles.length > 0 && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddPrecio}
            >
              Agregar Precio
            </Button>
          )}
        </div>

        <Table
          columns={preciosColumns}
          dataSource={precios}
          rowKey="id"
          loading={loadingPrecios}
          pagination={false}
          size="small"
          locale={{ emptyText: 'Sin precios asignados' }}
        />

        <PrecioProductoModal
          open={precioModalOpen}
          onClose={() => setPrecioModalOpen(false)}
          productoId={id}
          precio={editingPrecio}
          listasDisponibles={listasDisponibles}
        />
      </Card>
    </div>
  )
}
