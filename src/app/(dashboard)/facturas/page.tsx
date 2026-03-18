'use client'

import { useState, useMemo, useEffect } from 'react'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Select } from 'antd'
import { SearchOutlined, EyeOutlined, FilePdfOutlined, LoadingOutlined, GlobalOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useFacturas, type FacturaRow } from '@/lib/hooks/queries/useFacturas'
import { TableSkeleton } from '@/components/common/Skeletons'
import BotonExportar from '@/components/common/BotonExportar'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoneyCurrency, formatDate } from '@/lib/utils/format'
import { generarPDFFactura, prepararDatosFacturaPDF } from '@/lib/utils/pdf'
import { useAuth } from '@/lib/hooks/useAuth'
import dayjs from 'dayjs'

const { Title } = Typography

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
  const { organizacion } = useAuth()
  const esPOS = organizacion?.codigo === 'MASCOTIENDA'
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
  const { data: facturasResult, isLoading, isError, error } = useFacturas(statusFilter, pagination, debouncedSearch)
  const facturas = facturasResult?.data ?? []

  const handleDescargarPDF = async (facturaId: string) => {
    const supabase = getSupabaseClient()
    setDownloadingPdf(facturaId)
    try {
      // Cargar factura + items en paralelo
      const [facResult, itemsResult] = await Promise.all([
        supabase.schema('erp').from('v_facturas').select('*').eq('id', facturaId).single(),
        supabase.schema('erp').from('factura_items').select('*, productos:producto_id (sku)').eq('factura_id', facturaId),
      ])

      const { data: facData, error: facError } = facResult
      const { data: itemsData, error: itemsError } = itemsResult

      if (facError) throw facError
      if (itemsError) throw itemsError

      const items = itemsData?.map(item => ({
        ...item,
        sku: item.productos?.sku || '-'
      })) || []

      const { factura, opciones } = prepararDatosFacturaPDF(facData)
      await generarPDFFactura(factura, items, opciones)
      message.success('PDF descargado')
    } catch (error) {
      console.error('Error generando PDF:', error)
      message.error('Error al generar PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  const columns: ColumnsType<FacturaRow> = useMemo(() => [
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
      title: 'Sucursal',
      dataIndex: 'sucursal_nombre',
      key: 'sucursal_nombre',
      width: 130,
      ellipsis: true,
      render: (nombre) => nombre || '-',
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 130,
      align: 'right',
      render: (total, record) => formatMoneyCurrency(total, record.moneda || 'USD'),
    },
    {
      title: 'Saldo',
      dataIndex: 'saldo',
      key: 'saldo',
      width: 130,
      align: 'right',
      render: (saldo, record) => (
        <span style={{ color: saldo > 0 ? '#cf1322' : '#3f8600', fontWeight: saldo > 0 ? 600 : 400 }}>
          {formatMoneyCurrency(saldo, record.moneda || 'USD')}
        </span>
      ),
      sorter: (a, b) => a.saldo - b.saldo,
    },
    {
      title: 'Vencimiento',
      dataIndex: 'dias_vencida',
      key: 'dias_vencida',
      width: 150,
      render: (dias, record) => {
        if (record.status === 'pagada' || record.status === 'cancelada') return '-'
        if (dias > 0) {
          return <Tag color="red">{dias} dias vencida</Tag>
        }
        if (record.fecha_vencimiento && record.fecha) {
          const diasTranscurridos = dayjs().diff(dayjs(record.fecha), 'day')
          const diasCredito = dayjs(record.fecha_vencimiento).diff(dayjs(record.fecha), 'day')
          if (diasCredito > 0) {
            return <Tag color="green">Dia {diasTranscurridos} de {diasCredito}</Tag>
          }
        }
        return <Tag color="green">Al dia</Tag>
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
              title="Ver detalle"
              href={`/facturas/${record.id}`}
            />
          <Button
            type="link"
            icon={downloadingPdf === record.id ? <LoadingOutlined /> : <FilePdfOutlined />}
            onClick={() => handleDescargarPDF(record.id)}
            title="Descargar PDF"
            disabled={downloadingPdf !== null}
          />
        </Space>
      ),
    },
  ], [downloadingPdf])

  // Summary stats - memoized para evitar recalculos en cada render
  const { totalPorCobrarUSD, totalPorCobrarMXN, facturasVencidas } = useMemo(() => {
    let porCobrarUSD = 0
    let porCobrarMXN = 0
    let vencidas = 0

    for (const f of facturas) {
      if (f.status !== 'cancelada') {
        if (f.moneda === 'MXN') {
          porCobrarMXN += f.saldo
        } else {
          porCobrarUSD += f.saldo
        }
      }
      if (f.dias_vencida > 0 && f.status !== 'pagada') {
        vencidas++
      }
    }

    return { totalPorCobrarUSD: porCobrarUSD, totalPorCobrarMXN: porCobrarMXN, facturasVencidas: vencidas }
  }, [facturas])

  if (isError) {
    message.error(`Error al cargar facturas: ${error?.message}`)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Title level={2} style={{ margin: 0 }}>Facturas</Title>
          {esPOS && (
            <Button
                icon={<GlobalOutlined />}
                href="/facturas/global"
              >
                Factura Global
              </Button>
          )}
        </Space>
        <Space wrap>
          {totalPorCobrarUSD > 0 && (
            <Tag color="red" style={{ fontSize: 14, padding: '4px 8px' }}>
              Por cobrar: {formatMoneyCurrency(totalPorCobrarUSD, 'USD')}
            </Tag>
          )}
          {totalPorCobrarMXN > 0 && (
            <Tag color="red" style={{ fontSize: 14, padding: '4px 8px' }}>
              Por cobrar: {formatMoneyCurrency(totalPorCobrarMXN, 'MXN')}
            </Tag>
          )}
          {facturasVencidas > 0 && (
            <Tag color="orange" style={{ fontSize: 14, padding: '4px 8px' }}>
              {facturasVencidas} vencidas
            </Tag>
          )}
          <BotonExportar
            nombre="Facturas"
            columnas={[
              { titulo: 'Folio', key: 'folio' },
              { titulo: 'Cliente', key: 'cliente' },
              { titulo: 'Fecha', key: 'fecha' },
              { titulo: 'Fecha Vencimiento', key: 'fecha_vencimiento' },
              { titulo: 'Total', key: 'total' },
              { titulo: 'Saldo', key: 'saldo' },
              { titulo: 'Días Vencidos', key: 'dias_vencidos' },
              { titulo: 'Status', key: 'status' },
            ]}
            datos={[]}
            fetchTodos={async () => {
              const supabase = getSupabaseClient()
              let query = supabase
                .schema('erp')
                .from('v_facturas')
                .select('folio, cliente_nombre, fecha, fecha_vencimiento, total, saldo, moneda, status')
                .order('created_at', { ascending: false })
              if (statusFilter) query = query.eq('status', statusFilter)
              if (debouncedSearch) query = query.or(`folio.ilike.%${debouncedSearch}%,cliente_nombre.ilike.%${debouncedSearch}%`)
              const { data, error: err } = await query
              if (err) throw err
              return (data || []).map((r: any) => {
                let diasVencidos: number | string = ''
                if (r.fecha_vencimiento && r.status !== 'pagada' && r.status !== 'cancelada') {
                  diasVencidos = dayjs().diff(dayjs(r.fecha_vencimiento), 'day')
                }
                return {
                  folio: r.folio,
                  cliente: r.cliente_nombre,
                  fecha: formatDate(r.fecha),
                  fecha_vencimiento: r.fecha_vencimiento ? formatDate(r.fecha_vencimiento) : '',
                  total: r.total,
                  saldo: r.saldo,
                  dias_vencidos: diasVencidos,
                  status: statusLabels[r.status] || r.status,
                }
              })
            }}
          />
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
            style={{ width: '100%', maxWidth: 150 }}
            allowClear
            options={[
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'parcial', label: 'Pago Parcial' },
              { value: 'pagada', label: 'Pagada' },
              { value: 'cancelada', label: 'Cancelada' },
            ]}
          />
        </Space>

        {isLoading ? (
          <TableSkeleton rows={8} columns={8} />
        ) : (
          <Table
            dataSource={facturas}
            columns={columns}
            rowKey="id"
            scroll={{ x: 900 }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total: facturasResult?.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} facturas`,
              onChange: (page, pageSize) => setPagination({ page, pageSize }),
            }}
          />
        )}
      </Card>
    </div>
  )
}
