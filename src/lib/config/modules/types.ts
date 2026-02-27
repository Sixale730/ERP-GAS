/** Permission CRUD flags for a module */
export interface PermisoCRUD {
  ver: boolean
  crear: boolean
  editar: boolean
  eliminar: boolean
}

export type UserRole = 'super_admin' | 'admin_cliente' | 'vendedor' | 'compras' | 'contador'

// Permission presets — reusable across manifests
export const ALL: PermisoCRUD = { ver: true, crear: true, editar: true, eliminar: true }
export const VIEW_ONLY: PermisoCRUD = { ver: true, crear: false, editar: false, eliminar: false }
export const VCE: PermisoCRUD = { ver: true, crear: true, editar: true, eliminar: false }
export const NONE: PermisoCRUD = { ver: false, crear: false, editar: false, eliminar: false }

export interface NavItem {
  key: string
  label: string
  icono: string
  /** Inject this item as a child of another module's nav group */
  parentNavKey?: string
  /** Restrict visibility to specific roles */
  roles?: UserRole[]
  children?: NavItem[]
}

export interface ModuleManifestInput {
  id: string
  label: string
  descripcion: string
  icono: string
  core: boolean
  dependencias: string[]
  orden: number
  navItems: NavItem[]
  permisosPorRol: Record<UserRole, PermisoCRUD>
}
