import { ALL, VIEW_ONLY, type ModuleManifestInput } from './types'

export const inventarioManifest = {
  id: 'inventario',
  label: 'Inventario',
  descripcion: 'Control de stock por almacen',
  icono: 'InboxOutlined',
  core: false,
  dependencias: ['productos'],
  orden: 20,
  navItems: [
    { key: '/inventario', label: 'Inventario', icono: 'InboxOutlined' },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: VIEW_ONLY,
    compras: ALL,
    contador: VIEW_ONLY,
  },
} satisfies ModuleManifestInput
