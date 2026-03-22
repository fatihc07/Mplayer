import { useState, useEffect, useRef, useCallback } from 'react'
import { FileUp, Trash2, Loader2, ChevronDown, Palette, Type, Timer, Minus, Plus, Search } from 'lucide-react'
import { usePlayerStore } from '../../stores/playerStore'
import { CoverArt } from '../shared/CoverArt'
import { formatDuration } from '../../utils/format'
import { LyricsSearchModal } from './LyricsSearchModal'
import { LYRICS_FONTS, loadGoogleFont } from '../../utils/lyricsFonts'

interface LrcLine { time: number; text: string }

const FONT_SIZES = [
  { label: 'S', value: 16 },
  { label: 'M', value: 20 },
  { label: 'L', value: 26 },
  { label: 'XL', value: 34 }
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

export function FullLyricsView({ onClose }: Props): JSX.Element {
  const { currentSong, progress, duration, isPlaying } = usePlayerStore()
  const [lines, setLines] = useState<LrcLine[]>([])
  const [plainText, setPlainText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(20)
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
    window.api.getSetting('fl_font_size').then(v => { if (v) setFontSize(Number(v)) })
    window.api.getSetting('fl_active_color').then(v => { if (v) setActiveColor(v) })
    window.api.getSetting('fl_font_family').then(v => {
      if (v) {
        setFontFamily(v)
        loadGoogleFont(v)
      }
    })
  }, [])

  const handleFontSize = useCallback((v: number) => {
    setFontSize(v)
    window.api.setSetting('fl_font_size', String(v))
  }, [])

  const handleColor = useCallback((v: string) => {
    setActiveColor(v)
    window.api.setSetting('fl_active_color', v)
  }, [])

  const handleFontFamily = useCallback((v: string) => {
    setFontFamily(v)
    window.api.setSetting('fl_font_family', v)
    loadGoogleFont(v)
  }, [])

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
    ).then((result: { synced: boolean; lrc: string } | null) => {
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

  const offsetSec = offsetMs / 1000
  const adjustedProgress = progress + offsetSec

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

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="fl-view">
      {/* Background blur from cover */}
      {currentSong && (
        <CoverArt
          songPath={currentSong.path}
          hasCover={!!currentSong.has_cover}
          className="fl-bg"
          asBackground
        />
      )}
      <div className="fl-bg-overlay" />

      {/* Header */}
      <div className="fl-header">
        <button className="fl-close-btn" onClick={onClose} title="Kapat">
          <ChevronDown size={22} />
        </button>
        <span className="fl-header-title">
          {isPlaying ? 'Now Playing' : 'Paused'}
        </span>
        <div className="fl-header-actions">
          <button className="fl-action-btn" onClick={handleImportLrc} title="Import LRC">
            <FileUp size={16} />
          </button>
          <button className="fl-action-btn" onClick={() => setShowSearch(true)} title="LRCLIB'de ara">
            <Search size={16} />
          </button>
          <button className="fl-action-btn" onClick={handleDeleteLyrics} title="Delete lyrics">
            <Trash2 size={16} />
          </button>
          <button
            className={`fl-action-btn${showSettings ? ' active' : ''}`}
            onClick={() => setShowSettings(s => !s)}
            title="Display settings"
          >
            <Palette size={16} />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="fl-settings">
          <div className="fl-setting-group">
            <Type size={14} />
            <span className="fl-setting-label">Font Size</span>
            <div className="fl-size-btns">
              {FONT_SIZES.map(s => (
                <button
                  key={s.value}
                  className={`fl-size-btn${fontSize === s.value ? ' active' : ''}`}
                  onClick={() => handleFontSize(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="fl-setting-group">
            <Type size={14} />
            <span className="fl-setting-label">Font</span>
            <select
              className="fl-font-select"
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
          <div className="fl-setting-group">
            <Palette size={14} />
            <span className="fl-setting-label">Aktif Renk</span>
            <div className="fl-color-btns">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  className={`fl-color-btn${activeColor === c.value ? ' active' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => handleColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="fl-setting-group">
            <Timer size={14} />
            <span className="fl-setting-label">Offset</span>
            <div className="fl-offset-ctrl">
              <button className="fl-offset-btn" onClick={() => changeOffset(-500)} title="-0.5s">
                <Minus size={13} />
              </button>
              <span className="fl-offset-val">
                {offsetMs >= 0 ? '+' : ''}{(offsetMs / 1000).toFixed(1)}s
              </span>
              <button className="fl-offset-btn" onClick={() => changeOffset(500)} title="+0.5s">
                <Plus size={13} />
              </button>
              {offsetMs !== 0 && (
                <button className="fl-offset-reset" onClick={() => {
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

      {/* Main content */}
      <div className="fl-content">
        {/* Left: cover art + song info */}
        <div className="fl-left">
          {currentSong ? (
            <>
              <CoverArt
                songPath={currentSong.path}
                hasCover={!!currentSong.has_cover}
                className="fl-cover"
                size={320}
              />
              <div className="fl-song-info">
                <h2 className="fl-song-title">{currentSong.title}</h2>
                <p className="fl-song-artist">{currentSong.artist}</p>
                {currentSong.album !== 'Unknown Album' && (
                  <p className="fl-song-album">{currentSong.album}</p>
                )}
              </div>
              {/* Mini progress */}
              <div className="fl-progress">
                <span className="fl-time">{formatDuration(progress)}</span>
                <div className="fl-progress-track">
                  <div className="fl-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="fl-time">{formatDuration(duration)}</span>
              </div>
            </>
          ) : (
            <div className="fl-no-song">
              <p>No song playing</p>
            </div>
          )}
        </div>

        {/* Right: lyrics */}
        <div className="fl-right" ref={containerRef}>
          {loading && (
            <div className="fl-lyrics-status">
              <Loader2 size={28} className="lyrics-spinner" />
              <p>Searching for lyrics...</p>
            </div>
          )}

          {error && !loading && (
            <div className="fl-lyrics-status">
              <p>{error}</p>
              <button className="lyrics-import-btn" onClick={handleImportLrc}>
                <FileUp size={14} /> Upload LRC File
              </button>
            </div>
          )}

          {lines.length > 0 && (
            <div className="fl-lyrics-synced">
              {lines.map((line, i) => (
                <div
                  key={i}
                  ref={i === activeIdx ? activeRef : null}
                  className={`fl-line${i === activeIdx ? ' active' : ''}${line.text === '' ? ' empty' : ''}`}
                  style={{
                    fontSize: i === activeIdx ? fontSize + 4 : fontSize,
                    color: i === activeIdx ? activeColor : undefined,
                    fontFamily: LYRICS_FONTS.find(f => f.name === fontFamily)?.css
                  }}
                >
                  {line.text || '♪'}
                </div>
              ))}
            </div>
          )}

          {plainText && lines.length === 0 && !loading && !error && (
            <div className="fl-lyrics-plain" style={{ fontSize, fontFamily: LYRICS_FONTS.find(f => f.name === fontFamily)?.css }}>
              {plainText}
            </div>
          )}
        </div>
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
