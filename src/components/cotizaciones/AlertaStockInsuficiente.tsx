'use client'

import { Alert } from 'antd'

export interface ItemSinStock {
  key: string
  producto_id: string
  sku: string
  nombre: string
  solicitado: number
  disponible: number
  en_transito: number
}

interface Props {
  items: ItemSinStock[]
  tipo?: 'warning' | 'info'
  /** Texto que se concatena al título principal, p.ej. "se requerirá orden de compra". */
  messageSuffix?: string
  onClose?: () => void
  style?: React.CSSProperties
}

const colorRojo = '#cf1322'
const colorNaranja = '#d46b08'

export default function AlertaStockInsuficiente({
  items,
  tipo = 'warning',
  messageSuffix,
  onClose,
  style,
}: Props) {
  if (items.length === 0) return null

  const tituloBase = 'Productos sin disponible para venta'
  const titulo = messageSuffix ? `${tituloBase} — ${messageSuffix}` : tituloBase

  return (
    <Alert
      type={tipo}
      closable
      onClose={onClose}
      message={titulo}
      style={style}
      description={
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {items.map(it => {
            const faltan = Math.max(it.solicitado - it.disponible, 0)
            const colorFaltan = it.disponible < 0 ? colorRojo : colorNaranja
            return (
              <li key={it.key} style={{ marginBottom: 4 }}>
                <strong>{it.sku}</strong>
                {it.nombre ? <> · {it.nombre}</> : null}
                {' · '}
                <span style={{ color: colorFaltan, fontWeight: 600 }}>
                  faltan {faltan} pzs
                </span>
                <span style={{ color: '#8c8c8c' }}>
                  {' '}(pides {it.solicitado}, disponible {it.disponible})
                </span>
                {it.en_transito > 0 && (
                  <span style={{ color: '#1677ff', marginLeft: 6 }}>
                    🚛 vienen {it.en_transito} en tránsito
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      }
    />
  )
}
