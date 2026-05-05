import dayjs from 'dayjs'

export type RangePreset = { label: string; value: [dayjs.Dayjs, dayjs.Dayjs] }

/**
 * Presets compartidos para RangePicker de Ant Design en reportes.
 * Cubren ~90% de los rangos que un usuario consulta tipicamente, evitando
 * tener que pelear con las flechas dobles del calendario que mueven ambos
 * paneles en sincronia.
 *
 * IMPORTANTE: la funcion debe llamarse en cada montaje (no se cachea a
 * nivel modulo) para que "Hoy", "Este mes", etc. siempre reflejen la
 * fecha actual del usuario. Usar con useMemo en el componente.
 */
export function getRangePresets(): RangePreset[] {
  return [
    { label: 'Hoy',             value: [dayjs().startOf('day'),                          dayjs().endOf('day')] },
    { label: 'Esta semana',     value: [dayjs().startOf('week'),                         dayjs().endOf('week')] },
    { label: 'Este mes',        value: [dayjs().startOf('month'),                        dayjs().endOf('month')] },
    { label: 'Mes pasado',      value: [dayjs().subtract(1, 'month').startOf('month'),   dayjs().subtract(1, 'month').endOf('month')] },
    { label: 'Últimos 3 meses', value: [dayjs().subtract(3, 'month').startOf('month'),   dayjs().endOf('month')] },
    { label: 'Últimos 6 meses', value: [dayjs().subtract(6, 'month').startOf('month'),   dayjs().endOf('month')] },
    { label: 'Año actual',      value: [dayjs().startOf('year'),                         dayjs().endOf('year')] },
    { label: 'Año pasado',      value: [dayjs().subtract(1, 'year').startOf('year'),     dayjs().subtract(1, 'year').endOf('year')] },
  ]
}
