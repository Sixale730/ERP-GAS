'use client'

import { Grid, Space, Typography } from 'antd'
import type { CSSProperties, ReactNode } from 'react'

const { Title } = Typography
const { useBreakpoint } = Grid

/**
 * Header responsivo para paginas de listado / detalle con muchas acciones.
 *
 * - Desktop (>=sm): titulo a la izquierda, acciones a la derecha (flex-row).
 * - Movil (xs):     titulo arriba, acciones en una Space wrap debajo.
 *
 * Los hijos que pases como `actions` se renderizan tal cual (Button,
 * BotonExportar, Dropdown custom, etc). Todo el wrapping y alineacion
 * responsiva lo maneja el componente.
 */
export function PageHeaderActions({
  titulo,
  titleLevel = 2,
  actions,
  style,
}: {
  titulo: ReactNode
  titleLevel?: 2 | 3 | 4
  actions?: ReactNode
  style?: CSSProperties
}) {
  const screens = useBreakpoint()
  const isMobile = !screens.sm

  const effectiveLevel = (isMobile ? Math.min(titleLevel + 1, 4) : titleLevel) as 2 | 3 | 4

  if (isMobile) {
    return (
      <div style={{ marginBottom: 16, ...style }}>
        <Title level={effectiveLevel} style={{ margin: 0 }}>
          {titulo}
        </Title>
        {actions && (
          <Space style={{ marginTop: 12 }} wrap>
            {actions}
          </Space>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
        flexWrap: 'wrap',
        ...style,
      }}
    >
      <Title level={effectiveLevel} style={{ margin: 0 }}>
        {titulo}
      </Title>
      {actions && <Space wrap>{actions}</Space>}
    </div>
  )
}
