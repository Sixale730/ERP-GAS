'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Card, Typography, message, Select } from 'antd'
import { SearchOutlined, EyeOutlined, FilePdfOutlined, LoadingOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useFacturas, type FacturaRow } from '@/lib/hooks/queries/useFacturas'
import { TableSkeleton } from '@/components/common/Skeletons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatMoneyCurrency, formatDate } from '@/lib/utils/format'
import { generarPDFFactura, prepararDatosFacturaPDF } from '@/lib/utils/pdf'
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
  const router = useRouter()
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 })

  // React Query hooks with server-side pagination
  const { data: facturasResult, isLoading, isError, error } = useFacturas(statusFilter, pagination)
  const facturas = facturasResult?.data ?? []

  const handleDescargarPDF = async (facturaId: string) => {
    const supabase = getSupabaseClient()
    setDownloadingPdf(facturaId)
    try {
      // Cargar factura completa
      const { data: facData, error: facError } = await supabase
        .schema('erp')
        .from('v_facturas')
        .select('*')
        .eq('id', facturaId)
        .single()

      if (facError) throw facError

      // Cargar items
      const { data: itemsData, error: itemsError } = await supabase
        .schema('erp')
        .from('factura_items')
        .select('*, productos:producto_id (sku)')
        .eq('factura_id', facturaId)

      if (itemsError) throw itemsError

      const items = itemsData?.map(item => ({
        ...item,
        sku: item.productos?.sku || '-'
      })) || []

      const { factura, opciones } = prepararDatosFacturaPDF(facData)
      generarPDFFactura(factura, items, opciones)
      message.success('PDF descargado')
    } catch (error) {
      console.error('Error generando PDF:', error)
      message.error('Error al generar PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  // Filtrar con useMemo
  const filteredFacturas = useMemo(() =>
    facturas.filter(
      (f) =>
        f.folio.toLowerCase().includes(searchText.toLowerCase()) ||
        (f.cliente_nombre && f.cliente_nombre.toLowerCase().includes(searchText.toLowerCase()))
    ),
    [facturas, searchText]
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
      width: 120,
      render: (dias, record) => {
        if (record.status === 'pagada' || record.status === 'cancelada') return '-'
        if (dias > 0) {
          return <Tag color="red">{dias} dias vencida</Tag>
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
            onClick={() => router.push(`/facturas/${record.id}`)}
            title="Ver detalle"
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
  ]

  // Summary stats - separar por moneda
  const facturasActivas = filteredFacturas.filter(f => f.status !== 'cancelada')
  const totalPorCobrarUSD = facturasActivas
    .filter(f => f.moneda === 'USD' || !f.moneda)
    .reduce((sum, f) => sum + f.saldo, 0)
  const totalPorCobrarMXN = facturasActivas
    .filter(f => f.moneda === 'MXN')
    .reduce((sum, f) => sum + f.saldo, 0)
  const facturasVencidas = filteredFacturas.filter(f => f.dias_vencida > 0 && f.status !== 'pagada').length

  if (isError) {
    message.error(`Error al cargar facturas: ${error?.message}`)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>Facturas</Title>
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
            dataSource={filteredFacturas}
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
