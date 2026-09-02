/**
 * Logica de calculo de cotizaciones.
 *
 * Funciones puras, sin React ni Supabase, para que la usen por igual:
 *   - la pagina /cotizaciones/nueva
 *   - la API /api/bot/cotizaciones (el asistente de Telegram)
 *
 * Si esto se duplica, la web y el bot pueden cotizar precios distintos
 * y nadie se entera hasta que un cliente reclama. Por eso vive aqui.
 */
import { calcularTotal } from '@/lib/utils/format'
import type { CodigoMoneda } from '@/lib/config/moneda'

/** SKU del servicio de envio. Su precio se captura en MXN y NO se convierte por tipo de cambio. */
export const SKU_ENVIO = 'SER-ENV'

export interface ItemCalculado {
  producto_id: string
  descripcion: string
  cantidad: number
  precio_lista: number
  moneda_precio: CodigoMoneda
  margen_porcentaje: number
  precio_unitario: number
  subtotal: number
}

/** Redondeo a centavos. */
export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Precio unitario en la moneda destino, aplicando margen y tipo de cambio.
 *
 * El margen se aplica ANTES de convertir, y la conversion solo ocurre si las
 * monedas difieren.
 *
 * El resultado va REDONDEADO A CENTAVOS a proposito: es el precio que se
 * imprime en la cotizacion, y el subtotal se calcula sobre el mismo numero que
 * ve el cliente. Si no se redondeara aqui, un renglon de "3 x $5,395.78" podria
 * arrojar un subtotal de $16,187.33 en vez de $16,187.34 y la suma no cuadraria
 * a ojos del cliente.
 */
export function calcularPrecioFinal(
  precioBase: number,
  monedaOrigen: CodigoMoneda,
  monedaDestino: CodigoMoneda,
  tipoCambio: number,
  margenPct = 0,
): number {
  const precioConMargen = precioBase * (1 + margenPct / 100)
  if (monedaOrigen === monedaDestino) return redondear(precioConMargen)
  if (monedaOrigen === 'USD') return redondear(precioConMargen * tipoCambio) // USD -> MXN
  return redondear(precioConMargen / tipoCambio) // MXN -> USD
}

/** Totales de la cotizacion: subtotal, descuento, IVA y total. */
export function calcularTotales(items: Pick<ItemCalculado, 'subtotal'>[], descuentoPct = 0) {
  const subtotalBruto = items.reduce((sum, i) => sum + i.subtotal, 0)
  const descuentoMonto = subtotalBruto * (descuentoPct / 100)
  const { iva, total } = calcularTotal(subtotalBruto, descuentoMonto)
  return { subtotal: subtotalBruto, descuentoMonto, iva, total }
}

// ---------------------------------------------------------------------------
// Notas generales
// ---------------------------------------------------------------------------

export interface OpcionesNotas {
  /** "inmediata" | "15" | "10-12" | undefined. Si no viene, no se agrega la linea. */
  entrega?: string
  /** true si alguna partida es SER-ENV. Si es false se agrega "ENVIO POR COBRAR". */
  llevaEnvio: boolean
  /** Lineas extra que pidio el vendedor, tal cual. */
  extras?: string[]
}

/**
 * Arma las notas generales con el formato que usa SOLAC.
 *
 * Orden observado en las cotizaciones reales:
 *   1. Entrega (si se indico)
 *   2. LAB GDL          <- siempre
 *   3. ENVIO POR COBRAR <- solo si la cotizacion no trae SER-ENV
 *   4. Extras
 *
 * Nota: en las cotizaciones capturadas a mano se escribe "DOM POR COBRAR" u
 * "OCURRE PAGADO <lugar>" segun como se mande. El bot no sabe el metodo de
 * envio, asi que usa el generico "ENVIO POR COBRAR"; si el vendedor indica
 * el metodo, entra como extra y reemplaza al generico.
 */
export function armarNotas({ entrega, llevaEnvio, extras = [] }: OpcionesNotas): string {
  const lineas: string[] = []

  const e = normalizarEntrega(entrega)
  if (e) lineas.push(e)

  lineas.push('LAB GDL')

  const extrasLimpios = extras.map((x) => x.trim()).filter(Boolean)
  const yaHablaDeEnvio = extrasLimpios.some((x) => /\b(DOM|OCURRE|ENVIO)\b/i.test(x))
  if (!llevaEnvio && !yaHablaDeEnvio) lineas.push('ENVIO POR COBRAR')

  lineas.push(...extrasLimpios)
  return lineas.join('\n')
}

/**
 * Normaliza la indicacion de entrega al formato estandar de SOLAC.
 *   "inmediata"  -> "ENTREGA INMEDIATA"
 *   "15"         -> "TIEMPO DE ENTREGA 15 DIAS DESPUES DE OC O PAGO"
 *   "10-12"      -> "TIEMPO DE ENTREGA 10-12 DIAS DESPUES DE OC O PAGO"
 *   "2 semanas"  -> "TIEMPO DE ENTREGA 2 SEMANAS DESPUES DE OC O PAGO"
 * Cualquier otro texto se sube a mayusculas y se deja tal cual.
 */
export function normalizarEntrega(entrega?: string): string | null {
  if (!entrega) return null
  const t = entrega.trim()
  if (!t) return null

  if (/inmediat/i.test(t)) return 'ENTREGA INMEDIATA'

  // Solo dias: "15", "10-12"
  const soloDias = t.match(/^(\d+(?:\s*-\s*\d+)?)$/)
  if (soloDias) {
    return `TIEMPO DE ENTREGA ${soloDias[1].replace(/\s/g, '')} DIAS DESPUES DE OC O PAGO`
  }

  // Con unidad: "15 dias", "2 semanas", "10-12 días"
  const conUnidad = t.match(/^(\d+(?:\s*-\s*\d+)?)\s*(d[ií]as?|semanas?|meses?|mes)$/i)
  if (conUnidad) {
    const n = conUnidad[1].replace(/\s/g, '')
    const u = sinAcentos(conUnidad[2]).toUpperCase()
    const unidad = u.startsWith('DIA') ? 'DIAS' : u.startsWith('SEMANA') ? 'SEMANAS' : 'MESES'
    return `TIEMPO DE ENTREGA ${n} ${unidad} DESPUES DE OC O PAGO`
  }

  return sinAcentos(t).toUpperCase()
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Para comparar nombres de plaza/cliente que vienen escritos de formas distintas. */
export function normalizar(s: string): string {
  return sinAcentos(s).toLowerCase().replace(/\s+/g, ' ').trim()
}
