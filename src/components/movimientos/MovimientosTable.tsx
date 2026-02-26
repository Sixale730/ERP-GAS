'use client'

import React, { useMemo } from 'react'
import { Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { formatDateTime, formatNumber } from '@/lib/utils/format'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import type { MovimientoView } from '@/types/database'

const { Text } = Typography

interface MovimientosTableProps {
  data: MovimientoView[]
  loading: boolean
  compact?: boolean
  pageSize?: number
  showPagination?: boolean
}

const TIPO_CONFIG = {
  entrada: { color: 'green', icon: <ArrowUpOutlined />, label: 'Entrada' },
  salida: { color: 'red', icon: <ArrowDownOutlined />, label: 'Salida' },
}

const REFERENCIA_CONFIG: Record<string, { color: string; label: string }> = {
  ajuste: { color: 'orange', label: 'Ajuste' },
  cotizacion: { color: 'blue', label: 'Cotizacion' },
  factura: { color: 'purple', label: 'Factura' },
  orden_compra: { color: 'cyan', label: 'Orden Compra' },
  transferencia: { color: 'geekblue', label: 'Transferencia' },
}

function MovimientosTable({
  data,
  loading,
  compact = false,
  pageSize = 15,
  showPagination = true,
}: MovimientosTableProps) {

  const columns: ColumnsType<MovimientoView> = useMemo(() => [
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      width: compact ? 100 : 150,
      render: (date) => formatDateTime(date),
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 100,
      render: (tipo: 'entrada' | 'salida') => {
        const config = TIPO_CONFIG[tipo]
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        )
      },
    },
    ...(!compact ? [{
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 100,
    }] : []),
    {
      title: 'Producto',
      dataIndex: 'producto_nombre',
      key: 'producto_nombre',
      ellipsis: true,
    },
    {
      title: 'Cantidad',
      dataIndex: 'cantidad',
      key: 'cantidad',
      width: 90,
      align: 'right',
      render: (cantidad: number, record: MovimientoView) => (
        <Text
          strong
          style={{ color: record.tipo === 'entrada' ? '#52c41a' : '#ff4d4f' }}
        >
          {record.tipo === 'entrada' ? '+' : '-'}{formatNumber(cantidad)}
        </Text>
      ),
    },
    ...(!compact ? [{
      title: 'Almacen',
      key: 'almacen',
      width: 140,
      render: (_: unknown, record: MovimientoView) => {
        if (record.tipo === 'entrada') {
          return record.almacen_destino || '-'
        }
        return record.almacen_origen || '-'
      },
    }] : []),
    ...(!compact ? [{
      title: 'Referencia',
      dataIndex: 'referencia_tipo',
      key: 'referencia_tipo',
      width: 120,
      render: (tipo: string | null) => {
        if (!tipo) return <Text type="secondary">-</Text>
        const config = REFERENCIA_CONFIG[tipo] || { color: 'default', label: tipo }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    }] : []),
    ...(!compact ? [{
      title: 'Notas',
      dataIndex: 'notas',
      key: 'notas',
      ellipsis: true,
    }] : []),
  ] as ColumnsType<MovimientoView>, [compact])

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey="id"
      loading={loading}
      scroll={{ x: compact ? 450 : 900 }}
      size={compact ? 'small' : 'middle'}
      pagination={showPagination ? {
        pageSize,
        showSizeChanger: !compact,
        showTotal: (total) => `${total} movimientos`,
      } : false}
    />
  )
}

export default React.memo(MovimientosTable)
