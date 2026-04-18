'use client'

import { Grid, List, Table } from 'antd'
import type { TableProps } from 'antd'
import type { ReactNode } from 'react'

const { useBreakpoint } = Grid

/**
 * Table de AntD con fallback a List de cards en xs.
 *
 * - Desktop (>=sm): renderiza <Table> tal cual.
 * - Movil (xs):     renderiza <List> usando `mobileRender(record)` para cada fila.
 *
 * Mantiene pagination, loading, rowKey, dataSource.
 */
export interface ResponsiveListTableProps<T> extends TableProps<T> {
  mobileRender: (record: T, index: number) => ReactNode
  /** Opcional: handler al tap-row en movil (ej. navegar al detalle). */
  onMobileItemClick?: (record: T, index: number) => void
}

export function ResponsiveListTable<T extends object>({
  mobileRender,
  onMobileItemClick,
  dataSource,
  loading,
  pagination,
  rowKey,
  ...tableProps
}: ResponsiveListTableProps<T>) {
  const screens = useBreakpoint()
  const isMobile = !screens.sm

  if (!isMobile) {
    return (
      <Table<T>
        dataSource={dataSource}
        loading={loading}
        pagination={pagination}
        rowKey={rowKey}
        {...tableProps}
      />
    )
  }

  // En movil: renderizar como lista de cards
  const getRowKey = (item: T, idx: number): string => {
    if (typeof rowKey === 'function') return String(rowKey(item, idx))
    if (typeof rowKey === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (item as any)[rowKey]
      return String(v ?? idx)
    }
    return String(idx)
  }

  // Normalizar pagination: puede ser false, TablePaginationConfig u undefined.
  const paginationProp = pagination === false ? false : pagination
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paginationAny = paginationProp as any
  const listPagination: React.ComponentProps<typeof List>['pagination'] =
    paginationProp === false
      ? false
      : {
          current: paginationAny?.current ?? 1,
          pageSize: paginationAny?.pageSize ?? 10,
          total: paginationAny?.total ?? 0,
          showSizeChanger: paginationAny?.showSizeChanger ?? false,
          showTotal: paginationAny?.showTotal,
          onChange: (page: number, pageSize: number) => {
            if (paginationAny?.onChange) paginationAny.onChange(page, pageSize)
          },
          onShowSizeChange: paginationAny?.onShowSizeChange,
          align: 'center',
          size: 'small',
          responsive: true,
        }

  return (
    <List
      dataSource={dataSource as T[] | undefined}
      loading={loading}
      pagination={listPagination}
      rowKey={rowKey as React.ComponentProps<typeof List>['rowKey']}
      renderItem={(item, idx) => (
        <List.Item
          key={getRowKey(item, idx)}
          onClick={onMobileItemClick ? () => onMobileItemClick(item, idx) : undefined}
          style={{
            padding: '12px 4px',
            cursor: onMobileItemClick ? 'pointer' : 'default',
            alignItems: 'stretch',
          }}
        >
          <div style={{ width: '100%' }}>{mobileRender(item, idx)}</div>
        </List.Item>
      )}
    />
  )
}
