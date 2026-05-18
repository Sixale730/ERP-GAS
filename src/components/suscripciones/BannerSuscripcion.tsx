'use client'

import { useEffect, useState } from 'react'
import { Button, Space, Typography } from 'antd'
import { WhatsAppOutlined } from '@ant-design/icons'
import { useSuscripcion, registrarEventoSuscripcion } from '@/lib/hooks/queries/useSuscripcion'
import {
  buildWhatsappLink,
  formatFechaCorta,
  SEMAFORO_COLORS,
} from '@/lib/utils/suscripcion'
import ModalDetalleSuscripcion from './ModalDetalleSuscripcion'

const { Text } = Typography

/**
 * Banner permanente del dashboard que avisa de la suscripcion pendiente.
 * - Visible solo si la RPC estado_suscripcion devuelve mostrar_banner=true
 *   (respeta banner_activo, audiencia, forzar y dias_alerta).
 * - No se puede cerrar; solo desaparece cuando se confirma pago o se
 *   apaga banner_activo desde /configuracion/suscripciones.
 * - Click en cualquier parte (excepto boton WhatsApp) abre modal de detalle.
 * - Boton "Contactar al administrador" abre WhatsApp en pestana nueva.
 */
export default function BannerSuscripcion() {
  const { data: estado } = useSuscripcion()
  const [modalOpen, setModalOpen] = useState(false)

  // Registrar banner_visto al renderizar (la RPC dedup por usuario por dia)
  useEffect(() => {
    if (estado?.mostrar_banner) {
      registrarEventoSuscripcion('banner_visto', {
        dias_restantes: estado.dias_restantes,
        color: estado.color_semaforo,
        plan: estado.plan,
      })
    }
  // Solo cuando cambie el flag o los dias para no spamear.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado?.mostrar_banner, estado?.dias_restantes])

  if (!estado || !estado.mostrar_banner) return null

  const sem = SEMAFORO_COLORS[estado.color_semaforo]
  const dias = estado.dias_restantes
  const fechaCorta = formatFechaCorta(estado.fecha_corte)

  const handleBannerClick = () => {
    registrarEventoSuscripcion('modal_abierto')
    setModalOpen(true)
  }

  const handleWhatsapp = (e: React.MouseEvent) => {
    e.stopPropagation()
    registrarEventoSuscripcion('whatsapp_click', { origen: 'banner' })
    const url = buildWhatsappLink(estado.contacto_whatsapp)
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer')
  }

  const mensaje =
    dias <= 0
      ? `Equipo SOLAC — La suscripcion del Sistema ERP CUANTY vencio el ${fechaCorta}. Necesitamos confirmacion de pago para mantener el servicio.`
      : `Equipo SOLAC — La suscripcion del Sistema ERP CUANTY se actualizara el ${fechaCorta}. Necesitamos confirmacion de pago antes de la fecha. Quedan ${dias} dia${dias === 1 ? '' : 's'}.`

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleBannerClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleBannerClick()
        }}
        style={{
          background: sem.bg,
          border: `1px solid ${sem.border}`,
          borderRadius: 6,
          padding: '12px 16px',
          marginBottom: 16,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Space size={8} style={{ flex: 1, minWidth: 240 }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>{sem.icon}</span>
          <Text style={{ color: sem.text, fontSize: 14, lineHeight: 1.4 }}>{mensaje}</Text>
        </Space>
        <Button
          type="primary"
          icon={<WhatsAppOutlined />}
          size="middle"
          style={{ background: '#25D366', borderColor: '#25D366' }}
          onClick={handleWhatsapp}
        >
          Contactar al administrador
        </Button>
      </div>

      <ModalDetalleSuscripcion
        open={modalOpen}
        estado={estado}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
