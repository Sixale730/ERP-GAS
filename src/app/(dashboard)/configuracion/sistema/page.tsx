'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, Tabs, Input, Typography, Empty, Spin, Space, Button, Alert, Switch, Modal, message, Badge } from 'antd'
import { ArrowLeftOutlined, SettingOutlined, UndoOutlined } from '@ant-design/icons'
import { useAuth } from '@/lib/hooks/useAuth'
import { useConfiguracionSistema, useResetConfig } from '@/lib/hooks/queries/useConfiguracionSistema'
import { CONFIG_CATEGORIAS, type ConfigCategoria } from '@/types/configuracion-sistema'
import { ConfigItemRow } from '@/components/configuracion/ConfigItemRow'
import { ConfigEditor } from '@/components/configuracion/ConfigEditor'

const { Title, Text } = Typography

export default function ConfiguracionSistemaPage() {
  const router = useRouter()
  const { role, loading: loadingAuth } = useAuth()
  const { data: items, isLoading } = useConfiguracionSistema()
  const resetConfig = useResetConfig()
  const [search, setSearch] = useState('')
  const [soloModificados, setSoloModificados] = useState(false)
  const [activeTab, setActiveTab] = useState<ConfigCategoria>('inventario')

  const isModificado = (valor: unknown, valorDefault: unknown) =>
    JSON.stringify(valor) !== JSON.stringify(valorDefault)

  const isAuthorized = role === 'super_admin' || role === 'admin_cliente'

  const filteredItems = useMemo(() => {
    if (!items) return []
    let result = items
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (i) =>
          i.clave.toLowerCase().includes(q) ||
          (i.descripcion ?? '').toLowerCase().includes(q) ||
          i.categoria.toLowerCase().includes(q)
      )
    }
    if (soloModificados) {
      result = result.filter((i) => isModificado(i.valor, i.valor_default))
    }
    return result
  }, [items, search, soloModificados])

  const handleResetCategoria = (categoria: ConfigCategoria) => {
    const itemsModificados = (items ?? []).filter(
      (i) => i.categoria === categoria && isModificado(i.valor, i.valor_default)
    )
    if (itemsModificados.length === 0) {
      message.info('No hay parámetros modificados en esta categoría')
      return
    }
    Modal.confirm({
      title: `Restaurar ${itemsModificados.length} parámetros`,
      content: `Se devolverán al valor por defecto todos los parámetros modificados de esta categoría. ¿Continuar?`,
      okText: 'Restaurar todos',
      cancelText: 'Cancelar',
      okButtonProps: { danger: true },
      onOk: async () => {
        const errores: string[] = []
        for (const item of itemsModificados) {
          try {
            await resetConfig.mutateAsync({ categoria: item.categoria, clave: item.clave })
          } catch {
            errores.push(item.clave)
          }
        }
        if (errores.length === 0) {
          message.success(`${itemsModificados.length} parámetros restaurados`)
        } else {
          message.warning(`Restaurados ${itemsModificados.length - errores.length}/${itemsModificados.length}. Fallaron: ${errores.join(', ')}`)
        }
      },
    })
  }

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
    const totalModificados = (items ?? []).filter(
      (i) => i.categoria === cat.key && isModificado(i.valor, i.valor_default)
    ).length
    return {
      key: cat.key,
      label: (
        <Space>
          {cat.label}
          {totalModificados > 0 && <Badge count={totalModificados} color="blue" />}
        </Space>
      ),
      children: (
        <div>
          {totalModificados > 0 && (
            <div style={{ marginBottom: 12, textAlign: 'right' }}>
              <Button
                size="small"
                icon={<UndoOutlined />}
                onClick={() => handleResetCategoria(cat.key)}
                loading={resetConfig.isPending}
              >
                Restaurar todos los modificados ({totalModificados})
              </Button>
            </div>
          )}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <Spin />
            </div>
          ) : itemsCat.length === 0 ? (
            <Empty
              description={
                search || soloModificados
                  ? 'No hay parámetros que coincidan con los filtros'
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
        <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Input.Search
            placeholder="Buscar por clave o descripción..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 480, minWidth: 240 }}
          />
          <Space>
            <Text type="secondary" style={{ fontSize: 13 }}>Solo modificados</Text>
            <Switch checked={soloModificados} onChange={setSoloModificados} />
          </Space>
        </Space>

        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as ConfigCategoria)}
          items={tabItems}
        />
      </Card>
    </div>
  )
}
