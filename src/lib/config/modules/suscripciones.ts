import { ALL, NONE, type ModuleManifestInput } from './types'

/**
 * Modulo de suscripciones del sistema.
 * Solo super_admin tiene acceso a ver y modificar.
 * El item de navegacion se inyecta como child del grupo Configuracion.
 */
export const suscripcionesManifest = {
  id: 'suscripciones',
  label: 'Suscripciones',
  descripcion: 'Suscripcion del sistema ERP (solo super_admin)',
  icono: 'CreditCardOutlined',
  core: true,
  dependencias: [],
  orden: 125,
  navItems: [
    {
      key: '/configuracion/suscripciones',
      label: 'Suscripciones',
      icono: 'CreditCardOutlined',
      parentNavKey: 'configuracion',
      roles: ['super_admin'],
    },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: NONE,
    vendedor: NONE,
    compras: NONE,
    contador: NONE,
    logistica: NONE,
  },
} satisfies ModuleManifestInput
