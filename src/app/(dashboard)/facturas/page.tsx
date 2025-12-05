'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Select } from 'antd'
import { SearchOutlined, EyeOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography

interface FacturaRow {
  id: string
  folio: string
  fecha: string
  status: string
  total: number
  saldo: number
  dias_vencida: number
  cliente_nombre?: string
  almacen_nombre?: string
}

const statusColors: Record<string, string> = {
  pendiente: 'orange',
  parcial: 'blue',
  pagada: 'green',
  cancelada: 'red',
}

const statusLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial: 'Pago Parcial',
  pagada: 'Pagada',
  cancelada: 'Cancelada',
}

export default function FacturasPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [facturas, setFacturas] = useState<FacturaRow[]>([])
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadFacturas()
  }, [statusFilter])

  const loadFacturas = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      let query = supabase
        .schema('erp')
        .from('v_facturas')
        .select('*')
        .order('fecha', { ascending: false })

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setFacturas(data || [])
    } catch (error) {
      console.error('Error loading facturas:', error)
      message.error('Error al cargar facturas')
    } finally {
      setLoading(false)
    }
  }

  const filteredFacturas = facturas.filter(
    (f) =>
      f.folio.toLowerCase().includes(searchText.toLowerCase()) ||
      (f.cliente_nombre && f.cliente_nombre.toLowerCase().includes(searchText.toLowerCase()))
  )

  const columns: ColumnsType<FacturaRow> = [
    {
      title: 'Folio',
      dataIndex: 'folio',
      key: 'folio',
      width: 120,
      render: (folio) => <strong>{folio}</strong>,
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha',
      key: 'fecha',
      width: 110,
      render: (fecha) => formatDate(fecha),
      sorter: (a, b) => dayjs(a.fecha).unix() - dayjs(b.fecha).unix(),
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente_nombre',
      key: 'cliente_nombre',
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 130,
      align: 'right',
      render: (total) => formatMoney(total),
    },
    {
      title: 'Saldo',
      dataIndex: 'saldo',
      key: 'saldo',
      width: 130,
      align: 'right',
      render: (saldo) => (
        <span style={{ color: saldo > 0 ? '#cf1322' : '#3f8600', fontWeight: saldo > 0 ? 600 : 400 }}>
          {formatMoney(saldo)}
        </span>
      ),
      sorter: (a, b) => a.saldo - b.saldo,
    },
    {
      title: 'Vencimiento',
      dataIndex: 'dias_vencida',
      key: 'dias_vencida',
      width: 120,
      render: (dias, record) => {
        if (record.status === 'pagada' || record.status === 'cancelada') return '-'
        if (dias > 0) {
          return <Tag color="red">{dias} días vencida</Tag>
        }
        return <Tag color="green">Al día</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={statusColors[status]}>
          {statusLabels[status] || status}
        </Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/facturas/${record.id}`)}
          />
        </Space>
      ),
    },
  ]

  // Summary stats
  const totalPorCobrar = filteredFacturas
    .filter(f => f.status !== 'cancelada')
    .reduce((sum, f) => sum + f.saldo, 0)
  const facturasVencidas = filteredFacturas.filter(f => f.dias_vencida > 0 && f.status !== 'pagada').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Facturas</Title>
        <Space>
          <Tag color="red" style={{ fontSize: 14, padding: '4px 8px' }}>
            Por cobrar: {formatMoney(totalPorCobrar)}
          </Tag>
          {facturasVencidas > 0 && (
            <Tag color="orange" style={{ fontSize: 14, padding: '4px 8px' }}>
              {facturasVencidas} vencidas
            </Tag>
          )}
        </Space>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por folio o cliente..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="Filtrar por status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            allowClear
            options={[
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'parcial', label: 'Pago Parcial' },
              { value: 'pagada', label: 'Pagada' },
              { value: 'cancelada', label: 'Cancelada' },
            ]}
          />
        </Space>

        <Table
          dataSource={filteredFacturas}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} facturas`,
          }}
        />
      </Card>
    </div>
  )
}
