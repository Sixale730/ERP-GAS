import React from 'react'
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
import { MODULE_REGISTRY } from './registry'
import type { Modulo } from './registry'
import type { NavItem, UserRole } from './types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MenuItemWithRoles {
  key?: string
  icon?: React.ReactNode
  label?: React.ReactNode
  type?: 'divider' | 'group'
  modulo?: Modulo
  roles?: UserRole[] | 'all'
  children?: MenuItemWithRoles[]
}

// ─── Icon mapping ───────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType> = {
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
}

function getIcon(name: string): React.ReactNode {
  const Icon = ICON_MAP[name]
  return Icon ? <Icon /> : null
}

// ─── Builder helpers ────────────────────────────────────────────────────────

function navItemToMenuItem(
  navItem: NavItem,
  modulo: Modulo,
  setModulo: boolean
): MenuItemWithRoles {
  const item: MenuItemWithRoles = {
    key: navItem.key,
    icon: getIcon(navItem.icono),
    label: navItem.label,
  }

  if (setModulo) {
    item.modulo = modulo
  }

  if (navItem.roles) {
    item.roles = navItem.roles
  }

  if (navItem.children) {
    item.children = navItem.children.map((child) =>
      navItemToMenuItem(child, modulo, false)
    )
  }

  return item
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Builds the full sidebar menu items array from module manifests.
 * Replaces the hardcoded `allMenuItems` in Sidebar.tsx.
 */
export function buildMenuItems(): MenuItemWithRoles[] {
  const manifests = Object.entries(MODULE_REGISTRY)
    .map(([key, manifest]) => ({ ...manifest, id: key as Modulo }))
    .sort((a, b) => a.orden - b.orden)

  const items: MenuItemWithRoles[] = []
  const injections = new Map<string, MenuItemWithRoles[]>()
  let dividerInserted = false

  // Dashboard is always first and visible to all
  items.push({
    key: '/',
    icon: getIcon('DashboardOutlined'),
    label: 'Dashboard',
  })

  for (const manifest of manifests) {
    // Insert divider before the first module with orden >= 100
    if (!dividerInserted && manifest.orden >= 100) {
      items.push({ type: 'divider' })
      dividerInserted = true
    }

    for (const navItem of manifest.navItems) {
      if (navItem.parentNavKey) {
        // Defer: will be injected into parent group
        const menuItem = navItemToMenuItem(navItem, manifest.id, true)
        if (!injections.has(navItem.parentNavKey)) {
          injections.set(navItem.parentNavKey, [])
        }
        injections.get(navItem.parentNavKey)!.push(menuItem)
      } else {
        items.push(navItemToMenuItem(navItem, manifest.id, true))
      }
    }
  }

  // Inject cross-module items into their parent groups
  injections.forEach((injectItems, parentKey) => {
    const parent = items.find((item) => item.key === parentKey)
    if (parent?.children) {
      // Insert after the first child (matches current CFDI position in Configuracion)
      parent.children.splice(1, 0, ...injectItems)
    }
  })

  return items
}
