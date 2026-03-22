import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useI18n } from '../../i18n'
import { CoverArt } from '../shared/CoverArt'
import { toPng } from 'html-to-image'
import {
  Music, Mic2, Disc3, Clock, Flame, Star, Headphones,
  Sparkles, ChevronLeft, ChevronRight, Download
} from 'lucide-react'

interface WrappedData {
  period: string
  totalListeningTime: number
  totalPlays: number
  uniqueSongs: number
  uniqueArtists: number
  topSongs: any[]
  topArtists: any[]
  topAlbums: any[]
  topGenres: any[]
  hourlyActivity: number[]
  dailyActivity: number[]
  longestStreak: number
  avgDailyPlays: number
  newDiscoveries: number
  mostActiveHour: number
  mostActiveDay: number
}

type Period = 'week' | 'month' | 'all'

/* ── Recap-style card themes ── */
const CARD_THEMES = [
  { bg: '#000000', text: '#FFFFFF', accent: '#FFE100', mosaicColors: ['#FF0000', '#00CC55', '#FFE100', '#0033FF', '#FF6B00'] },
  { bg: '#000000', text: '#FFFFFF', accent: '#FFE100', mosaicColors: ['#FFE100', '#FF6B00', '#00CC55', '#FF0000', '#0033FF'] },
  { bg: '#0033FF', text: '#FFFFFF', accent: '#FFE100', mosaicColors: ['#FFE100', '#00CC55', '#FF0000', '#FF6B00', '#FFFFFF'] },
  { bg: '#FFE100', text: '#000000', accent: '#000000', mosaicColors: ['#FF0000', '#00CC55', '#0033FF', '#FF6B00', '#000000'] },
  { bg: '#000000', text: '#FFFFFF', accent: '#FFE100', mosaicColors: ['#FFE100', '#FF6B00', '#00CC55', '#FF0000'] },
  { bg: '#FF0000', text: '#FFFFFF', accent: '#FFE100', mosaicColors: ['#FFE100', '#00CC55', '#0033FF', '#FF6B00', '#FFFFFF'] },
  { bg: '#FFE100', text: '#000000', accent: '#0033FF', mosaicColors: ['#0033FF', '#00CC55', '#FF0000', '#FF6B00', '#000000'] },
  { bg: '#000000', text: '#FFFFFF', accent: '#FFE100', mosaicColors: ['#FF0000', '#00CC55', '#FFE100', '#0033FF', '#FF6B00'] },
]

/* Deterministic seeded random */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
}

