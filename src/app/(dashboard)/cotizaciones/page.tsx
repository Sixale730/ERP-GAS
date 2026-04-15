'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Select, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, FilePdfOutlined, ClockCircleOutlined, DeleteOutlined, ShoppingCartOutlined, LoadingOutlined, StarOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { useCotizaciones, useDeleteCotizacion, type CotizacionRow } from '@/lib/hooks/queries/useCotizaciones'
import { TableSkeleton } from '@/components/common/Skeletons'
import BotonExportar from '@/components/common/BotonExportar'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime, formatMoneyMXN } from '@/lib/utils/format'
import { generarPDFCotizacion, prepararDatosCotizacionPDF } from '@/lib/utils/pdf'
import dayjs from 'dayjs'
import { sanitizeSearchInput } from '@/lib/utils/sanitize'

const { Title } = Typography

// Helper para verificar si la cotizacion esta caducada
function esCaducada(fecha: string, vigenciaDias: number): boolean {
  const vencimiento = dayjs(fecha).add(vigenciaDias, 'day')
  return dayjs().isAfter(vencimiento)
}

const statusColors: Record<string, string> = {
  propuesta: 'processing',
  cancelada: 'error',
}

const statusLabels: Record<string, string> = {
  propuesta: 'Propuesta',
  cancelada: 'Cancelada',
}

