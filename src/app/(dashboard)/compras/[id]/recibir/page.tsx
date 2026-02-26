'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card,
  Button,
  Table,
  InputNumber,
  Input,
  Space,
  Typography,
  message,
  Row,
  Col,
  Tag,
  Spin,
  Progress,
  Alert,
} from 'antd'
import { ArrowLeftOutlined, CheckOutlined, InboxOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { OrdenCompra, OrdenCompraItem, Producto } from '@/types/database'

const { Title, Text } = Typography

interface ItemRecepcion {
  id: string
  producto_id: string
  sku: string
  nombre: string
  cantidad_solicitada: number
  cantidad_recibida: number
  cantidad_pendiente: number
  cantidad_a_recibir: number
  numero_lote: string
  notas: string
}

export default function RecibirMercanciaPage() {
  const router = useRouter()
  const params = useParams()
  const ordenId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [orden, setOrden] = useState<OrdenCompra | null>(null)
  const [items, setItems] = useState<ItemRecepcion[]>([])

  useEffect(() => {
    if (ordenId) {
      loadOrden()
    }
  }, [ordenId])

  const loadOrden = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // Cargar orden
      const { data: ordenData, error: ordenError } = await supabase
        .schema('erp')
        .from('ordenes_compra')
        .select('*')
        .eq('id', ordenId)
        .single()

      if (ordenError) throw ordenError
      setOrden(ordenData)

      // Verificar status
      if (ordenData.status !== 'enviada' && ordenData.status !== 'parcialmente_recibida') {
        message.warning('Esta orden no puede recibir mercancia')
        router.push(`/compras/${ordenId}`)
        return
      }

      // Cargar items
      const { data: itemsData } = await supabase
        .schema('erp')
        .from('orden_compra_items')
        .select('*')
        .eq('orden_compra_id', ordenId)
        .order('created_at')

      if (itemsData) {
        const productIds = itemsData.map((i) => i.producto_id)
        const { data: productosData } = await supabase
          .schema('erp')
          .from('productos')
          .select('*')
          .in('id', productIds)

        const productosMap = new Map(productosData?.map((p) => [p.id, p]))

        setItems(
          itemsData
            .filter((item) => item.cantidad_recibida < item.cantidad_solicitada)
            .map((item) => {
              const producto = productosMap.get(item.producto_id)
              return {
                id: item.id,
                producto_id: item.producto_id,
                sku: producto?.sku || '-',
                nombre: producto?.nombre || '-',
                cantidad_solicitada: item.cantidad_solicitada,
                cantidad_recibida: item.cantidad_recibida,
                cantidad_pendiente: item.cantidad_solicitada - item.cantidad_recibida,
                cantidad_a_recibir: 0,
                numero_lote: '',
                notas: '',
              }
            })
        )
      }
    } catch (error) {
      console.error('Error loading orden:', error)
      message.error('Error al cargar la orden')
    } finally {
      setLoading(false)
    }
  }

  const handleItemChange = (id: string, field: keyof ItemRecepcion, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item
        return { ...item, [field]: value }
      })
    )
  }

  const handleRecibirTodo = (id: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item
        return { ...item, cantidad_a_recibir: item.cantidad_pendiente }
      })
    )
  }

  const handleConfirmarRecepcion = async () => {
    const itemsARecibir = items.filter((item) => item.cantidad_a_recibir > 0)

    if (itemsARecibir.length === 0) {
      message.warning('Ingresa al menos una cantidad a recibir')
      return
    }

    // Validar cantidades
    for (const item of itemsARecibir) {
      if (item.cantidad_a_recibir > item.cantidad_pendiente) {
        message.error(`La cantidad a recibir de ${item.sku} excede la cantidad pendiente`)
        return
      }
    }

    setSaving(true)
    const supabase = getSupabaseClient()

    try {
      // Llamar a la funcion registrar_recepcion por cada item en paralelo
      await Promise.all(itemsARecibir.map(async (item) => {
        const { error } = await supabase
          .schema('erp')
          .rpc('registrar_recepcion', {
            p_orden_compra_item_id: item.id,
            p_cantidad: item.cantidad_a_recibir,
            p_notas: item.notas || null,
            p_numero_lote: item.numero_lote || null,
          })

        if (error) {
          console.error('Error en recepcion:', error)
          throw new Error(`Error al recibir ${item.sku}: ${error.message}`)
        }
      }))

      message.success('Mercancia recibida correctamente. El inventario ha sido actualizado.')
      router.push(`/compras/${ordenId}`)
    } catch (error: any) {
      console.error('Error:', error)
      message.error(error.message || 'Error al registrar la recepcion')
    } finally {
      setSaving(false)
    }
  }

  const totalPendiente = items.reduce((acc, item) => acc + item.cantidad_pendiente, 0)
  const totalARecibir = items.reduce((acc, item) => acc + item.cantidad_a_recibir, 0)

  const columns: ColumnsType<ItemRecepcion> = useMemo(() => [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 100,
    },
    {
      title: 'Producto',
      dataIndex: 'nombre',
      key: 'nombre',
      ellipsis: true,
    },
    {
      title: 'Solicitado',
      dataIndex: 'cantidad_solicitada',
      key: 'cantidad_solicitada',
      width: 90,
      align: 'right',
    },
    {
      title: 'Recibido',
      dataIndex: 'cantidad_recibida',
      key: 'cantidad_recibida',
      width: 90,
      align: 'right',
    },
    {
      title: 'Pendiente',
      dataIndex: 'cantidad_pendiente',
      key: 'cantidad_pendiente',
      width: 90,
      align: 'right',
      render: (pendiente) => <Text type="warning">{pendiente}</Text>,
    },
    {
      title: 'Cantidad a Recibir',
      key: 'cantidad_a_recibir',
      width: 150,
      render: (_, record) => (
        <Space>
          <InputNumber
            min={0}
            max={record.cantidad_pendiente}
            value={record.cantidad_a_recibir}
            onChange={(val) => handleItemChange(record.id, 'cantidad_a_recibir', val || 0)}
            style={{ width: 80 }}
          />
          <Button size="small" onClick={() => handleRecibirTodo(record.id)}>
            Todo
          </Button>
        </Space>
      ),
    },
    {
      title: 'Lote',
      key: 'numero_lote',
      width: 120,
      render: (_, record) => (
        <Input
          placeholder="Lote"
          value={record.numero_lote}
          onChange={(e) => handleItemChange(record.id, 'numero_lote', e.target.value)}
          disabled={record.cantidad_a_recibir === 0}
        />
      ),
    },
    {
      title: 'Notas',
      key: 'notas',
      width: 150,
      render: (_, record) => (
        <Input
          placeholder="Notas"
          value={record.notas}
          onChange={(e) => handleItemChange(record.id, 'notas', e.target.value)}
          disabled={record.cantidad_a_recibir === 0}
        />
      ),
    },
  ], [handleItemChange, handleRecibirTodo])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!orden) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Text type="secondary">Orden no encontrada</Text>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/compras/${ordenId}`)}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            Recibir Mercancia - {orden.folio}
          </Title>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={18}>
          <Card style={{ marginBottom: 16 }}>
            <Alert
              message="Registra las cantidades recibidas"
              description="Ingresa la cantidad recibida para cada producto. Puedes hacer recepciones parciales. El inventario se actualizara automaticamente."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Table
              dataSource={items}
              columns={columns}
              rowKey="id"
              pagination={false}
              scroll={{ x: 900 }}
              locale={{ emptyText: 'Todos los items han sido recibidos' }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title="Resumen de Recepcion" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text type="secondary">Items pendientes</Text>
                <br />
                <Text strong style={{ fontSize: 24 }}>{items.length}</Text>
              </div>
              <div>
                <Text type="secondary">Unidades pendientes</Text>
                <br />
                <Text strong style={{ fontSize: 24 }}>{totalPendiente}</Text>
              </div>
              <div>
                <Text type="secondary">Unidades a recibir</Text>
                <br />
                <Text strong style={{ fontSize: 24, color: totalARecibir > 0 ? '#1890ff' : undefined }}>
                  {totalARecibir}
                </Text>
              </div>
            </Space>

            <Button
              type="primary"
              size="large"
              block
              icon={<CheckOutlined />}
              onClick={handleConfirmarRecepcion}
              loading={saving}
              disabled={totalARecibir === 0}
              style={{ marginTop: 24 }}
            >
              Confirmar Recepcion
            </Button>
          </Card>

          <Card title="Informacion">
            <Text type="secondary">
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li>Puedes recibir cantidades parciales</li>
                <li>El inventario se actualiza automaticamente</li>
                <li>Se registra un movimiento de entrada por cada item</li>
                <li>El numero de lote es opcional</li>
              </ul>
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
