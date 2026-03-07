'use client'

import { useState } from 'react'
import { Table, Tag, Typography, Card } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import type { ResumenTurno } from '@/types/pos'

const { Title } = Typography

async function fetchCortes(page: number, pageSize: number) {
  const supabase = getSupabaseClient()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .schema('erp')
    .from('v_resumen_turno')
    .select('*', { count: 'exact' })
    .order('fecha_apertura', { ascending: false })
    .range(from, to)

  if (error) throw error
  return { data: (data || []) as ResumenTurno[], total: count || 0 }
}

export default function CortesPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data, isLoading } = useQuery({
    queryKey: ['pos', 'cortes', page, pageSize],
    queryFn: () => fetchCortes(page, pageSize),
  })

  const columns: ColumnsType<ResumenTurno> = [
    {
      title: 'Caja',
      dataIndex: 'caja_nombre',
      width: 120,
    },
    {
      title: 'Cajero',
      dataIndex: 'usuario_nombre',
      width: 150,
    },
    {
      title: 'Apertura',
      dataIndex: 'fecha_apertura',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    },
    {
      title: 'Cierre',
      dataIndex: 'fecha_cierre',
      width: 160,
      render: (v: string | null) => v ? new Date(v).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => <Tag color={s === 'abierto' ? 'green' : 'default'}>{s}</Tag>,
    },
    {
      title: 'Ventas',
      dataIndex: 'num_ventas',
      width: 80,
      align: 'right',
    },
    {
      title: 'Total Ventas',
      dataIndex: 'total_ventas',
      width: 120,
      align: 'right',
      render: (v: number) => `$${(v ?? 0).toFixed(2)}`,
    },
    {
      title: 'Fondo',
      dataIndex: 'monto_apertura',
      width: 100,
      align: 'right',
      render: (v: number) => `$${(v ?? 0).toFixed(2)}`,
    },
    {
      title: 'Diferencia',
      dataIndex: 'diferencia',
      width: 110,
      align: 'right',
      render: (v: number | null) => {
        if (v === null) return '—'
        const color = v === 0 ? '#52c41a' : v > 0 ? '#1890ff' : '#ff4d4f'
        return <span style={{ color, fontWeight: 600 }}>{v >= 0 ? '+' : ''}${v.toFixed(2)}</span>
      },
    },
  ]

  return (
    <div>
      <Title level={3}>Cortes de Caja</Title>
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
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  )
}
