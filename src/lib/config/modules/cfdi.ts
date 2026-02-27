import { ALL, NONE, type ModuleManifestInput } from './types'

export const cfdiManifest = {
  id: 'cfdi',
  label: 'CFDI / Timbrado',
  descripcion: 'Facturacion electronica SAT',
  icono: 'SafetyCertificateOutlined',
  core: false,
  dependencias: ['facturas'],
  orden: 65,
  navItems: [
    {
      key: '/configuracion/cfdi',
      label: 'CFDI / Timbrado',
      icono: 'SafetyCertificateOutlined',
      parentNavKey: 'configuracion',
    },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: NONE,
    compras: NONE,
    contador: ALL,
  },
} satisfies ModuleManifestInput
