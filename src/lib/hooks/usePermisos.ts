'use client'

import { useMemo } from 'react'
import { useAuth, UserRole, PermisoCRUD, PermisosUsuario } from './useAuth'

export type Modulo =
  | 'productos'
  | 'inventario'
  | 'clientes'
  | 'cotizaciones'
  | 'ordenes_venta'
  | 'facturas'
  | 'compras'
  | 'reportes'
  | 'catalogos'
  | 'configuracion'

export type Accion = keyof PermisoCRUD

export const MODULOS: { key: Modulo; label: string }[] = [
  { key: 'productos', label: 'Productos' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'cotizaciones', label: 'Cotizaciones' },
  { key: 'ordenes_venta', label: 'Ordenes de Venta' },
  { key: 'facturas', label: 'Facturas' },
  { key: 'compras', label: 'Compras' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'catalogos', label: 'Catalogos' },
  { key: 'configuracion', label: 'Configuracion' },
]

const ALL = { ver: true, crear: true, editar: true, eliminar: true }
const VIEW_ONLY = { ver: true, crear: false, editar: false, eliminar: false }
const VCE = { ver: true, crear: true, editar: true, eliminar: false }
const NONE = { ver: false, crear: false, editar: false, eliminar: false }

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
  rol: UserRole | null,
  permisosCustom: PermisosUsuario | null
): PermisosUsuario {
  if (!rol) return PERMISOS_DEFAULT.vendedor
  const defaults = PERMISOS_DEFAULT[rol]
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
