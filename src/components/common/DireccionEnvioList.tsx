'use client'

import { useState } from 'react'
import { Button, Empty, Spin, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { DireccionEnvio } from '@/types/database'
import {
  useDireccionesEnvio,
  useDeleteDireccionEnvio,
  useSetDefaultDireccion,
} from '@/lib/hooks/useDireccionesEnvio'
import DireccionEnvioCard from './DireccionEnvioCard'
import DireccionEnvioModal from './DireccionEnvioModal'

interface DireccionEnvioListProps {
  clienteId: string
  showAddButton?: boolean
  onAddressSelect?: (direccion: DireccionEnvio) => void
}

export default function DireccionEnvioList({
  clienteId,
  showAddButton = true,
  onAddressSelect,
}: DireccionEnvioListProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDireccion, setEditingDireccion] = useState<DireccionEnvio | null>(null)

  const { data: direcciones = [], isLoading, error } = useDireccionesEnvio(clienteId)
  const deleteMutation = useDeleteDireccionEnvio()
  const setDefaultMutation = useSetDefaultDireccion()

  const handleEdit = (direccion: DireccionEnvio) => {
    setEditingDireccion(direccion)
    setModalOpen(true)
  }

  const handleDelete = async (direccion: DireccionEnvio) => {
    try {
      await deleteMutation.mutateAsync({ id: direccion.id, clienteId })
      message.success('Direccion eliminada')
    } catch (error: any) {
      message.error(error.message || 'Error al eliminar direccion')
    }
  }

  const handleSetDefault = async (direccion: DireccionEnvio) => {
    try {
      await setDefaultMutation.mutateAsync({ id: direccion.id, clienteId })
      message.success('Direccion predeterminada actualizada')
    } catch (error: any) {
      message.error(error.message || 'Error al establecer predeterminada')
    }
  }

  const handleAddNew = () => {
    setEditingDireccion(null)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditingDireccion(null)
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <Spin />
      </div>
    )
  }

  if (error) {
    return (
      <Empty
        description="Error al cargar direcciones"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  return (
    <div>
      {direcciones.length === 0 ? (
        <Empty
          description="Sin direcciones de envio registradas"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {showAddButton && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>
              Agregar Direccion
            </Button>
          )}
        </Empty>
      ) : (
        <>
          {direcciones.map((direccion) => (
            <DireccionEnvioCard
              key={direccion.id}
              direccion={direccion}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          ))}

          {showAddButton && (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddNew}
              block
              style={{ marginTop: 8 }}
            >
              Agregar Direccion
            </Button>
          )}
        </>
      )}

      <DireccionEnvioModal
        open={modalOpen}
        onClose={handleModalClose}
        clienteId={clienteId}
        direccion={editingDireccion}
      />
    </div>
  )
}
