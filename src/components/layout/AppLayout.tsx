'use client'

import React, { useState, useMemo } from 'react'
import { Layout, theme, Button, Dropdown, Avatar, Space, Drawer, Grid, Tag, Spin } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import GlobalSearch from './GlobalSearch'
import { useAuth } from '@/lib/hooks/useAuth'
import { useUIStore } from '@/store/uiStore'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid

interface AppLayoutProps {
  children: React.ReactNode
}

const roleLabels: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'purple' },
  admin_cliente: { label: 'Admin', color: 'blue' },
  vendedor: { label: 'Vendedor', color: 'green' },
  compras: { label: 'Compras', color: 'orange' },
  contador: { label: 'Contador', color: 'cyan' },
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { sidebarCollapsed: collapsed, setSidebarCollapsed: setCollapsed } = useUIStore()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const screens = useBreakpoint()
  const isMobile = !screens.md // true si < 768px
  const router = useRouter()
  const { loading, displayName, avatarUrl, role, signOut, isAdmin, organizacion, erpUser } = useAuth()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const handleMenuClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'logout') {
      // Ejecutar signOut inmediatamente sin esperar
      signOut()
    } else if (key === 'settings') {
      router.push('/configuracion')
    } else if (key === 'usuarios' && isAdmin) {
      router.push('/configuracion/usuarios')
    }
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 500 }}>{displayName}</div>
          {role && (
            <Tag color={roleLabels[role]?.color || 'default'} style={{ marginTop: 4 }}>
              {roleLabels[role]?.label || role}
            </Tag>
          )}
          {organizacion && !organizacion.is_sistema && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {organizacion.nombre}
            </div>
          )}
        </div>
      ),
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Configuracion',
    },
    ...(isAdmin
      ? [
          {
            key: 'usuarios',
            icon: <TeamOutlined />,
            label: 'Gestionar Usuarios',
          },
        ]
      : []),
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar Sesion',
      danger: true,
    },
  ]

  // Contenido del sidebar (memoizado para evitar re-renders innecesarios)
  const sidebarContent = useMemo(() => (
    <>
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? 20 : (collapsed ? 16 : 20),
            fontWeight: 700,
            color: '#1890ff',
            transition: 'all 0.2s',
          }}
        >
          {isMobile ? 'CUANTY' : (collapsed ? 'ERP' : 'CUANTY ERP')}
        </h1>
      </div>
      <Sidebar onNavigate={() => isMobile && setDrawerOpen(false)} userRole={role} userPermisos={erpUser?.permisos ?? null} />
    </>
  ), [isMobile, collapsed, role, erpUser?.permisos])

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" tip="Cargando..." />
      </div>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Drawer para móvil */}
      {isMobile && (
        <Drawer
          placement="left"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          width={250}
          styles={{ body: { padding: 0 } }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Sider para desktop */}
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          theme="light"
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            borderRight: '1px solid #f0f0f0',
          }}
        >
          {sidebarContent}
        </Sider>
      )}

      <Layout style={{
        marginLeft: isMobile ? 0 : (collapsed ? 80 : 200),
        transition: 'all 0.2s'
      }}>
        <Header
          style={{
            padding: isMobile ? '0 12px' : '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
        >
          <Button
            type="text"
            icon={isMobile ? <MenuOutlined /> : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
            onClick={() => isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 48,
              height: 48,
            }}
          />

          {/* Barra de busqueda global */}
          <div style={{ width: isMobile ? 200 : 450, margin: '0 12px', height: 64, display: 'flex', alignItems: 'center', lineHeight: 'normal' }}>
            <GlobalSearch />
          </div>

          <Dropdown menu={{ items: userMenuItems, onClick: handleMenuClick }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar src={avatarUrl} icon={!avatarUrl && <UserOutlined />} />
              {!isMobile && <span>{displayName}</span>}
            </Space>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: isMobile ? '12px' : '24px',
            padding: isMobile ? 12 : 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
