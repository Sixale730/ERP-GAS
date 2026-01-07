'use client'

import React, { useMemo } from 'react'
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
} from '@ant-design/icons'
import { UserRole } from '@/lib/hooks/useAuth'

type MenuItem = Required<MenuProps>['items'][number]

// Roles que pueden ver cada item
type RoleAccess = UserRole[] | 'all'

interface MenuItemWithRoles {
  key?: string
  icon?: React.ReactNode
  label?: React.ReactNode
  type?: 'divider' | 'group'
  roles?: RoleAccess
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
    roles: ['super_admin', 'admin_cliente'],
  },
  {
    key: '/inventario',
    icon: <InboxOutlined />,
    label: 'Inventario',
    roles: ['super_admin', 'admin_cliente'],
  },
  {
    key: '/movimientos',
    icon: <SwapOutlined />,
    label: 'Movimientos',
    roles: ['super_admin', 'admin_cliente'],
  },
  {
    key: '/clientes',
    icon: <TeamOutlined />,
    label: 'Clientes',
  },
  {
    key: '/cotizaciones',
    icon: <FileTextOutlined />,
    label: 'Cotizaciones',
  },
  {
    key: '/ordenes-venta',
    icon: <ContainerOutlined />,
    label: 'Ordenes de Venta',
  },
  {
    key: '/facturas',
    icon: <DollarOutlined />,
    label: 'Facturas',
  },
  {
    key: '/compras',
    icon: <ShoppingCartOutlined />,
    label: 'Compras',
    roles: ['super_admin', 'admin_cliente'],
  },
  {
    type: 'divider',
  },
  {
    key: 'catalogos',
    icon: <SettingOutlined />,
    label: 'Catalogos',
    roles: ['super_admin', 'admin_cliente'],
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
    ],
  },
  {
    key: 'configuracion',
    icon: <ToolOutlined />,
    label: 'Configuracion',
    roles: ['super_admin', 'admin_cliente'], // Admins pueden ver configuracion
    children: [
      {
        key: '/configuracion',
        icon: <SettingOutlined />,
        label: 'General',
        roles: ['super_admin'],
      },
      {
        key: '/configuracion/cfdi',
        icon: <SafetyCertificateOutlined />,
        label: 'CFDI / Timbrado',
        roles: ['super_admin'],
      },
      {
        key: '/configuracion/usuarios',
        icon: <UserSwitchOutlined />,
        label: 'Usuarios',
        roles: ['super_admin', 'admin_cliente'],
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

// Filtra items de menu segun el rol del usuario
function filterMenuByRole(
  items: MenuItemWithRoles[],
  userRole: UserRole | null
): MenuItem[] {
  if (!userRole) return []

  return items
    .filter((item) => {
      if (!item) return false
      // Si no tiene roles definidos, es visible para todos
      if (!('roles' in item) || !item.roles) return true
      // Si roles es 'all', es visible para todos
      if (item.roles === 'all') return true
      // Si es un array, verificar si el rol esta incluido
      return item.roles.includes(userRole)
    })
    .map((item) => {
      // Si tiene children, filtrarlos tambien
      if ('children' in item && item.children) {
        const filteredChildren = filterMenuByRole(item.children, userRole)
        // Si no quedan children despues de filtrar, no mostrar el submenu
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
}

export default function Sidebar({ onNavigate, userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Filtrar menu segun rol
  const menuItems = useMemo(
    () => filterMenuByRole(allMenuItems, userRole || null),
    [userRole]
  )

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
