'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Table, Button, Space, Typography, Tag, Descriptions, Divider, message, Modal, Spin, Row, Col
} from 'antd'
import { ArrowLeftOutlined, FileTextOutlined, CheckCircleOutlined, FilePdfOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/utils/format'
import { generarPDFCotizacion } from '@/lib/utils/pdf'

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
  borrador: 'default',
  enviada: 'processing',
  aceptada: 'success',
  rechazada: 'error',
  facturada: 'purple',
  vencida: 'warning',
}

const statusLabels: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  facturada: 'Facturada',
  vencida: 'Vencida',
}

export default function CotizacionDetallePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)
  const [cotizacion, setCotizacion] = useState<CotizacionDetalle | null>(null)
  const [items, setItems] = useState<CotizacionItem[]>([])

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

  const handleDescargarPDF = () => {
    if (!cotizacion) return
    generarPDFCotizacion(cotizacion, items)
    message.success('PDF descargado')
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

  const canConvert = ['enviada', 'aceptada'].includes(cotizacion.status)

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
            onClick={handleDescargarPDF}
            size="large"
          >
            Descargar PDF
          </Button>
          {canConvert && (
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={handleConvertirAFactura}
              loading={converting}
              size="large"
            >
              Convertir a Factura
            </Button>
          )}
          {cotizacion.status === 'facturada' && (
            <Tag icon={<CheckCircleOutlined />} color="purple" style={{ fontSize: 14, padding: '4px 12px' }}>
              Ya facturada
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

              {canConvert && (
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
                    Al convertir, se descontará el inventario automáticamente.
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
