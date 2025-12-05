'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Select } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/utils/format'
import { generarPDFCotizacion } from '@/lib/utils/pdf'
import dayjs from 'dayjs'

const { Title } = Typography

interface CotizacionRow {
  id: string
  folio: string
  fecha: string
  status: string
  total: number
  cliente_nombre?: string
  cliente_rfc?: string
  almacen_nombre?: string
}

const statusColors: Record<string, string> = {
  borrador: 'default',
  enviada: 'processing',
  aceptada: 'success',
  rechazada: 'error',
  facturada: 'purple',
  vencida: 'warning',
}

const statusLabels: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  facturada: 'Facturada',
  vencida: 'Vencida',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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
              { value: 'borrador', label: 'Borrador' },
              { value: 'enviada', label: 'Enviada' },
              { value: 'aceptada', label: 'Aceptada' },
              { value: 'rechazada', label: 'Rechazada' },
              { value: 'facturada', label: 'Facturada' },
            ]}
          />
        </Space>

        <Table
          dataSource={filteredCotizaciones}
          columns={columns}
          rowKey="id"
          loading={loading}
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
