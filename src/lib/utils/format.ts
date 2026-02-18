import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import 'dayjs/locale/es'
import { MONEDAS, type CodigoMoneda } from '@/lib/config/moneda'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('es')
dayjs.tz.setDefault('America/Mexico_City')

/**
 * Formatea un número como moneda (USD por defecto)
 */
export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00 USD'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' USD'
}

/**
 * Formatea un número como moneda USD
 */
export function formatMoneyUSD(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00 USD'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' USD'
}

/**
 * Formatea un número como moneda MXN
 */
export function formatMoneyMXN(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00 MXN'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' MXN'
}

/**
 * Formatea un número en la moneda especificada
 * Si la moneda es MXN y se proporciona tipoCambio, convierte el monto
 */
export function formatMoneyCurrency(
  amount: number | null | undefined,
  moneda: CodigoMoneda,
  tipoCambio?: number
): string {
  if (amount === null || amount === undefined) return `$0.00 ${moneda}`

  let finalAmount = amount

  // Si es MXN y hay tipo de cambio, convertir
  if (moneda === 'MXN' && tipoCambio) {
    finalAmount = amount * tipoCambio
  }

  const config = MONEDAS[moneda]

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(finalAmount) + ` ${moneda}`
}

/**
 * Formatea un número como moneda sin sufijo de moneda
 * Muestra solo $XX,XXX.XX
 */
export function formatMoneySimple(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formatea una fecha
 */
export function formatDate(date: string | Date | null | undefined, format: string = 'DD/MM/YYYY'): string {
  if (!date) return '-'
  return dayjs.utc(date).tz().format(format)
}

/**
 * Formatea una fecha con hora
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return dayjs.utc(date).tz().format('DD/MM/YYYY HH:mm')
}

/**
 * Formatea un número con separadores de miles
 */
export function formatNumber(num: number | null | undefined, decimals: number = 0): string {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

/**
 * Parsea un string de moneda a número
 */
export function parseMoney(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '')
  return parseFloat(cleaned) || 0
}

/**
 * Calcula el IVA (16%)
 */
export function calcularIVA(subtotal: number): number {
  return subtotal * 0.16
}

/**
 * Calcula el total con IVA
 */
export function calcularTotal(subtotal: number, descuento: number = 0): { subtotal: number; iva: number; total: number } {
  const subtotalConDescuento = subtotal - descuento
  const iva = calcularIVA(subtotalConDescuento)
  const total = subtotalConDescuento + iva
  return { subtotal: subtotalConDescuento, iva, total }
}
