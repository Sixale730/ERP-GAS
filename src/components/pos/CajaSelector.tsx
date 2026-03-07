'use client'

import { Card, Row, Col, Spin, Empty, Typography } from 'antd'
import { ShopOutlined } from '@ant-design/icons'
import { useCajas } from '@/lib/hooks/queries/usePOS'
import type { Caja } from '@/types/pos'

const { Title } = Typography

interface CajaSelectorProps {
  onSelect: (caja: Caja) => void
}

export default function CajaSelector({ onSelect }: CajaSelectorProps) {
  const { data: cajas, isLoading } = useCajas()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f5f5f5',
      padding: 24,
    }}>
      <ShopOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
      <Title level={2} style={{ marginBottom: 32 }}>Selecciona una Caja</Title>

      {isLoading ? (
        <Spin size="large" />
      ) : !cajas?.length ? (
        <Empty description="No hay cajas configuradas. Contacta al administrador." />
      ) : (
        <Row gutter={[16, 16]} style={{ maxWidth: 800, width: '100%' }}>
          {cajas.map(caja => (
            <Col xs={24} sm={12} key={caja.id}>
              <Card
                hoverable
                onClick={() => onSelect(caja)}
                style={{
                  textAlign: 'center',
                  borderRadius: 12,
                  border: '2px solid transparent',
                  transition: 'border-color 0.3s',
                }}
                styles={{ body: { padding: 24 } }}
              >
                <ShopOutlined style={{ fontSize: 36, color: '#1890ff', marginBottom: 12 }} />
                <Title level={4} style={{ margin: 0 }}>{caja.nombre}</Title>
                <p style={{ color: '#999', margin: '4px 0 0' }}>{caja.codigo}</p>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}
