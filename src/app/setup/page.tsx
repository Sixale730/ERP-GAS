'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Typography, Button, Space, Spin, Result, Steps, Alert } from 'antd'
import { GoogleOutlined, CheckCircleOutlined, RocketOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title, Text, Paragraph } = Typography

export default function SetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Verificar si necesita setup
        const setupResponse = await fetch('/api/auth/setup')
        const setupData = await setupResponse.json()

        if (!setupData.needsSetup) {
          // Ya hay un super admin, redirigir al login
          router.push('/login')
          return
        }

        setNeedsSetup(true)

        // Verificar si hay sesion activa
        const supabase = getSupabaseClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          setIsAuthenticated(true)
          setCurrentStep(1)
        }
      } catch {
        setError('Error al verificar el estado del sistema')
      } finally {
        setLoading(false)
      }
    }

    checkStatus()
  }, [router])

  const handleGoogleLogin = async () => {
    const supabase = getSupabaseClient()

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/setup`,
      },
    })
  }

  const handleCreateSuperAdmin = async () => {
    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear super admin')
      }

      setSuccess(true)
      setCurrentStep(2)

      // Redirigir al dashboard despues de 2 segundos
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f2f5',
        }}
      >
        <Spin size="large" tip="Verificando sistema..." />
      </div>
    )
  }

  if (!needsSetup) {
    return null // Redirigiendo...
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
          maxWidth: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <RocketOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <Title level={2} style={{ margin: '16px 0 0' }}>
              Configuracion Inicial
            </Title>
            <Text type="secondary">ERP Nesui</Text>
          </div>

          <Steps
            current={currentStep}
            items={[
              { title: 'Autenticar', description: 'Con Google' },
              { title: 'Crear Admin', description: 'Super Admin' },
              { title: 'Listo', description: 'Acceder' },
            ]}
          />

          {error && (
            <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} />
          )}

          {!isAuthenticated && (
            <div style={{ textAlign: 'center' }}>
              <Paragraph>
                Bienvenido a ERP Nesui. Este es el primer acceso al sistema.
                <br />
                Inicia sesion con Google para crear tu cuenta de Super Admin.
              </Paragraph>

              <Button
                type="primary"
                size="large"
                icon={<GoogleOutlined />}
                onClick={handleGoogleLogin}
                block
                style={{ height: 48 }}
              >
                Continuar con Google
              </Button>
            </div>
          )}

          {isAuthenticated && !success && (
            <div style={{ textAlign: 'center' }}>
              <Paragraph>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                Autenticacion exitosa.
                <br />
                Haz clic en el boton para crear tu cuenta de Super Admin.
              </Paragraph>

              <Alert
                message="Cuenta Super Admin"
                description="Tendras acceso completo a todas las funciones del sistema, incluyendo gestion de usuarios y configuracion."
                type="info"
                showIcon
                style={{ marginBottom: 16, textAlign: 'left' }}
              />

              <Button
                type="primary"
                size="large"
                onClick={handleCreateSuperAdmin}
                loading={creating}
                block
                style={{ height: 48 }}
              >
                {creating ? 'Creando...' : 'Crear Super Admin'}
              </Button>
            </div>
          )}

          {success && (
            <Result
              status="success"
              title="Super Admin Creado"
              subTitle="Redirigiendo al dashboard..."
              extra={<Spin />}
            />
          )}
        </Space>
      </Card>
    </div>
  )
}
