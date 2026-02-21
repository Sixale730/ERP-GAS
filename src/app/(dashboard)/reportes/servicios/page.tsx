'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Input, Select, Space, Button, DatePicker
} from 'antd'
import {
  ToolOutlined,
  HistoryOutlined,
  CalendarOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  FilePdfOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useReporteServicios, useMovimientosServicios } from '@/lib/hooks/queries/useServicios'
import MovimientosTable from '@/components/movimientos/MovimientosTable'
import { generarPDFReporte } from '@/lib/utils/pdf'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface ServicioRow {
  id: string
  sku: string
  nombre: string
  categoria_nombre: string | null
  unidad_medida: string
  total_usado: number
  usado_mes: number
  ultima_fecha_uso: string | null
}

export default function ReporteServiciosPage() {
  const router = useRouter()
  const [searchText, setSearchText] = useState('')
  const [servicioFilter, setServicioFilter] = useState<string | undefined>(undefined)

  const [generandoPDF, setGenerandoPDF] = useState(false)

  // React Query hooks
  const { data: reporte, isLoading: loadingReporte, refetch } = useReporteServicios()
  const { data: movimientos = [], isLoading: loadingMovimientos } = useMovimientosServicios(servicioFilter, 100)

  const servicios = reporte?.servicios || []
  const stats = reporte?.stats || {
    totalServicios: 0,
    serviciosUsadosMes: 0,
    totalUnidadesConsumidas: 0,
  }

  // Filtrar servicios por búsqueda
  const filteredServicios = useMemo(() =>
    servicios.filter(
      (s) =>
        s.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
        s.sku.toLowerCase().includes(searchText.toLowerCase())
    ),
    [servicios, searchText]
  )

  const columns: ColumnsType<ServicioRow> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 100,
    },
    {
      title: 'Servicio',
      dataIndex: 'nombre',
      key: 'nombre',
      sorter: (a, b) => a.nombre.localeCompare(b.nombre),
      render: (nombre, record) => (
        <Button type="link" onClick={() => router.push(`/productos/${record.id}`)} style={{ padding: 0 }}>
          {nombre}
        </Button>
      ),
    },
    {
      title: 'Categoría',
      dataIndex: 'categoria_nombre',
      key: 'categoria_nombre',
      width: 150,
      render: (cat) => cat || <Text type="secondary">Sin categoría</Text>,
    },
    {
      title: 'Unidad',
      dataIndex: 'unidad_medida',
      key: 'unidad_medida',
      width: 80,
    },
    {
      title: 'Total Usado',
      dataIndex: 'total_usado',
      key: 'total_usado',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.total_usado - b.total_usado,
      render: (total, record) => (
        <Text strong>{total} {record.unidad_medida}</Text>
      ),
    },
    {
      title: 'Usado Este Mes',
      dataIndex: 'usado_mes',
      key: 'usado_mes',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.usado_mes - b.usado_mes,
      render: (usado, record) => (
        <Tag color={usado > 0 ? 'blue' : 'default'}>
          {usado} {record.unidad_medida}
        </Tag>
      ),
    },
    {
      title: 'Última Fecha de Uso',
      dataIndex: 'ultima_fecha_uso',
      key: 'ultima_fecha_uso',
      width: 150,
      sorter: (a, b) => {
        if (!a.ultima_fecha_uso) return 1
        if (!b.ultima_fecha_uso) return -1
        return new Date(b.ultima_fecha_uso).getTime() - new Date(a.ultima_fecha_uso).getTime()
      },
      render: (fecha) =>
        fecha ? (
          dayjs(fecha).format('DD/MM/YYYY HH:mm')
        ) : (
          <Text type="secondary">Sin uso registrado</Text>
        ),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => setServicioFilter(record.id === servicioFilter ? undefined : record.id)}
        >
          {record.id === servicioFilter ? 'Ver todos' : 'Ver movimientos'}
        </Button>
      ),
    },
  ]

  const handleDescargarPDF = async () => {
    setGenerandoPDF(true)
    try {
      const { data: freshReporte } = await refetch()

      const freshServicios = freshReporte?.servicios || []
      const freshStats = freshReporte?.stats || {
        totalServicios: 0,
        serviciosUsadosMes: 0,
        totalUnidadesConsumidas: 0,
      }

      // Aplicar filtro de búsqueda al dato fresco
      const freshFiltered = freshServicios.filter(
        (s) =>
          s.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
          s.sku.toLowerCase().includes(searchText.toLowerCase())
      )

      await generarPDFReporte({
        titulo: 'Reporte de Servicios',
        nombreArchivo: `reporte-servicios-${dayjs().format('YYYY-MM-DD')}`,
        estadisticas: [
          { label: 'Total Servicios', valor: freshStats.totalServicios },
          { label: 'Usados Este Mes', valor: freshStats.serviciosUsadosMes },
          { label: 'Unidades Consumidas', valor: freshStats.totalUnidadesConsumidas },
        ],
        columnas: [
          { titulo: 'SKU', dataIndex: 'sku', width: 100 },
          { titulo: 'Servicio', dataIndex: 'nombre' },
          { titulo: 'Categoria', dataIndex: 'categoria_nombre', width: 150 },
          { titulo: 'Unidad', dataIndex: 'unidad_medida', width: 80 },
          { titulo: 'Total Usado', dataIndex: 'total_usado', width: 100, halign: 'right' },
          { titulo: 'Usado Mes', dataIndex: 'usado_mes', width: 100, halign: 'right' },
          { titulo: 'Ultimo Uso', dataIndex: 'ultima_fecha_uso_fmt', width: 130 },
        ],
        datos: freshFiltered.map(s => ({
          ...s,
          categoria_nombre: s.categoria_nombre || 'Sin categoria',
          ultima_fecha_uso_fmt: s.ultima_fecha_uso ? dayjs(s.ultima_fecha_uso).format('DD/MM/YYYY HH:mm') : 'Sin uso',
        })),
      })
    } finally {
      setGenerandoPDF(false)
    }
  }

  if (loadingReporte) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            <ToolOutlined /> Reporte de Servicios
          </Title>
        </Space>
        <Button type="primary" icon={<FilePdfOutlined />} onClick={handleDescargarPDF} loading={generandoPDF}>
          Descargar PDF
        </Button>
      </div>

      {/* Estadísticas */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Servicios Registrados"
              value={stats.totalServicios}
              prefix={<ToolOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Servicios Usados Este Mes"
              value={stats.serviciosUsadosMes}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: stats.serviciosUsadosMes > 0 ? '#52c41a' : '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Unidades Consumidas"
              value={stats.totalUnidadesConsumidas}
              prefix={<HistoryOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabla de Servicios */}
      <Card
        title={
          <Space>
            <ToolOutlined />
            <span>Servicios con Uso</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Buscar por SKU o nombre..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: '100%', maxWidth: 250 }}
            allowClear
          />
        </Space>

        <Table
          dataSource={filteredServicios}
          columns={columns}
          rowKey="id"
          loading={loadingReporte}
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} servicios`,
          }}
          rowClassName={(record) => record.id === servicioFilter ? 'ant-table-row-selected' : ''}
          locale={{ emptyText: 'No hay servicios registrados' }}
        />
      </Card>

      {/* Historial de Movimientos */}
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <span>
              Historial de Movimientos
              {servicioFilter && (
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  Filtrado por servicio
                </Tag>
              )}
            </span>
          </Space>
        }
        extra={
          servicioFilter && (
            <Button type="link" onClick={() => setServicioFilter(undefined)}>
              Ver todos los movimientos
            </Button>
          )
        }
      >
        <MovimientosTable
          data={movimientos}
          loading={loadingMovimientos}
          compact={false}
          showPagination={true}
        />
        {movimientos.length === 0 && !loadingMovimientos && (
          <div style={{ textAlign: 'center', padding: 24, color: '#8c8c8c' }}>
            No hay movimientos registrados para servicios
          </div>
        )}
      </Card>
    </div>
  )
}
