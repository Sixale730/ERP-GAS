'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Card,
  Typography,
  message,
  Progress,
  Modal,
  Collapse,
  InputNumber,
  Empty,
  Spin,
  Alert,
  Divider,
  Row,
  Col,
  Statistic,
} from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, ThunderboltOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils/format'
import dayjs from 'dayjs'
import { useAuth } from '@/lib/hooks/useAuth'
import { useMargenesCategoria } from '@/lib/hooks/useMargenesCategoria'
import { useConfiguracion } from '@/lib/hooks/useConfiguracion'
import { useOrdenesCompra, useProveedoresCompra, useAlmacenesCompra } from '@/lib/hooks/queries/useOrdenesCompra'
import type { OrdenCompraView } from '@/types/database'

const { Title, Text } = Typography

interface ProductoFaltante {
  producto_id: string
  sku: string
  nombre: string
  stock_minimo: number
  stock_maximo: number
  cantidad_actual: number
  cantidad_sugerida: number
  proveedor_id: string | null
  proveedor_nombre: string | null
  precio_unitario: number        // Precio base USD
  margen_porcentaje: number      // Margen de la categoría
  precio_final: number           // Precio con margen: precio × (1 - margen/100)
  precio_mostrado: number        // Para display: USD = precio_final, MXN = precio_final × TC
  subtotal: number               // cantidad × precio_mostrado
  categoria_id: string | null
}

interface ProveedorGroup {
  proveedor_id: string
  proveedor_nombre: string
  productos: ProductoFaltante[]
  total_estimado: number
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  borrador: { color: 'default', label: 'Borrador' },
  enviada: { color: 'processing', label: 'Enviada' },
  parcialmente_recibida: { color: 'warning', label: 'Parcial' },
  recibida: { color: 'success', label: 'Recibida' },
  cancelada: { color: 'error', label: 'Cancelada' },
}

