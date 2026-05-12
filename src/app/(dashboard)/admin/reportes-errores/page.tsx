'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Select, Tag, Typography, Space, Result, Button, Input } from 'antd'
import { BugOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  useReportesErrores,
  type ReporteStatus,
  type ReporteError,
} from '@/lib/hooks/queries/useReportesErrores'
import { ResponsiveListTable } from '@/components/common/ResponsiveListTable'

const { Title, Text } = Typography

const STATUS_META: Record<ReporteStatus, { label: string; color: string }> = {
  nuevo:        { label: 'Nuevo',        color: 'red' },
  en_revision:  { label: 'En revisión',  color: 'orange' },
  resuelto:     { label: 'Resuelto',     color: 'green' },
  descartado:   { label: 'Descartado',   color: 'default' },
}

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: 'default',
  normal: 'blue',
  alta: 'orange',
  critica: 'red',
}

const ORIGEN_LABEL: Record<string, string> = {
  manual: 'Manual',
  boundary: 'Crash UI',
  window_error: 'JS error',
  unhandled_rejection: 'Promesa',
  api: 'API',
}

export default function ReportesErroresAdminPage() {
  const { isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<ReporteStatus | null>('nuevo')
  const [search, setSearch] = useState('')
  const { data: reportes, isLoading } = useReportesErrores(statusFilter)

  const filtered = useMemo(() => {
    if (!reportes) return []
    if (!search.trim()) return reportes
    const s = search.toLowerCase()
    return reportes.filter((r) =>
      [r.descripcion_usuario, r.usuario_email, r.usuario_nombre, r.ruta, r.mensaje_tecnico]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    )
  }, [reportes, search])

  if (!authLoading && !isAdmin) {
    return (
      <Result
        status="403"
        title="Acceso denegado"
        subTitle="Solo administradores pueden acceder a esta sección."
        extra={<Button onClick={() => router.push('/dashboard')}>Volver al Dashboard</Button>}
      />
    )
  }

  const columns = [
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('DD/MM/YY HH:mm'),
    },
    {
      title: 'Usuario',
      key: 'usuario',
      width: 180,
      ellipsis: true,
      render: (_: unknown, r: ReporteError) => (
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <div style={{ fontWeight: 500 }}>{r.usuario_nombre ?? '—'}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.usuario_email ?? '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Ruta',
      dataIndex: 'ruta',
      key: 'ruta',
      width: 200,
      ellipsis: true,
      render: (v: string | null) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—',
    },
    {
      title: 'Descripción',
      dataIndex: 'descripcion_usuario',
      key: 'descripcion',
      width: 320,
      ellipsis: true,
    },
    {
      title: 'Origen',
      dataIndex: 'origen',
      key: 'origen',
      width: 110,
      render: (v: string) => <Tag>{ORIGEN_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Prioridad',
      dataIndex: 'prioridad',
      key: 'prioridad',
      width: 100,
      render: (v: string) => <Tag color={PRIORIDAD_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (v: ReporteStatus) => (
        <Tag color={STATUS_META[v].color}>{STATUS_META[v].label}</Tag>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={2} style={{ margin: 0 }}>
          <BugOutlined /> Reportes de Error
        </Title>
        <Space wrap>
          <Input
            placeholder="Buscar..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
          <FilterOutlined />
          <Select
            placeholder="Todos"
            allowClear
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val || null)}
          >
            {(Object.keys(STATUS_META) as ReporteStatus[]).map((s) => (
              <Select.Option key={s} value={s}>
                <Tag color={STATUS_META[s].color} style={{ marginRight: 0 }}>
                  {STATUS_META[s].label}
                </Tag>
              </Select.Option>
            ))}
          </Select>
        </Space>
      </div>

      <Card style={{ borderRadius: 8 }}>
        <ResponsiveListTable<ReporteError>
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={isLoading || authLoading}
          size="small"
          scroll={{ x: 1160 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} reportes` }}
          onRow={(record) => ({
            onClick: () => router.push(`/admin/reportes-errores/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          onMobileItemClick={(record) => router.push(`/admin/reportes-errores/${record.id}`)}
          mobileRender={(r) => (
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tag color={STATUS_META[r.status].color}>{STATUS_META[r.status].label}</Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {dayjs(r.created_at).format('DD/MM/YY HH:mm')}
                </Text>
              </div>
              <div style={{ fontWeight: 500, marginTop: 6 }}>{r.usuario_nombre ?? r.usuario_email ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {r.descripcion_usuario.slice(0, 120)}
                {r.descripcion_usuario.length > 120 ? '...' : ''}
              </div>
              {r.ruta && (
                <Text code style={{ fontSize: 10, display: 'block', marginTop: 4 }}>{r.ruta}</Text>
              )}
            </div>
          )}
        />
      </Card>
    </div>
  )
}
