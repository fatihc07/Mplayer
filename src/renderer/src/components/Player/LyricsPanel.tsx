import { useState, useEffect, useRef, useCallback } from 'react'
import { X, FileUp, Trash2, Loader2, Palette, Type, Timer, Minus, Plus, Search } from 'lucide-react'
import { usePlayerStore } from '../../stores/playerStore'
import { LyricsSearchModal } from './LyricsSearchModal'
import { LYRICS_FONTS, loadGoogleFont } from '../../utils/lyricsFonts'

const FONT_SIZES = [
  { label: 'S', value: 13 },
  { label: 'M', value: 15 },
  { label: 'L', value: 18 },
  { label: 'XL', value: 22 }
]

const COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Pink', value: '#F43F5E' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Green', value: '#10B981' },
  { label: 'Orange', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' }
]

interface LrcLine { time: number; text: string }

function parseLrc(lrc: string): LrcLine[] {
  const lines: LrcLine[] = []
  for (const raw of lrc.split('\n')) {
    const match = raw.match(/^\[(\d{2}):(\d{2})(?:[.:]\d{2,3})?\]\s?(.*)/)
    if (match) {
      const mins = parseInt(match[1], 10)
      const secs = parseInt(match[2], 10)
      lines.push({ time: mins * 60 + secs, text: match[3].trim() })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

interface Props {
  onClose: () => void
}

export function LyricsPanel({ onClose }: Props): JSX.Element {
  const { currentSong, progress } = usePlayerStore()
  const [lines, setLines] = useState<LrcLine[]>([])
  const [plainText, setPlainText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(15)
  const [activeColor, setActiveColor] = useState('#ffffff')
  const [fontFamily, setFontFamily] = useState('System Default')
  const [offsetMs, setOffsetMs] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const activeRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastSongIdRef = useRef<number | null>(null)
  const offsetSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load persisted font size, color and font on mount
  useEffect(() => {
    window.api.getSetting('lyrics_font_size').then(v => { if (v) setFontSize(Number(v)) })
    window.api.getSetting('lyrics_active_color').then(v => { if (v) setActiveColor(v) })
    window.api.getSetting('lyrics_font_family').then(v => {
      if (v) {
        setFontFamily(v)
        loadGoogleFont(v)
      }
    })
  }, [])

  // Save font size when changed
  const handleFontSize = useCallback((v: number) => {
    setFontSize(v)
    window.api.setSetting('lyrics_font_size', String(v))
  }, [])

  // Save color when changed
  const handleColor = useCallback((v: string) => {
    setActiveColor(v)
    window.api.setSetting('lyrics_active_color', v)
  }, [])

  // Save font family when changed
  const handleFontFamily = useCallback((v: string) => {
    setFontFamily(v)
    window.api.setSetting('lyrics_font_family', v)
    loadGoogleFont(v)
  }, [])

  // Fetch lyrics + offset when song changes
  useEffect(() => {
    if (!currentSong) {
      setLines([])
      setPlainText(null)
      setError(null)
      setOffsetMs(0)
      return
    }
    if (currentSong.id === lastSongIdRef.current) return
    lastSongIdRef.current = currentSong.id

    setLines([])
    setPlainText(null)
    setError(null)
    setLoading(true)
    setOffsetMs(0)

    // Load offset for this song
    window.api.getLyricsOffset(currentSong.id).then(o => setOffsetMs(o ?? 0))

    window.api.getLyrics(
      currentSong.id,
      currentSong.artist,
      currentSong.title,
      currentSong.album,
      currentSong.duration
    ).then((result) => {
      if (!result) {
        setError('Lyrics not found')
        setLoading(false)
        return
      }
      if (result.synced) {
        setLines(parseLrc(result.lrc))
      } else {
        setPlainText(result.lrc)
      }
      setLoading(false)
    }).catch(() => {
      setError('Could not load lyrics')
      setLoading(false)
    })
  }, [currentSong?.id])

  // Offset in seconds for active line calculation
  const offsetSec = offsetMs / 1000
  const adjustedProgress = progress + offsetSec

  // Find active line index
  const activeIdx = lines.length > 0
    ? (() => {
        let idx = 0
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].time <= adjustedProgress) idx = i
          else break
        }
        return idx
      })()
    : -1

  // Auto-scroll to active line
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current
      const el = activeRef.current
      const containerH = container.clientHeight
      const elTop = el.offsetTop
      const elH = el.offsetHeight
      const target = elTop - containerH / 2 + elH / 2
      container.scrollTo({ top: target, behavior: 'smooth' })
    }
  }, [activeIdx])

  // Offset change with debounced save
  const changeOffset = useCallback((delta: number) => {
    setOffsetMs(prev => {
      const next = prev + delta
      if (offsetSaveTimer.current) clearTimeout(offsetSaveTimer.current)
      offsetSaveTimer.current = setTimeout(() => {
        if (currentSong) window.api.saveLyricsOffset(currentSong.id, next)
      }, 600)
      return next
    })
  }, [currentSong?.id])

  const handleImportLrc = useCallback(async () => {
    if (!currentSong) return
    const lrcContent = await window.api.importLrc()
    if (!lrcContent) return

    await window.api.saveLyrics(currentSong.id, lrcContent, 'user')
    lastSongIdRef.current = null
    const parsed = parseLrc(lrcContent)
    if (parsed.length > 0) {
      setLines(parsed)
      setPlainText(null)
    } else {
      setPlainText(lrcContent)
      setLines([])
    }
    setError(null)
  }, [currentSong?.id])

  const handleDeleteLyrics = useCallback(async () => {
    if (!currentSong) return
    await window.api.deleteLyrics(currentSong.id)
    setLines([])
    setPlainText(null)
    setError('Lyrics deleted')
    lastSongIdRef.current = null
  }, [currentSong?.id])

  const handleSearchSelect = useCallback((lrc: string) => {
    setShowSearch(false)
    lastSongIdRef.current = null
    const parsed = parseLrc(lrc)
    if (parsed.length > 0) {
      setLines(parsed)
      setPlainText(null)
    } else {
      setPlainText(lrc)
      setLines([])
    }
    setError(null)
  }, [])

  return (
    <div className="lyrics-panel">
      <div className="lyrics-header">
        <h3 className="lyrics-title">Lyrics</h3>
        <div className="lyrics-header-actions">
          <button className="lyrics-action-btn" onClick={handleImportLrc} title="Import LRC file">
            <FileUp size={15} />
          </button>
          <button className="lyrics-action-btn" onClick={() => setShowSearch(true)} title="LRCLIB'de ara">
            <Search size={15} />
          </button>
          <button className="lyrics-action-btn" onClick={handleDeleteLyrics} title="Delete lyrics">
            <Trash2 size={15} />
          </button>
          <button
            className={`lyrics-action-btn${showSettings ? ' active' : ''}`}
            onClick={() => setShowSettings(s => !s)}
            title="Display settings"
          >
            <Palette size={15} />
          </button>
          <button className="lyrics-close-btn" onClick={onClose} title="Kapat">
            <X size={16} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="lp-settings">
          <div className="lp-setting-group">
            <Type size={13} />
            <span className="lp-setting-label">Size</span>
            <div className="lp-size-btns">
              {FONT_SIZES.map(s => (
                <button
                  key={s.value}
                  className={`lp-size-btn${fontSize === s.value ? ' active' : ''}`}
                  onClick={() => handleFontSize(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="lp-setting-group">
            <Type size={13} />
            <span className="lp-setting-label">Font</span>
            <select
              className="lp-font-select"
              value={fontFamily}
              onChange={e => handleFontFamily(e.target.value)}
            >
              {LYRICS_FONTS.map(f => (
                <option key={f.name} value={f.name} style={{ fontFamily: f.css }}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="lp-setting-group">
            <Palette size={13} />
            <span className="lp-setting-label">Color</span>
            <div className="lp-color-btns">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  className={`lp-color-btn${activeColor === c.value ? ' active' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => handleColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="lp-setting-group">
            <Timer size={13} />
            <span className="lp-setting-label">Offset</span>
            <div className="lp-offset-ctrl">
              <button className="lp-offset-btn" onClick={() => changeOffset(-500)} title="-0.5s">
                <Minus size={12} />
              </button>
              <span className="lp-offset-val">
                {offsetMs >= 0 ? '+' : ''}{(offsetMs / 1000).toFixed(1)}s
              </span>
              <button className="lp-offset-btn" onClick={() => changeOffset(500)} title="+0.5s">
                <Plus size={12} />
              </button>
              {offsetMs !== 0 && (
                <button className="lp-offset-reset" onClick={() => {
                  setOffsetMs(0)
                  if (currentSong) window.api.saveLyricsOffset(currentSong.id, 0)
                }}>
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="lyrics-body" ref={containerRef}>
        {loading && (
          <div className="lyrics-status">
            <Loader2 size={24} className="lyrics-spinner" />
            <p>Sözler aranıyor...</p>
          </div>
        )}

        {error && !loading && (
          <div className="lyrics-status">
            <p>{error}</p>
            <button className="lyrics-import-btn" onClick={handleImportLrc}>
              <FileUp size={14} /> Upload LRC File
            </button>
          </div>
        )}

        {/* Synced lyrics */}
        {lines.length > 0 && (
          <div className="lyrics-synced">
            {lines.map((line, i) => (
              <div
                key={i}
                ref={i === activeIdx ? activeRef : null}
                className={`lyrics-line${i === activeIdx ? ' active' : ''}${
                  line.text === '' ? ' empty' : ''
                }`}
                style={{
                  fontSize: i === activeIdx ? fontSize + 2 : fontSize,
                  color: i === activeIdx ? activeColor : undefined,
                  fontFamily: LYRICS_FONTS.find(f => f.name === fontFamily)?.css
                }}
              >
                {line.text || '♪'}
              </div>
            ))}
          </div>
        )}

        {/* Plain text lyrics */}
        {plainText && lines.length === 0 && !loading && !error && (
          <div className="lyrics-plain" style={{ fontFamily: LYRICS_FONTS.find(f => f.name === fontFamily)?.css }}>
            {plainText}
          </div>
        )}
      </div>

      {showSearch && currentSong && (
        <LyricsSearchModal
          songId={currentSong.id}
          initialQuery={currentSong.title}
          initialArtist={currentSong.artist}
          onSelect={handleSearchSelect}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  )
}
