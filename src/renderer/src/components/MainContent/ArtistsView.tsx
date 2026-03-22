import { useEffect, useState, useMemo } from 'react'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { Users, ArrowLeft, Play, BadgeCheck, X, Globe, Trash2, Clock, Heart, RefreshCw, FolderOpen } from 'lucide-react'
import { CoverArt } from '../shared/CoverArt'
import { Song } from '../../types'
import { formatPlays, formatDate } from '../../utils/format'
import { showSongContextMenu } from '../shared/SongContextMenu'

const ARTIST_GRADIENTS = [
  'linear-gradient(145deg,#6D28D9,#4C1D95)',
  'linear-gradient(145deg,#DB2777,#9D174D)',
  'linear-gradient(145deg,#2563EB,#1E40AF)',
  'linear-gradient(145deg,#DC2626,#991B1B)',
  'linear-gradient(145deg,#D97706,#92400E)',
  'linear-gradient(145deg,#059669,#064E3B)',
  'linear-gradient(145deg,#7C3AED,#5B21B6)',
  'linear-gradient(145deg,#0891B2,#164E63)'
]

export function ArtistsView(): JSX.Element {
  const { artists, loadArtists, artistDetail, setArtistDetail, setCurrentView, toggleFavoriteArtist, pendingAlbum, setPendingAlbum } = useLibraryStore()
  const { playSong, currentSong, isPlaying } = usePlayerStore()
  const [detailSongs, setDetailSongs] = useState<Song[]>([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null)
  const [isArtistFav, setIsArtistFav] = useState(false)

  // Artist rescan
  const [isRescanning, setIsRescanning] = useState(false)
  const [rescanMsg, setRescanMsg] = useState<string | null>(null)
  const [showAllPopular, setShowAllPopular] = useState(false)
  const [albumSort, setAlbumSort] = useState<'year' | 'alpha'>('year')
  const [showFolderMovedModal, setShowFolderMovedModal] = useState(false)

  async function handleRescanArtist(): Promise<void> {
    if (!artistDetail || isRescanning) return
    setIsRescanning(true)
    setRescanMsg(null)
    try {
      const result = await window.api.rescanArtist(artistDetail)
      if (result.folderMissing) {
        setShowFolderMovedModal(true)
        return
      }
      const parts: string[] = []
      if (result.count > 0) parts.push(`${result.count} songs added`)
      if (result.removed > 0) parts.push(`${result.removed} removed`)
      setRescanMsg(parts.length ? parts.join(', ') : 'Update complete')
      // Refresh artist songs in UI
      const songs = await window.api.getSongs({ limit: 500, search: artistDetail })
      setDetailSongs(songs.filter((s) => s.artist === artistDetail || s.album_artist === artistDetail))
    } catch {
      setRescanMsg('Update failed')
    } finally {
      setIsRescanning(false)
      setTimeout(() => setRescanMsg(null), 4000)
    }
  }

  async function handleRescanFromNewFolder(): Promise<void> {
    if (!artistDetail) return
    const newFolder = await window.api.pickFolder()
    if (!newFolder) return
    setShowFolderMovedModal(false)
    setIsRescanning(true)
    setRescanMsg(null)
    try {
      const result = await window.api.rescanArtistFromFolder(artistDetail, newFolder)
      const parts: string[] = []
      if (result.count > 0) parts.push(`${result.count} songs added`)
      if (result.removed > 0) parts.push(`${result.removed} removed`)
      setRescanMsg(parts.length ? parts.join(', ') : 'Update complete')
      const songs = await window.api.getSongs({ limit: 500, search: artistDetail })
      setDetailSongs(songs.filter((s) => s.artist === artistDetail || s.album_artist === artistDetail))
    } catch {
      setRescanMsg('Update failed')
    } finally {
      setIsRescanning(false)
      setTimeout(() => setRescanMsg(null), 4000)
    }
  }
  const [wikiShort, setWikiShort] = useState<string>('')
  const [wikiFull, setWikiFull] = useState<string>('')
  const [wikiUrl, setWikiUrl] = useState<string>('')
  const [wikiLoading, setWikiLoading] = useState(false)
  const [showWikiModal, setShowWikiModal] = useState(false)

  useEffect(() => {
    if (!artists.length) loadArtists()
  }, [])

  useEffect(() => {
    if (!artistDetail) { setDetailSongs([]); setCoverUrl(null); setSelectedAlbum(null); setIsArtistFav(false); return }
    setIsLoadingDetail(true)
    const artist = artists.find((a) => a.name === artistDetail)
    // Check favorite status
    window.api.isArtistFavorite(artistDetail).then(setIsArtistFav).catch(() => setIsArtistFav(false))
    if (artist?.cover_path) {
      window.api.getCover(artist.cover_path).then(setCoverUrl).catch(() => setCoverUrl(null))
    } else {
      setCoverUrl(null)
    }
    window.api.getSongs({ limit: 500, search: artistDetail }).then((songs) => {
      setDetailSongs(songs.filter((s) => s.artist === artistDetail || s.album_artist === artistDetail))
      setIsLoadingDetail(false)
    })
  }, [artistDetail])

  // When navigating here from a search album click, open that album once songs are loaded
  useEffect(() => {
    if (pendingAlbum && detailSongs.length > 0) {
      setSelectedAlbum(pendingAlbum)
      setPendingAlbum(null)
    }
  }, [detailSongs, pendingAlbum])

  // Wikipedia fetch
  useEffect(() => {
    if (!artistDetail) { setWikiShort(''); setWikiFull(''); setWikiUrl(''); return }
    setWikiLoading(true)
    setWikiShort('')
    setWikiFull('')
    window.api.getWikiSummary(artistDetail)
      .then((data) => {
        if (!data) return
        const text = data.extract ?? ''
        const short = text.length > 420 ? text.slice(0, 420).replace(/\s\S+$/, '') + '…' : text
        setWikiShort(short)
        setWikiFull(text)
        setWikiUrl(data.content_urls?.desktop?.page ?? '')
      })
      .catch(() => { setWikiShort(''); setWikiFull('') })
      .finally(() => setWikiLoading(false))
  }, [artistDetail])

  const popularSongs = useMemo(
    () => [...detailSongs].sort((a, b) => b.play_count - a.play_count),
    [detailSongs]
  )

  const newestSong = useMemo(() => {
    // Pick one representative song per album, sorted by year desc, then date_added desc
    const albumMap = new Map<string, Song>()
    detailSongs.forEach((s) => {
      if (!s.album || s.album === 'Unknown Album') return
      const existing = albumMap.get(s.album)
      if (!existing) { albumMap.set(s.album, s); return }
      const newYear = s.year ?? 0
      const oldYear = existing.year ?? 0
      if (newYear > oldYear || (newYear === oldYear && s.date_added > existing.date_added)) {
        albumMap.set(s.album, s)
      }
    })
    const reps = Array.from(albumMap.values())
    if (!reps.length) return detailSongs[0] ?? null
    reps.sort((a, b) => {
      const ay = a.year ?? 0, by = b.year ?? 0
      if (by !== ay) return by - ay
      return b.date_added - a.date_added
    })
    return reps[0]
  }, [detailSongs])

  // group by album, only multi-track = album, single-track = single/EP
  const { albums, singles } = useMemo(() => {
    const map = new Map<string, { rep: Song; count: number }>()
    detailSongs.forEach((s) => {
      if (!s.album || s.album === 'Unknown Album') return
      const entry = map.get(s.album)
      if (entry) entry.count++
      else map.set(s.album, { rep: s, count: 1 })
    })
    const albs: Song[] = []
    const sngs: Song[] = []
    map.forEach(({ rep, count }) => {
      if (count >= 3) albs.push(rep)
      else sngs.push(rep)
    })
    return { albums: albs, singles: sngs }
  }, [detailSongs])

  const totalPlays = useMemo(
    () => detailSongs.reduce((sum, s) => sum + s.play_count, 0),
    [detailSongs]
  )

  const flacRatio = useMemo(() => {
    if (!detailSongs.length) return null
    const flacCount = detailSongs.filter((s) => s.path.toLowerCase().endsWith('.flac')).length
    return Math.round((flacCount / detailSongs.length) * 100)
  }, [detailSongs])

  const lastPlayedDate = useMemo(() => {
    const ts = detailSongs
      .map((s) => s.last_played)
      .filter((t): t is number => !!t)
      .reduce((max, t) => Math.max(max, t), 0)
    if (!ts) return null
    const d = new Date(ts > 1e10 ? ts : ts * 1000)
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  }, [detailSongs])

  const artistFolder = useMemo(() => {
    if (!detailSongs.length) return null
    const dirs = [...new Set(detailSongs.map((s) => {
      const parts = s.path.split(/[/\\]/)
      parts.pop()
      const sep = s.path.includes('\\') ? '\\' : '/'
      return parts.join(sep)
    }))]
    if (dirs.length === 1) return dirs[0]
    const pathSep = dirs[0].includes('\\') ? '\\' : '/'
    const splitParts = dirs.map((d) => d.split(/[/\\]/))
    const minLen = Math.min(...splitParts.map((p) => p.length))
    const common: string[] = []
    for (let i = 0; i < minLen; i++) {
      if (splitParts.every((p) => p[i].toLowerCase() === splitParts[0][i].toLowerCase())) {
        common.push(splitParts[0][i])
      } else break
    }
    return common.length ? common.join(pathSep) : dirs[0]
  }, [detailSongs])

  if (!artists.length) {
    return (
      <div className="empty-view">
        <Users size={48} className="empty-icon" />
        <p>No artists yet</p>
        <p className="sub">Add a music folder to get started</p>
      </div>
    )
  }

  // ── Artist detail page ─────────────────────────────────────────────────────
  if (artistDetail) {
    const artist = artists.find((a) => a.name === artistDetail)
    // Show album's release year, fallback to date_added
    const newestDate = newestSong?.year
      ? String(newestSong.year)
      : newestSong?.date_added
        ? new Date(
            newestSong.date_added > 1e10 ? newestSong.date_added : newestSong.date_added * 1000
          ).getFullYear().toString()
        : ''

    return (
      <div className="adp-root">
        {/* ── HERO: full blurred photo + name at bottom ── */}
        <div className="adp-hero">
          {coverUrl ? (
            <img src={coverUrl} className="adp-hero-img" alt="" aria-hidden />
          ) : (
            <div className="adp-hero-fallback" />
          )}
          <div className="adp-hero-blur" />
          <div className="adp-hero-gradient" />

          <button className="adp-back-btn" onClick={() => setCurrentView('library')}>
            <ArrowLeft size={15} />
          </button>

          {/* bottom: avatar + name + stats side-by-side */}
          <div className="adp-hero-bottom">
            <div className="adp-hero-id">
              {coverUrl ? (
                <img src={coverUrl} className="adp-hero-avatar" alt={artistDetail} />
              ) : (
                <div className="adp-hero-avatar-fallback">{artistDetail.slice(0, 2).toUpperCase()}</div>
              )}
            </div>
            <div className="adp-hero-text">
              <div className="adp-artist-name-row">
                <h1 className="adp-artist-name">{artistDetail}</h1>
                <BadgeCheck size={22} className="adp-tick" />
              </div>
              <div className="adp-hero-stats-row">
                {detailSongs.length > 0 && (
                  <span className="adp-hero-stat-pill">{detailSongs.length.toLocaleString()} songs</span>
                )}
                <><span className="adp-stat-dot">·</span><span className="adp-hero-stat-pill">{totalPlays.toLocaleString()} plays</span></>
                {flacRatio !== null && (
                  <><span className="adp-stat-dot">·</span><span className={`adp-hero-stat-pill${flacRatio === 100 ? ' adp-stat-flac' : ''}`}>FLAC %{flacRatio}</span></>
                )}
                {albums.length > 0 && (
                  <><span className="adp-stat-dot">·</span><span className="adp-hero-stat-pill">{albums.length} albums</span></>
                )}
                {lastPlayedDate && (
                  <><span className="adp-stat-dot">·</span><span className="adp-hero-stat-pill">Last: {lastPlayedDate}</span></>
                )}
              </div>
              {/* Wikipedia bio — inside hero, below stats */}
              {(wikiShort || wikiLoading) && (
                <div className="adp-hero-bio">
                  {wikiLoading ? (
                    <p className="adp-hero-bio-text adp-bio-loading">Loading biography…</p>
                  ) : (
                    <>
                      <p className="adp-hero-bio-text">{wikiShort}</p>
                      <div className="adp-bio-actions">
                        {wikiFull.length > wikiShort.length && (
                          <button className="adp-bio-read-more" onClick={() => setShowWikiModal(true)}>
                            Read More
                          </button>
                        )}
                        {wikiUrl && (
                          <a
                            className="adp-bio-wiki-link"
                            href={wikiUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => { e.preventDefault(); window.open(wikiUrl) }}
                          >
                            <Globe size={13} />
                            Wikipedia
                          </a>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="adp-hero-actions">
              <button
                className={`adp-hero-fav-btn${isArtistFav ? ' favorited' : ''}`}
                onClick={async () => {
                  await toggleFavoriteArtist(artistDetail)
                  setIsArtistFav((v) => !v)
                }}
                title={isArtistFav ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                <Heart size={18} fill={isArtistFav ? 'currentColor' : 'none'} />
              </button>
              {detailSongs.length > 0 && (
                <button
                  className="adp-hero-play-btn"
                  onClick={() => playSong(detailSongs[0], detailSongs, 0)}
                  title="Play All"
                >
                  <Play size={22} fill="currentColor" />
                </button>
              )}
              <button
                className={`adp-hero-rescan-btn${isRescanning ? ' scanning' : ''}`}
                onClick={handleRescanArtist}
                title="Update artist folder"
                disabled={isRescanning}
              >
                <RefreshCw size={16} />
                <span>{isRescanning ? 'Updating…' : 'Update'}</span>
              </button>
              {artistFolder && (
                <button
                  className="adp-hero-folder-btn"
                  onClick={() => window.api.openFolder(artistFolder)}
                  title={artistFolder}
                >
                  <FolderOpen size={16} />
                </button>
              )}
              {rescanMsg && <span className="adp-rescan-msg">{rescanMsg}</span>}
            </div>
          </div>
        </div>

      {/* ── BODY ── */}
        <div className="adp-content">
          {isLoadingDetail ? (
            <p className="adp-loading">Loading…</p>
          ) : selectedAlbum ? (
            // ── ALBUM TRACKLIST ──
            (() => {
              const albumSongs = detailSongs
                .filter((s) => s.album === selectedAlbum)
                .sort((a, b) => (a.track_number ?? 999) - (b.track_number ?? 999) || a.title.localeCompare(b.title))
              const repSong = albumSongs[0]
              const albumYear = albumSongs.find((s) => s.year)?.year
              const albumTotalPlays = albumSongs.reduce((sum, s) => sum + s.play_count, 0)
              return (
                <div className="adp-album-detail">
                  {/* Album header */}
                  <div className="adp-al-header">
                    <button className="adp-al-back" onClick={() => setSelectedAlbum(null)}>
                      <ArrowLeft size={15} />
                      <span>Geri</span>
                    </button>
                    <div className="adp-al-meta">
                      {repSong && (
                        <CoverArt
                          songPath={repSong.path}
                          hasCover={!!repSong.has_cover}
                          size={100}
                          className="adp-al-cover"
                        />
                      )}
                      <div className="adp-al-info">
                        <p className="adp-al-label">Album</p>
                        <h2 className="adp-al-title">{selectedAlbum}</h2>
                        <p className="adp-al-sub">
                          {artistDetail}
                          {albumYear ? <span> · {albumYear}</span> : null}
                          <span> · {albumSongs.length} songs</span>
                          {albumTotalPlays > 0 && <span> · {albumTotalPlays.toLocaleString()} plays</span>}
                          {albumSongs.every(s => s.path.split('.').pop()?.toLowerCase() === 'flac') && (
                            <span className="album-format-badge badge-flac">FLAC</span>
                          )}
                        </p>
                        <button
                          className="adp-al-play-all"
                          onClick={() => playSong(albumSongs[0], albumSongs, 0)}
                        >
                          <Play size={14} fill="currentColor" />
                          Play All
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Track list */}
                  <div className="adp-al-tracklist">
                    <div className="adp-al-track-header">
                      <span className="adp-al-th-num">#</span>
                      <span></span>
                      <span className="adp-al-th-title">Title</span>
                      <span className="adp-al-th-album">Album</span>
                      <span className="adp-al-th-plays">Plays</span>
                      <span className="adp-al-th-last">Last Played</span>
                      <span className="adp-al-th-dur"><Clock size={13} /></span>
                    </div>
                    {albumSongs.map((s, i) => {
                      const isActive = currentSong?.id === s.id
                      const mins = Math.floor(s.duration / 60)
                      const secs = String(Math.floor(s.duration % 60)).padStart(2, '0')
                      return (
                        <div
                          key={s.id}
                          className={`adp-al-track-row${isActive ? ' adp-al-track-row--active' : ''}`}
                          onClick={() => playSong(s, albumSongs, i)}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            showSongContextMenu(s, e.clientX, e.clientY)
                          }}
                        >
                          <span className="adp-al-tr-num">
                            {isActive && isPlaying ? (
                              <span className="adp-al-bars">
                                <span /><span /><span />
                              </span>
                            ) : (
                              <span className="adp-al-tr-num-val">{(s.track_number ?? i + 1)}</span>
                            )}
                          </span>
                          <div className="adp-al-tr-art">
                            <CoverArt
                              songPath={s.path}
                              hasCover={!!s.has_cover}
                              size={38}
                              className="adp-al-tr-cover"
                            />
                          </div>
                          <div className="adp-al-tr-info">
                            <p className="adp-al-tr-title">
                              {s.title}
                              <span className={`slr-format-badge ${s.path.split('.').pop()?.toLowerCase() === 'flac' ? 'badge-flac' : 'badge-lossy'}`}>
                                {s.path.split('.').pop()?.toUpperCase()}
                              </span>
                            </p>
                            <p className="adp-al-tr-artist">{s.artist}</p>
                          </div>
                          <span className="adp-al-tr-album">{s.album}</span>
                          <span className="adp-al-tr-plays">{s.play_count > 0 ? s.play_count.toLocaleString() : '—'}</span>
                          <span className="adp-al-tr-last">{formatDate(s.last_played)}</span>
                          <span className="adp-al-tr-dur">{mins}:{secs}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()
          ) : (
            <>
              {/* ── ROW 1: Popular | Newest release ── */}
              <div className="adp-top-row">
                {popularSongs.length > 0 && (
                  <div className="adp-col">
                    <h2 className="adp-section-title">Popular</h2>
                    <div className="adp-pop-list">
                      {(showAllPopular ? popularSongs : popularSongs.slice(0, 5)).map((s, i) => {
                        const idx = detailSongs.findIndex((x) => x.id === s.id)
                        return (
                          <div
                            key={s.id}
                            className="adp-pop-row"
                            onClick={() => playSong(s, detailSongs, idx >= 0 ? idx : 0)}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              showSongContextMenu(s, e.clientX, e.clientY)
                            }}
                          >
                            <span className="adp-pop-num">{i + 1}</span>
                            <p className="adp-pop-title">{s.title}</p>
                            <p className="adp-pop-plays">{s.play_count > 0 ? formatPlays(s.play_count) : ''}</p>
                          </div>
                        )
                      })}
                    </div>
                    {popularSongs.length > 5 && (
                      <button className="adp-show-more-btn" onClick={() => setShowAllPopular((v) => !v)}>
                        {showAllPopular ? 'Show Less' : `See More (${popularSongs.length - 5} more)`}
                      </button>
                    )}
                  </div>
                )}

                {newestSong && (
                  <div className="adp-col">
                    <h2 className="adp-section-title">Son Eklenen</h2>
                    <div
                      className="adp-newest-card"
                      onClick={() => {
                        const idx = detailSongs.findIndex((x) => x.id === newestSong.id)
                        playSong(newestSong, detailSongs, idx >= 0 ? idx : 0)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        showSongContextMenu(newestSong, e.clientX, e.clientY)
                      }}
                    >
                      <CoverArt
                        songPath={newestSong.path}
                        hasCover={!!newestSong.has_cover}
                        className="adp-newest-bg"
                        asBackground
                      />
                      <div className="adp-newest-footer">
                        <div className="adp-newest-info">
                          {newestDate && <p className="adp-newest-date">{newestDate}</p>}
                          <p className="adp-newest-title">{newestSong.album && newestSong.album !== 'Unknown Album' ? newestSong.album : newestSong.title}</p>
                        </div>
                        <button
                          className="adp-newest-play-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            const idx = detailSongs.findIndex((x) => x.id === newestSong.id)
                            playSong(newestSong, detailSongs, idx >= 0 ? idx : 0)
                          }}
                        >
                          <Play size={18} fill="currentColor" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── ROW 2: Albümler ── */}
              {albums.length > 0 && (
                <>
                  <div className="adp-divider" />
                  <section className="adp-section">
                    <div className="adp-section-header">
                      <h2 className="adp-section-title">Albums</h2>
                      <div className="adp-sort-btns">
                        <button className={albumSort === 'year' ? 'active' : ''} onClick={() => setAlbumSort('year')}>Year</button>
                        <button className={albumSort === 'alpha' ? 'active' : ''} onClick={() => setAlbumSort('alpha')}>A-Z</button>
                      </div>
                    </div>
                    <div className="adp-album-scroll">
                      {[...albums]
                        .sort((a, b) => albumSort === 'alpha'
                          ? (a.album ?? '').localeCompare(b.album ?? '')
                          : (b.year ?? 0) - (a.year ?? 0)
                        )
                        .map((rep) => {
                        const albumSongs = detailSongs.filter((s) => s.album === rep.album)
                        const albumPlays = albumSongs.reduce((sum, s) => sum + s.play_count, 0)
                        return (
                          <div
                            key={rep.album}
                            className="adp-album-card"
                            onClick={() => setSelectedAlbum(rep.album)}
                          >
                            <CoverArt
                              songPath={rep.path}
                              hasCover={!!rep.has_cover}
                              size={130}
                              className="adp-album-cover"
                            />
                            <p className="adp-album-name">{rep.album}</p>
                            {rep.year && <p className="adp-album-year">{rep.year}</p>}
                            {albumPlays > 0
                              ? <p className="adp-album-plays">{albumPlays.toLocaleString()} plays</p>
                              : <p className="adp-album-dots">···</p>
                            }
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </>
              )}

              {/* ── ROW 3: Singles & EP's ── */}
              {singles.length > 0 && (
                <>
                  <div className="adp-divider" />
                  <section className="adp-section">
                    <div className="adp-section-header">
                      <h2 className="adp-section-title">Singles and EP's</h2>
                      <div className="adp-sort-btns">
                        <button className={albumSort === 'year' ? 'active' : ''} onClick={() => setAlbumSort('year')}>Year</button>
                        <button className={albumSort === 'alpha' ? 'active' : ''} onClick={() => setAlbumSort('alpha')}>A-Z</button>
                      </div>
                    </div>
                    <div className="adp-album-scroll">
                      {[...singles]
                        .sort((a, b) => albumSort === 'alpha'
                          ? (a.album ?? '').localeCompare(b.album ?? '')
                          : (b.year ?? 0) - (a.year ?? 0)
                        )
                        .map((rep) => {
                        const albumSongs = detailSongs.filter((s) => s.album === rep.album)
                        const albumPlays = albumSongs.reduce((sum, s) => sum + s.play_count, 0)
                        return (
                          <div
                            key={rep.album}
                            className="adp-album-card"
                            onClick={() => setSelectedAlbum(rep.album)}
                          >
                            <CoverArt
                              songPath={rep.path}
                              hasCover={!!rep.has_cover}
                              size={130}
                              className="adp-album-cover"
                            />
                            <p className="adp-album-name">{rep.album}</p>
                            {rep.year && <p className="adp-album-year">{rep.year}</p>}
                            {albumPlays > 0
                              ? <p className="adp-album-plays">{albumPlays.toLocaleString()} plays</p>
                              : <p className="adp-album-dots">···</p>
                            }
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Folder Moved Modal ── */}
        {showFolderMovedModal && (
          <div className="adp-modal-overlay" onClick={() => setShowFolderMovedModal(false)}>
            <div className="adp-fm-modal" onClick={(e) => e.stopPropagation()}>
              <p className="adp-fm-title">Folder Not Found</p>
              <p className="adp-fm-desc">
                The saved folder for <strong>{artistDetail}</strong> no longer exists. Would you like to choose a new location?
              </p>
              <div className="adp-fm-actions">
                <button className="adp-fm-cancel" onClick={() => setShowFolderMovedModal(false)}>Cancel</button>
                <button className="adp-fm-pick" onClick={handleRescanFromNewFolder}>Choose New Location</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Wiki Modal ── */}
        {showWikiModal && (
          <div className="adp-modal-overlay" onClick={() => setShowWikiModal(false)}>
            <div className="adp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="adp-modal-header">
                <h2 className="adp-modal-title">{artistDetail}</h2>
                <button className="adp-modal-close" onClick={() => setShowWikiModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="adp-modal-body">
                <p className="adp-modal-text">{wikiFull}</p>
              </div>
              {wikiUrl && (
                <div className="adp-modal-footer">
                  <a
                    className="adp-bio-wiki-link"
                    href={wikiUrl}
                    onClick={(e) => { e.preventDefault(); window.open(wikiUrl) }}
                  >
                    <Globe size={13} />
                    Open in Wikipedia
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Artist grid ─────────────────────────────────────────────────────────────
  return (
    <div className="artists-view">
      <div className="section-header">
        <h2 className="section-title">Artists</h2>
        <span className="count-badge">{artists.length} artists</span>
      </div>
      <div className="artist-grid">
        {artists.map((a, i) => (
          <div
            key={a.name}
            className="artist-card-lg"
            style={!a.cover_path ? { background: ARTIST_GRADIENTS[i % ARTIST_GRADIENTS.length] } : undefined}
            onClick={() => setArtistDetail(a.name)}
          >
            {a.cover_path && (
              <CoverArt
                songPath={a.cover_path}
                hasCover={true}
                className="artist-card-bg"
                asBackground
              />
            )}
            <div className="artist-avatar-lg">{a.name.slice(0, 2).toUpperCase()}</div>
            <p className="artist-name-lg">{a.name}</p>
            <p className="artist-meta">{a.song_count} songs · {a.total_plays} plays</p>
            <button
              className="artist-card-delete-btn"
              title="Delete Artist"
              onClick={async (e) => {
                e.stopPropagation()
                const ok = window.confirm(`All songs by "${a.name}" will be deleted. Are you sure?`)
                if (!ok) return
                await window.api.deleteArtist(a.name)
                loadArtists()
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
