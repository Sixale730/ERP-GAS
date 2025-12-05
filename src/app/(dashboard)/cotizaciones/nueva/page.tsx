'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Form, Select, Button, Table, InputNumber, Input, Space, Typography, message, Divider, Row, Col, AutoComplete
} from 'antd'
import { DeleteOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney, calcularTotal } from '@/lib/utils/format'
import type { Cliente, Almacen, ListaPrecio } from '@/types/database'

const { Title, Text } = Typography

interface CotizacionItem {
  key: string
  producto_id: string
  producto_nombre: string
  sku: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  subtotal: number
}

export default function NuevaCotizacionPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // Data
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([])

  // Selected
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [almacenId, setAlmacenId] = useState<string | null>(null)
  const [listaPrecioId, setListaPrecioId] = useState<string | null>(null)

  // Items
  const [items, setItems] = useState<CotizacionItem[]>([])
  const [descuentoGlobal, setDescuentoGlobal] = useState(0)

  // Product search
  const [productSearch, setProductSearch] = useState('')
  const [productOptions, setProductOptions] = useState<any[]>([])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (clienteId) {
      const cliente = clientes.find(c => c.id === clienteId)
      if (cliente?.lista_precio_id) {
        setListaPrecioId(cliente.lista_precio_id)
        form.setFieldValue('lista_precio_id', cliente.lista_precio_id)
      }
    }
  }, [clienteId, clientes])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (listaPrecioId && almacenId) {
      loadProductosConPrecios()
    }
  }, [listaPrecioId, almacenId])

  const loadData = async () => {
    const supabase = getSupabaseClient()

    try {
      const [clientesRes, almacenesRes, listasRes] = await Promise.all([
        supabase.schema('erp').from('clientes').select('*').eq('is_active', true).order('nombre_comercial'),
        supabase.schema('erp').from('almacenes').select('*').eq('is_active', true).order('nombre'),
        supabase.schema('erp').from('listas_precios').select('*').eq('is_active', true).order('nombre'),
      ])

      setClientes(clientesRes.data || [])
      setAlmacenes(almacenesRes.data || [])
      setListasPrecios(listasRes.data || [])

      // Set default lista precio
      const defaultLista = listasRes.data?.find(l => l.is_default)
      if (defaultLista) {
        setListaPrecioId(defaultLista.id)
        form.setFieldValue('lista_precio_id', defaultLista.id)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      message.error('Error al cargar datos')
    }
  }

  const loadProductosConPrecios = async () => {
    const supabase = getSupabaseClient()

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('v_productos_precios')
        .select('*')
        .eq('lista_precio_id', listaPrecioId)

      if (error) throw error
      setProductos(data || [])
    } catch (error) {
      console.error('Error loading productos:', error)
    }
  }

  const handleProductSearch = (value: string) => {
    setProductSearch(value)
    if (value.length >= 2) {
      const filtered = productos
        .filter(p =>
          p.nombre.toLowerCase().includes(value.toLowerCase()) ||
          p.sku.toLowerCase().includes(value.toLowerCase())
        )
        .slice(0, 10)
        .map(p => ({
          value: p.id,
          label: `${p.sku} - ${p.nombre} (${formatMoney(p.precio)})`,
          producto: p,
        }))
      setProductOptions(filtered)
    } else {
      setProductOptions([])
    }
  }

  const handleAddProduct = (value: string, option: any) => {
    const producto = option.producto
    if (!producto) return

    // Check if already in list
    if (items.find(i => i.producto_id === producto.id)) {
      message.warning('El producto ya está en la lista')
      return
    }

    const newItem: CotizacionItem = {
      key: producto.id,
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      sku: producto.sku,
      cantidad: 1,
      precio_unitario: producto.precio,
      descuento_porcentaje: 0,
      subtotal: producto.precio,
    }

    setItems([...items, newItem])
    setProductSearch('')
    setProductOptions([])
  }

  const handleUpdateItem = (key: string, field: string, value: number) => {
    setItems(items.map(item => {
      if (item.key === key) {
        const updated = { ...item, [field]: value }
        updated.subtotal = updated.cantidad * updated.precio_unitario * (1 - updated.descuento_porcentaje / 100)
        return updated
      }
      return item
    }))
  }

  const handleRemoveItem = (key: string) => {
    setItems(items.filter(i => i.key !== key))
  }

  // Totals
  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0)
  const descuentoMonto = subtotal * (descuentoGlobal / 100)
  const { iva, total } = calcularTotal(subtotal, descuentoMonto)

  const handleSave = async (status: 'borrador' | 'enviada') => {
    if (!clienteId || !almacenId || items.length === 0) {
      message.error('Completa todos los campos requeridos')
      return
    }

    setSaving(true)
    const supabase = getSupabaseClient()

    try {
      // Generate folio
      const { data: folioData } = await supabase.schema('erp').rpc('generar_folio', { tipo: 'cotizacion' })
      const folio = folioData as string

      // Create cotizacion
      const { data: cotizacion, error: cotError } = await supabase
        .schema('erp')
        .from('cotizaciones')
        .insert({
          folio,
          cliente_id: clienteId,
          almacen_id: almacenId,
          lista_precio_id: listaPrecioId,
          status,
          subtotal,
          descuento_porcentaje: descuentoGlobal,
          descuento_monto: descuentoMonto,
          iva,
          total,
          notas: form.getFieldValue('notas'),
        })
        .select()
        .single()

      if (cotError) throw cotError

      // Create items
      const itemsToInsert = items.map(i => ({
        cotizacion_id: cotizacion.id,
        producto_id: i.producto_id,
        descripcion: i.producto_nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        descuento_porcentaje: i.descuento_porcentaje,
        subtotal: i.subtotal,
      }))

      const { error: itemsError } = await supabase
        .schema('erp')
        .from('cotizacion_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      message.success(`Cotización ${folio} creada`)
      router.push('/cotizaciones')
    } catch (error: any) {
      console.error('Error saving cotizacion:', error)
      message.error(error.message || 'Error al guardar cotización')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      width: 100,
    },
    {
      title: 'Producto',
      dataIndex: 'producto_nombre',
    },
    {
      title: 'Cantidad',
      dataIndex: 'cantidad',
      width: 100,
      render: (val: number, record: CotizacionItem) => (
        <InputNumber
          min={1}
          value={val}
          onChange={(v) => handleUpdateItem(record.key, 'cantidad', v || 1)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Precio Unit.',
      dataIndex: 'precio_unitario',
      width: 130,
      render: (val: number) => formatMoney(val),
    },
    {
      title: 'Desc. %',
      dataIndex: 'descuento_porcentaje',
      width: 100,
      render: (val: number, record: CotizacionItem) => (
        <InputNumber
          min={0}
          max={100}
          value={val}
          onChange={(v) => handleUpdateItem(record.key, 'descuento_porcentaje', v || 0)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      width: 130,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '',
      width: 50,
      render: (_: any, record: CotizacionItem) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(record.key)} />
      ),
    },
  ]

  return (
    <div>
      <Title level={2}>Nueva Cotización</Title>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card title="Datos de la Cotización" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Cliente" required>
                    <Select
                      showSearch
                      placeholder="Seleccionar cliente"
                      value={clienteId}
                      onChange={setClienteId}
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={clientes.map(c => ({ value: c.id, label: `${c.codigo} - ${c.nombre_comercial}` }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Almacén" required>
                    <Select
                      placeholder="Seleccionar almacén"
                      value={almacenId}
                      onChange={setAlmacenId}
                      options={almacenes.map(a => ({ value: a.id, label: a.nombre }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="lista_precio_id" label="Lista de Precios">
                    <Select
                      placeholder="Seleccionar lista"
                      value={listaPrecioId}
                      onChange={setListaPrecioId}
                      options={listasPrecios.map(l => ({ value: l.id, label: l.nombre }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Descuento Global %">
                    <InputNumber
                      min={0}
                      max={100}
                      value={descuentoGlobal}
                      onChange={(v) => setDescuentoGlobal(v || 0)}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>

          <Card title="Productos" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <AutoComplete
                style={{ width: '100%' }}
                options={productOptions}
                onSearch={handleProductSearch}
                onSelect={handleAddProduct}
                value={productSearch}
                placeholder="Buscar producto por SKU o nombre..."
                disabled={!listaPrecioId || !almacenId}
              />

              <Table
                dataSource={items}
                columns={columns}
                rowKey="key"
                pagination={false}
                size="small"
                scroll={{ x: 700 }}
                locale={{ emptyText: 'Agrega productos a la cotización' }}
              />
            </Space>
          </Card>

          <Form.Item name="notas" label="Notas">
            <Input.TextArea rows={3} placeholder="Notas adicionales..." />
          </Form.Item>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Resumen" style={{ position: 'sticky', top: 88 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Subtotal:</Text>
                <Text strong>{formatMoney(subtotal)}</Text>
              </div>
              {descuentoGlobal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#52c41a' }}>
                  <Text>Descuento ({descuentoGlobal}%):</Text>
                  <Text>-{formatMoney(descuentoMonto)}</Text>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>IVA (16%):</Text>
                <Text>{formatMoney(iva)}</Text>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={4} style={{ margin: 0 }}>Total:</Title>
                <Title level={4} style={{ margin: 0, color: '#1890ff' }}>{formatMoney(total)}</Title>
              </div>

              <Divider />

              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  block
                  icon={<SaveOutlined />}
                  onClick={() => handleSave('borrador')}
                  loading={saving}
                  disabled={items.length === 0}
                >
                  Guardar Borrador
                </Button>
                <Button
                  type="primary"
                  block
                  icon={<SendOutlined />}
                  onClick={() => handleSave('enviada')}
                  loading={saving}
                  disabled={items.length === 0}
                >
                  Guardar y Enviar
                </Button>
                <Button block onClick={() => router.back()}>
                  Cancelar
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
