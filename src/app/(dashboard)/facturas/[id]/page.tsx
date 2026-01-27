'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Table, Button, Space, Typography, Tag, Descriptions, Divider, message, Spin, Row, Col, Modal, Select, InputNumber, Form, Alert
} from 'antd'
import {
  ArrowLeftOutlined, CheckCircleOutlined, FilePdfOutlined, FileTextOutlined,
  SafetyCertificateOutlined, CloseCircleOutlined, DownloadOutlined, ExclamationCircleOutlined, EditOutlined
} from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/utils/format'
import { generarPDFFactura, type OpcionesMoneda } from '@/lib/utils/pdf'
import { type CodigoMoneda } from '@/lib/config/moneda'

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
  cliente_razon_social: string | null
  almacen_id: string
  almacen_nombre: string
  cotizacion_folio: string | null
  // Campos CFDI
  uuid_cfdi: string | null
  status_sat: string | null
  fecha_timbrado: string | null
  xml_cfdi: string | null
  // Campos moneda
  moneda: CodigoMoneda
  tipo_cambio: number | null
  // Vendedor
  vendedor_nombre: string | null
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

const statusSatColors: Record<string, string> = {
  pendiente: 'default',
  timbrado: 'success',
  cancelado: 'error',
}

const statusSatLabels: Record<string, string> = {
  pendiente: 'Sin timbrar',
  timbrado: 'Timbrado',
  cancelado: 'Cancelado',
}

const motivosCancelacion = [
  { value: '01', label: '01 - Comprobante emitido con errores con relacion' },
  { value: '02', label: '02 - Comprobante emitido con errores sin relacion' },
  { value: '03', label: '03 - No se llevo a cabo la operacion' },
  { value: '04', label: '04 - Operacion nominativa en factura global' },
]

