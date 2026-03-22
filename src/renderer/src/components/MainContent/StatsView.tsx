import { useState, useEffect } from 'react'
import {
  BarChart3, Music, Disc3, Users, Play, Clock, Heart, Calendar,
  HardDrive, Zap, TrendingUp, Loader2, Database, FileText
} from 'lucide-react'
import { CoverArt } from '../shared/CoverArt'

interface DetailedStats {
  total_songs: number
  total_albums: number
  total_artists: number
  total_plays: number
  total_duration: number
  total_listened_duration: number
  avg_year: number | null
  avg_song_duration: number
  avg_bitrate: number
  top_genres: Array<{ genre: string; count: number }>
  top_artists: Array<{ name: string; plays: number; song_count: number }>
  top_songs: Array<{ title: string; artist: string; play_count: number; path: string; has_cover: number }>
  hourly_plays: Array<{ hour: number; count: number }>
  daily_plays: Array<{ day: number; count: number }>
  monthly_plays: Array<{ month: string; count: number }>
  year_distribution: Array<{ year: number; count: number }>
  oldest_song: { title: string; artist: string; year: number } | null
  newest_song: { title: string; artist: string; year: number } | null
  total_favorites: number
  total_file_size: number
  recently_added_count_30d: number
  format_distribution: Array<{ format: string; count: number }>
  db_file_size: number
  total_lyrics: number
  longest_session: {
    start_time: number
    duration_sec: number
    song_count: number
  } | null
  current_streak: number
  max_streak: number
  record_day: { date: string; count: number } | null
  top_albums_played: Array<{ album: string; artist: string; total_plays: number }>
  unplayed_songs: number
  playlist_stats: {
    total_playlists: number
    total_playlist_songs: number
    biggest_playlist: { name: string; count: number } | null
  }
  language_stats: { turkish: number; global: number }
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatBigDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 24) {
    const d = Math.floor(h / 24)
    const rh = h % 24
    return `${d} days ${rh} h`
  }
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

