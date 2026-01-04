'use client'

import React, { useState } from 'react'
import { Layout, theme, Button, Dropdown, Avatar, Space, Drawer, Grid } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import Sidebar from './Sidebar'
import GlobalSearch from './GlobalSearch'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const screens = useBreakpoint()
  const isMobile = !screens.md // true si < 768px
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Mi Perfil',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Configuración',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar Sesión',
      danger: true,
    },
  ]

  // Contenido del sidebar (reutilizable)
  const sidebarContent = (
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
          {isMobile ? 'ERP Nesui' : (collapsed ? 'ERP' : 'ERP Nesui')}
        </h1>
      </div>
      <Sidebar onNavigate={() => isMobile && setDrawerOpen(false)} />
    </>
  )

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
          <div style={{ flex: 1, maxWidth: isMobile ? 200 : 400, margin: '0 12px' }}>
            <GlobalSearch />
          </div>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              {!isMobile && <span>Admin</span>}
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
