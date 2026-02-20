'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  message,
  Row,
  Col,
  Descriptions,
  Progress,
  Divider,
  Popconfirm,
  Timeline,
  Spin,
} from 'antd'
import {
  ArrowLeftOutlined,
  SendOutlined,
  InboxOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  FilePdfOutlined,
  EditOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoneyUSD, formatMoneyMXN, formatDate } from '@/lib/utils/format'
import { generarPDFOrdenCompra, type OpcionesMoneda } from '@/lib/utils/pdf'
import HistorialTimeline from '@/components/common/HistorialTimeline'
import type { OrdenCompra, OrdenCompraItem, Proveedor, Almacen, Producto, RecepcionOrden } from '@/types/database'

const { Title, Text } = Typography

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  borrador: { color: 'default', label: 'Borrador' },
  enviada: { color: 'processing', label: 'Enviada' },
  parcialmente_recibida: { color: 'warning', label: 'Parcialmente Recibida' },
  recibida: { color: 'success', label: 'Recibida' },
  cancelada: { color: 'error', label: 'Cancelada' },
}

interface ItemConProducto extends OrdenCompraItem {
  producto?: Producto
}

interface RecepcionConItem extends RecepcionOrden {
  item?: OrdenCompraItem
  producto?: Producto
}

export default function DetalleOrdenCompraPage() {
  const router = useRouter()
  const params = useParams()
  const ordenId = params.id as string

  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState<OrdenCompra | null>(null)
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [almacen, setAlmacen] = useState<Almacen | null>(null)
  const [items, setItems] = useState<ItemConProducto[]>([])
  const [recepciones, setRecepciones] = useState<RecepcionConItem[]>([])
  const [updating, setUpdating] = useState(false)

  
  useEffect(() => {
    if (ordenId) {
      loadOrden()
    }
  }, [ordenId])

  const loadOrden = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // First: load orden (needed for proveedor_id and almacen_destino_id)
      const { data: ordenData, error: ordenError } = await supabase
        .schema('erp')
        .from('ordenes_compra')
        .select('*')
        .eq('id', ordenId)
        .single()

      if (ordenError) throw ordenError
      setOrden(ordenData)

      // Parallel: load proveedor, almacen, items, and recepciones simultaneously
      const [proveedorRes, almacenRes, itemsRes, recepcionesRes] = await Promise.all([
        supabase
          .schema('erp')
          .from('proveedores')
          .select('*')
          .eq('id', ordenData.proveedor_id)
          .single(),
        supabase
          .schema('erp')
          .from('almacenes')
          .select('*')
          .eq('id', ordenData.almacen_destino_id)
          .single(),
        supabase
          .schema('erp')
          .from('orden_compra_items')
          .select('*')
          .eq('orden_compra_id', ordenId)
          .order('created_at'),
        supabase
          .schema('erp')
          .from('recepciones_orden')
          .select('*')
          .eq('orden_compra_id', ordenId)
          .order('fecha_recepcion', { ascending: false }),
      ])

      setProveedor(proveedorRes.data)
      setAlmacen(almacenRes.data)

      const itemsData = itemsRes.data
      if (itemsData && itemsData.length > 0) {
        // Single productos fetch for both items and recepciones
        const productIds = itemsData.map((i) => i.producto_id)
        const { data: productosData } = await supabase
          .schema('erp')
          .from('productos')
          .select('id, sku, nombre, unidad_medida')
          .in('id', productIds)

        const productosMap = new Map(productosData?.map((p) => [p.id, p]))
        setItems(
          itemsData.map((item) => ({
            ...item,
            producto: productosMap.get(item.producto_id),
          }))
        )

        // Use same productos data for recepciones (no duplicate fetch)
        if (recepcionesRes.data) {
          const itemsMap = new Map(itemsData.map((i) => [i.id, i]))
          setRecepciones(
            recepcionesRes.data.map((rec) => {
              const item = itemsMap.get(rec.orden_compra_item_id)
              return {
                ...rec,
                item,
                producto: item ? productosMap.get(item.producto_id) : undefined,
              }
            })
          )
        }
      }
    } catch (error) {
      console.error('Error loading orden:', error)
      message.error('Error al cargar la orden')
    } finally {
      setLoading(false)
    }
  }

  const handleEnviar = async () => {
    const supabase = getSupabaseClient()
    setUpdating(true)

    try {
      const { error } = await supabase
        .schema('erp')
        .from('ordenes_compra')
        .update({ status: 'enviada' })
        .eq('id', ordenId)

      if (error) throw error

      message.success('Orden enviada correctamente')
      loadOrden()
    } catch (error) {
      message.error('Error al enviar la orden')
    } finally {
      setUpdating(false)
    }
  }

  const handleCancelar = async () => {
    const supabase = getSupabaseClient()
    setUpdating(true)

    try {
      const { error } = await supabase
        .schema('erp')
        .from('ordenes_compra')
        .update({ status: 'cancelada' })
        .eq('id', ordenId)

      if (error) throw error

      message.success('Orden cancelada')
      loadOrden()
    } catch (error) {
      message.error('Error al cancelar la orden')
    } finally {
      setUpdating(false)
    }
  }

  const handleDescargarPDF = () => {
    if (!orden || !proveedor || !almacen) return

    // La OC ya tiene los precios en la moneda seleccionada
    const opciones: OpcionesMoneda = {
      moneda: (orden.moneda || 'USD') as 'USD' | 'MXN'
    }

    const ordenPDF = {
      folio: orden.folio,
      fecha: orden.fecha,
      fecha_esperada: orden.fecha_esperada,
      proveedor_nombre: proveedor.razon_social,
      proveedor_rfc: proveedor.rfc,
      proveedor_contacto: proveedor.contacto_nombre,
      almacen_nombre: almacen.nombre,
      subtotal: orden.subtotal,
      iva: orden.iva,
      total: orden.total,
      notas: orden.notas,
      moneda: orden.moneda,
    }

    const itemsPDF = items.map(item => ({
      sku: item.producto?.sku,
      descripcion: item.producto?.nombre || '-',
      cantidad: item.cantidad_solicitada,
      precio_unitario: item.precio_unitario,
      margen_porcentaje: item.descuento_porcentaje,
      subtotal: item.subtotal,
    }))

    generarPDFOrdenCompra(ordenPDF, itemsPDF, opciones)
    message.success('PDF descargado')
  }

  const totalItems = items.length
  const itemsCompletos = items.filter((i) => i.cantidad_recibida >= i.cantidad_solicitada).length
  const progresoPercent = totalItems > 0 ? Math.round((itemsCompletos / totalItems) * 100) : 0

  // Función helper para formatear en la moneda de la orden
  const moneda = orden?.moneda || 'USD'
  const formatMoney = (amount: number | null | undefined) => {
    return moneda === 'MXN' ? formatMoneyMXN(amount) : formatMoneyUSD(amount)
  }

  const columns: ColumnsType<ItemConProducto> = [
    {
      title: 'SKU',
      key: 'sku',
      width: 100,
      render: (_, record) => record.producto?.sku || '-',
    },
    {
      title: 'Producto',
      key: 'producto',
      ellipsis: true,
      render: (_, record) => record.producto?.nombre || '-',
    },
    {
      title: 'Solicitado',
      dataIndex: 'cantidad_solicitada',
      key: 'cantidad_solicitada',
      width: 100,
      align: 'right',
    },
    {
      title: 'Recibido',
      dataIndex: 'cantidad_recibida',
      key: 'cantidad_recibida',
      width: 100,
      align: 'right',
      render: (recibido, record) => (
        <Text
          type={recibido >= record.cantidad_solicitada ? 'success' : recibido > 0 ? 'warning' : undefined}
        >
          {recibido}
        </Text>
      ),
    },
    {
      title: 'Pendiente',
      key: 'pendiente',
      width: 100,
      align: 'right',
      render: (_, record) => {
        const pendiente = record.cantidad_solicitada - record.cantidad_recibida
        return pendiente > 0 ? <Text type="danger">{pendiente}</Text> : <CheckCircleOutlined style={{ color: '#52c41a' }} />
      },
    },
    {
      title: 'Precio Unitario',
      dataIndex: 'precio_unitario',
      key: 'precio_unitario',
      width: 120,
      align: 'right',
      render: (precio) => formatMoney(precio),
    },
    {
      title: 'Margen %',
      dataIndex: 'descuento_porcentaje',
      key: 'descuento_porcentaje',
      width: 80,
      align: 'right',
      render: (margen) => `${margen}%`,
    },
    {
      title: `P.U. Final`,
      key: 'precio_unitario_final',
      width: 120,
      align: 'right',
      render: (_, record) => {
        const precioFinal = record.precio_unitario * (1 - (record.descuento_porcentaje || 0) / 100)
        return formatMoney(precioFinal)
      },
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 120,
      align: 'right',
      render: (subtotal) => formatMoney(subtotal),
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

  const statusConfig = STATUS_CONFIG[orden.status] || { color: 'default', label: orden.status }
  const canEnviar = orden.status === 'borrador'
  const canRecibir = orden.status === 'enviada' || orden.status === 'parcialmente_recibida'
  const canCancelar = orden.status === 'borrador' || orden.status === 'enviada'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/compras')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {orden.folio}
          </Title>
          <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
        </Space>

        <Space>
          <Button icon={<EditOutlined />} onClick={() => router.push(`/compras/${ordenId}/editar`)}>
            Editar
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={handleDescargarPDF}>
            Descargar PDF
          </Button>
          {canEnviar && (
            <Button type="primary" icon={<SendOutlined />} onClick={handleEnviar} loading={updating}>
              Enviar a Proveedor
            </Button>
          )}
          {canRecibir && (
            <Button
              type="primary"
              icon={<InboxOutlined />}
              onClick={() => router.push(`/compras/${ordenId}/recibir`)}
            >
              Recibir Mercancia
            </Button>
          )}
          {canCancelar && (
            <Popconfirm
              title="Cancelar orden"
              description="Esta accion no se puede deshacer"
              onConfirm={handleCancelar}
              okText="Si, cancelar"
              cancelText="No"
            >
              <Button danger icon={<CloseOutlined />} loading={updating}>
                Cancelar
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Informacion de la Orden" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Proveedor">
                    {proveedor?.razon_social || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="RFC">{proveedor?.rfc || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Contacto">
                    {proveedor?.contacto_nombre || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col xs={24} md={12}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Almacen Destino">
                    {almacen?.nombre || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Fecha">{formatDate(orden.fecha)}</Descriptions.Item>
                  <Descriptions.Item label="Fecha Esperada">
                    {orden.fecha_esperada ? formatDate(orden.fecha_esperada) : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Moneda">
                    <Tag color={orden.moneda === 'USD' ? 'green' : 'blue'}>
                      {orden.moneda || 'USD'}
                    </Tag>
                  </Descriptions.Item>
                  {orden.moneda === 'MXN' && orden.tipo_cambio && (
                    <Descriptions.Item label="Tipo de Cambio">
                      ${orden.tipo_cambio.toFixed(4)} USD/MXN
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="Generado por">
                    {orden.creado_por_nombre || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
            {orden.notas && (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary">
                  <strong>Notas:</strong> {orden.notas}
                </Text>
              </>
            )}
          </Card>

          <Card title="Productos" style={{ marginBottom: 16 }}>
            <Table
              dataSource={items}
              columns={columns}
              rowKey="id"
              pagination={false}
              scroll={{ x: 800 }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={8} align="right">
                      <Text strong>Subtotal:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong>{formatMoney(orden.subtotal)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={8} align="right">
                      <Text strong>IVA (16%):</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong>{formatMoney(orden.iva)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={8} align="right">
                      <Text strong style={{ fontSize: 16 }}>Total:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                        {formatMoney(orden.total)}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Progreso de Recepcion" style={{ marginBottom: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Progress
                type="circle"
                percent={progresoPercent}
                format={() => `${itemsCompletos}/${totalItems}`}
                status={progresoPercent === 100 ? 'success' : 'active'}
              />
            </div>
            <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
              {progresoPercent === 100
                ? 'Todos los items han sido recibidos'
                : `${totalItems - itemsCompletos} items pendientes de recibir`}
            </Text>
          </Card>

          <Card title="Historial de Recepciones">
            {recepciones.length === 0 ? (
              <Text type="secondary">No hay recepciones registradas</Text>
            ) : (
              <Timeline
                items={recepciones.map((rec) => ({
                  color: 'green',
                  children: (
                    <div>
                      <Text strong>{formatDate(rec.fecha_recepcion)}</Text>
                      <br />
                      <Text>
                        {rec.producto?.sku}: {rec.cantidad_recibida} unidades
                      </Text>
                      {rec.numero_lote && (
                        <>
                          <br />
                          <Text type="secondary">Lote: {rec.numero_lote}</Text>
                        </>
                      )}
                      {rec.notas && (
                        <>
                          <br />
                          <Text type="secondary">{rec.notas}</Text>
                        </>
                      )}
                    </div>
                  ),
                }))}
              />
            )}
          </Card>

          {/* Historial de movimientos */}
          <Card title={<><HistoryOutlined /> Historial</>} style={{ marginTop: 16 }} size="small">
            <HistorialTimeline documentoTipo="orden_compra" documentoId={orden.id} />
          </Card>
        </Col>
      </Row>

      </div>
  )
}
