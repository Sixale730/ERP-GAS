'use client'

import { useState } from 'react'
import { Input, List, Tag, Empty, Spin } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useProductosPOS } from '@/lib/hooks/queries/usePOS'
import type { ProductoPOS } from '@/types/pos'

interface ProductSearchProps {
  listaPrecioId?: string | null
  onSelectProduct: (product: ProductoPOS) => void
}

export default function ProductSearch({ listaPrecioId, onSelectProduct }: ProductSearchProps) {
  const [search, setSearch] = useState('')
  const { data: productos, isLoading } = useProductosPOS(
    search || undefined,
    listaPrecioId || undefined
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Input
        data-pos-input
        prefix={<SearchOutlined />}
        placeholder="Buscar producto por nombre o SKU..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
        size="large"
        style={{ marginBottom: 8 }}
      />

      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : !productos?.length ? (
          <Empty description={search ? 'Sin resultados' : 'Busca un producto'} />
        ) : (
          <List
            dataSource={productos}
            renderItem={(item) => (
              <List.Item
                onClick={() => onSelectProduct(item)}
                style={{
                  cursor: 'pointer',
                  padding: '12px 16px',
                  borderRadius: 8,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f5ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <List.Item.Meta
                  title={
                    <span>
                      <Tag color="blue" style={{ fontSize: 12 }}>{item.sku}</Tag>
                      {item.nombre}
                    </span>
                  }
                  description={
                    <span>
                      {item.unidad_medida}
                      {item.codigo_barras && <span style={{ marginLeft: 8, color: '#999' }}>CB: {item.codigo_barras}</span>}
                    </span>
                  }
                />
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1890ff' }}>
                  ${item.precio_con_iva?.toFixed(2) ?? item.precio?.toFixed(2) ?? '—'}
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  )
}
