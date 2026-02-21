import type { Modulo } from '@/lib/hooks/usePermisos'

export interface ModuloInfo {
  label: string
  descripcion: string
  core: boolean
  dependencias: Modulo[]
}

export const MODULOS_REGISTRO: Record<Modulo, ModuloInfo> = {
  productos: {
    label: 'Productos',
    descripcion: 'Catalogo de productos',
    core: false,
    dependencias: [],
  },
  inventario: {
    label: 'Inventario',
    descripcion: 'Control de stock por almacen',
    core: false,
    dependencias: ['productos'],
  },
  clientes: {
    label: 'Clientes',
    descripcion: 'Gestion de clientes',
    core: false,
    dependencias: [],
  },
  cotizaciones: {
    label: 'Cotizaciones',
    descripcion: 'Cotizaciones y presupuestos',
    core: false,
    dependencias: ['productos', 'clientes'],
  },
  ordenes_venta: {
    label: 'Ordenes de Venta',
    descripcion: 'Ordenes de venta',
    core: false,
    dependencias: ['cotizaciones'],
  },
  facturas: {
    label: 'Facturas',
    descripcion: 'Facturacion y cobranza',
    core: false,
    dependencias: ['clientes'],
  },
  cfdi: {
    label: 'CFDI / Timbrado',
    descripcion: 'Facturacion electronica SAT',
    core: false,
    dependencias: ['facturas'],
  },
  compras: {
    label: 'Compras',
    descripcion: 'Ordenes de compra a proveedores',
    core: false,
    dependencias: ['productos'],
  },
  reportes: {
    label: 'Reportes',
    descripcion: 'Reportes y analitica',
    core: false,
    dependencias: [],
  },
  catalogos: {
    label: 'Catalogos',
    descripcion: 'Almacenes, categorias, proveedores, precios',
    core: false,
    dependencias: [],
  },
  configuracion: {
    label: 'Configuracion',
    descripcion: 'Configuracion del sistema',
    core: true,
    dependencias: [],
  },
}

/** All module keys */
export const TODOS_LOS_MODULOS = Object.keys(MODULOS_REGISTRO) as Modulo[]

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
    // Core modules can never be disabled
    if (info?.core) return true
    return !deshabilitadosSet.has(m)
  }) as Modulo[]
}

/**
 * Returns modules that directly or transitively depend on the given module.
 * Used to warn admins when disabling a module that others rely on.
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
        buscar(m) // transitive dependents
      }
    }
  }

  buscar(modulo)
  return dependientes
}
