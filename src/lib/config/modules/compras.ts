import { ALL, NONE, VIEW_ONLY, type ModuleManifestInput } from './types'

export const comprasManifest = {
  id: 'compras',
  label: 'Compras',
  descripcion: 'Ordenes de compra a proveedores',
  icono: 'ShoppingCartOutlined',
  core: false,
  dependencias: ['productos'],
  orden: 70,
  navItems: [
    { key: '/compras', label: 'Compras', icono: 'ShoppingCartOutlined' },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: NONE,
    compras: ALL,
    contador: VIEW_ONLY,
  },
} satisfies ModuleManifestInput
