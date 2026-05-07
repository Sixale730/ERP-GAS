/**
 * Helpers para "Compartir guia con cliente"
 * - renderTemplate: aplica variables {placeholder} a una plantilla.
 * - formatPhoneForWhatsApp: limpia un telefono libre y lo convierte al
 *   formato que acepta wa.me (solo digitos, prefijo de pais MX por default).
 * - buildWhatsAppUrl, buildMailtoUrl: construyen las URLs.
 */

import type { GuiaEnvio } from '@/lib/hooks/queries/useGuiasEnvio'
import { PAQUETERIA_LABELS, buildTrackingUrl } from '@/lib/hooks/queries/useGuiasEnvio'

export interface VariablesPlantilla {
  cliente: string
  atencion: string
  folio: string
  numero_guia: string
  paqueteria: string
  tracking_url: string
  ciudad: string
  estado: string
}

/**
 * Construye las variables a partir de una guia + opcional cliente_nombre override.
 * Si la guia no tiene algun campo, usamos un placeholder vacio o un dash para no
 * dejar literal "{...}" en el mensaje.
 */
export function variablesFromGuia(
  guia: GuiaEnvio,
  fallbackClienteNombre?: string | null,
): VariablesPlantilla {
  return {
    cliente: guia.cliente_nombre || fallbackClienteNombre || guia.cliente_nombre_libre || 'cliente',
    atencion: guia.atencion_a || guia.cliente_nombre || fallbackClienteNombre || 'cliente',
    folio: guia.folio,
    numero_guia: guia.numero_guia || '(sin numero asignado)',
    paqueteria: PAQUETERIA_LABELS[guia.paqueteria],
    tracking_url: buildTrackingUrl(guia.paqueteria, guia.numero_guia) || '',
    ciudad: guia.destino_ciudad || '',
    estado: guia.destino_estado || '',
  }
}

/**
 * Reemplaza {variable} con el valor correspondiente. Variables no encontradas
 * se eliminan del texto (placeholder vacio mejor que "{ciudad}" en pantalla).
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in vars) return vars[key]
    return ''
  })
}

/**
 * Formatea un telefono libre al formato que acepta wa.me (solo digitos
 * sin '+' ni separadores). Reglas para Mexico:
 * - Quita espacios, guiones, parentesis, puntos.
 * - Si empieza con '+', se quita.
 * - Si tiene 10 digitos -> agrega prefijo '521' (Mexico movil).
 * - Si tiene 12 digitos y empieza con '52' -> agrega un '1' despues del 52
 *   (Mexico movil debe ser 521 + 10 digitos para WhatsApp).
 * - Si tiene 13 digitos y empieza con '521' -> ya esta bien.
 * - Otros casos: dejar tal cual con los digitos extraidos.
 */
export function formatPhoneForWhatsApp(raw: string | null | undefined): string {
  if (!raw) return ''
  // Quitar todo lo que no sea digito o '+'
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (digits.length === 0) return ''

  // 10 digitos: numero local MX, agregar 521
  if (digits.length === 10) return '521' + digits

  // 12 digitos empezando con 52: 52 + 10 digitos -> agregar el "1" del movil
  if (digits.length === 12 && digits.startsWith('52')) {
    return '521' + digits.slice(2)
  }

  // 13 digitos empezando con 521: ya esta correcto
  if (digits.length === 13 && digits.startsWith('521')) return digits

  // 11 digitos empezando con 1: probablemente USA con prefijo. Dejar tal cual.
  if (digits.length === 11 && digits.startsWith('1')) return digits

  // Si tiene mas o menos digitos, devolver lo que se extrajo (que el usuario
  // valide visualmente antes de hacer click).
  return digits
}

export function isValidPhoneForWhatsApp(formatted: string): boolean {
  // wa.me requiere al menos 10 digitos (numero local) y maximo 15 (estandar E.164)
  return /^\d{10,15}$/.test(formatted)
}

export function buildWhatsAppUrl(phoneFormatted: string, message: string): string {
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${phoneFormatted}?text=${encoded}`
}

export function buildMailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
