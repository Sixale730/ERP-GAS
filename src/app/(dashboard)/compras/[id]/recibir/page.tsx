'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card,
  Button,
  Table,
  InputNumber,
  Input,
  Space,
  Typography,
  message,
  Row,
  Col,
  Tag,
  Spin,
  Alert,
  Modal,
  Form,
  Tooltip,
} from 'antd'
import { ArrowLeftOutlined, CheckOutlined, EditOutlined, DollarOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatMoneyMXN, formatMoneyUSD } from '@/lib/utils/format'
import type { OrdenCompra } from '@/types/database'

const { Title, Text } = Typography
const { TextArea } = Input

interface ItemRecepcion {
  id: string
  producto_id: string
  sku: string
  nombre: string
  cantidad_solicitada: number
  cantidad_recibida: number
  cantidad_pendiente: number
  cantidad_a_recibir: number
  numero_lote: string
  notas: string
  precio_unitario: number
  descuento_porcentaje: number
  subtotal: number
}

const ROLES_PUEDEN_CORREGIR_PRECIO = new Set(['super_admin', 'admin_cliente'])

export default function RecibirMercanciaPage() {
  const router = useRouter()
  const params = useParams()
  const ordenId = params.id as string
  const { role } = useAuth()
  const puedeCorregirPrecio = !!role && ROLES_PUEDEN_CORREGIR_PRECIO.has(role)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [orden, setOrden] = useState<OrdenCompra | null>(null)
  const [items, setItems] = useState<ItemRecepcion[]>([])

  // Modal de correccion de precio
  const [precioModalOpen, setPrecioModalOpen] = useState(false)
  const [precioItem, setPrecioItem] = useState<ItemRecepcion | null>(null)
  const [precioForm] = Form.useForm()
  const [precioSaving, setPrecioSaving] = useState(false)

  useEffect(() => {
    if (ordenId) {
      loadOrden()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenId])

  const loadOrden = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      const { data: ordenData, error: ordenError } = await supabase
        .schema('erp')
        .from('ordenes_compra')
        .select('*')
        .eq('id', ordenId)
        .single()

      if (ordenError) throw ordenError
      setOrden(ordenData)

      // Permitir entrar tambien en 'recibida' para corregir precios; bloquear solo borrador/cancelada.
      const statusValidos = ['enviada', 'parcialmente_recibida', 'recibida']
      if (!statusValidos.includes(ordenData.status)) {
        message.warning('Esta orden no puede recibir mercancia ni editarse aqui')
        router.push(`/compras/${ordenId}`)
        return
      }

      const { data: itemsData } = await supabase
        .schema('erp')
        .from('orden_compra_items')
        .select('*')
        .eq('orden_compra_id', ordenId)
        .order('created_at')

      if (itemsData) {
        const productIds = itemsData.map((i) => i.producto_id)
        const { data: productosData } = await supabase
          .schema('erp')
          .from('productos')
          .select('*')
          .in('id', productIds)

        const productosMap = new Map(productosData?.map((p) => [p.id, p]))

        // Mostrar TODOS los items (no solo pendientes) para poder corregir precios despues de recibir.
        setItems(
          itemsData.map((item) => {
            const producto = productosMap.get(item.producto_id)
            return {
              id: item.id,
              producto_id: item.producto_id,
              sku: producto?.sku || '-',
              nombre: producto?.nombre || '-',
              cantidad_solicitada: Number(item.cantidad_solicitada || 0),
              cantidad_recibida: Number(item.cantidad_recibida || 0),
              cantidad_pendiente: Number(item.cantidad_solicitada || 0) - Number(item.cantidad_recibida || 0),
              cantidad_a_recibir: 0,
              numero_lote: '',
              notas: '',
              precio_unitario: Number(item.precio_unitario || 0),
              descuento_porcentaje: Number(item.descuento_porcentaje || 0),
              subtotal: Number(item.subtotal || 0),
            }
          })
        )
      }
    } catch (error) {
      console.error('Error loading orden:', error)
      message.error('Error al cargar la orden')
    } finally {
      setLoading(false)
    }
  }

  const handleItemChange = (id: string, field: keyof ItemRecepcion, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item
        return { ...item, [field]: value }
      })
    )
  }

  const handleRecibirTodo = (id: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item
        return { ...item, cantidad_a_recibir: item.cantidad_pendiente }
      })
    )
  }

  const handleConfirmarRecepcion = async () => {
    const itemsARecibir = items.filter((item) => item.cantidad_a_recibir > 0)

    if (itemsARecibir.length === 0) {
      message.warning('Ingresa al menos una cantidad a recibir')
      return
    }

    for (const item of itemsARecibir) {
      if (item.cantidad_a_recibir > item.cantidad_pendiente) {
        message.error(`La cantidad a recibir de ${item.sku} excede la cantidad pendiente`)
        return
      }
    }

    setSaving(true)
    const supabase = getSupabaseClient()

    try {
      for (const item of itemsARecibir) {
        const { error } = await supabase
          .schema('erp')
          .rpc('registrar_recepcion', {
            p_orden_compra_item_id: item.id,
            p_cantidad: item.cantidad_a_recibir,
            p_notas: item.notas || null,
            p_numero_lote: item.numero_lote || null,
          })

        if (error) {
          console.error('Error en recepcion:', error)
          throw new Error(`Error al recibir ${item.sku}: ${error.message}`)
        }
      }

      message.success('Mercancia recibida correctamente. El inventario ha sido actualizado.')
      router.push(`/compras/${ordenId}`)
    } catch (error: any) {
      console.error('Error:', error)
      message.error(error.message || 'Error al registrar la recepcion')
    } finally {
      setSaving(false)
    }
  }

  // ───── Correccion de precio ─────
  const formatPrecio = (n: number) =>
    orden?.moneda === 'MXN' ? formatMoneyMXN(n) : formatMoneyUSD(n)

  const handleAbrirCorreccionPrecio = (item: ItemRecepcion) => {
    setPrecioItem(item)
    precioForm.setFieldsValue({
      nuevo_precio: item.precio_unitario,
      nuevo_descuento: item.descuento_porcentaje,
      motivo: '',
    })
    setPrecioModalOpen(true)
  }

  const handleGuardarCorreccionPrecio = async () => {
    if (!precioItem) return

    try {
      const values = await precioForm.validateFields()

      if (
        Number(values.nuevo_precio) === precioItem.precio_unitario &&
        Number(values.nuevo_descuento) === precioItem.descuento_porcentaje
      ) {
        message.info('No hay cambios que aplicar')
        return
      }

      setPrecioSaving(true)
      const supabase = getSupabaseClient()

      const { error } = await supabase
        .schema('erp')
        .rpc('corregir_precio_oc_item', {
          p_item_id: precioItem.id,
          p_nuevo_precio: Number(values.nuevo_precio),
          p_nuevo_descuento: Number(values.nuevo_descuento),
          p_motivo: values.motivo,
        })

      if (error) throw error

      message.success(`Precio corregido. Total de la OC actualizado.`)
      setPrecioModalOpen(false)
      setPrecioItem(null)
      precioForm.resetFields()
      await loadOrden()
    } catch (error: any) {
      if (error?.errorFields) return // validacion del form
      console.error('Error correccion precio:', error)
      message.error(error.message || 'Error al corregir el precio')
    } finally {
      setPrecioSaving(false)
    }
  }

  const totalPendiente = items.reduce((acc, item) => acc + item.cantidad_pendiente, 0)
  const totalARecibir = items.reduce((acc, item) => acc + item.cantidad_a_recibir, 0)
  const hayPendientes = totalPendiente > 0

  const columns: ColumnsType<ItemRecepcion> = useMemo(() => [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 100,
      render: (sku: string, record: any) => record.producto_id ? (
        <a href={`/productos/${record.producto_id}`} target="_blank" rel="noopener noreferrer"
          style={{ color: '#1677ff', textDecoration: 'none', fontFamily: 'monospace', fontSize: 'inherit' }}
          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
        >{sku}</a>
      ) : <span style={{ fontFamily: 'monospace' }}>{sku}</span>,
    },
    {
      title: 'Producto',
      dataIndex: 'nombre',
      key: 'nombre',
      ellipsis: true,
    },
    {
      title: 'Solicitado',
      dataIndex: 'cantidad_solicitada',
      key: 'cantidad_solicitada',
      width: 90,
      align: 'right',
    },
    {
      title: 'Recibido',
      dataIndex: 'cantidad_recibida',
      key: 'cantidad_recibida',
      width: 90,
      align: 'right',
    },
    {
      title: 'Pendiente',
      dataIndex: 'cantidad_pendiente',
      key: 'cantidad_pendiente',
      width: 90,
      align: 'right',
      render: (pendiente: number) =>
        pendiente > 0
          ? <Text type="warning">{pendiente}</Text>
          : <Tag color="green" style={{ margin: 0 }}>Completo</Tag>,
    },
    {
      title: 'Precio',
      key: 'precio_unitario',
      width: 160,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <span>{formatPrecio(record.precio_unitario)}</span>
          {record.descuento_porcentaje > 0 && (
            <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>
              -{record.descuento_porcentaje}%
            </Tag>
          )}
          {puedeCorregirPrecio && (
            <Tooltip title="Corregir precio (factura proveedor)">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleAbrirCorreccionPrecio(record)}
                style={{ padding: 0 }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Cantidad a Recibir',
      key: 'cantidad_a_recibir',
      width: 150,
      render: (_, record) => (
        record.cantidad_pendiente > 0 ? (
          <Space>
            <InputNumber
              min={0}
              max={record.cantidad_pendiente}
              value={record.cantidad_a_recibir}
              onChange={(val) => handleItemChange(record.id, 'cantidad_a_recibir', val || 0)}
              style={{ width: 80 }}
            />
            <Button size="small" onClick={() => handleRecibirTodo(record.id)}>
              Todo
            </Button>
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        )
      ),
    },
    {
      title: 'Lote',
      key: 'numero_lote',
      width: 120,
      render: (_, record) => (
        <Input
          placeholder="Lote"
          value={record.numero_lote}
          onChange={(e) => handleItemChange(record.id, 'numero_lote', e.target.value)}
          disabled={record.cantidad_a_recibir === 0}
        />
      ),
    },
    {
      title: 'Notas',
      key: 'notas',
      width: 150,
      render: (_, record) => (
        <Input
          placeholder="Notas"
          value={record.notas}
          onChange={(e) => handleItemChange(record.id, 'notas', e.target.value)}
          disabled={record.cantidad_a_recibir === 0}
        />
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [puedeCorregirPrecio, orden?.moneda])

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
          <Title level={2} style={{ margin: 0 }}>
            {hayPendientes ? 'Recibir Mercancia' : 'Conciliar Precios'} - {orden.folio}
          </Title>
          {!hayPendientes && (
            <Tag color="green">Completamente recibida</Tag>
          )}
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={18}>
          <Card style={{ marginBottom: 16 }}>
            <Alert
              message={hayPendientes ? 'Registra las cantidades recibidas' : 'Concilia precios contra la factura del proveedor'}
              description={
                hayPendientes
                  ? 'Ingresa la cantidad recibida para cada producto. Puedes hacer recepciones parciales. El inventario se actualizara automaticamente.'
                  : 'Esta OC ya recibio toda la mercancia. Puedes corregir precios si hay diferencias contra la factura del proveedor (queda registrado en el historial).'
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Table
              dataSource={items}
              columns={columns}
              rowKey="id"
              pagination={false}
              scroll={{ x: 1100 }}
              locale={{ emptyText: 'Sin items' }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          {hayPendientes && (
            <Card title="Resumen de Recepcion" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                  <Text type="secondary">Items pendientes</Text>
                  <br />
                  <Text strong style={{ fontSize: 24 }}>
                    {items.filter(i => i.cantidad_pendiente > 0).length}
                  </Text>
                </div>
                <div>
                  <Text type="secondary">Unidades pendientes</Text>
                  <br />
                  <Text strong style={{ fontSize: 24 }}>{totalPendiente}</Text>
                </div>
                <div>
                  <Text type="secondary">Unidades a recibir</Text>
                  <br />
                  <Text strong style={{ fontSize: 24, color: totalARecibir > 0 ? '#1890ff' : undefined }}>
                    {totalARecibir}
                  </Text>
                </div>
              </Space>

              <Button
                type="primary"
                size="large"
                block
                icon={<CheckOutlined />}
                onClick={handleConfirmarRecepcion}
                loading={saving}
                disabled={totalARecibir === 0}
                style={{ marginTop: 24 }}
              >
                Confirmar Recepcion
              </Button>
            </Card>
          )}

          <Card title="Total de la OC" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Subtotal</Text>
                <Text>{formatPrecio(Number(orden.subtotal || 0))}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">IVA</Text>
                <Text>{formatPrecio(Number(orden.iva || 0))}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                <Text strong>Total</Text>
                <Text strong>{formatPrecio(Number(orden.total || 0))}</Text>
              </div>
            </Space>
          </Card>

          <Card title="Informacion">
            <Text type="secondary">
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li>Puedes recibir cantidades parciales</li>
                <li>El inventario se actualiza automaticamente</li>
                <li>Se registra un movimiento de entrada por cada item</li>
                <li>El numero de lote es opcional</li>
                {puedeCorregirPrecio && (
                  <li>Puedes corregir precios (boton ✏️) para conciliar contra la factura del proveedor</li>
                )}
              </ul>
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Modal de correccion de precio */}
      <Modal
        title={
          <Space>
            <DollarOutlined />
            <span>Corregir precio</span>
          </Space>
        }
        open={precioModalOpen}
        onCancel={() => {
          setPrecioModalOpen(false)
          setPrecioItem(null)
          precioForm.resetFields()
        }}
        onOk={handleGuardarCorreccionPrecio}
        okText="Guardar correccion"
        cancelText="Cancelar"
        confirmLoading={precioSaving}
        destroyOnClose
        width={520}
      >
        {precioItem && (
          <>
            <Alert
              type="info"
              showIcon
              message={`${precioItem.sku} — ${precioItem.nombre}`}
              description={
                <Space direction="vertical" size={2} style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Precio actual: <Text strong>{formatPrecio(precioItem.precio_unitario)}</Text>
                    {precioItem.descuento_porcentaje > 0 && (
                      <span> · Descuento actual: <Text strong>{precioItem.descuento_porcentaje}%</Text></span>
                    )}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Subtotal actual: <Text strong>{formatPrecio(precioItem.subtotal)}</Text>
                    {precioItem.cantidad_recibida > 0 && (
                      <span> · Ya recibido: <Text strong>{precioItem.cantidad_recibida}</Text></span>
                    )}
                  </Text>
                </Space>
              }
              style={{ marginBottom: 16 }}
            />

            <Form form={precioForm} layout="vertical">
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    label="Nuevo precio unitario"
                    name="nuevo_precio"
                    rules={[
                      { required: true, message: 'Ingresa el nuevo precio' },
                      { type: 'number', min: 0, message: 'El precio debe ser >= 0' },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      step={0.01}
                      precision={4}
                      addonBefore={orden?.moneda === 'MXN' ? '$' : 'US$'}
                      autoFocus
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Descuento %"
                    name="nuevo_descuento"
                    rules={[
                      { type: 'number', min: 0, max: 100, message: 'Entre 0 y 100' },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      max={100}
                      step={0.5}
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Motivo de la correccion"
                name="motivo"
                rules={[{ required: true, message: 'Captura el motivo (ej. factura proveedor #123)' }]}
              >
                <TextArea
                  rows={3}
                  placeholder="Ej: Factura proveedor F-2026-0815, precio difiere de OC original"
                  maxLength={500}
                  showCount
                />
              </Form.Item>

              <Alert
                type="warning"
                showIcon
                message="Esto recalcula el total de la OC"
                description={
                  precioItem.cantidad_recibida > 0
                    ? 'El costo promedio del producto NO se recalcula retroactivamente para piezas ya recibidas. Si necesitas ajustar inventario, hazlo desde /inventario.'
                    : 'Aun no se recibe mercancia: el nuevo precio se usara cuando se reciba.'
                }
                style={{ marginTop: 8 }}
              />
            </Form>
          </>
        )}
      </Modal>
    </div>
  )
}
