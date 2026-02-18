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

const ALL: PermisoCRUD = { ver: true, crear: true, editar: true, eliminar: true }
const VIEW_ONLY: PermisoCRUD = { ver: true, crear: false, editar: false, eliminar: false }
const VCE: PermisoCRUD = { ver: true, crear: true, editar: true, eliminar: false }
const NONE: PermisoCRUD = { ver: false, crear: false, editar: false, eliminar: false }

export const PERMISOS_DEFAULT: Record<UserRole, PermisosUsuario> = {
  super_admin: {
    productos: ALL,
    inventario: ALL,
    clientes: ALL,
    cotizaciones: ALL,
    ordenes_venta: ALL,
    facturas: ALL,
    compras: ALL,
    reportes: ALL,
    catalogos: ALL,
    configuracion: ALL,
  },
  admin_cliente: {
    productos: ALL,
    inventario: ALL,
    clientes: ALL,
    cotizaciones: ALL,
    ordenes_venta: ALL,
    facturas: ALL,
    compras: ALL,
    reportes: ALL,
    catalogos: ALL,
    configuracion: VCE,
  },
  vendedor: {
    productos: VIEW_ONLY,
    inventario: VIEW_ONLY,
    clientes: VCE,
    cotizaciones: VCE,
    ordenes_venta: VCE,
    facturas: VIEW_ONLY,
    compras: NONE,
    reportes: VIEW_ONLY,
    catalogos: VIEW_ONLY,
    configuracion: NONE,
  },
  compras: {
    productos: ALL,
    inventario: ALL,
    clientes: VIEW_ONLY,
    cotizaciones: VIEW_ONLY,
    ordenes_venta: VIEW_ONLY,
    facturas: VIEW_ONLY,
    compras: ALL,
    reportes: VIEW_ONLY,
    catalogos: VCE,
    configuracion: NONE,
  },
  contador: {
    productos: VIEW_ONLY,
    inventario: VIEW_ONLY,
    clientes: VCE,
    cotizaciones: VIEW_ONLY,
    ordenes_venta: VIEW_ONLY,
    facturas: ALL,
    compras: VIEW_ONLY,
    reportes: ALL,
    catalogos: VIEW_ONLY,
    configuracion: NONE,
  },
}

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
