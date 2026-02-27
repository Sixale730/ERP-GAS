import { ALL, VCE, VIEW_ONLY, type ModuleManifestInput } from './types'

export const clientesManifest = {
  id: 'clientes',
  label: 'Clientes',
  descripcion: 'Gestion de clientes',
  icono: 'TeamOutlined',
  core: false,
  dependencias: [],
  orden: 30,
  navItems: [
    { key: '/clientes', label: 'Clientes', icono: 'TeamOutlined' },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: VCE,
    compras: VIEW_ONLY,
    contador: VCE,
  },
} satisfies ModuleManifestInput
