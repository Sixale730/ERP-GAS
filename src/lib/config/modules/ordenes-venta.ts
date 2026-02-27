import { ALL, VCE, VIEW_ONLY, type ModuleManifestInput } from './types'

export const ordenesVentaManifest = {
  id: 'ordenes_venta',
  label: 'Ordenes de Venta',
  descripcion: 'Ordenes de venta',
  icono: 'ContainerOutlined',
  core: false,
  dependencias: ['cotizaciones'],
  orden: 50,
  navItems: [
    { key: '/ordenes-venta', label: 'Ordenes de Venta', icono: 'ContainerOutlined' },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: VCE,
    compras: VIEW_ONLY,
    contador: VIEW_ONLY,
  },
} satisfies ModuleManifestInput
