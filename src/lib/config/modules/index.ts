// Barrel exports for the module system
export type { ModuleManifestInput, NavItem, PermisoCRUD, UserRole } from './types'
export { ALL, VIEW_ONLY, VCE, NONE } from './types'

export type { Modulo, ModuloInfo, PermisosUsuario } from './registry'
export {
  MODULE_REGISTRY,
  MODULOS_REGISTRO,
  TODOS_LOS_MODULOS,
  MODULOS_LIST,
  PERMISOS_DEFAULT,
  getModulosActivos,
  getDependientes,
} from './registry'

export type { MenuItemWithRoles } from './sidebar-builder'
export { buildMenuItems } from './sidebar-builder'
