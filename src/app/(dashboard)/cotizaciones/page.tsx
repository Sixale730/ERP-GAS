'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Select, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, FilePdfOutlined, ClockCircleOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useCotizaciones, useDeleteCotizacion } from '@/lib/hooks/useQueries'
import { formatMoneyCurrency, formatDate, formatDateTime } from '@/lib/utils/format'
import { generarPDFCotizacion } from '@/lib/utils/pdf'
import { getSupabaseClient } from '@/lib/supabase/client'
import dayjs from 'dayjs'

const { Title } = Typography

interface CotizacionRow {
  id: string
  folio: string
  fecha: string
  vigencia_dias: number
  status: string
  total: number
  moneda?: string
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
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)

  // React Query hooks
  const { data: cotizaciones = [], isLoading: loading, error } = useCotizaciones(statusFilter)
  const deleteCotizacion = useDeleteCotizacion()

  // Mostrar error si hay
  if (error) {
    message.error('Error al cargar cotizaciones')
  }

  const handleDescargarPDF = async (cotizacionId: string) => {
    setDownloadingPdf(cotizacionId)
    try {
      const supabase = getSupabaseClient()

      // Cargar cotización con relaciones
      const { data: cotizacion, error: cotError } = await supabase
        .schema('erp')
        .from('cotizaciones')
        .select(`
          *,
          clientes:cliente_id (nombre_comercial, rfc),
          almacenes:almacen_id (nombre)
        `)
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

      // Transformar datos para el PDF
      const cotizacionPdf = {
        folio: cotizacion.folio,
        fecha: cotizacion.fecha,
        fecha_vencimiento: dayjs(cotizacion.fecha).add(cotizacion.vigencia_dias || 30, 'day').format('YYYY-MM-DD'),
        cliente_nombre: cotizacion.clientes?.nombre_comercial || '-',
        cliente_rfc: cotizacion.clientes?.rfc,
        almacen_nombre: cotizacion.almacenes?.nombre || '-',
        subtotal: cotizacion.subtotal,
        descuento_porcentaje: cotizacion.descuento_porcentaje,
        descuento_monto: cotizacion.descuento_monto,
        iva: cotizacion.iva,
        total: cotizacion.total,
        notas: cotizacion.notas,
        vendedor_nombre: cotizacion.vendedor_nombre
      }

      const items = itemsData?.map(item => ({
        sku: item.productos?.sku || '-',
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento_porcentaje: item.descuento_porcentaje,
        subtotal: item.subtotal
      })) || []

      // Generar PDF con moneda correcta
      generarPDFCotizacion(cotizacionPdf, items, { moneda: cotizacion.moneda || 'USD' })
      message.success('PDF descargado')

    } catch (error) {
      console.error('Error generando PDF:', error)
      message.error('Error al generar PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  const handleEliminar = async (cotizacion: CotizacionRow) => {
    // Solo permitir eliminar cotizaciones en status 'propuesta'
    if (cotizacion.status !== 'propuesta') {
      message.error('Solo se pueden eliminar cotizaciones en status "Propuesta"')
      return
    }

    try {
      await deleteCotizacion.mutateAsync(cotizacion.id)
      message.success(`Cotizacion ${cotizacion.folio} eliminada`)
    } catch (error) {
      console.error('Error eliminando cotizacion:', error)
      message.error('Error al eliminar la cotizacion')
    }
  }

  // Filtrar con useMemo
  const filteredCotizaciones = useMemo(() =>
    cotizaciones.filter(
      (c) =>
        c.folio.toLowerCase().includes(searchText.toLowerCase()) ||
        (c.cliente_nombre && c.cliente_nombre.toLowerCase().includes(searchText.toLowerCase()))
    ),
    [cotizaciones, searchText]
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
      render: (total: number, record: CotizacionRow) =>
        formatMoneyCurrency(total, (record.moneda as any) || 'USD'),
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
      width: 140,
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
            icon={downloadingPdf === record.id ? <LoadingOutlined /> : <FilePdfOutlined />}
            onClick={() => handleDescargarPDF(record.id)}
            title="Descargar PDF"
            disabled={downloadingPdf !== null}
          />
          {record.status === 'propuesta' && (
            <Popconfirm
              title="Eliminar cotización"
              description={`¿Está seguro de eliminar ${record.folio}?`}
              onConfirm={() => handleEliminar(record)}
              okText="Sí, eliminar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                title="Eliminar"
              />
            </Popconfirm>
          )}
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
