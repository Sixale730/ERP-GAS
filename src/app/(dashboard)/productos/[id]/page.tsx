'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Button, Space, Typography, Tag, Descriptions, Divider, message, Spin, Row, Col, Table, Modal, InputNumber, Form, Popconfirm
} from 'antd'
import { ArrowLeftOutlined, EditOutlined, SettingOutlined, HistoryOutlined, PlusOutlined, DeleteOutlined, ShoppingCartOutlined, FileTextOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoneyMXN, formatMoneyUSD } from '@/lib/utils/format'
import HistorialProductoTable from '@/components/productos/HistorialProductoTable'
import PrecioProductoModal from '@/components/precios/PrecioProductoModal'
import { usePreciosProducto, useDeletePrecioProducto, type PrecioConLista } from '@/lib/hooks/usePreciosProductos'
import { useListasPrecios } from '@/lib/hooks/queries/useCatalogos'

const { Title, Text } = Typography

interface ProductoDetalle {
  id: string
  sku: string
  codigo_barras: string | null
  nombre: string
  descripcion: string | null
  categoria_id: string | null
  categoria_nombre: string | null
  proveedor_principal_id: string | null
  proveedor_nombre: string | null
  unidad_medida: string
  costo_promedio: number
  stock_minimo: number
  stock_maximo: number
  stock_total: number
  reservado_total: number
  disponible_total: number
  numero_parte: string | null
  moneda: 'USD' | 'MXN'
  is_active: boolean
}


interface InventarioAlmacen {
  almacen_id: string
  almacen_nombre: string
  cantidad: number
  reservado: number
  disponible: number
}

