import AuthProviderWrapper from '@/lib/providers/AuthProviderWrapper'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider locale={esES}>
        <AuthProviderWrapper>
          {children}
        </AuthProviderWrapper>
      </ConfigProvider>
    </AntdRegistry>
  )
}
