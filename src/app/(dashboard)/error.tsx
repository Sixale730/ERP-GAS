'use client'

import { Button, Result } from 'antd'
import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div style={{ padding: 48 }}>
      <Result
        status="error"
        title="Algo salio mal"
        subTitle={error.message || 'Ocurrio un error inesperado'}
        extra={[
          <Button
            type="primary"
            key="retry"
            onClick={reset}
          >
            Reintentar
          </Button>,
          <Button
            key="home"
            onClick={() => window.location.href = '/'}
          >
            Ir al inicio
          </Button>,
        ]}
      />
    </div>
  )
}
