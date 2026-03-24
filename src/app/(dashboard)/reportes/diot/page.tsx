'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Table, Typography, Spin, Row, Col, Statistic, Space, Button, Select } from 'antd'
import { ArrowLeftOutlined, FileExcelOutlined, FileProtectOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useDIOT, type DIOTRow } from '@/lib/hooks/queries/useReportesFiscal'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportarExcel } from '@/lib/utils/excel'
import { formatMoneySimple } from '@/lib/utils/format'
import dayjs from 'dayjs'

const { Title } = Typography

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function ReporteDIOTPage() {
  const router = useRouter()
  const { organizacion } = useAuth()
  const [mes, setMes] = useState(dayjs().month() + 1)
  const [anio, setAnio] = useState(dayjs().year())
  const [generandoExcel, setGenerandoExcel] = useState(false)

  const { data: rows = [], isLoading } = useDIOT(mes, anio, organizacion?.id)

  const stats = useMemo(() => {
    const numProveedores = rows.length
    const totalOps = rows.reduce((s, r) => s + r.total, 0)
    const totalIVA = rows.reduce((s, r) => s + r.iva_16, 0)
    return { numProveedores, totalOps, totalIVA }
  }, [rows])

  const columns: ColumnsType<DIOTRow> = useMemo(() => [
    { title: 'RFC Proveedor', dataIndex: 'proveedor_rfc', key: 'proveedor_rfc', width: 150 },
    { title: 'Razon Social', dataIndex: 'proveedor_nombre', key: 'proveedor_nombre', ellipsis: true },
    { title: 'Tipo Op.', dataIndex: 'tipo_operacion', key: 'tipo_operacion', width: 90, align: 'center' },
    { title: 'Base Gravable 16%', dataIndex: 'base_16', key: 'base_16', width: 160, align: 'right', render: (v: number) => formatMoneySimple(v) },
    { title: 'IVA 16%', dataIndex: 'iva_16', key: 'iva_16', width: 130, align: 'right', render: (v: number) => formatMoneySimple(v) },
    { title: 'Total', dataIndex: 'total', key: 'total', width: 150, align: 'right', render: (v: number) => formatMoneySimple(v), sorter: (a, b) => a.total - b.total, defaultSortOrder: 'descend' },
  ], [])

  const handleExportarExcel = async () => {
    setGenerandoExcel(true)
    try {
      await exportarExcel({
        columnas: [
          { titulo: 'RFC Proveedor', dataIndex: 'proveedor_rfc' },
          { titulo: 'Razon Social', dataIndex: 'proveedor_nombre' },
          { titulo: 'Tipo Operacion', dataIndex: 'tipo_operacion' },
          { titulo: 'Base Gravable 16%', dataIndex: 'base_16', formato: 'moneda' },
          { titulo: 'IVA 16%', dataIndex: 'iva_16', formato: 'moneda' },
          { titulo: 'Total', dataIndex: 'total', formato: 'moneda' },
        ],
        datos: rows as unknown as Record<string, unknown>[],
        nombreArchivo: `diot-${anio}-${String(mes).padStart(2, '0')}`,
        nombreHoja: 'DIOT',
        tituloReporte: 'DECLARACION INFORMATIVA DE OPERACIONES CON TERCEROS (DIOT)',
        subtitulo: `Periodo: ${MESES[mes - 1]} ${anio}`,
        resumen: [
          { etiqueta: 'Num Proveedores', valor: stats.numProveedores, formato: 'numero' },
          { etiqueta: 'Total Operaciones', valor: stats.totalOps, formato: 'moneda' },
          { etiqueta: 'IVA Total', valor: stats.totalIVA, formato: 'moneda' },
        ],
      })
    } finally { setGenerandoExcel(false) }
  }

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/reportes')}>Volver</Button><Title level={2} style={{ margin: 0 }}><FileProtectOutlined /> DIOT</Title></Space>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportarExcel} loading={generandoExcel}>Exportar Excel</Button>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card><Statistic title="Proveedores" value={stats.numProveedores} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Total Operaciones" value={stats.totalOps} precision={2} prefix="$" valueStyle={{ color: '#eb2f96' }} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="IVA Total" value={stats.totalIVA} precision={2} prefix="$" valueStyle={{ color: '#f5222d' }} /></Card></Col>
      </Row>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select value={mes} onChange={setMes} style={{ width: 150 }} options={MESES.map((m, i) => ({ value: i + 1, label: m }))} />
          <Select value={anio} onChange={setAnio} style={{ width: 100 }} options={Array.from({ length: 5 }, (_, i) => ({ value: dayjs().year() - i, label: String(dayjs().year() - i) }))} />
        </Space>
        <Table dataSource={rows} columns={columns} rowKey="proveedor_rfc" scroll={{ x: 800 }} pagination={{ pageSize: 50, showTotal: (t) => `${t} proveedores` }} />
      </Card>
    </div>
  )
}
