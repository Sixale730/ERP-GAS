'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Form, Select, Button, Table, InputNumber, Input, Space, Typography, message, Divider, Row, Col, AutoComplete, Tooltip, Alert, Collapse
} from 'antd'
import { DeleteOutlined, SaveOutlined, InfoCircleOutlined, DollarOutlined, EnvironmentOutlined, BankOutlined, CreditCardOutlined, UserOutlined } from '@ant-design/icons'
import { REGIMENES_FISCALES_SAT, USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from '@/lib/config/sat'
import { getSupabaseClient } from '@/lib/supabase/client'
import DireccionEnvioSelect, { DireccionEnvioDisplay } from '@/components/common/DireccionEnvioSelect'
import type { DireccionEnvio } from '@/types/database'
import { formatMoneyMXN, formatMoneyUSD, calcularTotal } from '@/lib/utils/format'
import { registrarHistorial } from '@/lib/utils/historial'
import { useConfiguracion } from '@/lib/hooks/useConfiguracion'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Cliente, Almacen, ListaPrecio } from '@/types/database'
import type { CodigoMoneda } from '@/lib/config/moneda'

const { Title, Text } = Typography

interface OrdenVentaItem {
  key: string
  producto_id: string
  producto_nombre: string
  sku: string
  precio_lista: number
  moneda_precio: CodigoMoneda  // Moneda de origen del precio en la lista
  margen_porcentaje: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  es_servicio: boolean
}

