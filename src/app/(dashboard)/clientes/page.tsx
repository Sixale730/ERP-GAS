'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useClientes, useDeleteCliente } from '@/lib/hooks/queries/useClientes'
import { TableSkeleton } from '@/components/common/Skeletons'
import { formatMoney } from '@/lib/utils/format'
import type { Cliente } from '@/types/database'

const { Title } = Typography

export default function ClientesPage() {
  const router = useRouter()
  const [searchText, setSearchText] = useState('')

  // React Query hooks
  const { data: clientes = [], isLoading, isError, error } = useClientes()
  const deleteCliente = useDeleteCliente()

  const handleDelete = async (id: string) => {
    try {
      await deleteCliente.mutateAsync(id)
      message.success('Cliente eliminado')
    } catch (error) {
      console.error('Error deleting cliente:', error)
      message.error('Error al eliminar cliente')
    }
  }

  // Filtrar con useMemo para evitar recálculos innecesarios
  const filteredClientes = useMemo(() =>
    clientes.filter(
      (c) =>
        c.nombre_comercial.toLowerCase().includes(searchText.toLowerCase()) ||
        c.codigo.toLowerCase().includes(searchText.toLowerCase()) ||
        (c.rfc && c.rfc.toLowerCase().includes(searchText.toLowerCase()))
    ),
    [clientes, searchText]
  )

  const columns: ColumnsType<Cliente> = [
    {
      title: 'Codigo',
      dataIndex: 'codigo',
      key: 'codigo',
      width: 100,
    },
    {
      title: 'Nombre Comercial',
      dataIndex: 'nombre_comercial',
      key: 'nombre_comercial',
      sorter: (a, b) => a.nombre_comercial.localeCompare(b.nombre_comercial),
    },
    {
      title: 'RFC',
      dataIndex: 'rfc',
      key: 'rfc',
      width: 140,
      render: (rfc) => rfc || '-',
    },
    {
      title: 'Telefono',
      dataIndex: 'telefono',
      key: 'telefono',
      width: 130,
      render: (tel) => tel || '-',
    },
    {
      title: 'Saldo Pendiente',
      dataIndex: 'saldo_pendiente',
      key: 'saldo_pendiente',
      width: 140,
      align: 'right',
      sorter: (a, b) => a.saldo_pendiente - b.saldo_pendiente,
      render: (saldo) => (
        <span style={{ color: saldo > 0 ? '#cf1322' : 'inherit' }}>
          {formatMoney(saldo)}
        </span>
      ),
    },
    {
      title: 'Credito',
      key: 'credito',
      width: 120,
      render: (_, record) => {
        if (record.limite_credito === 0) return <Tag>Sin credito</Tag>
        const porcentaje = (record.saldo_pendiente / record.limite_credito) * 100
        let color = 'green'
        if (porcentaje > 80) color = 'red'
        else if (porcentaje > 50) color = 'orange'
        return <Tag color={color}>{formatMoney(record.limite_credito)}</Tag>
      },
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
            onClick={() => router.push(`/clientes/${record.id}`)}
          />
          <Popconfirm
            title="Eliminar cliente?"
            onConfirm={() => handleDelete(record.id)}
            okText="Si"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              loading={deleteCliente.isPending}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (isError) {
    message.error(`Error al cargar clientes: ${error?.message}`)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>Clientes</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/clientes/nuevo')}
        >
          Nuevo Cliente
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por codigo, nombre o RFC..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: '100%', maxWidth: 300 }}
            allowClear
          />
        </Space>

        {isLoading ? (
          <TableSkeleton rows={8} columns={7} />
        ) : (
          <Table
            dataSource={filteredClientes}
            columns={columns}
            rowKey="id"
            scroll={{ x: 900 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `${total} clientes`,
            }}
          />
        )}
      </Card>
    </div>
  )
}
