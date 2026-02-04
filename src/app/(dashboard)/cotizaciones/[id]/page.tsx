'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Table, Button, Space, Typography, Tag, Descriptions, Divider, message, Modal, Spin, Row, Col, Alert, Collapse, Input
} from 'antd'
import { ArrowLeftOutlined, FileTextOutlined, CheckCircleOutlined, FilePdfOutlined, EditOutlined, CloseCircleOutlined, ShoppingCartOutlined, DollarOutlined, ClockCircleOutlined, EnvironmentOutlined, BankOutlined, CreditCardOutlined, HistoryOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoneyMXN, formatMoneyUSD, formatDate } from '@/lib/utils/format'
import { getFormaPagoLabel, getMetodoPagoLabel, getRegimenFiscalLabel, getUsoCfdiLabel } from '@/lib/config/sat'
import dayjs from 'dayjs'
import { generarPDFCotizacion, type OpcionesMoneda } from '@/lib/utils/pdf'
import HistorialTimeline from '@/components/common/HistorialTimeline'
import type { CodigoMoneda } from '@/lib/config/moneda'

const { Title, Text } = Typography

interface CotizacionDetalle {
  id: string
  folio: string
  fecha: string
  vigencia_dias: number
  status: string
  subtotal: number
  descuento_porcentaje: number
  descuento_monto: number
  iva: number
  total: number
  notas: string | null
  cliente_id: string
  cliente_nombre: string
  cliente_rfc: string | null
  almacen_id: string
  almacen_nombre: string
  moneda: CodigoMoneda
  tipo_cambio: number | null
  // Datos CFDI
  cfdi_rfc: string | null
  cfdi_razon_social: string | null
  cfdi_regimen_fiscal: string | null
  cfdi_uso_cfdi: string | null
  cfdi_codigo_postal: string | null
  // Datos de envío
  envio_direccion: string | null
  envio_ciudad: string | null
  envio_estado: string | null
  envio_codigo_postal: string | null
  envio_contacto: string | null
  envio_telefono: string | null
  // Datos de pago
  forma_pago: string | null
  metodo_pago: string | null
  condiciones_pago: string | null
  // Datos del cliente para días de crédito
  cliente_dias_credito?: number
  // Vendedor
  vendedor_nombre: string | null
}

// Helpers para vigencia
function calcularFechaVencimiento(fecha: string, vigenciaDias: number): string {
  return dayjs(fecha).add(vigenciaDias, 'day').format('YYYY-MM-DD')
}

function esCaducada(fecha: string, vigenciaDias: number): boolean {
  const vencimiento = dayjs(fecha).add(vigenciaDias, 'day')
  return dayjs().isAfter(vencimiento)
}

interface CotizacionItem {
  id: string
  producto_id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  subtotal: number
  sku?: string
}

const statusColors: Record<string, string> = {
  propuesta: 'processing',
  orden_venta: 'success',
  factura: 'purple',
  cancelada: 'error',
}

const statusLabels: Record<string, string> = {
  propuesta: 'Propuesta',
  orden_venta: 'Orden de Venta',
  factura: 'Facturada',
  cancelada: 'Cancelada',
}

