'use client'

import { Alert, Button } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { useConfigValue } from '@/lib/hooks/queries/useConfiguracionSistema'
import { useAuth } from '@/lib/hooks/useAuth'
import { CONFIG_KEYS } from '@/lib/config/keys'

/**
 * Banner amarillo global cuando el bypass de inventario negativo esta activo.
 * Recuerda al operador que hay que apagarlo cuando termine de regularizar.
 * Oculto para super_admin (para no estorbar a quien enciende y apaga el flag).
 */
export default function BannerBypassInventario() {
  const router = useRouter()
  const { role } = useAuth()
  const bypass = useConfigValue<boolean>(
    'inventario',
    CONFIG_KEYS.INVENTARIO.BYPASS_INVENTARIO_NEGATIVO,
    false
  )

  if (!bypass) return null
  // super_admin: no mostrar banner (ya sabe que lo tiene ON). Tambien ocultar
  // mientras role no cargo para evitar flash del banner.
  if (!role || role === 'super_admin') return null

  return (
    <Alert
      type="warning"
      showIcon
      icon={<WarningOutlined />}
      message="Modo bypass de inventario negativo ACTIVO"
      description={
        <>
          Se puede facturar aunque no haya stock. El inventario puede quedar en negativo.
          Recuerda apagarlo cuando termines de regularizar la operacion historica para
          restaurar la proteccion normal.
        </>
      }
      action={
        <Button
          size="small"
          type="primary"
          danger
          onClick={() => router.push('/configuracion/sistema?tab=inventario')}
        >
          Apagar
        </Button>
      }
      style={{ marginBottom: 16, borderRadius: 8 }}
    />
  )
}
