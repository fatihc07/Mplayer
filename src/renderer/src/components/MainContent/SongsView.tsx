import { useEffect, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { Song } from '../../types'
import { CoverArt } from '../shared/CoverArt'
import { formatDuration, formatDate } from '../../utils/format'
import { Play, Music, Heart } from 'lucide-react'
import { showSongContextMenu } from '../shared/SongContextMenu'

const ROW_HEIGHT = 62

export function SongsView(): JSX.Element {
  const { songs, totalSongs, isLoading, loadSongs, searchQuery, toggleFavorite } = useLibraryStore()
  const { playSong, currentSong, isPlaying } = usePlayerStore()
  const parentRef = useRef<HTMLDivElement>(null)

  // Virtual list
  const virtualizer = useVirtualizer({
    count: songs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10
  })

  // Infinite scroll: load more when nearing bottom
  const loadMore = useCallback(async () => {
    if (isLoading || songs.length >= totalSongs) return
    await loadSongs(100, songs.length, searchQuery)
  }, [isLoading, songs.length, totalSongs, searchQuery])

  useEffect(() => {
    const items = virtualizer.getVirtualItems()
    if (!items.length) return
    const lastItem = items[items.length - 1]
    if (lastItem.index >= songs.length - 10) loadMore()
  }, [virtualizer.getVirtualItems()])

  if (!songs.length && !isLoading) {
    return (
      <div className="empty-view">
        <Music size={48} className="empty-icon" />
        <p>No songs found</p>
        <p className="sub">Add a music folder or change your search term</p>
      </div>
    )
  }

  return (
    <div className="songs-view">
      <div className="section-header">
        <h2 className="section-title">Songs</h2>
        <span className="count-badge">{totalSongs.toLocaleString()} songs</span>
      </div>

      {/* Column headers */}
      <div className="song-list-header">
        <span className="slh-num">#</span>
        <span className="slh-title" style={{ gridColumn: 'span 2' }}>Title</span>
        <span className="slh-artist">Artist</span>
        <span className="slh-album">Album</span>
        <span className="slh-plays">Plays</span>
        <span className="slh-last-played">Last Played</span>
        <span></span>
        <span className="slh-dur">Duration</span>
      </div>

      {/* Virtual list parent */}
      <div ref={parentRef} className="song-list-scroll">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const song = songs[vRow.index]
            if (!song) return null
            const isCurrent = currentSong?.id === song.id

            return (
              <div
                key={song.id}
                style={{
                  position: 'absolute',
                  top: vRow.start,
                  width: '100%',
                  height: ROW_HEIGHT
                }}
              >
                <SongListRow
                  song={song}
                  index={vRow.index + 1}
                  isCurrent={isCurrent}
                  isPlaying={isCurrent && isPlaying}
                  onClick={() => playSong(song, songs, vRow.index)}
                  onToggleFavorite={(id) => toggleFavorite(id)}
                />
              </div>
            )
          })}
        </div>
        {isLoading && <div className="load-more-spinner">Loading...</div>}
      </div>
    </div>
  )
}

function SongListRow({
  song, index, isCurrent, isPlaying, onClick, onToggleFavorite
}: {
  song: Song
  index: number
  isCurrent: boolean
  isPlaying: boolean
  onClick: () => void
  onToggleFavorite: (id: number) => void
}): JSX.Element {
  return (
    <div className={`song-list-row ${isCurrent ? 'active' : ''}`} onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); showSongContextMenu(song, e.clientX, e.clientY) }}>
      <span className="slr-num">
        {isPlaying
          ? <span className="playing-bars"><span/><span/><span/></span>
          : isCurrent ? <Play size={12} fill="currentColor" /> : index
        }
      </span>
      <CoverArt songPath={song.path} hasCover={!!song.has_cover} className="slr-cover" size={40} />
      <div className="slr-title-col">
        <p className="slr-title">{song.title}</p>
        <span className={`slr-format-badge ${song.path.split('.').pop()?.toLowerCase() === 'flac' ? 'badge-flac' : 'badge-lossy'}`}>
          {song.path.split('.').pop()?.toUpperCase()}
        </span>
      </div>
      <p className="slr-artist">{song.artist}</p>
      <p className="slr-album">{song.album}</p>
      <span className="slr-plays">{song.play_count > 0 ? song.play_count : '—'}</span>
      <span className="slr-last-played">{formatDate(song.last_played)}</span>
      <button
        className={`heart-btn slr-heart${song.is_favorite ? ' favorited' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(song.id) }}
        title={song.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
      >
        <Heart size={13} fill={song.is_favorite ? 'currentColor' : 'none'} />
      </button>
      <span className="slr-dur">{formatDuration(song.duration)}</span>
    </div>
  )
}