export default function CotizacionesPage() {
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 })

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText)
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText])

  // React Query hooks with server-side pagination and search
  const { data: cotizacionesResult, isLoading, isError, error } = useCotizaciones(statusFilter, pagination, debouncedSearch)
  const cotizaciones = cotizacionesResult?.data ?? []
  const deleteCotizacion = useDeleteCotizacion()

  // Pipeline stats (cotizaciones abiertas)
  const { data: pipelineStats } = useQuery({
    queryKey: ['cotizaciones', 'pipeline'],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error: err } = await supabase
        .schema('erp')
        .from('cotizaciones')
        .select('total, probabilidad')
        .in('status', ['propuesta'])
      if (err) throw err
      const rows = data || []
      const totalPipeline = rows.reduce((sum, r) => sum + (r.total || 0), 0)
      const pipelinePonderado = rows
        .filter(r => r.probabilidad != null)
        .reduce((sum, r) => sum + (r.total || 0) * ((r.probabilidad || 0) / 100), 0)
      return { count: rows.length, totalPipeline, pipelinePonderado }
    },
  })

  const handleDescargarPDF = useCallback(async (cotizacionId: string) => {
    setDownloadingPdf(cotizacionId)
    const supabase = getSupabaseClient()
    try {
      // Cargar cotizacion completa
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

      const { cotizacion, opciones } = prepararDatosCotizacionPDF(cotData)
      await generarPDFCotizacion(cotizacion, items, opciones)
      message.success('PDF descargado')
    } catch (error) {
      console.error('Error generando PDF:', error)
      message.error('Error al generar PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }, [])

  const handleEliminar = useCallback(async (cotizacion: CotizacionRow) => {
    if (cotizacion.status !== 'propuesta') {
      message.error('Solo se pueden eliminar cotizaciones en status "Propuesta"')
      return
    }

    try {
      await deleteCotizacion.mutateAsync(cotizacion)
      message.success(`Cotizacion ${cotizacion.folio} eliminada`)
    } catch (error) {
      console.error('Error eliminando cotizacion:', error)
      message.error('Error al eliminar la cotizacion')
    }
  }, [deleteCotizacion])

  const columns: ColumnsType<CotizacionRow> = useMemo(() => [
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
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 150,
      align: 'right',
      render: (total: number, record) => {
        const moneda = record.moneda || 'MXN'
        const formatted = new Intl.NumberFormat('es-MX', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(total || 0)
        return `$${formatted} ${moneda}`
      },
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
           status !== 'cancelada' && (
            <Tag color="warning" icon={<ClockCircleOutlined />}>
              Caducada
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Prob.',
      dataIndex: 'probabilidad',
      key: 'probabilidad',
      width: 80,
      align: 'center',
      render: (prob: number | null) => {
        if (prob == null) return <span style={{ color: '#999' }}>—</span>
        if (prob >= 90) return <Tag color="blue" icon={<StarOutlined />}>{prob}%</Tag>
        if (prob >= 70) return <Tag color="green">{prob}%</Tag>
        if (prob >= 30) return <Tag color="gold">{prob}%</Tag>
        return <Tag color="red">{prob}%</Tag>
      },
      sorter: (a, b) => (a.probabilidad ?? -1) - (b.probabilidad ?? -1),
    },
    {
      title: 'OVs',
      dataIndex: 'num_ovs_generadas',
      key: 'num_ovs_generadas',
      width: 70,
      align: 'center',
      render: (num: number) => num > 0 ? (
        <Tag color="green" icon={<ShoppingCartOutlined />}>{num}</Tag>
      ) : null,
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
      title: 'Ultima edicion',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (date: string) => formatDateTime(date),
      sorter: (a, b) => dayjs(a.updated_at).unix() - dayjs(b.updated_at).unix(),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 140,
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
            icon={downloadingPdf === record.id ? <LoadingOutlined /> : <FilePdfOutlined />}
            onClick={() => handleDescargarPDF(record.id)}
            title="Descargar PDF"
            disabled={downloadingPdf !== null}
          />
          {record.status === 'propuesta' && (
            <Popconfirm
              title="Eliminar cotizacion"
              description={`Esta seguro de eliminar ${record.folio}?`}
              onConfirm={() => handleEliminar(record)}
              okText="Si, eliminar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                title="Eliminar"
                loading={deleteCotizacion.isPending}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [handleDescargarPDF, handleEliminar, deleteCotizacion.isPending, downloadingPdf])

  if (isError) {
    message.error(`Error al cargar cotizaciones: ${error?.message}`)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>Cotizaciones</Title>
        <Space>
          <BotonExportar
            nombre="Cotizaciones"
            tituloReporte="LISTADO DE COTIZACIONES"
            columnas={[
              { titulo: 'Folio', dataIndex: 'folio' },
              { titulo: 'Cliente', dataIndex: 'cliente' },
              { titulo: 'Fecha', dataIndex: 'fecha' },
              { titulo: 'Vigencia', dataIndex: 'vigencia', formato: 'numero' },
              { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
              { titulo: 'Moneda', dataIndex: 'moneda' },
              { titulo: 'Status', dataIndex: 'status' },
              { titulo: 'Prob.', dataIndex: 'probabilidad', formato: 'numero' },
            ]}
            datos={[]}
            fetchTodos={async () => {
              const supabase = getSupabaseClient()
              let query = supabase
                .schema('erp')
                .from('v_cotizaciones')
                .select('folio, cliente_nombre, fecha, vigencia_dias, total, moneda, status, probabilidad')
                .like('folio', 'COT-%')
                .order('created_at', { ascending: false })
              if (statusFilter) query = query.eq('status', statusFilter)
              if (debouncedSearch) { const s = sanitizeSearchInput(debouncedSearch); query = query.or(`folio.ilike.%${s}%,cliente_nombre.ilike.%${s}%`) }
              const { data, error: err } = await query
              if (err) throw err
              return (data || []).map((r: any) => ({
                folio: r.folio,
                cliente: r.cliente_nombre,
                fecha: formatDate(r.fecha),
                vigencia: r.vigencia_dias,
                total: r.total,
                moneda: r.moneda,
                status: statusLabels[r.status] || r.status,
                probabilidad: r.probabilidad != null ? `${r.probabilidad}%` : '',
              }))
            }}
          />
          <Button
              type="primary"
              icon={<PlusOutlined />}
              href="/cotizaciones/nueva"
            >
              Nueva Cotizacion
            </Button>
        </Space>
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
              { value: 'cancelada', label: 'Cancelada' },
            ]}
          />
        </Space>

        {pipelineStats && pipelineStats.count > 0 && (!statusFilter || statusFilter === 'propuesta') && (
          <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Tag color="blue" style={{ fontSize: 13, padding: '4px 10px' }}>
              {pipelineStats.count} cotizaciones abiertas
            </Tag>
            <Tag color="blue" style={{ fontSize: 13, padding: '4px 10px' }}>
              Valor total: {formatMoneyMXN(pipelineStats.totalPipeline)}
            </Tag>
            <Tag color="green" style={{ fontSize: 13, padding: '4px 10px' }}>
              Pipeline ponderado: {formatMoneyMXN(pipelineStats.pipelinePonderado)}
            </Tag>
          </div>
        )}

        {isLoading ? (
          <TableSkeleton rows={8} columns={7} />
        ) : (
          <Table
            dataSource={cotizaciones}
            columns={columns}
            rowKey="id"
            scroll={{ x: 1180 }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total: cotizacionesResult?.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} cotizaciones`,
              onChange: (page, pageSize) => setPagination({ page, pageSize }),
            }}
          />
        )}
      </Card>
    </div>
  )
}
