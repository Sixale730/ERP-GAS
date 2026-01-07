'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Select } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, FilePdfOutlined, ClockCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney, formatDate, formatDateTime } from '@/lib/utils/format'
import { generarPDFCotizacion } from '@/lib/utils/pdf'
import dayjs from 'dayjs'

const { Title } = Typography

interface CotizacionRow {
  id: string
  folio: string
  fecha: string
  vigencia_dias: number
  status: string
  total: number
  cliente_nombre?: string
  cliente_rfc?: string
  almacen_nombre?: string
  created_at?: string
  updated_at?: string
}

// Helper para verificar si la cotización está caducada
function esCaducada(fecha: string, vigenciaDias: number): boolean {
  const vencimiento = dayjs(fecha).add(vigenciaDias, 'day')
  return dayjs().isAfter(vencimiento)
}

const statusColors: Record<string, string> = {
  propuesta: 'processing',
  orden_venta: 'success',
  factura: 'purple',
  cancelada: 'error',
}

const statusLabels: Record<string, string> = {
  propuesta: 'Propuesta',
  orden_venta: 'Orden de Venta',
  factura: 'Facturada',
  cancelada: 'Cancelada',
}

export default function CotizacionesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [cotizaciones, setCotizaciones] = useState<CotizacionRow[]>([])
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadCotizaciones()
  }, [statusFilter])

  const loadCotizaciones = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      let query = supabase
        .schema('erp')
        .from('v_cotizaciones')
        .select('*')
        .order('fecha', { ascending: false })

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setCotizaciones(data || [])
    } catch (error) {
      console.error('Error loading cotizaciones:', error)
      message.error('Error al cargar cotizaciones')
    } finally {
      setLoading(false)
    }
  }

  const handleDescargarPDF = async (cotizacionId: string) => {
    const supabase = getSupabaseClient()
    try {
      // Cargar cotización completa
      const { data: cotData, error: cotError } = await supabase
        .schema('erp')
        .from('v_cotizaciones')
        .select('*')
        .eq('id', cotizacionId)
        .single()

      if (cotError) throw cotError

      // Cargar items
      const { data: itemsData, error: itemsError } = await supabase
        .schema('erp')
        .from('cotizacion_items')
        .select('*, productos:producto_id (sku)')
        .eq('cotizacion_id', cotizacionId)

      if (itemsError) throw itemsError

      const items = itemsData?.map(item => ({
        ...item,
        sku: item.productos?.sku || '-'
      })) || []

      generarPDFCotizacion(cotData, items)
      message.success('PDF descargado')
    } catch (error) {
      console.error('Error generando PDF:', error)
      message.error('Error al generar PDF')
    }
  }

  const filteredCotizaciones = cotizaciones.filter(
    (c) =>
      c.folio.toLowerCase().includes(searchText.toLowerCase()) ||
      (c.cliente_nombre && c.cliente_nombre.toLowerCase().includes(searchText.toLowerCase()))
  )

  const columns: ColumnsType<CotizacionRow> = [
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
      sorter: (a, b) => a.total - b.total,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (status: string, record: CotizacionRow) => (
        <Space size={4}>
          <Tag color={statusColors[status]}>
            {statusLabels[status] || status}
          </Tag>
          {esCaducada(record.fecha, record.vigencia_dias || 30) &&
           status !== 'factura' &&
           status !== 'cancelada' && (
            <Tag color="warning" icon={<ClockCircleOutlined />}>
              Caducada
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Creado',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (date: string) => formatDateTime(date),
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
    },
    {
      title: 'Última edición',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (date: string) => formatDateTime(date),
      sorter: (a, b) => dayjs(a.updated_at).unix() - dayjs(b.updated_at).unix(),
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
            onClick={() => router.push(`/cotizaciones/${record.id}`)}
            title="Ver detalle"
          />
          <Button
            type="link"
            icon={<FilePdfOutlined />}
            onClick={() => handleDescargarPDF(record.id)}
            title="Descargar PDF"
          />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>Cotizaciones</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/cotizaciones/nueva')}
        >
          Nueva Cotización
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por folio o cliente..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: '100%', maxWidth: 250 }}
            allowClear
          />
          <Select
            placeholder="Filtrar por status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: '100%', maxWidth: 180 }}
            allowClear
            options={[
              { value: 'propuesta', label: 'Propuesta' },
              { value: 'orden_venta', label: 'Orden de Venta' },
              { value: 'factura', label: 'Facturada' },
              { value: 'cancelada', label: 'Cancelada' },
            ]}
          />
        </Space>

        <Table
          dataSource={filteredCotizaciones}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 800 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} cotizaciones`,
          }}
        />
      </Card>
    </div>
  )
}
