'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { AutoComplete, Input, Typography, Tag, Button } from 'antd'
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
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useModulos } from '@/lib/hooks/useModulos'
import { formatMoneyMXN } from '@/lib/utils/format'

const { Text } = Typography

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

interface OptionGroup {
  label: React.ReactNode
  options: {
    value: string
    label: React.ReactNode
    result: SearchResult
  }[]
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

const MAX_DROPDOWN = 3
const QUERY_LIMIT = MAX_DROPDOWN + 1 // fetch 4 to detect "has more"

export default function GlobalSearch() {
  const router = useRouter()
  const { modulosActivos } = useModulos()
  const [searchValue, setSearchValue] = useState('')
  const [options, setOptions] = useState<OptionGroup[]>([])
  const [dropdownWidth, setDropdownWidth] = useState(520)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  // Track container width for dropdown sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setDropdownWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const navigateTo = useCallback((ruta: string) => {
    router.push(ruta)
    setSearchValue('')
    setOptions([])
  }, [router])

  const renderResultLabel = (item: SearchResult) => {
    const actions: { label: string; ruta: string; show: boolean }[] = []

    switch (item.tipo) {
      case 'producto':
        actions.push({ label: 'Ver detalle', ruta: `/productos/${item.id}`, show: true })
        if (modulosActivos.includes('cotizaciones')) {
          actions.push({ label: 'Cotización', ruta: `/cotizaciones/nueva?producto=${item.id}`, show: true })
        }
        break
      case 'cliente':
        actions.push({ label: 'Ver detalle', ruta: `/clientes/${item.id}`, show: true })
        if (modulosActivos.includes('cotizaciones')) {
          actions.push({ label: 'Cotización', ruta: `/cotizaciones/nueva?cliente=${item.id}`, show: true })
        }
        break
      case 'proveedor':
        actions.push({ label: 'Ver', ruta: item.ruta, show: true })
        if (modulosActivos.includes('compras')) {
          actions.push({ label: 'OC', ruta: `/compras/nueva?proveedor=${item.id}`, show: true })
        }
        break
      case 'reporte':
        actions.push({ label: 'Abrir', ruta: item.ruta, show: true })
        break
      default:
        actions.push({ label: 'Ver detalle', ruta: item.ruta, show: true })
    }

    return (
      <div className="global-search-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 0', width: '100%' }}>
        <div style={{ marginTop: 2 }}>{iconByType[item.tipo]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500 }}>{item.titulo}</span>
            {item.tipo === 'producto' && item.stock_disponible !== undefined && (
              <Tag color={item.stock_disponible > 0 ? 'green' : 'red'} style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>
                {item.stock_disponible > 0 ? `Stock: ${item.stock_disponible}` : 'Sin stock'}
              </Tag>
            )}
            {item.tipo === 'cliente' && item.saldo_pendiente !== undefined && (
              item.saldo_pendiente > 0
                ? <Tag color="red" style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>
                    {formatMoneyMXN(item.saldo_pendiente)}
                  </Tag>
                : <Tag color="green" style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>Sin deuda</Tag>
            )}
          </div>
          {item.subtitulo && (
            <Text type="secondary" style={{ fontSize: 12 }}>{item.subtitulo}</Text>
          )}
          <div
            className="global-search-actions"
            style={{ marginTop: 2 }}
          >
            {actions.filter(a => a.show).map((action) => (
              <a
                key={action.label}
                href={action.ruta}
                onClick={(e) => {
                  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                    e.preventDefault()
                    e.stopPropagation()
                    navigateTo(action.ruta)
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{ textDecoration: 'none' }}
              >
                <Button
                  type="link"
                  size="small"
                  style={{ padding: '0 4px', height: 20, fontSize: 12 }}
                  icon={['Cotización', 'OC'].includes(action.label) ? <PlusOutlined /> : action.label === 'Abrir' ? <ArrowRightOutlined /> : <EyeOutlined />}
                >
                  {action.label}
                </Button>
              </a>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const buscarGlobal = async (texto: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const supabase = getSupabaseClient()
    const busqueda = `%${texto}%`

    try {
      const [productosRes, clientesRes, cotizacionesRes, facturasRes, ordenesRes, proveedoresRes] = await Promise.all([
        supabase
          .schema('erp')
          .from('v_productos_stock')
          .select('id, sku, nombre, disponible_total')
          .or(`sku.ilike.${busqueda},nombre.ilike.${busqueda}`)
          .limit(QUERY_LIMIT)
          .abortSignal(controller.signal),
        supabase
          .schema('erp')
          .from('clientes')
          .select('id, codigo, nombre_comercial, rfc, saldo_pendiente')
          .or(`codigo.ilike.${busqueda},nombre_comercial.ilike.${busqueda},rfc.ilike.${busqueda}`)
          .eq('is_active', true)
          .limit(QUERY_LIMIT)
          .abortSignal(controller.signal),
        supabase
          .schema('erp')
          .from('v_cotizaciones')
          .select('id, folio, cliente_nombre')
          .or(`folio.ilike.${busqueda},cliente_nombre.ilike.${busqueda}`)
          .limit(QUERY_LIMIT)
          .abortSignal(controller.signal),
        supabase
          .schema('erp')
          .from('v_facturas')
          .select('id, folio, cliente_nombre')
          .or(`folio.ilike.${busqueda},cliente_nombre.ilike.${busqueda}`)
          .limit(QUERY_LIMIT)
          .abortSignal(controller.signal),
        supabase
          .schema('erp')
          .from('ordenes_compra')
          .select('id, folio')
          .ilike('folio', busqueda)
          .limit(QUERY_LIMIT)
          .abortSignal(controller.signal),
        supabase
          .schema('erp')
          .from('proveedores')
          .select('id, codigo, razon_social, nombre_comercial')
          .or(`codigo.ilike.${busqueda},razon_social.ilike.${busqueda},nombre_comercial.ilike.${busqueda}`)
          .eq('is_active', true)
          .limit(QUERY_LIMIT)
          .abortSignal(controller.signal),
      ])

      if (controller.signal.aborted) return

      // Build results grouped by type
      const grupos: Record<string, SearchResult[]> = {}

      const addResults = (tipo: ResultTipo, items: SearchResult[]) => {
        if (items.length > 0) {
          grupos[tipo] = items
        }
      }

      // Productos
      addResults('producto', (productosRes.data ?? []).map((p) => ({
        id: p.id,
        tipo: 'producto' as const,
        titulo: p.nombre,
        subtitulo: p.sku,
        ruta: `/productos/${p.id}`,
        stock_disponible: p.disponible_total ?? 0,
      })))

      // Clientes
      addResults('cliente', (clientesRes.data ?? []).map((c) => ({
        id: c.id,
        tipo: 'cliente' as const,
        titulo: c.nombre_comercial,
        subtitulo: `${c.codigo} - ${c.rfc || 'Sin RFC'}`,
        ruta: `/clientes/${c.id}`,
        saldo_pendiente: c.saldo_pendiente ?? 0,
      })))

      // Cotizaciones
      addResults('cotizacion', (cotizacionesRes.data ?? []).map((cot) => ({
        id: cot.id,
        tipo: 'cotizacion' as const,
        titulo: cot.folio,
        subtitulo: cot.cliente_nombre,
        ruta: `/cotizaciones/${cot.id}`,
      })))

      // Facturas
      addResults('factura', (facturasRes.data ?? []).map((f) => ({
        id: f.id,
        tipo: 'factura' as const,
        titulo: f.folio,
        subtitulo: f.cliente_nombre,
        ruta: `/facturas/${f.id}`,
      })))

      // Órdenes de compra
      addResults('orden_compra', (ordenesRes.data ?? []).map((oc) => ({
        id: oc.id,
        tipo: 'orden_compra' as const,
        titulo: oc.folio,
        ruta: `/compras/${oc.id}`,
      })))

      // Proveedores
      addResults('proveedor', (proveedoresRes.data ?? []).map((prov) => ({
        id: prov.id,
        tipo: 'proveedor' as const,
        titulo: prov.nombre_comercial || prov.razon_social,
        subtitulo: prov.codigo,
        ruta: `/catalogos/proveedores?id=${prov.id}`,
      })))

      // Reportes (filtro estático)
      const queryLower = texto.toLowerCase()
      const reportesFiltrados = REPORTES_CATALOGO
        .filter((r) =>
          r.label.toLowerCase().includes(queryLower) &&
          (r.modulo === null || modulosActivos.includes(r.modulo))
        )
        .map((r) => ({
          id: r.id,
          tipo: 'reporte' as const,
          titulo: r.label,
          ruta: r.ruta,
        }))
      if (reportesFiltrados.length > 0) {
        grupos['reporte'] = reportesFiltrados
      }

      // Build option groups with max 3 visible + "Ver todos" link
      const optionGroups: OptionGroup[] = Object.entries(grupos).map(([tipo, items]) => {
        const hasMore = items.length > MAX_DROPDOWN
        const visibleItems = items.slice(0, MAX_DROPDOWN)

        const opts = visibleItems.map((item) => ({
          value: `${item.tipo}-${item.id}`,
          label: renderResultLabel(item),
          result: item,
        }))

        // Add "Ver todos" link if there are more results
        if (hasMore) {
          opts.push({
            value: `ver-todos-${tipo}`,
            label: (
              <div style={{ textAlign: 'center', padding: '2px 0' }}>
                <Button
                  type="link"
                  size="small"
                  style={{ fontSize: 12, color: '#1890ff' }}
                  icon={<ArrowRightOutlined />}
                >
                  Ver todos los {labelByType[tipo as ResultTipo].toLowerCase()}
                </Button>
              </div>
            ),
            result: {
              id: `ver-todos-${tipo}`,
              tipo: tipo as ResultTipo,
              titulo: '',
              ruta: `/buscar?q=${encodeURIComponent(texto)}&tipo=${tipo}`,
            },
          })
        }

        return {
          label: (
            <Text strong style={{ fontSize: 12, color: '#8c8c8c' }}>
              {labelByType[tipo as ResultTipo]}
            </Text>
          ),
          options: opts,
        }
      })

      // Add global "search all" option at the end
      if (Object.keys(grupos).length > 0) {
        optionGroups.push({
          label: <span />,
          options: [{
            value: 'buscar-todos',
            label: (
              <div style={{ textAlign: 'center', padding: '4px 0' }}>
                <SearchOutlined style={{ marginRight: 6 }} />
                <Text style={{ color: '#1890ff' }}>
                  Ver todos los resultados para &quot;{texto}&quot;
                </Text>
              </div>
            ),
            result: {
              id: 'buscar-todos',
              tipo: 'producto' as ResultTipo,
              titulo: '',
              ruta: `/buscar?q=${encodeURIComponent(texto)}`,
            },
          }],
        })
      }

      setOptions(optionGroups)
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setOptions([])
    }
  }

  const handleSearch = (value: string) => {
    setSearchValue(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (value.length < 2) {
      setOptions([])
      return
    }

    debounceRef.current = setTimeout(() => {
      buscarGlobal(value)
    }, 300)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelect = (_value: string, option: any) => {
    const result = option.result as SearchResult
    if (result) {
      navigateTo(result.ruta)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.length >= 2) {
      e.preventDefault()
      navigateTo(`/buscar?q=${encodeURIComponent(searchValue)}`)
    }
  }

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <AutoComplete
        style={{ width: '100%', margin: 'auto 0' }}
        options={options}
        onSearch={handleSearch}
        onSelect={handleSelect}
        value={searchValue}
        popupMatchSelectWidth={Math.max(dropdownWidth, 480)}
      >
        <Input
          placeholder="Buscar productos, clientes, facturas..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          allowClear
          style={{ borderRadius: 8, height: 36 }}
          onKeyDown={handleKeyDown}
        />
      </AutoComplete>
    </div>
  )
}
