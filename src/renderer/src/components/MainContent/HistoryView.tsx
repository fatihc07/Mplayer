import { useEffect, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { HistoryEntry } from '../../types'
import { CoverArt } from '../shared/CoverArt'
import { formatDuration } from '../../utils/format'
import { History, Trash2, Heart } from 'lucide-react'
import { showSongContextMenu } from '../shared/SongContextMenu'
import { Song } from '../../types'

const ROW_HEIGHT = 66

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minutes ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} hours ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} days ago`
  return new Date(ts).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatAbsoluteTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function HistoryView(): JSX.Element {
  const { history, totalHistory, loadHistory, deleteHistoryEntry, toggleFavorite } = useLibraryStore()
  const { playSong, currentSong, isPlaying } = usePlayerStore()
  const parentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadHistory(100, 0)
  }, [])

  const virtualizer = useVirtualizer({
    count: history.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10
  })

  const loadMore = useCallback(async () => {
    if (history.length >= totalHistory) return
    await loadHistory(100, history.length)
  }, [history.length, totalHistory])

  useEffect(() => {
    const items = virtualizer.getVirtualItems()
    if (!items.length) return
    const last = items[items.length - 1]
    if (last.index >= history.length - 10) loadMore()
  }, [virtualizer.getVirtualItems()])

  if (!history.length) {
    return (
      <div className="empty-view">
        <History size={48} className="empty-icon" />
        <p>No listening history yet</p>
        <p className="sub">Appears here once you've listened to 80% of a song</p>
      </div>
    )
  }

  return (
    <div className="songs-view">
      <div className="section-header">
        <h2 className="section-title">Listening History</h2>
        <span className="count-badge">{totalHistory.toLocaleString()} plays</span>
      </div>

      {/* Column headers */}
      <div className="history-list-header history-list-header--with-del">
        <span />
        <span>Song</span>
        <span>Artist</span>
        <span>Album</span>
        <span>Duration</span>
        <span>Ne Zaman</span>
        <span />
        <span />
      </div>

      <div ref={parentRef} className="song-list-scroll">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const entry = history[vRow.index]
            if (!entry) return null
            const isCurrent = currentSong?.id === entry.song_id

            return (
              <div
                key={`${entry.history_id}`}
                style={{
                  position: 'absolute',
                  top: vRow.start,
                  width: '100%',
                  height: ROW_HEIGHT
                }}
              >
                <HistoryRow
                  entry={entry}
                  isCurrent={isCurrent}
                  isPlaying={isCurrent && isPlaying}
                  onDelete={() => deleteHistoryEntry(entry.song_id, entry.played_at)}
                  onToggleFavorite={() => toggleFavorite(entry.song_id)}
                  onClick={() => {
                    // Build a minimal Song object to play
                    const song = {
                      id: entry.song_id,
                      path: entry.path,
                      title: entry.title,
                      artist: entry.artist,
                      album: entry.album,
                      album_artist: entry.artist,
                      duration: entry.duration,
                      has_cover: entry.has_cover,
                      play_count: entry.play_count,
                      year: null, genre: null, track_number: null,
                      file_size: 0, date_added: 0, last_played: entry.played_at, rating: 0,
                      is_favorite: 0, bitrate: 0
                    }
                    playSong(song)
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function HistoryRow({
  entry, isCurrent, isPlaying, onClick, onDelete, onToggleFavorite
}: {
  entry: HistoryEntry
  isCurrent: boolean
  isPlaying: boolean
  onClick: () => void
  onDelete: () => void
  onToggleFavorite: () => void
}): JSX.Element {
  const handleContext = (e: React.MouseEvent): void => {
    e.preventDefault()
    const song: Song = {
      id: entry.song_id, path: entry.path, title: entry.title, artist: entry.artist,
      album: entry.album, album_artist: entry.artist, duration: entry.duration,
      has_cover: entry.has_cover, play_count: entry.play_count,
      year: null, genre: null, track_number: null, file_size: 0, date_added: 0,
      last_played: entry.played_at, rating: 0, is_favorite: 0, bitrate: 0
    }
    showSongContextMenu(song, e.clientX, e.clientY)
  }
  return (
    <div className={`history-row history-row--with-del ${isCurrent ? 'active' : ''}`} onClick={onClick}
      onContextMenu={handleContext}>
      <CoverArt
        songPath={entry.path}
        hasCover={!!entry.has_cover}
        className="slr-cover"
        size={44}
      />
      <div className="slr-title-col">
        <p className="slr-title">
          {isPlaying && (
            <span className="playing-bars" style={{ marginRight: 6 }}>
              <span/><span/><span/>
            </span>
          )}
          {entry.title}
        </p>
        {entry.day_count > 1 && (
          <span className="history-day-count">x{entry.day_count}</span>
        )}
      </div>
      <p className="slr-artist">{entry.artist}</p>
      <p className="slr-album">{entry.album}</p>
      <span className="slr-dur">{formatDuration(entry.duration)}</span>
      <div className="history-time-col">
        <span className="history-relative">{formatRelativeTime(entry.played_at)}</span>
        <span className="history-absolute">{formatAbsoluteTime(entry.played_at)}</span>
      </div>
      <button
        className={`heart-btn history-fav-btn${entry.is_favorite ? ' favorited' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
        title={entry.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
      >
        <Heart size={13} fill={entry.is_favorite ? 'currentColor' : 'none'} />
      </button>
      <button
        className="history-delete-btn"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        title="Remove from history"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