export default function FacturaDetallePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [factura, setFactura] = useState<FacturaDetalle | null>(null)
  const [items, setItems] = useState<FacturaItem[]>([])

  // Estado para timbrado CFDI
  const [timbrandoLoading, setTimbrandoLoading] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [motivoCancelacion, setMotivoCancelacion] = useState<string>('02')
  const [uuidSustitucion, setUuidSustitucion] = useState<string>('')
  const [cambioEstadoLoading, setCambioEstadoLoading] = useState(false)

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
      // Load factura from table (not view) to get CFDI fields
      const { data: facData, error: facError } = await supabase
        .schema('erp')
        .from('facturas')
        .select(`
          id,
          folio,
          fecha,
          fecha_vencimiento,
          status,
          subtotal,
          descuento_monto,
          iva,
          total,
          saldo,
          notas,
          cliente_id,
          cliente_rfc,
          cliente_razon_social,
          almacen_id,
          cotizacion_id,
          uuid_cfdi,
          status_sat,
          fecha_timbrado,
          xml_cfdi,
          moneda,
          tipo_cambio,
          vendedor_nombre,
          clientes:cliente_id (nombre_comercial, razon_social),
          almacenes:almacen_id (nombre),
          cotizaciones:cotizacion_id (folio)
        `)
        .eq('id', id)
        .single()

      if (facError) throw facError

      // Transform data to expected format
      const facturaData: FacturaDetalle = {
        id: facData.id,
        folio: facData.folio,
        fecha: facData.fecha,
        fecha_vencimiento: facData.fecha_vencimiento || '',
        status: facData.status,
        subtotal: facData.subtotal,
        descuento_porcentaje: 0, // Calculate if needed
        descuento_monto: facData.descuento_monto,
        iva: facData.iva,
        total: facData.total,
        saldo: facData.saldo,
        dias_vencida: 0, // Calculate if needed
        notas: facData.notas,
        cliente_id: facData.cliente_id,
        cliente_nombre: Array.isArray(facData.clientes)
          ? (facData.clientes[0] as { nombre_comercial: string; razon_social: string } | undefined)?.nombre_comercial
            || (facData.clientes[0] as { nombre_comercial: string; razon_social: string } | undefined)?.razon_social
            || 'Sin cliente'
          : (facData.clientes as { nombre_comercial: string; razon_social: string } | null)?.nombre_comercial
            || (facData.clientes as { nombre_comercial: string; razon_social: string } | null)?.razon_social
            || 'Sin cliente',
        cliente_rfc: facData.cliente_rfc,
        cliente_razon_social: facData.cliente_razon_social,
        almacen_id: facData.almacen_id,
        almacen_nombre: Array.isArray(facData.almacenes)
          ? (facData.almacenes[0] as { nombre: string } | undefined)?.nombre || 'Sin almacen'
          : (facData.almacenes as { nombre: string } | null)?.nombre || 'Sin almacen',
        cotizacion_folio: Array.isArray(facData.cotizaciones)
          ? (facData.cotizaciones[0] as { folio: string } | undefined)?.folio || null
          : (facData.cotizaciones as { folio: string } | null)?.folio || null,
        uuid_cfdi: facData.uuid_cfdi,
        status_sat: facData.status_sat || 'pendiente',
        fecha_timbrado: facData.fecha_timbrado,
        xml_cfdi: facData.xml_cfdi,
        moneda: (facData.moneda as CodigoMoneda) || 'USD',
        tipo_cambio: facData.tipo_cambio,
        vendedor_nombre: facData.vendedor_nombre,
      }

      // Calculate dias_vencida
      if (facturaData.fecha_vencimiento) {
        const hoy = new Date()
        const vencimiento = new Date(facturaData.fecha_vencimiento)
        const diff = Math.floor((hoy.getTime() - vencimiento.getTime()) / (1000 * 60 * 60 * 24))
        facturaData.dias_vencida = diff > 0 ? diff : 0
      }

      setFactura(facturaData)

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
        sku: (item.productos as { sku: string } | null)?.sku || '-'
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

  const handleDescargarPDF = () => {
    if (!factura) return

    const opciones: OpcionesMoneda = {
      moneda: factura.moneda || 'USD',
      tipoCambio: factura.moneda === 'MXN' ? (factura.tipo_cambio || undefined) : undefined
    }

    // Incluir vendedor_nombre en los datos del PDF
    const facturaConVendedor = {
      ...factura,
      vendedor_nombre: factura.vendedor_nombre
    }

    generarPDFFactura(facturaConVendedor, items, opciones)
    message.success('PDF descargado')
  }

  // === FUNCION CAMBIAR ESTADO ===

  const handleCambiarEstado = async (nuevoEstado: 'pendiente' | 'pagada' | 'cancelada') => {
    if (!factura) return

    setCambioEstadoLoading(true)
    const supabase = getSupabaseClient()

    try {
      // Calcular nuevo saldo segun estado
      let nuevoSaldo = factura.total
      let montoPagado = 0

      if (nuevoEstado === 'pagada') {
        nuevoSaldo = 0
        montoPagado = factura.total
      } else if (nuevoEstado === 'cancelada') {
        nuevoSaldo = 0
        montoPagado = 0
      }

      const diferenciaSaldo = factura.saldo - nuevoSaldo

      // Actualizar factura
      const { error: updateError } = await supabase
        .schema('erp')
        .from('facturas')
        .update({
          status: nuevoEstado,
          saldo: nuevoSaldo,
          monto_pagado: montoPagado,
          updated_at: new Date().toISOString(),
        })
        .eq('id', factura.id)

      if (updateError) throw updateError

      // Actualizar saldo del cliente
      if (factura.cliente_id && diferenciaSaldo !== 0) {
        const { data: clienteData } = await supabase
          .schema('erp')
          .from('clientes')
          .select('saldo_pendiente')
          .eq('id', factura.cliente_id)
          .single()

        if (clienteData) {
          const nuevoSaldoCliente = Math.max(0, (clienteData.saldo_pendiente || 0) - diferenciaSaldo)
          await supabase
            .schema('erp')
            .from('clientes')
            .update({ saldo_pendiente: nuevoSaldoCliente })
            .eq('id', factura.cliente_id)
        }
      }

      const mensajes: Record<string, string> = {
        pagada: 'Factura marcada como pagada',
        pendiente: 'Factura reabierta',
        cancelada: 'Factura cancelada',
      }
      message.success(mensajes[nuevoEstado])
      loadFactura()
    } catch (error) {
      console.error('Error al cambiar estado:', error)
      message.error('Error al cambiar estado de la factura')
    } finally {
      setCambioEstadoLoading(false)
    }
  }

  // === FUNCIONES CFDI ===

  const handleTimbrar = async () => {
    if (!factura) return

    // Validar datos minimos
    if (!factura.cliente_rfc) {
      message.error('El cliente no tiene RFC configurado')
      return
    }

    Modal.confirm({
      title: 'Confirmar Timbrado CFDI',
      icon: <SafetyCertificateOutlined />,
      content: (
        <div>
          <p>Se va a timbrar la factura <strong>{factura.folio}</strong> ante el SAT.</p>
          <p>Esta operacion no se puede deshacer facilmente.</p>
          <Alert
            type="info"
            message="Ambiente Demo"
            description="Esta factura se timbrara en el ambiente de pruebas de Finkok. No tiene validez fiscal real."
            showIcon
            style={{ marginTop: 16 }}
          />
        </div>
      ),
      okText: 'Timbrar',
      cancelText: 'Cancelar',
      onOk: async () => {
        setTimbrandoLoading(true)
        try {
          const response = await fetch('/api/cfdi/timbrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ factura_id: factura.id }),
          })

          const result = await response.json()

          if (result.success) {
            message.success(`CFDI timbrado exitosamente. UUID: ${result.uuid}`)
            loadFactura() // Recargar datos
          } else {
            message.error(result.error || 'Error al timbrar')
            if (result.detalles) {
              Modal.error({
                title: 'Errores de validacion',
                content: (
                  <ul>
                    {result.detalles.map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                ),
              })
            }
          }
        } catch (error) {
          console.error('Error al timbrar:', error)
          message.error('Error de conexion al timbrar')
        } finally {
          setTimbrandoLoading(false)
        }
      },
    })
  }

  const handleCancelar = async () => {
    if (!factura || !factura.uuid_cfdi) return

    // Validar motivo 01 requiere UUID sustitucion
    if (motivoCancelacion === '01' && !uuidSustitucion) {
      message.error('El motivo 01 requiere el UUID de la factura que sustituye')
      return
    }

    setCancelLoading(true)
    try {
      const response = await fetch('/api/cfdi/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factura_id: factura.id,
          motivo: motivoCancelacion,
          uuid_sustitucion: motivoCancelacion === '01' ? uuidSustitucion : undefined,
        }),
      })

      const result = await response.json()

      if (result.success) {
        message.success('CFDI cancelado exitosamente')
        setCancelModalOpen(false)
        loadFactura()
      } else {
        message.error(result.error || 'Error al cancelar')
      }
    } catch (error) {
      console.error('Error al cancelar:', error)
      message.error('Error de conexion al cancelar')
    } finally {
      setCancelLoading(false)
    }
  }

  const handleDescargarXML = async () => {
    if (!factura) return

    try {
      const response = await fetch('/api/cfdi/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factura_id: factura.id }),
      })

      const result = await response.json()

      if (result.success && result.xml) {
        // Crear archivo y descargar
        const blob = new Blob([result.xml], { type: 'application/xml' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${factura.folio}_${result.uuid || 'cfdi'}.xml`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        message.success('XML descargado')
      } else {
        message.error(result.error || 'No se encontro el XML')
      }
    } catch (error) {
      console.error('Error al descargar XML:', error)
      message.error('Error al descargar XML')
    }
  }

  const columns = [
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

  const statusSat = factura.status_sat || 'pendiente'

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
            onClick={handleDescargarPDF}
            size="large"
          >
            Descargar PDF
          </Button>
          {factura.status_sat !== 'timbrado' && (
            <Button
              icon={<EditOutlined />}
              onClick={() => router.push(`/facturas/${id}/editar`)}
              size="large"
            >
              Editar
            </Button>
          )}
          {factura.status === 'pagada' && (
            <Tag icon={<CheckCircleOutlined />} color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
              Pagada
            </Tag>
          )}
          {factura.dias_vencida > 0 && factura.status !== 'pagada' && (
            <Tag color="red" style={{ fontSize: 14, padding: '4px 12px' }}>
              {factura.dias_vencida} dias vencida
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
              <Descriptions.Item label="Almacen">{factura.almacen_nombre}</Descriptions.Item>
              <Descriptions.Item label="Vencimiento">{formatDate(factura.fecha_vencimiento)}</Descriptions.Item>
              <Descriptions.Item label="Vendedor">{factura.vendedor_nombre || '-'}</Descriptions.Item>
              {factura.cotizacion_folio && (
                <Descriptions.Item label="Cotizacion origen">
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
          {/* Card de Timbrado CFDI */}
          <Card
            title={
              <Space>
                <FileTextOutlined />
                Timbrado CFDI
              </Space>
            }
            style={{ marginBottom: 16 }}
            extra={
              <Tag color={statusSatColors[statusSat]}>
                {statusSatLabels[statusSat]}
              </Tag>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* Mostrar UUID si esta timbrado */}
              {factura.uuid_cfdi && (
                <div>
                  <Text type="secondary">UUID:</Text>
                  <div style={{ wordBreak: 'break-all' }}>
                    <Text code copyable style={{ fontSize: 11 }}>
                      {factura.uuid_cfdi}
                    </Text>
                  </div>
                </div>
              )}

              {/* Mostrar fecha de timbrado */}
              {factura.fecha_timbrado && (
                <div>
                  <Text type="secondary">Fecha de timbrado:</Text>
                  <div>
                    <Text>{new Date(factura.fecha_timbrado).toLocaleString('es-MX')}</Text>
                  </div>
                </div>
              )}

              <Divider style={{ margin: '8px 0' }} />

              {/* Botones segun estado */}
              {statusSat === 'pendiente' && factura.status !== 'cancelada' && (
                <Button
                  type="primary"
                  icon={<SafetyCertificateOutlined />}
                  block
                  size="large"
                  loading={timbrandoLoading}
                  onClick={handleTimbrar}
                >
                  Timbrar CFDI
                </Button>
              )}

              {statusSat === 'timbrado' && (
                <>
                  <Button
                    icon={<DownloadOutlined />}
                    block
                    onClick={handleDescargarXML}
                  >
                    Descargar XML
                  </Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    block
                    onClick={() => setCancelModalOpen(true)}
                  >
                    Cancelar CFDI
                  </Button>
                </>
              )}

              {statusSat === 'cancelado' && (
                <Alert
                  type="error"
                  message="CFDI Cancelado"
                  description="Este comprobante fue cancelado ante el SAT"
                  showIcon
                />
              )}

              {/* Aviso de ambiente demo */}
              {statusSat === 'pendiente' && (
                <Alert
                  type="info"
                  message="Ambiente de Pruebas"
                  description="El timbrado se realizara en el ambiente demo de Finkok"
                  showIcon
                  style={{ fontSize: 12 }}
                />
              )}
            </Space>
          </Card>

          {/* Card de Pago */}
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

              {factura.saldo > 0 && factura.status !== 'cancelada' && factura.status !== 'pagada' && (
                <>
                  <Divider />
                  <Button
                    type="primary"
                    block
                    size="large"
                    loading={cambioEstadoLoading}
                    onClick={() => handleCambiarEstado('pagada')}
                  >
                    Marcar como Pagada
                  </Button>
                </>
              )}

              {factura.status === 'pagada' && (
                <>
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                    <div style={{ marginTop: 8 }}>
                      <Text type="success" strong>Factura Pagada</Text>
                    </div>
                  </div>
                  <Button
                    block
                    loading={cambioEstadoLoading}
                    onClick={() => handleCambiarEstado('pendiente')}
                  >
                    Reabrir Factura
                  </Button>
                </>
              )}

              {factura.status === 'cancelada' && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <CloseCircleOutlined style={{ fontSize: 48, color: '#cf1322' }} />
                  <div style={{ marginTop: 8 }}>
                    <Text type="danger" strong>Factura Cancelada</Text>
                  </div>
                </div>
              )}

              {factura.status !== 'cancelada' && factura.status_sat !== 'timbrado' && (
                <>
                  <Divider />
                  <Button
                    danger
                    block
                    loading={cambioEstadoLoading}
                    onClick={() => handleCambiarEstado('cancelada')}
                  >
                    Cancelar Factura
                  </Button>
                </>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Modal para cancelar CFDI */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            Cancelar CFDI
          </Space>
        }
        open={cancelModalOpen}
        onCancel={() => setCancelModalOpen(false)}
        onOk={handleCancelar}
        okText="Cancelar CFDI"
        okButtonProps={{ danger: true, loading: cancelLoading }}
        cancelText="Cerrar"
        destroyOnClose
      >
        <Alert
          type="warning"
          message="Atencion"
          description="La cancelacion de un CFDI es una operacion ante el SAT. Una vez cancelado, puede requerir aceptacion del receptor."
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form layout="vertical">
          <Form.Item label="Motivo de Cancelacion" required>
            <Select
              value={motivoCancelacion}
              onChange={(value) => setMotivoCancelacion(value)}
              options={motivosCancelacion}
            />
          </Form.Item>

          {motivoCancelacion === '01' && (
            <Form.Item
              label="UUID de la Factura que Sustituye"
              required
              help="Ingresa el UUID de la nueva factura que reemplaza a esta"
            >
              <InputNumber
                value={uuidSustitucion}
                onChange={(value) => setUuidSustitucion(String(value || ''))}
                style={{ width: '100%' }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
