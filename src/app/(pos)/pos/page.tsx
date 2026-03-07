'use client'

import { useEffect } from 'react'
import { Spin } from 'antd'
import { usePOSStore } from '@/store/posStore'
import { useTurnoActivo } from '@/lib/hooks/queries/usePOS'
import { useAuth } from '@/lib/hooks/useAuth'
import CajaSelector from '@/components/pos/CajaSelector'
import OpenShiftModal from '@/components/pos/OpenShiftModal'
import POSTerminal from '@/components/pos/POSTerminal'
import type { Caja } from '@/types/pos'
import { useState } from 'react'

export default function POSPage() {
  const { user, loading: authLoading } = useAuth()
  const { cajaId, turnoId, setCajaContext, setTurnoId } = usePOSStore()
  const [showOpenShift, setShowOpenShift] = useState(false)

  const { data: turnoActivo, isLoading: turnoLoading } = useTurnoActivo(cajaId || undefined)

  // Sync turno from DB to store
  useEffect(() => {
    if (turnoActivo) {
      setTurnoId(turnoActivo.id)
    } else if (!turnoLoading && cajaId) {
      // No open shift found
      setTurnoId(null)
    }
  }, [turnoActivo, turnoLoading, cajaId, setTurnoId])

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!user) {
    // Redirect will be handled by auth provider
    return null
  }

  // Step 1: Select caja
  if (!cajaId) {
    return (
      <CajaSelector
        onSelect={(caja: Caja) => {
          setCajaContext({
            cajaId: caja.id,
            almacenId: caja.almacen_id,
            listaPrecioId: caja.lista_precio_id,
            clienteDefaultId: caja.cliente_default_id,
            cajaNombre: caja.nombre,
          })
        }}
      />
    )
  }

  // Loading turno check
  if (turnoLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Verificando turno..." />
      </div>
    )
  }

  // Step 2: Open shift if no active turno
  if (!turnoId) {
    return (
      <div style={{ height: '100vh', background: '#f5f5f5' }}>
        <OpenShiftModal
          open={true}
          onSuccess={(newTurnoId) => {
            setTurnoId(newTurnoId)
            setShowOpenShift(false)
          }}
          onCancel={() => {
            // Go back to caja selector
            usePOSStore.getState().clearCajaContext()
          }}
        />
      </div>
    )
  }

  // Step 3: Terminal
  return <POSTerminal />
}
