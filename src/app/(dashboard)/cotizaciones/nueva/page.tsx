'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Form, Select, Button, Table, InputNumber, Input, Space, Typography, message, Divider, Row, Col, AutoComplete, Tooltip, Alert, Collapse
} from 'antd'
import { DeleteOutlined, SaveOutlined, InfoCircleOutlined, DollarOutlined, EnvironmentOutlined, BankOutlined, CreditCardOutlined } from '@ant-design/icons'
import { REGIMENES_FISCALES_SAT, USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from '@/lib/config/sat'
import { getSupabaseClient } from '@/lib/supabase/client'
import EstadoCiudadSelect from '@/components/common/EstadoCiudadSelect'
import { formatMoneyMXN, formatMoneyUSD, calcularTotal } from '@/lib/utils/format'
import { useConfiguracion } from '@/lib/hooks/useConfiguracion'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Cliente, Almacen, ListaPrecio } from '@/types/database'
import type { CodigoMoneda } from '@/lib/config/moneda'

const { Title, Text } = Typography

interface CotizacionItem {
  key: string
  producto_id: string
  producto_nombre: string
  sku: string
  precio_lista_usd: number
  margen_porcentaje: number
  cantidad: number
  precio_unitario: number  // En la moneda seleccionada
  subtotal: number
}

