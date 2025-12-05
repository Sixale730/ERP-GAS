'use client'

import React from 'react'
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
} from '@ant-design/icons'

type MenuItem = Required<MenuProps>['items'][number]

const menuItems: MenuItem[] = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: '/productos',
    icon: <ShoppingOutlined />,
    label: 'Productos',
  },
  {
    key: '/inventario',
    icon: <InboxOutlined />,
    label: 'Inventario',
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
    key: '/facturas',
    icon: <DollarOutlined />,
    label: 'Facturas',
  },
  {
    type: 'divider',
  },
  {
    key: 'catalogos',
    icon: <SettingOutlined />,
    label: 'Catálogos',
    children: [
      {
        key: '/catalogos/almacenes',
        icon: <HomeOutlined />,
        label: 'Almacenes',
      },
      {
        key: '/catalogos/categorias',
        icon: <TagsOutlined />,
        label: 'Categorías',
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
]

interface SidebarProps {
  onNavigate?: () => void
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

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
