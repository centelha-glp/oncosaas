import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Tree-shake de pacotes com muitos exports nomeados (menor first-load JS)
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
  },
  images: {
    domains: [],
  },
  output: 'standalone',
  async rewrites() {
    // Com API relativa, o proxy é `src/app/api/v1/[[...path]]/route.ts` (fetch Undici + Agent
    // rejectUnauthorized em dev). Os rewrites nativos do Next não aplicam o dispatcher global
    // e falham com cert HTTPS autoassinado no backend.
    return []
  },
  async headers() {
    if (!isProd) {
      return []
    }
    const api = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
    const wsExplicit = (process.env.NEXT_PUBLIC_WS_URL || '').replace(/\/$/, '')
    const cspExtra = (process.env.NEXT_PUBLIC_CSP_CONNECT_EXTRA || '')
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const connectExtra = [
      api,
      api ? api.replace(/^http/, 'ws') : '',
      wsExplicit,
      ...cspExtra,
    ]
      .filter(Boolean)
      .join(' ')
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              `connect-src 'self' ${connectExtra} ws: wss: https://graph.facebook.com`.trim(),
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
  env: {
    // URLs são detectadas automaticamente baseadas no protocolo da página
    // Se necessário forçar uma URL específica, defina no .env
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || '',
    NEXT_PUBLIC_API_PORT: process.env.NEXT_PUBLIC_API_PORT || '3002',
    NEXT_PUBLIC_USE_RELATIVE_API: process.env.NEXT_PUBLIC_USE_RELATIVE_API || '',
    NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID || '',
    NEXT_PUBLIC_META_CONFIG_ID: process.env.NEXT_PUBLIC_META_CONFIG_ID || '',
    NEXT_PUBLIC_CSP_CONNECT_EXTRA: process.env.NEXT_PUBLIC_CSP_CONNECT_EXTRA || '',
  },
};

export default nextConfig;