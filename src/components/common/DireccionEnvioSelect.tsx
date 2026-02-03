'use client'

import { useState, useEffect } from 'react'
import { Select, Button, Space, Typography, Spin, Empty } from 'antd'
import { PlusOutlined, EnvironmentOutlined } from '@ant-design/icons'
import type { DireccionEnvio } from '@/types/database'
import {
  useDireccionesEnvio,
  getDefaultDireccion,
  formatDireccionCorta,
} from '@/lib/hooks/useDireccionesEnvio'
import DireccionEnvioModal from './DireccionEnvioModal'

const { Text } = Typography

interface DireccionEnvioSelectProps {
  clienteId: string | null
  value?: string | null
  onChange?: (direccionId: string | null, direccion: DireccionEnvio | null) => void
  disabled?: boolean
  placeholder?: string
  allowAddNew?: boolean
  onNewAddressCreated?: (direccion: DireccionEnvio) => void
}

export default function DireccionEnvioSelect({
  clienteId,
  value,
  onChange,
  disabled = false,
  placeholder = 'Seleccionar direccion de envio',
  allowAddNew = true,
  onNewAddressCreated,
}: DireccionEnvioSelectProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(value || null)

  const { data: direcciones = [], isLoading } = useDireccionesEnvio(clienteId)

  // Auto-select default when direcciones load or change
  useEffect(() => {
    if (!value && direcciones.length > 0) {
      const defaultDir = getDefaultDireccion(direcciones)
      if (defaultDir) {
        setSelectedId(defaultDir.id)
        onChange?.(defaultDir.id, defaultDir)
      }
    }
  }, [direcciones, value, onChange])

  // Sync external value
  useEffect(() => {
    setSelectedId(value || null)
  }, [value])

  // Reset when cliente changes
  useEffect(() => {
    if (!clienteId) {
      setSelectedId(null)
      onChange?.(null, null)
    }
  }, [clienteId, onChange])

  const handleChange = (id: string | null) => {
    setSelectedId(id)
    const direccion = direcciones.find(d => d.id === id) || null
    onChange?.(id, direccion)
  }

  const handleAddNew = () => {
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
  }

  const handleAddressCreated = (direccion: DireccionEnvio) => {
    // Auto-select the new address
    setSelectedId(direccion.id)
    onChange?.(direccion.id, direccion)
    onNewAddressCreated?.(direccion)
    setModalOpen(false)
  }

  if (!clienteId) {
    return (
      <Select
        disabled
        placeholder="Selecciona un cliente primero"
        style={{ width: '100%' }}
      />
    )
  }

  if (isLoading) {
    return (
      <Select
        disabled
        placeholder="Cargando direcciones..."
        style={{ width: '100%' }}
        loading
      />
    )
  }

  const options = direcciones.map((dir) => ({
    value: dir.id,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <EnvironmentOutlined style={{ color: '#1890ff' }} />
        <div>
          <div style={{ fontWeight: dir.is_default ? 600 : 400 }}>
            {dir.alias}
            {dir.is_default && <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>(Predeterminada)</Text>}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatDireccionCorta(dir)}
          </Text>
        </div>
      </div>
    ),
    searchLabel: `${dir.alias} ${formatDireccionCorta(dir)}`,
  }))

  return (
    <>
      <Space.Compact style={{ width: '100%' }}>
        <Select
          value={selectedId}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          style={{ flex: 1 }}
          optionLabelProp="label"
          showSearch
          filterOption={(input, option) =>
            (option?.searchLabel ?? '').toLowerCase().includes(input.toLowerCase())
          }
          notFoundContent={
            <Empty
              description="Sin direcciones"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '12px 0' }}
            >
              {allowAddNew && (
                <Button type="link" icon={<PlusOutlined />} onClick={handleAddNew}>
                  Agregar nueva
                </Button>
              )}
            </Empty>
          }
          options={options}
        />
        {allowAddNew && (
          <Button
            icon={<PlusOutlined />}
            onClick={handleAddNew}
            disabled={disabled}
            title="Agregar nueva direccion"
          />
        )}
      </Space.Compact>

      {clienteId && (
        <DireccionEnvioModal
          open={modalOpen}
          onClose={handleModalClose}
          clienteId={clienteId}
          onSuccess={handleAddressCreated}
        />
      )}
    </>
  )
}

// Component to display selected address details
interface DireccionEnvioDisplayProps {
  direccion: DireccionEnvio | null
  showLabel?: boolean
}

export function DireccionEnvioDisplay({ direccion, showLabel = true }: DireccionEnvioDisplayProps) {
  if (!direccion) {
    return (
      <Text type="secondary">Sin direccion de envio seleccionada</Text>
    )
  }

  return (
    <div>
      {showLabel && (
        <Text type="secondary" style={{ fontSize: 12 }}>Direccion de Envio</Text>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 4 }}>
        <EnvironmentOutlined style={{ color: '#1890ff', marginTop: 2 }} />
        <div>
          <Text strong>{direccion.alias}</Text>
          <div><Text>{formatDireccionCorta(direccion)}</Text></div>
          {direccion.ciudad && (
            <Text type="secondary">
              {[direccion.ciudad, direccion.estado, direccion.codigo_postal].filter(Boolean).join(', ')}
            </Text>
          )}
          {direccion.contacto_nombre && (
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Contacto: {direccion.contacto_nombre}
                {direccion.contacto_telefono && ` - ${direccion.contacto_telefono}`}
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