export default function ProductoDetallePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [producto, setProducto] = useState<ProductoDetalle | null>(null)
  const [inventario, setInventario] = useState<InventarioAlmacen[]>([])
  const [pendienteRecepcion, setPendienteRecepcion] = useState<{
    total: number
    detalle: { folio: string; oc_id: string; cantidad_pendiente: number; almacen_nombre: string }[]
  }>({ total: 0, detalle: [] })
  const [reservadoOV, setReservadoOV] = useState<{
    total: number
    detalle: { folio: string; ov_id: string; cantidad: number; cliente_nombre: string }[]
  }>({ total: 0, detalle: [] })


  // Modal para editar min/max
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [stockMinimo, setStockMinimo] = useState(0)
  const [stockMaximo, setStockMaximo] = useState(0)
  const [savingStock, setSavingStock] = useState(false)

  // Modal para editar precios
  const [precioModalOpen, setPrecioModalOpen] = useState(false)
  const [precioEditando, setPrecioEditando] = useState<PrecioConLista | null>(null)

  // React Query hooks para precios
  const { data: precios = [], refetch: refetchPrecios } = usePreciosProducto(id)
  const { data: listasPrecios = [] } = useListasPrecios()
  const deletePrecio = useDeletePrecioProducto()

  // Calcular listas disponibles (sin precio asignado)
  const listasDisponibles = useMemo(() => {
    const precioListaIds = precios.map(p => p.lista_precio_id)
    return listasPrecios.filter(l => !precioListaIds.includes(l.id))
  }, [precios, listasPrecios])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (id) {
      loadProducto()
    }
  }, [id])

  const loadProducto = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // Load producto from view + numero_parte from productos table
      const [viewRes, prodRes] = await Promise.all([
        supabase.schema('erp').from('v_productos_stock').select('*').eq('id', id).single(),
        supabase.schema('erp').from('productos').select('numero_parte, moneda').eq('id', id).single(),
      ])

      if (viewRes.error) throw viewRes.error

      // Merge numero_parte into producto data
      const prodData = {
        ...viewRes.data,
        numero_parte: prodRes.data?.numero_parte || null,
        moneda: (prodRes.data?.moneda as 'USD' | 'MXN') || 'USD',
      }
      setProducto(prodData)

      // Load inventario por almacén
      const { data: invData, error: invError } = await supabase
        .schema('erp')
        .from('inventario')
        .select(`
          cantidad,
          reservado,
          almacenes:almacen_id (id, nombre)
        `)
        .eq('producto_id', id)

      if (!invError && invData) {
        const invFormatted = invData.map(i => ({
          almacen_id: (i.almacenes as any)?.id,
          almacen_nombre: (i.almacenes as any)?.nombre || 'Sin nombre',
          cantidad: i.cantidad,
          reservado: i.reservado || 0,
          disponible: i.cantidad - (i.reservado || 0)
        }))
        setInventario(invFormatted)
      }

      // Cargar piezas pendientes de recepción (OCs en tránsito)
      const { data: ocItems } = await supabase
        .schema('erp')
        .from('orden_compra_items')
        .select(`
          cantidad_solicitada,
          cantidad_recibida,
          ordenes_compra:orden_compra_id (
            id, folio, status,
            almacenes:almacen_destino_id (nombre)
          )
        `)
        .eq('producto_id', id)

      if (ocItems) {
        const pendientes = ocItems
          .filter(item => {
            const oc = item.ordenes_compra as any
            return (
              oc &&
              (oc.status === 'enviada' || oc.status === 'parcialmente_recibida') &&
              (item.cantidad_solicitada || 0) > (item.cantidad_recibida || 0)
            )
          })
          .map(item => {
            const oc = item.ordenes_compra as any
            return {
              folio: oc.folio,
              oc_id: oc.id,
              cantidad_pendiente: (item.cantidad_solicitada || 0) - (item.cantidad_recibida || 0),
              almacen_nombre: oc.almacenes?.nombre || 'Sin asignar',
            }
          })

        setPendienteRecepcion({
          total: pendientes.reduce((sum, p) => sum + p.cantidad_pendiente, 0),
          detalle: pendientes,
        })
      }

      // Cargar piezas reservadas por OVs pendientes de facturar
      const { data: ovItems } = await supabase
        .schema('erp')
        .from('cotizacion_items')
        .select(`
          cantidad,
          cotizaciones:cotizacion_id (
            id, folio, status,
            clientes:cliente_id (nombre_comercial)
          )
        `)
        .eq('producto_id', id)

      if (ovItems) {
        const ovsActivas = ovItems
          .filter(item => {
            const cot = item.cotizaciones as any
            return cot && cot.status === 'orden_venta'
          })
          .map(item => {
            const cot = item.cotizaciones as any
            return {
              folio: cot.folio,
              ov_id: cot.id,
              cantidad: item.cantidad || 0,
              cliente_nombre: cot.clientes?.nombre_comercial || 'Sin cliente',
            }
          })

        setReservadoOV({
          total: ovsActivas.reduce((sum, o) => sum + o.cantidad, 0),
          detalle: ovsActivas,
        })
      }
    } catch (error) {
      console.error('Error loading producto:', error)
      message.error('Error al cargar producto')
      router.push('/productos')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenStockModal = () => {
    if (producto) {
      setStockMinimo(producto.stock_minimo)
      setStockMaximo(producto.stock_maximo)
      setStockModalOpen(true)
    }
  }

  const handleSaveStock = async () => {
    if (!producto) return

    setSavingStock(true)
    const supabase = getSupabaseClient()

    try {
      const { error } = await supabase
        .schema('erp')
        .from('productos')
        .update({
          stock_minimo: stockMinimo,
          stock_maximo: stockMaximo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      message.success('Stock mínimo/máximo actualizado')
      setStockModalOpen(false)
      loadProducto()
    } catch (error: any) {
      console.error('Error saving stock:', error)
      message.error(error.message || 'Error al guardar')
    } finally {
      setSavingStock(false)
    }
  }

  const handleDeletePrecio = async (record: PrecioConLista) => {
    try {
      await deletePrecio.mutateAsync({ id: record.id, producto_id: id })
      message.success('Precio eliminado')
    } catch (error: any) {
      console.error('Error deleting precio:', error)
      message.error(error.message || 'Error al eliminar precio')
    }
  }

  const preciosColumns = [
    {
      title: 'Lista de Precios',
      dataIndex: 'lista_nombre',
      key: 'lista_nombre',
    },
    {
      title: 'Moneda',
      dataIndex: 'moneda',
      key: 'moneda',
      width: 80,
      render: (val: string) => (
        <Tag color={val === 'USD' ? 'green' : 'blue'}>{val || 'USD'}</Tag>
      ),
    },
    {
      title: 'Precio',
      dataIndex: 'precio',
      key: 'precio',
      align: 'right' as const,
      render: (val: number, record: PrecioConLista) =>
        record.moneda === 'MXN' ? formatMoneyMXN(val) : formatMoneyUSD(val),
    },
    {
      title: 'Precio c/IVA',
      dataIndex: 'precio_con_iva',
      key: 'precio_con_iva',
      align: 'right' as const,
      render: (val: number | null, record: PrecioConLista) =>
        val ? (record.moneda === 'MXN' ? formatMoneyMXN(val) : formatMoneyUSD(val)) : '-',
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 100,
      render: (_: unknown, record: PrecioConLista) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setPrecioEditando(record)
              setPrecioModalOpen(true)
            }}
          />
          <Popconfirm
            title="Eliminar precio"
            description="Esta accion no se puede deshacer"
            onConfirm={() => handleDeletePrecio(record)}
            okText="Eliminar"
            cancelText="Cancelar"
          >
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const inventarioColumns = [
    {
      title: 'Almacén',
      dataIndex: 'almacen_nombre',
      key: 'almacen_nombre',
    },
    {
      title: 'Cantidad',
      dataIndex: 'cantidad',
      key: 'cantidad',
      align: 'right' as const,
    },
    {
      title: 'Reservado',
      dataIndex: 'reservado',
      key: 'reservado',
      align: 'right' as const,
    },
    {
      title: 'Disponible',
      dataIndex: 'disponible',
      key: 'disponible',
      align: 'right' as const,
      render: (val: number) => (
        <Tag color={val > 0 ? 'green' : 'red'}>{val}</Tag>
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

  if (!producto) {
    return null
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/productos')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {producto.nombre}
          </Title>
          <Tag color={producto.is_active ? 'green' : 'red'}>
            {producto.is_active ? 'Activo' : 'Inactivo'}
          </Tag>
        </Space>

        <Button type="primary" icon={<EditOutlined />} onClick={() => router.push(`/productos/${id}/editar`)}>
          Editar
        </Button>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Información del Producto" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="SKU">
                <Text strong copyable>{producto.sku}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Código de Barras">
                {producto.codigo_barras || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Número de Parte">
                {producto.numero_parte || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Categoría">
                {producto.categoria_nombre || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Proveedor">
                {producto.proveedor_nombre || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Unidad de Medida">
                {producto.unidad_medida}
              </Descriptions.Item>
              <Descriptions.Item label="Costo Promedio">
                {producto.moneda === 'MXN' ? formatMoneyMXN(producto.costo_promedio || 0) : formatMoneyUSD(producto.costo_promedio || 0)}
              </Descriptions.Item>
              <Descriptions.Item label="Stock Mínimo">
                <Space>
                  {producto.stock_minimo}
                  <Button type="link" size="small" icon={<SettingOutlined />} onClick={handleOpenStockModal} />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Stock Máximo">
                <Space>
                  {producto.stock_maximo}
                  <Button type="link" size="small" icon={<SettingOutlined />} onClick={handleOpenStockModal} />
                </Space>
              </Descriptions.Item>
            </Descriptions>
            {producto.descripcion && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Text type="secondary">Descripción: {producto.descripcion}</Text>
              </>
            )}
          </Card>

          <Card
            title="Precios por Lista"
            style={{ marginBottom: 16 }}
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  setPrecioEditando(null)
                  setPrecioModalOpen(true)
                }}
                disabled={listasDisponibles.length === 0}
              >
                Agregar
              </Button>
            }
          >
            <Table
              dataSource={precios}
              columns={preciosColumns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'Sin precios configurados' }}
            />
          </Card>

          {inventario.length > 0 && (
            <Card title="Inventario por Almacén" style={{ marginBottom: 16 }}>
              <Table
                dataSource={inventario}
                columns={inventarioColumns}
                rowKey="almacen_id"
                pagination={false}
                size="small"
              />
            </Card>
          )}

          <Card
            title={
              <Space>
                <HistoryOutlined />
                <span>Historial del Producto</span>
              </Space>
            }
          >
            <HistorialProductoTable productoId={id} pageSize={10} />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Resumen de Stock" style={{ position: 'sticky', top: 88 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Stock Total:</Text>
                <Text strong>{producto.stock_total}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Reservado (OVs):</Text>
                <Text type="warning">{reservadoOV.total}</Text>
              </div>
              {reservadoOV.total > 0 && (
                <div style={{ paddingLeft: 8 }}>
                  {reservadoOV.detalle.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <Link href={`/cotizaciones/${d.ov_id}`} style={{ color: '#fa8c16' }}>
                        <FileTextOutlined style={{ marginRight: 4 }} />{d.folio}
                      </Link>
                      <Text type="secondary" style={{ fontSize: 12 }}>{d.cantidad} — {d.cliente_nombre}</Text>
                    </div>
                  ))}
                </div>
              )}
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={4} style={{ margin: 0 }}>Disponible:</Title>
                <Title level={4} style={{
                  margin: 0,
                  color: producto.disponible_total > 0 ? '#3f8600' : '#cf1322'
                }}>
                  {producto.disponible_total}
                </Title>
              </div>

              {pendienteRecepcion.total > 0 && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text><ShoppingCartOutlined style={{ color: '#1890ff', marginRight: 6 }} />En tránsito:</Text>
                    <Text strong style={{ color: '#1890ff' }}>{pendienteRecepcion.total}</Text>
                  </div>
                  <div style={{ paddingLeft: 8, marginTop: 4 }}>
                    {pendienteRecepcion.detalle.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <Link href={`/compras/${d.oc_id}`} style={{ color: '#1890ff' }}>{d.folio}</Link>
                        <Text type="secondary" style={{ fontSize: 12 }}>{d.cantidad_pendiente} → {d.almacen_nombre}</Text>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {producto.disponible_total <= producto.stock_minimo && (
                <Tag color="orange" style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
                  Stock bajo el mínimo ({producto.stock_minimo})
                </Tag>
              )}

              {producto.disponible_total === 0 && (
                <Tag color="red" style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
                  Sin stock disponible
                </Tag>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Modal para editar stock mínimo/máximo */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            <span>Configurar Stock Mínimo/Máximo</span>
          </Space>
        }
        open={stockModalOpen}
        onCancel={() => setStockModalOpen(false)}
        onOk={handleSaveStock}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={savingStock}
        destroyOnClose
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Stock Mínimo" help="Cantidad mínima antes de generar alerta de reabastecimiento">
            <InputNumber
              value={stockMinimo}
              onChange={(v) => setStockMinimo(v || 0)}
              min={0}
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>

          <Form.Item label="Stock Máximo" help="Cantidad objetivo para órdenes de compra automáticas">
            <InputNumber
              value={stockMaximo}
              onChange={(v) => setStockMaximo(v || 0)}
              min={0}
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>

          {stockMaximo > 0 && stockMinimo >= stockMaximo && (
            <Tag color="warning" style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
              El stock mínimo debe ser menor que el máximo
            </Tag>
          )}
        </Form>
      </Modal>

      {/* Modal para editar precios */}
      <PrecioProductoModal
        open={precioModalOpen}
        onClose={() => {
          setPrecioModalOpen(false)
          setPrecioEditando(null)
        }}
        productoId={id}
        precio={precioEditando}
        listasDisponibles={listasDisponibles}
        onSuccess={() => refetchPrecios()}
      />
    </div>
  )
}
