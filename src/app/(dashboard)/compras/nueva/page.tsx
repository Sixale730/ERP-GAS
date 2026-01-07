'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Popconfirm,
  Alert,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, SendOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoneyUSD } from '@/lib/utils/format'
import { registrarHistorial } from '@/lib/utils/historial'
import { useAuth } from '@/lib/hooks/useAuth'
import { useMargenesCategoria } from '@/lib/hooks/useMargenesCategoria'
import { useConfiguracion } from '@/lib/hooks/useConfiguracion'
import type { Proveedor, Almacen, Producto } from '@/types/database'

const { Title, Text } = Typography

interface ItemOrden {
  key: string
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

export default function NuevaOrdenCompraPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cargarStockBajo = searchParams.get('stock_bajo') === 'true'
  const [form] = Form.useForm()
  const { getMargenParaCategoria, loading: loadingMargenes } = useMargenesCategoria()
  const { tipoCambio } = useConfiguracion()
  const { orgId, erpUser } = useAuth()

  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [productosOptions, setProductosOptions] = useState<ProductoOption[]>([])
  const [preciosMap, setPreciosMap] = useState<Map<string, number>>(new Map())
  const [items, setItems] = useState<ItemOrden[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [monedaSeleccionada, setMonedaSeleccionada] = useState<'USD' | 'MXN'>('USD')
  const [tipoCambioLocal, setTipoCambioLocal] = useState<number>(tipoCambio)
  const [stockBajoCargado, setStockBajoCargado] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  // Actualizar tipo de cambio local cuando se cargue del hook
  useEffect(() => {
    if (tipoCambio && tipoCambioLocal === 0) {
      setTipoCambioLocal(tipoCambio)
    }
  }, [tipoCambio])

  // Cargar productos de stock bajo si viene de Dashboard
  useEffect(() => {
    if (cargarStockBajo && productos.length > 0 && preciosMap.size > 0 && !stockBajoCargado && !loadingMargenes) {
      cargarProductosStockBajo()
    }
  }, [cargarStockBajo, productos, preciosMap, stockBajoCargado, loadingMargenes])

  const cargarProductosStockBajo = async () => {
    const supabase = getSupabaseClient()
    try {
      const { data } = await supabase
        .schema('erp')
        .from('v_productos_stock')
        .select('*')
        .lt('stock_total', 10)

      if (data && data.length > 0) {
        const itemsOC: ItemOrden[] = data.map(p => {
          const producto = productos.find(prod => prod.id === p.id)
          const margen = getMargenParaCategoria(producto?.categoria_id || null)
          const precioBase = preciosMap.get(p.id) || producto?.costo_promedio || 0
          const precioConMargen = precioBase * (1 - margen / 100)
          const cantidadSugerida = Math.max(20 - (p.stock_total || 0), 10)
          const subtotalItem = Math.round(cantidadSugerida * precioConMargen * 100) / 100

          return {
            key: p.id,
            producto_id: p.id,
            sku: p.sku,
            nombre: p.nombre,
            categoria_id: producto?.categoria_id || null,
            cantidad: cantidadSugerida,
            precio_unitario: Math.round(precioConMargen * 100) / 100,
            descuento_porcentaje: margen,
            subtotal: subtotalItem,
          }
        })
        setItems(itemsOC)
        setStockBajoCargado(true)
      }
    } catch (error) {
      console.error('Error loading stock bajo products:', error)
    }
  }

  const loadInitialData = async () => {
    const supabase = getSupabaseClient()
    setLoadingData(true)

    try {
      const [proveedoresRes, almacenesRes, productosRes] = await Promise.all([
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
      ])

      setProveedores(proveedoresRes.data || [])
      setAlmacenes(almacenesRes.data || [])
      setProductos(productosRes.data || [])

      // Cargar precios de la lista "Público General"
      const { data: preciosData } = await supabase
        .schema('erp')
        .from('precios_productos')
        .select('producto_id, precio')
        .eq('lista_precio_id', '33333333-3333-3333-3333-333333333301')

      setPreciosMap(new Map(preciosData?.map(p => [p.producto_id, Number(p.precio)]) || []))
    } catch (error) {
      console.error('Error loading data:', error)
      message.error('Error al cargar datos')
    } finally {
      setLoadingData(false)
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

    // Verificar si ya existe
    if (items.some((item) => item.producto_id === producto.id)) {
      message.warning('Este producto ya esta en la lista')
      setSearchValue('')
      return
    }

    // Obtener margen de la categoria
    const margen = getMargenParaCategoria(producto.categoria_id)

    // Obtener precio de la lista de precios (o costo_promedio como fallback)
    const precioBase = preciosMap.get(producto.id) || producto.costo_promedio || 0

    // Calcular precio con margen
    const precioConMargen = precioBase * (1 - margen / 100)

    // Aplicar tipo de cambio si la moneda es MXN
    const precioFinal = monedaSeleccionada === 'MXN'
      ? precioConMargen * tipoCambioLocal
      : precioConMargen

    const newItem: ItemOrden = {
      key: producto.id,
      producto_id: producto.id,
      sku: producto.sku,
      nombre: producto.nombre,
      categoria_id: producto.categoria_id,
      cantidad: 1,
      precio_unitario: Math.round(precioFinal * 100) / 100,
      descuento_porcentaje: margen,
      subtotal: Math.round(precioFinal * 100) / 100,
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
        // Recalcular subtotal (redondeado a 2 decimales)
        updated.subtotal = Math.round(
          updated.cantidad * updated.precio_unitario * (1 - updated.descuento_porcentaje / 100) * 100
        ) / 100
        return updated
      })
    )
  }

