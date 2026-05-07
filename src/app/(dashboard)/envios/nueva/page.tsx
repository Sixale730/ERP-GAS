'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Space, Typography, Spin } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import GuiaEnvioForm from '@/components/envios/GuiaEnvioForm'

const { Title } = Typography

function NuevaEnvioInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cotizacionId = searchParams.get('cotizacion_id') ?? undefined

  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/envios')}>Volver</Button>
          <Title level={2} style={{ margin: 0 }}>Nueva guía de envío</Title>
        </Space>
      </Space>

      <GuiaEnvioForm prefilledCotizacionId={cotizacionId} />
    </div>
  )
}

export default function NuevaEnvioPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>}>
      <NuevaEnvioInner />
    </Suspense>
  )
}
