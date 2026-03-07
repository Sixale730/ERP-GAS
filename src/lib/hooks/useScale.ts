'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SerialScale } from '@/lib/utils/serial-scale'

export function useScale() {
  const scaleRef = useRef<SerialScale | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const isSupported = SerialScale.isSupported

  useEffect(() => {
    scaleRef.current = new SerialScale()
    return () => {
      scaleRef.current?.disconnect()
    }
  }, [])

  const connect = useCallback(async (baudRate = 9600): Promise<boolean> => {
    const scale = scaleRef.current
    if (!scale) return false

    const ok = await scale.connect(baudRate)
    if (ok) {
      setIsConnected(true)
      scale.onWeightChange((w) => setWeight(w))
    }
    return ok
  }, [])

  const disconnect = useCallback(async () => {
    await scaleRef.current?.disconnect()
    setIsConnected(false)
    setWeight(null)
  }, [])

  const tare = useCallback(async () => {
    await scaleRef.current?.tare()
  }, [])

  return { weight, isConnected, isSupported, connect, disconnect, tare }
}
