'use client'

import React, { useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, type MenuProps } from 'antd'
import {
  DashboardOutlined,
  ShoppingOutlined,
  InboxOutlined,
  TeamOutlined,
  FileTextOutlined,
  DollarOutlined,
  SettingOutlined,
  HomeOutlined,
  TagsOutlined,
  ShopOutlined,
  UnorderedListOutlined,
  ToolOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  ContainerOutlined,
  UserSwitchOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { UserRole, PermisosUsuario } from '@/lib/hooks/useAuth'
import { getPermisosEfectivos, Modulo } from '@/lib/hooks/usePermisos'

type MenuItem = Required<MenuProps>['items'][number]

interface MenuItemWithRoles {
  key?: string
  icon?: React.ReactNode
  label?: React.ReactNode
  type?: 'divider' | 'group'
  modulo?: Modulo // Modulo de permisos asociado
  roles?: UserRole[] | 'all' // Fallback de roles (para items sin modulo)
  children?: MenuItemWithRoles[]
}

const allMenuItems: MenuItemWithRoles[] = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: '/productos',
    icon: <ShoppingOutlined />,
    label: 'Productos',
    modulo: 'productos',
  },
  {
    key: '/inventario',
    icon: <InboxOutlined />,
    label: 'Inventario',
    modulo: 'inventario',
  },
  {
    key: '/clientes',
    icon: <TeamOutlined />,
    label: 'Clientes',
    modulo: 'clientes',
  },
  {
    key: '/cotizaciones',
    icon: <FileTextOutlined />,
    label: 'Cotizaciones',
    modulo: 'cotizaciones',
  },
  {
    key: '/ordenes-venta',
    icon: <ContainerOutlined />,
    label: 'Ordenes de Venta',
    modulo: 'ordenes_venta',
  },
  {
    key: '/facturas',
    icon: <DollarOutlined />,
    label: 'Facturas',
    modulo: 'facturas',
  },
  {
    key: '/compras',
    icon: <ShoppingCartOutlined />,
    label: 'Compras',
    modulo: 'compras',
  },
  {
    type: 'divider',
  },
  {
    key: 'reportes',
    icon: <BarChartOutlined />,
    label: 'Reportes',
    modulo: 'reportes',
    children: [
      {
        key: '/reportes/ordenes-venta',
        icon: <ContainerOutlined />,
        label: 'Ordenes de Venta',
      },
      {
        key: '/reportes/ordenes-compra',
        icon: <ShoppingCartOutlined />,
        label: 'Ordenes de Compra',
      },
      {
        key: '/reportes/servicios',
        icon: <ToolOutlined />,
        label: 'Servicios',
      },
      {
        key: '/reportes/movimientos',
        icon: <SwapOutlined />,
        label: 'Movimientos',
      },
      {
        key: '/reportes/inventario',
        icon: <InboxOutlined />,
        label: 'Inventario',
      },
    ],
  },
  {
    key: 'catalogos',
    icon: <SettingOutlined />,
    label: 'Catalogos',
    modulo: 'catalogos',
    children: [
      {
        key: '/catalogos/almacenes',
        icon: <HomeOutlined />,
        label: 'Almacenes',
      },
      {
        key: '/catalogos/categorias',
        icon: <TagsOutlined />,
        label: 'Categorias',
      },
      {
        key: '/catalogos/proveedores',
        icon: <ShopOutlined />,
        label: 'Proveedores',
      },
      {
        key: '/catalogos/listas-precios',
        icon: <UnorderedListOutlined />,
        label: 'Listas de Precios',
      },
      {
        key: '/catalogos/precios-productos',
        icon: <DollarOutlined />,
        label: 'Precios de Productos',
      },
    ],
  },
  {
    key: 'configuracion',
    icon: <ToolOutlined />,
    label: 'Configuracion',
    modulo: 'configuracion',
    children: [
      {
        key: '/configuracion',
        icon: <SettingOutlined />,
        label: 'General',
      },
      {
        key: '/configuracion/cfdi',
        icon: <SafetyCertificateOutlined />,
        label: 'CFDI / Timbrado',
        modulo: 'cfdi',
      },
      {
        key: '/configuracion/usuarios',
        icon: <UserSwitchOutlined />,
        label: 'Usuarios',
      },
      {
        key: '/configuracion/admin',
        icon: <WarningOutlined />,
        label: 'Administracion',
        roles: ['super_admin'],
      },
    ],
  },
]

