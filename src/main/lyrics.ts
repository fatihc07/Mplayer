import { net } from 'electron'
import { getSavedLyrics, saveLyrics } from './database'

export interface LyricsResult {
  synced: boolean
  lrc: string
  source: string
}

export interface LrclibSearchResult {
  id: number
  trackName: string
  artistName: string
  albumName: string
  duration: number
  hasSynced: boolean
  syncedLyrics: string | null
  plainLyrics: string | null
}

/**
 * Fetch lyrics for a song. Priority:
 * 1. Cached in DB (previously fetched or user-imported)
 * 2. LRCLIB API (free, no API key)
 */
export async function getLyrics(
  songId: number,
  artist: string,
  title: string,
  album: string,
  duration: number
): Promise<LyricsResult | null> {
  // 1. Check DB cache
  const cached = getSavedLyrics(songId)
  if (cached) {
    return { synced: isSyncedLrc(cached), lrc: cached, source: 'cache' }
  }

  // 2. Try LRCLIB
  const lrclib = await fetchFromLrclib(artist, title, album, duration)
  if (lrclib) {
    saveLyrics(songId, lrclib.lrc, 'lrclib')
    return lrclib
  }

  return null
}

function isSyncedLrc(text: string): boolean {
  return /^\[\d{2}:\d{2}/.test(text)
}

async function fetchFromLrclib(
  artist: string,
  title: string,
  album: string,
  duration: number
): Promise<LyricsResult | null> {
  try {
    const params = new URLSearchParams({
      artist_name: artist || '',
      track_name: title || '',
      album_name: album || '',
      duration: String(Math.round(duration))
    })

    const url = `https://lrclib.net/api/get?${params.toString()}`
    const res = await net.fetch(url, {
      headers: {
        'User-Agent': 'MPlayer/1.0 (https://github.com/mplayer)',
        Accept: 'application/json'
      }
    })

    if (!res.ok) {
      // Try search endpoint without duration for broader match
      return await searchLrclib(artist, title)
    }

    const data = await res.json()

    // Prefer synced lyrics
    if (data.syncedLyrics) {
      return { synced: true, lrc: data.syncedLyrics, source: 'lrclib' }
    }
    if (data.plainLyrics) {
      return { synced: false, lrc: data.plainLyrics, source: 'lrclib' }
    }

    return null
  } catch {
    return null
  }
}

async function searchLrclib(
  artist: string,
  title: string
): Promise<LyricsResult | null> {
  try {
    const params = new URLSearchParams({
      artist_name: artist || '',
      track_name: title || ''
    })
    const url = `https://lrclib.net/api/search?${params.toString()}`
    const res = await net.fetch(url, {
      headers: {
        'User-Agent': 'MPlayer/1.0 (https://github.com/mplayer)',
        Accept: 'application/json'
      }
    })
    if (!res.ok) return null
    const results = await res.json()
    if (!Array.isArray(results) || results.length === 0) return null

    const best = results[0]
    if (best.syncedLyrics) {
      return { synced: true, lrc: best.syncedLyrics, source: 'lrclib' }
    }
    if (best.plainLyrics) {
      return { synced: false, lrc: best.plainLyrics, source: 'lrclib' }
    }
    return null
  } catch {
    return null
  }
}

export async function searchLrclibAll(
  query: string,
  artistHint?: string
): Promise<LrclibSearchResult[]> {
  try {
    const params = new URLSearchParams({ q: query })
    if (artistHint) params.set('artist_name', artistHint)
    const url = `https://lrclib.net/api/search?${params.toString()}`
    const res = await net.fetch(url, {
      headers: {
        'User-Agent': 'MPlayer/1.0 (https://github.com/mplayer)',
        Accept: 'application/json'
      }
    })
    if (!res.ok) return []
    const results = await res.json()
    if (!Array.isArray(results)) return []
    return results.slice(0, 30).map((r: any) => ({
      id: r.id,
      trackName: r.trackName ?? '',
      artistName: r.artistName ?? '',
      albumName: r.albumName ?? '',
      duration: r.duration ?? 0,
      hasSynced: !!r.syncedLyrics,
      syncedLyrics: r.syncedLyrics ?? null,
      plainLyrics: r.plainLyrics ?? null
    }))
  } catch {
    return []
  }
}
