'use client'

import { useMemo, useState } from 'react'
import { Table, Tag, Pagination, Empty, Skeleton } from 'antd'
import {
  FileTextOutlined,
  ShoppingCartOutlined,
  AuditOutlined,
  ShoppingOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import { useHistorialProducto, useHistorialProductoCount } from '@/lib/hooks/queries/useHistorialProducto'
import { formatMoneyMXN, formatMoneyUSD } from '@/lib/utils/format'
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

const STATUS_COLOR_MAP: Record<string, string> = {
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

function buildColumns(router: ReturnType<typeof useRouter>): ColumnsType<HistorialProductoItem> {
  return [
    {
      title: 'Hora',
      dataIndex: 'fecha',
      key: 'hora',
      width: 70,
      render: (val: string) => (
        <span style={{ fontSize: 12, color: '#666' }}>{dayjs(val).format('HH:mm')}</span>
      ),
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
        return <Tag color={STATUS_COLOR_MAP[val] || 'default'}>{val.replace(/_/g, ' ')}</Tag>
      },
    },
  ]
}

function formatFechaGrupo(fecha: string): string {
  const d = dayjs(fecha)
  const hoy = dayjs().startOf('day')
  const dDay = d.startOf('day')
  const diff = hoy.diff(dDay, 'day')
  if (diff === 0) return `Hoy · ${d.format('D MMMM YYYY')}`
  if (diff === 1) return `Ayer · ${d.format('D MMMM YYYY')}`
  return d.format('dddd D [de] MMMM, YYYY')
}

export default function HistorialProductoTable({ productoId, pageSize = 10 }: Props) {
  const router = useRouter()
  const [page, setPage] = useState(1)

  const { data: items = [], isLoading } = useHistorialProducto(productoId, { page, pageSize })
  const { data: total = 0 } = useHistorialProductoCount(productoId)

  const columns = useMemo(() => buildColumns(router), [router])

  // Agrupar por fecha (solo dia, no hora) preservando orden DESC
  const grupos = useMemo(() => {
    const map = new Map<string, HistorialProductoItem[]>()
    for (const item of items) {
      const key = dayjs(item.fecha).format('YYYY-MM-DD')
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [items])

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} />
  }

  if (items.length === 0) {
    return <Empty description="Sin historial para este producto" />
  }

  return (
    <div>
      {grupos.map(([fechaKey, itemsDia]) => (
        <div key={fechaKey} style={{ marginBottom: 16 }}>
          <div
            style={{
              padding: '8px 12px',
              background: '#fafafa',
              borderLeft: '3px solid #1890ff',
              fontSize: 13,
              fontWeight: 500,
              color: '#333',
              marginBottom: 4,
              textTransform: 'capitalize',
            }}
          >
            {formatFechaGrupo(itemsDia[0].fecha)}
            <span style={{ marginInlineStart: 8, fontSize: 11, color: '#999', fontWeight: 400 }}>
              · {itemsDia.length} {itemsDia.length === 1 ? 'evento' : 'eventos'}
            </span>
          </div>
          <Table<HistorialProductoItem>
            dataSource={itemsDia}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={false}
            showHeader={fechaKey === grupos[0][0]}
          />
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          onChange={(p) => setPage(p)}
          showSizeChanger={false}
          showTotal={(t) => `${t} registros`}
        />
      </div>
    </div>
  )
}
