import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { Artist, Song } from '../../types'
import { CoverArt } from '../shared/CoverArt'
import { formatDuration } from '../../utils/format'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, Play, Music, Heart, Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react'
import { AddToPlaylistBtn } from '../shared/AddToPlaylistBtn'
import { showSongContextMenu } from '../shared/SongContextMenu'

type LibTab = 'artists' | 'songs'

type ArtistSort = 'name-asc' | 'name-desc' | 'songs-desc' | 'songs-asc' | 'plays-desc' | 'plays-asc'
type SongSort = 'name-asc' | 'name-desc' | 'artist-asc' | 'artist-desc' | 'duration-asc' | 'duration-desc' | 'plays-desc' | 'plays-asc' | 'recent-desc' | 'recent-asc'

const ARTIST_SORT_OPTIONS: { value: ArtistSort; label: string }[] = [
  { value: 'name-asc',   label: 'Ad (A-Z)' },
  { value: 'name-desc',  label: 'Ad (Z-A)' },
  { value: 'songs-desc', label: 'Song Count (High \u2192 Low)' },
  { value: 'songs-asc',  label: 'Song Count (Low \u2192 High)' },
  { value: 'plays-desc', label: 'Plays (High \u2192 Low)' },
  { value: 'plays-asc',  label: 'Plays (Low \u2192 High)' }
]

const SONG_SORT_OPTIONS: { value: SongSort; label: string }[] = [
  { value: 'name-asc',     label: 'Ad (A-Z)' },
  { value: 'name-desc',    label: 'Ad (Z-A)' },
  { value: 'artist-asc',   label: 'Artist (A-Z)' },
  { value: 'artist-desc',  label: 'Artist (Z-A)' },
  { value: 'duration-asc', label: 'Duration (Short \u2192 Long)' },
  { value: 'duration-desc',label: 'Duration (Long \u2192 Short)' },
  { value: 'plays-desc',   label: 'Plays (High \u2192 Low)' },
  { value: 'plays-asc',    label: 'Plays (Low \u2192 High)' },
  { value: 'recent-desc',  label: 'Added (Newest \u2192 Oldest)' },
  { value: 'recent-asc',   label: 'Added (Oldest \u2192 Newest)' }
]

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

