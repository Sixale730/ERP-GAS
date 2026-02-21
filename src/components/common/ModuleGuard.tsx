'use client'

import { Result, Spin } from 'antd'
import { useModulos } from '@/lib/hooks/useModulos'
import type { Modulo } from '@/lib/hooks/usePermisos'
import { MODULOS_REGISTRO } from '@/lib/config/modulos'

interface ModuleGuardProps {
  modulo: Modulo
  children: React.ReactNode
}

export function ModuleGuard({ modulo, children }: ModuleGuardProps) {
  const { isModuloActivo, loading } = useModulos()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isModuloActivo(modulo)) {
    const info = MODULOS_REGISTRO[modulo]
    return (
      <Result
        status="403"
        title="Modulo no disponible"
        subTitle={`El modulo "${info?.label ?? modulo}" no esta habilitado para tu organizacion. Contacta al administrador del sistema.`}
      />
    )
  }

  return <>{children}</>
}
