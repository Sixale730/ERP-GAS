import { ALL, NONE, VIEW_ONLY, type ModuleManifestInput } from './types'

export const enviosManifest = {
  id: 'envios',
  label: 'Envíos / Logística',
  descripcion: 'Guías de envío, rastreo, costo y margen del transporte',
  icono: 'TruckOutlined',
  core: false,
  dependencias: ['cotizaciones'],
  orden: 65,
  navItems: [
    { key: '/envios', label: 'Envíos', icono: 'TruckOutlined' },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: VIEW_ONLY,
    compras: NONE,
    contador: VIEW_ONLY,
    logistica: ALL,
  },
} satisfies ModuleManifestInput
