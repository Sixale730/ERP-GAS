'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Card, Typography, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title } = Typography

interface Categoria {
  id: string
  nombre: string
  descripcion: string | null
  categoria_padre_id: string | null
  categoria_padre_nombre?: string
  is_active: boolean
}

export default function CategoriasPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    loadCategorias()
  }, [])

  const loadCategorias = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('categorias')
        .select(`
          *,
          categoria_padre:categoria_padre_id (nombre)
        `)
        .eq('is_active', true)
        .order('nombre')

      if (error) throw error

      const formattedData = data?.map(cat => ({
        ...cat,
        categoria_padre_nombre: (cat.categoria_padre as any)?.nombre || null
      })) || []

      setCategorias(formattedData)
    } catch (error) {
      console.error('Error loading categorias:', error)
      message.error('Error al cargar categorías')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseClient()

    try {
      const { error } = await supabase
        .schema('erp')
        .from('categorias')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
      message.success('Categoría eliminada')
      loadCategorias()
    } catch (error) {
      console.error('Error deleting categoria:', error)
      message.error('Error al eliminar categoría')
    }
  }

  const filteredCategorias = categorias.filter(
    (c) => c.nombre.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns: ColumnsType<Categoria> = [
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      sorter: (a, b) => a.nombre.localeCompare(b.nombre),
    },
    {
      title: 'Categoría Padre',
      dataIndex: 'categoria_padre_nombre',
      key: 'categoria_padre_nombre',
      render: (val) => val || <Tag>Raíz</Tag>,
    },
    {
      title: 'Descripción',
      dataIndex: 'descripcion',
      key: 'descripcion',
      render: (val) => val || '-',
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
            onClick={() => router.push(`/catalogos/categorias/${record.id}/editar`)}
          />
          <Popconfirm
            title="¿Eliminar categoría?"
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
        <Title level={2} style={{ margin: 0 }}>Categorías</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/catalogos/categorias/nuevo')}
        >
          Nueva Categoría
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="Buscar categoría..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </Space>

        <Table
          dataSource={filteredCategorias}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (total) => `${total} categorías` }}
        />
      </Card>
    </div>
  )
}
