import { ALL, VCE, NONE, type ModuleManifestInput } from './types'

export const posManifest = {
  id: 'pos',
  label: 'Punto de Venta',
  descripcion: 'Punto de venta para ventas directas',
  icono: 'ShoppingCartOutlined',
  core: false,
  dependencias: ['productos', 'clientes'],
  orden: 35,
  navItems: [
    { key: '/pos', label: 'Punto de Venta', icono: 'ShoppingCartOutlined' },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: VCE,
    compras: NONE,
    contador: NONE,
  },
} satisfies ModuleManifestInput
