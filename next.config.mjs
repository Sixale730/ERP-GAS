/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/cssinjs', 'rc-util', 'rc-pagination', 'rc-picker', 'rc-table', 'rc-tree', 'rc-select', 'rc-cascader', 'rc-checkbox', 'rc-dropdown', 'rc-menu', 'rc-slider', 'rc-steps', 'rc-switch', 'rc-tabs', 'rc-textarea', 'rc-trigger', 'rc-upload', 'rc-input'],
  // Habilitar compresión
  compress: true,

  // Headers de cache y seguridad
  async headers() {
    const securityHeaders = [
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ]

    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
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

