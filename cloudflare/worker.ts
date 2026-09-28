import { Container, getContainer } from '@cloudflare/containers'
import { clientRateLimitKey } from './client-address.ts'

export class AtiraContainer extends Container {
  defaultPort = 8080
  sleepAfter = '30m'
}

type Env = {
  API_RATE_LIMITER: RateLimit
  ATIRA_CONTAINER: DurableObjectNamespace<AtiraContainer>
  AUTH_RATE_LIMITER: RateLimit
}

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'none'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy':
    'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
} as const

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const client = clientRateLimitKey(
      request.headers.get('CF-Connecting-IP') ?? 'unknown',
    )
    const headers = new Headers(request.headers)
    headers.set('X-Atira-Client-Key', client)
    const forwardedRequest = new Request(request, { headers })

    if (url.pathname.startsWith('//')) {
      return invalidPathResponse()
    }
    if (url.pathname.startsWith('/api/')) {
      const apiLimit = await env.API_RATE_LIMITER.limit({ key: client })
      if (!apiLimit.success) return rateLimitedResponse()

      if (request.method === 'POST' && url.pathname === '/api/auth/chatgpt') {
        const authLimit = await env.AUTH_RATE_LIMITER.limit({ key: client })
        if (!authLimit.success) return rateLimitedResponse()
      }
    }

    const response = await getContainer(env.ATIRA_CONTAINER).fetch(
      forwardedRequest,
    )
    return withSecurityHeaders(response)
  },
} satisfies ExportedHandler<Env>

function rateLimitedResponse() {
  return withSecurityHeaders(
    Response.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    ),
  )
}

function invalidPathResponse() {
  return withSecurityHeaders(
    Response.json({ error: 'Invalid request path.' }, { status: 400 }),
  )
}

function withSecurityHeaders(response: Response) {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(securityHeaders)) {
    headers.set(name, value)
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}