export default function NuevaCotizacionPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const { orgId } = useAuth()

  // Configuracion global
  const { tipoCambio: tcGlobal, loading: loadingConfig } = useConfiguracion()

  // Tipo de cambio para esta cotizacion (editable)
  const [tipoCambio, setTipoCambio] = useState(17.50)

  // Moneda de la cotizacion
  const [moneda, setMoneda] = useState<CodigoMoneda>('MXN')

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

  // Inventario del almacén para alertas de stock
  const [inventarioMap, setInventarioMap] = useState<Map<string, number>>(new Map())
  const [mostrarAlertaStock, setMostrarAlertaStock] = useState(true)

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

  // Cuando cambia el cliente, cargar su lista de precios, moneda y copiar datos
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (clienteId) {
      const cliente = clientes.find(c => c.id === clienteId)
      if (!cliente) return

      // Lista de precios
      if (cliente.lista_precio_id) {
        setListaPrecioId(cliente.lista_precio_id)
        form.setFieldValue('lista_precio_id', cliente.lista_precio_id)
      }
      // Usar la moneda del cliente si tiene una configurada
      if (cliente.moneda) {
        handleMonedaChange(cliente.moneda)
      }

      // Copiar datos de facturación (CFDI) del cliente
      form.setFieldsValue({
        cfdi_rfc: cliente.rfc,
        cfdi_razon_social: cliente.razon_social,
        cfdi_regimen_fiscal: cliente.regimen_fiscal,
        cfdi_uso_cfdi: cliente.uso_cfdi,
        cfdi_codigo_postal: cliente.codigo_postal_fiscal,
      })

      // Copiar datos de envío (usar dirección de envío si existe, sino la fiscal)
      if (cliente.direccion_envio) {
        form.setFieldsValue({
          envio_direccion: cliente.direccion_envio,
          envio_ciudad: cliente.ciudad_envio,
          envio_estado: cliente.estado_envio,
          envio_codigo_postal: cliente.codigo_postal_envio,
          envio_contacto: cliente.contacto_envio,
          envio_telefono: cliente.telefono_envio,
        })
      } else {
        form.setFieldsValue({
          envio_direccion: cliente.direccion,
          envio_contacto: cliente.contacto_nombre,
          envio_telefono: cliente.telefono,
        })
      }

      // Copiar preferencias de pago del cliente
      form.setFieldsValue({
        forma_pago: cliente.forma_pago,
        metodo_pago: cliente.metodo_pago,
        condiciones_pago: cliente.dias_credito ? `${cliente.dias_credito} días de crédito` : null,
      })
    }
  }, [clienteId, clientes])

  // Cuando cambia la lista de precios, cargar precios
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (listaPrecioId) {
      loadProductosConPrecios()
    }
  }, [listaPrecioId])

  // Cuando cambia el almacén, cargar inventario para alertas
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (almacenId) {
      loadInventarioAlmacen(almacenId)
    }
  }, [almacenId])

  const loadInventarioAlmacen = async (almId: string) => {
    const supabase = getSupabaseClient()
    try {
      const { data } = await supabase
        .schema('erp')
        .from('inventario')
        .select('producto_id, cantidad')
        .eq('almacen_id', almId)

      setInventarioMap(new Map(data?.map(i => [i.producto_id, Number(i.cantidad)]) || []))
      setMostrarAlertaStock(true) // Reiniciar alerta al cambiar almacén
    } catch (error) {
      console.error('Error loading inventario:', error)
    }
  }

  const loadData = async () => {
    const supabase = getSupabaseClient()

    try {
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
    if (!listaPrecioId) return

    const supabase = getSupabaseClient()

    try {
      // Cargar precios de la lista seleccionada
      const { data, error } = await supabase
        .schema('erp')
        .from('precios_productos')
        .select('producto_id, precio')
        .eq('lista_precio_id', listaPrecioId)

      if (error) throw error

      // Crear mapa de precios
      setPreciosMap(new Map(data?.map(p => [p.producto_id, Number(p.precio)]) || []))
    } catch (error) {
      console.error('Error loading precios:', error)
    }
  }

  // Calcular precio final segun moneda
  const calcularPrecioFinal = (precioUSD: number, margenPct: number, monedaDestino: CodigoMoneda = moneda) => {
    const precioConMargen = precioUSD * (1 + margenPct / 100)
    return monedaDestino === 'USD' ? precioConMargen : precioConMargen * tipoCambio
  }

  // Formatear dinero segun moneda seleccionada
  const formatMoney = (amount: number) => {
    return moneda === 'USD' ? formatMoneyUSD(amount) : formatMoneyMXN(amount)
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
    const margen = 0 // Default 0%
    const precioFinal = calcularPrecioFinal(precioUSD, margen)

    const newItem: CotizacionItem = {
      key: producto.id,
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      sku: producto.sku,
      precio_lista_usd: precioUSD,
      margen_porcentaje: margen,
      cantidad: 1,
      precio_unitario: precioFinal,
      subtotal: precioFinal,
    }

    setItems([...items, newItem])
    setProductSearch('')
    setProductOptions([])
  }

  const handleUpdateItem = (key: string, field: string, value: number) => {
    setItems(items.map(item => {
      if (item.key === key) {
        const updated = { ...item, [field]: value }

        // Si cambia el margen, recalcular precio
        if (field === 'margen_porcentaje') {
          updated.precio_unitario = calcularPrecioFinal(updated.precio_lista_usd, value)
        }

        // Recalcular subtotal
        updated.subtotal = updated.cantidad * updated.precio_unitario
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

    // Solo recalcular si estamos en MXN
    if (moneda === 'MXN') {
      setItems(items.map(item => {
        const nuevoPrecio = item.precio_lista_usd * (1 + item.margen_porcentaje / 100) * newTC
        return {
          ...item,
          precio_unitario: nuevoPrecio,
          subtotal: item.cantidad * nuevoPrecio
        }
      }))
    }
  }

  // Cambiar moneda y recalcular todos los items
  const handleMonedaChange = (nuevaMoneda: CodigoMoneda) => {
    setMoneda(nuevaMoneda)

    // Recalcular todos los items con la nueva moneda
    setItems(prevItems => prevItems.map(item => {
      const nuevoPrecio = calcularPrecioFinal(item.precio_lista_usd, item.margen_porcentaje, nuevaMoneda)
      return {
        ...item,
        precio_unitario: nuevoPrecio,
        subtotal: item.cantidad * nuevoPrecio
      }
    }))
  }

  // Totals
  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0)
  const descuentoMonto = subtotal * (descuentoGlobal / 100)
  const { iva, total } = calcularTotal(subtotal, descuentoMonto)

  const handleSave = async () => {
    const status = 'propuesta'
    if (!clienteId || !almacenId || items.length === 0) {
      message.error('Completa todos los campos requeridos')
      return
    }

    setSaving(true)
    const supabase = getSupabaseClient()

    try {
      const { data: folioData } = await supabase.schema('erp').rpc('generar_folio', { tipo: 'cotizacion' })
      const folio = folioData as string

      const formValues = form.getFieldsValue()
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
          moneda,
          tipo_cambio: moneda === 'MXN' ? tipoCambio : null,
          vigencia_dias: 30,
          notas: formValues.notas,
          // Datos CFDI
          cfdi_rfc: formValues.cfdi_rfc || null,
          cfdi_razon_social: formValues.cfdi_razon_social || null,
          cfdi_regimen_fiscal: formValues.cfdi_regimen_fiscal || null,
          cfdi_uso_cfdi: formValues.cfdi_uso_cfdi || null,
          cfdi_codigo_postal: formValues.cfdi_codigo_postal || null,
          // Datos de envío
          envio_direccion: formValues.envio_direccion || null,
          envio_ciudad: formValues.envio_ciudad || null,
          envio_estado: formValues.envio_estado || null,
          envio_codigo_postal: formValues.envio_codigo_postal || null,
          envio_contacto: formValues.envio_contacto || null,
          envio_telefono: formValues.envio_telefono || null,
          // Datos de pago
          forma_pago: formValues.forma_pago || null,
          metodo_pago: formValues.metodo_pago || null,
          condiciones_pago: formValues.condiciones_pago || null,
          // Organizacion (requerido por RLS)
          organizacion_id: orgId,
        })
        .select()
        .single()

      if (cotError) throw cotError

      const itemsToInsert = items.map(i => ({
        cotizacion_id: cotizacion.id,
        producto_id: i.producto_id,
        descripcion: i.producto_nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
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
        <Tooltip title={`Precio en ${moneda}. Puedes editarlo manualmente.`}>
          Precio {moneda} <InfoCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      dataIndex: 'precio_unitario',
      width: 120,
      render: (val: number, record: CotizacionItem) => (
        <InputNumber
          min={0}
          value={val}
          onChange={(v) => handleUpdateItem(record.key, 'precio_unitario', v || 0)}
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
      render: (val: number) => formatMoney(val),
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
          {/* Card de Tipo de Cambio - Solo visible para MXN */}
          {moneda === 'MXN' && (
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
                    step={0.0001}
                    precision={4}
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
          )}

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
                  <Form.Item label="Moneda" required>
                    <Select
                      value={moneda}
                      onChange={handleMonedaChange}
                      options={[
                        { value: 'MXN', label: 'Peso Mexicano (MXN)' },
                        { value: 'USD', label: 'Dolar Americano (USD)' },
                      ]}
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

              {/* Alerta de productos sin stock */}
              {mostrarAlertaStock && almacenId && items.length > 0 && (() => {
                const productosSinStock = items.filter(item => {
                  const stockDisponible = inventarioMap.get(item.producto_id) ?? 0
                  return stockDisponible < item.cantidad
                })
                if (productosSinStock.length === 0) return null
                return (
                  <Alert
                    type="warning"
                    closable
                    onClose={() => setMostrarAlertaStock(false)}
                    message="Productos sin stock disponible"
                    description={
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {productosSinStock.map(p => {
                          const stock = inventarioMap.get(p.producto_id) ?? 0
                          return (
                            <li key={p.key}>
                              <strong>{p.sku}</strong>: Stock {stock}, Solicitado {p.cantidad}
                            </li>
                          )
                        })}
                      </ul>
                    }
                  />
                )
              })()}

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

          <Form form={form} layout="vertical">
            <Collapse
              defaultActiveKey={[]}
              style={{ marginBottom: 16 }}
              items={[
                {
                  key: 'envio',
                  label: (
                    <Space>
                      <EnvironmentOutlined />
                      <span>Datos de Envío</span>
                    </Space>
                  ),
                  children: (
                    <Row gutter={16}>
                      <Col xs={24}>
                        <Form.Item name="envio_direccion" label="Dirección">
                          <Input.TextArea rows={2} placeholder="Dirección de envío" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={16}>
                        <Form.Item label="Estado y Ciudad">
                          <EstadoCiudadSelect
                            estadoValue={form.getFieldValue('envio_estado')}
                            ciudadValue={form.getFieldValue('envio_ciudad')}
                            onEstadoChange={(value) => form.setFieldValue('envio_estado', value)}
                            onCiudadChange={(value) => form.setFieldValue('envio_ciudad', value)}
                          />
                          <Form.Item name="envio_estado" hidden><Input /></Form.Item>
                          <Form.Item name="envio_ciudad" hidden><Input /></Form.Item>
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="envio_codigo_postal" label="C.P.">
                          <Input placeholder="Código postal" maxLength={10} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="envio_contacto" label="Contacto">
                          <Input placeholder="Nombre de quien recibe" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="envio_telefono" label="Teléfono">
                          <Input placeholder="Teléfono de contacto" />
                        </Form.Item>
                      </Col>
                    </Row>
                  ),
                },
                {
                  key: 'cfdi',
                  label: (
                    <Space>
                      <BankOutlined />
                      <span>Datos de Facturación (CFDI)</span>
                    </Space>
                  ),
                  children: (
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item name="cfdi_rfc" label="RFC">
                          <Input placeholder="RFC" maxLength={13} style={{ textTransform: 'uppercase' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="cfdi_razon_social" label="Razón Social">
                          <Input placeholder="Razón social" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="cfdi_regimen_fiscal" label="Régimen Fiscal">
                          <Select placeholder="Seleccionar" allowClear options={REGIMENES_FISCALES_SAT} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="cfdi_uso_cfdi" label="Uso CFDI">
                          <Select placeholder="Seleccionar" allowClear options={USOS_CFDI_SAT} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="cfdi_codigo_postal" label="C.P. Fiscal">
                          <Input placeholder="Código postal" maxLength={5} />
                        </Form.Item>
                      </Col>
                    </Row>
                  ),
                },
                {
                  key: 'pago',
                  label: (
                    <Space>
                      <CreditCardOutlined />
                      <span>Datos de Pago</span>
                    </Space>
                  ),
                  children: (
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item name="forma_pago" label="Forma de Pago">
                          <Select placeholder="Seleccionar" allowClear options={FORMAS_PAGO_SAT} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="metodo_pago" label="Método de Pago">
                          <Select placeholder="Seleccionar" allowClear options={METODOS_PAGO_SAT} />
                        </Form.Item>
                      </Col>
                      <Col xs={24}>
                        <Form.Item name="condiciones_pago" label="Condiciones de Pago">
                          <Input.TextArea rows={2} placeholder="Condiciones especiales de pago..." />
                        </Form.Item>
                      </Col>
                    </Row>
                  ),
                },
              ]}
            />

            <Form.Item name="notas" label="Notas">
              <Input.TextArea rows={3} placeholder="Notas adicionales..." />
            </Form.Item>
          </Form>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Resumen" style={{ position: 'sticky', top: 88 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Moneda:</Text>
                <Text strong style={{ color: moneda === 'USD' ? '#52c41a' : '#1890ff' }}>
                  <DollarOutlined /> {moneda}
                </Text>
              </div>
              {moneda === 'MXN' && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">T/C:</Text>
                  <Text>{tipoCambio} MXN/USD</Text>
                </div>
              )}
              <Divider style={{ margin: '8px 0' }} />
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
                  type="primary"
                  block
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                  disabled={items.length === 0}
                  size="large"
                >
                  Guardar Cotizacion
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
