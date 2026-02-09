'use client'

import { useEffect, useState } from 'react'
import { Card, Typography, Space, Input, Select, Row, Col, Statistic, Button } from 'antd'
import { SearchOutlined, ArrowUpOutlined, ArrowDownOutlined, SwapOutlined, ReloadOutlined, FilePdfOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import MovimientosTable from '@/components/movimientos/MovimientosTable'
import { generarPDFReporte } from '@/lib/utils/pdf'
import { formatDateTime } from '@/lib/utils/format'
import dayjs from 'dayjs'
import type { MovimientoView, Almacen } from '@/types/database'

const { Title } = Typography

export default function MovimientosPage() {
  const [loading, setLoading] = useState(true)
  const [generandoPDF, setGenerandoPDF] = useState(false)
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
      const result = data || []
      setMovimientos(result)
      return result
    } catch (error) {
      console.error('Error loading movimientos:', error)
      return []
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

  const handleDescargarPDF = async () => {
    setGenerandoPDF(true)
    try {
      const freshData = await loadMovimientos()

      // Aplicar filtro de búsqueda client-side al dato fresco
      const freshFiltered = freshData.filter(m =>
        m.producto_nombre.toLowerCase().includes(searchText.toLowerCase()) ||
        m.sku.toLowerCase().includes(searchText.toLowerCase()) ||
        (m.notas || '').toLowerCase().includes(searchText.toLowerCase())
      )

      // Calcular stats frescos
      const freshEntradas = freshFiltered.filter(m => m.tipo === 'entrada').length
      const freshSalidas = freshFiltered.filter(m => m.tipo === 'salida').length

      const filtrosAplicados: string[] = []
      if (almacenFilter) {
        const alm = almacenes.find(a => a.id === almacenFilter)
        if (alm) filtrosAplicados.push(`Almacen: ${alm.nombre}`)
      }
      if (tipoFilter) {
        filtrosAplicados.push(`Tipo: ${tipoFilter === 'entrada' ? 'Entradas' : 'Salidas'}`)
      }
      if (searchText) {
        filtrosAplicados.push(`Busqueda: ${searchText}`)
      }

      generarPDFReporte({
        titulo: 'Historial de Movimientos',
        nombreArchivo: `reporte-movimientos-${dayjs().format('YYYY-MM-DD')}`,
        orientacion: 'landscape',
        filtrosAplicados: filtrosAplicados.length > 0 ? filtrosAplicados : undefined,
        estadisticas: [
          { label: 'Total Movimientos', valor: freshFiltered.length },
          { label: 'Entradas', valor: freshEntradas },
          { label: 'Salidas', valor: freshSalidas },
        ],
        columnas: [
          { titulo: 'Fecha', dataIndex: 'fecha_fmt', width: 150 },
          { titulo: 'Tipo', dataIndex: 'tipo', width: 80 },
          { titulo: 'SKU', dataIndex: 'sku', width: 100 },
          { titulo: 'Producto', dataIndex: 'producto_nombre' },
          { titulo: 'Cantidad', dataIndex: 'cantidad', width: 80, halign: 'right' },
          { titulo: 'Almacen', dataIndex: 'almacen_fmt', width: 140 },
          { titulo: 'Referencia', dataIndex: 'referencia_tipo', width: 100 },
          { titulo: 'Notas', dataIndex: 'notas' },
        ],
        datos: freshFiltered.map(m => ({
          ...m,
          fecha_fmt: formatDateTime(m.created_at),
          tipo: m.tipo === 'entrada' ? 'Entrada' : 'Salida',
          almacen_fmt: m.tipo === 'entrada' ? (m.almacen_destino || '-') : (m.almacen_origen || '-'),
          referencia_tipo: m.referencia_tipo || '-',
          notas: m.notas || '-',
        })),
      })
    } finally {
      setGenerandoPDF(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <Title level={2} style={{ margin: 0 }}>Historial de Movimientos</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadMovimientos}>Actualizar</Button>
          <Button type="primary" icon={<FilePdfOutlined />} onClick={handleDescargarPDF} loading={generandoPDF}>Descargar PDF</Button>
        </Space>
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
