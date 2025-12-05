'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { ProductoStock } from '@/types/database'

const { Title } = Typography

export default function ProductosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [productos, setProductos] = useState<ProductoStock[]>([])
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    loadProductos()
  }, [])

  const loadProductos = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('v_productos_stock')
        .select('*')
        .order('nombre')

      if (error) throw error
      setProductos(data || [])
    } catch (error) {
      console.error('Error loading productos:', error)
      message.error('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseClient()

    try {
      const { error } = await supabase
        .schema('erp')
        .from('productos')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error

      message.success('Producto eliminado')
      loadProductos()
    } catch (error) {
      console.error('Error deleting producto:', error)
      message.error('Error al eliminar producto')
    }
  }

  const filteredProductos = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns: ColumnsType<ProductoStock> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      sorter: (a, b) => a.sku.localeCompare(b.sku),
    },
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      sorter: (a, b) => a.nombre.localeCompare(b.nombre),
    },
    {
      title: 'Categoría',
      dataIndex: 'categoria_nombre',
      key: 'categoria_nombre',
      render: (cat) => cat || <span style={{ color: '#999' }}>Sin categoría</span>,
    },
    {
      title: 'Stock Total',
      dataIndex: 'stock_total',
      key: 'stock_total',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.stock_total - b.stock_total,
      render: (stock) => {
        let color = 'green'
        if (stock === 0) color = 'red'
        else if (stock < 10) color = 'orange'
        return <Tag color={color}>{stock}</Tag>
      },
    },
    {
      title: 'Disponible',
      dataIndex: 'disponible_total',
      key: 'disponible_total',
      width: 120,
      align: 'right',
      render: (disponible) => disponible,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => router.push(`/productos/${record.id}`)}
          />
          <Popconfirm
            title="¿Eliminar producto?"
            description="El producto será desactivado"
            onConfirm={() => handleDelete(record.id)}
            okText="Sí"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Productos</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/productos/nuevo')}
        >
          Nuevo Producto
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="Buscar por SKU o nombre..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </Space>

        <Table
          dataSource={filteredProductos}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} productos`,
          }}
        />
      </Card>
    </div>
  )
}
