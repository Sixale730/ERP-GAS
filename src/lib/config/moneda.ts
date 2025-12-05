export type CodigoMoneda = 'USD' | 'MXN'

export interface Moneda {
  codigo: CodigoMoneda
  simbolo: string
  nombre: string
  locale: string
}

export const MONEDAS: Record<CodigoMoneda, Moneda> = {
  USD: {
    codigo: 'USD',
    simbolo: '$',
    nombre: 'Dólar Americano',
    locale: 'en-US'
  },
  MXN: {
    codigo: 'MXN',
    simbolo: '$',
    nombre: 'Peso Mexicano',
    locale: 'es-MX'
  }
}

// Valores de fallback (usados si no hay configuración en BD)
export const TIPO_CAMBIO_FALLBACK = 17.50
export const MARGEN_GANANCIA_FALLBACK = 30

// Mantener compatibilidad con código existente
export const TIPO_CAMBIO_DEFAULT = TIPO_CAMBIO_FALLBACK

// Moneda base del sistema (los costos están en USD)
export const MONEDA_BASE: CodigoMoneda = 'USD'