export function LibraryView(): JSX.Element {
  const [tab, setTab] = useState<LibTab>('artists')
  const [artistSort, setArtistSort] = useState<ArtistSort>('name-asc')
  const [songSort, setSongSort] = useState<SongSort>('name-asc')
  const [filter, setFilter] = useState('')
  const [showSort, setShowSort] = useState(false)
  const [showFilter, setShowFilter] = useState(false)

  // Reset filter when switching tabs
  const switchTab = (t: LibTab) => { setTab(t); setFilter(''); setShowFilter(false) }

  const currentSortLabel = tab === 'artists'
    ? ARTIST_SORT_OPTIONS.find((o) => o.value === artistSort)!.label
    : SONG_SORT_OPTIONS.find((o) => o.value === songSort)!.label

  const sortOptions = tab === 'artists' ? ARTIST_SORT_OPTIONS : SONG_SORT_OPTIONS
  const currentSortValue = tab === 'artists' ? artistSort : songSort

  return (
    <div className="lib-view">
      <h1 className="lib-title">Library</h1>

      <div className="lib-toolbar">
        <div className="lib-tabs">
          <button className={`lib-tab${tab === 'artists' ? ' active' : ''}`} onClick={() => switchTab('artists')}>
            Artists
          </button>
          <button className={`lib-tab${tab === 'songs' ? ' active' : ''}`} onClick={() => switchTab('songs')}>
            Songs
          </button>
        </div>

        <div className="lib-toolbar-right">
          {/* Filter toggle */}
          <button
            className={`lib-filter-toggle${showFilter ? ' active' : ''}`}
            onClick={() => setShowFilter((v) => !v)}
            title="Filter"
          >
            <Search size={14} />
          </button>

          {/* Sort dropdown */}
          <div className="lib-sort-wrap" onMouseLeave={() => setShowSort(false)}>
            <button className="lib-sort-btn" onClick={() => setShowSort((v) => !v)}>
              <ArrowUpDown size={13} />
              {currentSortLabel}
              <ChevronDown size={12} />
            </button>
            {showSort && (
              <div className="lib-sort-menu">
                {sortOptions.map((o) => (
                  <button
                    key={o.value}
                    className={`lib-sort-option${currentSortValue === o.value ? ' active' : ''}`}
                    onClick={() => {
                      if (tab === 'artists') setArtistSort(o.value as ArtistSort)
                      else setSongSort(o.value as SongSort)
                      setShowSort(false)
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      {showFilter && (
        <div className="lib-filter-bar">
          <Search size={14} className="lib-filter-icon" />
          <input
            className="lib-filter-input"
            placeholder={tab === 'artists' ? 'Search artists...' : 'Search songs or artists...'}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
          {filter && (
            <button className="lib-filter-clear" onClick={() => setFilter('')}>
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {tab === 'artists' && <ArtistsGrid sort={artistSort} filter={filter} />}
      {tab === 'songs' && <SongsGrid sort={songSort} filter={filter} />}
    </div>
  )
}

// ─── Artists Grid ─────────────────────────────────────────────────────────────

function ArtistsGrid({ sort, filter }: { sort: ArtistSort; filter: string }): JSX.Element {
  const { artists, loadArtists, setArtistDetail } = useLibraryStore()

  useEffect(() => { if (!artists.length) loadArtists() }, [])

  const sorted = useMemo(() => {
    let arr = [...artists]

    // Filter
    if (filter) {
      const q = filter.toLowerCase()
      arr = arr.filter((a) => a.name.toLowerCase().includes(q))
    }

    // Sort
    switch (sort) {
      case 'name-asc':   return arr.sort((a, b) => a.name.localeCompare(b.name))
      case 'name-desc':  return arr.sort((a, b) => b.name.localeCompare(a.name))
      case 'songs-desc': return arr.sort((a, b) => b.song_count - a.song_count)
      case 'songs-asc':  return arr.sort((a, b) => a.song_count - b.song_count)
      case 'plays-desc': return arr.sort((a, b) => b.total_plays - a.total_plays)
      case 'plays-asc':  return arr.sort((a, b) => a.total_plays - b.total_plays)
      default: return arr
    }
  }, [artists, sort, filter])

  if (!artists.length) {
    return (
      <div className="empty-view" style={{ marginTop: 40 }}>
        <Music size={48} className="empty-icon" />
        <p>No artists yet</p>
      </div>
    )
  }

  if (!sorted.length) {
    return (
      <div className="empty-view" style={{ marginTop: 40 }}>
        <Search size={40} className="empty-icon" />
        <p>No artists matching "{filter}"</p>
      </div>
    )
  }

  return (
    <>
      <p className="lib-result-count">{sorted.length} artists</p>
      <div className="lib-artist-grid">
        {sorted.map((a, i) => (
          <LibArtistCard key={a.name} artist={a} index={i} onClick={() => setArtistDetail(a.name)} />
        ))}
      </div>
    </>
  )
}

const LibArtistCard = memo(function LibArtistCard({
  artist, index, onClick
}: {
  artist: Artist; index: number; onClick: () => void
}): JSX.Element {
  return (
    <div
      className="lib-artist-card"
      style={!artist.cover_path ? { background: ARTIST_GRADIENTS[index % ARTIST_GRADIENTS.length] } : undefined}
      onClick={onClick}
    >
      {artist.cover_path && (
        <CoverArt
          songPath={artist.cover_path}
          hasCover
          className="lib-artist-card-bg"
          asBackground
        />
      )}
      <div className="lib-artist-card-overlay" />
      <div className="lib-artist-card-hover">
        <p className="lib-artist-card-stat">{artist.song_count} Songs · {artist.total_plays} plays</p>
      </div>
      <p className="lib-artist-card-name">{artist.name}</p>
    </div>
  )
})

// ─── Songs Grid (virtualized + lazy loading) ─────────────────────────────────

const SONG_ROW_HEIGHT = 52
const SONGS_PER_PAGE = 100

function SongsGrid({ sort, filter }: { sort: SongSort; filter: string }): JSX.Element {
  const { songs, loadSongs, totalSongs, toggleFavorite } = useLibraryStore()
  const { playSong, currentSong, isPlaying } = usePlayerStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  useEffect(() => { if (!songs.length) loadSongs() }, [])

  const sorted = useMemo(() => {
    let arr = [...songs]

    // Filter
    if (filter) {
      const q = filter.toLowerCase()
      arr = arr.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
      )
    }

    // Sort
    switch (sort) {
      case 'name-asc':      return arr.sort((a, b) => a.title.localeCompare(b.title))
      case 'name-desc':     return arr.sort((a, b) => b.title.localeCompare(a.title))
      case 'artist-asc':    return arr.sort((a, b) => a.artist.localeCompare(b.artist))
      case 'artist-desc':   return arr.sort((a, b) => b.artist.localeCompare(a.artist))
      case 'duration-asc':  return arr.sort((a, b) => a.duration - b.duration)
      case 'duration-desc': return arr.sort((a, b) => b.duration - a.duration)
      case 'plays-desc':    return arr.sort((a, b) => b.play_count - a.play_count)
      case 'plays-asc':     return arr.sort((a, b) => a.play_count - b.play_count)
      case 'recent-desc':   return arr.sort((a, b) => b.date_added - a.date_added)
      case 'recent-asc':    return arr.sort((a, b) => a.date_added - b.date_added)
      default: return arr
    }
  }, [songs, sort, filter])

  const hasMore = songs.length < totalSongs

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    loadSongs(SONGS_PER_PAGE, songs.length).finally(() => {
      loadingRef.current = false
    })
  }, [songs.length, hasMore, loadSongs])

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => SONG_ROW_HEIGHT,
    overscan: 15
  })

  // Lazy load when scrolled near bottom
  useEffect(() => {
    const items = virtualizer.getVirtualItems()
    if (!items.length) return
    const lastItem = items[items.length - 1]
    if (lastItem.index >= sorted.length - 20 && hasMore) {
      loadMore()
    }
  }, [virtualizer.getVirtualItems(), sorted.length, hasMore, loadMore])

  if (!songs.length) {
    return (
      <div className="empty-view" style={{ marginTop: 40 }}>
        <Music size={48} className="empty-icon" />
        <p>No songs found</p>
      </div>
    )
  }

  if (!sorted.length) {
    return (
      <div className="empty-view" style={{ marginTop: 40 }}>
        <Search size={40} className="empty-icon" />
        <p>No songs matching "{filter}"</p>
      </div>
    )
  }

  return (
    <>
      <p className="lib-result-count">{sorted.length} songs{hasMore ? ` (${totalSongs} total)` : ''}</p>
      <div className="lib-songs-scroll" ref={scrollRef}>
        <div
          className="lib-songs-list"
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((vRow) => {
            const song = sorted[vRow.index]
            if (!song) return null
            return (
              <LibSongRow
                key={song.id}
                song={song}
                index={vRow.index}
                isCurrent={currentSong?.id === song.id}
                isPlaying={isPlaying}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: vRow.size,
                  transform: `translateY(${vRow.start}px)`
                }}
                onPlay={() => playSong(song, sorted, vRow.index)}
                onToggleFav={() => toggleFavorite(song.id)}
              />
            )
          })}
        </div>
      </div>
    </>
  )
}

const LibSongRow = memo(function LibSongRow({
  song, index, isCurrent, isPlaying, style, onPlay, onToggleFav
}: {
  song: Song; index: number; isCurrent: boolean; isPlaying: boolean
  style: React.CSSProperties; onPlay: () => void; onToggleFav: () => void
}): JSX.Element {
  return (
    <div
      className={`lib-song-row${isCurrent ? ' active' : ''}`}
      style={style}
      onClick={onPlay}
      onContextMenu={(e) => { e.preventDefault(); showSongContextMenu(song, e.clientX, e.clientY) }}
    >
      <span className="lib-song-num">
        {isCurrent && isPlaying
          ? <span className="playing-bars"><span /><span /><span /></span>
          : isCurrent ? <Play size={12} fill="currentColor" /> : index + 1
        }
      </span>
      <CoverArt songPath={song.path} hasCover={!!song.has_cover} className="lib-song-cover" size={40} />
      <div className="lib-song-info">
        <p className="lib-song-title">{song.title}</p>
        <p className="lib-song-artist">{song.artist}</p>
      </div>
      <span className="lib-song-dur">{formatDuration(song.duration)}</span>
      <AddToPlaylistBtn songId={song.id} />
      <button
        className={`heart-btn lib-song-heart${song.is_favorite ? ' favorited' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleFav() }}
      >
        <Heart size={13} fill={song.is_favorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
})
