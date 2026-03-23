import { net } from 'electron'

export async function searchDeezer(query: string) {
  try {
    const res = await net.fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  } catch (err) {
    console.error('[Deezer] Search error:', err)
    return []
  }
}

export async function getDeezerTrackData(trackId: string, arl: string) {
  if (!arl) return null
  try {
    // 1. Get track data from internal API
    const res = await net.fetch(`https://www.deezer.com/ajax/gw.php?method=deezer.getTrackData&id=${trackId}`, {
      headers: {
        'Cookie': `arl=${arl}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.results || null
  } catch (err) {
    console.error('[Deezer] GetTrackData error:', err)
    return null
  }
}

/**
 * Note: Getting the final stream URL for high quality (FLAC/MP3 320)
 * often requires decrypting audio chunks (Blowfish).
 * For now, I will return the preview URL or attempt to get a direct URL if available.
 */
export async function getDeezerStreamUrl(trackId: string, arl: string) {
  const data = await getDeezerTrackData(trackId, arl)
  if (!data) return null
  
  const trackToken = data.TRACK_TOKEN
  if (!trackToken) return data.preview || null

  try {
    // Attempting to get full URL using trackToken
    const res = await net.fetch(`https://media.deezer.com/v1/get_url`, {
      method: 'POST',
      headers: {
        'Cookie': `arl=${arl}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        track_tokens: [trackToken],
        license_token: data.LICENSE_TOKEN,
        media_formats: ['MP3_128', 'MP3_320', 'FLAC']
      })
    })
    if (res.ok) {
      const mediaData = await res.json()
      const primaryUrl = mediaData.data?.[0]?.sources?.[0]?.url
      if (primaryUrl) return primaryUrl
    }
  } catch (err) {
    console.error('[Deezer] GetUrl error:', err)
  }

  // Fallback to preview
  return data.preview || null
}

