import { useState, useEffect } from 'react'
import { useI18n } from '../../i18n'
import { CoverArt } from '../shared/CoverArt'
import { usePlayerStore } from '../../stores/playerStore'
import { Song } from '../../types'
import { Copy, Trash2, Play, ChevronDown, ChevronUp } from 'lucide-react'

interface DuplicateGroup {
  title: string
  artist: string
  songs: Song[]
}

interface DeletePrompt {
  song: Song
  groupIndex: number
}

export function DuplicatesView(): JSX.Element {
  const { t } = useI18n()
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [deletePrompt, setDeletePrompt] = useState<DeletePrompt | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    window.api.getDuplicates().then((data: DuplicateGroup[]) => {
      setGroups(data)
      setLoading(false)
    })
  }, [])

  const toggleExpand = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDelete = async (fromDisk: boolean): Promise<void> => {
    if (!deletePrompt) return
    setDeleting(true)
    try {
      const { song, groupIndex } = deletePrompt
      await window.api.deleteSong(song.id, fromDisk)
      // Update local state — remove song from group
      setGroups((prev) => {
        const updated = [...prev]
        const group = { ...updated[groupIndex] }
        group.songs = group.songs.filter((s) => s.id !== song.id)
        if (group.songs.length <= 1) {
          // No longer a duplicate group, remove it
          updated.splice(groupIndex, 1)
        } else {
          updated[groupIndex] = group
        }
        return updated
      })
      // If currently playing this song, stop
      const { currentSong } = usePlayerStore.getState()
      if (currentSong?.id === song.id) {
        usePlayerStore.setState({ currentSong: null, isPlaying: false })
      }
    } finally {
      setDeleting(false)
      setDeletePrompt(null)
    }
  }

  if (loading) {
    return (
      <div className="dup-loading">
        <div className="wr-loading-spinner" />
        <p>{t.loading}</p>
      </div>
    )
  }

  return (
    <div className="dup-root">
      <div className="dup-header">
        <div>
          <h1 className="dup-title"><Copy size={24} /> {t.duplicateTitle}</h1>
          <p className="dup-desc">{t.duplicateDesc}</p>
        </div>
        {groups.length > 0 && (
          <div className="dup-badge">{groups.length} {t.duplicateGroups}</div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="dup-empty">
          <Copy size={48} />
          <p>{t.noDuplicates}</p>
        </div>
      ) : (
        <div className="dup-list">
          {groups.map((g, i) => (
            <div key={i} className={`dup-group ${expanded.has(i) ? 'expanded' : ''}`}>
              <button className="dup-group-header" onClick={() => toggleExpand(i)}>
                <div className="dup-group-info">
                  <span className="dup-group-title">{g.title}</span>
                  <span className="dup-group-artist">{g.artist}</span>
                </div>
                <span className="dup-group-count">{g.songs.length} copies</span>
                {expanded.has(i) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {expanded.has(i) && (
                <div className="dup-group-songs">
                  {g.songs.map((s, j) => (
                    <div key={s.id} className="dup-song-row">
                      {j === 0 && <span className="dup-best-badge">{t.bestQuality}</span>}
                      <CoverArt songPath={s.path} hasCover={!!s.has_cover} size={36} className="dup-song-cover" />
                      <div className="dup-song-info">
                        <span className="dup-song-name">{s.title}</span>
                        <span className="dup-song-path">{s.path}</span>
                      </div>
                      <span className="dup-song-bitrate">{s.bitrate ? `${s.bitrate} kbps` : '—'}</span>
                      <span className="dup-song-size">{formatSize(s.file_size)}</span>
                      <button
                        className="dup-play-btn"
                        onClick={() => usePlayerStore.getState().playSong(s)}
                      >
                        <Play size={14} fill="currentColor" />
                      </button>
                      <button
                        className="dup-delete-btn"
                        onClick={() => setDeletePrompt({ song: s, groupIndex: i })}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deletePrompt && (
        <div className="dup-delete-overlay" onClick={() => !deleting && setDeletePrompt(null)}>
          <div className="dup-delete-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Song</h3>
            <div className="dup-delete-song-info">
              <p className="dup-delete-song-title">{deletePrompt.song.title}</p>
              <p className="dup-delete-song-path">{deletePrompt.song.path}</p>
            </div>
            <p className="dup-delete-question">Where do you want to delete this song from?</p>
            <div className="dup-delete-actions">
              <button
                className="dup-delete-action-btn dup-delete-lib"
                onClick={() => handleDelete(false)}
                disabled={deleting}
              >
                <Trash2 size={14} />
                From Library Only
              </button>
              <button
                className="dup-delete-action-btn dup-delete-disk"
                onClick={() => handleDelete(true)}
                disabled={deleting}
              >
                <Trash2 size={14} />
                From Library + Disk
              </button>
              <button
                className="dup-delete-action-btn dup-delete-cancel"
                onClick={() => setDeletePrompt(null)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
