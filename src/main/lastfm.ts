import { createHash } from 'crypto'
import https from 'https'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'

const CONFIG_PATH = join(app.getPath('userData'), 'lastfm-config.json')

interface LastFmConfig {
  apiKey: string
  apiSecret: string
  username: string
  sessionKey: string
}

let config: LastFmConfig | null = null

// ─── Config persistence ───────────────────────────────────────────────────────

function loadConfig(): void {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
      config = JSON.parse(raw)
    }
  } catch (_) {
    config = null
  }
}

function saveConfig(): void {
  if (!config) return
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

loadConfig()

// ─── Signing ──────────────────────────────────────────────────────────────────

function sign(params: Record<string, string>, secret: string): string {
  const str = Object.keys(params)
    .sort()
    .map((k) => k + params[k])
    .join('')
  return createHash('md5').update(str + secret, 'utf8').digest('hex')
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function apiPost(params: Record<string, string>): Promise<Record<string, any>> {
  const body = new URLSearchParams({ ...params, format: 'json' }).toString()

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'ws.audioscrobbler.com',
        path: '/2.0/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'MPlayer/1.0'
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (json.error) {
              reject(new Error(json.message || `Last.fm hata kodu: ${json.error}`))
            } else {
              resolve(json)
            }
          } catch (e) {
            reject(new Error('Last.fm invalid response'))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface LastFmStatus {
  connected: boolean
  username: string
  apiKey: string
  apiSecret: string
}

export function getLastFmStatus(): LastFmStatus {
  return {
    connected: !!(config?.sessionKey),
    username: config?.username ?? '',
    apiKey: config?.apiKey ?? '',
    apiSecret: config?.apiSecret ?? ''
  }
}

export async function authenticateLastFm(
  apiKey: string,
  apiSecret: string,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const sigParams: Record<string, string> = {
      method: 'auth.getMobileSession',
      api_key: apiKey,
      username,
      password
    }
    const api_sig = sign(sigParams, apiSecret)

    const result = await apiPost({ ...sigParams, api_sig })
    const sessionKey = result.session?.key as string | undefined

    if (!sessionKey) throw new Error('Could not retrieve session key')

    config = { apiKey, apiSecret, username, sessionKey }
    saveConfig()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function disconnectLastFm(): Promise<void> {
  config = null
  try { fs.unlinkSync(CONFIG_PATH) } catch (_) {}
}

export async function updateNowPlaying(
  artist: string,
  title: string,
  album: string,
  duration?: number
): Promise<void> {
  if (!config?.sessionKey) return

  const params: Record<string, string> = {
    method: 'track.updateNowPlaying',
    api_key: config.apiKey,
    sk: config.sessionKey,
    artist,
    track: title,
    album: album || ''
  }
  if (duration && duration > 0) {
    params.duration = Math.floor(duration).toString()
  }

  params.api_sig = sign(params, config.apiSecret)
  apiPost(params).catch((e) => console.error('[Last.fm] updateNowPlaying failed:', e.message))
}

export async function scrobble(
  artist: string,
  title: string,
  album: string,
  startTimestamp: number,
  duration?: number
): Promise<void> {
  if (!config?.sessionKey) return

  const timestamp = Math.floor(startTimestamp / 1000).toString()

  const params: Record<string, string> = {
    method: 'track.scrobble',
    api_key: config.apiKey,
    sk: config.sessionKey,
    artist,
    track: title,
    album: album || '',
    timestamp
  }
  if (duration && duration > 0) {
    params.duration = Math.floor(duration).toString()
  }

  params.api_sig = sign(params, config.apiSecret)

  try {
    await apiPost(params)
    console.log(`[Last.fm] Scrobbled: ${artist} - ${title}`)
  } catch (e: any) {
    console.error('[Last.fm] scrobble failed:', e.message)
  }
}
