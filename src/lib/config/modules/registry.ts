import { productosManifest } from './productos'
import { inventarioManifest } from './inventario'
import { clientesManifest } from './clientes'
import { cotizacionesManifest } from './cotizaciones'
import { ordenesVentaManifest } from './ordenes-venta'
import { facturasManifest } from './facturas'
import { cfdiManifest } from './cfdi'
import { comprasManifest } from './compras'
import { reportesManifest } from './reportes'
import { catalogosManifest } from './catalogos'
import { configuracionManifest } from './configuracion'
import type { ModuleManifestInput, PermisoCRUD, UserRole } from './types'

// ─── Central manifest registry ──────────────────────────────────────────────

const ALL_MANIFESTS = {
  productos: productosManifest,
  inventario: inventarioManifest,
  clientes: clientesManifest,
  cotizaciones: cotizacionesManifest,
  ordenes_venta: ordenesVentaManifest,
  facturas: facturasManifest,
  cfdi: cfdiManifest,
  compras: comprasManifest,
  reportes: reportesManifest,
  catalogos: catalogosManifest,
  configuracion: configuracionManifest,
}

/** Auto-derived module ID union — extends automatically when a manifest is added */
export type Modulo = keyof typeof ALL_MANIFESTS

/** Full typed registry keyed by Modulo */
export const MODULE_REGISTRY = ALL_MANIFESTS as Record<Modulo, ModuleManifestInput>

// ─── Backward-compatible exports ────────────────────────────────────────────

export interface ModuloInfo {
  label: string
  descripcion: string
  core: boolean
  dependencias: Modulo[]
}

/** Registry in the shape consumed by ModuleGuard, admin panel, etc. */
export const MODULOS_REGISTRO: Record<Modulo, ModuloInfo> = Object.fromEntries(
  Object.entries(ALL_MANIFESTS).map(([key, m]) => [
    key,
    {
      label: m.label,
      descripcion: m.descripcion,
      core: m.core,
      dependencias: m.dependencias as Modulo[],
    },
  ])
) as Record<Modulo, ModuloInfo>

/** All module keys as an array */
export const TODOS_LOS_MODULOS = Object.keys(ALL_MANIFESTS) as Modulo[]

/** Module list for the usuarios permission table */
export const MODULOS_LIST: { key: Modulo; label: string }[] = TODOS_LOS_MODULOS.map((key) => ({
  key,
  label: ALL_MANIFESTS[key].label,
}))

// ─── Auto-derived PERMISOS_DEFAULT ──────────────────────────────────────────

export type PermisosUsuario = Record<string, PermisoCRUD>

const ROLES: UserRole[] = ['super_admin', 'admin_cliente', 'vendedor', 'compras', 'contador']

/** Default permissions per role, auto-derived from all manifests */
export const PERMISOS_DEFAULT: Record<UserRole, PermisosUsuario> = Object.fromEntries(
  ROLES.map((rol) => [
    rol,
    Object.fromEntries(
      Object.entries(ALL_MANIFESTS).map(([key, m]) => [key, m.permisosPorRol[rol]])
    ),
  ])
) as Record<UserRole, PermisosUsuario>

// ─── Utility functions ──────────────────────────────────────────────────────

/**
 * Given the globally-enabled module list and an org's disabled list,
 * returns the final set of active modules.
 */
export function getModulosActivos(
  modulosGlobales: string[],
  orgDeshabilitados: string[]
): Modulo[] {
  const deshabilitadosSet = new Set(orgDeshabilitados)
  return modulosGlobales.filter((m) => {
    const info = MODULOS_REGISTRO[m as Modulo]
    if (info?.core) return true
    return !deshabilitadosSet.has(m)
  }) as Modulo[]
}

/**
 * Returns modules that directly or transitively depend on the given module.
 */
export function getDependientes(modulo: Modulo): Modulo[] {
  const dependientes: Modulo[] = []
  const visited = new Set<Modulo>()

  function buscar(mod: Modulo) {
    for (const [key, info] of Object.entries(MODULOS_REGISTRO)) {
      const m = key as Modulo
      if (!visited.has(m) && info.dependencias.includes(mod)) {
        visited.add(m)
        dependientes.push(m)
        buscar(m)
      }
    }
  }

  buscar(modulo)
  return dependientes
}
