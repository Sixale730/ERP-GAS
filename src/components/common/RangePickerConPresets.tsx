'use client'

import { useMemo } from 'react'
import { DatePicker } from 'antd'
import type { RangePickerProps } from 'antd/es/date-picker'
import { getRangePresets } from '@/lib/utils/date-presets'

const { RangePicker } = DatePicker

/**
 * Wrapper de Ant Design <RangePicker> que inyecta presets compartidos
 * (Hoy, Esta semana, Este mes, Mes pasado, Ultimos 3/6 meses, Ano actual,
 * Ano pasado) usando getRangePresets().
 *
 * Uso: reemplaza `<RangePicker ... />` por `<RangePickerConPresets ... />`
 * en cualquier reporte. Soporta exactamente las mismas props que el
 * RangePicker original; si el caller pasa su propia prop `presets`, esa
 * gana sobre el default.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RangePickerConPresets(props: RangePickerProps & { ref?: any }) {
  const defaultPresets = useMemo(() => getRangePresets(), [])
  return <RangePicker presets={defaultPresets} {...props} />
}
