'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, Tabs, Input, Typography, Empty, Spin, Space, Button, Alert, Switch, Modal, message, Badge, Divider } from 'antd'
import { ArrowLeftOutlined, SettingOutlined, UndoOutlined } from '@ant-design/icons'
import { useAuth } from '@/lib/hooks/useAuth'
import { useConfiguracionSistema, useResetConfig } from '@/lib/hooks/queries/useConfiguracionSistema'
import { CONFIG_CATEGORIAS, type ConfigCategoria } from '@/types/configuracion-sistema'
import { ConfigItemRow } from '@/components/configuracion/ConfigItemRow'
import { ConfigEditor } from '@/components/configuracion/ConfigEditor'

const { Title, Text } = Typography

/**
 * Decide si una categoria debe ser visible en este panel para el usuario actual.
 * Reglas:
 *  - cfdi: solo super_admin (admin_cliente NO ve esta tab)
 *  - pos: oculto para org con codigo 'SOLAC' (no usan POS)
 *  - resto: super_admin y admin_cliente
 */
function puedeVerTab(
  cat: ConfigCategoria,
  role: string | null,
  orgCodigo: string | null | undefined
): boolean {
  if (cat === 'cfdi') return role === 'super_admin'
  if (cat === 'pos' && orgCodigo === 'SOLAC') return false
  return role === 'super_admin' || role === 'admin_cliente'
}

export default function ConfiguracionSistemaPage() {
  const router = useRouter()
  const { role, loading: loadingAuth, organizacion } = useAuth()
  const { data: items, isLoading } = useConfiguracionSistema()
  const resetConfig = useResetConfig()
  const [search, setSearch] = useState('')
  const [soloModificados, setSoloModificados] = useState(false)
  const [activeTab, setActiveTab] = useState<ConfigCategoria>('inventario')

  const orgCodigo = organizacion?.codigo ?? null
  const categoriasVisibles = useMemo(
    () => CONFIG_CATEGORIAS.filter((c) => puedeVerTab(c.key, role, orgCodigo)),
    [role, orgCodigo]
  )

  // Si el tab activo deja de ser visible (por cambio de org en super_admin),
  // saltar al primero permitido.
  useEffect(() => {
    if (categoriasVisibles.length === 0) return
    if (!categoriasVisibles.some((c) => c.key === activeTab)) {
      setActiveTab(categoriasVisibles[0].key)
    }
  }, [categoriasVisibles, activeTab])

  const isModificado = (valor: unknown, valorDefault: unknown) =>
    JSON.stringify(valor) !== JSON.stringify(valorDefault)

  // Renderiza items con subgrupos solo si la categoria total tiene >5 claves
  // Y al menos un item tiene subgrupo. De lo contrario, render plano.
  const renderItemsAgrupados = (
    itemsCat: typeof items extends (infer T)[] | undefined ? NonNullable<typeof items> : never,
    catKey: ConfigCategoria
  ) => {
    const totalCategoria = (items ?? []).filter((i) => i.categoria === catKey).length
    const debeAgrupar = totalCategoria > 5 && itemsCat.some((i) => i.subgrupo)

    if (!debeAgrupar) {
      return itemsCat.map((item) => (
        <ConfigItemRow
          key={item.id}
          item={item}
          mode="edit"
          control={<ConfigEditor item={item} />}
        />
      ))
    }

    const grupos = new Map<string, typeof itemsCat>()
    for (const item of itemsCat) {
      const key = item.subgrupo || 'Otros'
      const arr = grupos.get(key) ?? []
      arr.push(item)
      grupos.set(key, arr)
    }
    return Array.from(grupos.entries()).map(([sub, its]) => (
      <div key={sub}>
        <Divider orientation="left" style={{ marginTop: 16, marginBottom: 4, fontSize: 13, color: '#666' }}>
          {sub}
        </Divider>
        {its.map((item) => (
          <ConfigItemRow
            key={item.id}
            item={item}
            mode="edit"
            control={<ConfigEditor item={item} />}
          />
        ))}
      </div>
    ))
  }

  const isAuthorized = role === 'super_admin' || role === 'admin_cliente'

  const categoriasVisiblesKeys = useMemo(
    () => new Set(categoriasVisibles.map((c) => c.key)),
    [categoriasVisibles]
  )

  const filteredItems = useMemo(() => {
    if (!items) return []
    // Filtrar primero por categorias visibles para el rol/org
    let result = items.filter((i) => categoriasVisiblesKeys.has(i.categoria as ConfigCategoria))
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (i) =>
          i.clave.toLowerCase().includes(q) ||
          (i.etiqueta ?? '').toLowerCase().includes(q) ||
          (i.descripcion ?? '').toLowerCase().includes(q) ||
          i.categoria.toLowerCase().includes(q)
      )
    }
    if (soloModificados) {
      result = result.filter((i) => isModificado(i.valor, i.valor_default))
    }
    return result
  }, [items, search, soloModificados, categoriasVisiblesKeys])

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

  const tabItems = categoriasVisibles.map((cat) => {
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
            renderItemsAgrupados(itemsCat, cat.key)
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
