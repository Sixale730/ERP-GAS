'use client'

import { useState } from 'react'
import { Table, Select, Tag, Input, Typography, Card, Space, message, Result, Button } from 'antd'
import { TeamOutlined, FilterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/lib/hooks/useAuth'
import { useLeads, useUpdateLead, type LeadStatus, type Lead } from '@/lib/hooks/queries/useLeads'

const { Title } = Typography
const { TextArea } = Input

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'nuevo', label: 'Nuevo', color: 'blue' },
  { value: 'contactado', label: 'Contactado', color: 'cyan' },
  { value: 'demo_agendada', label: 'Demo Agendada', color: 'orange' },
  { value: 'convertido', label: 'Convertido', color: 'green' },
  { value: 'descartado', label: 'Descartado', color: 'default' },
]

export default function LeadsPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth()
  const [statusFilter, setStatusFilter] = useState<LeadStatus | null>(null)
  const { data: leads, isLoading } = useLeads(statusFilter)
  const updateLead = useUpdateLead()
  const [editingNotas, setEditingNotas] = useState<string | null>(null)
  const [notasValue, setNotasValue] = useState('')

  if (!authLoading && !isSuperAdmin) {
    return (
      <Result
        status="403"
        title="Acceso denegado"
        subTitle="Solo administradores pueden acceder a esta seccion."
        extra={<Button href="/dashboard">Volver al Dashboard</Button>}
      />
    )
  }

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    try {
      await updateLead.mutateAsync({ id, status })
      message.success('Status actualizado')
    } catch {
      message.error('Error al actualizar status')
    }
  }

  const handleNotasSave = async (id: string) => {
    try {
      await updateLead.mutateAsync({ id, notas: notasValue || '' })
      setEditingNotas(null)
      message.success('Notas guardadas')
    } catch {
      message.error('Error al guardar notas')
    }
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
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      width: 180,
    },
    {
      title: 'Empresa',
      dataIndex: 'empresa',
      key: 'empresa',
      width: 160,
      render: (v: string | null) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Telefono',
      dataIndex: 'telefono',
      key: 'telefono',
      width: 130,
      render: (v: string | null) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Correo',
      dataIndex: 'correo',
      key: 'correo',
      width: 200,
      render: (v: string) => <a href={`mailto:${v}`}>{v}</a>,
    },
    {
      title: 'Giro',
      dataIndex: 'giro',
      key: 'giro',
      width: 140,
      render: (v: string | null) => v ? <Tag>{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status: LeadStatus, record: Lead) => (
        <Select
          value={status}
          size="small"
          style={{ width: 145 }}
          onChange={(val) => handleStatusChange(record.id, val)}
          loading={updateLead.isPending}
        >
          {STATUS_OPTIONS.map((opt) => (
            <Select.Option key={opt.value} value={opt.value}>
              <Tag color={opt.color} style={{ marginRight: 0 }}>{opt.label}</Tag>
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Notas',
      dataIndex: 'notas',
      key: 'notas',
      width: 250,
      render: (notas: string | null, record: Lead) => {
        if (editingNotas === record.id) {
          return (
            <TextArea
              autoFocus
              rows={2}
              value={notasValue}
              onChange={(e) => setNotasValue(e.target.value)}
              onBlur={() => handleNotasSave(record.id)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault()
                  handleNotasSave(record.id)
                }
              }}
              placeholder="Agregar notas..."
              style={{ fontSize: 12 }}
            />
          )
        }
        return (
          <div
            onClick={() => {
              setEditingNotas(record.id)
              setNotasValue(notas || '')
            }}
            style={{
              cursor: 'pointer',
              minHeight: 32,
              padding: '4px 8px',
              borderRadius: 4,
              color: notas ? undefined : '#bbb',
              fontSize: 12,
            }}
            title="Clic para editar"
          >
            {notas || 'Clic para agregar notas...'}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={2} style={{ margin: 0 }}>
          <TeamOutlined /> Leads Demo
        </Title>
        <Space>
          <FilterOutlined />
          <Select
            placeholder="Filtrar por status"
            allowClear
            style={{ width: 180 }}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val || null)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <Select.Option key={opt.value} value={opt.value}>
                <Tag color={opt.color}>{opt.label}</Tag>
              </Select.Option>
            ))}
          </Select>
        </Space>
      </div>

      <Card style={{ borderRadius: 8 }}>
        <Table
          dataSource={leads}
          columns={columns}
          rowKey="id"
          loading={isLoading || authLoading}
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} leads` }}
        />
      </Card>
    </div>
  )
}
