'use client'

import { useState, useEffect } from 'react'
import { Card, Form, InputNumber, Button, Space, Typography, message, Divider, Statistic, Row, Col, Spin, Table, Input, Switch, List, Tag } from 'antd'
import { SaveOutlined, ReloadOutlined, DollarOutlined, PercentageOutlined, CloudDownloadOutlined, AppstoreOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useConfiguracion } from '@/lib/hooks/useConfiguracion'
import { useMargenesCategoria } from '@/lib/hooks/useMargenesCategoria'
import { useTipoCambioBanxico } from '@/lib/hooks/queries/useTipoCambioBanxico'
import { formatDate } from '@/lib/utils/format'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useModulos } from '@/lib/hooks/useModulos'
import { MODULOS_REGISTRO, TODOS_LOS_MODULOS } from '@/lib/config/modulos'
import type { Modulo } from '@/lib/hooks/usePermisos'
import type { Categoria } from '@/types/database'

const { Title, Text } = Typography

interface CategoriaConMargen extends Categoria {
  margen_especifico: number | null
}

export default function ConfiguracionPage() {
  const { tipoCambio, fechaTipoCambio, margenGanancia, loading, updateTipoCambio, updateMargenGanancia, reload } = useConfiguracion()
  const { config: margenesConfig, loading: loadingMargenes, updateConfig: updateMargenes, reload: reloadMargenes } = useMargenesCategoria()
  const { data: tipoCambioData, fetchFromBanxico, isFetchingBanxico } = useTipoCambioBanxico()
  const { isAdmin, organizacion, refreshUser } = useAuth()
  const { modulosGlobales, orgDeshabilitados, loading: loadingModulos } = useModulos()

  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [savingMargenes, setSavingMargenes] = useState(false)
  const [formValues, setFormValues] = useState({ tipo_cambio: tipoCambio, margen_ganancia: margenGanancia })
  const [categorias, setCategorias] = useState<CategoriaConMargen[]>([])
  const [loadingCategorias, setLoadingCategorias] = useState(true)
  const [margenGlobal, setMargenGlobal] = useState(30)
  const [margenesPorCategoria, setMargenesPorCategoria] = useState<Record<string, number | null>>({})

  // Per-org module management
  const [deshabilitadosLocal, setDeshabilitadosLocal] = useState<Set<string>>(new Set())
  const [savingOrgModulos, setSavingOrgModulos] = useState(false)

  useEffect(() => {
    if (!loading) {
      form.setFieldsValue({
        tipo_cambio: tipoCambio,
        margen_ganancia: margenGanancia
      })
      setFormValues({ tipo_cambio: tipoCambio, margen_ganancia: margenGanancia })
    }
  }, [loading, tipoCambio, margenGanancia, form])

  useEffect(() => {
    if (!loadingMargenes) {
      setMargenGlobal(margenesConfig.global)
      setMargenesPorCategoria(
        Object.fromEntries(
          Object.entries(margenesConfig.por_categoria).map(([k, v]) => [k, v])
        )
      )
    }
  }, [loadingMargenes, margenesConfig])

  useEffect(() => {
    loadCategorias()
  }, [])

  const loadCategorias = async () => {
    const supabase = getSupabaseClient()
    setLoadingCategorias(true)

    try {
      const { data, error } = await supabase
        .schema('erp')
        .from('categorias')
        .select('*')
        .eq('is_active', true)
        .order('nombre')

      if (error) throw error

      setCategorias((data || []).map(cat => ({
        ...cat,
        margen_especifico: margenesConfig.por_categoria[cat.id] ?? null
      })))
    } catch (err) {
      console.error('Error loading categorias:', err)
    } finally {
      setLoadingCategorias(false)
    }
  }

  useEffect(() => {
    if (!loadingMargenes && categorias.length > 0) {
      setCategorias(cats => cats.map(cat => ({
        ...cat,
        margen_especifico: margenesConfig.por_categoria[cat.id] ?? null
      })))
    }
  }, [loadingMargenes, margenesConfig])

  // Sync org disabled modules from server
  useEffect(() => {
    if (!loadingModulos) {
      setDeshabilitadosLocal(new Set(orgDeshabilitados))
    }
  }, [loadingModulos, orgDeshabilitados])

  const handleOrgModuloToggle = (modulo: Modulo, habilitar: boolean) => {
    setDeshabilitadosLocal((prev) => {
      const next = new Set(prev)
      if (habilitar) {
        next.delete(modulo)
      } else {
        next.add(modulo)
      }
      return next
    })
  }

  const handleGuardarOrgModulos = async () => {
    if (!organizacion) return
    setSavingOrgModulos(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .schema('erp')
        .from('organizaciones')
        .update({ modulos_deshabilitados: Array.from(deshabilitadosLocal) })
        .eq('id', organizacion.id)

      if (error) throw error

      await refreshUser()
      message.success('Modulos de la organizacion actualizados')
    } catch (err) {
      console.error('Error saving org modules:', err)
      message.error('Error al guardar modulos')
    } finally {
      setSavingOrgModulos(false)
    }
  }

  const hasOrgModuloChanges = (() => {
    if (loadingModulos) return false
    const currentSet = new Set(orgDeshabilitados)
    if (currentSet.size !== deshabilitadosLocal.size) return true
    const localArr = Array.from(deshabilitadosLocal)
    for (let i = 0; i < localArr.length; i++) {
      if (!currentSet.has(localArr[i])) return true
    }
    return false
  })()

  const handleValuesChange = (_: any, allValues: any) => {
    setFormValues(allValues)
  }

  const handleSave = async () => {
    const values = form.getFieldsValue()
    setSaving(true)

    try {
      const [tcResult, mgResult] = await Promise.all([
        updateTipoCambio(values.tipo_cambio),
        updateMargenGanancia(values.margen_ganancia)
      ])

      if (tcResult.error || mgResult.error) {
        throw new Error('Error al guardar configuracion')
      }

      message.success('Configuracion guardada correctamente')
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMargenes = async () => {
    setSavingMargenes(true)

    try {
      const porCategoria: Record<string, number> = {}
      Object.entries(margenesPorCategoria).forEach(([id, valor]) => {
        if (valor !== null && valor !== undefined) {
          porCategoria[id] = valor
        }
      })

      const result = await updateMargenes({
        global: margenGlobal,
        por_categoria: porCategoria
      })

      if (result.error) {
        throw new Error('Error al guardar margenes')
      }

      message.success('Margenes guardados correctamente')
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setSavingMargenes(false)
    }
  }

  const handleMargenCategoriaChange = (categoriaId: string, valor: number | null) => {
    setMargenesPorCategoria(prev => ({
      ...prev,
      [categoriaId]: valor
    }))
  }

  const handleReloadAll = () => {
    reload()
    reloadMargenes()
    loadCategorias()
  }

  // Ejemplo de calculo
  const costoEjemplo = 100 // USD
  const tcActual = formValues.tipo_cambio || tipoCambio
  const margenActual = formValues.margen_ganancia || margenGanancia
  const precioCalculado = costoEjemplo * tcActual * (1 + margenActual / 100)

  const columnsCategoria: ColumnsType<CategoriaConMargen> = [
    {
      title: 'Categoria',
      dataIndex: 'nombre',
      key: 'nombre',
    },
    {
      title: 'Margen Global',
      key: 'margen_global',
      width: 120,
      align: 'center',
      render: () => <Text type="secondary">{margenGlobal}%</Text>,
    },
    {
      title: 'Margen Especifico',
      key: 'margen_especifico',
      width: 150,
      render: (_, record) => (
        <InputNumber
          min={0}
          max={500}
          placeholder="Usar global"
          value={margenesPorCategoria[record.id]}
          onChange={(val) => handleMargenCategoriaChange(record.id, val)}
          addonAfter="%"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Margen Efectivo',
      key: 'margen_efectivo',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const efectivo = margenesPorCategoria[record.id] ?? margenGlobal
        return <Text strong style={{ color: margenesPorCategoria[record.id] !== null && margenesPorCategoria[record.id] !== undefined ? '#1890ff' : undefined }}>{efectivo}%</Text>
      },
    },
  ]

  if (loading || loadingMargenes) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>Configuracion del Sistema</Title>
        <Button icon={<ReloadOutlined />} onClick={handleReloadAll}>
          Recargar
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Parametros de Precios" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
              <Form.Item
                name="tipo_cambio"
                label="Tipo de Cambio (MXN por 1 USD)"
                rules={[{ required: true, message: 'Requerido' }]}
                extra={
                  <>
                    Ultima actualizacion: {formatDate(fechaTipoCambio)}
                    {tipoCambioData?.fuente && (
                      <span style={{ marginLeft: 8 }}>
                        (Fuente: {tipoCambioData.fuente === 'banxico' ? 'Banxico FIX' : tipoCambioData.fuente})
                      </span>
                    )}
                  </>
                }
              >
                <InputNumber
                  min={1}
                  max={100}
                  step={0.0001}
                  precision={4}
                  style={{ width: '100%' }}
                  prefix={<DollarOutlined />}
                  addonAfter="MXN"
                />
              </Form.Item>

              <Button
                icon={<CloudDownloadOutlined />}
                loading={isFetchingBanxico}
                onClick={async () => {
                  try {
                    const result = await fetchFromBanxico()
                    if (result.ok) {
                      form.setFieldValue('tipo_cambio', result.tipo_cambio)
                      setFormValues(prev => ({ ...prev, tipo_cambio: result.tipo_cambio }))
                      message.success(`Tipo de cambio actualizado: $${result.tipo_cambio} MXN${result.mensaje ? ` - ${result.mensaje}` : ''}`)
                    } else {
                      message.warning(result.mensaje || 'No se pudo obtener el tipo de cambio')
                    }
                  } catch {
                    message.error('Error al consultar Banxico')
                  }
                }}
                style={{ marginBottom: 16 }}
              >
                Obtener de Banxico
              </Button>

              <Form.Item
                name="margen_ganancia"
                label="Margen de Ganancia (%)"
                rules={[{ required: true, message: 'Requerido' }]}
                extra="Porcentaje que se agrega sobre el costo del proveedor"
              >
                <InputNumber
                  min={0}
                  max={500}
                  step={1}
                  precision={0}
                  style={{ width: '100%' }}
                  prefix={<PercentageOutlined />}
                  addonAfter="%"
                />
              </Form.Item>

              <Divider />

              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                size="large"
                block
              >
                Guardar Configuracion
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Vista Previa de Calculo" style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Ejemplo: Producto con costo de proveedor de $100 USD
            </Text>

            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Statistic
                title="Costo Proveedor (USD)"
                value={costoEjemplo}
                prefix="$"
                suffix="USD"
              />
              <Statistic
                title="Precio de Venta Calculado (MXN)"
                value={precioCalculado}
                prefix="$"
                suffix="MXN"
                precision={2}
                valueStyle={{ color: '#1890ff', fontSize: 28 }}
              />
            </Space>

            <Divider />

            <Text type="secondary">
              Formula: Costo USD x Tipo Cambio x (1 + Margen%)
            </Text>
            <br />
            <Text code>
              ${costoEjemplo} x {tcActual} x {(1 + margenActual / 100).toFixed(2)} = ${precioCalculado.toFixed(2)} MXN
            </Text>
          </Card>

          <Card title="Informacion">
            <Text type="secondary">
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li>El <strong>costo promedio</strong> de cada producto esta en USD (precio del proveedor)</li>
                <li>Al crear una cotizacion, el precio se calcula automaticamente usando estos parametros</li>
                <li>Puedes ajustar el tipo de cambio por cotizacion individual</li>
                <li>El precio calculado puede editarse manualmente en cada linea</li>
              </ul>
            </Text>
          </Card>
        </Col>
      </Row>

      <Card title="Margenes por Categoria (Ordenes de Compra)" style={{ marginTop: 16 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Define margenes de ganancia por categoria para ordenes de compra a proveedores.
          El margen especifico tiene prioridad sobre el global.
        </Text>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Margen Global (aplica a todas)</Text>
              <InputNumber
                min={0}
                max={500}
                value={margenGlobal}
                onChange={(val) => setMargenGlobal(val || 0)}
                addonAfter="%"
                style={{ width: '100%' }}
              />
            </Space>
          </Col>
        </Row>

        <Table
          dataSource={categorias}
          columns={columnsCategoria}
          rowKey="id"
          loading={loadingCategorias}
          pagination={false}
          size="small"
          scroll={{ x: 500 }}
        />

        <Divider />

        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSaveMargenes}
          loading={savingMargenes}
        >
          Guardar Margenes
        </Button>
      </Card>

      {/* ==================== MODULOS DE LA ORGANIZACION ==================== */}
      {isAdmin && organizacion && (
        <Card
          title={
            <Space>
              <AppstoreOutlined style={{ color: '#1890ff' }} />
              Modulos de la Organizacion
            </Space>
          }
          style={{ marginTop: 16 }}
          loading={loadingModulos}
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Habilita o deshabilita modulos para tu organizacion. Solo puedes gestionar modulos que estan habilitados globalmente.
          </Text>

          <List
            dataSource={TODOS_LOS_MODULOS.filter((m) => m !== 'configuracion')}
            renderItem={(modulo) => {
              const info = MODULOS_REGISTRO[modulo]
              const globalmenteDisponible = modulosGlobales.includes(modulo)
              const deshabilitadoOrg = deshabilitadosLocal.has(modulo)
              const activo = globalmenteDisponible && !deshabilitadoOrg

              return (
                <List.Item
                  actions={[
                    globalmenteDisponible ? (
                      <Switch
                        key="switch"
                        checked={activo}
                        onChange={(checked) => handleOrgModuloToggle(modulo, checked)}
                      />
                    ) : (
                      <Tag key="tag" color="default">No disponible</Tag>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span style={{ color: globalmenteDisponible ? undefined : '#bfbfbf' }}>
                          {info.label}
                        </span>
                        {!globalmenteDisponible && (
                          <Tag color="default">Deshabilitado globalmente</Tag>
                        )}
                        {globalmenteDisponible && deshabilitadoOrg && (
                          <Tag color="orange">Deshabilitado</Tag>
                        )}
                      </Space>
                    }
                    description={
                      <span style={{ color: globalmenteDisponible ? undefined : '#d9d9d9' }}>
                        {info.descripcion}
                      </span>
                    }
                  />
                </List.Item>
              )
            }}
          />

          <Divider />

          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleGuardarOrgModulos}
            loading={savingOrgModulos}
            disabled={!hasOrgModuloChanges}
          >
            Guardar Modulos
          </Button>
          {hasOrgModuloChanges && (
            <Text type="warning" style={{ marginLeft: 12 }}>
              Hay cambios sin guardar
            </Text>
          )}
        </Card>
      )}
    </div>
  )
}
