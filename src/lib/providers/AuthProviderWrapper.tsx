'use client'

import { AuthProvider } from '@/lib/hooks/useAuth'
import type { ReactNode } from 'react'

export default function AuthProviderWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
