import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  output: 'standalone',
  env: {
    // URLs são detectadas automaticamente baseadas no protocolo da página
    // Se necessário forçar uma URL específica, defina no .env
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || '',
    NEXT_PUBLIC_API_PORT: process.env.NEXT_PUBLIC_API_PORT || '3002',
    NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID || '',
    NEXT_PUBLIC_META_CONFIG_ID: process.env.NEXT_PUBLIC_META_CONFIG_ID || '',
  },
};

export default nextConfig;