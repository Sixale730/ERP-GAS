'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Modal } from 'antd'

const TIMEOUT = 6 * 60 * 60 * 1000        // 6 horas
const WARNING_BEFORE = 5 * 60 * 1000      // 5 minutos antes
const THROTTLE_MS = 60_000                 // throttle de eventos: 1 min

export function useInactivityLogout(signOut: () => void) {
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>()
  const warningTimer = useRef<ReturnType<typeof setTimeout>>()
  const modalInstance = useRef<ReturnType<typeof Modal.confirm>>()
  const throttleRef = useRef(false)
  const signOutRef = useRef(signOut)
  signOutRef.current = signOut

  const resetTimers = useCallback(() => {
    // Limpiar timers previos
    if (warningTimer.current) clearTimeout(warningTimer.current)
    if (logoutTimer.current) clearTimeout(logoutTimer.current)

    // Destruir modal si estaba abierto
    if (modalInstance.current) {
      modalInstance.current.destroy()
      modalInstance.current = undefined
    }

    // Timer de advertencia (5h 55m)
    warningTimer.current = setTimeout(() => {
      modalInstance.current = Modal.confirm({
        title: 'Sesion por expirar',
        content: 'Tu sesion se cerrara en 5 minutos por inactividad.',
        okText: 'Seguir trabajando',
        cancelText: 'Cerrar sesion',
        closable: false,
        maskClosable: false,
        onOk: () => {
          modalInstance.current = undefined
          resetTimers()
        },
        onCancel: () => {
          modalInstance.current = undefined
          signOutRef.current()
        },
      })
    }, TIMEOUT - WARNING_BEFORE)

    // Timer de logout (6h)
    logoutTimer.current = setTimeout(() => {
      if (modalInstance.current) {
        modalInstance.current.destroy()
        modalInstance.current = undefined
      }
      signOutRef.current()
    }, TIMEOUT)
  }, [])

  useEffect(() => {
    const onActivity = () => {
      if (throttleRef.current) return
      throttleRef.current = true
      resetTimers()
      setTimeout(() => { throttleRef.current = false }, THROTTLE_MS)
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach(e => document.addEventListener(e, onActivity, { passive: true }))

    // Iniciar timers
    resetTimers()

    return () => {
      events.forEach(e => document.removeEventListener(e, onActivity))
      if (warningTimer.current) clearTimeout(warningTimer.current)
      if (logoutTimer.current) clearTimeout(logoutTimer.current)
      if (modalInstance.current) {
        modalInstance.current.destroy()
        modalInstance.current = undefined
      }
    }
  }, [resetTimers])
}
