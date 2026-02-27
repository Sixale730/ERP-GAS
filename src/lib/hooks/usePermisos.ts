'use client'

import { useMemo } from 'react'
import { useAuth, PermisoCRUD } from './useAuth'
import { PERMISOS_DEFAULT, MODULOS_LIST } from '@/lib/config/modules'
import type { Modulo } from '@/lib/config/modules'

export type { Modulo }

export type UserRole = 'super_admin' | 'admin_cliente' | 'vendedor' | 'compras' | 'contador'

export type PermisosUsuario = Record<string, PermisoCRUD>

export type Accion = keyof PermisoCRUD

/** Module list for the usuarios permission table */
export const MODULOS = MODULOS_LIST

export { PERMISOS_DEFAULT }

export function getPermisosEfectivos(
  rol: UserRole | string | null,
  permisosCustom: PermisosUsuario | null
): PermisosUsuario {
  if (!rol) return PERMISOS_DEFAULT.vendedor
  const defaults = PERMISOS_DEFAULT[rol as UserRole]
  if (!defaults) return PERMISOS_DEFAULT.vendedor
  if (!permisosCustom) return defaults
  // Merge: custom overrides defaults per module
  const result: PermisosUsuario = { ...defaults }
  for (const modulo of Object.keys(permisosCustom)) {
    result[modulo] = permisosCustom[modulo]
  }
  return result
}

export function usePermisos() {
  const { role, erpUser } = useAuth()

  const permisos = useMemo(
    () => getPermisosEfectivos(role, erpUser?.permisos ?? null),
    [role, erpUser?.permisos]
  )

  const tienePermiso = (modulo: Modulo, accion: Accion): boolean => {
    const moduloPermisos = permisos[modulo]
    if (!moduloPermisos) return false
    return moduloPermisos[accion] ?? false
  }

  return {
    permisos,
    tienePermiso,
  }
}
