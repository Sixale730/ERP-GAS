'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, Typography, Button, Space, Spin, Result, Tag } from 'antd'
import { GoogleOutlined, TeamOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title, Text, Paragraph } = Typography

interface InvitacionInfo {
  valid: boolean
  email: string
  rol: string
  organizacion: {
    id: string
    nombre: string
    codigo: string
  }
}

const roleLabels: Record<string, string> = {
  admin_cliente: 'Administrador',
  vendedor: 'Vendedor',
}

export default function InvitacionPage() {
  const params = useParams()
  const token = params.token as string
  const [loading, setLoading] = useState(true)
  const [invitacion, setInvitacion] = useState<InvitacionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authenticating, setAuthenticating] = useState(false)

  useEffect(() => {
    const verifyInvitation = async () => {
      try {
        const response = await fetch(`/api/invitaciones?token=${token}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Invitacion no valida')
        } else {
          setInvitacion(data)
        }
      } catch {
        setError('Error al verificar invitacion')
      } finally {
        setLoading(false)
      }
    }

    verifyInvitation()
  }, [token])

  const handleGoogleLogin = async () => {
    setAuthenticating(true)

    const supabase = getSupabaseClient()

    // Guardar token en localStorage para usarlo despues del callback
    localStorage.setItem('pending_invitation_token', token)

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
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
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f2f5',
          padding: 16,
        }}
      >
        <Card style={{ width: '100%', maxWidth: 500 }}>
          <Result
            status="error"
            title="Invitacion No Valida"
            subTitle={error}
            extra={
              <Button type="primary" href="/login">
                Ir a Iniciar Sesion
              </Button>
            }
          />
        </Card>
      </div>
    )
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
          maxWidth: 450,
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ color: '#1890ff', margin: 0 }}>
              CUANTY ERP
            </Title>
            <Text type="secondary">Has sido invitado a unirte</Text>
          </div>

          <div
            style={{
              background: '#f5f5f5',
              padding: 16,
              borderRadius: 8,
            }}
          >
            <Space direction="vertical" size="small">
              <div>
                <TeamOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              </div>
              <Title level={4} style={{ margin: 0 }}>
                {invitacion?.organizacion.nombre}
              </Title>
              <Tag color="blue">{roleLabels[invitacion?.rol || ''] || invitacion?.rol}</Tag>
            </Space>
          </div>

          <Paragraph type="secondary">
            Te han invitado a unirte como{' '}
            <Text strong>{roleLabels[invitacion?.rol || ''] || invitacion?.rol}</Text>.
            <br />
            Usa tu cuenta de Google para continuar.
          </Paragraph>

          <Button
            type="primary"
            size="large"
            icon={authenticating ? <Spin size="small" /> : <GoogleOutlined />}
            onClick={handleGoogleLogin}
            disabled={authenticating}
            block
            style={{ height: 48 }}
          >
            {authenticating ? 'Conectando...' : 'Continuar con Google'}
          </Button>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Al continuar, aceptas los terminos de servicio del sistema.
          </Text>
        </Space>
      </Card>
    </div>
  )
}
