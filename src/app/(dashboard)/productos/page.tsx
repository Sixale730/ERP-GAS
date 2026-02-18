'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useProductos, useDeleteProducto } from '@/lib/hooks/queries/useProductos'
import { TableSkeleton } from '@/components/common/Skeletons'
import type { ProductoStock } from '@/types/database'

const { Title } = Typography

export default function ProductosPage() {
  const router = useRouter()
  const [searchText, setSearchText] = useState('')
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 })

  // React Query hooks with server-side pagination
  const { data: productosResult, isLoading, isError, error } = useProductos(pagination)
  const productos = productosResult?.data ?? []
  const deleteProducto = useDeleteProducto()

  const handleDelete = async (id: string) => {
    try {
      await deleteProducto.mutateAsync(id)
      message.success('Producto eliminado')
    } catch (error) {
      console.error('Error deleting producto:', error)
      message.error('Error al eliminar producto')
    }
  }

  // Filtrar con useMemo para evitar recálculos innecesarios
  const filteredProductos = useMemo(() =>
    productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchText.toLowerCase())
    ),
    [productos, searchText]
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
      title: 'Categoria',
      dataIndex: 'categoria_nombre',
      key: 'categoria_nombre',
      render: (cat) => cat || <span style={{ color: '#999' }}>Sin categoria</span>,
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
            title="Eliminar producto?"
            description="El producto sera desactivado"
            onConfirm={() => handleDelete(record.id)}
            okText="Si"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              loading={deleteProducto.isPending}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (isError) {
    message.error(`Error al cargar productos: ${error?.message}`)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
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
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por SKU o nombre..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: '100%', maxWidth: 300 }}
            allowClear
          />
        </Space>

        {isLoading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : (
          <Table
            dataSource={filteredProductos}
            columns={columns}
            rowKey="id"
            scroll={{ x: 800 }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total: productosResult?.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} productos`,
              onChange: (page, pageSize) => setPagination({ page, pageSize }),
            }}
          />
        )}
      </Card>
    </div>
  )
}
