import { ALL, VIEW_ONLY, type ModuleManifestInput } from './types'

export const facturasManifest = {
  id: 'facturas',
  label: 'Facturas',
  descripcion: 'Facturacion y cobranza',
  icono: 'DollarOutlined',
  core: false,
  dependencias: ['clientes'],
  orden: 60,
  navItems: [
    { key: '/facturas', label: 'Facturas', icono: 'DollarOutlined' },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: VIEW_ONLY,
    compras: VIEW_ONLY,
    contador: ALL,
  },
} satisfies ModuleManifestInput
