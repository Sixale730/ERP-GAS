import { ALL, NONE, type ModuleManifestInput } from './types'

export const reportesErroresManifest = {
  id: 'reportes_errores',
  label: 'Reportes de Error',
  descripcion: 'Bandeja de errores reportados por usuarios al equipo',
  icono: 'BugOutlined',
  core: true,
  dependencias: [],
  orden: 115,
  navItems: [
    {
      key: '/admin/reportes-errores',
      label: 'Reportes de Error',
      icono: 'BugOutlined',
      roles: ['super_admin', 'admin_cliente'],
    },
    {
      key: '/mis-reportes',
      label: 'Mis Reportes',
      icono: 'BugOutlined',
      roles: ['super_admin', 'admin_cliente'],
    },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: NONE,
    compras: NONE,
    contador: NONE,
    logistica: NONE,
  },
} satisfies ModuleManifestInput
