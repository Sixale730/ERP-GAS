'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, Card, Typography, Space, Result, Spin } from 'antd'
import { MailOutlined, StopOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Text, Paragraph } = Typography

function RegistroPendienteContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
      }
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const isInactive = reason === 'inactive'

  return (
    <Card style={{ width: '100%', maxWidth: 500, textAlign: 'center' }}>
      <Result
        icon={isInactive ? <StopOutlined style={{ color: '#ff4d4f' }} /> : <MailOutlined style={{ color: '#1890ff' }} />}
        title={isInactive ? 'Cuenta Desactivada' : 'Acceso Pendiente'}
        subTitle={
          isInactive
            ? 'Tu cuenta ha sido desactivada por un administrador.'
            : 'Tu cuenta de Google no tiene acceso al sistema.'
        }
        extra={
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {userEmail && (
              <Text type="secondary">
                Conectado como: <Text strong>{userEmail}</Text>
              </Text>
            )}

            <Paragraph type="secondary" style={{ margin: 0 }}>
              {isInactive
                ? 'Contacta al administrador del sistema para reactivar tu cuenta.'
                : 'Para acceder al ERP, necesitas ser invitado por un administrador. Contacta a tu empresa para solicitar acceso.'}
            </Paragraph>

            <Button onClick={handleLogout} style={{ marginTop: 16 }}>
              Cerrar Sesion
            </Button>
          </Space>
        }
      />
    </Card>
  )
}

export default function RegistroPendientePage() {
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
      <Suspense fallback={
        <Card style={{ width: '100%', maxWidth: 500, textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </Card>
      }>
        <RegistroPendienteContent />
      </Suspense>
    </div>
  )
}