  const handleRemoveItem = (key: string) => {
    setItems(items.filter((item) => item.key !== key))
  }

  // Calculos
  const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva

  const handleSave = async (enviar: boolean) => {
    try {
      await form.validateFields()

      if (items.length === 0) {
        message.error('Agrega al menos un producto')
        return
      }

      setSaving(true)
      const supabase = getSupabaseClient()
      const values = form.getFieldsValue()

      // Generar folio
      const { data: folioData, error: folioError } = await supabase
        .schema('erp')
        .rpc('generar_folio', {
          tipo: 'orden_compra',
        })

      if (folioError) throw folioError

      const folio = folioData

      // Crear orden
      const ordenData = {
        folio,
        proveedor_id: values.proveedor_id,
        almacen_destino_id: values.almacen_id,
        organizacion_id: orgId,
        fecha: values.fecha?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        fecha_esperada: values.fecha_esperada?.format('YYYY-MM-DD') || null,
        status: enviar ? 'enviada' : 'borrador',
        moneda: values.moneda || 'USD',
        tipo_cambio: values.moneda === 'MXN' ? tipoCambioLocal : null,
        subtotal,
        iva,
        total,
        notas: values.notas || null,
      }

      const { data: orden, error: ordenError } = await supabase
        .schema('erp')
        .from('ordenes_compra')
        .insert(ordenData)
        .select()
        .single()

      if (ordenError) throw ordenError

      // Crear items
      const itemsData = items.map((item) => ({
        orden_compra_id: orden.id,
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
      const proveedorNombre = proveedores.find(p => p.id === values.proveedor_id)?.nombre || 'proveedor'
      await registrarHistorial({
        documentoTipo: 'orden_compra',
        documentoId: orden.id,
        documentoFolio: folio,
        usuarioId: erpUser?.id,
        usuarioNombre: erpUser?.nombre || erpUser?.email,
        accion: 'creado',
        descripcion: `Orden de Compra creada para ${proveedorNombre}`,
      })

      message.success(`Orden ${folio} guardada correctamente`)
      router.push('/compras')
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/compras')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>Nueva Orden de Compra</Title>
        </Space>
      </div>

      {stockBajoCargado && (
        <Alert
          type="info"
          message="Productos con stock bajo pre-cargados"
          description={`Se agregaron ${items.length} productos con stock bajo. La cantidad sugerida repone hasta 20 unidades. Selecciona proveedor y almacen para continuar.`}
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Datos de la Orden" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical" initialValues={{ fecha: dayjs(), moneda: 'USD' }}>
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
                      loading={loadingData}
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
                      loading={loadingData}
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
                <Col xs={24} md={8}>
                  <Form.Item
                    name="moneda"
                    label="Moneda"
                    rules={[{ required: true, message: 'Selecciona la moneda' }]}
                  >
                    <Select
                      onChange={(nuevaMoneda: 'USD' | 'MXN') => {
                        const monedaAnterior = monedaSeleccionada
                        setMonedaSeleccionada(nuevaMoneda)

                        // Convertir precios de todos los items
                        if (monedaAnterior !== nuevaMoneda && items.length > 0) {
                          setItems(prevItems => prevItems.map(item => {
                            let nuevoPrecio = item.precio_unitario

                            if (monedaAnterior === 'USD' && nuevaMoneda === 'MXN') {
                              // USD a MXN: multiplicar por tipo de cambio
                              nuevoPrecio = item.precio_unitario * tipoCambioLocal
                            } else if (monedaAnterior === 'MXN' && nuevaMoneda === 'USD') {
                              // MXN a USD: dividir por tipo de cambio
                              nuevoPrecio = item.precio_unitario / tipoCambioLocal
                            }

                            return {
                              ...item,
                              precio_unitario: Math.round(nuevoPrecio * 100) / 100,
                              subtotal: Math.round(nuevoPrecio * item.cantidad * (1 - item.descuento_porcentaje / 100) * 100) / 100
                            }
                          }))
                        }
                      }}
                      options={[
                        { value: 'USD', label: 'USD - Dólares' },
                        { value: 'MXN', label: 'MXN - Pesos' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                {monedaSeleccionada === 'MXN' && (
                  <Col xs={24} md={8}>
                    <Form.Item label="Tipo de Cambio">
                      <InputNumber
                        style={{ width: '100%' }}
                        value={tipoCambioLocal}
                        min={1}
                        step={0.0001}
                        precision={4}
                        prefix="$"
                        onChange={(value) => {
                          const nuevoTC = value || tipoCambio
                          const tcAnterior = tipoCambioLocal
                          setTipoCambioLocal(nuevoTC)

                          // Recalcular precios de items existentes con el nuevo tipo de cambio
                          if (items.length > 0 && tcAnterior !== nuevoTC) {
                            setItems(prevItems => prevItems.map(item => {
                              // Convertir el precio de vuelta a USD y luego aplicar nuevo TC
                              const precioEnUSD = item.precio_unitario / tcAnterior
                              const nuevoPrecio = precioEnUSD * nuevoTC
                              return {
                                ...item,
                                precio_unitario: Math.round(nuevoPrecio * 100) / 100,
                                subtotal: Math.round(nuevoPrecio * item.cantidad * (1 - item.descuento_porcentaje / 100) * 100) / 100
                              }
                            }))
                          }
                        }}
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
            <Space direction="vertical" style={{ marginBottom: 16, width: '100%' }}>
              <AutoComplete
                style={{ width: '100%' }}
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

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                block
                size="large"
                icon={<SaveOutlined />}
                onClick={() => handleSave(false)}
                loading={saving}
              >
                Borrador
              </Button>
              <Button
                type="primary"
                block
                size="large"
                icon={<SendOutlined />}
                onClick={() => handleSave(true)}
                loading={saving}
              >
                Guardar
              </Button>
            </Space>
          </Card>

          <Card title="Informacion">
            <Text type="secondary">
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li>El <strong>margen</strong> se calcula automaticamente segun la categoria del producto</li>
                <li>Puedes ajustar el margen manualmente para cada linea</li>
                <li>Al enviar, la orden cambia a status &quot;Enviada&quot;</li>
                <li>Recibe la mercancia desde el detalle de la orden</li>
              </ul>
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
