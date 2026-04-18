'use client'

import { Button, Grid, Space } from 'antd'
import { FilterOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import { useState } from 'react'

const { useBreakpoint } = Grid

/**
 * Filtros responsivos: en >=sm se muestran siempre en fila.
 * En xs se colapsan detras de un boton "Filtros" para ahorrar espacio.
 *
 * Uso:
 *   <MobileFilters alwaysVisible={<Input ... />}>
 *     <Select ... />
 *     <Select ... />
 *   </MobileFilters>
 */
export function MobileFilters({
  children,
  alwaysVisible,
  defaultOpen = false,
}: {
  children: ReactNode
  /** Contenido que se muestra siempre (normalmente el Input de busqueda). */
  alwaysVisible?: ReactNode
  defaultOpen?: boolean
}) {
  const screens = useBreakpoint()
  const isMobile = !screens.sm
  const [open, setOpen] = useState(defaultOpen)

  if (!isMobile) {
    return (
      <Space style={{ marginBottom: 16 }} wrap>
        {alwaysVisible}
        {children}
      </Space>
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Space style={{ marginBottom: open ? 12 : 0, width: '100%' }} wrap>
        {alwaysVisible}
        <Button
          icon={<FilterOutlined />}
          onClick={() => setOpen((v) => !v)}
        >
          Filtros
        </Button>
      </Space>
      {open && (
        <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
          {children}
        </Space>
      )}
    </div>
  )
}
