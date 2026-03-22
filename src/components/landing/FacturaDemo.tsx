'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Tag, Row, Col, Statistic, Button, Space, Modal, InputNumber, Input, Select, DatePicker, Typography, Progress, Alert, Badge, Descriptions, message, Tooltip } from 'antd'
import {
  ArrowLeftOutlined,
  FilePdfOutlined,
  EditOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  PlusOutlined,
  FileTextOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { generarURLPDFFacturaDemo } from '@/components/landing/cotizacion-demo'

const { Title, Text } = Typography

const UUID_FICTICIO = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const FACTURA = {
  folio: 'FAC-00001',
  fecha: '21/03/2026',
  vencimiento: '20/04/2026',
  cliente: 'Tu Cliente S.A. de C.V.',
  rfc: 'TUC000000XX0',
  almacen: 'Almacén Principal',
  vendedor: 'Tu Vendedor',
  cotizacion_origen: 'OV-00001',
  notas: 'Entrega inmediata. Precios sujetos a cambio.',
  productos: [
    { key: '1', sku: 'PROD-001', desc: 'Producto de Ejemplo A', qty: 2, precio: 4500.00, disc: 0 },
    { key: '2', sku: 'PROD-002', desc: 'Servicio de Instalación', qty: 1, precio: 2800.00, disc: 0 },
    { key: '3', sku: 'PROD-003', desc: 'Producto de Ejemplo B', qty: 3, precio: 1200.00, disc: 0 },
  ],
  subtotal: 15400.00,
  iva: 2464.00,
  total: 17864.00,
}

const formatMoney = (n: number) => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Pago {
  id: number
  fecha: string
  metodo: string
  referencia: string
  monto: number
}

type TimbradoEstado = 'pendiente' | 'timbrando' | 'timbrado'

const TIMBRADO_TEXTOS = [
  'Conectando con el SAT...',
  'Validando comprobante...',
  'Sellando con certificado...',
]

export default function FacturaDemo() {
  // Timbrado
  const [timbrado, setTimbrado] = useState<TimbradoEstado>('pendiente')
  const [timbradoProgress, setTimbradoProgress] = useState(0)
  const [timbradoTexto, setTimbradoTexto] = useState(TIMBRADO_TEXTOS[0])
  const [horaTimbrado, setHoraTimbrado] = useState('')

  // Pagos
  const [pagos, setPagos] = useState<Pago[]>([])
  const [pagoModal, setPagoModal] = useState(false)
  const [pagoMonto, setPagoMonto] = useState<number>(0)
  const [pagoMetodo, setPagoMetodo] = useState('Transferencia')
  const [pagoRef, setPagoRef] = useState('')

  // PDF
  const [pdfUrl, setPdfUrl] = useState('')

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }
  }, [pdfUrl])

  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0)
  const saldo = FACTURA.total - totalPagado

  const iniciarTimbrado = useCallback(() => {
    setTimbrado('timbrando')
    setTimbradoProgress(0)
    setTimbradoTexto(TIMBRADO_TEXTOS[0])

    let p = 0
    let textoIdx = 0
    const interval = setInterval(() => {
      p += 2
      setTimbradoProgress(p)

      const nuevoIdx = Math.min(Math.floor(p / 33), 2)
      if (nuevoIdx !== textoIdx) {
        textoIdx = nuevoIdx
        setTimbradoTexto(TIMBRADO_TEXTOS[textoIdx])
      }

      if (p >= 100) {
        clearInterval(interval)
        setTimbrado('timbrado')
        setHoraTimbrado(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
        message.success('CFDI timbrado exitosamente')
      }
    }, 50)
  }, [])

  const handleDescargarPDF = useCallback(() => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    const url = generarURLPDFFacturaDemo()
    setPdfUrl(url)
    window.open(url, '_blank')
  }, [pdfUrl])

  const abrirPagoModal = () => {
    setPagoMonto(Math.min(saldo, saldo))
    setPagoRef('')
    setPagoMetodo('Transferencia')
    setPagoModal(true)
  }

  const confirmarPago = () => {
    if (pagoMonto <= 0) {
      message.error('El monto debe ser mayor a 0')
      return
    }
    if (pagoMonto > saldo) {
      message.error('El monto excede el saldo pendiente')
      return
    }
    const nuevo: Pago = {
      id: Date.now(),
      fecha: new Date().toLocaleDateString('es-MX'),
      metodo: pagoMetodo,
      referencia: pagoRef || '—',
      monto: pagoMonto,
    }
    setPagos(prev => [...prev, nuevo])
    setPagoModal(false)
    message.success('Pago registrado exitosamente')
  }

  const productosColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: 'Descripción', dataIndex: 'desc', key: 'desc' },
    { title: 'Cant.', dataIndex: 'qty', key: 'qty', width: 70, align: 'center' as const },
    { title: 'P. Unitario', dataIndex: 'precio', key: 'precio', width: 120, align: 'right' as const, render: (v: number) => formatMoney(v) },
    { title: 'Desc.', dataIndex: 'disc', key: 'disc', width: 70, align: 'center' as const, render: (v: number) => v > 0 ? `${v}%` : '—' },
    {
      title: 'Subtotal', key: 'subtotal', width: 120, align: 'right' as const,
      render: (_: unknown, r: { qty: number; precio: number; disc: number }) => formatMoney(r.qty * r.precio * (1 - r.disc / 100)),
    },
  ]

  const pagosColumns = [
    { title: 'Fecha', dataIndex: 'fecha', key: 'fecha', width: 100 },
    { title: 'Método', dataIndex: 'metodo', key: 'metodo', width: 110, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Referencia', dataIndex: 'referencia', key: 'referencia' },
    { title: 'Monto', dataIndex: 'monto', key: 'monto', width: 120, align: 'right' as const, render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 600 }}>{formatMoney(v)}</span> },
  ]

  return (
    <div>
      {/* ─── Barra superior ──────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Tooltip title="Disponible en el ERP completo">
            <Button icon={<ArrowLeftOutlined />}>Volver</Button>
          </Tooltip>
          <Title level={4} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8 }} />
            {FACTURA.folio}
          </Title>
          {saldo <= 0
            ? <Tag color="green" style={{ fontSize: 13, padding: '2px 12px' }}>Pagada</Tag>
            : <Tag color="orange" style={{ fontSize: 13, padding: '2px 12px' }}>Pendiente</Tag>
          }
        </Space>
        <Space>
          <Button icon={<FilePdfOutlined />} onClick={handleDescargarPDF}>Descargar PDF</Button>
          <Tooltip title="Disponible en el ERP completo">
            <Button icon={<EditOutlined />}>Editar</Button>
          </Tooltip>
        </Space>
      </div>

      <Row gutter={16}>
        {/* ─── Columna izquierda ──────────────────────────────────── */}
        <Col xs={24} lg={16}>
          {/* Datos de la factura */}
          <Card size="small" title="Datos de la Factura" style={{ marginBottom: 16, borderRadius: 8 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Folio">{FACTURA.folio}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{FACTURA.fecha}</Descriptions.Item>
              <Descriptions.Item label="Cliente">{FACTURA.cliente}</Descriptions.Item>
              <Descriptions.Item label="Vencimiento">{FACTURA.vencimiento}</Descriptions.Item>
              <Descriptions.Item label="RFC">{FACTURA.rfc}</Descriptions.Item>
              <Descriptions.Item label="Vendedor">{FACTURA.vendedor}</Descriptions.Item>
              <Descriptions.Item label="Almacén">{FACTURA.almacen}</Descriptions.Item>
              <Descriptions.Item label="OV Origen">{FACTURA.cotizacion_origen}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 6, fontSize: 12, color: '#595959' }}>
              <strong>Notas:</strong> {FACTURA.notas}
            </div>
          </Card>

          {/* Productos */}
          <Card size="small" title="Productos" style={{ borderRadius: 8 }}>
            <Table
              dataSource={FACTURA.productos}
              columns={productosColumns}
              pagination={false}
              size="small"
              summary={() => (
                <Table.Summary>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5} align="right"><strong>Subtotal</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">{formatMoney(FACTURA.subtotal)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5} align="right"><strong>IVA (16%)</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">{formatMoney(FACTURA.iva)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5} align="right"><strong style={{ fontSize: 15, color: '#1677ff' }}>TOTAL</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right"><strong style={{ fontSize: 15, color: '#1677ff' }}>{formatMoney(FACTURA.total)}</strong></Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        </Col>

        {/* ─── Columna derecha ────────────────────────────────────── */}
        <Col xs={24} lg={8}>
          {/* Timbrado CFDI */}
          <Card
            size="small"
            title={<Space><SafetyCertificateOutlined /> Timbrado CFDI</Space>}
            style={{ marginBottom: 16, borderRadius: 8 }}
          >
            {timbrado === 'pendiente' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <Badge status="default" text={<span style={{ color: '#595959' }}>Sin timbrar</span>} />
                </div>
                <Button type="primary" block onClick={iniciarTimbrado} icon={<SafetyCertificateOutlined />}>
                  Timbrar CFDI
                </Button>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 12, fontSize: 12 }}
                  message="Ambiente de Pruebas"
                  description="El timbrado se realizará en el ambiente demo"
                />
              </>
            )}

            {timbrado === 'timbrando' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <LoadingOutlined style={{ fontSize: 28, color: '#1677ff', marginBottom: 12 }} />
                <Progress percent={timbradoProgress} size="small" status="active" />
                <div style={{ marginTop: 8, color: '#595959', fontSize: 12 }}>{timbradoTexto}</div>
              </div>
            )}

            {timbrado === 'timbrado' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <Badge status="success" text={<span style={{ color: '#52c41a', fontWeight: 600 }}>Timbrada</span>} />
                </div>
                <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 11 }}>
                  <div style={{ marginBottom: 4 }}><strong>UUID:</strong></div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all', color: '#595959' }}>{UUID_FICTICIO}</div>
                  <div style={{ marginTop: 6 }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    <span style={{ color: '#595959' }}>Timbrado: {horaTimbrado}</span>
                  </div>
                </div>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    block
                    icon={<DownloadOutlined />}
                    onClick={() => message.info('XML disponible en el ERP completo')}
                  >
                    Descargar XML
                  </Button>
                  <Button
                    block
                    icon={<FilePdfOutlined />}
                    type="primary"
                    onClick={handleDescargarPDF}
                  >
                    Descargar PDF
                  </Button>
                </Space>
              </>
            )}
          </Card>

          {/* Resumen de pago */}
          <Card
            size="small"
            title={<Space><DollarOutlined /> Resumen de Pago</Space>}
            style={{ borderRadius: 8 }}
          >
            <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
              <Col span={24}>
                <Statistic
                  title="Total Factura"
                  value={FACTURA.total}
                  precision={2}
                  prefix="$"
                  suffix="MXN"
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Pagado"
                  value={totalPagado}
                  precision={2}
                  prefix="$"
                  valueStyle={{ fontSize: 14, color: '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Saldo"
                  value={saldo}
                  precision={2}
                  prefix="$"
                  valueStyle={{ fontSize: 14, color: saldo > 0 ? '#ff4d4f' : '#52c41a' }}
                />
              </Col>
            </Row>

            {saldo > 0 && (
              <Button
                type="primary"
                block
                icon={<PlusOutlined />}
                onClick={abrirPagoModal}
                style={{ marginBottom: 12 }}
              >
                Registrar Pago
              </Button>
            )}

            {saldo <= 0 && (
              <div style={{ textAlign: 'center', padding: 8, background: '#f6ffed', borderRadius: 6, marginBottom: 12 }}>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                <Text strong style={{ color: '#52c41a' }}>Factura pagada al 100%</Text>
              </div>
            )}

            {pagos.length > 0 && (
              <>
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Historial de Pagos</Text>
                <Table
                  dataSource={pagos}
                  columns={pagosColumns}
                  pagination={false}
                  size="small"
                  rowKey="id"
                  style={{ fontSize: 11 }}
                />
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* ─── Modal registrar pago ──────────────────────────────────── */}
      <Modal
        open={pagoModal}
        onCancel={() => setPagoModal(false)}
        footer={null}
        title="Registrar Pago"
        width={400}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>Monto</Text>
          <InputNumber
            prefix="$"
            value={pagoMonto}
            onChange={v => setPagoMonto(v ?? 0)}
            style={{ width: '100%' }}
            size="large"
            min={0}
            max={saldo}
            precision={2}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>Método de Pago</Text>
          <Select
            value={pagoMetodo}
            onChange={setPagoMetodo}
            style={{ width: '100%' }}
            size="large"
          >
            <Select.Option value="Transferencia">Transferencia</Select.Option>
            <Select.Option value="Efectivo">Efectivo</Select.Option>
            <Select.Option value="Tarjeta">Tarjeta</Select.Option>
            <Select.Option value="Cheque">Cheque</Select.Option>
          </Select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>Referencia (opcional)</Text>
          <Input
            value={pagoRef}
            onChange={e => setPagoRef(e.target.value)}
            placeholder="Ej: REF-12345"
            size="large"
          />
        </div>
        <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Saldo pendiente:</span>
            <span style={{ fontWeight: 600, color: '#ff4d4f' }}>{formatMoney(saldo)}</span>
          </div>
        </div>
        <Button
          type="primary"
          block
          size="large"
          onClick={confirmarPago}
          style={{ background: '#52c41a', borderColor: '#52c41a', height: 48 }}
        >
          <CheckCircleOutlined /> Confirmar Pago
        </Button>
      </Modal>
    </div>
  )
}
