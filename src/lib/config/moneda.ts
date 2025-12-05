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

// Tipo de cambio por defecto (MXN por 1 USD)
export const TIPO_CAMBIO_DEFAULT = 17.50

// Moneda base del sistema
export const MONEDA_BASE: CodigoMoneda = 'USD'