// Filtra items de menu segun modulos activos y permisos efectivos del usuario
function filterMenuByPermisos(
  items: MenuItemWithRoles[],
  userRole: UserRole | null,
  permisos: PermisosUsuario,
  modulosActivos?: Modulo[]
): MenuItem[] {
  if (!userRole) return []

  const activosSet = modulosActivos ? new Set(modulosActivos) : null

  return items
    .filter((item) => {
      if (!item) return false
      // Dividers siempre visibles
      if (item.type === 'divider') return true
      // Module-level check first: if module is disabled globally/org, hide it
      if (item.modulo && activosSet && !activosSet.has(item.modulo)) {
        return false
      }
      // Si tiene modulo, verificar permiso "ver"
      if (item.modulo) {
        return permisos[item.modulo]?.ver === true
      }
      // Si tiene roles definidos (fallback), verificar rol
      if (item.roles && item.roles !== 'all') {
        return item.roles.includes(userRole)
      }
      // Sin restricciones: visible para todos
      return true
    })
    .map((item) => {
      if ('children' in item && item.children) {
        const filteredChildren = filterMenuByPermisos(item.children, userRole, permisos, modulosActivos)
        if (filteredChildren.length === 0) return null
        return {
          ...item,
          children: filteredChildren,
        } as MenuItem
      }
      return item as MenuItem
    })
    .filter((item): item is MenuItem => item !== null)
}

interface SidebarProps {
  onNavigate?: () => void
  userRole?: UserRole | null
  userPermisos?: PermisosUsuario | null
  modulosActivos?: Modulo[]
}

function SidebarInner({ onNavigate, userRole, userPermisos, modulosActivos }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Calcular permisos efectivos
  const permisosEfectivos = useMemo(
    () => getPermisosEfectivos(userRole || null, userPermisos || null),
    [userRole, userPermisos]
  )

  // Filtrar menu segun modulos activos y permisos
  const menuItems = useMemo(
    () => filterMenuByPermisos(allMenuItems, userRole || null, permisosEfectivos, modulosActivos),
    [userRole, permisosEfectivos, modulosActivos]
  )


  // Prefetch rutas visibles del menú para navegación instantánea
  useEffect(() => {
    const paths = menuItems
      .flatMap(item => {
        if (item && 'children' in item && Array.isArray(item.children)) {
          return item.children
            .filter((c): c is MenuItem & { key: string } => c !== null && 'key' in c)
            .map(c => c.key as string)
        }
        return item && 'key' in item ? [item.key as string] : []
      })
      .filter(key => key.startsWith('/'))

    paths.forEach(path => router.prefetch(path))
  }, [menuItems, router])

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    router.push(e.key)
    onNavigate?.()
  }

  // Find selected key based on pathname
  const selectedKeys = [pathname]

  // Find open keys for submenus
  const openKeys = menuItems
    .filter((item): item is MenuItem & { children: MenuItem[] } =>
      item !== null && 'children' in item && Array.isArray(item.children)
    )
    .filter(item =>
      item.children?.some(child => child && 'key' in child && pathname.startsWith(child.key as string))
    )
    .map(item => item.key as string)

  return (
    <Menu
      mode="inline"
      selectedKeys={selectedKeys}
      defaultOpenKeys={openKeys}
      style={{ height: '100%', borderRight: 0 }}
      items={menuItems}
      onClick={handleMenuClick}
    />
  )
}

const Sidebar = React.memo(SidebarInner)
export default Sidebar
