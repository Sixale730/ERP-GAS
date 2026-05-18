'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useUIStore } from '@/store/uiStore'

/**
 * Hook para persistir el estado de filtros/paginacion/busqueda de un listado
 * entre navegaciones (entrar a detalle y regresar).
 *
 * Usa uiStore.pageFilters (Zustand en memoria, sin localStorage) para
 * sobrevivir a desmonte/remonte del componente sin guardar datos obsoletos
 * entre sesiones. Refresh de pagina = vuelve a defaults.
 *
 * Uso:
 *   const [filtros, setFiltro] = usePersistedListState('facturas', {
 *     status: null as string | null,
 *     search: '',
 *     pageSize: 10,
 *     page: 1,
 *   })
 *
 *   <Select value={filtros.status} onChange={v => setFiltro('status', v)} />
 *
 * La unica regla: la `key` que pases a setFiltro debe existir en el objeto
 * inicial. TypeScript te garantiza esto.
 */
export function usePersistedListState<T extends Record<string, unknown>>(
  pageKey: string,
  defaults: T
): [T, <K extends keyof T>(key: K, value: T[K]) => void, () => void] {
  const stored = useUIStore((s) => s.pageFilters[pageKey])
  const setPageFilter = useUIStore((s) => s.setPageFilter)
  const clearPageFilters = useUIStore((s) => s.clearPageFilters)

  // Estado local sincronizado con uiStore. Inicializa con lo guardado o defaults.
  // Usamos referencia inicial: si hay algo en uiStore se usa, si no se usan los defaults.
  const defaultsRef = useRef(defaults)
  const [state, setState] = useState<T>(() => {
    const initial = { ...defaultsRef.current }
    if (stored) {
      for (const k of Object.keys(initial) as (keyof T)[]) {
        if (k in stored) {
          ;(initial as Record<keyof T, unknown>)[k] = stored[k as string] as T[keyof T]
        }
      }
    }
    return initial
  })

  // Sincronizar lecturas externas (si otra parte de la app modifica pageFilters)
  useEffect(() => {
    if (!stored) return
    setState((prev) => {
      let cambio = false
      const nuevo = { ...prev }
      for (const k of Object.keys(prev) as (keyof T)[]) {
        if (k in stored && (stored[k as string] as T[keyof T]) !== prev[k]) {
          ;(nuevo as Record<keyof T, unknown>)[k] = stored[k as string] as T[keyof T]
          cambio = true
        }
      }
      return cambio ? nuevo : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored])

  const setFiltro = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setState((prev) => ({ ...prev, [key]: value }))
      setPageFilter(pageKey, key as string, value)
    },
    [pageKey, setPageFilter]
  )

  const limpiar = useCallback(() => {
    setState(defaultsRef.current)
    clearPageFilters(pageKey)
  }, [pageKey, clearPageFilters])

  return [state, setFiltro, limpiar]
}
