/** @type {import('next').NextConfig} */
const nextConfig = {
  // Habilitar compresión
  compress: true,

  // Optimizar imports para reducir bundle size
  modularizeImports: {
    'antd': {
      transform: 'antd/lib/{{member}}',
      skipDefaultConversion: true,
    },
    '@ant-design/icons': {
      transform: '@ant-design/icons/lib/icons/{{member}}',
    },
    'dayjs': {
      transform: 'dayjs/{{member}}',
    },
  },

  // Headers de cache para assets estáticos
  async headers() {
    return [
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  // Optimizaciones de imagen
  images: {
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig
