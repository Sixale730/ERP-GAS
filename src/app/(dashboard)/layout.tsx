import AppLayout from '@/components/layout/AppLayout'
import AuthProviderWrapper from '@/lib/providers/AuthProviderWrapper'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProviderWrapper>
      <AppLayout>
        {children}
      </AppLayout>
    </AuthProviderWrapper>
  )
}
