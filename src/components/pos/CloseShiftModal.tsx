'use client'

import { useState } from 'react'
import { Modal, InputNumber, Typography, Descriptions, Spin, Input, message, Statistic, Row, Col } from 'antd'
import { useCerrarTurno, useResumenTurno } from '@/lib/hooks/queries/usePOS'
import { usePOSStore } from '@/store/posStore'

const { Title, Text } = Typography

interface CloseShiftModalProps {
  open: boolean
  onSuccess: () => void
  onCancel: () => void
}

export default function CloseShiftModal({ open, onSuccess, onCancel }: CloseShiftModalProps) {
  const [montoReal, setMontoReal] = useState<number>(0)
  const [notas, setNotas] = useState('')
  const turnoId = usePOSStore(s => s.turnoId)
  const { data: resumen, isLoading } = useResumenTurno(open ? turnoId || undefined : undefined)
  const cerrarTurno = useCerrarTurno()

  const esperado = (resumen?.monto_apertura ?? 0)
    + (resumen?.total_efectivo ?? 0)
    - (resumen?.total_cambio ?? 0)
  const diferencia = montoReal - esperado

  const handleClose = async () => {
    if (!turnoId) return

    try {
      await cerrarTurno.mutateAsync({
        p_turno_id: turnoId,
        p_monto_cierre_real: montoReal,
        p_notas_cierre: notas || undefined,
      })
      message.success('Turno cerrado correctamente')
      onSuccess()
    } catch (err) {
      message.error(`Error al cerrar turno: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    }
  }

  return (
    <Modal
      open={open}
      title={<Title level={4} style={{ margin: 0 }}>Cerrar Turno</Title>}
      onCancel={onCancel}
      onOk={handleClose}
      okText="Cerrar Turno"
      okButtonProps={{ danger: true }}
      cancelText="Cancelar"
      confirmLoading={cerrarTurno.isPending}
      width={520}
      centered
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : resumen ? (
        <div>
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Caja">{resumen.caja_nombre}</Descriptions.Item>
            <Descriptions.Item label="Cajero">{resumen.usuario_nombre}</Descriptions.Item>
            <Descriptions.Item label="Ventas">{resumen.num_ventas}</Descriptions.Item>
            <Descriptions.Item label="Canceladas">{resumen.num_canceladas}</Descriptions.Item>
          </Descriptions>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Statistic title="Efectivo" value={resumen.total_efectivo ?? 0} prefix="$" precision={2} />
            </Col>
            <Col span={8}>
              <Statistic title="Tarjeta" value={resumen.total_tarjeta ?? 0} prefix="$" precision={2} />
            </Col>
            <Col span={8}>
              <Statistic title="Transferencia" value={resumen.total_transferencia ?? 0} prefix="$" precision={2} />
            </Col>
          </Row>

          <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary">Fondo apertura</Text>
                <div style={{ fontSize: 18, fontWeight: 600 }}>${(resumen.monto_apertura ?? 0).toFixed(2)}</div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Efectivo esperado</Text>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }}>${esperado.toFixed(2)}</div>
              </Col>
            </Row>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text style={{ display: 'block', marginBottom: 8 }}>Conteo real de efectivo en caja</Text>
            <InputNumber
              data-pos-input
              value={montoReal}
              onChange={v => setMontoReal(v ?? 0)}
              min={0}
              size="large"
              style={{ width: '100%' }}
              prefix="$"
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => Number(v?.replace(/\$\s?|(,*)/g, '') || 0)}
            />
          </div>

          {montoReal > 0 && (
            <div style={{
              padding: 12,
              borderRadius: 8,
              background: diferencia === 0 ? '#f6ffed' : diferencia > 0 ? '#e6f7ff' : '#fff2f0',
              textAlign: 'center',
              marginBottom: 16,
            }}>
              <Text type="secondary">Diferencia</Text>
              <div style={{
                fontSize: 24,
                fontWeight: 700,
                color: diferencia === 0 ? '#52c41a' : diferencia > 0 ? '#1890ff' : '#ff4d4f',
              }}>
                {diferencia >= 0 ? '+' : ''}${diferencia.toFixed(2)}
              </div>
            </div>
          )}

          <Input.TextArea
            data-pos-input
            placeholder="Notas del cierre (opcional)"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
          />
        </div>
      ) : (
        <Text type="secondary">No se encontro informacion del turno</Text>
      )}
    </Modal>
  )
}
