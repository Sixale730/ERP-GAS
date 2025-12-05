import dayjs from 'dayjs'
import 'dayjs/locale/es'

dayjs.locale('es')

/**
 * Formatea un número como moneda MXN
 */
export function formatMoney(amount: number | null | undefined): string {
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
  return dayjs(date).format(format)
}

/**
 * Formatea una fecha con hora
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return dayjs(date).format('DD/MM/YYYY HH:mm')
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
