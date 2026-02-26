'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Segmented } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, FilePdfOutlined, FileTextOutlined, LinkOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { formatMoneySimple, formatDate, formatDateTime } from '@/lib/utils/format'
import { generarPDFCotizacion, prepararDatosCotizacionPDF } from '@/lib/utils/pdf'
import { useOrdenesVenta, type OrdenVentaRow, type FiltroStatusOV } from '@/lib/hooks/queries/useOrdenesVenta'
import { TableSkeleton } from '@/components/common/Skeletons'
import dayjs from 'dayjs'

const { Title } = Typography

const statusColors: Record<string, string> = {
  orden_venta: 'success',
  facturada: 'purple',
}

const statusLabels: Record<string, string> = {
  orden_venta: 'Pendiente',
  facturada: 'Facturada',
}

export default function OrdenesVentaPage() {
  const router = useRouter()
  const [searchText, setSearchText] = useState('')
  const [filtro, setFiltro] = useState<FiltroStatusOV>('todas')
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 })

  // React Query - datos cacheados automáticamente with server-side pagination
  const { data: ordenesResult, isLoading, isError } = useOrdenesVenta(filtro, pagination)
  const ordenes = ordenesResult?.data ?? []

  // Para descargar PDF, usamos un estado para el ID seleccionado
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null)

  const handleDescargarPDF = async (ordenId: string) => {
    setDownloadingPdfId(ordenId)
    try {
      // Importar dinámicamente para obtener datos frescos
      const { getSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = getSupabaseClient()

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

      const { cotizacion, opciones } = prepararDatosCotizacionPDF(cotData)
      await generarPDFCotizacion(cotizacion, items, opciones)
      message.success('PDF descargado')
    } catch (error) {
      console.error('Error generando PDF:', error)
      message.error('Error al generar PDF')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  // Filtrar localmente por búsqueda
  const filteredOrdenes = useMemo(() => {
    if (!searchText) return ordenes
    const search = searchText.toLowerCase()
    return ordenes.filter(
      (o) =>
        o.folio.toLowerCase().includes(search) ||
        (o.cliente_nombre && o.cliente_nombre.toLowerCase().includes(search))
    )
  }, [ordenes, searchText])

  // Conteos calculados de los datos cacheados
  const conteos = useMemo(() => ({
    todas: ordenes.length,
    pendientes: ordenes.filter(o => o.status === 'orden_venta').length,
    facturadas: ordenes.filter(o => o.status === 'facturada').length,
  }), [ordenes])

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
      title: 'Cotización',
      dataIndex: 'cotizacion_origen_folio',
      key: 'cotizacion_origen_folio',
      width: 120,
      render: (folio: string | null, record: OrdenVentaRow) => folio ? (
        <Button type="link" size="small" style={{ padding: 0 }} icon={<LinkOutlined />} onClick={() => router.push(`/cotizaciones/${record.cotizacion_origen_id}`)}>
          {folio}
        </Button>
      ) : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: 'OC Cliente',
      dataIndex: 'oc_cliente',
      key: 'oc_cliente',
      width: 130,
      render: (val: string | null) => val || '-',
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 130,
      align: 'right',
      render: (total) => formatMoneySimple(total),
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
            loading={downloadingPdfId === record.id}
            title="Descargar PDF"
          />
          {record.status === 'facturada' && record.factura_id && (
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

  if (isError) {
    message.error('Error al cargar órdenes de venta')
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
              onChange={(value) => setFiltro(value as FiltroStatusOV)}
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

          {isLoading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : (
            <Table
              dataSource={filteredOrdenes}
              columns={columns}
              rowKey="id"
              scroll={{ x: 800 }}
              pagination={{
                current: pagination.page,
                pageSize: pagination.pageSize,
                total: ordenesResult?.total ?? 0,
                showSizeChanger: true,
                showTotal: (total) => `${total} ordenes`,
                onChange: (page, pageSize) => setPagination({ page, pageSize }),
              }}
            />
          )}
        </Space>
      </Card>
    </div>
  )
}
