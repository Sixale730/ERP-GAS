'use client'
import { ModuleGuard } from '@/components/common/ModuleGuard'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard modulo="cotizaciones">{children}</ModuleGuard>
}
