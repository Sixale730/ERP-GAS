'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  DeliveredProcedureOutlined,
  DownOutlined,
  FileExcelOutlined,
  RightOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import {
  useReporteSurtir,
  type AllocLinea,
  type AllocOV,
  type EstadoSurtido,
} from '@/lib/hooks/queries/useReporteSurtir'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const ESTADO_COLOR: Record<EstadoSurtido, string> = {
  completo: 'green',
  completo_otro_almacen: 'blue',
  parcial: 'orange',
  sin_stock: 'red',
  servicio: 'default',
}

const ESTADO_LABEL: Record<EstadoSurtido, string> = {
  completo: 'En almacén',
  completo_otro_almacen: 'En otro almacén',
  parcial: 'Parcial',
  sin_stock: 'Sin stock',
  servicio: 'N/A',
}

function formatMoney(n: number) {
  return `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function diasDesde(iso: string): number {
  return dayjs().startOf('day').diff(dayjs(iso).startOf('day'), 'day')
}

// ── Tabla interna: detalle por linea ───────────────────────────────────────

function LineasTable({ lineas }: { lineas: AllocLinea[] }) {
  const columns: ColumnsType<AllocLinea> = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    {
      title: 'Producto',
      dataIndex: 'producto_nombre',
      key: 'producto_nombre',
      width: 280,
      ellipsis: true,
    },
    {
      title: 'Pedida',
      dataIndex: 'cantidad_solicitada',
      key: 'cantidad_solicitada',
      width: 80,
      align: 'right',
    },
    {
      title: 'Asignación',
      key: 'asignaciones',
      width: 320,
      render: (_, r) => {
        if (r.es_servicio) return <Text type="secondary">—</Text>
        if (r.asignaciones.length === 0) return <Text type="secondary">—</Text>
        return (
          <Space size={4} wrap>
            {r.asignaciones.map((a, i) => (
              <Tag key={i} color={a.es_almacen_asignado ? 'blue' : 'orange'}>
                {a.almacen_nombre}: {a.cantidad}
                {a.es_almacen_asignado ? ' ★' : ''}
              </Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: 'Faltante',
      dataIndex: 'cantidad_faltante',
      key: 'cantidad_faltante',
      width: 90,
      align: 'right',
      render: (v: number) =>
        v > 0 ? (
          <Text strong style={{ color: '#cf1322' }}>
            {v}
          </Text>
        ) : (
          <Text type="secondary">0</Text>
        ),
    },
    {
      title: 'OC más vieja pendiente',
      key: 'oc',
      width: 280,
      render: (_, r) => {
        if (r.es_servicio) return <Text type="secondary">—</Text>
        if (!r.oc_sugerida) {
          if (r.cantidad_faltante > 0) {
            return <Tag color="red">Sin OC pendiente</Tag>
          }
          return <Text type="secondary">—</Text>
        }
        const oc = r.oc_sugerida
        const dias = diasDesde(oc.created_at)
        return (
          <Space direction="vertical" size={0}>
            <a href={`/compras/${oc.orden_compra_id}`} target="_blank" rel="noreferrer">
              <ShoppingCartOutlined /> {oc.folio}
            </a>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(oc.created_at).format('DD/MM/YYYY')} · {dias}d · {oc.proveedor_nombre}
            </Text>
            <Text style={{ fontSize: 12 }}>cubre {oc.cubre_unidades} de {r.cantidad_faltante}</Text>
          </Space>
        )
      },
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 150,
      render: (s: EstadoSurtido) => <Tag color={ESTADO_COLOR[s]}>{ESTADO_LABEL[s]}</Tag>,
    },
  ]

  return (
    <Table
      rowKey="item_id"
      dataSource={lineas}
      columns={columns}
      pagination={false}
      size="small"
    />
  )
}

// ── Página principal ──────────────────────────────────────────────────────

export default function OrdenesVentaSurtirPage() {
  const router = useRouter()

  // Filtros server-side (afectan FIFO)
  const [fechaRange, setFechaRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [almacenId, setAlmacenId] = useState<string | null>(null)

  // Filtros client-side (post-asignación)
  const [searchText, setSearchText] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoSurtido | 'todos'>('todos')
  const [soloFaltantes, setSoloFaltantes] = useState(false)

  // UI
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [exportando, setExportando] = useState(false)

  const filtrosServer = useMemo(
    () => ({
      clienteId,
      almacenAsignadoId: almacenId,
      fechaDesde: fechaRange?.[0]?.format('YYYY-MM-DD') ?? null,
      fechaHasta: fechaRange?.[1]?.format('YYYY-MM-DD') ?? null,
    }),
    [clienteId, almacenId, fechaRange]
  )

  const { data: resultado, isLoading, isError, error } = useReporteSurtir(filtrosServer)

  // Catálogos para filtros (una vez, poca data)
  const { data: clientes } = useQuery({
    queryKey: ['surtir-reporte', 'clientes'],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error: err } = await supabase
        .schema('erp')
        .from('clientes')
        .select('id, nombre_comercial')
        .eq('is_active', true)
        .order('nombre_comercial')
      if (err) throw err
      return data ?? []
    },
    staleTime: 5 * 60_000,
  })

  const { data: almacenes } = useQuery({
    queryKey: ['surtir-reporte', 'almacenes'],
    queryFn: async () => {
      const supabase = getSupabaseClient()
      const { data, error: err } = await supabase
        .schema('erp')
        .from('almacenes')
        .select('id, nombre')
        .eq('is_active', true)
        .order('nombre')
      if (err) throw err
      return data ?? []
    },
    staleTime: 5 * 60_000,
  })

  // Filtros client-side sobre OVs ya allocadas
  const ovsFiltradas = useMemo(() => {
    if (!resultado) return []
    const s = searchText.trim().toLowerCase()
    return resultado.ovs.filter((ov) => {
      if (estadoFiltro !== 'todos' && ov.estado_global !== estadoFiltro) return false
      if (soloFaltantes && (ov.estado_global === 'completo' || ov.estado_global === 'completo_otro_almacen')) return false
      if (s) {
        const matchFolio = ov.folio.toLowerCase().includes(s)
        const matchCliente = ov.cliente_nombre.toLowerCase().includes(s)
        if (!matchFolio && !matchCliente) return false
      }
      return true
    })
  }, [resultado, searchText, estadoFiltro, soloFaltantes])

  // Stats visibles (sobre el resultado completo, no filtrado)
  const resumen = resultado?.resumen

  // Expandir / colapsar todo
  const todasExpanded = expandedKeys.length === ovsFiltradas.length && ovsFiltradas.length > 0

  const toggleTodos = () => {
    if (todasExpanded) {
      setExpandedKeys([])
    } else {
      setExpandedKeys(ovsFiltradas.map((o) => o.ov_id))
    }
  }

  // Si cambian los filtros client-side, limpiar expansiones de OVs ya no visibles
  useEffect(() => {
    setExpandedKeys((prev) => prev.filter((k) => ovsFiltradas.some((o) => o.ov_id === k)))
  }, [ovsFiltradas])

  const handleExportar = async () => {
    if (!resultado) return
    setExportando(true)
    try {
      const { exportarSurtirExcel } = await import('@/lib/utils/excel-surtir')
      const fechaStr = dayjs().format('YYYY-MM-DD')
      await exportarSurtirExcel(ovsFiltradas, `ordenes-venta-surtir_${fechaStr}.xlsx`)
      message.success('Excel descargado')
    } catch (err) {
      console.error(err)
      message.error('Error al generar Excel')
    } finally {
      setExportando(false)
    }
  }

  const columns: ColumnsType<AllocOV> = [
    {
      title: 'Folio',
      dataIndex: 'folio',
      key: 'folio',
      width: 130,
      render: (folio: string, r) => (
        <a href={`/cotizaciones/${r.ov_id}`} target="_blank" rel="noreferrer">
          {folio}
        </a>
      ),
      sorter: (a, b) => a.created_at.localeCompare(b.created_at),
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha',
      key: 'fecha',
      width: 110,
      render: (f: string) => dayjs(f).format('DD/MM/YYYY'),
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente_nombre',
      key: 'cliente_nombre',
      width: 240,
      ellipsis: true,
    },
    {
      title: 'Almacén OV',
      dataIndex: 'almacen_nombre',
      key: 'almacen_nombre',
      width: 160,
      ellipsis: true,
      render: (n: string | null) => n ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 120,
      align: 'right',
      render: (t: number) => formatMoney(t),
    },
    {
      title: 'Líneas',
      key: 'lineas',
      width: 140,
      render: (_, r) => (
        <Space size={4}>
          <Tag color="default">{r.total_lineas}</Tag>
          {r.lineas_completas > 0 && <Tag color="green">{r.lineas_completas}✓</Tag>}
          {r.lineas_parciales > 0 && <Tag color="orange">{r.lineas_parciales}◐</Tag>}
          {r.lineas_sin_stock > 0 && <Tag color="red">{r.lineas_sin_stock}✗</Tag>}
        </Space>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'estado_global',
      key: 'estado_global',
      width: 160,
      render: (s: EstadoSurtido) => <Tag color={ESTADO_COLOR[s]}>{ESTADO_LABEL[s]}</Tag>,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>
            Volver
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            <DeliveredProcedureOutlined /> Órdenes de Venta a Surtir
          </Title>
        </Space>
        <Button
          type="primary"
          icon={<FileExcelOutlined />}
          onClick={handleExportar}
          loading={exportando}
          disabled={!resultado || ovsFiltradas.length === 0}
        >
          Exportar Excel
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="OVs abiertas" value={resumen?.total_ovs ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="Completas"
              value={resumen?.ovs_completas ?? 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="Parciales"
              value={resumen?.ovs_parciales ?? 0}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="Sin stock"
              value={resumen?.ovs_sin_stock ?? 0}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="Líneas con faltante" value={resumen?.lineas_con_faltante ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic title="Productos únicos" value={resumen?.productos_unicos_con_faltante ?? 0} />
          </Card>
        </Col>
      </Row>

      {/* Filtros + Tabla */}
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker
            value={fechaRange}
            onChange={(v) => setFechaRange(v as [Dayjs, Dayjs] | null)}
            format="DD/MM/YYYY"
            placeholder={['Desde', 'Hasta']}
          />
          <Select
            placeholder="Cliente"
            value={clienteId}
            onChange={setClienteId}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 220 }}
            options={(clientes ?? []).map((c) => ({ value: c.id, label: c.nombre_comercial }))}
          />
          <Select
            placeholder="Almacén de la OV"
            value={almacenId}
            onChange={setAlmacenId}
            allowClear
            style={{ minWidth: 180 }}
            options={(almacenes ?? []).map((a) => ({ value: a.id, label: a.nombre }))}
          />
          <Input.Search
            placeholder="Buscar folio o cliente"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
          <Select
            value={estadoFiltro}
            onChange={setEstadoFiltro}
            style={{ minWidth: 180 }}
            options={[
              { value: 'todos', label: 'Todos los estados' },
              { value: 'completo', label: 'En almacén' },
              { value: 'completo_otro_almacen', label: 'En otro almacén' },
              { value: 'parcial', label: 'Parcial' },
              { value: 'sin_stock', label: 'Sin stock' },
            ]}
          />
          <Space size={4}>
            <Switch checked={soloFaltantes} onChange={setSoloFaltantes} />
            <Text>Solo OVs con faltantes</Text>
          </Space>
        </Space>

        <Space style={{ marginBottom: 12 }}>
          <Button size="small" icon={todasExpanded ? <RightOutlined /> : <DownOutlined />} onClick={toggleTodos}>
            {todasExpanded ? 'Colapsar todo' : 'Expandir todo'}
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {ovsFiltradas.length} OVs visibles
          </Text>
        </Space>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : isError ? (
          <Text type="danger">Error: {(error as Error)?.message ?? 'Desconocido'}</Text>
        ) : (
          <Table
            rowKey="ov_id"
            dataSource={ovsFiltradas}
            columns={columns}
            scroll={{ x: 1100 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (t) => `${t} OVs`,
            }}
            expandable={{
              expandedRowKeys: expandedKeys,
              onExpandedRowsChange: (keys) => setExpandedKeys(keys as string[]),
              expandedRowRender: (ov) => (
                <div style={{ padding: '0 8px' }}>
                  <LineasTable lineas={ov.lineas} />
                </div>
              ),
            }}
          />
        )}
      </Card>
    </div>
  )
}
