'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button, Input, Space, Tag, Card, Typography, message, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useRouter } from 'next/navigation'
import { useProductos, useDeleteProducto } from '@/lib/hooks/queries/useProductos'
import { TableSkeleton } from '@/components/common/Skeletons'
import { PageHeaderActions } from '@/components/common/PageHeaderActions'
import { ResponsiveListTable } from '@/components/common/ResponsiveListTable'
import type { ProductoStock } from '@/types/database'

const { Text } = Typography

export default function ProductosPage() {
  const router = useRouter()
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 })

  // Debounce search text and reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText)
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText])

  // React Query hooks with server-side pagination and search
  const { data: productosResult, isLoading, isError, error } = useProductos(pagination, debouncedSearch)
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

  const columns: ColumnsType<ProductoStock> = useMemo(() => [
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
      width: 260,
      ellipsis: true,
      sorter: (a, b) => a.nombre.localeCompare(b.nombre),
    },
    {
      title: 'Categoria',
      dataIndex: 'categoria_nombre',
      key: 'categoria_nombre',
      width: 150,
      ellipsis: true,
      render: (cat) => cat || <span style={{ color: '#999' }}>Sin categoria</span>,
    },
    {
      title: 'Total en físico',
      dataIndex: 'stock_total',
      key: 'stock_total',
      width: 130,
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
      title: 'Disponible para venta',
      dataIndex: 'disponible_total',
      key: 'disponible_total',
      width: 160,
      align: 'right',
      render: (disponible) => disponible,
    },
    {
      title: 'En tránsito',
      dataIndex: 'en_transito_total',
      key: 'en_transito_total',
      width: 110,
      align: 'right',
      render: (v) => v || 0,
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
              href={`/productos/${record.id}`}
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
  ], [deleteProducto.isPending])

  if (isError) {
    message.error(`Error al cargar productos: ${error?.message}`)
  }

  return (
    <div>
      <PageHeaderActions
        titulo="Productos"
        actions={
          <Button type="primary" icon={<PlusOutlined />} href="/productos/nuevo">
            Nuevo Producto
          </Button>
        }
      />

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
          <ResponsiveListTable<ProductoStock>
            dataSource={productos}
            columns={columns}
            rowKey="id"
            scroll={{ x: 1250 }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total: productosResult?.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} productos`,
              onChange: (page, pageSize) => setPagination({ page, pageSize }),
            }}
            onMobileItemClick={(record) => router.push(`/productos/${record.id}`)}
            mobileRender={(p) => {
              const stockColor = p.stock_total === 0 ? 'red' : p.stock_total < 10 ? 'orange' : 'green'
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <Text strong style={{ fontSize: 14, wordBreak: 'break-word' }}>
                      {p.nombre}
                    </Text>
                    <Tag color={stockColor} style={{ margin: 0, flexShrink: 0 }}>
                      {p.stock_total}
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {p.sku}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {p.categoria_nombre || 'Sin categoría'}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <Text style={{ fontSize: 12 }}>Disp.: {p.disponible_total ?? 0}</Text>
                    <Text style={{ fontSize: 12 }}>Tránsito: {p.en_transito_total ?? 0}</Text>
                  </div>
                </div>
              )
            }}
          />
        )}
      </Card>
    </div>
  )
}
