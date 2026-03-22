import { useState, useEffect, useMemo } from 'react'
import { Heart, Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { Song } from '../../types'
import { CoverArt } from '../shared/CoverArt'
import { showSongContextMenu } from '../shared/SongContextMenu'
import { formatDuration, formatPlays } from '../../utils/format'
import { useI18n } from '../../i18n'

export function TrendsView(): JSX.Element {
  const { trending, recent, songs, artists, loadSongs, toggleFavorite, loadHistory, history, setArtistDetail } = useLibraryStore()
  const { playSong, currentSong } = usePlayerStore()
  const { t } = useI18n()
  const [heroIdx, setHeroIdx] = useState(0)
  const [recentScroll, setRecentScroll] = useState(0)

  useEffect(() => {
    if (!songs.length) loadSongs()
    if (!history.length) loadHistory(20, 0)
  }, [])

  // Hero: top played artists (first 6)
  const heroArtists = artists.slice(0, 6)
  const heroArtist = heroArtists[heroIdx] ?? null

  // Top artists circular row - show up to 15 to fill space
  const displayLimit = 15
  const topArtistsList = artists.slice(0, displayLimit)
  const remainingArtists = Math.max(0, artists.length - displayLimit)

  // Recently played from history (unique songs)
  const recentPlayed = useMemo(() => {
    const seen = new Set<number>()
    const result: typeof history = []
    for (const h of history) {
      if (!seen.has(h.song_id) && result.length < 8) {
        seen.add(h.song_id)
        result.push(h)
      }
    }
    return result
  }, [history])

  // Most played songs (top 6)
  const mostPlayed = trending.slice(0, 6)

  const heroNext = () => setHeroIdx(i => Math.min(i + 1, heroArtists.length - 1))
  const heroPrev = () => setHeroIdx(i => Math.max(0, i - 1))

  const playFromTrending = (song: Song) => playSong(song, trending, trending.indexOf(song))

  return (
    <div className="trv2">
      {/* ── Left Main Area ─────────────────────────────────────────── */}
      <div className="trv2-main">
        {/* Hero Banner */}
        <div className="trv2-hero">
          {heroArtist ? (
            <div className="trv2-hero-card" onClick={() => setArtistDetail(heroArtist.name)}>
              <CoverArt
                songPath={heroArtist.cover_path || ''}
                hasCover={!!heroArtist.cover_path}
                className="trv2-hero-bg"
                asBackground
              />
              <div className="trv2-hero-overlay" />
              <div className="trv2-hero-content">
                <h1 className="trv2-hero-title">{heroArtist.name}</h1>
                <p className="trv2-hero-sub">
                  <Play size={12} fill="currentColor" />
                  {heroArtist.total_plays.toLocaleString()} {t.plays}
                </p>
              </div>
              {/* Hero nav arrows */}
              <button className="trv2-hero-nav left" onClick={e => { e.stopPropagation(); heroPrev() }}>
                <ChevronLeft size={20} />
              </button>
              <button className="trv2-hero-nav right" onClick={e => { e.stopPropagation(); heroNext() }}>
                <ChevronRight size={20} />
              </button>
              {/* Dots */}
              <div className="trv2-hero-dots">
                {heroArtists.map((_, i) => (
                  <button
                    key={i}
                    className={`trv2-dot${i === heroIdx ? ' active' : ''}`}
                    onClick={e => { e.stopPropagation(); setHeroIdx(i) }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="trv2-hero-card trv2-hero-empty">
              <p>{t.emptyLibrary}</p>
              <p className="sub">{t.addFolderHint}</p>
            </div>
          )}
        </div>

        {/* Top Artists Row */}
        {topArtistsList.length > 0 && (
          <section className="trv2-section">
            <h2 className="trv2-section-title">
              <span className="trv2-accent">{t.most}</span> {t.played} {t.artists}
            </h2>
            <div className="trv2-artists-row">
              {topArtistsList.map(artist => (
                <div key={artist.name} className="trv2-artist-item" onClick={() => setArtistDetail(artist.name)}>
                  <div className="trv2-artist-avatar">
                    {artist.cover_path ? (
                      <CoverArt
                        songPath={artist.cover_path}
                        hasCover={true}
                        size={64}
                        className="trv2-artist-img"
                      />
                    ) : (
                      <span className="trv2-artist-letter">
                        {artist.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="trv2-artist-name">{artist.name.split(' ')[0]}</span>
                  <span className="trv2-artist-plays">{artist.total_plays > 0 ? formatPlays(artist.total_plays) : `${artist.song_count} songs`}</span>
                </div>
              ))}
              {remainingArtists > 0 && (
                <div className="trv2-artist-item">
                  <div className="trv2-artist-avatar trv2-artist-more">
                    +{remainingArtists}
                  </div>
                  <span className="trv2-artist-name">{t.more}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Most Played Songs (horizontal compact list) */}
        {mostPlayed.length > 0 && (
          <section className="trv2-section">
            <h2 className="trv2-section-title">
              <span className="trv2-accent">{t.most}</span> {t.played}
            </h2>
            <div className="trv2-mp-grid">
              {mostPlayed.map((song, i) => (
                <div
                  key={song.id}
                  className={`trv2-mp-item${currentSong?.id === song.id ? ' playing' : ''}`}
                  onClick={() => playFromTrending(song)}
                  onContextMenu={(e) => { e.preventDefault(); showSongContextMenu(song, e.clientX, e.clientY) }}
                >
                  <span className="trv2-mp-idx">{String(i + 1).padStart(2, '0')}</span>
                  <CoverArt songPath={song.path} hasCover={!!song.has_cover} size={38} className="trv2-mp-cover" />
                  <div className="trv2-mp-info">
                    <span className="trv2-mp-title">{song.title}</span>
                    <span className="trv2-mp-artist">{song.artist}</span>
                  </div>
                  <div className="trv2-mp-meta">
                    <span className="trv2-mp-plays">{formatPlays(song.play_count)}</span>
                    <span className="trv2-mp-dur">{formatDuration(song.duration)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Played Cards */}
        <section className="trv2-section">
          <h2 className="trv2-section-title">
            <span className="trv2-accent">{t.recently}</span> {t.played}
          </h2>
          <div className="trv2-recents-wrap">
            <div className="trv2-recents" style={{ transform: `translateX(-${recentScroll * 220}px)` }}>
              {(recentPlayed.length > 0
                ? recentPlayed.map(h => {
                    const song = songs.find(s => s.id === h.song_id)
                    return {
                      id: h.song_id,
                      title: h.title,
                      artist: h.artist,
                      path: h.path,
                      has_cover: h.has_cover,
                      play_count: h.play_count,
                      duration: h.duration,
                      song
                    }
                  })
                : recent.slice(0, 8).map(s => ({
                    id: s.id,
                    title: s.title,
                    artist: s.artist,
                    path: s.path,
                    has_cover: s.has_cover,
                    play_count: s.play_count,
                    duration: s.duration,
                    song: s
                  }))
              ).map(item => (
                <div
                  key={item.id}
                  className="trv2-recent-card"
                  onClick={() => item.song && playSong(item.song, songs)}
                  onContextMenu={(e) => { if (item.song) { e.preventDefault(); showSongContextMenu(item.song, e.clientX, e.clientY) } }}
                >
                  <CoverArt
                    songPath={item.path}
                    hasCover={!!item.has_cover}
                    className="trv2-recent-bg"
                    asBackground
                  />
                  <div className="trv2-recent-overlay" />
                  <div className="trv2-recent-info">
                    <span className="trv2-recent-title">{item.title}</span>
                    <span className="trv2-recent-plays">
                      <Play size={10} fill="currentColor" />
                      {item.play_count > 0 ? formatPlays(item.play_count) : 'Yeni'}
                    </span>
                  </div>
                  {item.song && (
                    <button
                      className={`trv2-recent-fav${item.song.is_favorite ? ' active' : ''}`}
                      onClick={e => { e.stopPropagation(); toggleFavorite(item.id) }}
                    >
                      <Heart size={14} fill={item.song.is_favorite ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {recentScroll > 0 && (
              <button className="trv2-scroll-btn left" onClick={() => setRecentScroll(s => Math.max(0, s - 1))}>
                <ChevronLeft size={18} />
              </button>
            )}
            {recentScroll < 4 && (
              <button className="trv2-scroll-btn right" onClick={() => setRecentScroll(s => Math.min(4, s + 1))}>
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
