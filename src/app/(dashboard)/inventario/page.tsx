'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Select, Input, Space, Tag, Card, Typography, message, Row, Col, Statistic, Button, Modal, InputNumber, Form } from 'antd'
import { SearchOutlined, InboxOutlined, WarningOutlined, EditOutlined, SettingOutlined, SwapOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAlmacenes, useInventario, useMovimientos } from '@/lib/hooks/useQueries'
import MovimientosTable from '@/components/movimientos/MovimientosTable'

const { Title, Text } = Typography

interface InventarioRow {
  id: string
  producto_id: string
  almacen_id: string
  cantidad: number
  cantidad_reservada: number
  sku: string
  producto_nombre: string
  unidad_medida: string
  stock_minimo: number
  stock_maximo: number
  almacen_codigo: string
  almacen_nombre: string
  nivel_stock: string
}

export default function InventarioPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [almacenFilter, setAlmacenFilter] = useState<string | undefined>(undefined)
  const [searchText, setSearchText] = useState('')

  // React Query hooks - cargan en paralelo, no en cascada
  const { data: almacenes = [], isLoading: loadingAlmacenes } = useAlmacenes()
  const { data: inventario = [], isLoading: loadingInventario } = useInventario(almacenFilter)
  const { data: movimientos = [], isLoading: loadingMovimientos } = useMovimientos(almacenFilter, 10)

  const loading = loadingAlmacenes || loadingInventario

  // Modal para editar cantidad
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventarioRow | null>(null)
  const [nuevaCantidad, setNuevaCantidad] = useState<number>(0)
  const [tipoAjuste, setTipoAjuste] = useState<'set' | 'add' | 'subtract'>('set')
  const [notaAjuste, setNotaAjuste] = useState('')
  const [saving, setSaving] = useState(false)

  // Modal para editar min/max
  const [minMaxModalOpen, setMinMaxModalOpen] = useState(false)
  const [editingMinMaxItem, setEditingMinMaxItem] = useState<InventarioRow | null>(null)
  const [nuevoMinimo, setNuevoMinimo] = useState<number>(0)
  const [nuevoMaximo, setNuevoMaximo] = useState<number>(0)
  const [savingMinMax, setSavingMinMax] = useState(false)

  // Función para invalidar queries después de una actualización
  const invalidateInventarioQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['inventario'] })
    queryClient.invalidateQueries({ queryKey: ['movimientos'] })
  }

  const handleOpenEditModal = (item: InventarioRow) => {
    setEditingItem(item)
    setNuevaCantidad(0)
    setTipoAjuste('set')
    setNotaAjuste('')
    setEditModalOpen(true)
  }

  const handleSaveInventario = async () => {
    if (!editingItem) return

    setSaving(true)
    const supabase = getSupabaseClient()

    try {
      let cantidadFinal: number

      if (tipoAjuste === 'set') {
        cantidadFinal = nuevaCantidad
      } else if (tipoAjuste === 'add') {
        cantidadFinal = editingItem.cantidad + nuevaCantidad
      } else {
        cantidadFinal = editingItem.cantidad - nuevaCantidad
      }

      // Actualizar inventario
      const { error: invError } = await supabase
        .schema('erp')
        .from('inventario')
        .update({ cantidad: cantidadFinal, updated_at: new Date().toISOString() })
        .eq('id', editingItem.id)

      if (invError) throw invError

      // Registrar movimiento
      const diferencia = cantidadFinal - editingItem.cantidad
      if (diferencia !== 0) {
        await supabase
          .schema('erp')
          .from('movimientos_inventario')
          .insert({
            producto_id: editingItem.producto_id,
            almacen_origen_id: diferencia < 0 ? editingItem.almacen_id : null,
            almacen_destino_id: diferencia > 0 ? editingItem.almacen_id : null,
            tipo: diferencia > 0 ? 'entrada' : 'salida',
            cantidad: Math.abs(diferencia),
            referencia_tipo: 'ajuste',
            notas: notaAjuste || `Ajuste manual de inventario: ${editingItem.cantidad} → ${cantidadFinal}`,
          })
      }

      message.success('Inventario actualizado')
      setEditModalOpen(false)
      invalidateInventarioQueries()
    } catch (error: any) {
      console.error('Error updating inventory:', error)
      message.error(error.message || 'Error al actualizar inventario')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenMinMaxModal = (item: InventarioRow) => {
    setEditingMinMaxItem(item)
    setNuevoMinimo(item.stock_minimo)
    setNuevoMaximo(item.stock_maximo)
    setMinMaxModalOpen(true)
  }

  const handleSaveMinMax = async () => {
    if (!editingMinMaxItem) return

    if (nuevoMinimo > nuevoMaximo) {
      message.warning('El mínimo no puede ser mayor al máximo')
      return
    }

    setSavingMinMax(true)
    const supabase = getSupabaseClient()

    try {
      // Actualizar stock_minimo y stock_maximo en la tabla productos
      const { error } = await supabase
        .schema('erp')
        .from('productos')
        .update({
          stock_minimo: nuevoMinimo,
          stock_maximo: nuevoMaximo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingMinMaxItem.producto_id)

      if (error) throw error

      message.success('Límites de stock actualizados')
      setMinMaxModalOpen(false)
      invalidateInventarioQueries()
    } catch (error: any) {
      console.error('Error updating min/max:', error)
      message.error(error.message || 'Error al actualizar límites')
    } finally {
      setSavingMinMax(false)
    }
  }

  // Filtrar con useMemo para evitar recálculos
  const filteredInventario = useMemo(() =>
    (inventario as InventarioRow[]).filter(
      (i) =>
        i.producto_nombre?.toLowerCase().includes(searchText.toLowerCase()) ||
        i.sku?.toLowerCase().includes(searchText.toLowerCase())
    ),
    [inventario, searchText]
  )

  // Stats calculados con useMemo
  const { totalItems, stockBajo, stockExceso } = useMemo(() => ({
    totalItems: filteredInventario.length,
    stockBajo: filteredInventario.filter(i => i.nivel_stock === 'bajo').length,
    stockExceso: filteredInventario.filter(i => i.nivel_stock === 'exceso').length,
  }), [filteredInventario])

  const columns: ColumnsType<InventarioRow> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 100,
    },
    {
      title: 'Producto',
      dataIndex: 'producto_nombre',
      key: 'producto_nombre',
      sorter: (a, b) => a.producto_nombre.localeCompare(b.producto_nombre),
    },
    {
      title: 'Almacén',
      dataIndex: 'almacen_nombre',
      key: 'almacen_nombre',
      width: 150,
    },
    {
      title: 'Cantidad',
      dataIndex: 'cantidad',
      key: 'cantidad',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.cantidad - b.cantidad,
    },
    {
      title: 'Reservado',
      dataIndex: 'cantidad_reservada',
      key: 'cantidad_reservada',
      width: 100,
      align: 'right',
    },
    {
      title: 'Disponible',
      key: 'disponible',
      width: 100,
      align: 'right',
      render: (_, record) => record.cantidad - record.cantidad_reservada,
    },
    {
      title: 'Min / Max',
      key: 'minmax',
      width: 100,
      render: (_, record) => `${record.stock_minimo} / ${record.stock_maximo}`,
    },
    {
      title: 'Nivel',
      dataIndex: 'nivel_stock',
      key: 'nivel_stock',
      width: 100,
      render: (nivel) => {
        const config: Record<string, { color: string; label: string }> = {
          bajo: { color: 'red', label: 'Bajo' },
          normal: { color: 'green', label: 'Normal' },
          exceso: { color: 'orange', label: 'Exceso' },
          sin_stock: { color: 'default', label: 'Sin Stock' },
        }
        const { color, label } = config[nivel] || { color: 'default', label: nivel }
        return <Tag color={color}>{label}</Tag>
      },
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditModal(record)}
            title="Editar cantidad"
            size="small"
          />
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => handleOpenMinMaxModal(record)}
            title="Editar límites Min/Max"
            size="small"
          />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Title level={2}>Inventario</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Registros"
              value={totalItems}
              prefix={<InboxOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Stock Bajo"
              value={stockBajo}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stockBajo > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Stock en Exceso"
              value={stockExceso}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stockExceso > 0 ? '#faad14' : '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por SKU o producto..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: '100%', maxWidth: 250 }}
            allowClear
          />
          <Select
            placeholder="Filtrar por almacen"
            value={almacenFilter}
            onChange={(val) => setAlmacenFilter(val || undefined)}
            style={{ width: '100%', maxWidth: 200 }}
            allowClear
            options={almacenes.map((a: { id: string; nombre: string }) => ({ value: a.id, label: a.nombre }))}
          />
        </Space>

        <Table
          dataSource={filteredInventario}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) => `${total} registros`,
          }}
          rowClassName={(record) => {
            if (record.nivel_stock === 'bajo') return 'row-stock-bajo'
            return ''
          }}
        />
      </Card>

      {/* Sección de últimos movimientos */}
      <Card
        title={
          <Space>
            <SwapOutlined />
            <span>Últimos Movimientos</span>
          </Space>
        }
        style={{ marginTop: 16 }}
        extra={
          <Button type="link" onClick={() => router.push('/movimientos')}>
            Ver todos
          </Button>
        }
      >
        <MovimientosTable
          data={movimientos}
          loading={loadingMovimientos}
          compact
          showPagination={false}
        />
      </Card>

      {/* Modal para editar cantidad */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>Ajustar Inventario</span>
          </Space>
        }
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleSaveInventario}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={saving}
        destroyOnClose
      >
        {editingItem && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card size="small" style={{ background: '#f5f5f5' }}>
              <Space direction="vertical" size={0}>
                <Text strong>{editingItem.producto_nombre}</Text>
                <Text type="secondary">SKU: {editingItem.sku}</Text>
                <Text type="secondary">Almacén: {editingItem.almacen_nombre}</Text>
                <Text>Cantidad actual: <Text strong>{editingItem.cantidad}</Text></Text>
              </Space>
            </Card>

            <Form layout="vertical">
              <Form.Item label="Tipo de ajuste">
                <Select
                  value={tipoAjuste}
                  onChange={setTipoAjuste}
                  options={[
                    { value: 'set', label: 'Establecer cantidad exacta' },
                    { value: 'add', label: 'Agregar a la cantidad actual' },
                    { value: 'subtract', label: 'Restar de la cantidad actual' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label={
                  tipoAjuste === 'set' ? 'Nueva cantidad' :
                  tipoAjuste === 'add' ? 'Cantidad a agregar' :
                  'Cantidad a restar'
                }
              >
                <InputNumber
                  value={nuevaCantidad}
                  onChange={(v) => setNuevaCantidad(v || 0)}
                  min={0}
                  style={{ width: '100%' }}
                  size="large"
                />
              </Form.Item>

              {tipoAjuste !== 'set' && nuevaCantidad > 0 && (
                <Card size="small" style={{ background: tipoAjuste === 'add' ? '#f6ffed' : '#fff7e6' }}>
                  <Text>
                    Cantidad final: <Text strong>
                      {tipoAjuste === 'add'
                        ? editingItem.cantidad + nuevaCantidad
                        : Math.max(0, editingItem.cantidad - nuevaCantidad)}
                    </Text>
                  </Text>
                </Card>
              )}

              <Form.Item label="Nota del ajuste" style={{ marginTop: 16 }}>
                <Input.TextArea
                  value={notaAjuste}
                  onChange={(e) => setNotaAjuste(e.target.value)}
                  placeholder="Razón del ajuste (opcional)"
                  rows={2}
                />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Modal>

      {/* Modal para editar min/max */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            <span>Editar Límites de Stock</span>
          </Space>
        }
        open={minMaxModalOpen}
        onCancel={() => setMinMaxModalOpen(false)}
        onOk={handleSaveMinMax}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={savingMinMax}
        destroyOnClose
      >
        {editingMinMaxItem && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card size="small" style={{ background: '#f5f5f5' }}>
              <Space direction="vertical" size={0}>
                <Text strong>{editingMinMaxItem.producto_nombre}</Text>
                <Text type="secondary">SKU: {editingMinMaxItem.sku}</Text>
                <Text>Cantidad actual: <Text strong>{editingMinMaxItem.cantidad}</Text></Text>
              </Space>
            </Card>

            <Form layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Stock Mínimo">
                    <InputNumber
                      value={nuevoMinimo}
                      onChange={(v) => setNuevoMinimo(v || 0)}
                      min={0}
                      style={{ width: '100%' }}
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Stock Máximo">
                    <InputNumber
                      value={nuevoMaximo}
                      onChange={(v) => setNuevoMaximo(v || 0)}
                      min={0}
                      style={{ width: '100%' }}
                      size="large"
                    />
                  </Form.Item>
                </Col>
              </Row>

              {nuevoMinimo > nuevoMaximo && (
                <Card size="small" style={{ background: '#fff2f0', marginTop: 8 }}>
                  <Text type="danger">
                    El stock mínimo no puede ser mayor al máximo
                  </Text>
                </Card>
              )}

              <Card size="small" style={{ background: '#f6ffed', marginTop: 16 }}>
                <Text type="secondary">
                  Estos límites se usan para determinar el nivel de stock (bajo, normal, exceso)
                  y para la generación automática de órdenes de compra.
                </Text>
              </Card>
            </Form>
          </Space>
        )}
      </Modal>

      <style jsx global>{`
        .row-stock-bajo {
          background-color: #fff2f0;
        }
      `}</style>
    </div>
  )
}
