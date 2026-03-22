import { useState, useEffect } from 'react'
import { useI18n } from '../../i18n'
import { CoverArt } from '../shared/CoverArt'
import { ChevronRight, Sparkles } from 'lucide-react'

interface ReplayData {
  year: number
  totalMinutes: number
  totalPlays: number
  totalSongs: number
  totalArtists: number
  totalAlbums: number
  topSongs: Array<{ title: string; artist: string; total_plays: number; path: string; has_cover: number }>
  topArtists: Array<{ artist: string; total_plays: number; total_minutes: number; song_count: number; cover_path: string | null }>
  topAlbums: Array<{ album: string; artist: string; total_plays: number; total_minutes: number; cover_path: string | null }>
  topGenres: Array<{ genre: string; total_plays: number }>
  monthlyTopArtists: Array<{ month: number; artist: string; cover_path: string | null }>
  monthlyTopSongs: Array<{ month: number; title: string; artist: string; path: string; has_cover: number }>
  monthlyTopAlbums: Array<{ month: number; album: string; artist: string; cover_path: string | null }>
}

export function ReplayView(): JSX.Element {
  const { t } = useI18n()
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [data, setData] = useState<ReplayData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.getAvailableYears().then((y: number[]) => {
      if (y.length > 0) {
        setYears(y)
        setSelectedYear(y[0])
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedYear) return
    setLoading(true)
    window.api.getReplay(selectedYear).then((d: ReplayData) => {
      setData(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [selectedYear])

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
        <h2>{t.replayTitle}</h2>
        <p>{t.noData}</p>
      </div>
    )
  }

  return (
    <div className="rp-root">
      {/* Hero Section */}
      <section className="rp-hero">
        <div className="rp-hero-gradient" />
        <div className="rp-hero-content">
          <div className="rp-year-selector">
            {years.map(y => (
              <button
                key={y}
                className={`rp-year-btn ${selectedYear === y ? 'active' : ''}`}
                onClick={() => setSelectedYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
          <h1 className="rp-hero-title">{t.replayTitle}</h1>
          <p className="rp-hero-subtitle">{data.totalMinutes.toLocaleString()} {t.replayMinutesListened}</p>
        </div>
      </section>

      {/* Top Artists */}
      {data.topArtists.length > 0 && (
        <section className="rp-section rp-section-artists">
          <div className="rp-section-gradient rp-grad-warm" />
          <div className="rp-section-header">
            <div>
              <h2 className="rp-section-title">{t.replayTopArtists}</h2>
              <p className="rp-section-sub">{data.totalArtists.toLocaleString()} {t.replayTotalArtists}</p>
            </div>
          </div>
          <div className="rp-horizontal-scroll">
            {data.topArtists.slice(0, 8).map((a, i) => (
              <div key={i} className="rp-artist-card">
                <div className="rp-artist-circle">
                  {a.cover_path ? (
                    <CoverArt songPath={a.cover_path} hasCover size={160} className="rp-artist-img" />
                  ) : (
                    <span className="rp-artist-letter">{a.artist.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="rp-card-rank-row">
                  <span className="rp-rank">{i + 1}</span>
                  <div className="rp-card-info">
                    <span className="rp-card-name">{a.artist}</span>
                    <span className="rp-card-stat">{Math.round(a.total_minutes)} {t.minutes}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Songs */}
      {data.topSongs.length > 0 && (
        <section className="rp-section rp-section-songs">
          <div className="rp-section-gradient rp-grad-teal" />
          <div className="rp-section-header">
            <div>
              <h2 className="rp-section-title">{t.replayTopSongs}</h2>
              <p className="rp-section-sub">{data.totalSongs.toLocaleString()} {t.replayTotalSongs}</p>
            </div>
          </div>
          <div className="rp-horizontal-scroll">
            {data.topSongs.slice(0, 8).map((s, i) => (
              <div key={i} className="rp-song-card">
                <div className="rp-song-cover">
                  <CoverArt songPath={s.path} hasCover={!!s.has_cover} size={200} className="rp-song-cover-img" />
                </div>
                <div className="rp-card-rank-row">
                  <span className="rp-rank">{i + 1}</span>
                  <div className="rp-card-info">
                    <span className="rp-card-name">{s.title}</span>
                    <span className="rp-card-artist">{s.artist}</span>
                    <span className="rp-card-stat">{s.total_plays} {t.plays}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Albums */}
      {data.topAlbums.length > 0 && (
        <section className="rp-section rp-section-albums">
          <div className="rp-section-gradient rp-grad-purple" />
          <div className="rp-section-header">
            <div>
              <h2 className="rp-section-title">{t.replayTopAlbums}</h2>
              <p className="rp-section-sub">{data.totalAlbums.toLocaleString()} {t.replayTotalAlbums}</p>
            </div>
          </div>
          <div className="rp-horizontal-scroll">
            {data.topAlbums.slice(0, 8).map((a, i) => (
              <div key={i} className="rp-song-card">
                <div className="rp-song-cover">
                  {a.cover_path ? (
                    <CoverArt songPath={a.cover_path} hasCover size={200} className="rp-song-cover-img" />
                  ) : (
                    <div className="rp-album-placeholder">{a.album.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <div className="rp-card-rank-row">
                  <span className="rp-rank">{i + 1}</span>
                  <div className="rp-card-info">
                    <span className="rp-card-name">{a.album}</span>
                    <span className="rp-card-artist">{a.artist}</span>
                    <span className="rp-card-stat">{Math.round(a.total_minutes)} {t.minutes}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Genres */}
      {data.topGenres.length > 0 && (
        <section className="rp-section rp-section-genres">
          <div className="rp-section-gradient rp-grad-dark" />
          <div className="rp-section-header">
            <h2 className="rp-section-title">{t.replayTopGenres}</h2>
          </div>
          <div className="rp-genre-list">
            {data.topGenres.map((g, i) => (
              <div key={i} className="rp-genre-item">
                <span className="rp-genre-rank">{i + 1}</span>
                <span className={`rp-genre-name ${i === 0 ? 'rp-genre-top' : ''}`}
                  style={{ opacity: 1 - i * 0.15 }}
                >{g.genre}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Monthly Breakdown */}
      {data.monthlyTopArtists.length > 0 && (
        <section className="rp-section rp-section-monthly">
          <div className="rp-section-gradient rp-grad-orange" />
          <div className="rp-section-header">
            <h2 className="rp-section-title rp-monthly-title">
              {t.replayByMonth} {selectedYear}
            </h2>
          </div>
          <div className="rp-monthly-grid">
            {/* Artists by month */}
            <div className="rp-monthly-col">
              <h3 className="rp-monthly-col-title">{t.replayArtistsByMonth} <ChevronRight size={16} /></h3>
              <div className="rp-monthly-list">
                {data.monthlyTopArtists.map((m, i) => (
                  <div key={i} className="rp-monthly-item">
                    <div className="rp-monthly-avatar">
                      {m.cover_path ? (
                        <CoverArt songPath={m.cover_path} hasCover size={48} className="rp-monthly-avatar-img" />
                      ) : (
                        <span className="rp-monthly-avatar-letter">{m.artist.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="rp-monthly-info">
                      <span className="rp-monthly-month">{t.monthNames[m.month - 1]}</span>
                      <span className="rp-monthly-name">{m.artist}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Songs by month */}
            <div className="rp-monthly-col">
              <h3 className="rp-monthly-col-title">{t.replaySongsByMonth} <ChevronRight size={16} /></h3>
              <div className="rp-monthly-list">
                {data.monthlyTopSongs.map((m, i) => (
                  <div key={i} className="rp-monthly-item">
                    <div className="rp-monthly-cover">
                      <CoverArt songPath={m.path} hasCover={!!m.has_cover} size={48} className="rp-monthly-cover-img" />
                    </div>
                    <div className="rp-monthly-info">
                      <span className="rp-monthly-month">{t.monthNames[m.month - 1]}</span>
                      <span className="rp-monthly-name">{m.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Albums by month */}
            <div className="rp-monthly-col">
              <h3 className="rp-monthly-col-title">{t.replayAlbumsByMonth} <ChevronRight size={16} /></h3>
              <div className="rp-monthly-list">
                {data.monthlyTopAlbums.map((m, i) => (
                  <div key={i} className="rp-monthly-item">
                    <div className="rp-monthly-cover">
                      {m.cover_path ? (
                        <CoverArt songPath={m.cover_path} hasCover size={48} className="rp-monthly-cover-img" />
                      ) : (
                        <div className="rp-monthly-cover-placeholder">{m.album.charAt(0)}</div>
                      )}
                    </div>
                    <div className="rp-monthly-info">
                      <span className="rp-monthly-month">{t.monthNames[m.month - 1]}</span>
                      <span className="rp-monthly-name">{m.album}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
