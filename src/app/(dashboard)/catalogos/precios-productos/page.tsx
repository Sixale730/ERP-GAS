'use client'

import { useState, useMemo } from 'react'
import { Table, Input, Select, Space, Card, Typography, Tag, Button, Popconfirm, message } from 'antd'
import { SearchOutlined, EditOutlined, DeleteOutlined, PlusOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { usePreciosProductos, useProveedores, useListasPrecios } from '@/lib/hooks/queries/useCatalogos'
import { useDeletePrecioProducto } from '@/lib/hooks/usePreciosProductos'
import PrecioProductoModal from '@/components/precios/PrecioProductoModal'
import { generarPDFReporte } from '@/lib/utils/pdf'
import dayjs from 'dayjs'

const { Title } = Typography

interface PrecioProductoRow {
  id: string
  precio_id: string | null  // ID del precio en precios_productos
  sku: string
  nombre: string
  proveedor_id: string | null
  proveedor_nombre: string | null
  precio: number | null
  precio_con_iva: number | null
  moneda: 'USD' | 'MXN' | null
  lista_nombre: string | null
  lista_id: string | null
}

export default function PreciosProductosPage() {
  const [searchText, setSearchText] = useState('')
  const [proveedorFilter, setProveedorFilter] = useState<string | null>(null)
  const [listaFilter, setListaFilter] = useState<string | null>(null)
  const [monedaFilter, setMonedaFilter] = useState<string | null>(null)

  const [generandoPDF, setGenerandoPDF] = useState(false)

  // Estado para el modal de edicion
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<PrecioProductoRow | null>(null)

  const { data: preciosData, isLoading, refetch } = usePreciosProductos()
  const { data: proveedores } = useProveedores()
  const { data: listasPrecios } = useListasPrecios()
  const deletePrecio = useDeletePrecioProducto()

  // Filtrar datos
  const filteredData = useMemo(() => {
    if (!preciosData) return []

    return preciosData.filter((row) => {
      // Filtro de busqueda por texto
      const matchesSearch =
        !searchText ||
        row.sku.toLowerCase().includes(searchText.toLowerCase()) ||
        row.nombre.toLowerCase().includes(searchText.toLowerCase())

      // Filtro por proveedor
      const matchesProveedor =
        !proveedorFilter || row.proveedor_id === proveedorFilter

      // Filtro por lista de precios
      const matchesLista = !listaFilter || row.lista_id === listaFilter

      // Filtro por moneda
      const matchesMoneda = !monedaFilter || row.moneda === monedaFilter

      return matchesSearch && matchesProveedor && matchesLista && matchesMoneda
    })
  }, [preciosData, searchText, proveedorFilter, listaFilter, monedaFilter])

  // Agrupar por proveedor para mostrar totales
  const groupedByProveedor = useMemo(() => {
    const groups: Record<string, number> = {}
    filteredData.forEach((row) => {
      const key = row.proveedor_nombre || 'Sin proveedor'
      groups[key] = (groups[key] || 0) + 1
    })
    return groups
  }, [filteredData])

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-'
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value)
  }

  // Calcular listas disponibles para un producto (para crear nuevo precio)
  const getListasDisponiblesParaProducto = (productoId: string) => {
    // Obtener todas las listas que ya tienen precio para este producto
    const listasConPrecio = (preciosData || [])
      .filter(row => row.id === productoId && row.precio_id !== null)
      .map(row => row.lista_id)

    return (listasPrecios || []).filter(l => !listasConPrecio.includes(l.id))
  }

  const handleEditPrecio = (record: PrecioProductoRow) => {
    setEditingRow(record)
    setModalOpen(true)
  }

  const handleAddPrecio = (record: PrecioProductoRow) => {
    // Crear un registro sin precio para abrir el modal en modo crear
    setEditingRow({
      ...record,
      precio_id: null,
      precio: null,
      precio_con_iva: null,
    })
    setModalOpen(true)
  }

  const handleDeletePrecio = async (record: PrecioProductoRow) => {
    if (!record.precio_id) return
    try {
      await deletePrecio.mutateAsync({ id: record.precio_id, producto_id: record.id })
      message.success('Precio eliminado')
    } catch (error: any) {
      console.error('Error deleting precio:', error)
      message.error(error.message || 'Error al eliminar precio')
    }
  }

  const handleDescargarPDF = async () => {
    setGenerandoPDF(true)
    try {
      const { data: freshData } = await refetch()
      const dataToExport = (freshData || []).filter((row) => {
        const matchesSearch =
          !searchText ||
          row.sku.toLowerCase().includes(searchText.toLowerCase()) ||
          row.nombre.toLowerCase().includes(searchText.toLowerCase())
        const matchesProveedor =
          !proveedorFilter || row.proveedor_id === proveedorFilter
        const matchesLista = !listaFilter || row.lista_id === listaFilter
        const matchesMoneda = !monedaFilter || row.moneda === monedaFilter
        return matchesSearch && matchesProveedor && matchesLista && matchesMoneda
      })

      const conPrecio = dataToExport.filter((r) => r.precio !== null).length
      const sinPrecio = dataToExport.filter((r) => r.precio === null).length

      const filtrosAplicados: string[] = []
      if (proveedorFilter) {
        const prov = proveedores?.find((p) => p.id === proveedorFilter)
        if (prov) filtrosAplicados.push(`Proveedor: ${prov.razon_social}`)
      }
      if (listaFilter) {
        const lista = listasPrecios?.find((l) => l.id === listaFilter)
        if (lista) filtrosAplicados.push(`Lista: ${lista.nombre}`)
      }
      if (monedaFilter) filtrosAplicados.push(`Moneda: ${monedaFilter}`)
      if (searchText) filtrosAplicados.push(`Busqueda: "${searchText}"`)

      generarPDFReporte({
        titulo: 'Catalogo de Precios de Productos',
        nombreArchivo: `reporte-precios-productos-${dayjs().format('YYYY-MM-DD')}`,
        filtrosAplicados: filtrosAplicados.length > 0 ? filtrosAplicados : undefined,
        estadisticas: [
          { label: 'Total registros', valor: dataToExport.length },
          { label: 'Con precio', valor: conPrecio },
          { label: 'Sin precio', valor: sinPrecio },
        ],
        columnas: [
          { titulo: 'SKU', dataIndex: 'sku', width: 80 },
          { titulo: 'Producto', dataIndex: 'nombre', width: 200 },
          { titulo: 'Proveedor', dataIndex: 'proveedor_fmt' },
          { titulo: 'Precio', dataIndex: 'precio_fmt', halign: 'right', width: 80 },
          { titulo: 'Precio c/IVA', dataIndex: 'precio_iva_fmt', halign: 'right', width: 80 },
          { titulo: 'Lista', dataIndex: 'lista_fmt', width: 100 },
        ],
        datos: dataToExport.map((row) => ({
          sku: row.sku,
          nombre: row.nombre,
          proveedor_fmt: row.proveedor_nombre || 'Sin proveedor',
          precio_fmt: row.precio !== null ? formatCurrency(row.precio) : 'Sin precio',
          precio_iva_fmt: row.precio_con_iva !== null ? formatCurrency(row.precio_con_iva) : 'Sin precio',
          lista_fmt: row.lista_nombre || 'Sin precio',
        })),
        orientacion: 'landscape',
      })
    } finally {
      setGenerandoPDF(false)
    }
  }

  const columns: ColumnsType<PrecioProductoRow> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      sorter: (a, b) => a.sku.localeCompare(b.sku),
    },
    {
      title: 'Producto',
      dataIndex: 'nombre',
      key: 'nombre',
      sorter: (a, b) => a.nombre.localeCompare(b.nombre),
    },
    {
      title: 'Proveedor',
      dataIndex: 'proveedor_nombre',
      key: 'proveedor_nombre',
      width: 200,
      render: (v) => v || <Tag color="default">Sin proveedor</Tag>,
      sorter: (a, b) =>
        (a.proveedor_nombre || '').localeCompare(b.proveedor_nombre || ''),
    },
    {
      title: 'Precio',
      dataIndex: 'precio',
      key: 'precio',
      width: 130,
      align: 'right',
      render: (v) => formatCurrency(v),
      sorter: (a, b) => (a.precio || 0) - (b.precio || 0),
    },
    {
      title: 'Precio c/IVA',
      dataIndex: 'precio_con_iva',
      key: 'precio_con_iva',
      width: 130,
      align: 'right',
      render: (v) => formatCurrency(v),
      sorter: (a, b) => (a.precio_con_iva || 0) - (b.precio_con_iva || 0),
    },
    {
      title: 'Moneda',
      dataIndex: 'moneda',
      key: 'moneda',
      width: 90,
      render: (v) =>
        v ? (
          <Tag color={v === 'USD' ? 'green' : 'blue'}>{v}</Tag>
        ) : '-',
      sorter: (a, b) => (a.moneda || '').localeCompare(b.moneda || ''),
    },
    {
      title: 'Lista',
      dataIndex: 'lista_nombre',
      key: 'lista_nombre',
      width: 150,
      render: (v) =>
        v ? (
          <Tag color="blue">{v}</Tag>
        ) : (
          <Tag color="warning">Sin precio</Tag>
        ),
      sorter: (a, b) =>
        (a.lista_nombre || '').localeCompare(b.lista_nombre || ''),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 120,
      render: (_, record) =>
        record.precio_id ? (
          <Space>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditPrecio(record)}
            />
            <Popconfirm
              title="Eliminar precio"
              description="Esta accion no se puede deshacer"
              onConfirm={() => handleDeletePrecio(record)}
              okText="Eliminar"
              cancelText="Cancelar"
            >
              <Button size="small" icon={<DeleteOutlined />} danger />
            </Popconfirm>
          </Space>
        ) : (
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleAddPrecio(record)}
            disabled={getListasDisponiblesParaProducto(record.id).length === 0}
          >
            Agregar
          </Button>
        ),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Precios de Productos
        </Title>
        <Button
          icon={<FilePdfOutlined />}
          loading={generandoPDF}
          onClick={handleDescargarPDF}
        >
          Descargar PDF
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por SKU o nombre..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Filtrar por proveedor"
            value={proveedorFilter}
            onChange={setProveedorFilter}
            style={{ width: 220 }}
            allowClear
            showSearch
            optionFilterProp="label"
            options={[
              { value: '', label: 'Todos los proveedores' },
              ...(proveedores?.map((p) => ({
                value: p.id,
                label: p.razon_social,
              })) || []),
            ]}
          />
          <Select
            placeholder="Filtrar por lista de precios"
            value={listaFilter}
            onChange={setListaFilter}
            style={{ width: 200 }}
            allowClear
            options={[
              { value: '', label: 'Todas las listas' },
              ...(listasPrecios?.map((l) => ({
                value: l.id,
                label: l.nombre,
              })) || []),
            ]}
          />
          <Select
            placeholder="Filtrar por moneda"
            value={monedaFilter}
            onChange={setMonedaFilter}
            style={{ width: 150 }}
            allowClear
            options={[
              { value: '', label: 'Todas' },
              { value: 'USD', label: 'USD' },
              { value: 'MXN', label: 'MXN' },
            ]}
          />
        </Space>

        {Object.keys(groupedByProveedor).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Space wrap size={[8, 8]}>
              {Object.entries(groupedByProveedor).map(([proveedor, count]) => (
                <Tag key={proveedor} color="processing">
                  {proveedor}: {count}
                </Tag>
              ))}
            </Space>
          </div>
        )}

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey={(record) => `${record.id}-${record.lista_id || 'sin-lista'}`}
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `${total} registros`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          size="middle"
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Modal para editar/crear precios */}
      {editingRow && (
        <PrecioProductoModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setEditingRow(null)
          }}
          productoId={editingRow.id}
          precio={
            editingRow.precio_id
              ? {
                  id: editingRow.precio_id,
                  producto_id: editingRow.id,
                  lista_precio_id: editingRow.lista_id!,
                  lista_nombre: editingRow.lista_nombre!,
                  precio: editingRow.precio!,
                  precio_con_iva: editingRow.precio_con_iva,
                  moneda: editingRow.moneda || 'USD',
                }
              : null
          }
          listasDisponibles={getListasDisponiblesParaProducto(editingRow.id)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}
