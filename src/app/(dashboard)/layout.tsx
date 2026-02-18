import AppLayout from '@/components/layout/AppLayout'
import { AuthProvider } from '@/lib/hooks/useAuth'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AppLayout>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppLayout>
    </AuthProvider>
  )
}
