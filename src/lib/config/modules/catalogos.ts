import { ALL, VCE, VIEW_ONLY, type ModuleManifestInput } from './types'

export const catalogosManifest = {
  id: 'catalogos',
  label: 'Catalogos',
  descripcion: 'Almacenes, categorias, proveedores, precios',
  icono: 'SettingOutlined',
  core: false,
  dependencias: [],
  orden: 110,
  navItems: [
    {
      key: 'catalogos',
      label: 'Catalogos',
      icono: 'SettingOutlined',
      children: [
        { key: '/catalogos/almacenes', label: 'Almacenes', icono: 'HomeOutlined' },
        { key: '/catalogos/categorias', label: 'Categorias', icono: 'TagsOutlined' },
        { key: '/catalogos/proveedores', label: 'Proveedores', icono: 'ShopOutlined' },
        { key: '/catalogos/listas-precios', label: 'Listas de Precios', icono: 'UnorderedListOutlined' },
        { key: '/catalogos/precios-productos', label: 'Precios de Productos', icono: 'DollarOutlined' },
      ],
    },
  ],
  permisosPorRol: {
    super_admin: ALL,
    admin_cliente: ALL,
    vendedor: VIEW_ONLY,
    compras: VCE,
    contador: VIEW_ONLY,
  },
} satisfies ModuleManifestInput
