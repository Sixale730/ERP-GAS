'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Form, Select, Button, Table, InputNumber, Input, Space, Typography, message, Divider, Row, Col, AutoComplete, Tooltip
} from 'antd'
import { DeleteOutlined, SaveOutlined, SendOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoneyMXN, calcularTotal } from '@/lib/utils/format'
import { useConfiguracion } from '@/lib/hooks/useConfiguracion'
import type { Cliente, Almacen, ListaPrecio } from '@/types/database'

const { Title, Text } = Typography

interface CotizacionItem {
  key: string
  producto_id: string
  producto_nombre: string
  sku: string
  precio_lista_usd: number
  margen_porcentaje: number
  cantidad: number
  precio_unitario_mxn: number
  subtotal: number
}

export default function NuevaCotizacionPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // Configuracion global
  const { tipoCambio: tcGlobal, loading: loadingConfig } = useConfiguracion()

  // Tipo de cambio para esta cotizacion (editable)
  const [tipoCambio, setTipoCambio] = useState(17.50)

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

  // Actualizar tipo de cambio cuando cargue la config global
  useEffect(() => {
    if (!loadingConfig) {
      setTipoCambio(tcGlobal)
    }
  }, [loadingConfig, tcGlobal])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData()
  }, [])

  // Cuando cambia el cliente, cargar su lista de precios
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

  // Cuando cambia la lista de precios o almacen, cargar productos
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

  // Calcular precio MXN: precio_usd * (1 + margen%) * tipoCambio
  const calcularPrecioMXN = (precioUSD: number, margenPct: number) => {
    return precioUSD * (1 + margenPct / 100) * tipoCambio
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
          label: `${p.sku} - ${p.nombre} ($${p.precio.toFixed(2)} USD)`,
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

    if (items.find(i => i.producto_id === producto.id)) {
      message.warning('El producto ya esta en la lista')
      return
    }

    const precioUSD = producto.precio
    const margen = 0 // Default 0%
    const precioMXN = calcularPrecioMXN(precioUSD, margen)

    const newItem: CotizacionItem = {
      key: producto.id,
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      sku: producto.sku,
      precio_lista_usd: precioUSD,
      margen_porcentaje: margen,
      cantidad: 1,
      precio_unitario_mxn: precioMXN,
      subtotal: precioMXN,
    }

    setItems([...items, newItem])
    setProductSearch('')
    setProductOptions([])
  }

  const handleUpdateItem = (key: string, field: string, value: number) => {
    setItems(items.map(item => {
      if (item.key === key) {
        const updated = { ...item, [field]: value }

        // Si cambia el margen, recalcular precio MXN
        if (field === 'margen_porcentaje') {
          updated.precio_unitario_mxn = calcularPrecioMXN(updated.precio_lista_usd, value)
        }

        // Recalcular subtotal
        updated.subtotal = updated.cantidad * updated.precio_unitario_mxn
        return updated
      }
      return item
    }))
  }

  const handleRemoveItem = (key: string) => {
    setItems(items.filter(i => i.key !== key))
  }

  // Recalcular todos los precios cuando cambia el tipo de cambio
  const handleTipoCambioChange = (value: number | null) => {
    const newTC = value || tcGlobal
    setTipoCambio(newTC)

    // Recalcular todos los items con el nuevo TC
    setItems(items.map(item => {
      const nuevoPrecio = item.precio_lista_usd * (1 + item.margen_porcentaje / 100) * newTC
      return {
        ...item,
        precio_unitario_mxn: nuevoPrecio,
        subtotal: item.cantidad * nuevoPrecio
      }
    }))
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
      const { data: folioData } = await supabase.schema('erp').rpc('generar_folio', { tipo: 'cotizacion' })
      const folio = folioData as string

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
          tipo_cambio: tipoCambio,
          notas: form.getFieldValue('notas'),
        })
        .select()
        .single()

      if (cotError) throw cotError

      const itemsToInsert = items.map(i => ({
        cotizacion_id: cotizacion.id,
        producto_id: i.producto_id,
        descripcion: i.producto_nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario_mxn,
        descuento_porcentaje: 0,
        subtotal: i.subtotal,
      }))

      const { error: itemsError } = await supabase
        .schema('erp')
        .from('cotizacion_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      message.success(`Cotizacion ${folio} creada`)
      router.push('/cotizaciones')
    } catch (error: any) {
      console.error('Error saving cotizacion:', error)
      message.error(error.message || 'Error al guardar cotizacion')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      width: 80,
    },
    {
      title: 'Producto',
      dataIndex: 'producto_nombre',
      ellipsis: true,
    },
    {
      title: 'Precio USD',
      dataIndex: 'precio_lista_usd',
      width: 100,
      render: (val: number) => `$${val.toFixed(2)}`,
    },
    {
      title: (
        <Tooltip title="Margen adicional. Positivo = ganancia extra. Negativo = descuento/regalo.">
          Margen % <InfoCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      dataIndex: 'margen_porcentaje',
      width: 90,
      render: (val: number, record: CotizacionItem) => (
        <InputNumber
          value={val}
          onChange={(v) => handleUpdateItem(record.key, 'margen_porcentaje', v || 0)}
          style={{ width: '100%' }}
          size="small"
          formatter={(value) => `${value}%`}
          parser={(value) => parseFloat(value?.replace('%', '') || '0') as any}
        />
      ),
    },
    {
      title: 'Cant.',
      dataIndex: 'cantidad',
      width: 70,
      render: (val: number, record: CotizacionItem) => (
        <InputNumber
          min={1}
          value={val}
          onChange={(v) => handleUpdateItem(record.key, 'cantidad', v || 1)}
          style={{ width: '100%' }}
          size="small"
        />
      ),
    },
    {
      title: (
        <Tooltip title="Precio en MXN. Puedes editarlo manualmente.">
          Precio MXN <InfoCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      dataIndex: 'precio_unitario_mxn',
      width: 120,
      render: (val: number, record: CotizacionItem) => (
        <InputNumber
          min={0}
          value={val}
          onChange={(v) => handleUpdateItem(record.key, 'precio_unitario_mxn', v || 0)}
          formatter={(value) => `$ ${Number(value).toFixed(2)}`}
          parser={(value) => parseFloat(value?.replace(/\$\s?/g, '') || '0') as any}
          style={{ width: '100%' }}
          size="small"
        />
      ),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      width: 110,
      render: (val: number) => formatMoneyMXN(val),
    },
    {
      title: '',
      width: 40,
      render: (_: any, record: CotizacionItem) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(record.key)} size="small" />
      ),
    },
  ]

  return (
    <div>
      <Title level={2}>Nueva Cotizacion</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          {/* Card de Tipo de Cambio */}
          <Card size="small" style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}>
            <Row gutter={16} align="middle">
              <Col>
                <Text strong>Tipo de Cambio:</Text>
              </Col>
              <Col>
                <InputNumber
                  value={tipoCambio}
                  onChange={handleTipoCambioChange}
                  min={1}
                  max={100}
                  step={0.01}
                  precision={2}
                  addonAfter="MXN/USD"
                  style={{ width: 180 }}
                />
              </Col>
              <Col>
                <Text type="secondary">
                  (Al cambiar se recalculan todos los precios)
                </Text>
              </Col>
            </Row>
          </Card>

          <Card title="Datos de la Cotizacion" style={{ marginBottom: 16 }}>
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
                  <Form.Item label="Almacen" required>
                    <Select
                      placeholder="Seleccionar almacen"
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
                scroll={{ x: 800 }}
                locale={{ emptyText: 'Agrega productos a la cotizacion' }}
              />
            </Space>
          </Card>

          <Form form={form}>
            <Form.Item name="notas" label="Notas">
              <Input.TextArea rows={3} placeholder="Notas adicionales..." />
            </Form.Item>
          </Form>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Resumen" style={{ position: 'sticky', top: 88 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">T/C:</Text>
                <Text>{tipoCambio} MXN/USD</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Subtotal:</Text>
                <Text strong>{formatMoneyMXN(subtotal)}</Text>
              </div>
              {descuentoGlobal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#52c41a' }}>
                  <Text>Descuento ({descuentoGlobal}%):</Text>
                  <Text>-{formatMoneyMXN(descuentoMonto)}</Text>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>IVA (16%):</Text>
                <Text>{formatMoneyMXN(iva)}</Text>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={4} style={{ margin: 0 }}>Total:</Title>
                <Title level={4} style={{ margin: 0, color: '#1890ff' }}>{formatMoneyMXN(total)}</Title>
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
