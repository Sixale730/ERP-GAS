'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Table, Button, Space, Typography, Tag, Descriptions, Divider, message, Modal, Spin, Row, Col, Select, InputNumber, Form
} from 'antd'
import { ArrowLeftOutlined, FileTextOutlined, CheckCircleOutlined, FilePdfOutlined, EditOutlined, CloseCircleOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/utils/format'
import { generarPDFCotizacion, type OpcionesMoneda } from '@/lib/utils/pdf'
import { TIPO_CAMBIO_DEFAULT, type CodigoMoneda } from '@/lib/config/moneda'

const { Title, Text } = Typography

interface CotizacionDetalle {
  id: string
  folio: string
  fecha: string
  fecha_vencimiento: string
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

  // Estado para modal de PDF
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [pdfMoneda, setPdfMoneda] = useState<CodigoMoneda>('USD')
  const [pdfTipoCambio, setPdfTipoCambio] = useState(TIPO_CAMBIO_DEFAULT)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (id) {
      loadCotizacion()
    }
  }, [id])

  const loadCotizacion = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // Load cotizacion from view
      const { data: cotData, error: cotError } = await supabase
        .schema('erp')
        .from('v_cotizaciones')
        .select('*')
        .eq('id', id)
        .single()

      if (cotError) throw cotError
      setCotizacion(cotData)

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

  const handleAbrirModalPDF = () => {
    // Reiniciar estados al abrir
    setPdfMoneda('USD')
    setPdfTipoCambio(TIPO_CAMBIO_DEFAULT)
    setPdfModalOpen(true)
  }

  const handleDescargarPDF = () => {
    if (!cotizacion) return

    const opciones: OpcionesMoneda = {
      moneda: pdfMoneda,
      tipoCambio: pdfMoneda === 'MXN' ? pdfTipoCambio : undefined
    }

    generarPDFCotizacion(cotizacion, items, opciones)
    message.success('PDF descargado')
    setPdfModalOpen(false)
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
            Cotización {cotizacion.folio}
          </Title>
          <Tag color={statusColors[cotizacion.status]} style={{ fontSize: 14, padding: '4px 12px' }}>
            {statusLabels[cotizacion.status] || cotizacion.status}
          </Tag>
        </Space>

        <Space wrap>
          <Button
            icon={<FilePdfOutlined />}
            onClick={handleAbrirModalPDF}
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
          <Card title="Datos de la Cotización" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="Folio">{cotizacion.folio}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{formatDate(cotizacion.fecha)}</Descriptions.Item>
              <Descriptions.Item label="Cliente">{cotizacion.cliente_nombre}</Descriptions.Item>
              <Descriptions.Item label="RFC">{cotizacion.cliente_rfc || '-'}</Descriptions.Item>
              <Descriptions.Item label="Almacén">{cotizacion.almacen_nombre}</Descriptions.Item>
              <Descriptions.Item label="Vencimiento">{formatDate(cotizacion.fecha_vencimiento)}</Descriptions.Item>
            </Descriptions>
            {cotizacion.notas && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Text type="secondary">Notas: {cotizacion.notas}</Text>
              </>
            )}
          </Card>

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
        </Col>
      </Row>

      {/* Modal para seleccionar moneda del PDF */}
      <Modal
        title="Opciones de PDF"
        open={pdfModalOpen}
        onCancel={() => setPdfModalOpen(false)}
        onOk={handleDescargarPDF}
        okText="Descargar"
        cancelText="Cancelar"
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item label="Moneda">
            <Select
              value={pdfMoneda}
              onChange={(value) => setPdfMoneda(value)}
              options={[
                { value: 'USD', label: 'USD - Dólar Americano' },
                { value: 'MXN', label: 'MXN - Peso Mexicano' },
              ]}
            />
          </Form.Item>
          {pdfMoneda === 'MXN' && (
            <Form.Item label="Tipo de Cambio (MXN por 1 USD)">
              <InputNumber
                value={pdfTipoCambio}
                onChange={(value) => setPdfTipoCambio(value || TIPO_CAMBIO_DEFAULT)}
                min={1}
                max={100}
                step={0.01}
                precision={2}
                style={{ width: '100%' }}
                addonAfter="MXN"
              />
            </Form.Item>
          )}
          {pdfMoneda === 'MXN' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Los precios base están en USD. Se convertirán a MXN usando el tipo de cambio indicado.
            </Text>
          )}
        </Form>
      </Modal>
    </div>
  )
}
