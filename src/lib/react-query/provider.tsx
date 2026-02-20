'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'
import NavigationProgress from '@/components/layout/NavigationProgress'

interface ReactQueryProviderProps {
  children: ReactNode
}

export function ReactQueryProvider({ children }: ReactQueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data se considera fresca por 5 minutos
            staleTime: 5 * 60 * 1000,
            // Cache se mantiene por 30 minutos
            gcTime: 30 * 60 * 1000,
            // No refetch al enfocar la ventana (mejor UX)
            refetchOnWindowFocus: false,
            // No refetch al reconectar
            refetchOnReconnect: false,
            // Reintentar 1 vez en caso de error
            retry: 1,
            // Delay de reintento: 1 segundo
            retryDelay: 1000,
          },
          mutations: {
            // Reintentar 0 veces en mutaciones (mejor control de errores)
            retry: 0,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationProgress />
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  )
}
