'use client'

import { useEffect, useState } from 'react'
import { Card, Button, List, Typography, Spin, message, Result } from 'antd'
import { TeamOutlined, LoginOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title, Text, Paragraph } = Typography

interface Organizacion {
  id: string
  nombre: string
  codigo: string
}

export default function SolicitarAccesoPage() {
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = getSupabaseClient()

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
      }

      // Obtener organizaciones disponibles (excluir la del sistema)
      const { data: orgs } = await supabase
        .schema('erp')
        .from('organizaciones')
        .select('id, nombre, codigo')
        .eq('is_sistema', false)
        .eq('is_active', true)
        .order('nombre')

      setOrganizaciones(orgs || [])
      setLoading(false)
    }

    fetchData()
  }, [])

  const handleSolicitar = async (orgId: string) => {
    setSubmitting(true)
    const supabase = getSupabaseClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        message.error('No se pudo obtener información del usuario')
        return
      }

      // Crear solicitud de acceso
      const { error } = await supabase
        .schema('erp')
        .from('solicitudes_acceso')
        .insert({
          auth_user_id: user.id,
          email: user.email,
          nombre: user.user_metadata?.full_name || user.email,
          avatar_url: user.user_metadata?.avatar_url || null,
          organizacion_id: orgId,
          estado: 'pendiente',
        })

      if (error) {
        console.error('Error al crear solicitud:', error)
        message.error('Error al enviar la solicitud')
        return
      }

      setSubmitted(true)
      message.success('Solicitud enviada correctamente')
    } catch (err) {
      console.error('Error:', err)
      message.error('Error al procesar la solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5'
      }}>
        <Spin size="large" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
        padding: 24
      }}>
        <Card style={{ maxWidth: 500, width: '100%' }}>
          <Result
            status="success"
            title="Solicitud Enviada"
            subTitle="Tu solicitud de acceso ha sido enviada. Un administrador la revisará pronto."
            extra={
              <Paragraph type="secondary">
                Te notificaremos cuando tu solicitud sea aprobada.
                Puedes cerrar esta página.
              </Paragraph>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f2f5',
      padding: 24
    }}>
      <Card style={{ maxWidth: 600, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <LoginOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
          <Title level={3} style={{ marginBottom: 8 }}>Solicitar Acceso</Title>
          {userEmail && (
            <Text type="secondary">
              Sesión iniciada como: <strong>{userEmail}</strong>
            </Text>
          )}
        </div>

        <Paragraph style={{ textAlign: 'center', marginBottom: 24 }}>
          Selecciona la organización a la que deseas unirte.
          Un administrador revisará tu solicitud.
        </Paragraph>

        {organizaciones.length === 0 ? (
          <Result
            status="info"
            title="No hay organizaciones disponibles"
            subTitle="Contacta al administrador del sistema para obtener acceso."
          />
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={organizaciones}
            renderItem={(org) => (
              <List.Item
                actions={[
                  <Button
                    key="solicitar"
                    type="primary"
                    loading={submitting}
                    onClick={() => handleSolicitar(org.id)}
                  >
                    Solicitar
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<TeamOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                  title={org.nombre}
                  description={`Código: ${org.codigo}`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  )
}
