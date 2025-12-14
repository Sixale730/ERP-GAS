'use client'

import { useEffect, useState } from 'react'
import { Card, Typography, Space, Input, Select, Row, Col, Statistic, Button } from 'antd'
import { SearchOutlined, ArrowUpOutlined, ArrowDownOutlined, SwapOutlined, ReloadOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import MovimientosTable from '@/components/movimientos/MovimientosTable'
import type { MovimientoView, Almacen } from '@/types/database'

const { Title } = Typography

export default function MovimientosPage() {
  const [loading, setLoading] = useState(true)
  const [movimientos, setMovimientos] = useState<MovimientoView[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])

  // Filters
  const [searchText, setSearchText] = useState('')
  const [almacenFilter, setAlmacenFilter] = useState<string | null>(null)
  const [tipoFilter, setTipoFilter] = useState<'entrada' | 'salida' | null>(null)

  useEffect(() => {
    loadAlmacenes()
    loadMovimientos()
  }, [])

  useEffect(() => {
    loadMovimientos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almacenFilter, tipoFilter])

  const loadAlmacenes = async () => {
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .schema('erp')
      .from('almacenes')
      .select('*')
      .eq('is_active', true)
      .order('nombre')
    setAlmacenes(data || [])
  }

  const loadMovimientos = async () => {
    setLoading(true)
    const supabase = getSupabaseClient()

    try {
      let query = supabase
        .schema('erp')
        .from('v_movimientos')
        .select('*')
        .order('created_at', { ascending: false })

      if (almacenFilter) {
        query = query.or(`almacen_origen_id.eq.${almacenFilter},almacen_destino_id.eq.${almacenFilter}`)
      }

      if (tipoFilter) {
        query = query.eq('tipo', tipoFilter)
      }

      const { data, error } = await query
      if (error) throw error
      setMovimientos(data || [])
    } catch (error) {
      console.error('Error loading movimientos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Client-side search filter
  const filteredMovimientos = movimientos.filter(m =>
    m.producto_nombre.toLowerCase().includes(searchText.toLowerCase()) ||
    m.sku.toLowerCase().includes(searchText.toLowerCase()) ||
    (m.notas || '').toLowerCase().includes(searchText.toLowerCase())
  )

  // Stats
  const totalEntradas = filteredMovimientos.filter(m => m.tipo === 'entrada').length
  const totalSalidas = filteredMovimientos.filter(m => m.tipo === 'salida').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Historial de Movimientos</Title>
        <Button icon={<ReloadOutlined />} onClick={loadMovimientos}>Actualizar</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Movimientos"
              value={filteredMovimientos.length}
              prefix={<SwapOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Entradas"
              value={totalEntradas}
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Salidas"
              value={totalSalidas}
              prefix={<ArrowDownOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por producto, SKU o notas..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Filtrar por almacen"
            value={almacenFilter}
            onChange={setAlmacenFilter}
            style={{ width: 180 }}
            allowClear
            options={almacenes.map(a => ({ value: a.id, label: a.nombre }))}
          />
          <Select
            placeholder="Tipo de movimiento"
            value={tipoFilter}
            onChange={setTipoFilter}
            style={{ width: 150 }}
            allowClear
            options={[
              { value: 'entrada', label: 'Entradas' },
              { value: 'salida', label: 'Salidas' },
            ]}
          />
        </Space>

        <MovimientosTable
          data={filteredMovimientos}
          loading={loading}
          pageSize={20}
        />
      </Card>
    </div>
  )
}
