'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Card, Button, Space, Typography, Tag, Descriptions, Divider, message, Spin, Row, Col, Table
} from 'antd'
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils/format'

const { Title, Text } = Typography

interface ProductoDetalle {
  id: string
  sku: string
  codigo_barras: string | null
  nombre: string
  descripcion: string | null
  categoria_id: string | null
  categoria_nombre: string | null
  proveedor_principal_id: string | null
  proveedor_nombre: string | null
  unidad_medida: string
  costo_promedio: number
  stock_minimo: number
  stock_maximo: number
  stock_total: number
  reservado_total: number
  disponible_total: number
  is_active: boolean
}

interface PrecioLista {
  id: string
  lista_nombre: string
  precio: number
}

interface InventarioAlmacen {
  almacen_id: string
  almacen_nombre: string
  cantidad: number
  reservado: number
  disponible: number
}

export default function ProductoDetallePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [producto, setProducto] = useState<ProductoDetalle | null>(null)
  const [precios, setPrecios] = useState<PrecioLista[]>([])
  const [inventario, setInventario] = useState<InventarioAlmacen[]>([])

  useEffect(() => {
    if (id) {
      loadProducto()
    }
  }, [id])

  const loadProducto = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      // Load producto from view
      const { data: prodData, error: prodError } = await supabase
        .schema('erp')
        .from('v_productos_stock')
        .select('*')
        .eq('id', id)
        .single()

      if (prodError) throw prodError
      setProducto(prodData)

      // Load precios
      const { data: preciosData, error: preciosError } = await supabase
        .schema('erp')
        .from('precios_productos')
        .select(`
          id,
          precio,
          listas_precios:lista_precio_id (nombre)
        `)
        .eq('producto_id', id)

      if (!preciosError && preciosData) {
        const preciosFormatted = preciosData.map(p => ({
          id: p.id,
          lista_nombre: (p.listas_precios as any)?.nombre || 'Sin nombre',
          precio: p.precio
        }))
        setPrecios(preciosFormatted)
      }

      // Load inventario por almacén
      const { data: invData, error: invError } = await supabase
        .schema('erp')
        .from('inventario')
        .select(`
          cantidad,
          reservado,
          almacenes:almacen_id (id, nombre)
        `)
        .eq('producto_id', id)

      if (!invError && invData) {
        const invFormatted = invData.map(i => ({
          almacen_id: (i.almacenes as any)?.id,
          almacen_nombre: (i.almacenes as any)?.nombre || 'Sin nombre',
          cantidad: i.cantidad,
          reservado: i.reservado || 0,
          disponible: i.cantidad - (i.reservado || 0)
        }))
        setInventario(invFormatted)
      }
    } catch (error) {
      console.error('Error loading producto:', error)
      message.error('Error al cargar producto')
      router.push('/productos')
    } finally {
      setLoading(false)
    }
  }

  const preciosColumns = [
    {
      title: 'Lista de Precios',
      dataIndex: 'lista_nombre',
      key: 'lista_nombre',
    },
    {
      title: 'Precio',
      dataIndex: 'precio',
      key: 'precio',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
  ]

  const inventarioColumns = [
    {
      title: 'Almacén',
      dataIndex: 'almacen_nombre',
      key: 'almacen_nombre',
    },
    {
      title: 'Cantidad',
      dataIndex: 'cantidad',
      key: 'cantidad',
      align: 'right' as const,
    },
    {
      title: 'Reservado',
      dataIndex: 'reservado',
      key: 'reservado',
      align: 'right' as const,
    },
    {
      title: 'Disponible',
      dataIndex: 'disponible',
      key: 'disponible',
      align: 'right' as const,
      render: (val: number) => (
        <Tag color={val > 0 ? 'green' : 'red'}>{val}</Tag>
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

  if (!producto) {
    return null
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/productos')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {producto.nombre}
          </Title>
          <Tag color={producto.is_active ? 'green' : 'red'}>
            {producto.is_active ? 'Activo' : 'Inactivo'}
          </Tag>
        </Space>

        <Button type="primary" icon={<EditOutlined />} onClick={() => router.push(`/productos/${id}/editar`)}>
          Editar
        </Button>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Información del Producto" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="SKU">
                <Text strong copyable>{producto.sku}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Código de Barras">
                {producto.codigo_barras || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Categoría">
                {producto.categoria_nombre || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Proveedor">
                {producto.proveedor_nombre || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Unidad de Medida">
                {producto.unidad_medida}
              </Descriptions.Item>
              <Descriptions.Item label="Costo Promedio">
                {formatMoney(producto.costo_promedio || 0)}
              </Descriptions.Item>
              <Descriptions.Item label="Stock Mínimo">
                {producto.stock_minimo}
              </Descriptions.Item>
              <Descriptions.Item label="Stock Máximo">
                {producto.stock_maximo}
              </Descriptions.Item>
            </Descriptions>
            {producto.descripcion && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Text type="secondary">Descripción: {producto.descripcion}</Text>
              </>
            )}
          </Card>

          <Card title="Precios por Lista" style={{ marginBottom: 16 }}>
            <Table
              dataSource={precios}
              columns={preciosColumns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'Sin precios configurados' }}
            />
          </Card>

          {inventario.length > 0 && (
            <Card title="Inventario por Almacén">
              <Table
                dataSource={inventario}
                columns={inventarioColumns}
                rowKey="almacen_id"
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Resumen de Stock" style={{ position: 'sticky', top: 88 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Stock Total:</Text>
                <Text strong>{producto.stock_total}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Reservado:</Text>
                <Text type="warning">{producto.reservado_total}</Text>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={4} style={{ margin: 0 }}>Disponible:</Title>
                <Title level={4} style={{
                  margin: 0,
                  color: producto.disponible_total > 0 ? '#3f8600' : '#cf1322'
                }}>
                  {producto.disponible_total}
                </Title>
              </div>

              {producto.disponible_total <= producto.stock_minimo && (
                <Tag color="orange" style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
                  Stock bajo el mínimo ({producto.stock_minimo})
                </Tag>
              )}

              {producto.disponible_total === 0 && (
                <Tag color="red" style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
                  Sin stock disponible
                </Tag>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
