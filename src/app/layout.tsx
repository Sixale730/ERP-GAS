import type { Metadata, Viewport } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'
import { QueryProvider } from '@/lib/providers/QueryProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'CUANTY ERP',
  description: 'Sistema ERP de Inventario, Ventas y Finanzas',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CUANTY ERP',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1890ff',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>
          <AntdRegistry>
            <ConfigProvider
              locale={esES}
              theme={{
                token: {
                  colorPrimary: '#1890ff',
                  borderRadius: 6,
                },
              }}
            >
              {children}
            </ConfigProvider>
          </AntdRegistry>
        </QueryProvider>
      </body>
    </html>
  )
}
