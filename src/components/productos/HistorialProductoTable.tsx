'use client'

import { useState } from 'react'
import { Table, Tag, Space } from 'antd'
import {
  FileTextOutlined,
  ShoppingCartOutlined,
  AuditOutlined,
  ShoppingOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { useHistorialProducto, useHistorialProductoCount } from '@/lib/hooks/queries/useHistorialProducto'
import { formatDate, formatMoneyMXN, formatMoneyUSD } from '@/lib/utils/format'
import type { HistorialProductoItem } from '@/types/database'
import type { ColumnsType } from 'antd/es/table'

interface Props {
  productoId: string
  pageSize?: number
}

const TIPO_CONFIG: Record<
  HistorialProductoItem['tipo_documento'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  cotizacion: { label: 'Cotización', color: 'blue', icon: <FileTextOutlined /> },
  orden_venta: { label: 'Orden Venta', color: 'cyan', icon: <ShoppingCartOutlined /> },
  factura: { label: 'Factura', color: 'purple', icon: <AuditOutlined /> },
  orden_compra: { label: 'Orden Compra', color: 'orange', icon: <ShoppingOutlined /> },
  movimiento: { label: 'Movimiento', color: 'default', icon: <SwapOutlined /> },
}

function getFolioRoute(tipo: HistorialProductoItem['tipo_documento'], documentoId: string): string | null {
  switch (tipo) {
    case 'cotizacion':
    case 'orden_venta':
      return `/cotizaciones/${documentoId}`
    case 'factura':
      return `/facturas/${documentoId}`
    case 'orden_compra':
      return `/compras/${documentoId}`
    default:
      return null
  }
}

export default function HistorialProductoTable({ productoId, pageSize = 10 }: Props) {
  const router = useRouter()
  const [page, setPage] = useState(1)

  const { data: items = [], isLoading } = useHistorialProducto(productoId, { page, pageSize })
  const { data: total = 0 } = useHistorialProductoCount(productoId)

  const columns: ColumnsType<HistorialProductoItem> = [
    {
      title: 'Fecha',
      dataIndex: 'fecha',
      key: 'fecha',
      width: 120,
      render: (val: string) => formatDate(val),
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo_documento',
      key: 'tipo_documento',
      width: 140,
      render: (tipo: HistorialProductoItem['tipo_documento']) => {
        const cfg = TIPO_CONFIG[tipo]
        return (
          <Tag color={cfg.color} icon={cfg.icon}>
            {cfg.label}
          </Tag>
        )
      },
    },
    {
      title: 'Folio',
      dataIndex: 'folio',
      key: 'folio',
      width: 130,
      render: (folio: string | null, record: HistorialProductoItem) => {
        if (!folio) return '-'
        const route = getFolioRoute(record.tipo_documento, record.documento_id)
        if (route) {
          return (
            <a
              onClick={(e) => {
                e.preventDefault()
                router.push(route)
              }}
              style={{ cursor: 'pointer' }}
            >
              {folio}
            </a>
          )
        }
        return folio
      },
    },
    {
      title: 'Entidad',
      dataIndex: 'entidad_nombre',
      key: 'entidad_nombre',
      ellipsis: true,
      render: (val: string | null) => val || '-',
    },
    {
      title: 'Cantidad',
      dataIndex: 'cantidad',
      key: 'cantidad',
      width: 90,
      align: 'right',
      render: (val: number) => val,
    },
    {
      title: 'Monto',
      dataIndex: 'monto',
      key: 'monto',
      width: 120,
      align: 'right',
      render: (val: number | null, record: HistorialProductoItem) => {
        if (val == null) return '-'
        return record.moneda === 'MXN' ? formatMoneyMXN(val) : formatMoneyUSD(val)
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: string | null) => {
        if (!val) return '-'
        const colorMap: Record<string, string> = {
          borrador: 'default',
          enviada: 'blue',
          aprobada: 'green',
          convertida: 'purple',
          facturada: 'purple',
          cancelada: 'red',
          vencida: 'orange',
          pendiente: 'gold',
          parcialmente_recibida: 'cyan',
          recibida: 'green',
          pagada: 'green',
          entrada: 'green',
          salida: 'red',
        }
        return <Tag color={colorMap[val] || 'default'}>{val.replace(/_/g, ' ')}</Tag>
      },
    },
  ]

  return (
    <Table<HistorialProductoItem>
      dataSource={items}
      columns={columns}
      rowKey="id"
      loading={isLoading}
      size="small"
      pagination={{
        current: page,
        pageSize,
        total,
        onChange: (p) => setPage(p),
        showSizeChanger: false,
        showTotal: (t) => `${t} registros`,
      }}
      locale={{ emptyText: 'Sin historial para este producto' }}
    />
  )
}
