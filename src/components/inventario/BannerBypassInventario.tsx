'use client'

import { Alert, Button } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { useConfigValue } from '@/lib/hooks/queries/useConfiguracionSistema'
import { CONFIG_KEYS } from '@/lib/config/keys'

/**
 * Banner amarillo global cuando el bypass de inventario negativo esta activo.
 * Recuerda al operador que hay que apagarlo cuando termine de regularizar.
 */
export default function BannerBypassInventario() {
  const router = useRouter()
  const bypass = useConfigValue<boolean>(
    'inventario',
    CONFIG_KEYS.INVENTARIO.BYPASS_INVENTARIO_NEGATIVO,
    false
  )

  if (!bypass) return null

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
