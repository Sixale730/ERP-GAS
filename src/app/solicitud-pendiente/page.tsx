'use client'

import { useEffect, useState } from 'react'
import { Card, Typography, Result, Spin, Button } from 'antd'
import { ClockCircleOutlined, TeamOutlined } from '@ant-design/icons'
import { getSupabaseClient } from '@/lib/supabase/client'

const { Title, Paragraph } = Typography

interface SolicitudInfo {
  organizacion_nombre: string
  created_at: string
}

export default function SolicitudPendientePage() {
  const [loading, setLoading] = useState(true)
  const [solicitud, setSolicitud] = useState<SolicitudInfo | null>(null)

  useEffect(() => {
    const fetchSolicitud = async () => {
      const supabase = getSupabaseClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Obtener solicitud pendiente con info de organización
      let { data } = await supabase
        .schema('erp')
        .from('solicitudes_acceso')
        .select(`
          created_at,
          organizaciones:organizacion_id (nombre)
        `)
        .eq('auth_user_id', user.id)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Safety net: si no hay solicitud pendiente, crearla via RPC
      if (!data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: rpcError } = await (supabase.rpc as any)(
          'crear_solicitud_acceso',
          {
            p_auth_user_id: user.id,
            p_email: user.email!,
            p_nombre: user.user_metadata?.full_name || user.email,
            p_avatar_url: user.user_metadata?.avatar_url || null,
          }
        )

        if (!rpcError) {
          // Re-fetch la solicitud recién creada
          const { data: newData } = await supabase
            .schema('erp')
            .from('solicitudes_acceso')
            .select(`
              created_at,
              organizaciones:organizacion_id (nombre)
            `)
            .eq('auth_user_id', user.id)
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          data = newData
        }
      }

      if (data) {
        setSolicitud({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          organizacion_nombre: (data.organizaciones as any)?.nombre || 'Organización',
          created_at: data.created_at,
        })
      }

      setLoading(false)
    }

    fetchSolicitud()
  }, [])

  const handleLogout = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
      <Card style={{ maxWidth: 500, width: '100%' }}>
        <Result
          icon={<ClockCircleOutlined style={{ color: '#faad14' }} />}
          title="Solicitud Pendiente"
          subTitle="Tu solicitud de acceso está siendo revisada por un administrador."
          extra={[
            <Button key="logout" onClick={handleLogout}>
              Cerrar Sesión
            </Button>
          ]}
        >
          {solicitud && (
            <div style={{
              background: '#fafafa',
              padding: 16,
              borderRadius: 8,
              marginTop: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <TeamOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                <strong>{solicitud.organizacion_nombre}</strong>
              </div>
              <Paragraph type="secondary" style={{ margin: 0 }}>
                Solicitud enviada el {formatDate(solicitud.created_at)}
              </Paragraph>
            </div>
          )}

          <Paragraph type="secondary" style={{ marginTop: 24 }}>
            Recibirás acceso una vez que un administrador apruebe tu solicitud.
            Puedes intentar iniciar sesión nuevamente más tarde.
          </Paragraph>
        </Result>
      </Card>
    </div>
  )
}
