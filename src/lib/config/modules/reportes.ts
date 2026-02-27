import { ALL, VIEW_ONLY, type ModuleManifestInput } from './types'

export const reportesManifest = {
  id: 'reportes',
  label: 'Reportes',
  descripcion: 'Reportes y analitica',
  icono: 'BarChartOutlined',
  core: false,
  dependencias: [],
  orden: 100,
  navItems: [
    {
      key: 'reportes',
      label: 'Reportes',
      icono: 'BarChartOutlined',
      children: [
        { key: '/reportes/ordenes-venta', label: 'Ordenes de Venta', icono: 'ContainerOutlined' },
        { key: '/reportes/ordenes-compra', label: 'Ordenes de Compra', icono: 'ShoppingCartOutlined' },
        { key: '/reportes/servicios', label: 'Servicios', icono: 'ToolOutlined' },
        { key: '/reportes/movimientos', label: 'Movimientos', icono: 'SwapOutlined' },
        { key: '/reportes/inventario', label: 'Inventario', icono: 'InboxOutlined' },
      ],
    },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: VIEW_ONLY,
    compras: VIEW_ONLY,
    contador: ALL,
  },
} satisfies ModuleManifestInput
