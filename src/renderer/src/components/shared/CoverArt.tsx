import { useState, useEffect, useRef, memo } from 'react'
import { Music } from 'lucide-react'

interface Props {
  songPath: string
  hasCover: boolean
  className?: string
  size?: number
  asBackground?: boolean
}

// LRU cache for loaded covers – evicts oldest entry when size exceeds 200
const MAX_COVER_CACHE = 200
const coverCache = new Map<string, string | null>()
function setCoverCache(key: string, val: string | null): void {
  if (coverCache.size >= MAX_COVER_CACHE) {
    coverCache.delete(coverCache.keys().next().value!)
  }
  coverCache.set(key, val)
}

export const CoverArt = memo(function CoverArt({
  songPath, hasCover, className = '', size = 48, asBackground = false
}: Props): JSX.Element {
  const [src, setSrc] = useState<string | null>(() => coverCache.get(songPath) ?? null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (!hasCover) { setSrc(null); return }
    if (coverCache.has(songPath)) { setSrc(coverCache.get(songPath)!); return }

    window.api.getCover(songPath).then((data) => {
      if (!mounted.current) return
      setCoverCache(songPath, data)
      setSrc(data)
    }).catch(() => {
      setCoverCache(songPath, null)
    })

    return () => { mounted.current = false }
  }, [songPath, hasCover])

  if (asBackground) {
    return (
      <div
        className={className}
        style={
          src
            ? { backgroundImage: `url("${src}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: 'linear-gradient(135deg,#312e81,#4c1d95)' }
        }
      />
    )
  }

  if (src) {
    return (
      <img
        src={src}
        alt="cover"
        className={className}
        width={size}
        height={size}
        style={{ objectFit: 'cover', borderRadius: 6 }}
        loading="lazy"
      />
    )
  }

  return (
    <div
      className={`${className} cover-placeholder`}
      style={{ width: size, height: size }}
    >
      <Music size={size * 0.4} />
    </div>
  )
})
