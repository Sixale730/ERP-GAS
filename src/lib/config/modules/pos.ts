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
    { key: '/pos', label: 'Terminal POS', icono: 'ShoppingCartOutlined' },
    { key: '/pos/ventas', label: 'Ventas POS', icono: 'UnorderedListOutlined' },
    { key: '/pos/cortes', label: 'Cortes de Caja', icono: 'DollarOutlined' },
    { key: '/pos/cajas', label: 'Cajas', icono: 'ShopOutlined' },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: VCE,
    compras: NONE,
    contador: NONE,
  },
} satisfies ModuleManifestInput
