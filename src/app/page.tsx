'use client'

import dynamic from 'next/dynamic'

const LandingPageContent = dynamic(
  () => import('@/components/landing/LandingPageContent'),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#1890ff', marginBottom: 8 }}>CUANTY ERP</div>
          <div style={{ color: '#999', fontSize: 14 }}>Cargando...</div>
        </div>
      </div>
    ),
  }
)

export default function Page() {
  return <LandingPageContent />
}
