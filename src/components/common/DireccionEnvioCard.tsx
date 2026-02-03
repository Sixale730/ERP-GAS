'use client'

import { Card, Tag, Typography, Space, Button, Popconfirm } from 'antd'
import { EnvironmentOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled, UserOutlined, PhoneOutlined } from '@ant-design/icons'
import type { DireccionEnvio } from '@/types/database'
import { formatDireccionCorta } from '@/lib/hooks/useDireccionesEnvio'

const { Text } = Typography

interface DireccionEnvioCardProps {
  direccion: DireccionEnvio
  onEdit?: (direccion: DireccionEnvio) => void
  onDelete?: (direccion: DireccionEnvio) => void
  onSetDefault?: (direccion: DireccionEnvio) => void
  showActions?: boolean
  compact?: boolean
}

export default function DireccionEnvioCard({
  direccion,
  onEdit,
  onDelete,
  onSetDefault,
  showActions = true,
  compact = false,
}: DireccionEnvioCardProps) {
  const addressLine = formatDireccionCorta(direccion)
  const locationLine = [
    direccion.ciudad,
    direccion.estado,
    direccion.codigo_postal ? `C.P. ${direccion.codigo_postal}` : null,
  ].filter(Boolean).join(', ')

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0' }}>
        <EnvironmentOutlined style={{ color: '#1890ff', marginTop: 4 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text strong>{direccion.alias}</Text>
            {direccion.is_default && <Tag color="blue" style={{ margin: 0 }}>Predeterminada</Tag>}
          </div>
          <Text type="secondary" style={{ fontSize: 13 }}>{addressLine}</Text>
          {locationLine && <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>{locationLine}</Text>}
        </div>
      </div>
    )
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 8 }}
      styles={{ body: { padding: 12 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <EnvironmentOutlined style={{ color: '#1890ff' }} />
            <Text strong>{direccion.alias}</Text>
            {direccion.is_default && <Tag color="blue" style={{ margin: 0 }}>Predeterminada</Tag>}
          </div>

          {addressLine && (
            <Text style={{ display: 'block', marginLeft: 22, fontSize: 13 }}>
              {addressLine}
            </Text>
          )}

          {locationLine && (
            <Text type="secondary" style={{ display: 'block', marginLeft: 22, fontSize: 13 }}>
              {locationLine}
            </Text>
          )}

          {direccion.referencias && (
            <Text type="secondary" italic style={{ display: 'block', marginLeft: 22, fontSize: 12, marginTop: 4 }}>
              Ref: {direccion.referencias}
            </Text>
          )}

          {(direccion.contacto_nombre || direccion.contacto_telefono) && (
            <Space style={{ marginLeft: 22, marginTop: 8 }} size="middle">
              {direccion.contacto_nombre && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  <UserOutlined style={{ marginRight: 4 }} />
                  {direccion.contacto_nombre}
                </Text>
              )}
              {direccion.contacto_telefono && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  <PhoneOutlined style={{ marginRight: 4 }} />
                  {direccion.contacto_telefono}
                </Text>
              )}
            </Space>
          )}
        </div>

        {showActions && (
          <Space size="small">
            {!direccion.is_default && onSetDefault && (
              <Button
                type="text"
                size="small"
                icon={<StarOutlined />}
                onClick={() => onSetDefault(direccion)}
                title="Establecer como predeterminada"
              />
            )}
            {direccion.is_default && (
              <StarFilled style={{ color: '#faad14', padding: '0 8px' }} />
            )}
            {onEdit && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(direccion)}
              />
            )}
            {onDelete && !direccion.is_default && (
              <Popconfirm
                title="¿Eliminar esta direccion?"
                description="Esta accion no se puede deshacer"
                onConfirm={() => onDelete(direccion)}
                okText="Eliminar"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            )}
          </Space>
        )}
      </div>
    </Card>
  )
}
