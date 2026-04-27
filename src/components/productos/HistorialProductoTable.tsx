'use client'

import { useMemo, useState } from 'react'
import { Table, Tag, Pagination, Empty, Skeleton, Tooltip, Typography, Space, Button } from 'antd'
import {
  FileTextOutlined,
  ShoppingCartOutlined,
  AuditOutlined,
  ShoppingOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'

const { Text } = Typography
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import {
  useHistorialProducto,
  useHistorialProductoCount,
  useHistorialCountsPorTipo,
} from '@/lib/hooks/queries/useHistorialProducto'
import { formatMoneyMXN, formatMoneyUSD } from '@/lib/utils/format'
import { useUIStore } from '@/store/uiStore'
import type { HistorialProductoItem, HistorialProductoTipo } from '@/types/database'
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
      title: (
        <Tooltip title="Cantidad indicada en el documento. No siempre representa piezas movidas: una cotización con cantidad 5 no movió stock, solo es propuesta.">
          <span>Cant. doc <QuestionCircleOutlined style={{ color: '#bfbfbf', fontSize: 11 }} /></span>
        </Tooltip>
      ),
      dataIndex: 'cantidad',
      key: 'cantidad',
      width: 95,
      align: 'right',
      render: (val: number, record: HistorialProductoItem) => (
        <Text type={record.afecta_stock ? undefined : 'secondary'}>{val}</Text>
      ),
    },
    {
      title: (
        <Tooltip title="Solo eventos que realmente entraron o salieron piezas del almacén. Cotizaciones, OVs y facturas pendientes no afectan stock todavía.">
          <span>Cambió stock <QuestionCircleOutlined style={{ color: '#bfbfbf', fontSize: 11 }} /></span>
        </Tooltip>
      ),
      key: 'delta_stock',
      width: 110,
      align: 'right',
      render: (_: unknown, record: HistorialProductoItem) => {
        if (!record.afecta_stock || record.delta_stock == null) {
          return <Text type="secondary">—</Text>
        }
        const positivo = record.delta_stock > 0
        return (
          <Tag
            color={positivo ? 'green' : 'red'}
            icon={positivo ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            style={{ marginInlineEnd: 0, fontWeight: 500 }}
          >
            {positivo ? '+' : ''}{record.delta_stock}
          </Tag>
        )
      },
    },
    {
      title: (
        <Tooltip title="Stock físico real justo después de este movimiento. Anclado al stock observable hoy.">
          <span>Stock después <QuestionCircleOutlined style={{ color: '#bfbfbf', fontSize: 11 }} /></span>
        </Tooltip>
      ),
      key: 'stock_despues',
      width: 110,
      align: 'right',
      render: (_: unknown, record: HistorialProductoItem) => {
        if (!record.afecta_stock || record.stock_despues == null) {
          return <Text type="secondary">—</Text>
        }
        const negativo = record.stock_despues < 0
        return (
          <Text strong style={{ color: negativo ? '#cf1322' : undefined }}>
            {record.stock_despues}
          </Text>
        )
      },
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

const TIPOS_ORDEN: HistorialProductoTipo[] = ['movimiento', 'cotizacion', 'orden_venta', 'factura', 'orden_compra']

export default function HistorialProductoTable({ productoId, pageSize = 10 }: Props) {
  const router = useRouter()
  const [page, setPage] = useState(1)

  // Filtros persistentes en uiStore (cuestan ~0 — solo localStorage, sin red ni BD)
  const filtrosPersistidos = useUIStore((s) => s.historialFiltrosTipos) as HistorialProductoTipo[]
  const setFiltros = useUIStore((s) => s.setHistorialFiltrosTipos)

  const tiposActivos = filtrosPersistidos.length > 0 ? filtrosPersistidos : undefined

  const { data: items = [], isLoading } = useHistorialProducto(
    productoId,
    { page, pageSize },
    tiposActivos
  )
  const { data: total = 0 } = useHistorialProductoCount(productoId, tiposActivos)
  const { data: countsPorTipo = [] } = useHistorialCountsPorTipo(productoId)

  const countMap = useMemo(() => {
    const m = new Map<HistorialProductoTipo, number>()
    for (const c of countsPorTipo) m.set(c.tipo_documento, c.total)
    return m
  }, [countsPorTipo])

  const totalGlobal = useMemo(
    () => countsPorTipo.reduce((s, c) => s + c.total, 0),
    [countsPorTipo]
  )

  const toggleTipo = (tipo: HistorialProductoTipo) => {
    const set = new Set(filtrosPersistidos)
    if (set.has(tipo)) set.delete(tipo)
    else set.add(tipo)
    setFiltros(Array.from(set))
    setPage(1)
  }

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

  const filtrosActivos = filtrosPersistidos.length > 0

  const renderChips = () => (
    <div style={{ marginBottom: 12 }}>
      <Space size={[4, 8]} wrap>
        <Tag.CheckableTag
          checked={!filtrosActivos}
          onChange={() => setFiltros([])}
        >
          Todos {totalGlobal > 0 && `(${totalGlobal})`}
        </Tag.CheckableTag>
        {TIPOS_ORDEN.map((tipo) => {
          const cfg = TIPO_CONFIG[tipo]
          const count = countMap.get(tipo) ?? 0
          const checked = filtrosPersistidos.includes(tipo)
          if (count === 0) return null
          return (
            <Tag.CheckableTag
              key={tipo}
              checked={checked}
              onChange={() => toggleTipo(tipo)}
            >
              <span style={{ marginInlineEnd: 4 }}>{cfg.icon}</span>
              {cfg.label} ({count})
            </Tag.CheckableTag>
          )
        })}
        {filtrosActivos && (
          <Button size="small" type="link" onClick={() => setFiltros([])}>
            Quitar filtros
          </Button>
        )}
      </Space>
    </div>
  )

  if (isLoading) {
    return (
      <div>
        {renderChips()}
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div>
        {renderChips()}
        <Empty
          description={filtrosActivos ? 'No hay eventos con los filtros aplicados' : 'Sin historial para este producto'}
        />
      </div>
    )
  }

  return (
    <div>
      {renderChips()}
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
