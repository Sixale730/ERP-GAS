'use client'

import { useEffect, useState } from 'react'
import { Table, Select, Input, Space, Tag, Card, Typography, message, Row, Col, Statistic } from 'antd'
import { SearchOutlined, InboxOutlined, WarningOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Almacen } from '@/types/database'

const { Title } = Typography

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
  const [loading, setLoading] = useState(true)
  const [inventario, setInventario] = useState<InventarioRow[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [almacenFilter, setAlmacenFilter] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadAlmacenes()
    loadInventario()
  }, [almacenFilter])

  const loadAlmacenes = async () => {
    const supabase = getSupabaseClient()

    try {
      const { data } = await supabase
        .schema('erp')
        .from('almacenes')
        .select('*')
        .eq('is_active', true)
        .order('nombre')

      setAlmacenes(data || [])
    } catch (error) {
      console.error('Error loading almacenes:', error)
    }
  }

  const loadInventario = async () => {
    const supabase = getSupabaseClient()
    setLoading(true)

    try {
      let query = supabase
        .schema('erp')
        .from('v_inventario_detalle')
        .select('*')
        .order('producto_nombre')

      if (almacenFilter) {
        query = query.eq('almacen_id', almacenFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setInventario(data || [])
    } catch (error) {
      console.error('Error loading inventario:', error)
      message.error('Error al cargar inventario')
    } finally {
      setLoading(false)
    }
  }

  const filteredInventario = inventario.filter(
    (i) =>
      i.producto_nombre.toLowerCase().includes(searchText.toLowerCase()) ||
      i.sku.toLowerCase().includes(searchText.toLowerCase())
  )

  // Stats
  const totalItems = filteredInventario.length
  const stockBajo = filteredInventario.filter(i => i.nivel_stock === 'bajo').length
  const stockExceso = filteredInventario.filter(i => i.nivel_stock === 'exceso').length

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
        }
        const { color, label } = config[nivel] || { color: 'default', label: nivel }
        return <Tag color={color}>{label}</Tag>
      },
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
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="Filtrar por almacén"
            value={almacenFilter}
            onChange={setAlmacenFilter}
            style={{ width: 200 }}
            allowClear
            options={almacenes.map(a => ({ value: a.id, label: a.nombre }))}
          />
        </Space>

        <Table
          dataSource={filteredInventario}
          columns={columns}
          rowKey="id"
          loading={loading}
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

      <style jsx global>{`
        .row-stock-bajo {
          background-color: #fff2f0;
        }
      `}</style>
    </div>
  )
}
