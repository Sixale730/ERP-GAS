'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card,
  Form,
  Select,
  DatePicker,
  Button,
  Table,
  InputNumber,
  Input,
  Space,
  Typography,
  message,
  Row,
  Col,
  Divider,
  AutoComplete,
  Statistic,
  Spin,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useMargenesCategoria } from '@/lib/hooks/useMargenesCategoria'
import { useConfiguracion } from '@/lib/hooks/useConfiguracion'
import { useAuth } from '@/lib/hooks/useAuth'
import { registrarHistorial } from '@/lib/utils/historial'
import type { Proveedor, Almacen, Producto, OrdenCompra } from '@/types/database'

const { Title, Text } = Typography

interface ItemOrden {
  key: string
  id?: string // ID del item existente (para UPDATE)
  producto_id: string
  sku: string
  nombre: string
  categoria_id: string | null
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  subtotal: number
}

interface ProductoOption {
  value: string
  label: string
  producto: Producto
}

export default function EditarOrdenCompraPage() {
  const router = useRouter()
  const params = useParams()
  const ordenId = params.id as string
  const [form] = Form.useForm()
  const { getMargenParaCategoria } = useMargenesCategoria()
  const { tipoCambio } = useConfiguracion()
  const { erpUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState<OrdenCompra | null>(null)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [productosOptions, setProductosOptions] = useState<ProductoOption[]>([])
  const [preciosMap, setPreciosMap] = useState<Map<string, { precio: number, moneda: 'USD' | 'MXN' }>>(new Map())
  const [items, setItems] = useState<ItemOrden[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [monedaSeleccionada, setMonedaSeleccionada] = useState<'USD' | 'MXN'>('USD')
  const [tipoCambioOrden, setTipoCambioOrden] = useState<number | null>(null)

  useEffect(() => {
    if (ordenId) {
      loadOrdenData()
    }
  }, [ordenId])

  const loadOrdenData = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // Cargar orden existente
      const { data: ordenData, error: ordenError } = await supabase
        .schema('erp')
        .from('ordenes_compra')
        .select('*')
        .eq('id', ordenId)
        .single()

      if (ordenError) throw ordenError
      setOrden(ordenData)
      setMonedaSeleccionada((ordenData.moneda || 'USD') as 'USD' | 'MXN')
      setTipoCambioOrden(ordenData.tipo_cambio || null)

      // Cargar items de la orden
      const { data: itemsData } = await supabase
        .schema('erp')
        .from('orden_compra_items')
        .select('*')
        .eq('orden_compra_id', ordenId)
        .order('created_at')

      // Cargar catalogos
      const [proveedoresRes, almacenesRes, productosRes, preciosRes] = await Promise.all([
        supabase
          .schema('erp')
          .from('proveedores')
          .select('*')
          .eq('is_active', true)
          .order('razon_social'),
        supabase
          .schema('erp')
          .from('almacenes')
          .select('*')
          .eq('is_active', true)
          .order('nombre'),
        supabase
          .schema('erp')
          .from('productos')
          .select('*')
          .eq('is_active', true)
          .order('nombre'),
        supabase
          .schema('erp')
          .from('precios_productos')
          .select('producto_id, precio, moneda')
          .eq('lista_precio_id', '33333333-3333-3333-3333-333333333301'),
      ])

      setProveedores(proveedoresRes.data || [])
      setAlmacenes(almacenesRes.data || [])
      setProductos(productosRes.data || [])
      setPreciosMap(new Map(preciosRes.data?.map(p => [p.producto_id, { precio: Number(p.precio), moneda: (p.moneda || 'USD') as 'USD' | 'MXN' }]) || []))

      // Pre-llenar formulario
      form.setFieldsValue({
        proveedor_id: ordenData.proveedor_id,
        almacen_id: ordenData.almacen_destino_id,
        fecha: ordenData.fecha ? dayjs(ordenData.fecha) : null,
        fecha_esperada: ordenData.fecha_esperada ? dayjs(ordenData.fecha_esperada) : null,
        moneda: ordenData.moneda || 'USD',
        notas: ordenData.notas,
      })

      // Pre-llenar items
      if (itemsData && productosRes.data) {
        const productosMap = new Map(productosRes.data.map(p => [p.id, p]))

        const loadedItems: ItemOrden[] = itemsData.map(item => {
          const producto = productosMap.get(item.producto_id)
          return {
            key: item.id,
            id: item.id,
            producto_id: item.producto_id,
            sku: producto?.sku || '-',
            nombre: producto?.nombre || '-',
            categoria_id: producto?.categoria_id || null,
            cantidad: item.cantidad_solicitada,
            precio_unitario: item.precio_unitario,
            descuento_porcentaje: item.descuento_porcentaje,
            subtotal: item.subtotal,
          }
        })

        setItems(loadedItems)
      }
    } catch (error) {
      console.error('Error loading orden:', error)
      message.error('Error al cargar la orden')
      router.push('/compras')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchProducto = (value: string) => {
    setSearchValue(value)
    if (value.length < 2) {
      setProductosOptions([])
      return
    }

    const filtered = productos
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(value.toLowerCase()) ||
          p.nombre.toLowerCase().includes(value.toLowerCase())
      )
      .slice(0, 10)
      .map((p) => ({
        value: p.id,
        label: `${p.sku} - ${p.nombre}`,
        producto: p,
      }))

    setProductosOptions(filtered)
  }

  const handleSelectProducto = (value: string, option: ProductoOption) => {
    const producto = option.producto

    if (items.some((item) => item.producto_id === producto.id)) {
      message.warning('Este producto ya esta en la lista')
      setSearchValue('')
      return
    }

    const margen = getMargenParaCategoria(producto.categoria_id)
    const precioData = preciosMap.get(producto.id)
    const precioBase = precioData?.precio || producto.costo_promedio || 0
    const monedaPrecio = precioData?.moneda || 'USD'

    // Convertir a moneda del documento si es distinta
    let precioFinal = precioBase
    if (monedaPrecio !== monedaSeleccionada) {
      const tc = tipoCambioOrden || tipoCambio || 17.50
      if (monedaPrecio === 'USD' && monedaSeleccionada === 'MXN') {
        precioFinal = precioBase * tc
      } else if (monedaPrecio === 'MXN' && monedaSeleccionada === 'USD') {
        precioFinal = precioBase / tc
      }
    }

    const newItem: ItemOrden = {
      key: `new-${Date.now()}`,
      producto_id: producto.id,
      sku: producto.sku,
      nombre: producto.nombre,
      categoria_id: producto.categoria_id,
      cantidad: 1,
      precio_unitario: precioFinal,
      descuento_porcentaje: margen,
      subtotal: precioFinal * (1 - margen / 100),
    }

    setItems([...items, newItem])
    setSearchValue('')
    setProductosOptions([])
  }

  const handleItemChange = (key: string, field: keyof ItemOrden, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.key !== key) return item

        const updated = { ...item, [field]: value }
        updated.subtotal =
          updated.cantidad * updated.precio_unitario * (1 - updated.descuento_porcentaje / 100)
        return updated
      })
    )
  }

  const handleRemoveItem = (key: string) => {
    setItems(items.filter((item) => item.key !== key))
  }

  const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva

  const handleSave = async () => {
    try {
      await form.validateFields()

      if (items.length === 0) {
        message.error('Agrega al menos un producto')
        return
      }

      setSaving(true)
      const supabase = getSupabaseClient()
      const values = form.getFieldsValue()

      // Actualizar orden
      const { error: ordenError } = await supabase
        .schema('erp')
        .from('ordenes_compra')
        .update({
          proveedor_id: values.proveedor_id,
          almacen_destino_id: values.almacen_id,
          fecha: values.fecha?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
          fecha_esperada: values.fecha_esperada?.format('YYYY-MM-DD') || null,
          moneda: values.moneda || 'USD',
          tipo_cambio: values.moneda === 'MXN' ? tipoCambioOrden : null,
          subtotal,
          iva,
          total,
          notas: values.notas || null,
        })
        .eq('id', ordenId)

      if (ordenError) throw ordenError

      // Eliminar items existentes
      const { error: deleteError } = await supabase
        .schema('erp')
        .from('orden_compra_items')
        .delete()
        .eq('orden_compra_id', ordenId)

      if (deleteError) throw deleteError

      // Insertar items actualizados
      const itemsData = items.map((item) => ({
        orden_compra_id: ordenId,
        producto_id: item.producto_id,
        cantidad_solicitada: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento_porcentaje: item.descuento_porcentaje,
      }))

      const { error: itemsError } = await supabase
        .schema('erp')
        .from('orden_compra_items')
        .insert(itemsData)

      if (itemsError) throw itemsError

      // Registrar en historial
      await registrarHistorial({
        documentoTipo: 'orden_compra',
        documentoId: ordenId,
        documentoFolio: orden?.folio || '',
        usuarioId: erpUser?.id,
        usuarioNombre: erpUser?.nombre || erpUser?.email,
        accion: 'editado',
        descripcion: 'Orden de Compra editada',
      })

      message.success('Orden actualizada correctamente')
      router.push(`/compras/${ordenId}`)
    } catch (error: any) {
      console.error('Error saving orden:', error)
      message.error(error.message || 'Error al guardar la orden')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<ItemOrden> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 100,
    },
    {
      title: 'Producto',
      dataIndex: 'nombre',
      key: 'nombre',
      ellipsis: true,
    },
    {
      title: 'Cantidad',
      dataIndex: 'cantidad',
      key: 'cantidad',
      width: 100,
      render: (_, record) => (
        <InputNumber
          min={1}
          value={record.cantidad}
          onChange={(val) => handleItemChange(record.key, 'cantidad', val || 1)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Precio Unitario',
      dataIndex: 'precio_unitario',
      key: 'precio_unitario',
      width: 140,
      render: (_, record) => (
        <InputNumber
          min={0}
          step={0.01}
          precision={2}
          controls={false}
          value={record.precio_unitario}
          onChange={(val) => handleItemChange(record.key, 'precio_unitario', val || 0)}
          style={{ width: '100%' }}
          prefix="$"
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(value) => parseFloat(value?.replace(/\$\s?|(,*)/g, '') || '0')}
        />
      ),
    },
    {
      title: 'Margen %',
      dataIndex: 'descuento_porcentaje',
      key: 'descuento_porcentaje',
      width: 120,
      render: (_, record) => (
        <InputNumber
          min={0}
          max={100}
          controls={false}
          value={record.descuento_porcentaje}
          onChange={(val) => handleItemChange(record.key, 'descuento_porcentaje', val || 0)}
          style={{ width: '100%' }}
          addonAfter="%"
        />
      ),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 130,
      align: 'right',
      render: (subtotal) => `$${subtotal?.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${monedaSeleccionada}`,
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveItem(record.key)}
        />
      ),
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!orden) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Text type="secondary">Orden no encontrada</Text>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/compras/${ordenId}`)}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>Editar Orden {orden.folio}</Title>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Datos de la Orden" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="proveedor_id"
                    label="Proveedor"
                    rules={[{ required: true, message: 'Selecciona un proveedor' }]}
                  >
                    <Select
                      placeholder="Selecciona proveedor"
                      showSearch
                      optionFilterProp="label"
                      options={proveedores.map((p) => ({
                        value: p.id,
                        label: p.razon_social,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="almacen_id"
                    label="Almacen Destino"
                    rules={[{ required: true, message: 'Selecciona un almacen' }]}
                  >
                    <Select
                      placeholder="Selecciona almacen"
                      options={almacenes.map((a) => ({
                        value: a.id,
                        label: a.nombre,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="fecha" label="Fecha">
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="fecha_esperada" label="Fecha Esperada de Entrega">
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={monedaSeleccionada === 'MXN' ? 4 : 8}>
                  <Form.Item
                    name="moneda"
                    label="Moneda"
                    rules={[{ required: true, message: 'Selecciona la moneda' }]}
                  >
                    <Select
                      onChange={(nuevaMoneda: 'USD' | 'MXN') => {
                        const monedaAnterior = monedaSeleccionada
                        setMonedaSeleccionada(nuevaMoneda)

                        // Si cambia a MXN, establecer tipo de cambio por defecto
                        if (nuevaMoneda === 'MXN' && !tipoCambioOrden) {
                          setTipoCambioOrden(tipoCambio || 17.50)
                        }

                        if (monedaAnterior !== nuevaMoneda && items.length > 0) {
                          const tc = tipoCambioOrden || tipoCambio || 17.50
                          setItems(prevItems => prevItems.map(item => {
                            let nuevoPrecio = item.precio_unitario

                            if (monedaAnterior === 'USD' && nuevaMoneda === 'MXN') {
                              nuevoPrecio = item.precio_unitario * tc
                            } else if (monedaAnterior === 'MXN' && nuevaMoneda === 'USD') {
                              nuevoPrecio = item.precio_unitario / tc
                            }

                            return {
                              ...item,
                              precio_unitario: nuevoPrecio,
                              subtotal: nuevoPrecio * item.cantidad * (1 - item.descuento_porcentaje / 100)
                            }
                          }))
                        }
                      }}
                      options={[
                        { value: 'USD', label: 'USD - Dolares' },
                        { value: 'MXN', label: 'MXN - Pesos' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                {monedaSeleccionada === 'MXN' && (
                  <Col xs={24} md={4}>
                    <Form.Item label="Tipo de Cambio">
                      <InputNumber
                        value={tipoCambioOrden}
                        onChange={(v) => {
                          if (v !== null) {
                            setTipoCambioOrden(v)
                          }
                        }}
                        onBlur={() => {
                          if (!tipoCambioOrden || tipoCambioOrden < 0.01) {
                            setTipoCambioOrden(tipoCambio || 17.50)
                          }
                        }}
                        min={0.01}
                        step={0.01}
                        precision={4}
                        prefix="$"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                )}
                <Col xs={24}>
                  <Form.Item name="notas" label="Notas">
                    <Input.TextArea rows={2} placeholder="Notas o instrucciones especiales..." />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>

          <Card title="Productos" style={{ marginBottom: 16 }}>
            <Space style={{ marginBottom: 16, width: '100%' }}>
              <AutoComplete
                style={{ width: 400 }}
                placeholder="Buscar producto por SKU o nombre..."
                value={searchValue}
                options={productosOptions}
                onSearch={handleSearchProducto}
                onSelect={(value, option) => handleSelectProducto(value, option as ProductoOption)}
                onChange={setSearchValue}
              />
              <Text type="secondary">
                El margen se aplica automaticamente segun la categoria
              </Text>
            </Space>

            <Table
              dataSource={items}
              columns={columns}
              rowKey="key"
              pagination={false}
              scroll={{ x: 700 }}
              locale={{ emptyText: 'Agrega productos a la orden' }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Resumen" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Statistic
                title="Subtotal"
                value={subtotal}
                prefix="$"
                suffix={monedaSeleccionada}
                precision={2}
              />
              <Statistic
                title="IVA (16%)"
                value={iva}
                prefix="$"
                suffix={monedaSeleccionada}
                precision={2}
              />
              <Divider style={{ margin: '8px 0' }} />
              <Statistic
                title="Total"
                value={total}
                prefix="$"
                suffix={monedaSeleccionada}
                precision={2}
                valueStyle={{ color: '#1890ff', fontSize: 28 }}
              />
            </Space>

            <Divider />

            <Button
              type="primary"
              block
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
            >
              Guardar Cambios
            </Button>
          </Card>

          <Card title="Informacion">
            <Text type="secondary">
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li>Los cambios se guardan inmediatamente</li>
                <li>El <strong>status</strong> de la orden se mantiene</li>
                <li>Puedes agregar o quitar productos</li>
                <li>Los precios y margenes son editables</li>
              </ul>
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
