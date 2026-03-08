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
      key: '/reportes',
      label: 'Reportes',
      icono: 'BarChartOutlined',
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
