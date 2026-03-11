'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, Typography, Tag, Button, Segmented, Empty, Spin, Row, Col } from 'antd'
import {
  SearchOutlined,
  ShoppingOutlined,
  TeamOutlined,
  FileTextOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  BarChartOutlined,
  EyeOutlined,
  PlusOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useModulos } from '@/lib/hooks/useModulos'
import { formatMoneyMXN } from '@/lib/utils/format'

const { Title, Text } = Typography

const REPORTES_CATALOGO = [
  { id: 'ventas-pos', label: 'Ventas del Período', modulo: 'pos', ruta: '/reportes/ventas-pos' },
  { id: 'cortes-caja', label: 'Cortes de Caja', modulo: 'pos', ruta: '/reportes/cortes-caja' },
  { id: 'productos-vendidos', label: 'Productos más Vendidos', modulo: 'pos', ruta: '/reportes/productos-vendidos' },
  { id: 'ventas-forma-pago', label: 'Ventas por Forma de Pago', modulo: 'pos', ruta: '/reportes/ventas-forma-pago' },
  { id: 'facturas-saldos', label: 'Facturas y Saldos', modulo: 'facturas', ruta: '/reportes/facturas-saldos' },
  { id: 'cartera-vencida', label: 'Cartera Vencida', modulo: 'facturas', ruta: '/reportes/cartera-vencida' },
  { id: 'margen-utilidad', label: 'Margen de Utilidad', modulo: null, ruta: '/reportes/margen-utilidad' },
  { id: 'inventario', label: 'Inventario Actual', modulo: null, ruta: '/reportes/inventario' },
  { id: 'movimientos', label: 'Movimientos de Inventario', modulo: null, ruta: '/reportes/movimientos' },
  { id: 'ordenes-compra', label: 'Órdenes de Compra', modulo: 'compras', ruta: '/reportes/ordenes-compra' },
  { id: 'ordenes-venta', label: 'Órdenes de Venta', modulo: 'cotizaciones', ruta: '/reportes/ordenes-venta' },
] as const

type ResultTipo = 'producto' | 'cliente' | 'cotizacion' | 'factura' | 'orden_compra' | 'proveedor' | 'reporte'

interface SearchResult {
  id: string
  tipo: ResultTipo
  titulo: string
  subtitulo?: string
  ruta: string
  stock_disponible?: number
  saldo_pendiente?: number
}

const iconByType: Record<ResultTipo, React.ReactNode> = {
  producto: <ShoppingOutlined style={{ color: '#1890ff' }} />,
  cliente: <TeamOutlined style={{ color: '#52c41a' }} />,
  cotizacion: <FileTextOutlined style={{ color: '#faad14' }} />,
  factura: <DollarOutlined style={{ color: '#722ed1' }} />,
  orden_compra: <ShoppingCartOutlined style={{ color: '#13c2c2' }} />,
  proveedor: <ShopOutlined style={{ color: '#722ed1' }} />,
  reporte: <BarChartOutlined style={{ color: '#13c2c2' }} />,
}

const labelByType: Record<ResultTipo, string> = {
  producto: 'Productos',
  cliente: 'Clientes',
  cotizacion: 'Cotizaciones',
  factura: 'Facturas',
  orden_compra: 'Órdenes de Compra',
  proveedor: 'Proveedores',
  reporte: 'Reportes',
}

const SEARCH_LIMIT = 50

function sortByRelevance(items: SearchResult[], query: string): SearchResult[] {
  const q = query.toLowerCase()
  return [...items].sort((a, b) => {
    const aExact = a.titulo.toLowerCase() === q ? 0 : 1
    const bExact = b.titulo.toLowerCase() === q ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    const aStarts = a.titulo.toLowerCase().startsWith(q) ? 0 : 1
    const bStarts = b.titulo.toLowerCase().startsWith(q) ? 0 : 1
    return aStarts - bStarts
  })
}

export default function BuscarPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}><Spin size="large" /></div>}>
      <BuscarContent />
    </Suspense>
  )
}

function BuscarContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { modulosActivos } = useModulos()

  const query = searchParams.get('q') || ''
  const tipoFiltro = searchParams.get('tipo') as ResultTipo | null

  const [results, setResults] = useState<Record<string, SearchResult[]>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) {
      setResults({})
      return
    }

    let cancelled = false
    const buscar = async () => {
      setLoading(true)
      const supabase = getSupabaseClient()
      const busqueda = `%${query}%`

      try {
        const [productosRes, clientesRes, cotizacionesRes, facturasRes, ordenesRes, proveedoresRes] = await Promise.all([
          supabase
            .schema('erp')
            .from('v_productos_stock')
            .select('id, sku, nombre, disponible_total')
            .or(`sku.ilike.${busqueda},nombre.ilike.${busqueda}`)
            .limit(SEARCH_LIMIT),
          supabase
            .schema('erp')
            .from('clientes')
            .select('id, codigo, nombre_comercial, rfc, saldo_pendiente')
            .or(`codigo.ilike.${busqueda},nombre_comercial.ilike.${busqueda},rfc.ilike.${busqueda}`)
            .eq('is_active', true)
            .limit(SEARCH_LIMIT),
          supabase
            .schema('erp')
            .from('v_cotizaciones')
            .select('id, folio, cliente_nombre')
            .or(`folio.ilike.${busqueda},cliente_nombre.ilike.${busqueda}`)
            .limit(SEARCH_LIMIT),
          supabase
            .schema('erp')
            .from('v_facturas')
            .select('id, folio, cliente_nombre')
            .or(`folio.ilike.${busqueda},cliente_nombre.ilike.${busqueda}`)
            .limit(SEARCH_LIMIT),
          supabase
            .schema('erp')
            .from('ordenes_compra')
            .select('id, folio')
            .ilike('folio', busqueda)
            .limit(SEARCH_LIMIT),
          supabase
            .schema('erp')
            .from('proveedores')
            .select('id, codigo, razon_social, nombre_comercial')
            .or(`codigo.ilike.${busqueda},razon_social.ilike.${busqueda},nombre_comercial.ilike.${busqueda}`)
            .eq('is_active', true)
            .limit(SEARCH_LIMIT),
        ])

        if (cancelled) return

        const grupos: Record<string, SearchResult[]> = {}

        const addResults = (tipo: ResultTipo, items: SearchResult[]) => {
          if (items.length > 0) grupos[tipo] = sortByRelevance(items, query)
        }

        addResults('producto', (productosRes.data ?? []).map((p) => ({
          id: p.id, tipo: 'producto' as const, titulo: p.nombre, subtitulo: p.sku,
          ruta: `/productos/${p.id}`, stock_disponible: p.disponible_total ?? 0,
        })))

        addResults('cliente', (clientesRes.data ?? []).map((c) => ({
          id: c.id, tipo: 'cliente' as const, titulo: c.nombre_comercial,
          subtitulo: `${c.codigo} - ${c.rfc || 'Sin RFC'}`,
          ruta: `/clientes/${c.id}`, saldo_pendiente: c.saldo_pendiente ?? 0,
        })))

        addResults('cotizacion', (cotizacionesRes.data ?? []).map((cot) => ({
          id: cot.id, tipo: 'cotizacion' as const, titulo: cot.folio,
          subtitulo: cot.cliente_nombre, ruta: `/cotizaciones/${cot.id}`,
        })))

        addResults('factura', (facturasRes.data ?? []).map((f) => ({
          id: f.id, tipo: 'factura' as const, titulo: f.folio,
          subtitulo: f.cliente_nombre, ruta: `/facturas/${f.id}`,
        })))

        addResults('orden_compra', (ordenesRes.data ?? []).map((oc) => ({
          id: oc.id, tipo: 'orden_compra' as const, titulo: oc.folio,
          ruta: `/compras/${oc.id}`,
        })))

        addResults('proveedor', (proveedoresRes.data ?? []).map((prov) => ({
          id: prov.id, tipo: 'proveedor' as const,
          titulo: prov.nombre_comercial || prov.razon_social,
          subtitulo: prov.codigo, ruta: `/catalogos/proveedores?id=${prov.id}`,
        })))

        // Reportes
        const queryLower = query.toLowerCase()
        const reportesFiltrados = REPORTES_CATALOGO
          .filter((r) =>
            r.label.toLowerCase().includes(queryLower) &&
            (r.modulo === null || modulosActivos.includes(r.modulo))
          )
          .map((r) => ({
            id: r.id, tipo: 'reporte' as const, titulo: r.label, ruta: r.ruta,
          }))
        if (reportesFiltrados.length > 0) grupos['reporte'] = reportesFiltrados

        setResults(grupos)
      } catch {
        if (!cancelled) setResults({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    buscar()
    return () => { cancelled = true }
  }, [query, modulosActivos])

  const totalCount = useMemo(() =>
    Object.values(results).reduce((sum, items) => sum + items.length, 0),
    [results]
  )

  const tiposConResultados = useMemo(() =>
    Object.keys(results) as ResultTipo[],
    [results]
  )

  const segmentOptions = useMemo(() => {
    const opts = [{ label: `Todos (${totalCount})`, value: 'todos' }]
    tiposConResultados.forEach((tipo) => {
      opts.push({
        label: `${labelByType[tipo]} (${results[tipo].length})`,
        value: tipo,
      })
    })
    return opts
  }, [tiposConResultados, results, totalCount])

  const filteredResults = useMemo(() => {
    if (!tipoFiltro || tipoFiltro === ('todos' as ResultTipo)) return results
    const filtered: Record<string, SearchResult[]> = {}
    if (results[tipoFiltro]) filtered[tipoFiltro] = results[tipoFiltro]
    return filtered
  }, [results, tipoFiltro])

  const handleSegmentChange = (value: string | number) => {
    const val = value as string
    if (val === 'todos') {
      router.push(`/buscar?q=${encodeURIComponent(query)}`)
    } else {
      router.push(`/buscar?q=${encodeURIComponent(query)}&tipo=${val}`)
    }
  }

  const getActions = (item: SearchResult) => {
    const actions: { label: string; ruta: string; icon: React.ReactNode }[] = []

    switch (item.tipo) {
      case 'producto':
        actions.push({ label: 'Ver detalle', ruta: `/productos/${item.id}`, icon: <EyeOutlined /> })
        if (modulosActivos.includes('cotizaciones')) {
          actions.push({ label: 'Cotización', ruta: `/cotizaciones/nueva?producto=${item.id}`, icon: <PlusOutlined /> })
        }
        break
      case 'cliente':
        actions.push({ label: 'Ver detalle', ruta: `/clientes/${item.id}`, icon: <EyeOutlined /> })
        if (modulosActivos.includes('cotizaciones')) {
          actions.push({ label: 'Cotización', ruta: `/cotizaciones/nueva?cliente=${item.id}`, icon: <PlusOutlined /> })
        }
        break
      case 'proveedor':
        actions.push({ label: 'Ver', ruta: item.ruta, icon: <EyeOutlined /> })
        if (modulosActivos.includes('compras')) {
          actions.push({ label: 'OC', ruta: `/compras/nueva?proveedor=${item.id}`, icon: <PlusOutlined /> })
        }
        break
      case 'reporte':
        actions.push({ label: 'Abrir', ruta: item.ruta, icon: <ArrowRightOutlined /> })
        break
      default:
        actions.push({ label: 'Ver detalle', ruta: item.ruta, icon: <EyeOutlined /> })
    }

    return actions
  }

  if (!query || query.length < 2) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Escribe al menos 2 caracteres para buscar" />
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 16 }}>
        <SearchOutlined style={{ marginRight: 8 }} />
        Resultados para: &quot;{query}&quot;
      </Title>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Buscando...</Text>
          </div>
        </div>
      ) : totalCount === 0 ? (
        <Empty description={`No se encontraron resultados para "${query}"`} />
      ) : (
        <>
          <div style={{ marginBottom: 20, overflowX: 'auto' }}>
            <Segmented
              options={segmentOptions}
              value={tipoFiltro || 'todos'}
              onChange={handleSegmentChange}
              size="middle"
            />
          </div>

          {Object.entries(filteredResults).map(([tipo, items]) => (
            <div key={tipo} style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                {iconByType[tipo as ResultTipo]}
                {labelByType[tipo as ResultTipo]}
                <Tag>{items.length}</Tag>
              </Title>

              <Row gutter={[12, 12]}>
                {items.map((item) => (
                  <Col key={item.id} xs={24} sm={12} lg={8} xl={6}>
                    <Card
                      size="small"
                      hoverable
                      style={{ height: '100%', position: 'relative' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ marginTop: 2, fontSize: 16 }}>{iconByType[item.tipo]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                            <Text strong style={{
                              fontSize: 14,
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical' as const,
                              wordBreak: 'break-word',
                            }}>{item.titulo}</Text>
                            {item.tipo === 'producto' && item.stock_disponible !== undefined && (
                              <Tag color={item.stock_disponible > 0 ? 'green' : 'red'} style={{ margin: 0, fontSize: 11 }}>
                                {item.stock_disponible > 0 ? `Stock: ${item.stock_disponible}` : 'Sin stock'}
                              </Tag>
                            )}
                            {item.tipo === 'cliente' && item.saldo_pendiente !== undefined && (
                              item.saldo_pendiente > 0
                                ? <Tag color="red" style={{ margin: 0, fontSize: 11 }}>{formatMoneyMXN(item.saldo_pendiente)}</Tag>
                                : <Tag color="green" style={{ margin: 0, fontSize: 11 }}>Sin deuda</Tag>
                            )}
                          </div>
                          {item.subtitulo && (
                            <Text type="secondary" style={{ fontSize: 12 }}>{item.subtitulo}</Text>
                          )}
                          <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
                            {getActions(item).map((action) => (
                              <Button
                                key={action.label}
                                type="link"
                                size="small"
                                icon={action.icon}
                                href={action.ruta}
                                style={{ padding: '0 4px', height: 22, fontSize: 12 }}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <a href={item.ruta} style={{ position: 'absolute', inset: 0, opacity: 0 }} tabIndex={-1} aria-hidden="true" />
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
