import { ALL, VCE, NONE, type ModuleManifestInput } from './types'

export const configuracionManifest = {
  id: 'configuracion',
  label: 'Configuracion',
  descripcion: 'Configuracion del sistema',
  icono: 'ToolOutlined',
  core: true,
  dependencias: [],
  orden: 120,
  navItems: [
    {
      key: 'configuracion',
      label: 'Configuracion',
      icono: 'ToolOutlined',
      children: [
        { key: '/configuracion', label: 'General', icono: 'SettingOutlined' },
        { key: '/configuracion/usuarios', label: 'Usuarios', icono: 'UserSwitchOutlined' },
        { key: '/configuracion/admin', label: 'Administracion', icono: 'WarningOutlined', roles: ['super_admin'] },
      ],
    },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: VCE,
    vendedor: NONE,
    compras: NONE,
    contador: NONE,
  },
} satisfies ModuleManifestInput
