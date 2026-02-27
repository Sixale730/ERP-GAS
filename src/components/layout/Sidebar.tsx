'use client'

import React, { useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, type MenuProps } from 'antd'
import { UserRole, PermisosUsuario } from '@/lib/hooks/useAuth'
import { getPermisosEfectivos, Modulo } from '@/lib/hooks/usePermisos'
import { buildMenuItems, type MenuItemWithRoles } from '@/lib/config/modules'

type MenuItem = Required<MenuProps>['items'][number]

// Menu items generated from module manifests
const allMenuItems = buildMenuItems()

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
