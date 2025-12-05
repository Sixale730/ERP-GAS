'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Card, Typography, message, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title } = Typography

interface Proveedor {
  id: string
  codigo: string
  razon_social: string
  nombre_comercial: string | null
  rfc: string | null
  telefono: string | null
  email: string | null
  dias_credito: number
}

export default function ProveedoresPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    loadProveedores()
  }, [])

  const loadProveedores = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('proveedores')
        .select('*')
        .eq('is_active', true)
        .order('razon_social')

      if (error) throw error
      setProveedores(data || [])
    } catch (error) {
      console.error('Error loading proveedores:', error)
      message.error('Error al cargar proveedores')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseClient()

    try {
      const { error } = await supabase
        .schema('erp')
        .from('proveedores')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
      message.success('Proveedor eliminado')
      loadProveedores()
    } catch (error) {
      console.error('Error:', error)
      message.error('Error al eliminar')
    }
  }

  const filteredProveedores = proveedores.filter(
    (p) =>
      p.razon_social.toLowerCase().includes(searchText.toLowerCase()) ||
      p.codigo.toLowerCase().includes(searchText.toLowerCase()) ||
      (p.rfc && p.rfc.toLowerCase().includes(searchText.toLowerCase()))
  )

  const columns: ColumnsType<Proveedor> = [
    { title: 'Código', dataIndex: 'codigo', key: 'codigo', width: 100 },
    {
      title: 'Razón Social',
      dataIndex: 'razon_social',
      key: 'razon_social',
      sorter: (a, b) => a.razon_social.localeCompare(b.razon_social),
    },
    { title: 'Nombre Comercial', dataIndex: 'nombre_comercial', key: 'nombre_comercial', render: (v) => v || '-' },
    { title: 'RFC', dataIndex: 'rfc', key: 'rfc', width: 140, render: (v) => v || '-' },
    { title: 'Teléfono', dataIndex: 'telefono', key: 'telefono', width: 130, render: (v) => v || '-' },
    { title: 'Días Crédito', dataIndex: 'dias_credito', key: 'dias_credito', width: 100, align: 'center' },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => router.push(`/catalogos/proveedores/${record.id}/editar`)} />
          <Popconfirm title="¿Eliminar proveedor?" onConfirm={() => handleDelete(record.id)} okText="Sí" cancelText="No">
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Proveedores</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/catalogos/proveedores/nuevo')}>
          Nuevo Proveedor
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="Buscar por código, nombre o RFC..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </Space>

        <Table
          dataSource={filteredProveedores}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (total) => `${total} proveedores` }}
        />
      </Card>
    </div>
  )
}