export default function ComprasPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { erpUser } = useAuth()
  const { getMargenParaCategoria } = useMargenesCategoria()
  const { tipoCambio } = useConfiguracion()

  const [pagination, setPagination] = useState({ page: 1, pageSize: 15 })

  // React Query hooks - cached and deduplicated with server-side pagination
  const { data: ordenesResult, isLoading: loading } = useOrdenesCompra(pagination)
  const ordenes = ordenesResult?.data ?? []
  const { data: proveedores = [] } = useProveedoresCompra()
  const { data: almacenes = [] } = useAlmacenesCompra()

  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [proveedorFilter, setProveedorFilter] = useState<string | null>(null)

  // Estados para el modal de generación automática
  const [modalVisible, setModalVisible] = useState(false)
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState<string | null>(null)
  const [monedaSeleccionada, setMonedaSeleccionada] = useState<'USD' | 'MXN'>('USD')
  const [loadingFaltantes, setLoadingFaltantes] = useState(false)
  const [productosFaltantes, setProductosFaltantes] = useState<ProductoFaltante[]>([])
  const [proveedorGroups, setProveedorGroups] = useState<ProveedorGroup[]>([])
  const [generando, setGenerando] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [preciosMap, setPreciosMap] = useState<Map<string, number>>(new Map())
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState<string[]>([])
  const [proveedoresDisponibles, setProveedoresDisponibles] = useState<{id: string, nombre: string}[]>([])
  const [tipoCambioOrden, setTipoCambioOrden] = useState<number>(17.50)

  const loadProductosFaltantes = async (almacenId: string) => {
    const supabase = getSupabaseClient()
    setLoadingFaltantes(true)

    try {
      // Cargar productos con sus proveedores
      const { data: todoProductos } = await supabase
        .schema('erp')
        .from('productos')
        .select(`
          id,
          sku,
          nombre,
          stock_minimo,
          stock_maximo,
          proveedor_principal_id,
          costo_promedio,
          categoria_id,
          proveedores:proveedor_principal_id (
            id,
            razon_social
          )
        `)
        .eq('is_active', true)

      // Cargar inventario del almacén
      const { data: inventarioData } = await supabase
        .schema('erp')
        .from('inventario')
        .select('producto_id, cantidad')
        .eq('almacen_id', almacenId)

      // Cargar órdenes de compra enviadas/parcialmente recibidas con sus items
      const { data: ordenesEnTransitoData, error: ocError } = await supabase
        .schema('erp')
        .from('ordenes_compra')
        .select(`
          id,
          status,
          orden_compra_items(
            producto_id,
            cantidad_solicitada,
            cantidad_recibida
          )
        `)
        .eq('almacen_destino_id', almacenId)
        .in('status', ['enviada', 'parcialmente_recibida'])

      if (ocError) {
        console.error('Error loading OC en tránsito:', ocError)
      }

      // Cargar precios de la lista "Público General"
      const { data: preciosData } = await supabase
        .schema('erp')
        .from('precios_productos')
        .select('producto_id, precio')
        .eq('lista_precio_id', '33333333-3333-3333-3333-333333333301')

      const inventarioMap = new Map(
        inventarioData?.map((i) => [i.producto_id, Number(i.cantidad)]) || []
      )

      // Crear mapa de cantidades pendientes por producto (en tránsito)
      const cantidadesPendientesMap = new Map<string, number>()
      if (ordenesEnTransitoData) {
        ordenesEnTransitoData.forEach((orden) => {
          const items = orden.orden_compra_items as Array<{
            producto_id: string
            cantidad_solicitada: number
            cantidad_recibida: number
          }> | null
          items?.forEach((item) => {
            const pendiente = (Number(item.cantidad_solicitada) || 0) - (Number(item.cantidad_recibida) || 0)
            if (pendiente > 0) {
              const actual = cantidadesPendientesMap.get(item.producto_id) ?? 0
              cantidadesPendientesMap.set(item.producto_id, actual + pendiente)
            }
          })
        })
      }

      const nuevoPreciosMap = new Map(
        preciosData?.map((p) => [p.producto_id, Number(p.precio)]) || []
      )
      setPreciosMap(nuevoPreciosMap)

      // Usar moneda y tipo de cambio actuales para calcular precios
      const tcActual = monedaSeleccionada === 'MXN' ? tipoCambioOrden : 1

      const faltantes: ProductoFaltante[] = (todoProductos || [])
        .map((p) => {
          const cantidadActual = inventarioMap.get(p.id) ?? 0
          const cantidadEnTransito = cantidadesPendientesMap.get(p.id) ?? 0
          // Stock efectivo = actual + lo que ya viene en camino
          const stockEfectivo = cantidadActual + cantidadEnTransito
          // Sugerir: lo necesario para llegar a stock_maximo
          // (demanda OV ya está reflejada en inventario negativo, no contar doble)
          const cantidadSugerida = Math.max(p.stock_maximo - stockEfectivo, 0)
          const proveedorData = p.proveedores as unknown
          const proveedor = (Array.isArray(proveedorData) ? proveedorData[0] : proveedorData) as { id: string; razon_social: string } | null
          // Usar precio de lista (USD), fallback a costo_promedio
          const precioUnitario = nuevoPreciosMap.get(p.id) || p.costo_promedio || 0
          // Obtener margen de la categoría
          const margenPorcentaje = getMargenParaCategoria(p.categoria_id)
          // Calcular precio final (con margen aplicado)
          const precioFinal = precioUnitario * (1 - margenPorcentaje / 100)
          // Calcular precio mostrado (USD = precio_final, MXN = precio_final × TC)
          const precioMostrado = precioFinal * tcActual
          // Calcular subtotal con precio mostrado
          const subtotal = cantidadSugerida * precioMostrado

          return {
            producto_id: p.id,
            sku: p.sku,
            nombre: p.nombre,
            stock_minimo: p.stock_minimo,
            stock_maximo: p.stock_maximo,
            cantidad_actual: cantidadActual,
            cantidad_sugerida: cantidadSugerida,
            proveedor_id: proveedor?.id || null,
            proveedor_nombre: proveedor?.razon_social || null,
            precio_unitario: precioUnitario,
            margen_porcentaje: margenPorcentaje,
            precio_final: precioFinal,
            precio_mostrado: precioMostrado,
            subtotal: subtotal,
            categoria_id: p.categoria_id,
          }
        })
        .filter((p) => {
          // Mostrar si hay algo que pedir Y:
          // - Stock efectivo está bajo mínimo, O
          // - Inventario actual es negativo (urgente, aunque haya pedidos en tránsito)
          const stockEfectivo = p.cantidad_actual + (cantidadesPendientesMap.get(p.producto_id) ?? 0)
          return p.cantidad_sugerida > 0 && (stockEfectivo < p.stock_minimo || p.cantidad_actual < 0)
        })

      // Extraer proveedores únicos disponibles
      const proveedoresUnicos = new Map<string, string>()
      faltantes.forEach((p) => {
        if (p.proveedor_id && p.proveedor_nombre) {
          proveedoresUnicos.set(p.proveedor_id, p.proveedor_nombre)
        }
      })
      const listaProveedores = Array.from(proveedoresUnicos.entries()).map(([id, nombre]) => ({ id, nombre }))
      setProveedoresDisponibles(listaProveedores)
      // Seleccionar todos por defecto
      setProveedoresSeleccionados(listaProveedores.map((p) => p.id))

      setProductosFaltantes(faltantes)
      agruparPorProveedor(faltantes)
    } catch (error) {
      console.error('Error loading productos faltantes:', error)
      message.error('Error al cargar productos faltantes')
    } finally {
      setLoadingFaltantes(false)
    }
  }

  const agruparPorProveedor = (productos: ProductoFaltante[]) => {
    const grupos: Record<string, ProveedorGroup> = {}

    // Solo incluir productos con cantidad > 0
    productos.filter((p) => p.cantidad_sugerida > 0).forEach((p) => {
      const provId = p.proveedor_id || 'SIN_PROVEEDOR'
      const provNombre = p.proveedor_nombre || 'Sin proveedor asignado'

      if (!grupos[provId]) {
        grupos[provId] = {
          proveedor_id: provId,
          proveedor_nombre: provNombre,
          productos: [],
          total_estimado: 0,
        }
      }

      grupos[provId].productos.push(p)
      // Usar subtotal con margen aplicado
      grupos[provId].total_estimado += p.subtotal
    })

    // Ordenar por total estimado descendente
    const gruposArray = Object.values(grupos).sort((a, b) => b.total_estimado - a.total_estimado)
    setProveedorGroups(gruposArray)
  }

  // Recalcular precios cuando cambia moneda o tipo de cambio
  const recalcularPrecios = (productos: ProductoFaltante[], moneda: 'USD' | 'MXN', tc: number) => {
    const tcActual = moneda === 'MXN' ? tc : 1
    return productos.map(p => ({
      ...p,
      precio_mostrado: p.precio_final * tcActual,
      subtotal: p.cantidad_sugerida * p.precio_final * tcActual
    }))
  }

  const handleMonedaChange = (nuevaMoneda: 'USD' | 'MXN') => {
    setMonedaSeleccionada(nuevaMoneda)
    // Recalcular precios con la nueva moneda
    const productosRecalculados = recalcularPrecios(productosFaltantes, nuevaMoneda, tipoCambioOrden)
    setProductosFaltantes(productosRecalculados)
    agruparPorProveedor(productosRecalculados)
  }

  const handleTipoCambioChange = (nuevoTC: number) => {
    setTipoCambioOrden(nuevoTC)
    // Recalcular precios con el nuevo tipo de cambio
    const productosRecalculados = recalcularPrecios(productosFaltantes, monedaSeleccionada, nuevoTC)
    setProductosFaltantes(productosRecalculados)
    agruparPorProveedor(productosRecalculados)
  }

  const actualizarCantidad = (productoId: string, nuevaCantidad: number) => {
    const recalcular = (p: ProductoFaltante) => {
      if (p.producto_id !== productoId) return p
      // Recalcular subtotal con la nueva cantidad
      const nuevoSubtotal = nuevaCantidad * p.precio_mostrado
      return { ...p, cantidad_sugerida: nuevaCantidad, subtotal: nuevoSubtotal }
    }

    setProductosFaltantes((prev) => prev.map(recalcular))
    // Recalcular grupos
    const updated = productosFaltantes.map(recalcular)
    agruparPorProveedor(updated)
  }

  const generarOrdenes = async () => {
    if (!almacenSeleccionado) {
      message.error('Selecciona un almacen')
      return
    }

    if (proveedoresSeleccionados.length === 0) {
      message.warning('Selecciona al menos un proveedor')
      return
    }

    // Filtrar grupos: proveedor válido, seleccionado, y con productos con cantidad > 0
    const gruposValidos = proveedorGroups
      .filter((g) =>
        g.proveedor_id !== 'SIN_PROVEEDOR' &&
        proveedoresSeleccionados.includes(g.proveedor_id)
      )
      .map((g) => ({
        ...g,
        productos: g.productos.filter((p) => p.cantidad_sugerida > 0),
      }))
      .filter((g) => g.productos.length > 0)

    if (gruposValidos.length === 0) {
      message.warning('No hay productos con cantidad mayor a 0 para generar ordenes')
      return
    }

    setGenerando(true)
    const supabase = getSupabaseClient()

    try {
      const ordenesCreadas: string[] = []

      for (const grupo of gruposValidos) {
        // Generar folio
        const { data: folio, error: folioError } = await supabase
          .schema('erp')
          .rpc('generar_folio', { tipo: 'orden_compra' })

        if (folioError) throw folioError

        // Calcular totales usando subtotal con margen aplicado
        const subtotal = grupo.productos.reduce(
          (acc, p) => acc + p.subtotal,
          0
        )
        const iva = subtotal * 0.16
        const total = subtotal + iva

        // Crear orden
        const { data: orden, error: ordenError } = await supabase
          .schema('erp')
          .from('ordenes_compra')
          .insert({
            folio,
            proveedor_id: grupo.proveedor_id,
            almacen_destino_id: almacenSeleccionado,
            moneda: monedaSeleccionada,
            tipo_cambio: monedaSeleccionada === 'MXN' ? tipoCambioOrden : null,
            status: 'borrador',
            subtotal,
            iva,
            total,
            notas: 'Orden generada automaticamente por faltantes de inventario',
            creado_por: erpUser?.id || null,
            creado_por_nombre: erpUser?.nombre || erpUser?.email || null,
          })
          .select()
          .single()

        if (ordenError) throw ordenError

        // Crear items con precio y margen
        const items = grupo.productos.map((p) => ({
          orden_compra_id: orden.id,
          producto_id: p.producto_id,
          cantidad_solicitada: p.cantidad_sugerida,
          precio_unitario: p.precio_mostrado,
          descuento_porcentaje: p.margen_porcentaje, // Guardar el margen aplicado
        }))

        const { error: itemsError } = await supabase
          .schema('erp')
          .from('orden_compra_items')
          .insert(items)

        if (itemsError) throw itemsError

        ordenesCreadas.push(folio)
      }

      message.success(`Se crearon ${ordenesCreadas.length} ordenes de compra: ${ordenesCreadas.join(', ')}`)
      setModalVisible(false)
      resetModal()
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
    } catch (error: any) {
      console.error('Error generando ordenes:', error)
      message.error(error.message || 'Error al generar ordenes')
    } finally {
      setGenerando(false)
    }
  }

  const resetModal = () => {
    setAlmacenSeleccionado(null)
    setMonedaSeleccionada('USD')
    setProductosFaltantes([])
    setProveedorGroups([])
    setProveedoresSeleccionados([])
    setProveedoresDisponibles([])
    setTipoCambioOrden(tipoCambio || 17.50)
  }

  const handleOpenModal = () => {
    resetModal()
    setModalVisible(true)
  }

  const filteredOrdenes = ordenes.filter((o) => {
    const matchesSearch =
      o.folio.toLowerCase().includes(searchText.toLowerCase()) ||
      o.proveedor_nombre.toLowerCase().includes(searchText.toLowerCase())
    const matchesStatus = !statusFilter || o.status === statusFilter
    const matchesProveedor = !proveedorFilter || o.proveedor_id === proveedorFilter
    return matchesSearch && matchesStatus && matchesProveedor
  })

  const columns: ColumnsType<OrdenCompraView> = [
    {
      title: 'Folio',
      dataIndex: 'folio',
      key: 'folio',
      width: 100,
      render: (folio, record) => (
        <a onClick={() => router.push(`/compras/${record.id}`)}>{folio}</a>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha',
      key: 'fecha',
      width: 100,
      render: (fecha) => formatDate(fecha),
    },
    {
      title: 'Proveedor',
      dataIndex: 'proveedor_nombre',
      key: 'proveedor_nombre',
      ellipsis: true,
    },
    {
      title: 'Almacen Destino',
      dataIndex: 'almacen_nombre',
      key: 'almacen_nombre',
      width: 150,
    },
    {
      title: 'Moneda',
      dataIndex: 'moneda',
      key: 'moneda',
      width: 70,
      align: 'center',
      render: (moneda) => (
        <Tag color={moneda === 'USD' ? 'green' : 'blue'}>{moneda || 'USD'}</Tag>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 120,
      align: 'right',
      render: (total, record) => `$${total?.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${record.moneda || 'USD'}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = STATUS_CONFIG[status] || { color: 'default', label: status }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: 'Recepcion',
      key: 'progreso',
      width: 120,
      render: (_, record) => {
        const percent = record.total_items > 0
          ? Math.round((record.items_completos / record.total_items) * 100)
          : 0
        return (
          <Progress
            percent={percent}
            size="small"
            status={percent === 100 ? 'success' : 'active'}
            format={() => `${record.items_completos}/${record.total_items}`}
          />
        )
      },
    },
    {
      title: 'Creado',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (date: string) => formatDateTime(date),
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
    },
    {
      title: 'Última edición',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (date: string) => formatDateTime(date),
      sorter: (a, b) => dayjs(a.updated_at).unix() - dayjs(b.updated_at).unix(),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => router.push(`/compras/${record.id}`)}
        />
      ),
    },
  ]

  // Calcular totales para el modal (solo proveedores seleccionados y productos con cantidad > 0)
  // Usar subtotal con margen aplicado
  const gruposFiltrados = proveedorGroups
    .filter((g) => g.proveedor_id !== 'SIN_PROVEEDOR' && proveedoresSeleccionados.includes(g.proveedor_id))
    .map((g) => ({
      ...g,
      productos: g.productos.filter((p) => p.cantidad_sugerida > 0),
      total_estimado: g.productos
        .filter((p) => p.cantidad_sugerida > 0)
        .reduce((acc, p) => acc + p.subtotal, 0),
    }))
    .filter((g) => g.productos.length > 0)

  const totalProductosFaltantes = gruposFiltrados.reduce((acc, g) => acc + g.productos.length, 0)
  const totalOrdenesACrear = gruposFiltrados.length
  const totalEstimado = gruposFiltrados.reduce((acc, g) => acc + g.total_estimado, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>Ordenes de Compra</Title>
        <Space wrap>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={handleOpenModal}
          >
            Generar Automatica
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push('/compras/nueva')}
          >
            Nueva Orden
          </Button>
        </Space>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por folio o proveedor..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="Filtrar por status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            allowClear
            options={Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({
              value,
              label,
            }))}
          />
          <Select
            placeholder="Filtrar por proveedor"
            value={proveedorFilter}
            onChange={setProveedorFilter}
            style={{ width: 200 }}
            allowClear
            showSearch
            optionFilterProp="label"
            options={proveedores.map((p) => ({
              value: p.id,
              label: p.razon_social,
            }))}
          />
        </Space>

        <Table
          dataSource={filteredOrdenes}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: ordenesResult?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `${total} ordenes`,
            onChange: (page, pageSize) => setPagination({ page, pageSize }),
          }}
        />
      </Card>

      {/* Modal de Generación Automática */}
      <Modal
        title={
          <Space>
            <ThunderboltOutlined />
            <span>Generar Ordenes de Compra Automaticas</span>
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            Cancelar
          </Button>,
          <Button
            key="generate"
            type="primary"
            icon={<ShoppingCartOutlined />}
            onClick={generarOrdenes}
            loading={generando}
            disabled={totalOrdenesACrear === 0}
          >
            Generar {totalOrdenesACrear} {totalOrdenesACrear === 1 ? 'Orden' : 'Ordenes'}
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Selectores */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Text strong>Almacen:</Text>
              <Select
                placeholder="Selecciona un almacen"
                value={almacenSeleccionado}
                onChange={(value) => {
                  setAlmacenSeleccionado(value)
                  if (value) loadProductosFaltantes(value)
                }}
                style={{ width: '100%', marginTop: 8 }}
                options={almacenes.map((a) => ({
                  value: a.id,
                  label: a.nombre,
                }))}
              />
            </Col>
            <Col xs={24} md={monedaSeleccionada === 'MXN' ? 6 : 12}>
              <Text strong>Moneda:</Text>
              <Select
                value={monedaSeleccionada}
                onChange={handleMonedaChange}
                style={{ width: '100%', marginTop: 8 }}
                options={[
                  { value: 'USD', label: 'USD - Dólares' },
                  { value: 'MXN', label: 'MXN - Pesos' },
                ]}
              />
            </Col>
            {monedaSeleccionada === 'MXN' && (
              <Col xs={24} md={6}>
                <Text strong>Tipo de Cambio:</Text>
                <InputNumber
                  value={tipoCambioOrden}
                  onChange={(v) => {
                    // Solo actualizar si el valor no es null (permite borrar para escribir)
                    if (v !== null) {
                      handleTipoCambioChange(v)
                    }
                  }}
                  onBlur={() => {
                    // Aplicar fallback solo cuando se pierde el foco y está vacío o inválido
                    if (!tipoCambioOrden || tipoCambioOrden < 0.01) {
                      handleTipoCambioChange(tipoCambio || 17.50)
                    }
                  }}
                  min={0.01}
                  step={0.0001}
                  precision={4}
                  prefix="$"
                  style={{ width: '100%', marginTop: 8 }}
                />
              </Col>
            )}
          </Row>

          {/* Selector de proveedores (solo si hay productos faltantes) */}
          {proveedoresDisponibles.length > 0 && (
            <Row>
              <Col xs={24}>
                <Text strong>Proveedores a incluir:</Text>
                <Select
                  mode="multiple"
                  placeholder="Selecciona los proveedores"
                  value={proveedoresSeleccionados}
                  onChange={setProveedoresSeleccionados}
                  style={{ width: '100%', marginTop: 8 }}
                  options={proveedoresDisponibles.map((p) => ({
                    value: p.id,
                    label: p.nombre,
                  }))}
                  maxTagCount="responsive"
                />
              </Col>
            </Row>
          )}

          <Divider style={{ margin: '16px 0' }} />

          {/* Contenido */}
          {!almacenSeleccionado ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Selecciona un almacen para ver los productos faltantes"
            />
          ) : loadingFaltantes ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Analizando inventario...</div>
            </div>
          ) : productosFaltantes.length === 0 ? (
            <Alert
              type="success"
              showIcon
              message="Inventario completo"
              description="No hay productos por debajo del stock minimo en este almacen."
            />
          ) : (
            <>
              {/* Resumen */}
              <Row gutter={16}>
                <Col xs={8}>
                  <Statistic
                    title="Productos Faltantes"
                    value={totalProductosFaltantes}
                    suffix="productos"
                  />
                </Col>
                <Col xs={8}>
                  <Statistic
                    title="Ordenes a Crear"
                    value={totalOrdenesACrear}
                    suffix="ordenes"
                  />
                </Col>
                <Col xs={8}>
                  <Statistic
                    title="Total Estimado"
                    value={totalEstimado}
                    precision={2}
                    prefix="$"
                    suffix={monedaSeleccionada}
                  />
                </Col>
              </Row>

              <Divider style={{ margin: '16px 0' }} />

              {/* Lista por proveedor - filtrada por selección */}
              <Collapse
                defaultActiveKey={proveedorGroups.slice(0, 1).map((g) => g.proveedor_id)}
                items={proveedorGroups
                  .filter((g) =>
                    g.proveedor_id === 'SIN_PROVEEDOR' ||
                    proveedoresSeleccionados.includes(g.proveedor_id)
                  )
                  .map((grupo) => {
                    const productosConCantidad = grupo.productos.filter((p) => p.cantidad_sugerida > 0)
                    // Usar subtotal con margen aplicado
                    const totalGrupo = productosConCantidad.reduce(
                      (acc, p) => acc + p.subtotal,
                      0
                    )
                    return {
                      key: grupo.proveedor_id,
                      label: (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingRight: 16 }}>
                          <Space>
                            <Tag color={grupo.proveedor_id === 'SIN_PROVEEDOR' ? 'red' : productosConCantidad.length === 0 ? 'default' : 'blue'}>
                              {productosConCantidad.length} productos
                            </Tag>
                            <span>{grupo.proveedor_nombre}</span>
                          </Space>
                          <Text strong style={{ color: productosConCantidad.length === 0 ? '#999' : undefined }}>
                            ${totalGrupo.toLocaleString('en-US', { minimumFractionDigits: 2 })} {monedaSeleccionada}
                          </Text>
                        </div>
                      ),
                      children: (
                        <>
                          {grupo.proveedor_id === 'SIN_PROVEEDOR' && (
                            <Alert
                              type="warning"
                              showIcon
                              message="Estos productos no tienen proveedor asignado y no se incluiran en ninguna orden."
                              style={{ marginBottom: 16 }}
                            />
                          )}
                          <Table
                            dataSource={grupo.productos}
                            rowKey="producto_id"
                            size="small"
                            pagination={false}
                            columns={[
                              {
                                title: 'SKU',
                                dataIndex: 'sku',
                                width: 80,
                              },
                              {
                                title: 'Producto',
                                dataIndex: 'nombre',
                                ellipsis: true,
                              },
                              {
                                title: 'Actual',
                                dataIndex: 'cantidad_actual',
                                width: 60,
                                align: 'center',
                                render: (val) => (
                                  <Tag color={val < 0 ? 'red' : 'orange'}>{val}</Tag>
                                ),
                              },
                              {
                                title: 'Min/Max',
                                width: 70,
                                align: 'center',
                                render: (_, record) => (
                                  <Text type="secondary">{record.stock_minimo}/{record.stock_maximo}</Text>
                                ),
                              },
                              {
                                title: 'A Pedir',
                                dataIndex: 'cantidad_sugerida',
                                width: 90,
                                render: (val, record) => (
                                  <InputNumber
                                    min={0}
                                    value={val}
                                    onChange={(v) => actualizarCantidad(record.producto_id, v || 0)}
                                    size="small"
                                    style={{ width: '100%' }}
                                  />
                                ),
                              },
                              {
                                title: 'Precio Unitario',
                                dataIndex: 'precio_mostrado',
                                width: 120,
                                align: 'right',
                                render: (val) => `$${val?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                              },
                              {
                                title: 'Subtotal',
                                width: 120,
                                align: 'right',
                                render: (_, record) => (
                                  <Text strong style={{ color: record.cantidad_sugerida === 0 ? '#999' : undefined }}>
                                    ${record.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </Text>
                                ),
                              },
                            ]}
                          />
                        </>
                      ),
                    }
                  })}
              />
            </>
          )}
        </Space>
      </Modal>
    </div>
  )
}
