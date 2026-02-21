'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Table, Button, Space, Typography, Tag, Descriptions, Divider, message, Spin,
  Row, Col, Modal, Select, InputNumber, Form, Alert, Input, DatePicker
} from 'antd'
import {
  ArrowLeftOutlined, CheckCircleOutlined, FilePdfOutlined, FileTextOutlined,
  SafetyCertificateOutlined, CloseCircleOutlined, DownloadOutlined,
  ExclamationCircleOutlined, EditOutlined, PlusOutlined, ReloadOutlined,
  DollarOutlined, EyeOutlined
} from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/utils/format'
import { generarPDFFactura, type OpcionesMoneda } from '@/lib/utils/pdf'
import { type CodigoMoneda } from '@/lib/config/moneda'
import TimbradoSuccessModal from '@/components/facturacion/TimbradoSuccessModal'
import TimbradoErrorModal from '@/components/facturacion/TimbradoErrorModal'
import CfdiPreview from '@/components/facturacion/CfdiPreview'
import dayjs from 'dayjs'

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
  error_timbrado: any | null
  // CFDI extra fields for PDF
  sello_cfdi: string | null
  sello_sat: string | null
  certificado_sat: string | null
  cadena_original: string | null
  // Campos moneda
  moneda: CodigoMoneda
  tipo_cambio: number | null
  // Vendedor
  vendedor_nombre: string | null
  // Receptor data for PDF
  cliente_regimen_fiscal: string | null
  cliente_uso_cfdi: string | null
  cliente_codigo_postal: string | null
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

interface PagoRecord {
  id: string
  folio: string
  monto: number
  fecha: string
  metodo_pago: string
  referencia: string | null
  notas: string | null
  uuid_complemento_pago: string | null
  created_at: string
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
  error: 'warning',
}

const statusSatLabels: Record<string, string> = {
  pendiente: 'Sin timbrar',
  timbrado: 'Timbrado',
  cancelado: 'Cancelado',
  error: 'Error',
}

const motivosCancelacion = [
  { value: '01', label: '01 - Comprobante emitido con errores con relacion' },
  { value: '02', label: '02 - Comprobante emitido con errores sin relacion' },
  { value: '03', label: '03 - No se llevo a cabo la operacion' },
  { value: '04', label: '04 - Operacion nominativa en factura global' },
]