export default function NuevaOrdenVentaPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const { orgId, erpUser } = useAuth()

  const { tipoCambio: tcGlobal, loading: loadingConfig } = useConfiguracion()
  const [tipoCambio, setTipoCambio] = useState(17.50)
  const [moneda, setMoneda] = useState<CodigoMoneda>('MXN')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([])
  const [preciosMap, setPreciosMap] = useState<Map<string, { precio: number, moneda: CodigoMoneda }>>(new Map())
  const [loadingPrecios, setLoadingPrecios] = useState(false)
  const [preciosCargados, setPreciosCargados] = useState(false)

  const [clienteId, setClienteId] = useState<string | null>(null)
  const [almacenId, setAlmacenId] = useState<string | null>(null)
  const [listaPrecioId, setListaPrecioId] = useState<string | null>(null)

  // Direccion de envio seleccionada
  const [direccionEnvioId, setDireccionEnvioId] = useState<string | null>(null)
  const [direccionEnvio, setDireccionEnvio] = useState<DireccionEnvio | null>(null)

  const [items, setItems] = useState<OrdenVentaItem[]>([])
  const [descuentoGlobal, setDescuentoGlobal] = useState(0)

  const [inventarioMap, setInventarioMap] = useState<Map<string, number>>(new Map())
  const [mostrarAlertaStock, setMostrarAlertaStock] = useState(true)

  // Vendedor
  const [vendedorNombre, setVendedorNombre] = useState('')

  const [productSearch, setProductSearch] = useState('')
  const [productOptions, setProductOptions] = useState<any[]>([])

  useEffect(() => {
    if (!loadingConfig) {
      setTipoCambio(tcGlobal)
    }
  }, [loadingConfig, tcGlobal])

  // Inicializar nombre del vendedor con el usuario actual
  useEffect(() => {
    if (erpUser?.nombre) {
      setVendedorNombre(erpUser.nombre)
    }
  }, [erpUser])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (clienteId) {
      const cliente = clientes.find(c => c.id === clienteId)
      if (!cliente) return

      if (cliente.lista_precio_id) {
        setListaPrecioId(cliente.lista_precio_id)
        form.setFieldValue('lista_precio_id', cliente.lista_precio_id)
      }
      if (cliente.moneda) {
        handleMonedaChange(cliente.moneda)
      }

      form.setFieldsValue({
        cfdi_rfc: cliente.rfc,
        cfdi_razon_social: cliente.razon_social,
        cfdi_regimen_fiscal: cliente.regimen_fiscal,
        cfdi_uso_cfdi: cliente.uso_cfdi,
        cfdi_codigo_postal: cliente.codigo_postal_fiscal,
      })

      // Reset direccion de envio - se seleccionara automaticamente la predeterminada
      setDireccionEnvioId(null)
      setDireccionEnvio(null)

      form.setFieldsValue({
        forma_pago: cliente.forma_pago,
        metodo_pago: cliente.metodo_pago,
        condiciones_pago: cliente.dias_credito ? `${cliente.dias_credito} dias de credito` : null,
      })
    }
  }, [clienteId, clientes])

  useEffect(() => {
    if (listaPrecioId) {
      loadProductosConPrecios()
    }
  }, [listaPrecioId])

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
      setMostrarAlertaStock(true)
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
        supabase.schema('erp').from('productos').select('id, sku, nombre, unidad_medida, es_servicio, categoria_id').eq('is_active', true).order('nombre'),
      ])

      setClientes(clientesRes.data || [])
      setAlmacenes(almacenesRes.data || [])
      setListasPrecios(listasRes.data || [])
      setProductos(productosRes.data || [])

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

    setLoadingPrecios(true)
    setPreciosCargados(false)
    const supabase = getSupabaseClient()

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('precios_productos')
        .select('producto_id, precio, moneda')
        .eq('lista_precio_id', listaPrecioId)

      if (error) throw error

      setPreciosMap(new Map(data?.map(p => [p.producto_id, { precio: Number(p.precio), moneda: (p.moneda || 'USD') as CodigoMoneda }]) || []))
      setPreciosCargados(true)

      if (!data || data.length === 0) {
        message.warning('No hay precios configurados para esta lista')
      }
    } catch (error) {
      console.error('Error loading precios:', error)
      message.error('Error al cargar precios de productos')
    } finally {
      setLoadingPrecios(false)
    }
  }

  const calcularPrecioFinal = (precioBase: number, monedaOrigen: CodigoMoneda, margenPct: number, monedaDestino: CodigoMoneda = moneda) => {
    const precioConMargen = precioBase * (1 + margenPct / 100)
    if (monedaOrigen === monedaDestino) return precioConMargen
    if (monedaOrigen === 'USD') return precioConMargen * tipoCambio
    return precioConMargen / tipoCambio
  }

  const formatMoney = (amount: number) => {
    return moneda === 'USD' ? formatMoneyUSD(amount) : formatMoneyMXN(amount)
  }

  const handleProductSearch = (value: string) => {
    setProductSearch(value)
    if (value.length >= 2) {
      if (preciosMap.size === 0) {
        message.warning('Esperando carga de precios...')
        return
      }
      const filtered = productos
        .filter(p =>
          p.nombre.toLowerCase().includes(value.toLowerCase()) ||
          p.sku.toLowerCase().includes(value.toLowerCase())
        )
        .slice(0, 10)
        .map(p => {
          const precioData = preciosMap.get(p.id) || { precio: 0, moneda: 'USD' as CodigoMoneda }
          return {
            value: p.id,
            label: `${p.sku} - ${p.nombre} ($${precioData.precio.toFixed(2)} ${precioData.moneda})`,
            producto: { ...p, precio: precioData.precio, moneda_precio: precioData.moneda },
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

    const precioBase = producto.precio
    const monedaPrecio: CodigoMoneda = producto.moneda_precio || 'USD'
    const margen = 0
    const precioFinal = calcularPrecioFinal(precioBase, monedaPrecio, margen)

    const newItem: OrdenVentaItem = {
      key: producto.id,
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      sku: producto.sku,
      precio_lista: precioBase,
      moneda_precio: monedaPrecio,
      margen_porcentaje: margen,
      cantidad: 1,
      precio_unitario: precioFinal,
      subtotal: precioFinal,
      es_servicio: producto.es_servicio || false,
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
          updated.precio_unitario = calcularPrecioFinal(updated.precio_lista, updated.moneda_precio, value)
        }

        updated.subtotal = updated.cantidad * updated.precio_unitario
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

    // Solo recalcular items que requieren conversión
    setItems(items.map(item => {
      if (item.moneda_precio === moneda) return item
      const precioConMargen = item.precio_lista * (1 + item.margen_porcentaje / 100)
      const nuevoPrecio = item.moneda_precio === 'USD' ? precioConMargen * newTC : precioConMargen / newTC
      return {
        ...item,
        precio_unitario: nuevoPrecio,
        subtotal: item.cantidad * nuevoPrecio
      }
    }))
  }

  const handleMonedaChange = (nuevaMoneda: CodigoMoneda) => {
    setMoneda(nuevaMoneda)

    setItems(prevItems => prevItems.map(item => {
      const nuevoPrecio = calcularPrecioFinal(item.precio_lista, item.moneda_precio, item.margen_porcentaje, nuevaMoneda)
      return {
        ...item,
        precio_unitario: nuevoPrecio,
        subtotal: item.cantidad * nuevoPrecio
      }
    }))
  }

  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0)
  const descuentoMonto = subtotal * (descuentoGlobal / 100)
  const { iva, total } = calcularTotal(subtotal, descuentoMonto)

  const handleSave = async () => {
    if (savingRef.current) return
    savingRef.current = true

    if (!clienteId || !almacenId || items.length === 0) {
      savingRef.current = false
      message.error('Completa todos los campos requeridos')
      return
    }

    setSaving(true)
    const supabase = getSupabaseClient()

    // Safety timeout: desbloquear botón si la operación tarda más de 15s
    const safetyTimeout = setTimeout(() => {
      setSaving(false)
      message.error('La operación tardó demasiado. Intenta de nuevo.')
    }, 15000)

    try {
      // 1. Generar folio
      const { data: folioData, error: folioError } = await supabase.schema('erp').rpc('generar_folio', { tipo: 'orden_venta' })
      if (folioError) throw folioError
      const folio = folioData as string

      const formValues = form.getFieldsValue()

      // 2. Crear cotizacion con status 'orden_venta' (el RPC acepta ambos estados)
      const { data: cotizacion, error: cotError } = await supabase
        .schema('erp')
        .from('cotizaciones')
        .insert({
          folio,
          cliente_id: clienteId,
          almacen_id: almacenId,
          lista_precio_id: listaPrecioId,
          status: 'orden_venta', // Crear directamente como orden de venta
          subtotal,
          descuento_porcentaje: descuentoGlobal,
          descuento_monto: descuentoMonto,
          iva,
          total,
          moneda,
          tipo_cambio: moneda === 'MXN' ? tipoCambio : null,
          vigencia_dias: 30,
          notas: formValues.notas,
          cfdi_rfc: formValues.cfdi_rfc || null,
          cfdi_razon_social: formValues.cfdi_razon_social || null,
          cfdi_regimen_fiscal: formValues.cfdi_regimen_fiscal || null,
          cfdi_uso_cfdi: formValues.cfdi_uso_cfdi || null,
          cfdi_codigo_postal: formValues.cfdi_codigo_postal || null,
          // Datos de envío (desde direccion seleccionada)
          envio_direccion: direccionEnvio ? [direccionEnvio.calle, direccionEnvio.numero_exterior, direccionEnvio.colonia].filter(Boolean).join(', ') : null,
          envio_ciudad: direccionEnvio?.ciudad || null,
          envio_estado: direccionEnvio?.estado || null,
          envio_codigo_postal: direccionEnvio?.codigo_postal || null,
          envio_contacto: direccionEnvio?.contacto_nombre || null,
          envio_telefono: direccionEnvio?.contacto_telefono || null,
          forma_pago: formValues.forma_pago || null,
          metodo_pago: formValues.metodo_pago || null,
          condiciones_pago: formValues.condiciones_pago || null,
          // Vendedor
          vendedor_id: erpUser?.id || null,
          vendedor_nombre: vendedorNombre || null,
          oc_cliente: formValues.oc_cliente || null,
          organizacion_id: orgId,
        })
        .select()
        .single()

      if (cotError) throw cotError

      // 3. Insertar items
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

      // 4. Descontar inventario de la OV creada directamente
      const { error: ovError } = await supabase
        .schema('erp')
        .rpc('descontar_inventario_ov', { p_ov_id: cotizacion.id })

      if (ovError) throw ovError

      // Registrar en historial
      await registrarHistorial({
        documentoTipo: 'orden_venta',
        documentoId: cotizacion.id,
        documentoFolio: folio,
        usuarioId: erpUser?.id,
        usuarioNombre: erpUser?.nombre || erpUser?.email,
        accion: 'creado',
        descripcion: `Orden de Venta creada para ${clientes.find(c => c.id === clienteId)?.nombre_comercial || 'cliente'}`,
      })

      message.success(`Orden de Venta ${folio} creada`)
      router.push(`/cotizaciones/${cotizacion.id}`)
    } catch (error: any) {
      console.error('Error saving orden de venta:', error)
      message.error(error.message || 'Error al guardar orden de venta')
    } finally {
      clearTimeout(safetyTimeout)
      savingRef.current = false
      setSaving(false)
    }
  }

  const columns = useMemo(() => [
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
      title: 'Precio Lista',
      dataIndex: 'precio_lista',
      width: 110,
      render: (val: number, record: OrdenVentaItem) => `$${val.toFixed(2)} ${record.moneda_precio}`,
    },
    {
      title: (
        <Tooltip title="Margen adicional. Positivo = ganancia extra. Negativo = descuento.">
          Margen % <InfoCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      dataIndex: 'margen_porcentaje',
      width: 90,
      render: (val: number, record: OrdenVentaItem) => (
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
      render: (val: number, record: OrdenVentaItem) => (
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
      render: (val: number, record: OrdenVentaItem) => (
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
      render: (_: any, record: OrdenVentaItem) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(record.key)} size="small" />
      ),
    },
  ], [handleUpdateItem, handleRemoveItem, formatMoney, moneda])

  return (
    <div>
      <Title level={2}>Nueva Orden de Venta</Title>

      <Alert
        type="info"
        message="Al guardar, el inventario se descontara automaticamente del almacen seleccionado."
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
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

          <Card title="Datos de la Orden de Venta" style={{ marginBottom: 16 }}>
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
                <Col xs={24} md={12}>
                  <Form.Item label="Vendedor">
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="Nombre del vendedor"
                      value={vendedorNombre}
                      onChange={(e) => setVendedorNombre(e.target.value)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="oc_cliente" label="OC del Cliente">
                    <Input placeholder="Numero de orden de compra del cliente" />
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
                placeholder={loadingPrecios ? "Cargando precios..." : "Buscar producto por SKU o nombre..."}
                disabled={!listaPrecioId || !almacenId || loadingPrecios || !preciosCargados}
              />

              {!preciosCargados && listaPrecioId && !loadingPrecios && (
                <Alert
                  type="warning"
                  message="Los precios no se han cargado. Verifica la lista de precios seleccionada."
                  style={{ marginTop: 8 }}
                />
              )}

              {mostrarAlertaStock && almacenId && items.length > 0 && (() => {
                const productosSinStock = items.filter(item => {
                  // Excluir servicios de la validación de stock
                  const producto = productos.find(p => p.id === item.producto_id)
                  if (producto?.es_servicio) return false
                  const stockDisponible = inventarioMap.get(item.producto_id) ?? 0
                  return stockDisponible < item.cantidad
                })
                if (productosSinStock.length === 0) return null
                return (
                  <Alert
                    type="info"
                    closable
                    onClose={() => setMostrarAlertaStock(false)}
                    message="Productos sin stock — se requerirá orden de compra"
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
                locale={{ emptyText: 'Agrega productos a la orden' }}
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
                      <span>Direccion de Envio</span>
                      {direccionEnvio && <span style={{ color: '#52c41a' }}>({direccionEnvio.alias})</span>}
                    </Space>
                  ),
                  children: (
                    <div>
                      <DireccionEnvioSelect
                        clienteId={clienteId}
                        value={direccionEnvioId}
                        onChange={(id, dir) => {
                          setDireccionEnvioId(id)
                          setDireccionEnvio(dir)
                        }}
                        allowAddNew={true}
                      />
                      {direccionEnvio && (
                        <div style={{ marginTop: 16 }}>
                          <DireccionEnvioDisplay direccion={direccionEnvio} />
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'cfdi',
                  label: (
                    <Space>
                      <BankOutlined />
                      <span>Datos de Facturacion (CFDI)</span>
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
                        <Form.Item name="cfdi_razon_social" label="Razon Social">
                          <Input placeholder="Razon social" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="cfdi_regimen_fiscal" label="Regimen Fiscal">
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
                          <Input placeholder="Codigo postal" maxLength={5} />
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
                        <Form.Item name="metodo_pago" label="Metodo de Pago">
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
                  disabled={saving || items.length === 0}
                  size="large"
                >
                  Crear Orden de Venta
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
