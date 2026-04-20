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
  fechaPrestamo: Dayjs
  fechaCompromiso: Dayjs | null
  folio: string
  clienteNombre: string
  clienteRfc: string
  personaRecibe: string
  cargoRecibe: string
  contacto: string
  descripcion: string
  observaciones: string
  entregaNombre: string
  incluirLineasGuia: boolean
}

const DEFAULT_VALUES: FormValues = {
  fechaPrestamo: dayjs(),
  fechaCompromiso: null,
  folio: '',
  clienteNombre: '',
  clienteRfc: '',
  personaRecibe: '',
  cargoRecibe: '',
  contacto: '',
  descripcion: '',
  observaciones: '',
  entregaNombre: '',
  incluirLineasGuia: true,
}

const folioPrefijo = (fecha: Dayjs | null | undefined) =>
  `PREST-${(fecha || dayjs()).format('YYMMDD')}-`

const folioCompleto = (vals: FormValues) => {
  const sufijo = (vals.folio || '').trim()
  const prefijo = folioPrefijo(vals.fechaPrestamo)
  return sufijo ? `${prefijo}${sufijo}` : prefijo
}

export default function PrestamoMaterialEditorPage() {
  const router = useRouter()
  const { organizacion, loading: authLoading } = useAuth()
  const [form] = Form.useForm<FormValues>()

  const [values, setValues] = useState<FormValues>(DEFAULT_VALUES)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  const autorizado = organizacion?.rfc === SOLAC_RFC

  const nombreArchivo = useMemo(() => {
    const fechaStr = values.fechaPrestamo?.format('DD-MM-YYYY') || dayjs().format('DD-MM-YYYY')
    return `Vale_Prestamo_Material_SOLAC_${fechaStr}.pdf`
  }, [values.fechaPrestamo])

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
      const grisClaro: [number, number, number] = [230, 230, 230]
      const fondoLegal: [number, number, number] = [245, 248, 252]
      const negro: [number, number, number] = [0, 0, 0]

      let y = 18

      try {
        doc.addImage('/solac.png', 'PNG', marginLeft, y, 30, 30)
      } catch {
        // continuar sin logo
      }

      const xDatos = marginLeft + 35
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...azul)
      doc.text('SOLAC', xDatos, y + 9)

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...gris)
      doc.text('SOLUCIONES APLICADAS AL CONTROL', xDatos, y + 14)

      doc.setFontSize(9)
      doc.text('RFC: MOCD830414SL4', xDatos, y + 20)
      doc.text('Calle Magnolia #266, CP 45403, Jalisco', xDatos, y + 25)
      doc.text('Tel: (33) 1013-1166 | ventas@solac.com.mx', xDatos, y + 30)

      y += 34
      doc.setDrawColor(...azul)
      doc.setLineWidth(0.8)
      doc.line(marginLeft, y, marginRight, y)

      y += 10
      doc.setFontSize(15)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...azul)
      doc.text('VALE DE PRÉSTAMO DE MATERIAL', pageWidth / 2, y, { align: 'center' })

      y += 5
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...gris)
      doc.text(
        'Entrega condicionada a recepción de orden de compra',
        pageWidth / 2,
        y,
        { align: 'center' }
      )

      // Bloque de datos superior (fechas + folio + cliente) como tabla simple
      y += 8
      const labelColor: [number, number, number] = [...gris] as [number, number, number]
      const bloqueTopY = y
      const colGap = 6
      const colAncho = (contentWidth - colGap) / 2

      const dibujarCampo = (
        x: number,
        ancho: number,
        yLocal: number,
        label: string,
        valor: string
      ) => {
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...labelColor)
        doc.text(label.toUpperCase(), x, yLocal)

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...negro)
        const texto = (valor || '').trim() || '—'
        const lineas = doc.splitTextToSize(texto, ancho)
        doc.text(lineas[0] ?? '—', x, yLocal + 5)

        doc.setDrawColor(...grisClaro)
        doc.setLineWidth(0.2)
        doc.line(x, yLocal + 6.5, x + ancho, yLocal + 6.5)
      }

      const folioTxt = folioCompleto(vals)
      const fPrestamo = vals.fechaPrestamo?.format('DD/MM/YYYY') || ''
      const fCompromiso = vals.fechaCompromiso?.format('DD/MM/YYYY') || ''

      // Fila 1: Fecha préstamo | Fecha compromiso
      dibujarCampo(marginLeft, colAncho, bloqueTopY, 'Fecha del préstamo', fPrestamo)
      dibujarCampo(marginLeft + colAncho + colGap, colAncho, bloqueTopY, 'Fecha compromiso de documentación', fCompromiso)

      // Fila 2: Folio | (vacío a propósito, el folio queda alineado a izq)
      dibujarCampo(marginLeft, colAncho, bloqueTopY + 10, 'Folio', folioTxt)
      dibujarCampo(marginLeft + colAncho + colGap, colAncho, bloqueTopY + 10, 'Contacto (tel. / email)', vals.contacto)

      // Fila 3: Cliente (ancho completo)
      dibujarCampo(marginLeft, contentWidth, bloqueTopY + 20, 'Cliente / Razón social', vals.clienteNombre)

      // Fila 4: RFC | Persona que recibe
      dibujarCampo(marginLeft, colAncho, bloqueTopY + 30, 'RFC del cliente', vals.clienteRfc)
      dibujarCampo(marginLeft + colAncho + colGap, colAncho, bloqueTopY + 30, 'Persona que recibe', vals.personaRecibe)

      // Fila 5: Cargo
      dibujarCampo(marginLeft, colAncho, bloqueTopY + 40, 'Cargo de quien recibe', vals.cargoRecibe)

      y = bloqueTopY + 48

      // Párrafo legal en recuadro claro
      const legalTexto =
        'El cliente reconoce haber recibido en calidad de préstamo el material descrito a continuación, ' +
        'y se compromete a entregar a SOLAC la Orden de Compra y/o los documentos necesarios para su ' +
        'facturación a más tardar en la fecha compromiso indicada. Transcurrido ese plazo sin recibir ' +
        'los documentos, el material deberá ser devuelto en las mismas condiciones o liquidado de contado. ' +
        'La firma de este documento acredita la recepción física del material.'

      doc.setFillColor(...fondoLegal)
      doc.setDrawColor(...azul)
      doc.setLineWidth(0.3)
      const legalLineas = doc.splitTextToSize(legalTexto, contentWidth - 8)
      const legalAlto = legalLineas.length * 4 + 6
      doc.rect(marginLeft, y, contentWidth, legalAlto, 'FD')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...negro)
      doc.text(legalLineas, marginLeft + 4, y + 5)

      y += legalAlto + 6

      // Recuadro material prestado
      const recuadroHeight = 70
      doc.setDrawColor(180, 180, 180)
      doc.setLineWidth(0.4)
      doc.rect(marginLeft, y, contentWidth, recuadroHeight)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...gris)
      doc.text('Material prestado:', marginLeft + 4, y + 6)

      const descripcion = (vals.descripcion || '').trim()
      if (descripcion) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...negro)
        const lineas = doc.splitTextToSize(descripcion, contentWidth - 8)
        doc.text(lineas, marginLeft + 4, y + 14)
      } else if (vals.incluirLineasGuia) {
        doc.setDrawColor(...grisClaro)
        doc.setLineWidth(0.2)
        const lineSpacing = 8
        for (let lineY = y + 15; lineY < y + recuadroHeight - 4; lineY += lineSpacing) {
          doc.line(marginLeft + 4, lineY, marginRight - 4, lineY)
        }
      }

      y += recuadroHeight + 6

      // Observaciones
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...gris)
      doc.text('Observaciones:', marginLeft, y)
      y += 2.5
      doc.setDrawColor(180, 180, 180)
      doc.setLineWidth(0.3)
      const obsAlto = 16
      doc.rect(marginLeft, y, contentWidth, obsAlto)

      const observaciones = (vals.observaciones || '').trim()
      if (observaciones) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...negro)
        const lineasObs = doc.splitTextToSize(observaciones, contentWidth - 8)
        doc.text(lineasObs, marginLeft + 4, y + 6)
      } else if (vals.incluirLineasGuia) {
        doc.setDrawColor(...grisClaro)
        doc.setLineWidth(0.2)
        doc.line(marginLeft + 4, y + 7, marginRight - 4, y + 7)
        doc.line(marginLeft + 4, y + 13, marginRight - 4, y + 13)
      }

      // Firmas al pie
      const yFirmasLabel = pageHeight - 45
      const colWidth = contentWidth / 2
      const firmaWidth = 70
      const firmaY = yFirmasLabel + 18

      const dibujarFirma = (x: number, label: string, nombre: string, extra?: string) => {
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
        const sub = extra ? `Nombre, firma y ${extra}` : 'Nombre y firma'
        doc.text(sub, x, firmaY + 10, { align: 'center' })
      }

      dibujarFirma(marginLeft + colWidth / 2, 'ENTREGA (SOLAC)', vals.entregaNombre)
      dibujarFirma(
        marginLeft + colWidth + colWidth / 2,
        'RECIBE (CLIENTE)',
        vals.personaRecibe,
        'cargo'
      )

      doc.setFontSize(7)
      doc.setTextColor(...gris)
      doc.text(
        'SOLAC - Soluciones Aplicadas al Control | ventas@solac.com.mx | Tel: (33) 1013-1166',
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )

      if (outputType === 'save') {
        const fechaStr = vals.fechaPrestamo?.format('DD-MM-YYYY') || dayjs().format('DD-MM-YYYY')
        doc.save(`Vale_Prestamo_Material_SOLAC_${fechaStr}.pdf`)
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

  const prefijoFolio = folioPrefijo(values.fechaPrestamo)

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
          Vale de Préstamo de Material
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
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Fecha del préstamo" name="fechaPrestamo">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} allowClear={false} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Fecha compromiso"
                    name="fechaCompromiso"
                    tooltip="Fecha en que el cliente se compromete a enviar la OC / documentos de facturación."
                  >
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Folio"
                name="folio"
                tooltip="Se arma como PREST-AAMMDD-[número]. Tú escribes solo el número."
              >
                <Input addonBefore={prefijoFolio} placeholder="001" />
              </Form.Item>

              <Form.Item label="Cliente / Razón social" name="clienteNombre">
                <Input placeholder="Nombre o razón social del cliente" />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="RFC del cliente" name="clienteRfc">
                    <Input placeholder="Opcional" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Contacto (tel / email)" name="contacto">
                    <Input placeholder="Teléfono o correo" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Persona que recibe" name="personaRecibe">
                    <Input placeholder="Nombre completo" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Cargo de quien recibe" name="cargoRecibe">
                    <Input placeholder="Ej. Comprador, Jefe de planta" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Material prestado"
                name="descripcion"
                tooltip="Déjalo en blanco si prefieres escribir a mano sobre el formato impreso."
              >
                <TextArea rows={5} placeholder="Ej. 1x PLC Siemens S7-1200, 2x módulos I/O..." />
              </Form.Item>

              <Form.Item label="Observaciones" name="observaciones">
                <TextArea rows={2} placeholder="Notas adicionales, condiciones del equipo, etc." />
              </Form.Item>

              <Form.Item label="Entrega (nombre)" name="entregaNombre">
                <Input placeholder="Nombre de quien entrega por SOLAC" />
              </Form.Item>

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
