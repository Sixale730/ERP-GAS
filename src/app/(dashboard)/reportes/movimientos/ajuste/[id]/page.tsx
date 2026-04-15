'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Card, Typography, Space, Button, Tag, Table, Row, Col, Statistic, Spin, Descriptions, Divider, message
} from 'antd'
import {
  ArrowLeftOutlined, RobotOutlined, UserOutlined, CalendarOutlined,
  ArrowUpOutlined, ArrowDownOutlined, FileTextOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatDateTime } from '@/lib/utils/format'

const { Title, Text, Paragraph } = Typography

interface AjusteHeader {
  id: string
  motivo: string
  descripcion: string | null
  es_sistema: boolean
  aprobado_por: string | null
  creado_por_nombre: string | null
  total_productos: number
  total_piezas_agregadas: number
  total_piezas_removidas: number
  created_at: string
}

interface AjusteItem {
  id: string
  producto_id: string
  almacen_id: string
  cantidad_antes: number
  cantidad_despues: number
  diferencia: number
  justificacion: string | null
  sku: string
  producto_nombre: string
  almacen_nombre: string
}

export default function AjusteDetallePage() {
  const params = useParams()
  const router = useRouter()
  const { orgId } = useAuth()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [ajuste, setAjuste] = useState<AjusteHeader | null>(null)
  const [items, setItems] = useState<AjusteItem[]>([])

  useEffect(() => {
    if (id && orgId) loadAjuste()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, orgId])

  const loadAjuste = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)
    try {
      const [headerRes, itemsRes] = await Promise.all([
        supabase.schema('erp').from('ajustes_inventario').select('*').eq('id', id).eq('organizacion_id', orgId!).single(),
        supabase.schema('erp').from('ajuste_inventario_items').select(`
          id, producto_id, almacen_id,
          cantidad_antes, cantidad_despues, diferencia, justificacion,
          productos:producto_id (sku, nombre),
          almacenes:almacen_id (nombre)
        `).eq('ajuste_id', id).eq('organizacion_id', orgId!),
      ])

      if (headerRes.error) throw headerRes.error
      setAjuste(headerRes.data as AjusteHeader)

      const itemsFormatted: AjusteItem[] = (itemsRes.data || []).map((r: any) => ({
        id: r.id,
        producto_id: r.producto_id,
        almacen_id: r.almacen_id,
        cantidad_antes: Number(r.cantidad_antes),
        cantidad_despues: Number(r.cantidad_despues),
        diferencia: Number(r.diferencia),
        justificacion: r.justificacion,
        sku: r.productos?.sku || '-',
        producto_nombre: r.productos?.nombre || '-',
        almacen_nombre: r.almacenes?.nombre || '-',
      }))
      setItems(itemsFormatted)
    } catch (error: any) {
      console.error('Error loading ajuste:', error)
      message.error(error.message || 'Error al cargar ajuste')
    } finally {
      setLoading(false)
    }
  }

  const columns: ColumnsType<AjusteItem> = useMemo(() => [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 130 },
    { title: 'Producto', dataIndex: 'producto_nombre', key: 'producto_nombre', ellipsis: true },
    { title: 'Almacén', dataIndex: 'almacen_nombre', key: 'almacen_nombre', width: 140 },
    {
      title: 'Antes',
      dataIndex: 'cantidad_antes',
      key: 'antes',
      width: 90,
      align: 'right',
      render: (v: number) => <Text>{v}</Text>,
    },
    {
      title: 'Después',
      dataIndex: 'cantidad_despues',
      key: 'despues',
      width: 90,
      align: 'right',
      render: (v: number) => <Text strong>{v}</Text>,
    },
    {
      title: 'Diferencia',
      dataIndex: 'diferencia',
      key: 'diferencia',
      width: 110,
      align: 'right',
      render: (v: number) => (
        <Tag color={v > 0 ? 'green' : 'red'} icon={v > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}>
          {v > 0 ? '+' : ''}{v}
        </Tag>
      ),
    },
    {
      title: 'Justificación',
      dataIndex: 'justificacion',
      key: 'justificacion',
      render: (v: string | null) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">-</Text>,
    },
  ], [])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
  }

  if (!ajuste) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Text type="secondary">Ajuste no encontrado</Text>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes/movimientos')}>
            Volver a movimientos
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            <FileTextOutlined /> Detalle de Ajuste Masivo
          </Title>
        </Space>
        {ajuste.es_sistema && (
          <Tag color="volcano" icon={<RobotOutlined />} style={{ fontSize: 13, padding: '4px 10px' }}>
            Ejecutado por Sistema
          </Tag>
        )}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} bordered size="small">
          <Descriptions.Item label="Motivo" span={3}>
            <Text strong>{ajuste.motivo}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={<Space><CalendarOutlined />Fecha</Space>}>
            {formatDateTime(ajuste.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label={<Space><UserOutlined />Ejecutado por</Space>}>
            {ajuste.creado_por_nombre || <Text type="secondary">Sistema</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Aprobado por">
            {ajuste.aprobado_por
              ? <Tag color="green">{ajuste.aprobado_por}</Tag>
              : <Text type="secondary">-</Text>}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Productos ajustados"
              value={ajuste.total_productos}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Piezas agregadas"
              value={Number(ajuste.total_piezas_agregadas)}
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix="pzs"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Piezas removidas"
              value={Number(ajuste.total_piezas_removidas)}
              prefix={<ArrowDownOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
              suffix="pzs"
            />
          </Card>
        </Col>
      </Row>

      {ajuste.descripcion && (
        <Card title="Informe completo" style={{ marginBottom: 16 }}>
          <Paragraph style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginBottom: 0 }}>
            {ajuste.descripcion}
          </Paragraph>
        </Card>
      )}

      <Card title={`Productos ajustados (${items.length})`}>
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          pagination={false}
          scroll={{ x: 900 }}
          size="middle"
        />
        <Divider style={{ margin: '16px 0 8px' }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Cada fila tiene un movimiento asociado en el historial de inventario con referencia &quot;Ajuste Masivo&quot;.
        </Text>
      </Card>
    </div>
  )
}