export function StatsView(): JSX.Element {
  const [stats, setStats] = useState<DetailedStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.getDetailedStats().then((s: DetailedStats) => {
      setStats(s)
      setLoading(false)
    })
  }, [])

  if (loading || !stats) {
    return (
      <div className="stats-view">
        <div className="stats-loading">
          <Loader2 size={28} className="lyrics-spinner" />
          <p>Loading statistics...</p>
        </div>
      </div>
    )
  }

  const maxHourly = Math.max(...stats.hourly_plays.map(h => h.count), 1)
  const maxDaily = Math.max(...stats.daily_plays.map(d => d.count), 1)
  const maxMonthly = Math.max(...stats.monthly_plays.map(m => m.count), 1)

  return (
    <div className="stats-view">
      <div className="stats-header">
        <BarChart3 size={22} />
        <h2>Statistics</h2>
      </div>

      {/* ── Overview Cards ──────────────────────────────────────────────── */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-card-icon"><Music size={20} /></div>
          <div className="stat-card-value">{stats.total_songs.toLocaleString('en-US')}</div>
          <div className="stat-card-label">Total Songs</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Disc3 size={20} /></div>
          <div className="stat-card-value">{stats.total_albums.toLocaleString('en-US')}</div>
          <div className="stat-card-label">Albums</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Users size={20} /></div>
          <div className="stat-card-value">{stats.total_artists.toLocaleString('en-US')}</div>
          <div className="stat-card-label">Artists</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Play size={20} /></div>
          <div className="stat-card-value">{stats.total_plays.toLocaleString('en-US')}</div>
          <div className="stat-card-label">Total Plays</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Clock size={20} /></div>
          <div className="stat-card-value">{formatBigDuration(stats.total_duration)}</div>
          <div className="stat-card-label">Total Duration</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><TrendingUp size={20} /></div>
          <div className="stat-card-value">{formatBigDuration(stats.total_listened_duration)}</div>
          <div className="stat-card-label">Listened Duration</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Heart size={20} /></div>
          <div className="stat-card-value">{stats.total_favorites}</div>
          <div className="stat-card-label">Favorites</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><HardDrive size={20} /></div>
          <div className="stat-card-value">{formatFileSize(stats.total_file_size)}</div>
          <div className="stat-card-label">Disk Space</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Calendar size={20} /></div>
          <div className="stat-card-value">{stats.avg_year ?? '—'}</div>
          <div className="stat-card-label">Avg. Year</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Zap size={20} /></div>
          <div className="stat-card-value">{stats.avg_bitrate > 0 ? `${stats.avg_bitrate} kbps` : '—'}</div>
          <div className="stat-card-label">Avg. Bitrate</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Clock size={20} /></div>
          <div className="stat-card-value">{stats.avg_song_duration > 0 ? `${Math.floor(stats.avg_song_duration / 60)}:${String(Math.floor(stats.avg_song_duration % 60)).padStart(2, '0')}` : '—'}</div>
          <div className="stat-card-label">Avg. Duration</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Music size={20} /></div>
          <div className="stat-card-value">{stats.recently_added_count_30d}</div>
          <div className="stat-card-label">Last 30 Days</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Database size={20} /></div>
          <div className="stat-card-value">{formatFileSize(stats.db_file_size)}</div>
          <div className="stat-card-label">Database</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><FileText size={20} /></div>
          <div className="stat-card-value">{stats.total_lyrics.toLocaleString('en-US')}</div>
          <div className="stat-card-label">Lyrics</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'var(--c-accent)' }}>
          <div className="stat-card-icon"><Zap size={20} color="var(--c-accent)" /></div>
          <div className="stat-card-value" style={{color: 'var(--c-accent)'}}>{stats.current_streak} / {stats.max_streak}</div>
          <div className="stat-card-label">Day Streak (Curr / Max)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Music size={20} /></div>
          <div className="stat-card-value">{stats.total_songs > 0 ? Math.round((stats.unplayed_songs / stats.total_songs) * 100) : 0}%</div>
          <div className="stat-card-label">Unplayed ({stats.unplayed_songs})</div>
        </div>
      </div>

      {stats.longest_session && (
        <div className="stats-section" style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>
          <h3 className="stats-section-title">Listening Insights</h3>
          <div className="stats-insights-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--c-surface)', padding: '20px', borderRadius: '12px' }}>
            <div style={{ background: 'var(--c-accent)', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              <Clock size={20} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '15px', color: 'var(--c-text)', lineHeight: '1.5' }}>
                On <strong>{new Date(stats.longest_session.start_time).toLocaleDateString()}</strong> between <strong>{new Date(stats.longest_session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong> and <strong>{new Date(stats.longest_session.start_time + stats.longest_session.duration_sec * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong>, you listened to music continuously for <strong>{formatBigDuration(stats.longest_session.duration_sec)}</strong>.
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--c-text-muted)' }}>
                A total of <strong>{stats.longest_session.song_count}</strong> songs were played during this session.
              </p>
            </div>
          </div>

          {stats.record_day && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--c-surface)', padding: '20px', borderRadius: '12px' }}>
              <div style={{ background: '#f59e0b', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '15px', color: 'var(--c-text)', lineHeight: '1.5' }}>
                  Your all-time daily record was on <strong>{new Date(stats.record_day.date).toLocaleDateString()}</strong>!
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--c-text-muted)' }}>
                  You listened to exactly <strong>{stats.record_day.count}</strong> songs on that day.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--c-surface)', padding: '20px', borderRadius: '12px' }}>
            <div style={{ background: '#10b981', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              <Disc3 size={20} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '15px', color: 'var(--c-text)', lineHeight: '1.5' }}>
                Your library consists of <strong>{stats.language_stats.turkish}</strong> Turkish songs and <strong>{stats.language_stats.global}</strong> Global songs.
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--c-text-muted)' }}>
                You have {stats.playlist_stats.total_playlists} playlists containing {stats.playlist_stats.total_playlist_songs} songs. {stats.playlist_stats.biggest_playlist ? `Biggest: ${stats.playlist_stats.biggest_playlist.name}` : ''}
              </p>
            </div>
          </div>

          </div>
        </div>
      )}

      {/* ── Two Column Layout ───────────────────────────────────────────── */}
      <div className="stats-grid">
        {/* Hourly Play Distribution */}
        <div className="stats-section">
          <h3 className="stats-section-title">Hourly Play Distribution</h3>
          <div className="stats-bar-chart hourly">
            {stats.hourly_plays.map(h => (
              <div key={h.hour} className="stats-bar-col">
                <div className="stats-bar-wrap">
                  <div
                    className="stats-bar"
                    style={{ height: `${(h.count / maxHourly) * 100}%` }}
                  />
                </div>
                <span className="stats-bar-label">{h.hour}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Play Distribution */}
        <div className="stats-section">
          <h3 className="stats-section-title">Daily Play Distribution</h3>
          <div className="stats-bar-chart daily">
            {stats.daily_plays.map(d => (
              <div key={d.day} className="stats-bar-col wide">
                <div className="stats-bar-wrap">
                  <div
                    className="stats-bar"
                    style={{ height: `${(d.count / maxDaily) * 100}%` }}
                  />
                </div>
                <span className="stats-bar-label">{DAY_NAMES[d.day]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Artists */}
        <div className="stats-section">
          <h3 className="stats-section-title">Top Artists</h3>
          <div className="stats-list">
            {stats.top_artists.map((a, i) => {
              const maxPlays = stats.top_artists[0]?.plays ?? 1
              return (
                <div key={a.name} className="stats-list-item">
                  <span className="stats-rank">#{i + 1}</span>
                  <div className="stats-list-info">
                    <span className="stats-list-name">{a.name}</span>
                    <span className="stats-list-sub">{a.song_count} songs</span>
                  </div>
                  <div className="stats-list-bar-wrap">
                    <div className="stats-list-bar" style={{ width: `${(a.plays / maxPlays) * 100}%` }} />
                  </div>
                  <span className="stats-list-val">{a.plays}</span>
                </div>
              )
            })}
            {stats.top_artists.length === 0 && <p className="stats-empty">No data yet</p>}
          </div>
        </div>

        {/* Top Albums */}
        {stats.top_albums_played.length > 0 && (
          <div className="stats-section">
            <h3 className="stats-section-title">Top Albums</h3>
            <div className="stats-list">
              {stats.top_albums_played.map((a, i) => {
                const maxPlays = stats.top_albums_played[0]?.total_plays ?? 1
                return (
                  <div key={`${a.album}-${a.artist}`} className="stats-list-item">
                    <span className="stats-rank">#{i + 1}</span>
                    <div className="stats-list-info">
                      <span className="stats-list-name">{a.album}</span>
                      <span className="stats-list-sub">{a.artist}</span>
                    </div>
                    <div className="stats-list-bar-wrap">
                      <div className="stats-list-bar" style={{ width: `${(a.total_plays / maxPlays) * 100}%`, background: 'var(--c-primary)' }} />
                    </div>
                    <span className="stats-list-val">{a.total_plays}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top Songs */}
        <div className="stats-section">
          <h3 className="stats-section-title">Top Songs</h3>
          <div className="stats-list">
            {stats.top_songs.map((s, i) => {
              const maxPlays = stats.top_songs[0]?.play_count ?? 1
              return (
                <div key={`${s.title}-${s.artist}`} className="stats-list-item">
                  <span className="stats-rank">#{i + 1}</span>
                  <CoverArt songPath={s.path} hasCover={!!s.has_cover} size={34} className="stats-cover" />
                  <div className="stats-list-info">
                    <span className="stats-list-name">{s.title}</span>
                    <span className="stats-list-sub">{s.artist}</span>
                  </div>
                  <div className="stats-list-bar-wrap">
                    <div className="stats-list-bar accent" style={{ width: `${(s.play_count / maxPlays) * 100}%` }} />
                  </div>
                  <span className="stats-list-val">{s.play_count}</span>
                </div>
              )
            })}
            {stats.top_songs.length === 0 && <p className="stats-empty">No data yet</p>}
          </div>
        </div>

        {/* Top Genres */}
        <div className="stats-section">
          <h3 className="stats-section-title">Genres</h3>
          <div className="stats-genre-grid">
            {stats.top_genres.map((g) => {
              const maxCount = stats.top_genres[0]?.count ?? 1
              return (
                <div key={g.genre} className="stats-genre-item">
                  <div className="stats-genre-bar" style={{ width: `${(g.count / maxCount) * 100}%` }} />
                  <span className="stats-genre-name">{g.genre}</span>
                  <span className="stats-genre-count">{g.count}</span>
                </div>
              )
            })}
            {stats.top_genres.length === 0 && <p className="stats-empty">No genre data</p>}
          </div>
        </div>

        {/* Format Distribution */}
        <div className="stats-section">
          <h3 className="stats-section-title">File Formats</h3>
          <div className="stats-format-grid">
            {stats.format_distribution.map(f => {
              const maxCount = stats.format_distribution[0]?.count ?? 1
              const pct = stats.total_songs > 0 ? ((f.count / stats.total_songs) * 100).toFixed(1) : '0'
              return (
                <div key={f.format} className="stats-format-item">
                  <div className="stats-format-bar" style={{ width: `${(f.count / maxCount) * 100}%` }} />
                  <span className="stats-format-name">{f.format}</span>
                  <span className="stats-format-count">{f.count.toLocaleString('en-US')} <span className="stats-format-pct">({pct}%)</span></span>
                </div>
              )
            })}
            {stats.format_distribution.length === 0 && <p className="stats-empty">No format data</p>}
          </div>
        </div>

        {/* Monthly Plays */}
        {stats.monthly_plays.length > 0 && (
          <div className="stats-section">
            <h3 className="stats-section-title">Monthly Plays</h3>
            <div className="stats-bar-chart monthly">
              {stats.monthly_plays.map(m => (
                <div key={m.month} className="stats-bar-col wide">
                  <div className="stats-bar-wrap">
                    <div
                      className="stats-bar accent"
                      style={{ height: `${(m.count / maxMonthly) * 100}%` }}
                    />
                  </div>
                  <span className="stats-bar-label">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Year Range + Distribution */}
        {(stats.oldest_song || stats.newest_song) && (
          <div className="stats-section">
            <h3 className="stats-section-title">Year Range</h3>
            <div className="stats-year-range">
              {stats.oldest_song && (
                <div className="stats-year-item">
                  <span className="stats-year-label">Oldest</span>
                  <span className="stats-year-val">{stats.oldest_song.year}</span>
                  <span className="stats-year-song">{stats.oldest_song.title} — {stats.oldest_song.artist}</span>
                </div>
              )}
              {stats.newest_song && (
                <div className="stats-year-item">
                  <span className="stats-year-label">Newest</span>
                  <span className="stats-year-val">{stats.newest_song.year}</span>
                  <span className="stats-year-song">{stats.newest_song.title} — {stats.newest_song.artist}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
