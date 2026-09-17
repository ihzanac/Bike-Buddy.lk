import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { IncomingMessage } from 'node:http'
import Busboy from 'busboy'
import type { Connect, Plugin } from 'vite'

const ROUTE = '/api/upload/bike-image'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function mimeToExt(mime: string) {
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/gif') return '.gif'
  if (mime === 'image/webp') return '.webp'
  return extname(mime) || '.bin'
}

function safeOwner(id: string) {
  const s = id.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 64)
  return s || 'public'
}

function getOrigin(req: IncomingMessage) {
  const host = req.headers.host ?? 'localhost:5173'
  const forwarded = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim()
  const proto = forwarded || 'http'
  return `${proto}://${host}`
}

function createHandler(publicDir: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const pathOnly = (req.url ?? '').split('?')[0] ?? ''
    if (pathOnly !== ROUTE || req.method !== 'POST') {
      return next()
    }

    const bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_BYTES, files: 1 } })
    let ownerId = 'public'
    let fileErr: string | null = null
    let writePromise: Promise<string> | null = null
    bb.on('field', (name, val) => {
      if (name === 'ownerId' && typeof val === 'string' && val.trim()) ownerId = val.trim()
    })

    bb.on('file', (name, file, info) => {
      if (name !== 'file' && name !== 'image') {
        file.resume()
        return
      }
      if (writePromise) {
        file.resume()
        return
      }
      const { mimeType } = info
      if (!ALLOWED.has(mimeType)) {
        fileErr = 'Not an allowed image type (JPG, PNG, GIF, WebP).'
        file.resume()
        return
      }

      const sub = safeOwner(ownerId)
      const ext = mimeToExt(mimeType)
      const fname = `bike-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
      const underPublic = join('uploads', 'bikes', sub, fname)
      const abs = resolve(publicDir, underPublic)
      const urlPath = `/${relative(publicDir, abs).replace(/\\/g, '/')}`.replace(/\/+/g, '/')
      if (!urlPath.startsWith('/uploads/')) {
        fileErr = 'Invalid path'
        file.resume()
        return
      }

      writePromise = (async () => {
        await mkdir(dirname(abs), { recursive: true })
        await pipeline(file, createWriteStream(abs))
        return getOrigin(req) + urlPath
      })()
    })

    bb.on('error', (err: unknown) => {
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid upload' }),
        )
      }
    })

    bb.on('close', () => {
      void (async () => {
        if (res.headersSent) return
        try {
          if (fileErr) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: fileErr }))
            return
          }
          if (!writePromise) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'No image file in the request. Use the file field "file".' }))
            return
          }
          const url = await writePromise
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ url }))
        } catch {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: fileErr || 'Server error' }))
          }
        }
      })()
    })

    req.pipe(bb)
  }
}

export function vitePluginBikeImageUpload(): Plugin {
  return {
    name: 'bike-image-upload',
    configureServer(server) {
      const publicDir = resolve(server.config.root, 'public')
      server.middlewares.use(createHandler(publicDir))
    },
    configurePreviewServer(server) {
      const publicDir = resolve(server.config.root, 'public')
      server.middlewares.use(createHandler(publicDir))
    },
  }
}
