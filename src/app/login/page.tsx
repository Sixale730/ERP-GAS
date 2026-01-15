'use client'

import { useState } from 'react'
import { Button, Card, Typography, Space, Divider, Alert, Spin } from 'antd'
import { GoogleOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title, Text } = Typography

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabaseClient()

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
      }
    } catch (err) {
      setError('Error al iniciar sesion. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 16,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ color: '#1890ff', margin: 0 }}>
              CUANTY ERP
            </Title>
            <Text type="secondary">
              Sistema de Inventario, Ventas y Finanzas
            </Text>
          </div>

          <Divider style={{ margin: '16px 0' }}>Iniciar Sesion</Divider>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
            />
          )}

          <Button
            type="primary"
            size="large"
            icon={loading ? <Spin size="small" /> : <GoogleOutlined />}
            onClick={handleGoogleLogin}
            disabled={loading}
            block
            style={{ height: 48 }}
          >
            {loading ? 'Conectando...' : 'Continuar con Google'}
          </Button>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Solo usuarios autorizados pueden acceder al sistema.
            <br />
            Contacta al administrador si necesitas acceso.
          </Text>
        </Space>
      </Card>
    </div>
  )
}
