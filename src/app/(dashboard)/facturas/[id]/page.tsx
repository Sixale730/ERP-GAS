'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Table, Button, Space, Typography, Tag, Descriptions, Divider, message, Spin, Row, Col, Modal, Select, InputNumber, Form
} from 'antd'
import { ArrowLeftOutlined, CheckCircleOutlined, FilePdfOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/utils/format'
import { generarPDFFactura, type OpcionesMoneda } from '@/lib/utils/pdf'
import { TIPO_CAMBIO_DEFAULT, type CodigoMoneda } from '@/lib/config/moneda'

const { Title, Text } = Typography

interface FacturaDetalle {
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
  saldo: number
  dias_vencida: number
  notas: string | null
  cliente_id: string
  cliente_nombre: string
  cliente_rfc: string | null
  almacen_id: string
  almacen_nombre: string
  cotizacion_folio: string | null
}

interface FacturaItem {
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
  pendiente: 'orange',
  parcial: 'blue',
  pagada: 'green',
  cancelada: 'red',
}

const statusLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial: 'Pago Parcial',
  pagada: 'Pagada',
  cancelada: 'Cancelada',
}

export default function FacturaDetallePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [factura, setFactura] = useState<FacturaDetalle | null>(null)
  const [items, setItems] = useState<FacturaItem[]>([])

  // Estado para modal de PDF
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [pdfMoneda, setPdfMoneda] = useState<CodigoMoneda>('USD')
  const [pdfTipoCambio, setPdfTipoCambio] = useState(TIPO_CAMBIO_DEFAULT)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (id) {
      loadFactura()
    }
  }, [id])

  const loadFactura = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // Load factura from view
      const { data: facData, error: facError } = await supabase
        .schema('erp')
        .from('v_facturas')
        .select('*')
        .eq('id', id)
        .single()

      if (facError) throw facError
      setFactura(facData)

      // Load items
      const { data: itemsData, error: itemsError } = await supabase
        .schema('erp')
        .from('factura_items')
        .select(`
          *,
          productos:producto_id (sku)
        `)
        .eq('factura_id', id)
        .order('created_at')

      if (itemsError) throw itemsError

      const itemsWithSku = itemsData?.map(item => ({
        ...item,
        sku: item.productos?.sku || '-'
      })) || []

      setItems(itemsWithSku)
    } catch (error) {
      console.error('Error loading factura:', error)
      message.error('Error al cargar factura')
      router.push('/facturas')
    } finally {
      setLoading(false)
    }
  }

  const handleAbrirModalPDF = () => {
    // Reiniciar estados al abrir
    setPdfMoneda('USD')
    setPdfTipoCambio(TIPO_CAMBIO_DEFAULT)
    setPdfModalOpen(true)
  }

  const handleDescargarPDF = () => {
    if (!factura) return

    const opciones: OpcionesMoneda = {
      moneda: pdfMoneda,
      tipoCambio: pdfMoneda === 'MXN' ? pdfTipoCambio : undefined
    }

    generarPDFFactura(factura, items, opciones)
    message.success('PDF descargado')
    setPdfModalOpen(false)
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

  if (!factura) {
    return null
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/facturas')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            Factura {factura.folio}
          </Title>
          <Tag color={statusColors[factura.status]} style={{ fontSize: 14, padding: '4px 12px' }}>
            {statusLabels[factura.status] || factura.status}
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
          {factura.status === 'pagada' && (
            <Tag icon={<CheckCircleOutlined />} color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
              Pagada
            </Tag>
          )}
          {factura.dias_vencida > 0 && factura.status !== 'pagada' && (
            <Tag color="red" style={{ fontSize: 14, padding: '4px 12px' }}>
              {factura.dias_vencida} días vencida
            </Tag>
          )}
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Datos de la Factura" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="Folio">{factura.folio}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{formatDate(factura.fecha)}</Descriptions.Item>
              <Descriptions.Item label="Cliente">{factura.cliente_nombre}</Descriptions.Item>
              <Descriptions.Item label="RFC">{factura.cliente_rfc || '-'}</Descriptions.Item>
              <Descriptions.Item label="Almacén">{factura.almacen_nombre}</Descriptions.Item>
              <Descriptions.Item label="Vencimiento">{formatDate(factura.fecha_vencimiento)}</Descriptions.Item>
              {factura.cotizacion_folio && (
                <Descriptions.Item label="Cotización origen" span={2}>
                  {factura.cotizacion_folio}
                </Descriptions.Item>
              )}
            </Descriptions>
            {factura.notas && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Text type="secondary">Notas: {factura.notas}</Text>
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
                      <Text strong>{formatMoney(factura.subtotal)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  {factura.descuento_monto > 0 && (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={5} align="right">
                        <Text type="success">Descuento ({factura.descuento_porcentaje}%):</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text type="success">-{formatMoney(factura.descuento_monto)}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5} align="right">
                      <Text>IVA (16%):</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text>{formatMoney(factura.iva)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5} align="right">
                      <Title level={4} style={{ margin: 0 }}>TOTAL:</Title>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                        {formatMoney(factura.total)}
                      </Title>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Resumen de Pago" style={{ position: 'sticky', top: 88 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Total Factura:</Text>
                <Text strong>{formatMoney(factura.total)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Pagado:</Text>
                <Text type="success">{formatMoney(factura.total - factura.saldo)}</Text>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={4} style={{ margin: 0 }}>Saldo:</Title>
                <Title level={4} style={{ margin: 0, color: factura.saldo > 0 ? '#cf1322' : '#3f8600' }}>
                  {formatMoney(factura.saldo)}
                </Title>
              </div>

              {factura.saldo > 0 && factura.status !== 'cancelada' && (
                <>
                  <Divider />
                  <Button type="primary" block size="large" disabled>
                    Registrar Pago (Próximamente)
                  </Button>
                </>
              )}

              {factura.status === 'pagada' && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                  <div style={{ marginTop: 8 }}>
                    <Text type="success" strong>Factura Pagada</Text>
                  </div>
                </div>
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
