'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Row, Col, Typography, Spin } from 'antd'
import {
  DashboardOutlined,
  ShoppingOutlined,
  InboxOutlined,
  TeamOutlined,
  FileTextOutlined,
  DollarOutlined,
  SettingOutlined,
  ToolOutlined,
  ShoppingCartOutlined,
  ContainerOutlined,
  BarChartOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/lib/hooks/useAuth'
import { MODULE_REGISTRY } from '@/lib/config/modules'
import type { ModuleManifestInput } from '@/lib/config/modules'

const { Title, Text } = Typography

// ─── Icon map ───────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  DashboardOutlined,
  ShoppingOutlined,
  InboxOutlined,
  TeamOutlined,
  FileTextOutlined,
  DollarOutlined,
  SettingOutlined,
  ToolOutlined,
  ShoppingCartOutlined,
  ContainerOutlined,
  BarChartOutlined,
}

// ─── Gradient styles per module ─────────────────────────────────────────────

const MODULE_STYLES: Record<string, { gradient: string; shadowColor: string }> = {
  dashboard:      { gradient: 'linear-gradient(135deg, #1890ff, #0050b3)', shadowColor: 'rgba(24,144,255,0.45)' },
  productos:      { gradient: 'linear-gradient(135deg, #1890ff, #096dd9)', shadowColor: 'rgba(24,144,255,0.4)' },
  inventario:     { gradient: 'linear-gradient(135deg, #13c2c2, #006d75)', shadowColor: 'rgba(19,194,194,0.4)' },
  clientes:       { gradient: 'linear-gradient(135deg, #722ed1, #531dab)', shadowColor: 'rgba(114,46,209,0.4)' },
  cotizaciones:   { gradient: 'linear-gradient(135deg, #2f54eb, #1d39c4)', shadowColor: 'rgba(47,84,235,0.4)' },
  ordenes_venta:  { gradient: 'linear-gradient(135deg, #fa8c16, #d46b08)', shadowColor: 'rgba(250,140,22,0.4)' },
  facturas:       { gradient: 'linear-gradient(135deg, #52c41a, #389e0d)', shadowColor: 'rgba(82,196,26,0.4)' },
  compras:        { gradient: 'linear-gradient(135deg, #faad14, #d48806)', shadowColor: 'rgba(250,173,20,0.4)' },
  reportes:       { gradient: 'linear-gradient(135deg, #eb2f96, #c41d7f)', shadowColor: 'rgba(235,47,150,0.4)' },
  catalogos:      { gradient: 'linear-gradient(135deg, #fa541c, #d4380d)', shadowColor: 'rgba(250,84,28,0.4)' },
  configuracion:  { gradient: 'linear-gradient(135deg, #595959, #434343)', shadowColor: 'rgba(89,89,89,0.4)' },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getModuleRoute(manifest: ModuleManifestInput): string {
  const navItem = manifest.navItems[0]
  if (!navItem) return '/'
  if (navItem.key.startsWith('/')) return navItem.key
  if (navItem.children?.[0]) return navItem.children[0].key
  return '/'
}

function hasTopLevelNav(manifest: ModuleManifestInput): boolean {
  return manifest.navItems.some(item => !item.parentNavKey)
}

// ─── Module Card ────────────────────────────────────────────────────────────

interface ModuleCardProps {
  moduleId: string
  label: string
  descripcion: string
  icono: string
  href: string
}

function ModuleCard({ moduleId, label, descripcion, icono, href }: ModuleCardProps) {
  const [hovered, setHovered] = useState(false)
  const router = useRouter()
  const style = MODULE_STYLES[moduleId] || MODULE_STYLES.configuracion
  const Icon = ICON_MAP[icono]

  return (
    <div
      onClick={() => router.push(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: style.gradient,
        borderRadius: 16,
        padding: 32,
        minHeight: 180,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        boxShadow: hovered
          ? `0 20px 40px ${style.shadowColor}`
          : '0 4px 12px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        {Icon && <Icon style={{ fontSize: 48, color: 'white', marginBottom: 16, display: 'block' }} />}
        <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
          {descripcion}
        </div>
      </div>
      {/* Bottom overlay for depth */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.15), transparent)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ModulosPage() {
  const { isSuperAdmin, loading, displayName, signOut } = useAuth()
  const router = useRouter()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f2f5, #e6e9f0)',
      }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    router.replace('/')
    return null
  }

  // Build module cards from registry
  const modules = Object.entries(MODULE_REGISTRY)
    .filter(([, m]) => hasTopLevelNav(m))
    .sort(([, a], [, b]) => a.orden - b.orden)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f2f5, #e6e9f0)',
      padding: '64px 24px',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Title level={1} style={{ marginBottom: 8, color: '#141414' }}>
            Bienvenido, {displayName.split(' ')[0]}
          </Title>
          <Text style={{ fontSize: 18, color: '#8c8c8c' }}>
            Selecciona el modulo con el que deseas trabajar
          </Text>
        </div>

        {/* Module Cards Grid */}
        <Row gutter={[24, 24]}>
          {/* Dashboard card first */}
          <Col xs={24} sm={12} lg={8}>
            <ModuleCard
              moduleId="dashboard"
              label="Dashboard"
              descripcion="Estadisticas y resumen general"
              icono="DashboardOutlined"
              href="/"
            />
          </Col>

          {/* Module cards from registry */}
          {modules.map(([id, manifest]) => (
            <Col xs={24} sm={12} lg={8} key={id}>
              <ModuleCard
                moduleId={id}
                label={manifest.label}
                descripcion={manifest.descripcion}
                icono={manifest.icono}
                href={getModuleRoute(manifest)}
              />
            </Col>
          ))}
        </Row>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <span
            onClick={async () => { await signOut(); router.push('/login') }}
            style={{
              cursor: 'pointer',
              fontSize: 14,
              color: '#8c8c8c',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#141414' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8c8c8c' }}
          >
            <LogoutOutlined style={{ marginRight: 8 }} />
            Cerrar Sesion
          </span>
        </div>
      </div>
    </div>
  )
}
