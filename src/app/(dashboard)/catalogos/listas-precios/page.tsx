'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Card, Typography, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, StarFilled } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title } = Typography

interface ListaPrecio {
  id: string
  codigo: string
  nombre: string
  moneda: string
  is_default: boolean
}

export default function ListasPreciosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [listas, setListas] = useState<ListaPrecio[]>([])
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    loadListas()
  }, [])

  const loadListas = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('listas_precios')
        .select('*')
        .eq('is_active', true)
        .order('nombre')

      if (error) throw error
      setListas(data || [])
    } catch (error) {
      console.error('Error:', error)
      message.error('Error al cargar listas')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseClient()

    try {
      const { error } = await supabase
        .schema('erp')
        .from('listas_precios')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
      message.success('Lista eliminada')
      loadListas()
    } catch (error) {
      console.error('Error:', error)
      message.error('Error al eliminar')
    }
  }

  const filteredListas = listas.filter(
    (l) =>
      l.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
      l.codigo.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns: ColumnsType<ListaPrecio> = useMemo(() => [
    { title: 'Código', dataIndex: 'codigo', key: 'codigo', width: 120 },
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      render: (nombre, record) => (
        <Space>
          {nombre}
          {record.is_default && <Tag icon={<StarFilled />} color="gold">Default</Tag>}
        </Space>
      ),
    },
    {
      title: 'Moneda',
      dataIndex: 'moneda',
      key: 'moneda',
      width: 100,
      render: (moneda) => <Tag color={moneda === 'USD' ? 'green' : 'blue'}>{moneda}</Tag>,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => router.push(`/catalogos/listas-precios/${record.id}/editar`)} />
          <Popconfirm
            title="¿Eliminar lista?"
            onConfirm={() => handleDelete(record.id)}
            okText="Sí"
            cancelText="No"
            disabled={record.is_default}
          >
            <Button type="link" danger icon={<DeleteOutlined />} disabled={record.is_default} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [router])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Listas de Precios</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/catalogos/listas-precios/nuevo')}>
          Nueva Lista
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="Buscar lista..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </Space>

        <Table
          dataSource={filteredListas}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (total) => `${total} listas` }}
        />
      </Card>
    </div>
  )
}
