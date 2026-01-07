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
  Alert,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils/format'
import { TIPO_CAMBIO_DEFAULT, type CodigoMoneda } from '@/lib/config/moneda'

const { Title, Text } = Typography

interface ItemFactura {
  key: string
  id?: string
  producto_id: string
  sku: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  subtotal: number
  isNew?: boolean
}

interface Cliente {
  id: string
  nombre_comercial: string
  razon_social: string
  rfc: string
  regimen_fiscal: string
  uso_cfdi: string
  dias_credito: number
}

interface Almacen {
  id: string
  nombre: string
}

interface Producto {
  id: string
  sku: string
  nombre: string
}

interface ProductoOption {
  value: string
  label: string
  producto: Producto
}

export default function EditarFacturaPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [facturaOriginal, setFacturaOriginal] = useState<any>(null)
  const [items, setItems] = useState<ItemFactura[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [productosOptions, setProductosOptions] = useState<ProductoOption[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [moneda, setMoneda] = useState<CodigoMoneda>('USD')
  const [tipoCambio, setTipoCambio] = useState<number | null>(null)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // Cargar factura
      const { data: factura, error: facError } = await supabase
        .schema('erp')
        .from('facturas')
        .select('*')
        .eq('id', id)
        .single()

      if (facError) throw facError

      // Verificar que no este timbrada
      if (factura.status_sat === 'timbrado') {
        message.error('No se puede editar una factura timbrada')
        router.push(`/facturas/${id}`)
        return
      }

      setFacturaOriginal(factura)

      // Cargar items
      const { data: itemsData } = await supabase
        .schema('erp')
        .from('factura_items')
        .select('*, productos:producto_id (sku)')
        .eq('factura_id', id)

      const itemsFormateados: ItemFactura[] = (itemsData || []).map((item: any) => ({
        key: item.id,
        id: item.id,
        producto_id: item.producto_id,
        sku: item.productos?.sku || '-',
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento_porcentaje: item.descuento_porcentaje || 0,
        subtotal: item.subtotal,
      }))
      setItems(itemsFormateados)

      // Cargar catalogos en paralelo
      const [clientesRes, almacenesRes, productosRes] = await Promise.all([
        supabase.schema('erp').from('clientes').select('id, nombre_comercial, razon_social, rfc, regimen_fiscal, uso_cfdi, dias_credito').eq('is_active', true),
        supabase.schema('erp').from('almacenes').select('id, nombre').eq('is_active', true),
        supabase.schema('erp').from('productos').select('id, sku, nombre').eq('is_active', true),
      ])

      setClientes(clientesRes.data || [])
      setAlmacenes(almacenesRes.data || [])
      setProductos(productosRes.data || [])

      // Set cliente seleccionado
      const cliente = clientesRes.data?.find(c => c.id === factura.cliente_id)
      if (cliente) setClienteSeleccionado(cliente)

      // Set form values
      form.setFieldsValue({
        cliente_id: factura.cliente_id,
        almacen_id: factura.almacen_id,
        fecha: dayjs(factura.fecha),
        fecha_vencimiento: factura.fecha_vencimiento ? dayjs(factura.fecha_vencimiento) : null,
        notas: factura.notas,
        descuento_porcentaje: factura.descuento_monto > 0 ? Math.round((factura.descuento_monto / factura.subtotal) * 100) : 0,
      })

      // Set moneda y tipo de cambio
      setMoneda((factura.moneda as CodigoMoneda) || 'USD')
      setTipoCambio(factura.tipo_cambio || null)
    } catch (error) {
      console.error('Error loading factura:', error)
      message.error('Error al cargar factura')
      router.push('/facturas')
    } finally {
      setLoading(false)
    }
  }

  const handleClienteChange = (clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId)
    setClienteSeleccionado(cliente || null)
  }

  const handleSearchProducto = (value: string) => {
    setSearchValue(value)
    if (value.length < 2) {
      setProductosOptions([])
      return
    }

    const filtered = productos
      .filter(p =>
        p.sku.toLowerCase().includes(value.toLowerCase()) ||
        p.nombre.toLowerCase().includes(value.toLowerCase())
      )
      .slice(0, 10)
      .map(p => ({
        value: p.id,
        label: `${p.sku} - ${p.nombre}`,
        producto: p,
      }))

    setProductosOptions(filtered)
  }

  const handleSelectProducto = (value: string, option: ProductoOption) => {
    const producto = option.producto

    if (items.some(item => item.producto_id === producto.id)) {
      message.warning('Este producto ya esta en la lista')
      setSearchValue('')
      return
    }

    const newItem: ItemFactura = {
      key: `new-${Date.now()}`,
      producto_id: producto.id,
      sku: producto.sku,
      descripcion: producto.nombre,
      cantidad: 1,
      precio_unitario: 0,
      descuento_porcentaje: 0,
      subtotal: 0,
      isNew: true,
    }

    setItems([...items, newItem])
    setSearchValue('')
    setProductosOptions([])
  }

  const handleItemChange = (key: string, field: keyof ItemFactura, value: any) => {
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.key !== key) return item

        const updated = { ...item, [field]: value }
        updated.subtotal = Math.round(
          updated.cantidad * updated.precio_unitario * (1 - updated.descuento_porcentaje / 100) * 100
        ) / 100
        return updated
      })
    )
  }

  const handleRemoveItem = (key: string) => {
    setItems(items.filter(item => item.key !== key))
  }

  // Calculos
  const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0)
  const descuentoPorcentaje = form.getFieldValue('descuento_porcentaje') || 0
  const descuentoMonto = Math.round(subtotal * (descuentoPorcentaje / 100) * 100) / 100
  const iva = Math.round((subtotal - descuentoMonto) * 0.16 * 100) / 100
  const total = Math.round((subtotal - descuentoMonto + iva) * 100) / 100

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

      // Actualizar factura
      const { error: updateError } = await supabase
        .schema('erp')
        .from('facturas')
        .update({
          cliente_id: values.cliente_id,
          almacen_id: values.almacen_id,
          fecha: values.fecha?.format('YYYY-MM-DD'),
          fecha_vencimiento: values.fecha_vencimiento?.format('YYYY-MM-DD') || null,
          notas: values.notas || null,
          cliente_rfc: clienteSeleccionado?.rfc || null,
          cliente_razon_social: clienteSeleccionado?.razon_social || null,
          cliente_regimen_fiscal: clienteSeleccionado?.regimen_fiscal || null,
          cliente_uso_cfdi: clienteSeleccionado?.uso_cfdi || null,
          subtotal,
          descuento_monto: descuentoMonto,
          iva,
          total,
          saldo: total - (facturaOriginal.total - facturaOriginal.saldo), // Mantener pagos existentes
          moneda,
          tipo_cambio: tipoCambio,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) throw updateError

      // Eliminar items existentes
      await supabase
        .schema('erp')
        .from('factura_items')
        .delete()
        .eq('factura_id', id)

      // Insertar items nuevos
      const itemsData = items.map(item => ({
        factura_id: id,
        producto_id: item.producto_id,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento_porcentaje: item.descuento_porcentaje,
        subtotal: item.subtotal,
      }))

      const { error: itemsError } = await supabase
        .schema('erp')
        .from('factura_items')
        .insert(itemsData)

      if (itemsError) throw itemsError

      message.success('Factura actualizada correctamente')
      router.push(`/facturas/${id}`)
    } catch (error: any) {
      console.error('Error saving factura:', error)
      message.error(error.message || 'Error al guardar la factura')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<ItemFactura> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 100,
    },
    {
      title: 'Descripcion',
      dataIndex: 'descripcion',
      key: 'descripcion',
      render: (_, record) => (
        <Input
          value={record.descripcion}
          onChange={(e) => handleItemChange(record.key, 'descripcion', e.target.value)}
        />
      ),
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
      title: 'Precio Unit.',
      dataIndex: 'precio_unitario',
      key: 'precio_unitario',
      width: 140,
      render: (_, record) => (
        <InputNumber
          min={0}
          step={0.01}
          precision={2}
          value={record.precio_unitario}
          onChange={(val) => handleItemChange(record.key, 'precio_unitario', val || 0)}
          style={{ width: '100%' }}
          prefix="$"
        />
      ),
    },
    {
      title: 'Desc. %',
      dataIndex: 'descuento_porcentaje',
      key: 'descuento_porcentaje',
      width: 100,
      render: (_, record) => (
        <InputNumber
          min={0}
          max={100}
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
      render: (subtotal) => formatMoney(subtotal),
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
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/facturas/${id}`)}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            Editar Factura {facturaOriginal?.folio}
          </Title>
        </Space>
      </div>

      {facturaOriginal?.status_sat === 'timbrado' && (
        <Alert
          type="error"
          message="Factura timbrada"
          description="No se puede editar una factura que ya fue timbrada ante el SAT."
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Datos de la Factura" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="cliente_id"
                    label="Cliente"
                    rules={[{ required: true, message: 'Selecciona un cliente' }]}
                  >
                    <Select
                      placeholder="Selecciona cliente"
                      showSearch
                      optionFilterProp="label"
                      onChange={handleClienteChange}
                      options={clientes.map(c => ({
                        value: c.id,
                        label: c.nombre_comercial || c.razon_social,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="almacen_id"
                    label="Almacen"
                    rules={[{ required: true, message: 'Selecciona un almacen' }]}
                  >
                    <Select
                      placeholder="Selecciona almacen"
                      options={almacenes.map(a => ({
                        value: a.id,
                        label: a.nombre,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="fecha" label="Fecha" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="fecha_vencimiento" label="Fecha Vencimiento">
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="descuento_porcentaje" label="Descuento General %">
                    <InputNumber
                      min={0}
                      max={100}
                      style={{ width: '100%' }}
                      addonAfter="%"
                      onChange={() => form.validateFields()}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Moneda">
                    <Select
                      value={moneda}
                      onChange={(value) => {
                        setMoneda(value)
                        if (value === 'MXN' && !tipoCambio) {
                          setTipoCambio(TIPO_CAMBIO_DEFAULT)
                        }
                      }}
                      options={[
                        { value: 'USD', label: 'USD - Dolar' },
                        { value: 'MXN', label: 'MXN - Peso Mexicano' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                {moneda === 'MXN' && (
                  <Col xs={24} md={8}>
                    <Form.Item label="Tipo de Cambio">
                      <InputNumber
                        value={tipoCambio || TIPO_CAMBIO_DEFAULT}
                        onChange={(value) => setTipoCambio(value)}
                        min={1}
                        max={100}
                        step={0.01}
                        precision={4}
                        style={{ width: '100%' }}
                        addonAfter="MXN/USD"
                      />
                    </Form.Item>
                  </Col>
                )}
                <Col xs={24}>
                  <Form.Item name="notas" label="Notas">
                    <Input.TextArea rows={2} placeholder="Notas o instrucciones..." />
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            {clienteSeleccionado && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  RFC: {clienteSeleccionado.rfc || 'Sin RFC'} |
                  Razon Social: {clienteSeleccionado.razon_social || 'N/A'}
                </Text>
              </div>
            )}
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
            </Space>

            <Table
              dataSource={items}
              columns={columns}
              rowKey="key"
              pagination={false}
              scroll={{ x: 700 }}
              locale={{ emptyText: 'Agrega productos a la factura' }}
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
                precision={2}
              />
              {descuentoMonto > 0 && (
                <Statistic
                  title={`Descuento (${descuentoPorcentaje}%)`}
                  value={descuentoMonto}
                  prefix="-$"
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                />
              )}
              <Statistic
                title="IVA (16%)"
                value={iva}
                prefix="$"
                precision={2}
              />
              <Divider style={{ margin: '8px 0' }} />
              <Statistic
                title="Total"
                value={total}
                prefix="$"
                precision={2}
                valueStyle={{ color: '#1890ff', fontSize: 28 }}
              />
            </Space>

            <Divider />

            <Space direction="vertical" style={{ width: '100%' }}>
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
              <Button
                block
                onClick={() => router.push(`/facturas/${id}`)}
              >
                Cancelar
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
