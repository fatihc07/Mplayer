export function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const s = Math.floor(seconds)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const ss = String(s % 60).padStart(2, '0')
  if (h > 0) {
    return `${h}:${String(m % 60).padStart(2, '0')}:${ss}`
  }
  return `${m}:${ss}`
}

export function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('tr-TR')
}

export function formatPlays(count: number): string {
  if (count <= 0) return ''
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M plays`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K plays`
  return `${count} plays`
}

export function getFormatBadge(path: string, bitrate: number): { label: string; isLossless: boolean } {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const lossless = new Set(['flac', 'wav', 'aiff', 'ape', 'alac', 'wv'])
  const isLossless = lossless.has(ext)
  const codec = ext.toUpperCase()
  if (isLossless) return { label: codec, isLossless: true }
  if (bitrate > 0) {
    const kbps = Math.round(bitrate / 1000)
    return { label: `${codec} · ${kbps}`, isLossless: false }
  }
  return { label: codec, isLossless: false }
}
