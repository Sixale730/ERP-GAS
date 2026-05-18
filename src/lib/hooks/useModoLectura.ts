'use client'

import { useSuscripcion } from '@/lib/hooks/queries/useSuscripcion'
import { useAuth } from '@/lib/hooks/useAuth'
import type { ModoLecturaBloqueos } from '@/types/suscripciones'

const BLOQUEOS_DEFAULT: ModoLecturaBloqueos = {
  crear: false,
  editar: false,
  timbrar: false,
  pagos: false,
  ajustes: false,
  descargar_pdf: false,
  exportar_excel: false,
  config: false,
}

export interface ModoLecturaResult {
  /** Si el modo lectura esta activo a nivel suscripcion */
  activo: boolean
  /** Flags individuales — solo aplican si activo === true */
  bloqueos: ModoLecturaBloqueos
  /** super_admin esta exento de modo lectura siempre (para que pueda pagar) */
  exento: boolean
  /** Helper: si la accion X esta bloqueada para este usuario */
  estaBloqueado: (accion: keyof ModoLecturaBloqueos) => boolean
}

/**
 * Hook que indica si la organizacion esta en modo solo lectura y que sub-acciones
 * estan bloqueadas. super_admin siempre esta exento (puede operar para registrar
 * pagos y reactivar el sistema).
 *
 * NOTA: en esta version la estructura esta lista pero los puntos de mutacion del
 * ERP todavia NO consultan estos flags. Se activan en una entrega posterior.
 */
export function useModoLectura(): ModoLecturaResult {
  const { role } = useAuth()
  const { data } = useSuscripcion()

  const activo = !!data?.modo_lectura_activo
  const bloqueos = (data?.modo_lectura_bloqueos as ModoLecturaBloqueos | undefined) ?? BLOQUEOS_DEFAULT
  const exento = role === 'super_admin'

  return {
    activo,
    bloqueos,
    exento,
    estaBloqueado: (accion) => {
      if (!activo) return false
      if (exento) return false
      return bloqueos[accion] === true
    },
  }
}