const FORMAS_PAGO_OPTIONS = [
  { value: '01', label: '01 - Efectivo' },
  { value: '02', label: '02 - Cheque nominativo' },
  { value: '03', label: '03 - Transferencia electronica' },
  { value: '04', label: '04 - Tarjeta de credito' },
  { value: '28', label: '28 - Tarjeta de debito' },
  { value: '99', label: '99 - Por definir' },
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

  // Preview modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)

  // Timbrado result modals
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [successUuid, setSuccessUuid] = useState('')
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [timbradoError, setTimbradoError] = useState<any>(null)

  // Pagos
  const [pagos, setPagos] = useState<PagoRecord[]>([])
  const [pagosLoading, setPagosLoading] = useState(false)
  const [pagoModalOpen, setPagoModalOpen] = useState(false)
  const [pagoForm] = Form.useForm()
  const [registrandoPago, setRegistrandoPago] = useState(false)
  const [complementoLoading, setComplementoLoading] = useState<string | null>(null)

  const loadFactura = useCallback(async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      const { data: facData, error: facError } = await supabase
        .schema('erp')
        .from('facturas')
        .select(`
          id, folio, fecha, fecha_vencimiento, status,
          subtotal, descuento_monto, iva, total, saldo, notas,
          cliente_id, cliente_rfc, cliente_razon_social, cliente_regimen_fiscal, cliente_uso_cfdi,
          almacen_id, cotizacion_id,
          uuid_cfdi, status_sat, fecha_timbrado, xml_cfdi, error_timbrado,
          sello_cfdi, sello_sat, certificado_sat, cadena_original,
          moneda, tipo_cambio, vendedor_nombre,
          clientes:cliente_id (nombre_comercial, razon_social, codigo_postal_fiscal),
          almacenes:almacen_id (nombre),
          cotizaciones:cotizacion_id (folio)
        `)
        .eq('id', id)
        .single()

      if (facError) throw facError

      const clienteObj = Array.isArray(facData.clientes) ? facData.clientes[0] : facData.clientes
      const almacenObj = Array.isArray(facData.almacenes) ? facData.almacenes[0] : facData.almacenes
      const cotizacionObj = Array.isArray(facData.cotizaciones) ? facData.cotizaciones[0] : facData.cotizaciones

      const facturaData: FacturaDetalle = {
        id: facData.id,
        folio: facData.folio,
        fecha: facData.fecha,
        fecha_vencimiento: facData.fecha_vencimiento || '',
        status: facData.status,
        subtotal: facData.subtotal,
        descuento_porcentaje: 0,
        descuento_monto: facData.descuento_monto,
        iva: facData.iva,
        total: facData.total,
        saldo: facData.saldo,
        dias_vencida: 0,
        notas: facData.notas,
        cliente_id: facData.cliente_id,
        cliente_nombre: (clienteObj as any)?.nombre_comercial || (clienteObj as any)?.razon_social || 'Sin cliente',
        cliente_rfc: facData.cliente_rfc,
        cliente_razon_social: facData.cliente_razon_social,
        cliente_regimen_fiscal: facData.cliente_regimen_fiscal,
        cliente_uso_cfdi: facData.cliente_uso_cfdi,
        cliente_codigo_postal: (clienteObj as any)?.codigo_postal_fiscal || null,
        almacen_id: facData.almacen_id,
        almacen_nombre: (almacenObj as any)?.nombre || 'Sin almacen',
        cotizacion_folio: (cotizacionObj as any)?.folio || null,
        uuid_cfdi: facData.uuid_cfdi,
        status_sat: facData.status_sat || 'pendiente',
        fecha_timbrado: facData.fecha_timbrado,
        xml_cfdi: facData.xml_cfdi,
        error_timbrado: facData.error_timbrado,
        sello_cfdi: facData.sello_cfdi,
        sello_sat: facData.sello_sat,
        certificado_sat: facData.certificado_sat,
        cadena_original: facData.cadena_original,
        moneda: (facData.moneda as CodigoMoneda) || 'USD',
        tipo_cambio: facData.tipo_cambio,
        vendedor_nombre: facData.vendedor_nombre,
      }

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
        .select(`*, productos:producto_id (sku)`)
        .eq('factura_id', id)
        .order('created_at')

      if (itemsError) throw itemsError

      setItems(itemsData?.map(item => ({
        ...item,
        sku: (item.productos as { sku: string } | null)?.sku || '-'
      })) || [])

    } catch (error) {
      console.error('Error loading factura:', error)
      message.error('Error al cargar factura')
      router.push('/facturas')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  const loadPagos = useCallback(async () => {
    setPagosLoading(true)
    try {
      const response = await fetch(`/api/pagos?factura_id=${id}`)
      const result = await response.json()
      if (result.success) {
        setPagos(result.pagos || [])
      }
    } catch (error) {
      console.error('Error loading pagos:', error)
    } finally {
      setPagosLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) {
      loadFactura()
      loadPagos()
    }
  }, [id, loadFactura, loadPagos])

  // === PDF ===

  const handleDescargarPDF = async () => {
    if (!factura) return

    // Si esta timbrada, usar el generador SAT con QR
    if (factura.uuid_cfdi && factura.status_sat === 'timbrado') {
      try {
        const { generarPdfCfdi } = await import('@/lib/cfdi/pdf-generator')
        const pdfData: import('@/lib/cfdi/pdf-generator').PdfCfdiData = {
          folio: factura.folio,
          fecha: factura.fecha,
          emisor: {
            // These will be filled by the PDF generator from config
            rfc: '', nombre: '', regimenFiscal: '', codigoPostal: '',
          },
          receptor: {
            rfc: factura.cliente_rfc || '',
            nombre: factura.cliente_razon_social || factura.cliente_nombre,
            codigoPostal: factura.cliente_codigo_postal || '',
            regimenFiscal: factura.cliente_regimen_fiscal || '616',
            usoCfdi: factura.cliente_uso_cfdi || 'G03',
          },
          conceptos: items.map(item => ({
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            valorUnitario: item.precio_unitario,
            importe: item.cantidad * item.precio_unitario,
            descuento: item.descuento_porcentaje > 0
              ? (item.cantidad * item.precio_unitario * item.descuento_porcentaje / 100)
              : undefined,
          })),
          subtotal: factura.subtotal,
          descuento: factura.descuento_monto > 0 ? factura.descuento_monto : undefined,
          iva: factura.iva,
          total: factura.total,
          moneda: factura.moneda || 'MXN',
          metodoPago: 'PUE',
          formaPago: '99',
          uuid: factura.uuid_cfdi || undefined,
          fechaTimbrado: factura.fecha_timbrado || undefined,
          selloCfdi: factura.sello_cfdi || undefined,
          selloSat: factura.sello_sat || undefined,
          certificadoSat: factura.certificado_sat || undefined,
          cadenaOriginal: factura.cadena_original || undefined,
        }

        // Fill emisor from preview data if available, otherwise use defaults
        try {
          const previewResp = await fetch('/api/cfdi/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ factura_id: factura.id }),
          })
          const previewResult = await previewResp.json()
          if (previewResult.success && previewResult.emisor) {
            pdfData.emisor = {
              ...previewResult.emisor,
              codigoPostal: previewResult.emisor.codigoPostal || '',
            }
            pdfData.formaPago = previewResult.formaPago || '99'
            pdfData.metodoPago = previewResult.metodoPago || 'PUE'
          }
        } catch {
          // Use defaults if preview fails
          pdfData.emisor = { rfc: 'N/A', nombre: 'N/A', regimenFiscal: '601', codigoPostal: '00000' }
        }

        const doc = await generarPdfCfdi(pdfData)
        doc.save(`${factura.folio}_CFDI.pdf`)
        message.success('PDF CFDI descargado')
        return
      } catch (e) {
        console.error('Error generando PDF CFDI:', e)
        // Fallback to basic PDF
      }
    }

    // Fallback: PDF basico sin datos SAT
    const opciones: OpcionesMoneda = {
      moneda: factura.moneda || 'USD',
      tipoCambio: factura.moneda === 'MXN' ? (factura.tipo_cambio || undefined) : undefined
    }
    await generarPDFFactura({ ...factura, vendedor_nombre: factura.vendedor_nombre }, items, opciones)
    message.success('PDF descargado')
  }

  // === CFDI PREVIEW + TIMBRAR ===

  const handlePreviewTimbrar = async () => {
    if (!factura) return

    if (!factura.cliente_rfc) {
      message.error('El cliente no tiene RFC configurado')
      return
    }

    setPreviewLoading(true)
    try {
      const response = await fetch('/api/cfdi/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factura_id: factura.id }),
      })
      const result = await response.json()

      if (result.success) {
        setPreviewData(result)
        setPreviewModalOpen(true)
      } else {
        message.error(result.error || 'Error al generar preview')
        if (result.detalles) {
          Modal.error({
            title: 'Errores de validacion',
            content: (
              <ul>
                {(Array.isArray(result.detalles) ? result.detalles : []).map((e: string, i: number) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            ),
          })
        }
      }
    } catch (error) {
      console.error('Error en preview:', error)
      message.error('Error de conexion')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirmarTimbrado = async () => {
    if (!factura) return

    setPreviewModalOpen(false)
    setTimbrandoLoading(true)

    try {
      const response = await fetch('/api/cfdi/timbrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factura_id: factura.id }),
      })
      const result = await response.json()

      if (result.success) {
        setSuccessUuid(result.uuid)
        setSuccessModalOpen(true)
        loadFactura()
      } else {
        setTimbradoError({
          codigo: result.codigo,
          titulo: result.errorInfo?.titulo || result.error || 'Error al timbrar',
          descripcion: result.errorInfo?.descripcion || result.error || '',
          accion: result.errorInfo?.accion || result.sugerencias?.[0] || 'Revisar los datos de la factura',
          detalles: result.detalles || result.error,
        })
        setErrorModalOpen(true)
        loadFactura()
      }
    } catch (error) {
      console.error('Error al timbrar:', error)
      setTimbradoError({
        titulo: 'Error de conexion',
        descripcion: 'No se pudo conectar con el servicio de timbrado',
        accion: 'Verificar la conexion e intentar nuevamente',
      })
      setErrorModalOpen(true)
    } finally {
      setTimbrandoLoading(false)
    }
  }

  const handleReintentar = async () => {
    if (!factura) return

    setErrorModalOpen(false)
    setTimbrandoLoading(true)

    try {
      const response = await fetch('/api/cfdi/reintentar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factura_id: factura.id }),
      })
      const result = await response.json()

      if (result.success) {
        setSuccessUuid(result.uuid)
        setSuccessModalOpen(true)
        loadFactura()
      } else {
        setTimbradoError({
          codigo: result.codigo,
          titulo: result.errorInfo?.titulo || result.error || 'Error al reintentar',
          descripcion: result.errorInfo?.descripcion || result.error || '',
          accion: result.errorInfo?.accion || result.sugerencias?.[0] || 'Contactar soporte',
          detalles: result.detalles || result.error,
        })
        setErrorModalOpen(true)
        loadFactura()
      }
    } catch (error) {
      console.error('Error al reintentar:', error)
      message.error('Error de conexion al reintentar')
    } finally {
      setTimbrandoLoading(false)
    }
  }

  // === CANCELAR CFDI ===

  const handleCancelar = async () => {
    if (!factura || !factura.uuid_cfdi) return

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

  // === DESCARGAR XML ===

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

  // === PAGOS ===

  const handleRegistrarPago = async () => {
    if (!factura) return

    try {
      const values = await pagoForm.validateFields()
      setRegistrandoPago(true)

      const response = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factura_id: factura.id,
          monto: values.monto,
          fecha: values.fecha.format('YYYY-MM-DD'),
          metodo_pago: values.metodo_pago,
          referencia: values.referencia || null,
          notas: values.notas || null,
        }),
      })

      const result = await response.json()

      if (result.success) {
        message.success(result.message || 'Pago registrado')
        setPagoModalOpen(false)
        pagoForm.resetFields()
        loadFactura()
        loadPagos()
      } else {
        message.error(result.error || 'Error al registrar pago')
      }
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setRegistrandoPago(false)
    }
  }

  const handleGenerarComplemento = async (pagoId: string) => {
    setComplementoLoading(pagoId)
    try {
      const response = await fetch('/api/cfdi/complemento-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pago_id: pagoId }),
      })
      const result = await response.json()

      if (result.success) {
        message.success(`Complemento timbrado. UUID: ${result.uuid}`)
        loadPagos()
      } else {
        message.error(result.error || 'Error al generar complemento')
      }
    } catch (error) {
      console.error('Error complemento:', error)
      message.error('Error de conexion')
    } finally {
      setComplementoLoading(null)
    }
  }

  // === COLUMNS ===

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100 },
    { title: 'Descripcion', dataIndex: 'descripcion', key: 'descripcion' },
    { title: 'Cantidad', dataIndex: 'cantidad', key: 'cantidad', width: 100, align: 'right' as const },
    {
      title: 'Precio Unit.', dataIndex: 'precio_unitario', key: 'precio_unitario',
      width: 130, align: 'right' as const, render: (val: number) => formatMoney(val),
    },
    {
      title: 'Desc. %', dataIndex: 'descuento_porcentaje', key: 'descuento_porcentaje',
      width: 80, align: 'right' as const, render: (val: number) => val > 0 ? `${val}%` : '-',
    },
    {
      title: 'Subtotal', dataIndex: 'subtotal', key: 'subtotal',
      width: 130, align: 'right' as const, render: (val: number) => formatMoney(val),
    },
  ]

  const pagosColumns = [
    { title: 'Folio', dataIndex: 'folio', key: 'folio', width: 100 },
    {
      title: 'Fecha', dataIndex: 'fecha', key: 'fecha', width: 100,
      render: (val: string) => formatDate(val),
    },
    {
      title: 'Monto', dataIndex: 'monto', key: 'monto', width: 120,
      align: 'right' as const, render: (val: number) => formatMoney(val),
    },
    {
      title: 'Metodo', dataIndex: 'metodo_pago', key: 'metodo_pago', width: 80,
      render: (val: string) => {
        const labels: Record<string, string> = { '01': 'Efectivo', '02': 'Cheque', '03': 'Transfer.', '04': 'T. Credito', '28': 'T. Debito', '99': 'Otro' }
        return labels[val] || val
      },
    },
    { title: 'Referencia', dataIndex: 'referencia', key: 'referencia', ellipsis: true, render: (val: string | null) => val || '-' },
    {
      title: 'Complemento',
      key: 'complemento',
      width: 140,
      render: (_: any, record: PagoRecord) => {
        if (record.uuid_complemento_pago) {
          return <Tag color="green" style={{ fontSize: 10 }}>{record.uuid_complemento_pago.substring(0, 8)}...</Tag>
        }
        // Only show button if factura is PPD and timbrada
        if (factura?.status_sat === 'timbrado' && factura?.uuid_cfdi) {
          return (
            <Button
              size="small"
              type="link"
              loading={complementoLoading === record.id}
              onClick={() => handleGenerarComplemento(record.id)}
            >
              Generar
            </Button>
          )
        }
        return <Text type="secondary">-</Text>
      },
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!factura) return null

  const statusSat = factura.status_sat || 'pendiente'

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/facturas')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>Factura {factura.folio}</Title>
          <Tag color={statusColors[factura.status]} style={{ fontSize: 14, padding: '4px 12px' }}>
            {statusLabels[factura.status] || factura.status}
          </Tag>
        </Space>

        <Space wrap>
          <Button icon={<FilePdfOutlined />} onClick={handleDescargarPDF} size="large">
            Descargar PDF
          </Button>
          {factura.status_sat !== 'timbrado' && (
            <Button icon={<EditOutlined />} onClick={() => router.push(`/facturas/${id}/editar`)} size="large">
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
          {/* Datos de la factura */}
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
                <Descriptions.Item label="Cotizacion origen">{factura.cotizacion_folio}</Descriptions.Item>
              )}
            </Descriptions>
            {factura.notas && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Text type="secondary">Notas: {factura.notas}</Text>
              </>
            )}
          </Card>

          {/* Productos */}
          <Card title="Productos" style={{ marginBottom: 16 }}>
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

          {/* Pagos */}
          <Card
            title={
              <Space>
                <DollarOutlined />
                Historial de Pagos
              </Space>
            }
            extra={
              factura.saldo > 0 && factura.status !== 'cancelada' && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => {
                    pagoForm.setFieldsValue({
                      monto: factura.saldo,
                      fecha: dayjs(),
                      metodo_pago: '03',
                    })
                    setPagoModalOpen(true)
                  }}
                >
                  Registrar Pago
                </Button>
              )
            }
          >
            <Table
              dataSource={pagos}
              columns={pagosColumns}
              rowKey="id"
              pagination={false}
              size="small"
              loading={pagosLoading}
              locale={{ emptyText: 'Sin pagos registrados' }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          {/* Card de Timbrado CFDI */}
          <Card
            title={<Space><FileTextOutlined /> Timbrado CFDI</Space>}
            style={{ marginBottom: 16 }}
            extra={<Tag color={statusSatColors[statusSat]}>{statusSatLabels[statusSat] || statusSat}</Tag>}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {factura.uuid_cfdi && (
                <div>
                  <Text type="secondary">UUID:</Text>
                  <div style={{ wordBreak: 'break-all' }}>
                    <Text code copyable style={{ fontSize: 11 }}>{factura.uuid_cfdi}</Text>
                  </div>
                </div>
              )}

              {factura.fecha_timbrado && (
                <div>
                  <Text type="secondary">Fecha de timbrado:</Text>
                  <div><Text>{new Date(factura.fecha_timbrado).toLocaleString('es-MX')}</Text></div>
                </div>
              )}

              {/* Mostrar error si hay */}
              {factura.error_timbrado && statusSat === 'error' && (
                <Alert
                  type="warning"
                  message={factura.error_timbrado.info?.titulo || 'Error de timbrado'}
                  description={factura.error_timbrado.info?.descripcion || factura.error_timbrado.mensaje}
                  showIcon
                  action={
                    <Button size="small" icon={<ReloadOutlined />} onClick={handleReintentar} loading={timbrandoLoading}>
                      Reintentar
                    </Button>
                  }
                />
              )}

              <Divider style={{ margin: '8px 0' }} />

              {/* Boton Timbrar con Preview */}
              {(statusSat === 'pendiente' || statusSat === 'error') && factura.status !== 'cancelada' && (
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  block
                  size="large"
                  loading={timbrandoLoading || previewLoading}
                  onClick={handlePreviewTimbrar}
                >
                  {statusSat === 'error' ? 'Reintentar Timbrado' : 'Timbrar CFDI'}
                </Button>
              )}

              {statusSat === 'timbrado' && (
                <>
                  <Button icon={<DownloadOutlined />} block onClick={handleDescargarXML}>
                    Descargar XML
                  </Button>
                  <Button danger icon={<CloseCircleOutlined />} block onClick={() => setCancelModalOpen(true)}>
                    Cancelar CFDI
                  </Button>
                </>
              )}

              {statusSat === 'cancelado' && (
                <Alert type="error" message="CFDI Cancelado" description="Este comprobante fue cancelado ante el SAT" showIcon />
              )}

              {(statusSat === 'pendiente' || statusSat === 'error') && (
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

          {/* Card de Resumen de Pago */}
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

              {factura.status === 'pagada' && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                  <div style={{ marginTop: 8 }}>
                    <Text type="success" strong>Factura Pagada</Text>
                  </div>
                </div>
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
                    onClick={() => {
                      Modal.confirm({
                        title: 'Cancelar Factura',
                        content: 'Esta accion cancelara la factura. ¿Continuar?',
                        okText: 'Cancelar Factura',
                        okButtonProps: { danger: true },
                        onOk: async () => {
                          const supabase = getSupabaseClient()
                          await supabase.schema('erp').from('facturas')
                            .update({ status: 'cancelada', saldo: 0, monto_pagado: 0 })
                            .eq('id', factura.id)
                          message.success('Factura cancelada')
                          loadFactura()
                        },
                      })
                    }}
                  >
                    Cancelar Factura
                  </Button>
                </>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Modal Preview CFDI */}
      <Modal
        title={<Space><SafetyCertificateOutlined /> Preview del CFDI</Space>}
        open={previewModalOpen}
        onCancel={() => setPreviewModalOpen(false)}
        width={720}
        footer={[
          <Button key="cancel" onClick={() => setPreviewModalOpen(false)}>
            Cancelar
          </Button>,
          <Button
            key="timbrar"
            type="primary"
            icon={<SafetyCertificateOutlined />}
            loading={timbrandoLoading}
            disabled={previewData?.validaciones?.length > 0}
            onClick={handleConfirmarTimbrado}
          >
            Confirmar Timbrado
          </Button>,
        ]}
        destroyOnClose
      >
        {previewData && (
          <CfdiPreview
            emisor={previewData.emisor}
            receptor={previewData.receptor}
            conceptos={previewData.conceptos}
            totales={previewData.totales}
            validaciones={previewData.validaciones}
            moneda={previewData.moneda}
            metodoPago={previewData.metodoPago}
            formaPago={previewData.formaPago}
          />
        )}
      </Modal>

      {/* Modal Timbrado Exitoso */}
      <TimbradoSuccessModal
        open={successModalOpen}
        uuid={successUuid}
        onClose={() => setSuccessModalOpen(false)}
        onDownloadPdf={handleDescargarPDF}
        onDownloadXml={handleDescargarXML}
      />

      {/* Modal Error Timbrado */}
      {timbradoError && (
        <TimbradoErrorModal
          open={errorModalOpen}
          error={timbradoError}
          onClose={() => setErrorModalOpen(false)}
          onRetry={handleReintentar}
          onEdit={() => {
            setErrorModalOpen(false)
            router.push(`/facturas/${id}/editar`)
          }}
          retryLoading={timbrandoLoading}
        />
      )}

      {/* Modal Cancelar CFDI */}
      <Modal
        title={<Space><ExclamationCircleOutlined style={{ color: '#faad14' }} /> Cancelar CFDI</Space>}
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
            <Select value={motivoCancelacion} onChange={setMotivoCancelacion} options={motivosCancelacion} />
          </Form.Item>
          {motivoCancelacion === '01' && (
            <Form.Item label="UUID de la Factura que Sustituye" required help="Ingresa el UUID de la nueva factura que reemplaza a esta">
              <Input
                value={uuidSustitucion}
                onChange={(e) => setUuidSustitucion(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Modal Registrar Pago */}
      <Modal
        title={<Space><DollarOutlined /> Registrar Pago</Space>}
        open={pagoModalOpen}
        onCancel={() => { setPagoModalOpen(false); pagoForm.resetFields() }}
        onOk={handleRegistrarPago}
        okText="Registrar Pago"
        okButtonProps={{ loading: registrandoPago }}
        cancelText="Cancelar"
        destroyOnClose
      >
        <Form form={pagoForm} layout="vertical">
          <Form.Item
            name="monto"
            label="Monto"
            rules={[
              { required: true, message: 'Ingrese el monto' },
              { type: 'number', min: 0.01, message: 'El monto debe ser mayor a 0' },
              { type: 'number', max: factura.saldo, message: `Maximo: $${factura.saldo.toFixed(2)}` },
            ]}
          >
            <InputNumber
              prefix="$"
              style={{ width: '100%' }}
              precision={2}
              min={0.01}
              max={factura.saldo}
            />
          </Form.Item>
          <Form.Item name="fecha" label="Fecha del Pago" rules={[{ required: true, message: 'Seleccione la fecha' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="metodo_pago" label="Forma de Pago" rules={[{ required: true, message: 'Seleccione la forma' }]}>
            <Select options={FORMAS_PAGO_OPTIONS} />
          </Form.Item>
          <Form.Item name="referencia" label="Referencia (opcional)">
            <Input placeholder="Numero de cheque, referencia bancaria, etc." />
          </Form.Item>
          <Form.Item name="notas" label="Notas (opcional)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
