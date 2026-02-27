import { ALL, VCE, VIEW_ONLY, type ModuleManifestInput } from './types'

export const cotizacionesManifest = {
  id: 'cotizaciones',
  label: 'Cotizaciones',
  descripcion: 'Cotizaciones y presupuestos',
  icono: 'FileTextOutlined',
  core: false,
  dependencias: ['productos', 'clientes'],
  orden: 40,
  navItems: [
    { key: '/cotizaciones', label: 'Cotizaciones', icono: 'FileTextOutlined' },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: VCE,
    compras: VIEW_ONLY,
    contador: VIEW_ONLY,
  },
} satisfies ModuleManifestInput
