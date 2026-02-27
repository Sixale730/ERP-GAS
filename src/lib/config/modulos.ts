/**
 * Module registry — re-exports from the new manifest-based module system.
 * All existing imports from this file continue to work unchanged.
 */
export type { Modulo, ModuloInfo } from './modules'
export {
  MODULOS_REGISTRO,
  TODOS_LOS_MODULOS,
  getModulosActivos,
  getDependientes,
} from './modules'
