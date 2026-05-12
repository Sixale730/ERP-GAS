import AppLayout from '@/components/layout/AppLayout'
import AuthProviderWrapper from '@/lib/providers/AuthProviderWrapper'
import ErrorReporter from '@/components/common/ErrorReporter'
import GlobalErrorBoundary from '@/components/common/GlobalErrorBoundary'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProviderWrapper>
      <ErrorReporter>
        <AppLayout>
          <GlobalErrorBoundary>
            {children}
          </GlobalErrorBoundary>
        </AppLayout>
      </ErrorReporter>
    </AuthProviderWrapper>
  )
}
