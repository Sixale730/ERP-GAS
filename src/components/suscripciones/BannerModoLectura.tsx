'use client'

import { Alert, Button } from 'antd'
import { LockOutlined, WhatsAppOutlined } from '@ant-design/icons'
import { useSuscripcion } from '@/lib/hooks/queries/useSuscripcion'
import { useAuth } from '@/lib/hooks/useAuth'
import { buildWhatsappLink } from '@/lib/utils/suscripcion'

/**
 * Banner persistente que avisa que el ERP esta en modo solo lectura por
 * suscripcion vencida. Se renderiza en TODAS las paginas del grupo
 * (dashboard) via AppLayout.
 *
 * Reglas:
 * - Solo visible cuando suscripcion.modo_lectura_activo === true.
 * - super_admin NO lo ve (esta exento de modo lectura).
 * - No es cerrable.
 * - Click en boton de contacto abre WhatsApp del administrador.
 */
export default function BannerModoLectura() {
  const { role } = useAuth()
  const { data: estado } = useSuscripcion()

  if (!estado?.modo_lectura_activo) return null
  if (role === 'super_admin') return null

  const handleContacto = () => {
    if (typeof window === 'undefined') return
    const url = buildWhatsappLink(estado.contacto_whatsapp ?? '')
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Alert
      type="error"
      showIcon
      icon={<LockOutlined />}
      style={{ marginBottom: 16, borderRadius: 6 }}
      message="Sistema en modo solo lectura"
      description={
        <span>
          La suscripcion del ERP esta pendiente de confirmacion de pago. Mientras tanto puedes
          consultar la informacion, pero no es posible crear ni modificar registros, registrar
          pagos, ni emitir CFDI. Contacta al administrador para regularizar el servicio.
        </span>
      }
      action={
        <Button
          type="primary"
          danger
          icon={<WhatsAppOutlined />}
          onClick={handleContacto}
          style={{ background: '#25D366', borderColor: '#25D366' }}
        >
          Contactar al administrador
        </Button>
      }
    />
  )
}