/* Pixel mosaic border at top of each card */
function PixelMosaic({ colors, seed = 42 }: { colors: string[]; seed?: number }) {
  const blocks = useMemo(() => {
    const rng = seededRandom(seed)
    const rows = 5
    const result: { color: string; width: number }[][] = []
    for (let r = 0; r < rows; r++) {
      const row: { color: string; width: number }[] = []
      let remaining = 100
      while (remaining > 0) {
        const w = Math.max(3, Math.min(remaining, Math.floor(rng() * 18) + 3))
        row.push({ color: colors[Math.floor(rng() * colors.length)], width: w })
        remaining -= w
      }
      result.push(row)
    }
    return result
  }, [colors, seed])

  return (
    <div className="wrc-pixel-mosaic" aria-hidden="true">
      {blocks.map((row, r) => (
        <div key={r} className="wrc-pixel-row">
          {row.map((block, b) => (
            <div
              key={b}
              className="wrc-pixel-block"
              style={{ backgroundColor: block.color, flex: `0 0 ${block.width}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/* RECAP badge */
function RecapBadge({ color = '#FFE100' }: { color?: string }) {
  return (
    <div className="wrc-recap-badge" style={{ borderColor: color, color }}>
      RECAP
    </div>
  )
}

export function WrappedView(): JSX.Element {
  const { t } = useI18n()
  const [period, setPeriod] = useState<Period>('all')
  const [data, setData] = useState<WrappedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [card, setCard] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setCard(0)
    window.api.getWrapped(period).then((d: WrappedData) => {
      setData(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [period])

  const totalCards = 8
  const go = useCallback((dir: 1 | -1) => {
    setCard(c => {
      const next = c + dir
      if (next < 0 || next >= totalCards) return c
      setAnimKey(k => k + 1)
      return next
    })
  }, [totalCards])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go])

  const formatMinutes = (secs: number) => {
    const m = Math.round(secs / 60)
    return m.toLocaleString()
  }

  const downloadCard = useCallback(async () => {
    if (!cardRef.current) return
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `mplayer-recap-${card + 1}.png`
      link.href = dataUrl
      link.click()
    } catch (e) {
      console.error('Failed to download card:', e)
    }
  }, [card])

  if (loading) {
    return (
      <div className="wr-loading">
        <div className="wr-loading-spinner" />
        <p>{t.loading}</p>
      </div>
    )
  }

  if (!data || data.totalPlays === 0) {
    return (
      <div className="wr-empty">
        <Sparkles size={48} />
        <h2>{t.wrappedTitle}</h2>
        <p>{t.noData}</p>
      </div>
    )
  }

  const maxHourly = Math.max(...data.hourlyActivity, 1)
  const theme = CARD_THEMES[card] || CARD_THEMES[0]

  return (
    <div className="wrc-root">
      {/* Story progress bar */}
      <div className="wrc-story-bar">
        {Array.from({ length: totalCards }).map((_, i) => (
          <div key={i} className="wrc-story-seg" onClick={() => { setCard(i); setAnimKey(k => k + 1) }}>
            <div className={`wrc-story-fill ${i < card ? 'done' : ''} ${i === card ? 'active' : ''}`} />
          </div>
        ))}
      </div>

      {/* Period selector + Download button */}
      <div className="wrc-topbar">
        <div className="wrc-period-selector">
          {(['week', 'month', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              className={`wrc-period-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'week' ? t.wrappedWeek : p === 'month' ? t.wrappedMonth : t.wrappedAll}
            </button>
          ))}
        </div>
        <button className="wrc-download-btn" onClick={downloadCard} title="Download card">
          <Download size={18} />
        </button>
      </div>

      {/* Card viewport */}
      <div className="wrc-viewport">
        {/* Nav arrows */}
        {card > 0 && (
          <button className="wrc-nav wrc-nav-left" onClick={() => go(-1)}>
            <ChevronLeft size={28} />
          </button>
        )}
        {card < totalCards - 1 && (
          <button className="wrc-nav wrc-nav-right" onClick={() => go(1)}>
            <ChevronRight size={28} />
          </button>
        )}

        {/* ═══ Card 0: Intro / Music RECAP ═══ */}
        {card === 0 && (
          <div className="wrc-card wrc-card-anim" key={`c0-${animKey}`} ref={cardRef} style={{ background: theme.bg }}>
            <PixelMosaic colors={theme.mosaicColors} seed={101} />
            <div className="wrc-card-inner wrc-center">
              <p className="wrc-intro-label" style={{ color: theme.accent }}>
                {period === 'week' ? t.wrappedWeek : period === 'month' ? t.wrappedMonth : t.wrappedAll}
              </p>
              <h1 className="wrc-intro-title" style={{ color: theme.text }}>Music</h1>
              <h1 className="wrc-intro-title wrc-intro-recap" style={{ color: theme.accent }}>RECAP</h1>
              <div className="wrc-intro-stats">
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{data.totalPlays.toLocaleString()} {t.plays}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>&middot;</span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{data.uniqueSongs} {t.songs}</span>
              </div>
            </div>
            <RecapBadge color={theme.accent} />
          </div>
        )}

        {/* ═══ Card 1: My Top Songs (list 1-5) ═══ */}
        {card === 1 && (
          <div className="wrc-card wrc-card-anim" key={`c1-${animKey}`} ref={cardRef} style={{ background: theme.bg }}>
            <PixelMosaic colors={theme.mosaicColors} seed={202} />
            <div className="wrc-card-inner">
              <h2 className="wrc-card-heading" style={{ color: theme.text }}>My Top Songs</h2>
              <div className="wrc-ranked-list">
                {data.topSongs.slice(0, 5).map((s: any, i: number) => (
                  <div key={i} className="wrc-ranked-item wrc-list-anim" style={{ animationDelay: `${i * 80}ms` }}>
                    <span className="wrc-rank-num" style={{ color: theme.accent }}>
                      {i + 1}
                    </span>
                    <CoverArt songPath={s.path} hasCover={!!s.has_cover} size={48} className="wrc-ranked-cover" />
                    <div className="wrc-ranked-info">
                      <span className="wrc-ranked-name" style={{ color: theme.text }}>{s.title}</span>
                      <span className="wrc-ranked-sub" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.artist}</span>
                    </div>
                    <span className="wrc-ranked-plays" style={{ color: theme.accent }}>{s.total_plays}</span>
                  </div>
                ))}
              </div>
            </div>
            <RecapBadge color={theme.accent} />
          </div>
        )}

        {/* ═══ Card 2: My Top Artists (list 1-5) ═══ */}
        {card === 2 && (
          <div className="wrc-card wrc-card-anim" key={`c2-${animKey}`} ref={cardRef} style={{ background: theme.bg }}>
            <PixelMosaic colors={theme.mosaicColors} seed={303} />
            <div className="wrc-card-inner">
              <h2 className="wrc-card-heading" style={{ color: theme.text }}>My Top Artists</h2>
              <div className="wrc-ranked-list">
                {data.topArtists.slice(0, 5).map((a: any, i: number) => (
                  <div key={i} className="wrc-ranked-item wrc-list-anim" style={{ animationDelay: `${i * 80}ms` }}>
                    <span className="wrc-rank-num" style={{ color: theme.accent }}>
                      {i + 1}
                    </span>
                    <div className="wrc-ranked-avatar">
                      {a.cover_path ? (
                        <CoverArt songPath={a.cover_path} hasCover size={48} className="wrc-ranked-avatar-img" />
                      ) : (
                        <span className="wrc-ranked-avatar-letter">{a.artist.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="wrc-ranked-info">
                      <span className="wrc-ranked-name" style={{ color: theme.text }}>{a.artist}</span>
                      <span className="wrc-ranked-sub" style={{ color: 'rgba(255,255,255,0.45)' }}>{a.song_count} {t.songs}</span>
                    </div>
                    <span className="wrc-ranked-plays" style={{ color: theme.accent }}>{a.total_plays}</span>
                  </div>
                ))}
              </div>
            </div>
            <RecapBadge color={theme.accent} />
          </div>
        )}

        {/* ═══ Card 3: My Top Song (hero) ═══ */}
        {card === 3 && data.topSongs[0] && (
          <div className="wrc-card wrc-card-anim" key={`c3-${animKey}`} ref={cardRef} style={{ background: theme.bg }}>
            <PixelMosaic colors={theme.mosaicColors} seed={404} />
            <div className="wrc-card-inner wrc-center">
              <h2 className="wrc-card-heading" style={{ color: theme.text }}>My Top Song</h2>
              <div className="wrc-hero-cover">
                <CoverArt songPath={data.topSongs[0].path} hasCover={!!data.topSongs[0].has_cover} size={200} className="wrc-hero-cover-img" />
              </div>
              <h3 className="wrc-hero-song-title" style={{ color: theme.text }}>{data.topSongs[0].title}</h3>
              <p className="wrc-hero-song-artist" style={{ color: theme.accent }}>{data.topSongs[0].artist}</p>
              <div className="wrc-hero-streams" style={{ color: theme.text }}>
                Total Streams <strong>{data.topSongs[0].total_plays}</strong>
              </div>
            </div>
            <RecapBadge color={theme.accent} />
          </div>
        )}

        {/* ═══ Card 4: My Minutes Listened ═══ */}
        {card === 4 && (
          <div className="wrc-card wrc-card-anim" key={`c4-${animKey}`} ref={cardRef} style={{ background: theme.bg }}>
            <PixelMosaic colors={theme.mosaicColors} seed={505} />
            <div className="wrc-card-inner wrc-center">
              <h2 className="wrc-card-heading" style={{ color: theme.text }}>My Minutes Listened</h2>
              <div className="wrc-mega-number" style={{ color: theme.accent }}>{formatMinutes(data.totalListeningTime)}</div>
              <p className="wrc-mega-label" style={{ color: 'rgba(255,255,255,0.45)' }}>minutes</p>
              <div className="wrc-minutes-stats">
                <div className="wrc-minutes-stat">
                  <span className="wrc-minutes-stat-val" style={{ color: theme.accent }}>{data.totalPlays.toLocaleString()}</span>
                  <span className="wrc-minutes-stat-lbl">{t.totalPlays}</span>
                </div>
                <div className="wrc-minutes-stat">
                  <span className="wrc-minutes-stat-val" style={{ color: theme.accent }}>{data.uniqueSongs}</span>
                  <span className="wrc-minutes-stat-lbl">{t.uniqueSongs}</span>
                </div>
                <div className="wrc-minutes-stat">
                  <span className="wrc-minutes-stat-val" style={{ color: theme.accent }}>{data.uniqueArtists}</span>
                  <span className="wrc-minutes-stat-lbl">{t.uniqueArtists}</span>
                </div>
              </div>
            </div>
            <RecapBadge color={theme.accent} />
          </div>
        )}

        {/* ═══ Card 5: Top Albums ═══ */}
        {card === 5 && (
          <div className="wrc-card wrc-card-anim" key={`c5-${animKey}`} ref={cardRef} style={{ background: theme.bg }}>
            <PixelMosaic colors={theme.mosaicColors} seed={606} />
            <div className="wrc-card-inner">
              <h2 className="wrc-card-heading" style={{ color: theme.text }}>My Top Albums</h2>
              <div className="wrc-ranked-list">
                {data.topAlbums.slice(0, 5).map((a: any, i: number) => (
                  <div key={i} className="wrc-ranked-item wrc-list-anim" style={{ animationDelay: `${i * 80}ms` }}>
                    <span className="wrc-rank-num" style={{ color: theme.accent }}>
                      {i + 1}
                    </span>
                    {a.cover_path ? (
                      <CoverArt songPath={a.cover_path} hasCover size={48} className="wrc-ranked-cover" />
                    ) : (
                      <div className="wrc-album-placeholder"><Disc3 size={20} /></div>
                    )}
                    <div className="wrc-ranked-info">
                      <span className="wrc-ranked-name" style={{ color: theme.text }}>{a.album}</span>
                      <span className="wrc-ranked-sub" style={{ color: 'rgba(255,255,255,0.45)' }}>{a.artist}</span>
                    </div>
                    <span className="wrc-ranked-plays" style={{ color: theme.accent }}>{a.total_plays}</span>
                  </div>
                ))}
              </div>
            </div>
            <RecapBadge color={theme.accent} />
          </div>
        )}

        {/* ═══ Card 6: Genres + Activity ═══ */}
        {card === 6 && (
          <div className="wrc-card wrc-card-anim" key={`c6-${animKey}`} ref={cardRef} style={{ background: theme.bg }}>
            <PixelMosaic colors={theme.mosaicColors} seed={707} />
            <div className="wrc-card-inner">
              <h2 className="wrc-card-heading" style={{ color: theme.text }}>My Genres</h2>
              <div className="wrc-genre-grid">
                {data.topGenres.slice(0, 5).map((g: any, i: number) => {
                  const pct = (g.total_plays / (data.topGenres[0]?.total_plays || 1)) * 100
                  return (
                    <div key={i} className="wrc-genre-bar-item wrc-list-anim" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="wrc-genre-bar-header">
                        <span className="wrc-genre-name" style={{ color: theme.text }}>{g.genre || 'Unknown'}</span>
                        <span className="wrc-genre-plays" style={{ color: theme.accent }}>{g.total_plays}</span>
                      </div>
                      <div className="wrc-genre-bar-track" style={{ background: `${theme.accent}22` }}>
                        <div className="wrc-genre-bar-fill" style={{ width: `${pct}%`, background: theme.accent }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="wrc-activity-section">
                <p className="wrc-card-sublabel" style={{ color: theme.accent }}>Listening Clock</p>
                <div className="wrc-hour-bars">
                  {data.hourlyActivity.map((val, h) => (
                    <div key={h} className="wrc-hbar-col">
                      <div
                        className={`wrc-hbar ${h === data.mostActiveHour ? 'wrc-hbar-peak' : ''}`}
                        style={{
                          height: `${(val / maxHourly) * 100}%`,
                          background: h === data.mostActiveHour ? theme.accent : `${theme.accent}40`
                        }}
                      />
                      {h % 6 === 0 && <span className="wrc-hbar-lbl" style={{ color: `${theme.text}66` }}>{String(h).padStart(2, '0')}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <RecapBadge color={theme.accent} />
          </div>
        )}

        {/* ═══ Card 7: Summary RECAP ═══ */}
        {card === 7 && (
          <div className="wrc-card wrc-card-anim" key={`c7-${animKey}`} ref={cardRef} style={{ background: theme.bg }}>
            <PixelMosaic colors={theme.mosaicColors} seed={808} />
            <div className="wrc-card-inner">
              <h2 className="wrc-card-heading" style={{ color: theme.accent }}>Your RECAP</h2>
              <div className="wrc-summary-cols">
                {/* Left: Top Artists */}
                <div className="wrc-summary-col">
                  <p className="wrc-summary-col-title" style={{ color: theme.accent }}>Top Artists</p>
                  {data.topArtists.slice(0, 3).map((a: any, i: number) => (
                    <div key={i} className="wrc-summary-row">
                      <span className="wrc-summary-rank" style={{ color: theme.accent }}>{i + 1}</span>
                      <span className="wrc-summary-name" style={{ color: theme.text }}>{a.artist}</span>
                    </div>
                  ))}
                </div>
                {/* Right: Top Songs */}
                <div className="wrc-summary-col">
                  <p className="wrc-summary-col-title" style={{ color: theme.accent }}>Top Songs</p>
                  {data.topSongs.slice(0, 3).map((s: any, i: number) => (
                    <div key={i} className="wrc-summary-row">
                      <span className="wrc-summary-rank" style={{ color: theme.accent }}>{i + 1}</span>
                      <span className="wrc-summary-name" style={{ color: theme.text }}>{s.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Center cover art */}
              {data.topSongs[0] && (
                <div className="wrc-summary-cover">
                  <CoverArt songPath={data.topSongs[0].path} hasCover={!!data.topSongs[0].has_cover} size={100} className="wrc-summary-cover-img" />
                </div>
              )}
              <div className="wrc-summary-minutes">
                <span className="wrc-summary-minutes-label" style={{ color: 'rgba(255,255,255,0.45)' }}>Minutes Listened</span>
                <span className="wrc-summary-minutes-val" style={{ color: theme.accent }}>{formatMinutes(data.totalListeningTime)}</span>
              </div>
            </div>
            <RecapBadge color={theme.accent} />
          </div>
        )}

      </div>
    </div>
  )
}
