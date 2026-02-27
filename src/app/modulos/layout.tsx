import AuthProviderWrapper from '@/lib/providers/AuthProviderWrapper'

export default function ModulosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProviderWrapper>
      {children}
    </AuthProviderWrapper>
  )
}
