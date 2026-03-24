'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Select, Space, Button
} from 'antd'
import {
  ArrowLeftOutlined,
  FileExcelOutlined,
  ExclamationCircleOutlined,
  DollarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useCarteraVencida, type CarteraVencidaRow } from '@/lib/hooks/queries/useReportesNuevos'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatDate, formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography

function getDiasVencidaTag(dias: number) {
  if (dias > 60) return <Tag color="red">{dias} dias</Tag>
  if (dias > 30) return <Tag color="orange">{dias} dias</Tag>
  return <Tag color="gold">{dias} dias</Tag>
}

export default function ReporteCarteraVencidaPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [rangoDias, setRangoDias] = useState<string | null>(null)
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const { data: cartera = [], isLoading, refetch } = useCarteraVencida(organizacion?.id)

  const filteredData = useMemo(() => {
    if (!rangoDias) return cartera
    switch (rangoDias) {
      case '1-30':
        return cartera.filter(r => r.dias_vencida >= 1 && r.dias_vencida <= 30)
      case '31-60':
        return cartera.filter(r => r.dias_vencida >= 31 && r.dias_vencida <= 60)
      case '61-90':
        return cartera.filter(r => r.dias_vencida >= 61 && r.dias_vencida <= 90)
      case '90+':
        return cartera.filter(r => r.dias_vencida > 90)
      default:
        return cartera
    }
  }, [cartera, rangoDias])

  const stats = useMemo(() => {
    const totalVencido = filteredData.reduce((sum, r) => sum + (r.saldo || 0), 0)
    const numFacturas = filteredData.length
    const clientesUnicos = new Set(filteredData.map(r => r.cliente_nombre)).size
    return { totalVencido, numFacturas, clientesUnicos }
  }, [filteredData])

  const columns: ColumnsType<CarteraVencidaRow> = useMemo(() => [
    {
      title: 'Folio',
      dataIndex: 'folio',
      key: 'folio',
      width: 120,
      sorter: (a, b) => (a.folio || '').localeCompare(b.folio || ''),
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente_nombre',
      key: 'cliente_nombre',
      ellipsis: true,
      sorter: (a, b) => (a.cliente_nombre || '').localeCompare(b.cliente_nombre || ''),
    },
    {
      title: 'Sucursal',
      dataIndex: 'sucursal_nombre',
      key: 'sucursal_nombre',
      width: 130,
      ellipsis: true,
      render: (val: string | null) => val || '-',
      sorter: (a, b) => (a.sucursal_nombre || '').localeCompare(b.sucursal_nombre || ''),
    },
    {
      title: 'Productos',
      dataIndex: 'productos_desc',
      key: 'productos_desc',
      width: 200,
      ellipsis: true,
      render: (val: string | null) => val || '-',
      sorter: (a, b) => (a.productos_desc || '').localeCompare(b.productos_desc || ''),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 140,
      align: 'right',
      render: (val: number) => formatMoneySimple(val),
      sorter: (a, b) => (a.total || 0) - (b.total || 0),
    },
    {
      title: 'Saldo',
      dataIndex: 'saldo',
      key: 'saldo',
      width: 140,
      align: 'right',
      render: (val: number) => (
        <span style={{ color: '#f5222d', fontWeight: 600 }}>
          {formatMoneySimple(val)}
        </span>
      ),
      sorter: (a, b) => (a.saldo || 0) - (b.saldo || 0),
    },
    {
      title: 'Dias Vencida',
      dataIndex: 'dias_vencida',
      key: 'dias_vencida',
      width: 130,
      align: 'center',
      render: (val: number) => getDiasVencidaTag(val),
      sorter: (a, b) => (a.dias_vencida || 0) - (b.dias_vencida || 0),
    },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const { data: freshData } = await refetch()
      const fresh = freshData || []

      let toExport = fresh
      if (rangoDias) {
        switch (rangoDias) {
          case '1-30':
            toExport = fresh.filter(r => r.dias_vencida >= 1 && r.dias_vencida <= 30)
            break
          case '31-60':
            toExport = fresh.filter(r => r.dias_vencida >= 31 && r.dias_vencida <= 60)
            break
          case '61-90':
            toExport = fresh.filter(r => r.dias_vencida >= 61 && r.dias_vencida <= 90)
            break
          case '90+':
            toExport = fresh.filter(r => r.dias_vencida > 90)
            break
        }
      }

      const exportData = toExport.map(item => ({
        ...item,
        fecha_fmt: formatDate(item.fecha),
      }))

      const totalVencido = exportData.reduce((sum, i) => sum + (i.saldo || 0), 0)
      const clientesUnicos = new Set(exportData.map(r => r.cliente_nombre)).size

      await exportarExcel({
        columnas: [
          { titulo: 'Folio', dataIndex: 'folio' },
          { titulo: 'Fecha', dataIndex: 'fecha_fmt' },
          { titulo: 'Cliente', dataIndex: 'cliente_nombre' },
          { titulo: 'Sucursal', dataIndex: 'sucursal_nombre' },
          { titulo: 'Productos', dataIndex: 'productos_desc' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
          { titulo: 'Saldo', dataIndex: 'saldo', formato: 'moneda' },
          { titulo: 'Dias Vencida', dataIndex: 'dias_vencida', formato: 'numero' },
        ],
        datos: exportData,
        nombreArchivo: `reporte-cartera-vencida-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Cartera Vencida',
        tituloReporte: 'REPORTE DE CARTERA VENCIDA',
        resumen: [
          { etiqueta: 'Total Vencido', valor: totalVencido, formato: 'moneda' },
          { etiqueta: 'Facturas Vencidas', valor: exportData.length, formato: 'numero' },
          { etiqueta: 'Clientes con Deuda', valor: clientesUnicos, formato: 'numero' },
        ],
      })
    } finally {
      setGenerandoExcel(false)
    }
  }

  if (isLoading) {
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
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>
            Volver
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            <ExclamationCircleOutlined /> Cartera Vencida
          </Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>
          Exportar Excel
        </Button>
      </div>

      {/* Estadisticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Vencido"
              value={stats.totalVencido}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Facturas Vencidas"
              value={stats.numFacturas}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Clientes con Deuda"
              value={stats.clientesUnicos}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabla */}
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="Rango de dias"
            value={rangoDias}
            onChange={setRangoDias}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: '1-30', label: '1 - 30 dias' },
              { value: '31-60', label: '31 - 60 dias' },
              { value: '61-90', label: '61 - 90 dias' },
              { value: '90+', label: 'Mas de 90 dias' },
            ]}
          />
        </Space>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1030 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} registros`,
          }}
          locale={{ emptyText: 'No hay facturas vencidas' }}
        />
      </Card>
    </div>
  )
}
