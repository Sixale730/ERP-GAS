'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Space,
  Spin,
  Switch,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  PrinterOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useAuth } from '@/lib/hooks/useAuth'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

const SOLAC_RFC = 'MOCD830414SL4'

type FormValues = {
  fecha: Dayjs
  descripcion: string
  observaciones: string
  entregaNombre: string
  recibeNombre: string
  incluirLineasGuia: boolean
}

const DEFAULT_VALUES: FormValues = {
  fecha: dayjs(),
  descripcion: '',
  observaciones: '',
  entregaNombre: '',
  recibeNombre: '',
  incluirLineasGuia: true,
}

export default function EntregaRevisionEditorPage() {
  const router = useRouter()
  const { organizacion, loading: authLoading } = useAuth()
  const [form] = Form.useForm<FormValues>()

  const [values, setValues] = useState<FormValues>(DEFAULT_VALUES)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  const autorizado = organizacion?.rfc === SOLAC_RFC

  const nombreArchivo = useMemo(() => {
    const fechaStr = values.fecha?.format('DD-MM-YYYY') || dayjs().format('DD-MM-YYYY')
    return `Entrega_Material_Revision_SOLAC_${fechaStr}.pdf`
  }, [values.fecha])

  const generarPDF = useCallback(
    async (vals: FormValues, outputType: 'bloburl' | 'blob' | 'save'): Promise<string | Blob | null> => {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF('p', 'mm', 'letter')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const marginLeft = 20
      const marginRight = pageWidth - 20
      const contentWidth = marginRight - marginLeft

      const azul: [number, number, number] = [41, 128, 185]
      const gris: [number, number, number] = [100, 100, 100]
      const negro: [number, number, number] = [0, 0, 0]

      let y = 20

      try {
        doc.addImage('/solac.png', 'PNG', marginLeft, y, 35, 35)
      } catch {
        // continuar sin logo
      }

      const xDatos = marginLeft + 40
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...azul)
      doc.text('SOLAC', xDatos, y + 10)

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...gris)
      doc.text('SOLUCIONES APLICADAS AL CONTROL', xDatos, y + 16)

      doc.setFontSize(9)
      doc.text('RFC: MOCD830414SL4', xDatos, y + 22)
      doc.text('Calle Magnolia #266, CP 45403, Jalisco', xDatos, y + 27)
      doc.text('Tel: (33) 1013-1166 | ventas@solac.com.mx', xDatos, y + 32)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...negro)
      const fechaTexto = vals.fecha?.format('DD/MM/YYYY') || dayjs().format('DD/MM/YYYY')
      doc.text(`Fecha: ${fechaTexto}`, marginRight, y + 10, { align: 'right' })

      y += 42
      doc.setDrawColor(...azul)
      doc.setLineWidth(0.8)
      doc.line(marginLeft, y, marginRight, y)

      y += 14
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...azul)
      doc.text('ENTREGA DE MATERIAL A REVISIÓN', pageWidth / 2, y, { align: 'center' })

      y += 12
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...negro)
      doc.text(
        'Se entrega el siguiente material a revisión con el fabricante para su diagnóstico',
        pageWidth / 2,
        y,
        { align: 'center' }
      )
      y += 6
      doc.text('y/o reparación correspondiente:', pageWidth / 2, y, { align: 'center' })

      y += 10
      const recuadroHeight = 120
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.rect(marginLeft, y, contentWidth, recuadroHeight)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...gris)
      doc.text('Descripción del material / módulos:', marginLeft + 4, y + 6)

      const descripcion = (vals.descripcion || '').trim()
      if (descripcion) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...negro)
        const lineas = doc.splitTextToSize(descripcion, contentWidth - 8)
        doc.text(lineas, marginLeft + 4, y + 14)
      } else if (vals.incluirLineasGuia) {
        doc.setDrawColor(230, 230, 230)
        doc.setLineWidth(0.2)
        const lineSpacing = 10
        for (let lineY = y + 15; lineY < y + recuadroHeight - 5; lineY += lineSpacing) {
          doc.line(marginLeft + 4, lineY, marginRight - 4, lineY)
        }
      }

      y += recuadroHeight + 10
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...gris)
      doc.text('Observaciones:', marginLeft, y)
      y += 3
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.rect(marginLeft, y, contentWidth, 25)

      const observaciones = (vals.observaciones || '').trim()
      if (observaciones) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...negro)
        const lineasObs = doc.splitTextToSize(observaciones, contentWidth - 8)
        doc.text(lineasObs, marginLeft + 4, y + 7)
      } else if (vals.incluirLineasGuia) {
        doc.setDrawColor(230, 230, 230)
        doc.setLineWidth(0.2)
        doc.line(marginLeft + 4, y + 8, marginRight - 4, y + 8)
        doc.line(marginLeft + 4, y + 16, marginRight - 4, y + 16)
      }

      y = pageHeight - 50
      const colWidth = contentWidth / 2
      const firmaWidth = 70
      const firmaY = y + 20

      const dibujarFirma = (x: number, label: string, nombre: string) => {
        doc.setDrawColor(...negro)
        doc.setLineWidth(0.4)
        doc.line(x - firmaWidth / 2, firmaY, x + firmaWidth / 2, firmaY)

        const nombreTrim = (nombre || '').trim()
        if (nombreTrim) {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...negro)
          doc.text(nombreTrim, x, firmaY - 2, { align: 'center' })
        }

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...negro)
        doc.text(label, x, firmaY + 5, { align: 'center' })
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...gris)
        doc.text('Nombre y firma', x, firmaY + 10, { align: 'center' })
      }

      dibujarFirma(marginLeft + colWidth / 2, 'ENTREGA', vals.entregaNombre)
      dibujarFirma(marginLeft + colWidth + colWidth / 2, 'RECIBE', vals.recibeNombre)

      doc.setFontSize(7)
      doc.setTextColor(...gris)
      doc.text(
        'SOLAC - Soluciones Aplicadas al Control | ventas@solac.com.mx | Tel: (33) 1013-1166',
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )

      if (outputType === 'save') {
        const fechaStr = vals.fecha?.format('DD-MM-YYYY') || dayjs().format('DD-MM-YYYY')
        doc.save(`Entrega_Material_Revision_SOLAC_${fechaStr}.pdf`)
        return null
      }

      if (outputType === 'bloburl') {
        return doc.output('bloburl') as unknown as string
      }
      return doc.output('blob')
    },
    []
  )

  const actualizarPreview = useCallback(
    async (vals: FormValues) => {
      setGenerating(true)
      try {
        const blob = (await generarPDF(vals, 'blob')) as Blob
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current)
        }
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setPdfUrl(url)
      } catch (err) {
        console.error(err)
        message.error('Error generando vista previa')
      } finally {
        setGenerating(false)
      }
    },
    [generarPDF]
  )

  useEffect(() => {
    if (autorizado) {
      actualizarPreview(values)
    }
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorizado])

  const handleValuesChange = (_: Partial<FormValues>, allValues: FormValues) => {
    setValues(allValues)
  }

  const handleActualizar = () => {
    actualizarPreview(values)
  }

  const handleDescargar = async () => {
    try {
      await generarPDF(values, 'save')
    } catch (err) {
      console.error(err)
      message.error('Error al descargar PDF')
    }
  }

  const handleImprimir = () => {
    if (!pdfUrl) return
    const w = window.open(pdfUrl, '_blank')
    if (w) {
      w.onload = () => {
        try {
          w.print()
        } catch {
          // ignore
        }
      }
    }
  }

  const handleReset = () => {
    form.resetFields()
    setValues(DEFAULT_VALUES)
    actualizarPreview(DEFAULT_VALUES)
  }

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin />
      </div>
    )
  }

  if (!autorizado) {
    return (
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/catalogos/documentos')}
            style={{ padding: 0 }}
          >
            Volver a Documentos
          </Button>
          <Alert
            type="warning"
            showIcon
            message="Documento no disponible"
            description="Este formato es exclusivo de la organización SOLAC y no está habilitado para tu organización actual."
          />
        </Space>
      </Card>
    )
  }

  return (
    <div>
      <Space direction="vertical" size={4} style={{ marginBottom: 16, width: '100%' }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/catalogos/documentos')}
          style={{ padding: 0 }}
        >
          Volver a Documentos
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          Entrega de Material a Revisión
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Edita los campos y descarga el PDF listo para firmar. La vista previa se actualiza automáticamente.
        </Paragraph>
      </Space>

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card
            title="Datos del documento"
            extra={
              <Button size="small" icon={<ReloadOutlined />} onClick={handleReset}>
                Limpiar
              </Button>
            }
          >
            <Form<FormValues>
              form={form}
              layout="vertical"
              initialValues={DEFAULT_VALUES}
              onValuesChange={handleValuesChange}
            >
              <Form.Item label="Fecha" name="fecha">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} allowClear={false} />
              </Form.Item>

              <Form.Item
                label="Descripción del material / módulos"
                name="descripcion"
                tooltip="Déjalo en blanco si prefieres escribir a mano sobre el formato impreso."
              >
                <TextArea rows={5} placeholder="Ej. 1x PLC Siemens S7-1200, 2x módulos I/O..." />
              </Form.Item>

              <Form.Item label="Observaciones" name="observaciones">
                <TextArea rows={3} placeholder="Notas adicionales, condiciones del equipo, etc." />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Entrega (nombre)" name="entregaNombre">
                    <Input placeholder="Nombre de quien entrega" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Recibe (nombre)" name="recibeNombre">
                    <Input placeholder="Nombre de quien recibe" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Mostrar líneas guía cuando el campo esté vacío"
                name="incluirLineasGuia"
                valuePropName="checked"
                tooltip="Útil si imprimirás el formato para llenarlo a mano."
              >
                <Switch />
              </Form.Item>
            </Form>

            <Space style={{ marginTop: 8 }} wrap>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDescargar}
              >
                Descargar PDF
              </Button>
              <Button icon={<PrinterOutlined />} onClick={handleImprimir} disabled={!pdfUrl}>
                Imprimir
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleActualizar} loading={generating}>
                Actualizar vista previa
              </Button>
            </Space>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Archivo: <Text code>{nombreArchivo}</Text>
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title="Vista previa"
            bodyStyle={{ padding: 0, height: 820, background: '#f5f5f5' }}
          >
            {generating && !pdfUrl ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                <Spin tip="Generando vista previa..." />
              </div>
            ) : pdfUrl ? (
              <iframe
                title="Vista previa PDF"
                src={pdfUrl}
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                <Text type="secondary">Sin vista previa</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
