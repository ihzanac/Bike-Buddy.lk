import type { Connect, Plugin } from 'vite'

const ROUTES = new Set(['/api/customer-password-otp.php', '/api/customer-password-otp'])

function createHandler(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const pathOnly = (req.url ?? '').split('?')[0] ?? ''
    if (!ROUTES.has(pathOnly) || req.method !== 'POST') {
      return next()
    }
    res.writeHead(501, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        ok: false,
        message:
          'OTP PHP endpoint is not available on Vite dev server. Set VITE_PASSWORD_OTP_API_PATH to your PHP server URL (for example http://localhost/your-app/api/customer-password-otp.php).',
      }),
    )
  }
}

export function vitePluginPasswordOtp(): Plugin {
  return {
    name: 'password-otp-dev-hint',
    configureServer(server) {
      server.middlewares.use(createHandler())
    },
    configurePreviewServer(server) {
      server.middlewares.use(createHandler())
    },
  }
}
