import { ALL, VIEW_ONLY, type ModuleManifestInput } from './types'

export const productosManifest = {
  id: 'productos',
  label: 'Productos',
  descripcion: 'Catalogo de productos',
  icono: 'ShoppingOutlined',
  core: false,
  dependencias: [],
  orden: 10,
  navItems: [
    { key: '/productos', label: 'Productos', icono: 'ShoppingOutlined' },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: VIEW_ONLY,
    compras: ALL,
    contador: VIEW_ONLY,
  },
} satisfies ModuleManifestInput
