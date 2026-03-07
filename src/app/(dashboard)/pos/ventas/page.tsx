'use client'

import { useState } from 'react'
import { Table, Tag, Typography, Card, Select, Space, Popconfirm, Button, message, Input } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useVentasPOS, useCancelarVenta } from '@/lib/hooks/queries/usePOS'
import { useAuth } from '@/lib/hooks/useAuth'
import type { VentaPOSView } from '@/types/pos'

const { Title } = Typography

export default function VentasPOSPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const { erpUser } = useAuth()

  const { data, isLoading } = useVentasPOS({
    status: statusFilter,
    pagination: { page, pageSize },
  })
  const cancelarVenta = useCancelarVenta()

  const handleCancel = async (id: string) => {
    try {
      await cancelarVenta.mutateAsync({
        p_venta_id: id,
        p_cancelada_por: erpUser?.nombre || 'Admin',
        p_motivo: 'Cancelada desde panel admin',
      })
      message.success('Venta cancelada')
    } catch (err) {
      message.error(`Error: ${err instanceof Error ? err.message : 'Error'}`)
    }
  }

  const columns: ColumnsType<VentaPOSView> = [
    {
      title: 'Folio',
      dataIndex: 'folio',
      width: 120,
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      width: 150,
      render: (v: string) => new Date(v).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    },
    {
      title: 'Caja',
      dataIndex: 'caja_nombre',
      width: 100,
    },
    {
      title: 'Cajero',
      dataIndex: 'cajero_nombre',
      width: 130,
    },
    {
      title: 'Metodo',
      dataIndex: 'metodo_pago',
      width: 110,
      render: (v: string) => {
        const colors: Record<string, string> = { efectivo: 'green', tarjeta: 'blue', transferencia: 'purple', mixto: 'orange' }
        return <Tag color={colors[v] || 'default'}>{v}</Tag>
      },
    },
    {
      title: 'Total',
      dataIndex: 'total',
      width: 110,
      align: 'right',
      render: (v: number) => <span style={{ fontWeight: 600 }}>${v.toFixed(2)}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (s: string) => <Tag color={s === 'completada' ? 'green' : 'red'}>{s}</Tag>,
    },
    {
      title: 'Acciones',
      width: 100,
      render: (_: unknown, record: VentaPOSView) => (
        record.status === 'completada' ? (
          <Popconfirm title="Cancelar esta venta?" onConfirm={() => handleCancel(record.id)} okText="Si" cancelText="No">
            <Button size="small" danger>Cancelar</Button>
          </Popconfirm>
        ) : null
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Ventas POS</Title>
        <Space>
          <Select
            placeholder="Status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            options={[
              { value: 'completada', label: 'Completadas' },
              { value: 'cancelada', label: 'Canceladas' },
            ]}
          />
        </Space>
      </div>
      <Card>
        <Table
          columns={columns}
          dataSource={data?.data}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={{
            current: page,
            pageSize,
            total: data?.total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          scroll={{ x: 950 }}
        />
      </Card>
    </div>
  )
}
