'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Form, Select, Button, Table, InputNumber, Input, Space, Typography, message, Divider, Row, Col, AutoComplete, Tooltip, Spin
} from 'antd'
import { DeleteOutlined, SaveOutlined, ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoneyMXN, calcularTotal } from '@/lib/utils/format'
import { useConfiguracion } from '@/lib/hooks/useConfiguracion'
import type { Cliente, Almacen, ListaPrecio } from '@/types/database'

const { Title, Text } = Typography

interface CotizacionItem {
  key: string
  id?: string // ID del item existente
  producto_id: string
  producto_nombre: string
  sku: string
  precio_lista_usd: number
  margen_porcentaje: number
  cantidad: number
  cantidad_original?: number // Para comparar cambios en orden_venta
  precio_unitario_mxn: number
  subtotal: number
}

interface CotizacionData {
  id: string
  folio: string
  status: string
  cliente_id: string
  almacen_id: string
  lista_precio_id: string | null
  tipo_cambio: number | null
  descuento_porcentaje: number
  notas: string | null
}

export default function EditarCotizacionPage() {
  const router = useRouter()
  const params = useParams()
  const cotizacionId = params.id as string
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Datos de la cotizacion original
  const [cotizacion, setCotizacion] = useState<CotizacionData | null>(null)
  const [itemsOriginales, setItemsOriginales] = useState<CotizacionItem[]>([])

  // Configuracion global
  const { tipoCambio: tcGlobal, loading: loadingConfig } = useConfiguracion()

  // Tipo de cambio para esta cotizacion (editable)
  const [tipoCambio, setTipoCambio] = useState(17.50)

  // Data
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([])
  const [preciosMap, setPreciosMap] = useState<Map<string, number>>(new Map())

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
    if (cotizacionId) {
      loadCotizacionData()
    }
  }, [cotizacionId])

  // Cuando cambia la lista de precios, cargar precios
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (listaPrecioId) {
      loadProductosConPrecios()
    }
  }, [listaPrecioId])

  const loadCotizacionData = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // Cargar cotizacion existente
      const { data: cotData, error: cotError } = await supabase
        .schema('erp')
        .from('cotizaciones')
        .select('*')
        .eq('id', cotizacionId)
        .single()

      if (cotError) throw cotError

      // Solo se puede editar en propuesta u orden_venta
      if (!['propuesta', 'orden_venta'].includes(cotData.status)) {
        message.error('Esta cotización no se puede editar')
        router.push(`/cotizaciones/${cotizacionId}`)
        return
      }

      setCotizacion(cotData)
      setClienteId(cotData.cliente_id)
      setAlmacenId(cotData.almacen_id)
      setListaPrecioId(cotData.lista_precio_id)
      setDescuentoGlobal(cotData.descuento_porcentaje || 0)
      setTipoCambio(cotData.tipo_cambio || tcGlobal)
      form.setFieldsValue({
        notas: cotData.notas,
        lista_precio_id: cotData.lista_precio_id,
      })

      // Cargar items de la cotizacion
      const { data: itemsData } = await supabase
        .schema('erp')
        .from('cotizacion_items')
        .select(`
          *,
          productos:producto_id (id, sku, nombre, categoria_id)
        `)
        .eq('cotizacion_id', cotizacionId)
        .order('created_at')

      // Cargar catalogos
      const [clientesRes, almacenesRes, listasRes, productosRes] = await Promise.all([
        supabase.schema('erp').from('clientes').select('*').eq('is_active', true).order('nombre_comercial'),
        supabase.schema('erp').from('almacenes').select('*').eq('is_active', true).order('nombre'),
        supabase.schema('erp').from('listas_precios').select('*').eq('is_active', true).order('nombre'),
        supabase.schema('erp').from('productos').select('*').eq('is_active', true).order('nombre'),
      ])

      setClientes(clientesRes.data || [])
      setAlmacenes(almacenesRes.data || [])
      setListasPrecios(listasRes.data || [])
      setProductos(productosRes.data || [])

      // Pre-llenar items
      if (itemsData) {
        const loadedItems: CotizacionItem[] = itemsData.map(item => {
          // Calcular precio USD base desde el precio MXN guardado
          const precioMXN = Number(item.precio_unitario)
          const tc = cotData.tipo_cambio || tcGlobal
          // Asumir margen 0 si no podemos calcularlo
          const precioUSD = precioMXN / tc

          return {
            key: item.producto_id,
            id: item.id,
            producto_id: item.producto_id,
            producto_nombre: item.descripcion,
            sku: item.productos?.sku || '-',
            precio_lista_usd: precioUSD,
            margen_porcentaje: 0,
            cantidad: Number(item.cantidad),
            cantidad_original: Number(item.cantidad),
            precio_unitario_mxn: precioMXN,
            subtotal: Number(item.subtotal),
          }
        })

        setItems(loadedItems)
        setItemsOriginales(loadedItems.map(i => ({ ...i })))
      }
    } catch (error) {
      console.error('Error loading cotizacion:', error)
      message.error('Error al cargar cotización')
      router.push('/cotizaciones')
    } finally {
      setLoading(false)
    }
  }

  const loadProductosConPrecios = async () => {
    if (!listaPrecioId) return

    const supabase = getSupabaseClient()

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('precios_productos')
        .select('producto_id, precio')
        .eq('lista_precio_id', listaPrecioId)

      if (error) throw error

      setPreciosMap(new Map(data?.map(p => [p.producto_id, Number(p.precio)]) || []))
    } catch (error) {
      console.error('Error loading precios:', error)
    }
  }

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
        .map(p => {
          const precio = preciosMap.get(p.id) || 0
          return {
            value: p.id,
            label: `${p.sku} - ${p.nombre} ($${precio.toFixed(2)} USD)`,
            producto: { ...p, precio },
          }
        })
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
    const margen = 0
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

        if (field === 'margen_porcentaje') {
          updated.precio_unitario_mxn = calcularPrecioMXN(updated.precio_lista_usd, value)
        }

        updated.subtotal = updated.cantidad * updated.precio_unitario_mxn
        return updated
      }
      return item
    }))
  }

  const handleRemoveItem = (key: string) => {
    setItems(items.filter(i => i.key !== key))
  }

  const handleTipoCambioChange = (value: number | null) => {
    const newTC = value || tcGlobal
    setTipoCambio(newTC)

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

  const handleSave = async () => {
    if (!clienteId || !almacenId || items.length === 0) {
      message.error('Completa todos los campos requeridos')
      return
    }

    if (!cotizacion) return

    setSaving(true)
    const supabase = getSupabaseClient()

    try {
      const esOrdenVenta = cotizacion.status === 'orden_venta'

      // Si es orden_venta, manejar cambios de inventario
      if (esOrdenVenta) {
        // Restaurar inventario de items originales
        for (const itemViejo of itemsOriginales) {
          // Obtener cantidad actual y actualizar
          const { data: invData } = await supabase
            .schema('erp')
            .from('inventario')
            .select('cantidad')
            .eq('producto_id', itemViejo.producto_id)
            .eq('almacen_id', almacenId)
            .single()

          if (invData) {
            await supabase
              .schema('erp')
              .from('inventario')
              .update({ cantidad: Number(invData.cantidad) + itemViejo.cantidad })
              .eq('producto_id', itemViejo.producto_id)
              .eq('almacen_id', almacenId)
          }

          // Registrar movimiento de entrada (restauración)
          await supabase
            .schema('erp')
            .from('movimientos_inventario')
            .insert({
              producto_id: itemViejo.producto_id,
              almacen_destino_id: almacenId,
              tipo: 'entrada',
              cantidad: itemViejo.cantidad,
              referencia_tipo: 'cotizacion',
              referencia_id: cotizacionId,
              notas: `Restauración por edición OV ${cotizacion.folio}`
            })
        }
      }

      // Actualizar cotización
      const { error: cotError } = await supabase
        .schema('erp')
        .from('cotizaciones')
        .update({
          cliente_id: clienteId,
          almacen_id: almacenId,
          lista_precio_id: listaPrecioId,
          subtotal,
          descuento_porcentaje: descuentoGlobal,
          descuento_monto: descuentoMonto,
          iva,
          total,
          tipo_cambio: tipoCambio,
          notas: form.getFieldValue('notas'),
        })
        .eq('id', cotizacionId)

      if (cotError) throw cotError

      // Eliminar items viejos
      await supabase
        .schema('erp')
        .from('cotizacion_items')
        .delete()
        .eq('cotizacion_id', cotizacionId)

      // Insertar nuevos items
      const itemsToInsert = items.map(i => ({
        cotizacion_id: cotizacionId,
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

      // Si es orden_venta, descontar nuevo inventario
      if (esOrdenVenta) {
        for (const item of items) {
          const { data: invData } = await supabase
            .schema('erp')
            .from('inventario')
            .select('cantidad')
            .eq('producto_id', item.producto_id)
            .eq('almacen_id', almacenId)
            .single()

          if (invData) {
            await supabase
              .schema('erp')
              .from('inventario')
              .update({ cantidad: Number(invData.cantidad) - item.cantidad })
              .eq('producto_id', item.producto_id)
              .eq('almacen_id', almacenId)
          }

          // Registrar movimiento de salida
          await supabase
            .schema('erp')
            .from('movimientos_inventario')
            .insert({
              producto_id: item.producto_id,
              almacen_origen_id: almacenId,
              tipo: 'salida',
              cantidad: item.cantidad,
              referencia_tipo: 'cotizacion',
              referencia_id: cotizacionId,
              notas: `Orden de Venta ${cotizacion.folio} (editada)`
            })
        }
      }

      message.success('Cotización actualizada')
      router.push(`/cotizaciones/${cotizacionId}`)
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/cotizaciones/${cotizacionId}`)}>
          Volver
        </Button>
        <Title level={2} style={{ margin: 0 }}>Editar Cotización {cotizacion?.folio}</Title>
        {cotizacion?.status === 'orden_venta' && (
          <Text type="warning" strong>(Orden de Venta - El inventario será recalculado)</Text>
        )}
      </Space>

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
                      disabled={cotizacion?.status === 'orden_venta'}
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
                locale={{ emptyText: 'Agrega productos a la cotización' }}
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
                  type="primary"
                  block
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                  disabled={items.length === 0}
                  size="large"
                >
                  Guardar Cambios
                </Button>
                <Button block onClick={() => router.push(`/cotizaciones/${cotizacionId}`)}>
                  Cancelar
                </Button>
              </Space>

              {cotizacion?.status === 'orden_venta' && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text type="warning" style={{ fontSize: 12 }}>
                    Esta cotización está en Orden de Venta. Al guardar, el inventario será restaurado y vuelto a descontar con las nuevas cantidades.
                  </Text>
                </>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
