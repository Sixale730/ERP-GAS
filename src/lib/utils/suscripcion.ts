import type { SuscripcionColorSemaforo } from '@/types/suscripciones'

/**
 * Color del semaforo del banner segun dias restantes y umbral de alerta.
 * Espejo de la logica en erp.estado_suscripcion() — duplicada en cliente
 * solo para casos de fallback. La fuente de verdad es la RPC.
 */
export function getSemaforoColor(diasRestantes: number, diasAlerta: number): SuscripcionColorSemaforo {
  if (diasRestantes <= 1) return 'rojo'
  if (diasRestantes <= 2) return 'naranja'
  if (diasRestantes <= diasAlerta) return 'amarillo'
  return 'verde'
}

/** Colores hex / antd para cada estado del semaforo */
export const SEMAFORO_COLORS: Record<SuscripcionColorSemaforo, { bg: string; border: string; text: string; icon: string }> = {
  verde:    { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d', icon: '🟢' },
  amarillo: { bg: '#fffbe6', border: '#ffe58f', text: '#d48806', icon: '🟡' },
  naranja:  { bg: '#fff7e6', border: '#ffd591', text: '#d46b08', icon: '🟠' },
  rojo:     { bg: '#fff1f0', border: '#ffa39e', text: '#cf1322', icon: '🔴' },
}

/**
 * Limpia un numero de WhatsApp dejando solo digitos.
 * Acepta formatos +52 1 33..., 52 1 33..., (33)..., etc.
 */
export function cleanWhatsappNumber(telefono: string): string {
  return (telefono || '').replace(/\D/g, '')
}

/** Genera link wa.me (abre WhatsApp Web o app movil) */
export function buildWhatsappLink(telefono: string, mensaje?: string): string {
  const num = cleanWhatsappNumber(telefono)
  if (!num) return '#'
  const base = `https://wa.me/${num}`
  return mensaje && mensaje.trim() ? `${base}?text=${encodeURIComponent(mensaje)}` : base
}

/** Format fecha YYYY-MM-DD a "30 de mayo de 2026" */
const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
export function formatFechaLarga(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  return `${d} de ${MESES_ES[m - 1]} de ${y}`
}

/** Format fecha YYYY-MM-DD a "30 de mayo" (sin año) */
export function formatFechaCorta(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number)
  if (!m || !d) return isoDate
  return `${d} de ${MESES_ES[m - 1]}`
}

/** Format monto MXN */
export function formatMonto(monto: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(monto)
}
