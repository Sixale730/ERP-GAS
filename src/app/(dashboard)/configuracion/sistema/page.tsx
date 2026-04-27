'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, Tabs, Input, Typography, Empty, Spin, Space, Button, Alert } from 'antd'
import { ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons'
import { useAuth } from '@/lib/hooks/useAuth'
import { useConfiguracionSistema } from '@/lib/hooks/queries/useConfiguracionSistema'
import { CONFIG_CATEGORIAS, type ConfigCategoria } from '@/types/configuracion-sistema'
import { ConfigItemRow } from '@/components/configuracion/ConfigItemRow'
import { ConfigEditor } from '@/components/configuracion/ConfigEditor'

const { Title, Text } = Typography

export default function ConfiguracionSistemaPage() {
  const router = useRouter()
  const { role, loading: loadingAuth } = useAuth()
  const { data: items, isLoading } = useConfiguracionSistema()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<ConfigCategoria>('inventario')

  const isAuthorized = role === 'super_admin' || role === 'admin_cliente'

  const filteredItems = useMemo(() => {
    if (!items) return []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        i.clave.toLowerCase().includes(q) ||
        (i.descripcion ?? '').toLowerCase().includes(q) ||
        i.categoria.toLowerCase().includes(q)
    )
  }, [items, search])

  if (loadingAuth) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Acceso restringido"
        description="Solo administradores pueden ver los parámetros del sistema."
        action={
          <Button onClick={() => router.push('/configuracion')}>Volver</Button>
        }
      />
    )
  }

  const tabItems = CONFIG_CATEGORIAS.map((cat) => {
    const itemsCat = filteredItems.filter((i) => i.categoria === cat.key)
    return {
      key: cat.key,
      label: (
        <Space>
          {cat.label}
          {search && itemsCat.length > 0 && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              ({itemsCat.length})
            </Text>
          )}
        </Space>
      ),
      children: (
        <div>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <Spin />
            </div>
          ) : itemsCat.length === 0 ? (
            <Empty
              description={
                search
                  ? 'No hay parámetros que coincidan con la búsqueda'
                  : 'No hay parámetros configurados en esta categoría'
              }
            />
          ) : (
            itemsCat.map((item) => (
              <ConfigItemRow
                key={item.id}
                item={item}
                mode="edit"
                control={<ConfigEditor item={item} />}
              />
            ))
          )}
        </div>
      ),
    }
  })

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space>
          <Link href="/configuracion">
            <Button icon={<ArrowLeftOutlined />}>Volver</Button>
          </Link>
          <Title level={3} style={{ margin: 0 }}>
            <SettingOutlined style={{ marginInlineEnd: 8 }} />
            Parámetros del Sistema
          </Title>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="Cambios con auditoría"
        description="Cada cambio queda registrado con tu usuario, fecha y valor anterior. Puedes ver el historial haciendo clic en el ícono ⏱ junto al nombre del parámetro."
        style={{ marginBottom: 16 }}
        closable
      />

      <Card>
        <Input.Search
          placeholder="Buscar por clave o descripción..."
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 16, maxWidth: 480 }}
        />

        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as ConfigCategoria)}
          items={tabItems}
        />
      </Card>
    </div>
  )
}
