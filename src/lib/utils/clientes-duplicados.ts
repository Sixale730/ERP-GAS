/**
 * Utilidades para detectar duplicados al crear clientes.
 * Combina dos estrategias:
 *  - RFC: comparacion exacta normalizada (UPPER + TRIM). Espejo del UNIQUE
 *    PARCIAL en BD `uniq_clientes_rfc_activo_org`.
 *  - Nombre: matching fuzzy ligero (normalizado sin acentos, sin sufijos
 *    societarios comunes, comparacion por inclusion). Solo para sugerencia
 *    visual; NO bloquea ni hay UNIQUE en BD.
 */

export interface ClienteResumen {
  id: string
  codigo: string
  nombre_comercial: string | null
  razon_social: string | null
  rfc: string | null
}

const SUFIJOS_A_QUITAR = [
  's.a. de c.v.', 'sa de cv', 's. a. de c. v.', 'sociedad anonima',
  's. de r.l. de c.v.', 's de rl de cv', 's. de r.l.', 's de rl',
  's.c.', 'sc', 's.a.', 'sa', 'sapi', 's.a.p.i.',
  'distribuidora', 'comercializadora', 'comercial', 'grupo',
  'corporativo', 'corporativa', 'servicios', 'sociedad',
]

/** Normaliza un string para comparar: lowercase, sin acentos, sin puntuacion, trim */
export function normalizarTexto(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[.,;:()_/\\-]/g, ' ')   // puntuacion -> espacio
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normaliza un nombre comercial removiendo sufijos societarios comunes */
export function normalizarNombre(s: string | null | undefined): string {
  let out = normalizarTexto(s)
  if (!out) return ''
  for (const sufijo of SUFIJOS_A_QUITAR) {
    // Quitar como palabra completa solo si esta al inicio o al final
    const pattern = new RegExp(`(^|\\s)${sufijo.replace(/[.+?^${}()|[\\]\\\\]/g, '\\$&')}(\\s|$)`, 'g')
    out = out.replace(pattern, ' ')
  }
  return out.replace(/\s+/g, ' ').trim()
}

/** Normaliza un RFC: UPPER + TRIM. Espejo de la BD. */
export function normalizarRFC(rfc: string | null | undefined): string {
  return (rfc ?? '').trim().toUpperCase()
}

/**
 * Decide si dos nombres son "parecidos":
 *  - Mismo normalizado, o
 *  - Uno contiene al otro (longitud minima 5 para evitar falsos positivos).
 */
export function nombresSonSimilares(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarNombre(a)
  const nb = normalizarNombre(b)
  if (!na || !nb || na.length < 3 || nb.length < 3) return false
  if (na === nb) return true
  const min = Math.min(na.length, nb.length)
  if (min < 5) return false
  return na.includes(nb) || nb.includes(na)
}

/** Busca matches por nombre en una lista de clientes activos */
export function buscarMatchesPorNombre(
  nombre: string | null | undefined,
  clientes: ClienteResumen[]
): ClienteResumen[] {
  if (!nombre || nombre.trim().length < 3) return []
  return clientes.filter(
    (c) =>
      nombresSonSimilares(nombre, c.nombre_comercial) ||
      nombresSonSimilares(nombre, c.razon_social)
  )
}

/** Busca el primer match exacto por RFC en una lista de clientes activos */
export function buscarMatchPorRFC(
  rfc: string | null | undefined,
  clientes: ClienteResumen[]
): ClienteResumen | null {
  const normRfc = normalizarRFC(rfc)
  if (!normRfc) return null
  return clientes.find((c) => normalizarRFC(c.rfc) === normRfc) ?? null
}
