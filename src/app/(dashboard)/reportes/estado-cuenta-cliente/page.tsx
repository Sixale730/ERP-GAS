'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Space, Button, DatePicker, Select } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, SolutionOutlined, DollarOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useEstadoCuentaCliente, type EstadoCuentaMovimiento } from '@/lib/hooks/queries/useReportesCobranza'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple, formatDate } from '@/lib/utils/format'
import { getSupabaseClient } from '@/lib/supabase/client'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface ClienteOption {
  id: string
  nombre_comercial: string
  saldo_pendiente: number
}

export default function ReporteEstadoCuentaPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const [fechaRange, setFechaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().subtract(6, 'month').startOf('month'),
    dayjs().endOf('month'),
  ])

  const fechaDesde = fechaRange?.[0]?.format('YYYY-MM-DD') ?? null
  const fechaHasta = fechaRange?.[1]?.format('YYYY-MM-DD') ?? null

  // Cargar lista de clientes
  useEffect(() => {
    async function loadClientes() {
      if (!organizacion?.id) return
      const supabase = getSupabaseClient()
      const { data } = await supabase
        .schema('erp')
        .from('clientes')
        .select('id, nombre_comercial, saldo_pendiente')
        .eq('organizacion_id', organizacion.id)
        .eq('is_active', true)
        .order('nombre_comercial')

      setClientes(data || [])
      setLoadingClientes(false)
    }
    loadClientes()
  }, [organizacion?.id])

  const { data, isLoading } = useEstadoCuentaCliente(clienteId, fechaDesde, fechaHasta, organizacion?.id)

  const movimientos = data?.movimientos || []
  const resumen = data?.resumen

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId)

  const columns: ColumnsType<EstadoCuentaMovimiento> = useMemo(
    () => [
      {
        title: 'Fecha',
        dataIndex: 'fecha',
        key: 'fecha',
        width: 110,
        render: (val: string) => formatDate(val),
        sorter: (a, b) => a.fecha.localeCompare(b.fecha),
      },
      {
        title: 'Tipo',
        dataIndex: 'tipo',
        key: 'tipo',
        width: 100,
        align: 'center',
        render: (val: string) => (
          <Tag color={val === 'factura' ? 'blue' : 'green'}>{val === 'factura' ? 'Factura' : 'Pago'}</Tag>
        ),
        sorter: (a, b) => a.tipo.localeCompare(b.tipo),
      },
      {
        title: 'Folio',
        dataIndex: 'folio',
        key: 'folio',
        width: 130,
        sorter: (a, b) => a.folio.localeCompare(b.folio),
      },
      {
        title: 'Descripcion',
        dataIndex: 'descripcion',
        key: 'descripcion',
        ellipsis: true,
        sorter: (a, b) => a.descripcion.localeCompare(b.descripcion),
      },
      {
        title: 'Cargo',
        dataIndex: 'cargo',
        key: 'cargo',
        width: 140,
        align: 'right',
        render: (val: number) => (val > 0 ? formatMoneySimple(val) : ''),
        sorter: (a, b) => a.cargo - b.cargo,
      },
      {
        title: 'Abono',
        dataIndex: 'abono',
        key: 'abono',
        width: 140,
        align: 'right',
        render: (val: number) => (val > 0 ? <Text type="success">{formatMoneySimple(val)}</Text> : ''),
        sorter: (a, b) => a.abono - b.abono,
      },
      {
        title: 'Saldo',
        dataIndex: 'saldo',
        key: 'saldo',
        width: 140,
        align: 'right',
        render: (val: number) => (
          <Text strong style={{ color: val > 0 ? '#f5222d' : '#52c41a' }}>
            {formatMoneySimple(val)}
          </Text>
        ),
        sorter: (a, b) => a.saldo - b.saldo,
      },
    ],
    []
  )

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      const exportData = movimientos.map((m) => ({
        fecha_fmt: formatDate(m.fecha),
        tipo: m.tipo === 'factura' ? 'Factura' : 'Pago',
        folio: m.folio,
        descripcion: m.descripcion,
        cargo: m.cargo || '',
        abono: m.abono || '',
        saldo: m.saldo,
      }))

      await exportarExcel({
        columnas: [
          { titulo: 'Fecha', dataIndex: 'fecha_fmt' },
          { titulo: 'Tipo', dataIndex: 'tipo' },
          { titulo: 'Folio', dataIndex: 'folio' },
          { titulo: 'Descripcion', dataIndex: 'descripcion' },
          { titulo: 'Cargo', dataIndex: 'cargo', formato: 'moneda' },
          { titulo: 'Abono', dataIndex: 'abono', formato: 'moneda' },
          { titulo: 'Saldo', dataIndex: 'saldo', formato: 'moneda' },
        ],
        datos: exportData,
        nombreArchivo: `estado-cuenta-${clienteSeleccionado?.nombre_comercial || 'cliente'}-${dayjs().format('YYYY-MM-DD')}`,
        nombreHoja: 'Estado de Cuenta',
        tituloReporte: `ESTADO DE CUENTA - ${clienteSeleccionado?.nombre_comercial || ''}`,
        subtitulo:
          fechaDesde && fechaHasta
            ? `Periodo: ${dayjs(fechaDesde).format('DD/MM/YYYY')} - ${dayjs(fechaHasta).format('DD/MM/YYYY')}`
            : undefined,
        resumen: resumen
          ? [
              { etiqueta: 'Total Facturado', valor: resumen.total_facturado, formato: 'moneda' },
              { etiqueta: 'Total Pagado', valor: resumen.total_pagado, formato: 'moneda' },
              { etiqueta: 'Saldo Actual', valor: resumen.saldo_actual, formato: 'moneda' },
              { etiqueta: 'Facturas Abiertas', valor: resumen.facturas_abiertas, formato: 'numero' },
            ]
          : [],
      })
    } finally {
      setGenerandoExcel(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button>
          <Title level={2} style={{ margin: 0 }}><SolutionOutlined /> Estado de Cuenta</Title>
        </Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel} disabled={!clienteId}>
          Exportar Excel
        </Button>
      </div>

      {/* Selector de cliente */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            showSearch
            placeholder="Seleccionar cliente..."
            value={clienteId}
            onChange={setClienteId}
            loading={loadingClientes}
            style={{ width: 350 }}
            filterOption={(input, option) =>
              (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
            }
            options={clientes.map((c) => ({
              value: c.id,
              label: `${c.nombre_comercial} (Saldo: ${formatMoneySimple(c.saldo_pendiente)})`,
            }))}
            allowClear
          />
          <RangePicker
            value={fechaRange}
            onChange={(dates) => setFechaRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
            format="DD/MM/YYYY"
            placeholder={['Fecha desde', 'Fecha hasta']}
          />
        </Space>
      </Card>

      {!clienteId && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <SolutionOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <br />
            <Text type="secondary">Selecciona un cliente para ver su estado de cuenta</Text>
          </div>
        </Card>
      )}

      {clienteId && isLoading && (
        <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>
      )}

      {clienteId && !isLoading && resumen && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={6}>
              <Card><Statistic title="Total Facturado" value={resumen.total_facturado} precision={2} prefix="$" valueStyle={{ color: '#1890ff' }} /></Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card><Statistic title="Total Pagado" value={resumen.total_pagado} precision={2} prefix="$" valueStyle={{ color: '#52c41a' }} /></Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card><Statistic title="Saldo Actual" value={resumen.saldo_actual} precision={2} prefix="$" valueStyle={{ color: resumen.saldo_actual > 0 ? '#f5222d' : '#52c41a' }} /></Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card><Statistic title="Facturas Abiertas" value={resumen.facturas_abiertas} valueStyle={{ color: '#fa8c16' }} /></Card>
            </Col>
          </Row>

          <Card>
            <Table
              dataSource={movimientos}
              columns={columns}
              rowKey={(r, index) => `${r.tipo}-${r.folio}-${index}`}
              scroll={{ x: 900 }}
              pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => `${total} movimientos` }}
              locale={{ emptyText: 'No hay movimientos en el periodo' }}
            />
          </Card>
        </>
      )}
    </div>
  )
}