export default function CotizacionDetallePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)
  const [cotizacion, setCotizacion] = useState<CotizacionDetalle | null>(null)
  const [items, setItems] = useState<CotizacionItem[]>([])
  const [inventarioMap, setInventarioMap] = useState<Map<string, number>>(new Map())
  const [mostrarAlertaStock, setMostrarAlertaStock] = useState(true)
  // Estados para edición inline de descripción
  const [editingItems, setEditingItems] = useState<Map<string, string>>(new Map())
  const [savingItem, setSavingItem] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (id) {
      loadCotizacion()
    }
  }, [id])

  // Formatear dinero segun moneda de la cotizacion
  const formatMoney = (amount: number) => {
    if (!cotizacion) return `$${amount.toFixed(2)}`
    return cotizacion.moneda === 'USD' ? formatMoneyUSD(amount) : formatMoneyMXN(amount)
  }

  const loadCotizacion = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // Load cotizacion directly from table to get moneda and tipo_cambio
      const { data: cotData, error: cotError } = await supabase
        .schema('erp')
        .from('cotizaciones')
        .select(`
          *,
          clientes:cliente_id (nombre_comercial, rfc, dias_credito),
          almacenes:almacen_id (nombre)
        `)
        .eq('id', id)
        .single()

      if (cotError) throw cotError

      // Transform data to match interface
      const cotizacionData: CotizacionDetalle = {
        id: cotData.id,
        folio: cotData.folio,
        fecha: cotData.fecha,
        vigencia_dias: cotData.vigencia_dias || 30,
        status: cotData.status,
        subtotal: cotData.subtotal,
        descuento_porcentaje: cotData.descuento_porcentaje,
        descuento_monto: cotData.descuento_monto,
        iva: cotData.iva,
        total: cotData.total,
        notas: cotData.notas,
        cliente_id: cotData.cliente_id,
        cliente_nombre: cotData.clientes?.nombre_comercial || '-',
        cliente_rfc: cotData.clientes?.rfc || null,
        almacen_id: cotData.almacen_id,
        almacen_nombre: cotData.almacenes?.nombre || '-',
        moneda: cotData.moneda || 'MXN',
        tipo_cambio: cotData.tipo_cambio,
        // Datos CFDI
        cfdi_rfc: cotData.cfdi_rfc,
        cfdi_razon_social: cotData.cfdi_razon_social,
        cfdi_regimen_fiscal: cotData.cfdi_regimen_fiscal,
        cfdi_uso_cfdi: cotData.cfdi_uso_cfdi,
        cfdi_codigo_postal: cotData.cfdi_codigo_postal,
        // Datos de envío
        envio_direccion: cotData.envio_direccion,
        envio_ciudad: cotData.envio_ciudad,
        envio_estado: cotData.envio_estado,
        envio_codigo_postal: cotData.envio_codigo_postal,
        envio_contacto: cotData.envio_contacto,
        envio_telefono: cotData.envio_telefono,
        // Datos de pago
        forma_pago: cotData.forma_pago,
        metodo_pago: cotData.metodo_pago,
        condiciones_pago: cotData.condiciones_pago,
        cliente_dias_credito: cotData.clientes?.dias_credito || 0,
        // Vendedor
        vendedor_nombre: cotData.vendedor_nombre
      }

      setCotizacion(cotizacionData)

      // Load items
      const { data: itemsData, error: itemsError } = await supabase
        .schema('erp')
        .from('cotizacion_items')
        .select(`
          *,
          productos:producto_id (sku)
        `)
        .eq('cotizacion_id', id)
        .order('created_at')

      if (itemsError) throw itemsError

      const itemsWithSku = itemsData?.map(item => ({
        ...item,
        sku: item.productos?.sku || '-'
      })) || []

      setItems(itemsWithSku)
    } catch (error) {
      console.error('Error loading cotizacion:', error)
      message.error('Error al cargar cotización')
      router.push('/cotizaciones')
    } finally {
      setLoading(false)
    }
  }

  // Cargar inventario del almacén
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

  // Cargar inventario cuando se carga la cotización
  useEffect(() => {
    if (cotizacion?.almacen_id) {
      loadInventarioAlmacen(cotizacion.almacen_id)
    }
  }, [cotizacion?.almacen_id])

  const handleConvertirAFactura = () => {
    Modal.confirm({
      title: '¿Convertir a Factura?',
      content: (
        <div>
          <p>Esta acción creará una factura a partir de la cotización <strong>{cotizacion?.folio}</strong>.</p>
          <p style={{ marginTop: 8 }}>
            <strong>Automáticamente se:</strong>
          </p>
          <ul style={{ marginTop: 4 }}>
            <li>Creará la factura con los mismos items</li>
            <li>Descontará el inventario del almacén</li>
            <li>Actualizará el saldo del cliente</li>
          </ul>
          <p style={{ marginTop: 8, color: '#faad14' }}>
            Esta acción no se puede deshacer.
          </p>
        </div>
      ),
      okText: 'Sí, Convertir',
      cancelText: 'Cancelar',
      okType: 'primary',
      onOk: async () => {
        setConverting(true)
        const supabase = getSupabaseClient()

        try {
          const { data, error } = await supabase
            .schema('erp')
            .rpc('cotizacion_a_factura', { p_cotizacion_id: id })

          if (error) throw error

          const facturaId = data as string

          message.success({
            content: 'Factura creada exitosamente',
            duration: 3,
          })

          // Redirect to the new invoice
          router.push(`/facturas/${facturaId}`)
        } catch (error: any) {
          console.error('Error converting to factura:', error)
          message.error(error.message || 'Error al convertir a factura')
          setConverting(false)
        }
      },
    })
  }

  const handleDescargarPDF = () => {
    if (!cotizacion) return

    // Usar la moneda y tipo de cambio guardados en la cotizacion
    const opciones: OpcionesMoneda = {
      moneda: cotizacion.moneda,
      tipoCambio: cotizacion.tipo_cambio || undefined
    }

    // Agregar fecha_vencimiento calculada para el PDF
    const cotizacionConVigencia = {
      ...cotizacion,
      fecha_vencimiento: calcularFechaVencimiento(cotizacion.fecha, cotizacion.vigencia_dias),
      vendedor_nombre: cotizacion.vendedor_nombre
    }

    generarPDFCotizacion(cotizacionConVigencia, items, opciones)
    message.success(`PDF descargado en ${cotizacion.moneda}`)
  }

  const handleConvertirOrdenVenta = () => {
    Modal.confirm({
      title: '¿Convertir a Orden de Venta?',
      content: (
        <div>
          <p>Esta acción convertirá la cotización <strong>{cotizacion?.folio}</strong> en una Orden de Venta.</p>
          <p style={{ marginTop: 8 }}>
            <strong>Automáticamente se:</strong>
          </p>
          <ul style={{ marginTop: 4 }}>
            <li>Descontará el inventario del almacén</li>
            <li>Reservará los productos para esta orden</li>
          </ul>
        </div>
      ),
      okText: 'Sí, Convertir',
      cancelText: 'Cancelar',
      okType: 'primary',
      onOk: async () => {
        setConverting(true)
        const supabase = getSupabaseClient()

        try {
          const { error } = await supabase
            .schema('erp')
            .rpc('cotizacion_a_orden_venta', { p_cotizacion_id: id })

          if (error) throw error

          message.success('Convertido a Orden de Venta')
          loadCotizacion()
        } catch (error: any) {
          console.error('Error converting to orden de venta:', error)
          message.error(error.message || 'Error al convertir a orden de venta')
        } finally {
          setConverting(false)
        }
      },
    })
  }

  const handleCancelarOrden = () => {
    Modal.confirm({
      title: '¿Cancelar Orden de Venta?',
      content: (
        <div>
          <p>Esta acción cancelará la orden <strong>{cotizacion?.folio}</strong>.</p>
          <p style={{ marginTop: 8, color: '#52c41a' }}>
            <strong>El inventario será restaurado automáticamente.</strong>
          </p>
        </div>
      ),
      okText: 'Sí, Cancelar Orden',
      cancelText: 'No',
      okType: 'danger',
      onOk: async () => {
        setConverting(true)
        const supabase = getSupabaseClient()

        try {
          const { error } = await supabase
            .schema('erp')
            .rpc('cancelar_orden_venta', { p_cotizacion_id: id })

          if (error) throw error

          message.success('Orden cancelada, inventario restaurado')
          loadCotizacion()
        } catch (error: any) {
          console.error('Error canceling order:', error)
          message.error(error.message || 'Error al cancelar orden')
        } finally {
          setConverting(false)
        }
      },
    })
  }

  // Función para actualizar descripción inline
  const handleUpdateDescripcion = async (itemId: string, nuevaDescripcion: string) => {
    setSavingItem(itemId)
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .schema('erp')
      .from('cotizacion_items')
      .update({ descripcion: nuevaDescripcion })
      .eq('id', itemId)

    if (error) {
      message.error('Error al guardar la descripción')
    } else {
      setItems(items.map(i => i.id === itemId ? { ...i, descripcion: nuevaDescripcion } : i))
      message.success('Descripción actualizada')
    }
    setSavingItem(null)
    setEditingItems(prev => {
      const newMap = new Map(prev)
      newMap.delete(itemId)
      return newMap
    })
  }

  const columns = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 100,
    },
    {
      title: 'Descripción',
      dataIndex: 'descripcion',
      key: 'descripcion',
      render: (val: string, record: CotizacionItem) => {
        const esEditable = ['propuesta', 'orden_venta'].includes(cotizacion?.status || '')
        const editing = editingItems.has(record.id)

        if (!esEditable) return val

        if (editing) {
          return (
            <Space.Compact style={{ width: '100%' }}>
              <Input.TextArea
                value={editingItems.get(record.id)}
                onChange={(e) => setEditingItems(prev => new Map(prev).set(record.id, e.target.value))}
                autoSize={{ minRows: 1, maxRows: 3 }}
                size="small"
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                size="small"
                loading={savingItem === record.id}
                onClick={() => handleUpdateDescripcion(record.id, editingItems.get(record.id) || '')}
              >
                ✓
              </Button>
              <Button
                size="small"
                onClick={() => setEditingItems(prev => {
                  const newMap = new Map(prev)
                  newMap.delete(record.id)
                  return newMap
                })}
              >
                ✕
              </Button>
            </Space.Compact>
          )
        }

        return (
          <Text
            style={{ cursor: 'pointer' }}
            onClick={() => setEditingItems(prev => new Map(prev).set(record.id, val))}
          >
            {val} <EditOutlined style={{ fontSize: 12, opacity: 0.5 }} />
          </Text>
        )
      }
    },
    {
      title: 'Cantidad',
      dataIndex: 'cantidad',
      key: 'cantidad',
      width: 100,
      align: 'right' as const,
    },
    {
      title: 'Precio Unit.',
      dataIndex: 'precio_unitario',
      key: 'precio_unitario',
      width: 130,
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
    {
      title: 'Desc. %',
      dataIndex: 'descuento_porcentaje',
      key: 'descuento_porcentaje',
      width: 80,
      align: 'right' as const,
      render: (val: number) => val > 0 ? `${val}%` : '-',
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 130,
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!cotizacion) {
    return null
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/cotizaciones')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {cotizacion.folio.startsWith('OV-') ? 'Orden de Venta' : 'Cotización'} {cotizacion.folio}
          </Title>
          <Tag color={statusColors[cotizacion.status]} style={{ fontSize: 14, padding: '4px 12px' }}>
            {statusLabels[cotizacion.status] || cotizacion.status}
          </Tag>
          <Tag color={cotizacion.moneda === 'USD' ? 'green' : 'blue'} style={{ fontSize: 14, padding: '4px 12px' }}>
            <DollarOutlined /> {cotizacion.moneda}
          </Tag>
          {/* Tag Caducada - solo visual, no bloquea acciones */}
          {esCaducada(cotizacion.fecha, cotizacion.vigencia_dias) &&
           cotizacion.status !== 'factura' &&
           cotizacion.status !== 'cancelada' && (
            <Tag color="warning" icon={<ClockCircleOutlined />} style={{ fontSize: 14, padding: '4px 12px' }}>
              Caducada
            </Tag>
          )}
        </Space>

        <Space wrap>
          <Button
            icon={<FilePdfOutlined />}
            onClick={handleDescargarPDF}
            size="large"
          >
            Descargar PDF
          </Button>

          {/* Botones para status PROPUESTA */}
          {cotizacion.status === 'propuesta' && (
            <>
              <Button
                icon={<EditOutlined />}
                onClick={() => router.push(`/cotizaciones/${id}/editar`)}
                size="large"
              >
                Editar
              </Button>
              <Button
                type="primary"
                icon={<ShoppingCartOutlined />}
                onClick={handleConvertirOrdenVenta}
                loading={converting}
                size="large"
              >
                Convertir a Orden de Venta
              </Button>
            </>
          )}

          {/* Botones para status ORDEN_VENTA */}
          {cotizacion.status === 'orden_venta' && (
            <>
              <Button
                icon={<EditOutlined />}
                onClick={() => router.push(`/cotizaciones/${id}/editar`)}
                size="large"
              >
                Editar
              </Button>
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={handleConvertirAFactura}
                loading={converting}
                size="large"
              >
                Convertir a Factura
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={handleCancelarOrden}
                loading={converting}
                size="large"
              >
                Cancelar
              </Button>
            </>
          )}

          {/* Status FACTURA */}
          {cotizacion.status === 'factura' && (
            <Tag icon={<CheckCircleOutlined />} color="purple" style={{ fontSize: 14, padding: '4px 12px' }}>
              Ya facturada
            </Tag>
          )}

          {/* Status CANCELADA */}
          {cotizacion.status === 'cancelada' && (
            <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 14, padding: '4px 12px' }}>
              Cancelada
            </Tag>
          )}
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title={`Datos de la ${cotizacion.folio.startsWith('OV-') ? 'Orden de Venta' : 'Cotización'}`} style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="Folio">{cotizacion.folio}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{formatDate(cotizacion.fecha)}</Descriptions.Item>
              <Descriptions.Item label="Cliente">{cotizacion.cliente_nombre}</Descriptions.Item>
              <Descriptions.Item label="RFC">{cotizacion.cliente_rfc || '-'}</Descriptions.Item>
              <Descriptions.Item label="Almacén">{cotizacion.almacen_nombre}</Descriptions.Item>
              <Descriptions.Item label="Vigencia">
                {formatDate(calcularFechaVencimiento(cotizacion.fecha, cotizacion.vigencia_dias))}
                {esCaducada(cotizacion.fecha, cotizacion.vigencia_dias) &&
                 cotizacion.status !== 'factura' &&
                 cotizacion.status !== 'cancelada' && (
                  <Tag color="warning" style={{ marginLeft: 8 }}>Caducada</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Moneda">
                <Tag color={cotizacion.moneda === 'USD' ? 'green' : 'blue'}>
                  {cotizacion.moneda}
                </Tag>
                {cotizacion.moneda === 'MXN' && cotizacion.tipo_cambio && (
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    T/C: {cotizacion.tipo_cambio}
                  </Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Vendedor">{cotizacion.vendedor_nombre || '-'}</Descriptions.Item>
            </Descriptions>
            {cotizacion.notas && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Text type="secondary">Notas: {cotizacion.notas}</Text>
              </>
            )}
          </Card>

          {/* Secciones colapsables de Envío, Facturación y Pago */}
          <Collapse
            defaultActiveKey={cotizacion.status === 'orden_venta' ? ['envio', 'cfdi', 'pago'] : []}
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
                  <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                    <Descriptions.Item label="Dirección" span={2}>{cotizacion.envio_direccion || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Ciudad">{cotizacion.envio_ciudad || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Estado">{cotizacion.envio_estado || '-'}</Descriptions.Item>
                    <Descriptions.Item label="C.P.">{cotizacion.envio_codigo_postal || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Contacto">{cotizacion.envio_contacto || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Teléfono">{cotizacion.envio_telefono || '-'}</Descriptions.Item>
                  </Descriptions>
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
                  <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                    <Descriptions.Item label="RFC">{cotizacion.cfdi_rfc || cotizacion.cliente_rfc || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Razón Social">{cotizacion.cfdi_razon_social || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Régimen Fiscal">{getRegimenFiscalLabel(cotizacion.cfdi_regimen_fiscal)}</Descriptions.Item>
                    <Descriptions.Item label="Uso CFDI">{getUsoCfdiLabel(cotizacion.cfdi_uso_cfdi)}</Descriptions.Item>
                    <Descriptions.Item label="C.P. Fiscal">{cotizacion.cfdi_codigo_postal || '-'}</Descriptions.Item>
                  </Descriptions>
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
                  <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                    <Descriptions.Item label="Forma de Pago">{getFormaPagoLabel(cotizacion.forma_pago)}</Descriptions.Item>
                    <Descriptions.Item label="Método de Pago">{getMetodoPagoLabel(cotizacion.metodo_pago)}</Descriptions.Item>
                    <Descriptions.Item label="Días de Crédito">{cotizacion.cliente_dias_credito || 0}</Descriptions.Item>
                    <Descriptions.Item label="Condiciones" span={2}>{cotizacion.condiciones_pago || '-'}</Descriptions.Item>
                  </Descriptions>
                ),
              },
            ]}
          />

          {/* Alerta de stock insuficiente - solo en propuesta */}
          {mostrarAlertaStock && cotizacion.status === 'propuesta' && items.length > 0 && (() => {
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
                message="Productos sin stock suficiente"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {productosSinStock.map(p => {
                      const stock = inventarioMap.get(p.producto_id) ?? 0
                      return (
                        <li key={p.id}>
                          <strong>{p.sku}</strong>: Stock {stock}, Solicitado {p.cantidad}
                        </li>
                      )
                    })}
                  </ul>
                }
                style={{ marginBottom: 16 }}
              />
            )
          })()}

          <Card title="Productos">
            <Table
              dataSource={items}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5} align="right">
                      <Text strong>Subtotal:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong>{formatMoney(cotizacion.subtotal)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  {cotizacion.descuento_monto > 0 && (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={5} align="right">
                        <Text type="success">Descuento ({cotizacion.descuento_porcentaje}%):</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text type="success">-{formatMoney(cotizacion.descuento_monto)}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5} align="right">
                      <Text>IVA (16%):</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text>{formatMoney(cotizacion.iva)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5} align="right">
                      <Title level={4} style={{ margin: 0 }}>TOTAL:</Title>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                        {formatMoney(cotizacion.total)}
                      </Title>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Resumen" style={{ position: 'sticky', top: 88 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Moneda:</Text>
                <Text strong style={{ color: cotizacion.moneda === 'USD' ? '#52c41a' : '#1890ff' }}>
                  <DollarOutlined /> {cotizacion.moneda}
                </Text>
              </div>
              {cotizacion.moneda === 'MXN' && cotizacion.tipo_cambio && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">T/C:</Text>
                  <Text>{cotizacion.tipo_cambio} MXN/USD</Text>
                </div>
              )}
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Subtotal:</Text>
                <Text strong>{formatMoney(cotizacion.subtotal)}</Text>
              </div>
              {cotizacion.descuento_monto > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#52c41a' }}>
                  <Text>Descuento ({cotizacion.descuento_porcentaje}%):</Text>
                  <Text>-{formatMoney(cotizacion.descuento_monto)}</Text>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>IVA (16%):</Text>
                <Text>{formatMoney(cotizacion.iva)}</Text>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={4} style={{ margin: 0 }}>Total:</Title>
                <Title level={4} style={{ margin: 0, color: '#1890ff' }}>{formatMoney(cotizacion.total)}</Title>
              </div>

              {/* Acciones según status */}
              {cotizacion.status === 'propuesta' && (
                <>
                  <Divider />
                  <Button
                    type="primary"
                    block
                    size="large"
                    icon={<ShoppingCartOutlined />}
                    onClick={handleConvertirOrdenVenta}
                    loading={converting}
                  >
                    Convertir a Orden de Venta
                  </Button>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Al convertir, se descontará el inventario automáticamente.
                  </Text>
                </>
              )}
              {cotizacion.status === 'orden_venta' && (
                <>
                  <Divider />
                  <Button
                    type="primary"
                    block
                    size="large"
                    icon={<FileTextOutlined />}
                    onClick={handleConvertirAFactura}
                    loading={converting}
                  >
                    Convertir a Factura
                  </Button>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    El inventario ya fue descontado. Solo se creará la factura.
                  </Text>
                </>
              )}
            </Space>
          </Card>

          {/* Historial de movimientos */}
          <Card
            title={<><HistoryOutlined /> Historial</>}
            style={{ marginTop: 16 }}
            size="small"
          >
            <HistorialTimeline documentoTipo="cotizacion" documentoId={cotizacion.id} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
