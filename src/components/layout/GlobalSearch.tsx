'use client'

import { useState, useRef, useEffect } from 'react'
import { AutoComplete, Input, Typography, Space } from 'antd'
import {
  SearchOutlined,
  ShoppingOutlined,
  TeamOutlined,
  FileTextOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Text } = Typography

interface SearchResult {
  id: string
  tipo: 'producto' | 'cliente' | 'cotizacion' | 'factura' | 'orden_compra'
  titulo: string
  subtitulo?: string
  ruta: string
}

interface OptionGroup {
  label: React.ReactNode
  options: {
    value: string
    label: React.ReactNode
    result: SearchResult
  }[]
}

const iconByType = {
  producto: <ShoppingOutlined style={{ color: '#1890ff' }} />,
  cliente: <TeamOutlined style={{ color: '#52c41a' }} />,
  cotizacion: <FileTextOutlined style={{ color: '#faad14' }} />,
  factura: <DollarOutlined style={{ color: '#722ed1' }} />,
  orden_compra: <ShoppingCartOutlined style={{ color: '#13c2c2' }} />,
}

const labelByType = {
  producto: 'Productos',
  cliente: 'Clientes',
  cotizacion: 'Cotizaciones',
  factura: 'Facturas',
  orden_compra: 'Ordenes de Compra',
}

export default function GlobalSearch() {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState('')
  const [options, setOptions] = useState<OptionGroup[]>([])
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const buscarGlobal = async (texto: string) => {
    // Abort any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const supabase = getSupabaseClient()
    const busqueda = `%${texto}%`

    try {
      const [productosRes, clientesRes, cotizacionesRes, facturasRes, ordenesRes] = await Promise.all([
        supabase
          .schema('erp')
          .from('productos')
          .select('id, sku, nombre')
          .or(`sku.ilike.${busqueda},nombre.ilike.${busqueda}`)
          .eq('is_active', true)
          .limit(5)
          .abortSignal(controller.signal),
        supabase
          .schema('erp')
          .from('clientes')
          .select('id, codigo, nombre_comercial, rfc')
          .or(`codigo.ilike.${busqueda},nombre_comercial.ilike.${busqueda},rfc.ilike.${busqueda}`)
          .eq('is_active', true)
          .limit(5)
          .abortSignal(controller.signal),
        supabase
          .schema('erp')
          .from('v_cotizaciones')
          .select('id, folio, cliente_nombre')
          .or(`folio.ilike.${busqueda},cliente_nombre.ilike.${busqueda}`)
          .limit(5)
          .abortSignal(controller.signal),
        supabase
          .schema('erp')
          .from('v_facturas')
          .select('id, folio, cliente_nombre')
          .or(`folio.ilike.${busqueda},cliente_nombre.ilike.${busqueda}`)
          .limit(5)
          .abortSignal(controller.signal),
        supabase
          .schema('erp')
          .from('ordenes_compra')
          .select('id, folio')
          .ilike('folio', busqueda)
          .limit(5)
          .abortSignal(controller.signal),
      ])

      // If this request was aborted, don't update state
      if (controller.signal.aborted) return

      const results: SearchResult[] = []

      productosRes.data?.forEach((p) => {
        results.push({
          id: p.id,
          tipo: 'producto',
          titulo: p.nombre,
          subtitulo: p.sku,
          ruta: `/productos/${p.id}`,
        })
      })

      clientesRes.data?.forEach((c) => {
        results.push({
          id: c.id,
          tipo: 'cliente',
          titulo: c.nombre_comercial,
          subtitulo: `${c.codigo} - ${c.rfc || 'Sin RFC'}`,
          ruta: `/clientes/${c.id}`,
        })
      })

      cotizacionesRes.data?.forEach((cot) => {
        results.push({
          id: cot.id,
          tipo: 'cotizacion',
          titulo: cot.folio,
          subtitulo: cot.cliente_nombre,
          ruta: `/cotizaciones/${cot.id}`,
        })
      })

      facturasRes.data?.forEach((f) => {
        results.push({
          id: f.id,
          tipo: 'factura',
          titulo: f.folio,
          subtitulo: f.cliente_nombre,
          ruta: `/facturas/${f.id}`,
        })
      })

      ordenesRes.data?.forEach((oc) => {
        results.push({
          id: oc.id,
          tipo: 'orden_compra',
          titulo: oc.folio,
          ruta: `/compras/${oc.id}`,
        })
      })

      // Group by type
      const grupos: Record<string, SearchResult[]> = {}
      results.forEach((r) => {
        if (!grupos[r.tipo]) {
          grupos[r.tipo] = []
        }
        grupos[r.tipo].push(r)
      })

      const optionGroups: OptionGroup[] = Object.entries(grupos).map(([tipo, items]) => ({
        label: (
          <Text strong style={{ fontSize: 12, color: '#8c8c8c' }}>
            {labelByType[tipo as keyof typeof labelByType]}
          </Text>
        ),
        options: items.map((item) => ({
          value: `${item.tipo}-${item.id}`,
          label: (
            <Space>
              {iconByType[item.tipo]}
              <div>
                <div>{item.titulo}</div>
                {item.subtitulo && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.subtitulo}
                  </Text>
                )}
              </div>
            </Space>
          ),
          result: item,
        })),
      }))

      setOptions(optionGroups)
    } catch (error: unknown) {
      // Ignore abort errors
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
      router.push(result.ruta)
      setSearchValue('')
      setOptions([])
    }
  }

  return (
    <AutoComplete
      style={{ width: '100%', margin: 'auto 0' }}
      options={options}
      onSearch={handleSearch}
      onSelect={handleSelect}
      value={searchValue}
      popupMatchSelectWidth={350}
    >
      <Input
        placeholder="Buscar productos, clientes, facturas..."
        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
        allowClear
        style={{ borderRadius: 8, height: 36 }}
      />
    </AutoComplete>
  )
}
