/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type ViteDevServer } from 'vite'

const CCTV_ROUTE = '/api/cctv'

export default defineConfig({
  plugins: [react(), cctvProxyPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The simulation is pure TypeScript; node env keeps tests fast and
    // deterministic. Forks pool avoids a worker-exit edge case on Node 26.
    pool: 'forks',
  },
})

function cctvProxyPlugin() {
  return {
    name: 'blackglass-public-cctv-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(CCTV_ROUTE)) {
          next()
          return
        }

        try {
          const requestUrl = new URL(req.url, 'http://localhost')
          if (requestUrl.pathname === `${CCTV_ROUTE}/opencctv`) {
            await proxyOpenCctvCamera(requestUrl, res)
            return
          }
          if (requestUrl.pathname === `${CCTV_ROUTE}/hls`) {
            await proxyHlsAsset(requestUrl, res)
            return
          }
          writeProxyError(res, 404, 'unknown CCTV proxy route')
        } catch (error) {
          writeProxyError(res, 502, error instanceof Error ? error.message : 'CCTV proxy failed')
        }
      })
    },
  }
}

async function proxyOpenCctvCamera(requestUrl: URL, res: import('node:http').ServerResponse) {
  const pageUrl = requestUrl.searchParams.get('url')
  if (!pageUrl || !pageUrl.startsWith('https://opencctv.org/cameras/')) {
    writeProxyError(res, 400, 'missing OpenCCTV camera URL')
    return
  }

  const pageResponse = await fetch(pageUrl, { headers: proxyHeaders('https://opencctv.org/') })
  if (!pageResponse.ok) throw new Error(`OpenCCTV page ${pageResponse.status}`)
  const html = await pageResponse.text()
  const signedSource = decodeHtmlAttr(readHtmlAttr(html, 'data-src'))
  const directHls = decodeHtmlAttr(readFirstMatch(html, /href="(https:\/\/[^"]+?\.m3u8)"/))
  const sourceUrl = signedSource?.startsWith('/api/hls/') ? new URL(signedSource, 'https://opencctv.org').toString() : directHls
  if (!sourceUrl) {
    writeProxyError(res, 404, 'no public HLS URL found on source page')
    return
  }

  const sourceResponse = await fetch(sourceUrl, { headers: proxyHeaders(pageUrl) })
  if (!sourceResponse.ok) throw new Error(`OpenCCTV HLS ${sourceResponse.status}`)
  const playlist = await sourceResponse.text()
  writeM3u8(res, rewritePlaylist(playlist, sourceUrl, pageUrl))
}

async function proxyHlsAsset(requestUrl: URL, res: import('node:http').ServerResponse) {
  const sourceUrl = requestUrl.searchParams.get('src')
  const referer = requestUrl.searchParams.get('referer') ?? 'https://opencctv.org/'
  if (!sourceUrl || !sourceUrl.startsWith('https://')) {
    writeProxyError(res, 400, 'missing HLS source URL')
    return
  }

  const response = await fetch(sourceUrl, { headers: proxyHeaders(referer) })
  if (!response.ok) throw new Error(`HLS asset ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('mpegurl') || sourceUrl.includes('.m3u8')) {
    writeM3u8(res, rewritePlaylist(await response.text(), sourceUrl, referer))
    return
  }

  res.statusCode = 200
  res.setHeader('content-type', contentType || 'video/mp2t')
  res.setHeader('cache-control', 'public, max-age=30')
  const buffer = Buffer.from(await response.arrayBuffer())
  res.end(buffer)
}

function rewritePlaylist(playlist: string, baseUrl: string, referer: string): string {
  return playlist
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#EXT-X-KEY') && trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/, (_match, keyUri: string) => `URI="${proxiedHlsUrl(new URL(keyUri, baseUrl).toString(), referer)}"`)
      }
      if (trimmed.startsWith('#')) return line
      return proxiedHlsUrl(new URL(trimmed, baseUrl).toString(), referer)
    })
    .join('\n')
}

function proxiedHlsUrl(sourceUrl: string, referer: string): string {
  return `${CCTV_ROUTE}/hls?src=${encodeURIComponent(sourceUrl)}&referer=${encodeURIComponent(referer)}`
}

function proxyHeaders(referer: string): Record<string, string> {
  return {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'referer': referer,
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0 Safari/537.36',
  }
}

function readHtmlAttr(html: string, attr: string): string | null {
  return readFirstMatch(html, new RegExp(`${attr}="([^"]+)"`))
}

function readFirstMatch(html: string, pattern: RegExp): string | null {
  return pattern.exec(html)?.[1] ?? null
}

function decodeHtmlAttr(value: string | null): string | null {
  if (!value) return null
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

function writeM3u8(res: import('node:http').ServerResponse, body: string) {
  res.statusCode = 200
  res.setHeader('content-type', 'application/vnd.apple.mpegurl')
  res.setHeader('cache-control', 'no-cache')
  res.end(body)
}

function writeProxyError(res: import('node:http').ServerResponse, status: number, message: string) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ error: message }))
}
