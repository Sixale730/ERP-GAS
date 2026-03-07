'use client'

import { Button, Space, Tag, InputNumber } from 'antd'
import { ApiOutlined, DisconnectOutlined } from '@ant-design/icons'
import { useScale } from '@/lib/hooks/useScale'
import { usePOSStore } from '@/store/posStore'
import { useEffect, useState } from 'react'

export default function ScaleDisplay() {
  const { weight, isConnected, isSupported, connect, disconnect, tare } = useScale()
  const { setPesoBascula } = usePOSStore()
  const [manualWeight, setManualWeight] = useState<number | null>(null)

  // Sync scale weight to store
  useEffect(() => {
    if (isConnected && weight !== null) {
      setPesoBascula(weight)
    }
  }, [weight, isConnected, setPesoBascula])

  // Manual weight sync
  useEffect(() => {
    if (!isConnected && manualWeight !== null) {
      setPesoBascula(manualWeight)
    }
  }, [manualWeight, isConnected, setPesoBascula])

  return (
    <div style={{
      marginTop: 8,
      padding: '8px 12px',
      background: '#fafafa',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{ fontWeight: 600, fontSize: 13, color: '#666' }}>Bascula:</span>

      {isConnected ? (
        <>
          <Tag color="green">Conectada</Tag>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1890ff' }}>
            {weight?.toFixed(3) ?? '0.000'} kg
          </span>
          <Space size="small" style={{ marginLeft: 'auto' }}>
            <Button size="small" onClick={tare}>Tarar</Button>
            <Button size="small" danger icon={<DisconnectOutlined />} onClick={disconnect} />
          </Space>
        </>
      ) : (
        <>
          {isSupported ? (
            <Button
              size="small"
              icon={<ApiOutlined />}
              onClick={() => connect()}
            >
              Conectar
            </Button>
          ) : (
            <Tag color="orange">No soportada</Tag>
          )}
          <InputNumber
            data-pos-input
            placeholder="Peso manual (kg)"
            value={manualWeight}
            onChange={v => setManualWeight(v)}
            min={0}
            step={0.001}
            size="small"
            style={{ width: 140 }}
            suffix="kg"
          />
        </>
      )}
    </div>
  )
}
