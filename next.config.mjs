/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compress responses with gzip/brotli
  compress: true,

  // Enable image optimisation
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',  // covers both public and signed URLs
      },
    ],
  },

  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

    const isDev = process.env.NODE_ENV === 'development'

    const csp = [
      "default-src 'self'",
      // Scripts: self + Next.js inline scripts (nonce-based would be ideal but
      // requires custom server; unsafe-inline is the practical trade-off for SSG)
      // unsafe-eval required in dev mode for React hot reload and Next.js HMR
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      // Styles: self + inline (Tailwind injects)
      "style-src 'self' 'unsafe-inline'",
      // Fonts served by next/font from same origin — no Google Fonts needed
      "font-src 'self'",
      // Images: self + Supabase storage (public URLs + signed URL CDN) + blobs
      `img-src 'self' data: blob: ${supabaseUrl} https://*.supabase.co`,
      // API/WebSocket connections: self + Supabase
      `connect-src 'self' ${supabaseUrl} https://*.supabase.co wss://*.supabase.co`,
      // Service worker
      "worker-src 'self' blob:",
      // No embedding in iframes
      "frame-ancestors 'none'",
      // No plugins/embeds
      "object-src 'none'",
      // Limit base URI to same origin
      "base-uri 'self'",
      // Only allow form submissions to same origin
      "form-action 'self'",
      // Upgrade all HTTP requests to HTTPS
      "upgrade-insecure-requests",
    ].join('; ')

    return [
      // ── Service Worker: no cache ────────────────────────────────
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },

      // ── Static assets: immutable 1-year cache ─────────────────
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },

      // ── All routes: security headers ──────────────────────────
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Enables cross-origin isolation — required for SharedArrayBuffer & precise timers
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // cross-origin allows our pages to load images from Supabase storage CDN
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
