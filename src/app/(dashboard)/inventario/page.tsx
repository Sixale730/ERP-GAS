'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Select, Input, Space, Tag, Card, Typography, message, Row, Col, Statistic, Button, Modal, InputNumber, Form } from 'antd'
import { SearchOutlined, InboxOutlined, WarningOutlined, EditOutlined, SettingOutlined, SwapOutlined, EyeOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import MovimientosTable from '@/components/movimientos/MovimientosTable'
import { TableSkeleton } from '@/components/common/Skeletons'
import {
  useAlmacenes,
  useInventario,
  useMovimientos,
  useAjustarInventario,
  useActualizarMinMax,
  type InventarioRow,
} from '@/lib/hooks/queries/useInventario'

const { Title, Text } = Typography

function calcularNivel(row: InventarioRow): string {
  if (row.cantidad < 0) return 'negativo'
  if (row.cantidad === 0) return 'sin_stock'
  if (row.stock_minimo > 0 && row.cantidad <= row.stock_minimo) return 'bajo'
  if (row.stock_maximo > 0 && row.cantidad > row.stock_maximo) return 'exceso'
  return 'normal'
}

export default function InventarioPage() {
  const router = useRouter()
  const [almacenFilter, setAlmacenFilter] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pagination, setPagination] = useState({ page: 1, pageSize: 15 })

  // Debounce search text and reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText)
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText])

  // React Query hooks - datos cacheados automáticamente with server-side pagination and search
  const { data: almacenes = [] } = useAlmacenes()
  const { data: inventarioResult, isLoading } = useInventario(almacenFilter, pagination, debouncedSearch)
  const inventario = inventarioResult?.data ?? []
  const { data: movimientos = [], isLoading: loadingMovimientos } = useMovimientos(almacenFilter)

  // Mutations
  const ajustarInventario = useAjustarInventario()
  const actualizarMinMax = useActualizarMinMax()

  // Modal para editar cantidad
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventarioRow | null>(null)
  const [nuevaCantidad, setNuevaCantidad] = useState<number>(0)
  const [tipoAjuste, setTipoAjuste] = useState<'set' | 'add' | 'subtract'>('set')
  const [notaAjuste, setNotaAjuste] = useState('')

  // Modal para editar min/max
  const [minMaxModalOpen, setMinMaxModalOpen] = useState(false)
  const [editingMinMaxItem, setEditingMinMaxItem] = useState<InventarioRow | null>(null)
  const [nuevoMinimo, setNuevoMinimo] = useState<number>(0)
  const [nuevoMaximo, setNuevoMaximo] = useState<number>(0)

  const handleOpenEditModal = (item: InventarioRow) => {
    setEditingItem(item)
    setNuevaCantidad(0)
    setTipoAjuste('set')
    setNotaAjuste('')
    setEditModalOpen(true)
  }

  const handleSaveInventario = async () => {
    if (!editingItem) return

    let cantidadFinal: number

    if (tipoAjuste === 'set') {
      cantidadFinal = nuevaCantidad
    } else if (tipoAjuste === 'add') {
      cantidadFinal = editingItem.cantidad + nuevaCantidad
    } else {
      cantidadFinal = editingItem.cantidad - nuevaCantidad
    }

    try {
      await ajustarInventario.mutateAsync({
        item: editingItem,
        cantidadFinal,
        nota: notaAjuste,
      })
      message.success('Inventario actualizado')
      setEditModalOpen(false)
    } catch (error: any) {
      console.error('Error updating inventory:', error)
      message.error(error.message || 'Error al actualizar inventario')
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

    try {
      await actualizarMinMax.mutateAsync({
        productoId: editingMinMaxItem.producto_id,
        stockMinimo: nuevoMinimo,
        stockMaximo: nuevoMaximo,
      })
      message.success('Límites de stock actualizados')
      setMinMaxModalOpen(false)
    } catch (error: any) {
      console.error('Error updating min/max:', error)
      message.error(error.message || 'Error al actualizar límites')
    }
  }

  // Stats calculados de datos del servidor
  const stats = useMemo(() => ({
    totalItems: inventarioResult?.total ?? 0,
    stockBajo: inventario.filter(i => i.stock_minimo > 0 && i.cantidad > 0 && i.cantidad <= i.stock_minimo).length,
    stockNegativo: inventario.filter(i => i.cantidad < 0).length,
    stockExceso: inventario.filter(i => i.stock_maximo > 0 && i.cantidad > i.stock_maximo).length,
  }), [inventarioResult?.total, inventario])

  const columns = useMemo<ColumnsType<InventarioRow>>(() => [
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
      title: 'Total en físico',
      dataIndex: 'cantidad',
      key: 'cantidad',
      width: 120,
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
      title: 'Disponible para venta',
      key: 'disponible',
      width: 150,
      align: 'right',
      render: (_, record) => record.cantidad - record.cantidad_reservada,
    },
    {
      title: 'En tránsito',
      dataIndex: 'en_transito',
      key: 'en_transito',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.en_transito - b.en_transito,
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
      render: (_, record) => {
        const nivel = calcularNivel(record)
        const config: Record<string, { color: string; label: string }> = {
          negativo: { color: '#ff4d4f', label: 'Negativo' },
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
      width: 130,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/productos/${record.producto_id}`)}
            title="Ver producto"
            size="small"
          />
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
  ], [])

  return (
    <div>
      <Title level={2}>Inventario</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total Registros"
              value={stats.totalItems}
              prefix={<InboxOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Stock Bajo"
              value={stats.stockBajo}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.stockBajo > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Stock Negativo"
              value={stats.stockNegativo}
              prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: stats.stockNegativo > 0 ? '#ff4d4f' : '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Stock en Exceso"
              value={stats.stockExceso}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.stockExceso > 0 ? '#faad14' : '#3f8600' }}
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
            placeholder="Filtrar por almacén"
            value={almacenFilter}
            onChange={setAlmacenFilter}
            style={{ width: '100%', maxWidth: 200 }}
            allowClear
            options={almacenes.map(a => ({ value: a.id, label: a.nombre }))}
          />
        </Space>

        {isLoading ? (
          <TableSkeleton rows={8} columns={9} />
        ) : (
          <Table
            dataSource={inventario}
            columns={columns}
            rowKey="id"
            scroll={{ x: 900 }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total: inventarioResult?.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} registros`,
              onChange: (page, pageSize) => setPagination({ page, pageSize }),
            }}
            rowClassName={(record) => {
              const nivel = calcularNivel(record)
              if (nivel === 'negativo') return 'row-stock-negativo'
              if (nivel === 'bajo') return 'row-stock-bajo'
              return ''
            }}
          />
        )}
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
        confirmLoading={ajustarInventario.isPending}
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
        confirmLoading={actualizarMinMax.isPending}
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
        .row-stock-negativo {
          background-color: #ffccc7;
        }
      `}</style>
    </div>
  )
}
