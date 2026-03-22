import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FolderOpen, RefreshCw, Trash2, FolderPlus, Music,
  Play, ChevronRight, Clock, Heart
} from 'lucide-react'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { Song } from '../../types'
import { CoverArt } from '../shared/CoverArt'
import { showSongContextMenu } from '../shared/SongContextMenu'

interface FolderDetail {
  path: string
  added_at: number
  song_count: number
}

interface SubFolder {
  name: string
  path: string
  song_count: number
}

interface BreadcrumbItem {
  name: string
  path: string
}

export function FoldersView(): JSX.Element {
  const { addAndScanFolder, refreshAfterScan, toggleFavorite } = useLibraryStore()
  const { playSong, currentSong, isPlaying } = usePlayerStore()

  // Root list
  const [rootFolders, setRootFolders] = useState<FolderDetail[]>([])
  const [rootLoading, setRootLoading] = useState(true)

  // Explore state
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])
  const [exploredPath, setExploredPath] = useState<string | null>(null)
  const [exploreSongs, setExploreSongs] = useState<Song[]>([])
  const [subfolders, setSubfolders] = useState<SubFolder[]>([])
  const [exploreLoading, setExploreLoading] = useState(false)

  // Scan state
  const [scanningFolder, setScanningFolder] = useState<string | null>(null)
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, currentFile: '' })

  const loadRootFolders = useCallback(async () => {
    const details = await window.api.getFolderDetails()
    setRootFolders(details)
    setRootLoading(false)
  }, [])

  useEffect(() => { loadRootFolders() }, [loadRootFolders])

  const loadExplore = useCallback(async (path: string) => {
    setExploreLoading(true)
    const [songs, subs] = await Promise.all([
      window.api.getSongsInFolder(path),
      window.api.getSubfolders(path)
    ])
    setExploreSongs(songs)
    setSubfolders(subs)
    setExploreLoading(false)
  }, [])

  const openFolder = useCallback((path: string, name: string) => {
    setBreadcrumb([{ name, path }])
    setExploredPath(path)
    loadExplore(path)
  }, [loadExplore])

  const openSubfolder = useCallback((sub: SubFolder) => {
    setBreadcrumb((prev) => [...prev, { name: sub.name, path: sub.path }])
    setExploredPath(sub.path)
    loadExplore(sub.path)
  }, [loadExplore])

  const navigateToCrumb = useCallback((index: number) => {
    if (index === -1) {
      setExploredPath(null)
      setBreadcrumb([])
      setExploreSongs([])
      setSubfolders([])
      return
    }
    const target = breadcrumb[index]
    setBreadcrumb(breadcrumb.slice(0, index + 1))
    setExploredPath(target.path)
    loadExplore(target.path)
  }, [breadcrumb, loadExplore])

  const handleAddFolder = async () => {
    await addAndScanFolder()
    await loadRootFolders()
  }

  const handleRescan = async (folderPath: string) => {
    setScanningFolder(folderPath)
    setScanProgress({ current: 0, total: 0, currentFile: '' })
    const offProgress = window.api.onScanProgress(setScanProgress)
    try {
      await window.api.rescanFolder(folderPath)
    } finally {
      offProgress()
      setScanningFolder(null)
      await Promise.all([refreshAfterScan(), loadRootFolders()])
      if (exploredPath) loadExplore(exploredPath)
    }
  }

  const handleRemove = async (folderPath: string) => {
    const name = folderPath.split(/[\\/]/).pop() || folderPath
    const confirmed = window.confirm(
      `"${name}" folder and all its songs will be removed from the library. Continue?`
    )
    if (!confirmed) return
    await window.api.removeFolder(folderPath, true)
    if (exploredPath?.startsWith(folderPath)) {
      setExploredPath(null)
      setBreadcrumb([])
    }
    await Promise.all([refreshAfterScan(), loadRootFolders()])
  }

  // ── Explore derived data ───────────────────────────────────────────────────
  const exploreAlbums = useMemo(() => {
    const map = new Map<string, { rep: Song; count: number }>()
    exploreSongs.forEach((s) => {
      if (!s.album || s.album === 'Unknown Album') return
      const e = map.get(s.album)
      if (e) e.count++
      else map.set(s.album, { rep: s, count: 1 })
    })
    return Array.from(map.values()).sort((a, b) => (b.rep.year ?? 0) - (a.rep.year ?? 0))
  }, [exploreSongs])

  const featuredAlbum = useMemo(() => exploreAlbums[0]?.rep ?? null, [exploreAlbums])

  const topTracks = useMemo(
    () => [...exploreSongs].sort((a, b) => b.play_count - a.play_count).slice(0, 7),
    [exploreSongs]
  )

  const allSongs = useMemo(
    () => [...exploreSongs].sort((a, b) => a.title.localeCompare(b.title, 'tr')),
    [exploreSongs]
  )

  // ── EXPLORE PAGE ──────────────────────────────────────────────────────────
  if (exploredPath) {
    const currentName = breadcrumb[breadcrumb.length - 1]?.name ?? ''
    const rootFolder = rootFolders.find((f) => exploredPath.startsWith(f.path))
    const featuredSongs = featuredAlbum
      ? exploreSongs.filter((s) => s.album === featuredAlbum.album)
      : exploreSongs
    const totalDur = exploreSongs.reduce((sum, s) => sum + s.duration, 0)
    const durStr = totalDur >= 3600
      ? `${Math.floor(totalDur / 3600)}sa ${Math.floor((totalDur % 3600) / 60)}dk`
      : `${Math.floor(totalDur / 60)}dk`

    return (
      <div className="fex-root">
        {/* ── Breadcrumb nav ── */}
        <div className="fex-nav">
          <button className="fex-nav-item fex-nav-home" onClick={() => navigateToCrumb(-1)}>
            <FolderOpen size={13} />
            My Folders
          </button>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.path} className="fex-nav-crumb">
              <ChevronRight size={12} className="fex-nav-sep" />
              <button
                className={`fex-nav-item${i === breadcrumb.length - 1 ? ' fex-nav-item--active' : ''}`}
                onClick={() => i < breadcrumb.length - 1 ? navigateToCrumb(i) : undefined}
              >
                {crumb.name}
              </button>
            </span>
          ))}
          <span className="fex-nav-spacer" />
          {rootFolder && (
            <button
              className="fex-action-btn"
              onClick={() => handleRescan(rootFolder.path)}
              disabled={!!scanningFolder}
            >
              <RefreshCw size={13} className={scanningFolder === rootFolder.path ? 'fv-spin' : ''} />
              Update
            </button>
          )}
          {rootFolder && (
            <button
              className="fex-action-btn fex-action-btn--danger"
              onClick={() => handleRemove(rootFolder.path)}
              disabled={!!scanningFolder}
            >
              <Trash2 size={13} />
              Remove
            </button>
          )}
        </div>

        {exploreLoading ? (
          <div className="fv-loading">Loading…</div>
        ) : exploreSongs.length === 0 ? (
          <div className="fv-empty">
            <Music size={48} strokeWidth={1.2} className="fv-empty-icon" />
            <p className="fv-empty-title">No songs found in this folder</p>
            <p className="fv-empty-sub">Try scanning the folder first.</p>
          </div>
        ) : (
          <>
            {/* ── HERO ── */}
            <div className="fex-hero">
              <div className="fex-hero-left">
                {featuredAlbum && (
                  <CoverArt
                    songPath={featuredAlbum.path}
                    hasCover={!!featuredAlbum.has_cover}
                    className="fex-hero-bgdiv"
                    asBackground
                  />
                )}
                <div className="fex-hero-blur" />
                <div className="fex-hero-gradient" />
                <div className="fex-hero-content">
                  <div className="fex-hero-pills">
                    <span className="fex-pill">{exploreAlbums.length} albums</span>
                    <span className="fex-pill">{exploreSongs.length} songs</span>
                    <span className="fex-pill">{durStr}</span>
                  </div>
                  {featuredAlbum && (
                    <CoverArt
                      songPath={featuredAlbum.path}
                      hasCover={!!featuredAlbum.has_cover}
                      size={88}
                      className="fex-hero-cover"
                    />
                  )}
                  <h1 className="fex-hero-folder">{currentName}</h1>
                  {featuredAlbum && (
                    <>
                      <p className="fex-hero-album">
                        {featuredAlbum.album}
                        {featuredAlbum.year ? ` · ${featuredAlbum.year}` : ''}
                      </p>
                      <p className="fex-hero-artist">{featuredAlbum.artist}</p>
                    </>
                  )}
                  <button
                    className="fex-hero-play-btn"
                    onClick={() => playSong(exploreSongs[0], exploreSongs, 0)}
                  >
                    <Play size={16} fill="currentColor" />
                    Play All
                  </button>
                </div>
              </div>

              {/* Right: top tracks */}
              <div className="fex-hero-right">
                <p className="fex-hero-right-title">Most Played</p>
                <div className="fex-ht-list">
                  {topTracks.map((s, i) => {
                    const isActive = currentSong?.id === s.id
                    const albumSongs = exploreSongs.filter((x) => x.album === s.album)
                    const mins = Math.floor(s.duration / 60)
                    const secs = String(Math.floor(s.duration % 60)).padStart(2, '0')
                    return (
                      <div
                        key={s.id}
                        className={`fex-ht-row${isActive ? ' fex-ht-row--active' : ''}`}
                        onClick={() => {
                          const queue = albumSongs.length ? albumSongs : exploreSongs
                          const idx = queue.findIndex((x) => x.id === s.id)
                          playSong(s, queue, idx >= 0 ? idx : i)
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          showSongContextMenu(s, e.clientX, e.clientY)
                        }}
                      >
                        <span className="fex-ht-num">
                          {isActive && isPlaying
                            ? <span className="adp-al-bars"><span /><span /><span /></span>
                            : <span>{i + 1}</span>
                          }
                        </span>
                        <div className="fex-ht-info">
                          <p className="fex-ht-title">{s.title}</p>
                          <p className="fex-ht-artist">{s.artist}</p>
                        </div>
                        <span className="fex-ht-dur">{mins}:{secs}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── SUBFOLDERS ── */}
            {subfolders.length > 0 && (
              <div className="fex-section">
                <h2 className="fex-section-title">Subfolders</h2>
                <div className="fex-subfolder-row">
                  {subfolders.map((sub) => (
                    <div key={sub.path} className="fex-subcard" onClick={() => openSubfolder(sub)}>
                      <FolderOpen size={22} strokeWidth={1.5} className="fex-subcard-icon" />
                      <p className="fex-subcard-name">{sub.name}</p>
                      <p className="fex-subcard-count">{sub.song_count} songs</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ALBUMS ── */}
            {exploreAlbums.length > 0 && (
              <div className="fex-section">
                <h2 className="fex-section-title">
                  Recent Albums
                  <span className="fex-section-count">{exploreAlbums.length}</span>
                </h2>
                <div className="fex-album-scroll">
                  {exploreAlbums.map(({ rep }) => {
                    const albumSongs = exploreSongs.filter((s) => s.album === rep.album)
                    return (
                      <div
                        key={rep.album}
                        className="fex-album-card"
                        onClick={() => playSong(albumSongs[0], albumSongs, 0)}
                      >
                        <CoverArt
                          songPath={rep.path}
                          hasCover={!!rep.has_cover}
                          size={130}
                          className="fex-album-cover"
                        />
                        <p className="fex-album-name">{rep.album}</p>
                        <p className="fex-album-sub">
                          {rep.artist}
                          {rep.year ? <span className="fex-album-year"> · {rep.year}</span> : null}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── TRACK LIST ── */}
            <div className="fex-section">
              <h2 className="fex-section-title">
                Tüm Şarkılar
                <span className="fex-section-count">{allSongs.length}</span>
              </h2>
              <div className="fex-tracklist">
                <div className="fex-tl-header">
                  <span className="fex-tl-num">#</span>
                  <span className="fex-tl-spacer" />
                  <span className="fex-tl-th-title">Title</span>
                  <span className="fex-tl-th-album">Album</span>
                  <span className="fex-tl-th-heart" />
                  <span className="fex-tl-th-dur"><Clock size={13} /></span>
                </div>
                {allSongs.map((s, i) => {
                  const isActive = currentSong?.id === s.id
                  const albumSongs = exploreSongs.filter((x) => x.album === s.album)
                  const idx = albumSongs.findIndex((x) => x.id === s.id)
                  const mins = Math.floor(s.duration / 60)
                  const secs = String(Math.floor(s.duration % 60)).padStart(2, '0')
                  return (
                    <div
                      key={s.id}
                      className={`fex-tl-row${isActive ? ' fex-tl-row--active' : ''}`}
                      onClick={() => playSong(s, albumSongs.length ? albumSongs : exploreSongs, idx >= 0 ? idx : i)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        showSongContextMenu(s, e.clientX, e.clientY)
                      }}
                    >
                      <span className="fex-tl-num">
                        {isActive && isPlaying
                          ? <span className="adp-al-bars"><span /><span /><span /></span>
                          : <span className="fex-tl-num-val">{i + 1}</span>
                        }
                      </span>
                      <div className="fex-tl-art">
                        <CoverArt songPath={s.path} hasCover={!!s.has_cover} size={38} className="fex-tl-cover" />
                      </div>
                      <div className="fex-tl-info">
                        <p className="fex-tl-title">{s.title}</p>
                        <p className="fex-tl-artist">{s.artist}</p>
                      </div>
                      <span className="fex-tl-album">{s.album}</span>
                      <button
                        className={`fex-tl-heart${s.is_favorite ? ' fex-tl-heart--active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(s.id) }}
                      >
                        <Heart size={14} fill={s.is_favorite ? 'currentColor' : 'none'} />
                      </button>
                      <span className="fex-tl-dur">{mins}:{secs}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── ROOT FOLDER LIST ──────────────────────────────────────────────────────
  if (rootLoading) {
    return <div className="fv-root"><div className="fv-loading">Loading…</div></div>
  }

  const totalSongs = rootFolders.reduce((s, f) => s + f.song_count, 0)

  return (
    <div className="fv-root">
      <div className="fv-header">
        <div className="fv-header-text">
          <h1 className="fv-title">My Folders</h1>
          <p className="fv-subtitle">{rootFolders.length} folders · {totalSongs.toLocaleString()} songs</p>
        </div>
        <button className="fv-add-btn" onClick={handleAddFolder} disabled={!!scanningFolder}>
          <FolderPlus size={15} />
          <span>Add Folder</span>
        </button>
      </div>

      {rootFolders.length === 0 ? (
        <div className="fv-empty">
          <FolderOpen size={56} strokeWidth={1.2} className="fv-empty-icon" />
          <p className="fv-empty-title">No folders added yet</p>
          <p className="fv-empty-sub">
            Add music folders to build your library. FLAC, MP3 and other formats are scanned automatically.
          </p>
          <button className="fv-add-btn fv-add-btn--lg" onClick={handleAddFolder}>
            <FolderPlus size={16} />
            <span>Add First Folder</span>
          </button>
        </div>
      ) : (
        <div className="fv-list">
          {rootFolders.map((folder) => {
            const isScanning = scanningFolder === folder.path
            const name = folder.path.split(/[\\/]/).pop() || folder.path
            const pct = scanProgress.total > 0
              ? Math.round((scanProgress.current / scanProgress.total) * 100)
              : 0
            return (
              <div
                key={folder.path}
                className={`fv-card fv-card--clickable${isScanning ? ' fv-card--scanning' : ''}`}
                onClick={() => !isScanning && openFolder(folder.path, name)}
              >
                <div className="fv-card-icon"><FolderOpen size={26} strokeWidth={1.5} /></div>
                <div className="fv-card-body">
                  <p className="fv-card-name">{name}</p>
                  <p className="fv-card-path">{folder.path}</p>
                  <div className="fv-card-meta">
                    <span className="fv-card-count"><Music size={11} />{folder.song_count.toLocaleString()} songs</span>
                    <span className="fv-card-dot">·</span>
                    <span className="fv-card-date">{new Date(folder.added_at).toLocaleDateString('en-US')}</span>
                  </div>
                  {isScanning && (
                    <div className="fv-progress">
                      <div className="fv-progress-bar">
                        <div className="fv-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="fv-progress-text">
                        {scanProgress.total > 0
                          ? `${scanProgress.current} / ${scanProgress.total} — ${scanProgress.currentFile}`
                          : 'Scanning…'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="fv-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="fv-btn fv-btn--update"
                    onClick={() => handleRescan(folder.path)}
                    disabled={!!scanningFolder}
                    title="Update"
                  >
                    <RefreshCw size={14} className={isScanning ? 'fv-spin' : ''} />
                    <span>{isScanning ? `${pct}%` : 'Update'}</span>
                  </button>
                  <button
                    className="fv-btn fv-btn--remove"
                    onClick={() => handleRemove(folder.path)}
                    disabled={!!scanningFolder}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="fv-card-arrow"><ChevronRight size={18} /></div>
              </div>
            )
          })}
        </div>
      )}

      {rootFolders.length > 0 && (
        <div className="fv-info-box">
          Clicking <strong>Update</strong> rescans all files in the folder. If a higher-quality version of a song is found, stats are preserved and it is automatically upgraded. Files that no longer exist are removed from the library.
        </div>
      )}
    </div>
  )
}
