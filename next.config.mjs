/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

    const csp = [
      "default-src 'self'",
      // Scripts: self + inline scripts Next.js needs
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (Tailwind injects)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self + Supabase storage + data URIs + blob for canvas
      `img-src 'self' data: blob: ${supabaseUrl}`,
      // API calls: self + Supabase + Anthropic (server-side only, but covered)
      `connect-src 'self' ${supabaseUrl} https://*.supabase.co wss://*.supabase.co`,
      // Service worker
      "worker-src 'self' blob:",
      // No iframes from untrusted origins
      "frame-ancestors 'none'",
      // Block object/embed
      "object-src 'none'",
      // Base URI locked to self
      "base-uri 'self'",
      // Form actions only to self
      "form-action 'self'",
    ].join('; ')

    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
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
        ],
      },
    ]
  },
}

export default nextConfig
