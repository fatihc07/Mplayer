import { memo, useState, useCallback, useRef } from 'react'
import { X, Trash2, Play, GripVertical } from 'lucide-react'
import { usePlayerStore } from '../../stores/playerStore'
import { CoverArt } from '../shared/CoverArt'
import { formatDuration } from '../../utils/format'
import { Song } from '../../types'

export function QueuePanel({ onClose }: { onClose: () => void }): JSX.Element {
  const { queue, queueIndex, currentSong, playSong, removeFromQueue, clearUpcoming, reorderQueue } = usePlayerStore()

  const upcoming = queue.slice(queueIndex + 1)
  const history = queue.slice(0, queueIndex).reverse()

  // ── Drag state ──
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const dragNodeRef = useRef<HTMLDivElement | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, localIndex: number) => {
    setDragIdx(localIndex)
    e.dataTransfer.effectAllowed = 'move'
    // Ghost image
    if (e.currentTarget instanceof HTMLElement) {
      dragNodeRef.current = e.currentTarget as HTMLDivElement
      e.currentTarget.classList.add('queue-dragging')
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, localIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverIdx(localIndex)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      const fromAbs = queueIndex + 1 + dragIdx
      const toAbs = queueIndex + 1 + overIdx
      reorderQueue(fromAbs, toAbs)
    }
    if (dragNodeRef.current) {
      dragNodeRef.current.classList.remove('queue-dragging')
    }
    setDragIdx(null)
    setOverIdx(null)
    dragNodeRef.current = null
  }, [dragIdx, overIdx, queueIndex, reorderQueue])

  return (
    <div className="queue-panel">
      <div className="queue-header">
        <h3>Upcoming Songs</h3>
        <div className="queue-header-actions">
          {upcoming.length > 0 && (
            <button className="queue-clear-btn" onClick={clearUpcoming}>
              <Trash2 size={13} /> Clear
            </button>
          )}
          <button className="queue-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="queue-body">
        {/* Now Playing */}
        {currentSong && (
          <div className="queue-section">
            <p className="queue-label">Now Playing</p>
            <QueueItem song={currentSong} isActive />
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="queue-section">
            <p className="queue-label">Up Next ({upcoming.length})</p>
            {upcoming.map((song, i) => (
              <QueueItem
                key={`${song.id}-${queueIndex + 1 + i}`}
                song={song}
                index={i + 1}
                draggable
                isDragOver={overIdx === i && dragIdx !== i}
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                onRemove={() => removeFromQueue(queueIndex + 1 + i)}
                onPlay={() => playSong(song, queue, queueIndex + 1 + i)}
              />
            ))}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="queue-section">
            <p className="queue-label">Previous ({history.length})</p>
            {history.slice(0, 20).map((song, i) => (
              <QueueItem
                key={`hist-${song.id}-${i}`}
                song={song}
                isHistory
                onPlay={() => playSong(song, queue, queueIndex - 1 - i)}
              />
            ))}
          </div>
        )}

        {upcoming.length === 0 && history.length === 0 && !currentSong && (
          <div className="queue-empty">
            <p>Queue is empty</p>
          </div>
        )}
      </div>
    </div>
  )
}

const QueueItem = memo(function QueueItem({
  song, index, isActive, isHistory, draggable, isDragOver,
  onDragStart, onDragOver, onDragEnd, onRemove, onPlay
}: {
  song: Song
  index?: number
  isActive?: boolean
  isHistory?: boolean
  draggable?: boolean
  isDragOver?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  onRemove?: () => void
  onPlay?: () => void
}): JSX.Element {
  return (
    <div
      className={`queue-item${isActive ? ' active' : ''}${isHistory ? ' history' : ''}${isDragOver ? ' drag-over' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      {draggable && (
        <span className="queue-drag-handle">
          <GripVertical size={14} />
        </span>
      )}
      {!draggable && index !== undefined && <span className="queue-num">{index}</span>}
      <CoverArt songPath={song.path} hasCover={!!song.has_cover} size={36} className="queue-cover" />
      <div className="queue-item-info" onClick={onPlay}>
        <p className="queue-item-title">{song.title}</p>
        <p className="queue-item-artist">{song.artist}</p>
      </div>
      <span className="queue-item-dur">{formatDuration(song.duration)}</span>
      {onPlay && !isActive && (
        <button className="queue-item-play" onClick={onPlay} title="Play">
          <Play size={12} fill="currentColor" />
        </button>
      )}
      {onRemove && !isActive && (
        <button className="queue-item-remove" onClick={onRemove} title="Remove">
          <X size={13} />
        </button>
      )}
    </div>
  )
})
