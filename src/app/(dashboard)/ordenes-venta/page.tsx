'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Segmented } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/utils/format'
import { generarPDFCotizacion } from '@/lib/utils/pdf'
import dayjs from 'dayjs'

const { Title } = Typography

interface OrdenVentaRow {
  id: string
  folio: string
  fecha: string
  vigencia_dias: number
  status: string
  total: number
  cliente_nombre?: string
  cliente_rfc?: string
  almacen_nombre?: string
  factura_id?: string
}

type FiltroStatus = 'todas' | 'pendientes' | 'facturadas'

const statusColors: Record<string, string> = {
  orden_venta: 'success',
  factura: 'purple',
}

const statusLabels: Record<string, string> = {
  orden_venta: 'Pendiente',
  factura: 'Facturada',
}

export default function OrdenesVentaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [ordenes, setOrdenes] = useState<OrdenVentaRow[]>([])
  const [searchText, setSearchText] = useState('')
  const [filtro, setFiltro] = useState<FiltroStatus>('todas')

  useEffect(() => {
    loadOrdenes()
  }, [filtro])

  const loadOrdenes = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      let query = supabase
        .schema('erp')
        .from('v_cotizaciones')
        .select('*')
        .order('fecha', { ascending: false })

      // Filtrar por status segun el filtro seleccionado
      if (filtro === 'todas') {
        query = query.in('status', ['orden_venta', 'factura'])
      } else if (filtro === 'pendientes') {
        query = query.eq('status', 'orden_venta')
      } else if (filtro === 'facturadas') {
        query = query.eq('status', 'factura')
      }

      const { data, error } = await query

      if (error) throw error
      setOrdenes(data || [])
    } catch (error) {
      console.error('Error loading ordenes:', error)
      message.error('Error al cargar ordenes de venta')
    } finally {
      setLoading(false)
    }
  }

  const handleDescargarPDF = async (ordenId: string) => {
    const supabase = getSupabaseClient()
    try {
      const { data: cotData, error: cotError } = await supabase
        .schema('erp')
        .from('v_cotizaciones')
        .select('*')
        .eq('id', ordenId)
        .single()

      if (cotError) throw cotError

      const { data: itemsData, error: itemsError } = await supabase
        .schema('erp')
        .from('cotizacion_items')
        .select('*, productos:producto_id (sku)')
        .eq('cotizacion_id', ordenId)

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

  const filteredOrdenes = ordenes.filter(
    (o) =>
      o.folio.toLowerCase().includes(searchText.toLowerCase()) ||
      (o.cliente_nombre && o.cliente_nombre.toLowerCase().includes(searchText.toLowerCase()))
  )

  const columns: ColumnsType<OrdenVentaRow> = [
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
      render: (status: string) => (
        <Tag color={statusColors[status]}>
          {statusLabels[status] || status}
        </Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 120,
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
          {record.status === 'factura' && record.factura_id && (
            <Button
              type="link"
              icon={<FileTextOutlined />}
              onClick={() => router.push(`/facturas/${record.factura_id}`)}
              title="Ver Factura"
            />
          )}
        </Space>
      ),
    },
  ]

  // Contar por status para mostrar en tabs
  const conteos = {
    todas: ordenes.length,
    pendientes: ordenes.filter(o => o.status === 'orden_venta').length,
    facturadas: ordenes.filter(o => o.status === 'factura').length,
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>Ordenes de Venta</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/ordenes-venta/nueva')}
        >
          Nueva Orden de Venta
        </Button>
      </div>

      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Segmented
              value={filtro}
              onChange={(value) => setFiltro(value as FiltroStatus)}
              options={[
                { value: 'todas', label: `Todas (${conteos.todas})` },
                { value: 'pendientes', label: `Pendientes (${conteos.pendientes})` },
                { value: 'facturadas', label: `Facturadas (${conteos.facturadas})` },
              ]}
            />
            <Input
              placeholder="Buscar por folio o cliente..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%', maxWidth: 250 }}
              allowClear
            />
          </Space>

          <Table
            dataSource={filteredOrdenes}
            columns={columns}
            rowKey="id"
            loading={loading}
            scroll={{ x: 800 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `${total} ordenes`,
            }}
          />
        </Space>
      </Card>
    </div>
  )
}
