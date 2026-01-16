'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'

interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Tiempo que los datos se consideran "frescos" (no refetch)
            staleTime: 1000 * 60 * 2, // 2 minutos
            // Tiempo que los datos permanecen en caché después de no usarse
            gcTime: 1000 * 60 * 10, // 10 minutos (antes cacheTime)
            // No refetch automático en window focus para evitar llamadas innecesarias
            refetchOnWindowFocus: false,
            // Reintentos más conservadores
            retry: 1,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
          },
          mutations: {
            retry: 0,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
