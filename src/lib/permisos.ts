/**
 * Permisos centralizados - Shared entre client y server
 * Importar desde '@/lib/permisos' en ambos contextos
 */

export type UserRole = 'super_admin' | 'admin_cliente' | 'vendedor' | 'compras' | 'contador'

export interface PermisoCRUD {
  ver: boolean
  crear: boolean
  editar: boolean
  eliminar: boolean
}

export type PermisosUsuario = Record<string, PermisoCRUD>

import { PERMISOS_DEFAULT } from '@/lib/config/modules'
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
