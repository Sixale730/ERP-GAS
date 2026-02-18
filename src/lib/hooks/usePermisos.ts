'use client'

import { useMemo } from 'react'
import { useAuth, PermisoCRUD } from './useAuth'
import { PERMISOS_DEFAULT, getPermisosEfectivos } from '@/lib/permisos'
import type { PermisosUsuario, UserRole } from '@/lib/permisos'

// Re-export for backwards compatibility
export { PERMISOS_DEFAULT, getPermisosEfectivos }
export type { PermisosUsuario, UserRole }

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
