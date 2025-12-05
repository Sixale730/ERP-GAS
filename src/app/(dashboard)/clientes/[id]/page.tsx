'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Button, Space, Typography, Tag, Descriptions, Divider, message, Spin, Row, Col, Table
} from 'antd'
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/utils/format'

const { Title, Text } = Typography

interface ClienteDetalle {
  id: string
  codigo: string
  nombre_comercial: string
  razon_social: string | null
  rfc: string | null
  regimen_fiscal: string | null
  uso_cfdi: string | null
  codigo_postal_fiscal: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  contacto_nombre: string | null
  lista_precio_id: string | null
  dias_credito: number
  limite_credito: number
  saldo_pendiente: number
  notas: string | null
  is_active: boolean
}

interface FacturaResumen {
  id: string
  folio: string
  fecha: string
  total: number
  saldo: number
  status: string
}

const statusColors: Record<string, string> = {
  pendiente: 'orange',
  parcial: 'blue',
  pagada: 'green',
  cancelada: 'red',
}

export default function ClienteDetallePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [cliente, setCliente] = useState<ClienteDetalle | null>(null)
  const [facturas, setFacturas] = useState<FacturaResumen[]>([])
  const [listaPrecioNombre, setListaPrecioNombre] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (id) {
      loadCliente()
    }
  }, [id])

  const loadCliente = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // Load cliente
      const { data: clienteData, error: clienteError } = await supabase
        .schema('erp')
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single()

      if (clienteError) throw clienteError
      setCliente(clienteData)

      // Load lista precio nombre
      if (clienteData.lista_precio_id) {
        const { data: listaData } = await supabase
          .schema('erp')
          .from('listas_precios')
          .select('nombre')
          .eq('id', clienteData.lista_precio_id)
          .single()
        if (listaData) setListaPrecioNombre(listaData.nombre)
      }

      // Load facturas recientes
      const { data: facturasData, error: facturasError } = await supabase
        .schema('erp')
        .from('v_facturas')
        .select('id, folio, fecha, total, saldo, status')
        .eq('cliente_id', id)
        .order('fecha', { ascending: false })
        .limit(10)

      if (!facturasError && facturasData) {
        setFacturas(facturasData)
      }
    } catch (error) {
      console.error('Error loading cliente:', error)
      message.error('Error al cargar cliente')
      router.push('/clientes')
    } finally {
      setLoading(false)
    }
  }

  const facturasColumns = [
    {
      title: 'Folio',
      dataIndex: 'folio',
      key: 'folio',
      render: (folio: string, record: FacturaResumen) => (
        <a onClick={() => router.push(`/facturas/${record.id}`)}>{folio}</a>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha',
      key: 'fecha',
      render: (fecha: string) => formatDate(fecha),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
    {
      title: 'Saldo',
      dataIndex: 'saldo',
      key: 'saldo',
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ color: val > 0 ? '#cf1322' : '#3f8600' }}>
          {formatMoney(val)}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status]}>{status}</Tag>
      ),
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!cliente) {
    return null
  }

  const creditoDisponible = cliente.limite_credito - cliente.saldo_pendiente
  const porcentajeUsado = cliente.limite_credito > 0
    ? (cliente.saldo_pendiente / cliente.limite_credito) * 100
    : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/clientes')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {cliente.nombre_comercial}
          </Title>
          <Tag color={cliente.is_active ? 'green' : 'red'}>
            {cliente.is_active ? 'Activo' : 'Inactivo'}
          </Tag>
        </Space>

        <Button type="primary" icon={<EditOutlined />} onClick={() => router.push(`/clientes/${id}/editar`)}>
          Editar
        </Button>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Información General" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="Código">{cliente.codigo}</Descriptions.Item>
              <Descriptions.Item label="Contacto">{cliente.contacto_nombre || '-'}</Descriptions.Item>
              <Descriptions.Item label="Teléfono">{cliente.telefono || '-'}</Descriptions.Item>
              <Descriptions.Item label="Email">{cliente.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="Dirección" span={2}>{cliente.direccion || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Datos Fiscales" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="Razón Social">{cliente.razon_social || '-'}</Descriptions.Item>
              <Descriptions.Item label="RFC">{cliente.rfc || '-'}</Descriptions.Item>
              <Descriptions.Item label="Régimen Fiscal">{cliente.regimen_fiscal || '-'}</Descriptions.Item>
              <Descriptions.Item label="Uso CFDI">{cliente.uso_cfdi || '-'}</Descriptions.Item>
              <Descriptions.Item label="C.P. Fiscal">{cliente.codigo_postal_fiscal || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Facturas Recientes">
            <Table
              dataSource={facturas}
              columns={facturasColumns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'Sin facturas' }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Condiciones Comerciales" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Lista de Precios:</Text>
                <Text strong>{listaPrecioNombre || 'No asignada'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Días de Crédito:</Text>
                <Text strong>{cliente.dias_credito}</Text>
              </div>
            </Space>
          </Card>

          <Card title="Estado de Cuenta" style={{ position: 'sticky', top: 88 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Límite de Crédito:</Text>
                <Text strong>{formatMoney(cliente.limite_credito)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Saldo Pendiente:</Text>
                <Text strong style={{ color: cliente.saldo_pendiente > 0 ? '#cf1322' : 'inherit' }}>
                  {formatMoney(cliente.saldo_pendiente)}
                </Text>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={4} style={{ margin: 0 }}>Crédito Disponible:</Title>
                <Title level={4} style={{
                  margin: 0,
                  color: creditoDisponible >= 0 ? '#3f8600' : '#cf1322'
                }}>
                  {formatMoney(creditoDisponible)}
                </Title>
              </div>

              {cliente.limite_credito > 0 && (
                <Tag
                  color={porcentajeUsado > 80 ? 'red' : porcentajeUsado > 50 ? 'orange' : 'green'}
                  style={{ width: '100%', textAlign: 'center', padding: '8px' }}
                >
                  {porcentajeUsado.toFixed(0)}% del crédito utilizado
                </Tag>
              )}
            </Space>
          </Card>

          {cliente.notas && (
            <Card title="Notas" style={{ marginTop: 16 }}>
              <Text type="secondary">{cliente.notas}</Text>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}
