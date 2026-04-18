'use client'

import { useState, useMemo, useEffect } from 'react'
import { Button, Input, Space, Tag, Card, Typography, message, Segmented } from 'antd'
import { useRouter } from 'next/navigation'
import { PlusOutlined, SearchOutlined, EyeOutlined, FilePdfOutlined, FileTextOutlined, LinkOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { formatMoneySimple, formatDate, formatDateTime } from '@/lib/utils/format'
import { generarPDFCotizacion, prepararDatosCotizacionPDF } from '@/lib/utils/pdf'
import { useOrdenesVenta, useConteosOV, type OrdenVentaRow, type FiltroStatusOV } from '@/lib/hooks/queries/useOrdenesVenta'
import { TableSkeleton } from '@/components/common/Skeletons'
import BotonExportar from '@/components/common/BotonExportar'
import { PageHeaderActions } from '@/components/common/PageHeaderActions'
import { ResponsiveListTable } from '@/components/common/ResponsiveListTable'
import { getSupabaseClient } from '@/lib/supabase/client'
import dayjs from 'dayjs'
import { sanitizeSearchInput } from '@/lib/utils/sanitize'

const { Text } = Typography

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
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filtro, setFiltro] = useState<FiltroStatusOV>('todas')
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 })

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText)
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText])

  // React Query - datos cacheados automáticamente with server-side pagination and search
  const { data: ordenesResult, isLoading, isError } = useOrdenesVenta(filtro, pagination, debouncedSearch)
  const ordenes = ordenesResult?.data ?? []
  const { data: conteosGlobales } = useConteosOV()

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

  // Conteos globales (independientes del filtro y paginación activos)
  const conteos = conteosGlobales ?? { todas: 0, pendientes: 0, facturadas: 0 }

  const columns = useMemo<ColumnsType<OrdenVentaRow>>(() => [
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
      width: 220,
      ellipsis: true,
    },
    {
      title: 'Cotización',
      dataIndex: 'cotizacion_origen_folio',
      key: 'cotizacion_origen_folio',
      width: 120,
      render: (folio: string | null, record: OrdenVentaRow) => folio ? (
        <Button type="link" size="small" style={{ padding: 0 }} icon={<LinkOutlined />} href={`/cotizaciones/${record.cotizacion_origen_id}`}>
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
              title="Ver detalle"
              href={`/cotizaciones/${record.id}`}
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
                title="Ver Factura"
                href={`/facturas/${record.factura_id}`}
              />
          )}
        </Space>
      ),
    },
  ], [downloadingPdfId])

  if (isError) {
    message.error('Error al cargar órdenes de venta')
  }

  return (
    <div>
      <PageHeaderActions
        titulo="Ordenes de Venta"
        actions={
          <>
            <BotonExportar
              nombre="Ordenes_de_Venta"
              tituloReporte="LISTADO DE ÓRDENES DE VENTA"
              columnas={[
                { titulo: 'Folio', dataIndex: 'folio' },
                { titulo: 'Cliente', dataIndex: 'cliente' },
                { titulo: 'Fecha', dataIndex: 'fecha' },
                { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
                { titulo: 'Moneda', dataIndex: 'moneda' },
                { titulo: 'Status', dataIndex: 'status' },
              ]}
              datos={[]}
              fetchTodos={async () => {
                const supabase = getSupabaseClient()
                let query = supabase
                  .schema('erp')
                  .from('v_cotizaciones')
                  .select('folio, cliente_nombre, fecha, total, moneda, status')
                  .like('folio', 'OV-%')
                  .order('created_at', { ascending: false })
                if (filtro === 'pendientes') query = query.eq('status', 'orden_venta')
                else if (filtro === 'facturadas') query = query.eq('status', 'facturada')
                else query = query.in('status', ['orden_venta', 'facturada'])
                if (debouncedSearch) { const s = sanitizeSearchInput(debouncedSearch); query = query.or(`folio.ilike.%${s}%,cliente_nombre.ilike.%${s}%`) }
                const { data, error: err } = await query
                if (err) throw err
                return (data || []).map((r: any) => ({
                  folio: r.folio,
                  cliente: r.cliente_nombre,
                  fecha: formatDate(r.fecha),
                  total: r.total,
                  moneda: r.moneda,
                  status: statusLabels[r.status] || r.status,
                }))
              }}
            />
            <Button type="primary" icon={<PlusOutlined />} href="/ordenes-venta/nueva">
              Nueva Orden de Venta
            </Button>
          </>
        }
      />

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
            <ResponsiveListTable<OrdenVentaRow>
              dataSource={ordenes}
              columns={columns}
              rowKey="id"
              scroll={{ x: 1280 }}
              pagination={{
                current: pagination.page,
                pageSize: pagination.pageSize,
                total: ordenesResult?.total ?? 0,
                showSizeChanger: true,
                showTotal: (total) => `${total} ordenes`,
                onChange: (page, pageSize) => setPagination({ page, pageSize }),
              }}
              onMobileItemClick={(record) => router.push(`/cotizaciones/${record.id}`)}
              mobileRender={(o) => (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <Text strong style={{ fontSize: 14 }}>{o.folio}</Text>
                    <Text style={{ fontSize: 13, flexShrink: 0 }}>
                      {formatMoneySimple(o.total)} {o.moneda}
                    </Text>
                  </div>
                  <Text style={{ fontSize: 13, display: 'block', marginTop: 2, wordBreak: 'break-word' }}>
                    {o.cliente_nombre || '—'}
                  </Text>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, gap: 8, flexWrap: 'wrap' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDate(o.fecha)}
                    </Text>
                    <Tag color={statusColors[o.status]} style={{ margin: 0 }}>
                      {statusLabels[o.status] || o.status}
                    </Tag>
                  </div>
                </div>
              )}
            />
          )}
        </Space>
      </Card>
    </div>
  )
}
