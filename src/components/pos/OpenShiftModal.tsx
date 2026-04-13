'use client'

import { useState } from 'react'
import { Modal, InputNumber, Typography, message } from 'antd'
import { DollarOutlined } from '@ant-design/icons'
import { useAbrirTurno } from '@/lib/hooks/queries/usePOS'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePOSStore } from '@/store/posStore'

const { Title, Text } = Typography

interface OpenShiftModalProps {
  open: boolean
  onSuccess: (turnoId: string) => void
  onCancel: () => void
}

export default function OpenShiftModal({ open, onSuccess, onCancel }: OpenShiftModalProps) {
  const [monto, setMonto] = useState<number>(0)
  const { user, erpUser, organizacion } = useAuth()
  const cajaId = usePOSStore(s => s.cajaId)
  const cajaNombre = usePOSStore(s => s.cajaNombre)
  const abrirTurno = useAbrirTurno()

  const handleOpen = async () => {
    if (!cajaId || !user || !organizacion) return

    try {
      const turnoId = await abrirTurno.mutateAsync({
        p_caja_id: cajaId,
        p_usuario_id: user.id,
        p_usuario_nombre: erpUser?.nombre || user.email || 'Usuario',
        p_monto_apertura: monto,
        p_organizacion_id: organizacion.id,
      })
      message.success('Turno abierto correctamente')
      onSuccess(turnoId)
    } catch (err) {
      message.error(`Error al abrir turno: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    }
  }

  return (
    <Modal
      open={open}
      title={null}
      onCancel={onCancel}
      onOk={handleOpen}
      okText="Abrir Turno"
      cancelText="Cancelar"
      confirmLoading={abrirTurno.isPending}
      width={400}
      centered
    >
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <DollarOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
        <Title level={3} style={{ margin: '0 0 4px' }}>Abrir Turno</Title>
        <Text type="secondary">{cajaNombre}</Text>

        <div style={{ marginTop: 24 }}>
          <Text style={{ display: 'block', marginBottom: 8 }}>Monto de apertura (fondo de caja)</Text>
          <InputNumber
            data-pos-input
            value={monto}
            onChange={v => setMonto(v ?? 0)}
            min={0}
            step={100}
            size="large"
            style={{ width: '100%', fontSize: 24 }}
            prefix="$"
            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={v => Number(v?.replace(/\$\s?|(,*)/g, '') || 0)}
          />
        </div>
      </div>
    </Modal>
  )
}
