import { useState, useEffect, memo } from 'react'
import { Playlist } from '../../types'
import { ListPlus, Plus, Check } from 'lucide-react'

interface Props {
  songId: number
  size?: number
}

export const AddToPlaylistBtn = memo(function AddToPlaylistBtn({ songId, size = 13 }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [added, setAdded] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      window.api.getPlaylists().then(setPlaylists)
    }
  }, [open])

  const handleAdd = async (playlistId: number) => {
    await window.api.addSongToPlaylist(playlistId, songId)
    setAdded(playlistId)
    setTimeout(() => { setOpen(false); setAdded(null) }, 600)
  }

  const handleCreate = async () => {
    const name = prompt('New playlist name:')
    if (!name?.trim()) return
    const id = await window.api.createPlaylist(name.trim())
    await window.api.addSongToPlaylist(id, songId)
    setAdded(id)
    setTimeout(() => { setOpen(false); setAdded(null) }, 600)
  }

  return (
    <div className="atp-wrap" onClick={(e) => e.stopPropagation()}>
      <button
        className="atp-btn"
        onClick={() => setOpen(!open)}
        title="Add to playlist"
      >
        <ListPlus size={size} />
      </button>
      {open && (
        <>
          <div className="atp-backdrop" onClick={() => setOpen(false)} />
          <div className="atp-popup">
            <p className="atp-popup-title">Add to Playlist</p>
            {playlists.length === 0 && (
              <p className="atp-popup-empty">No playlists yet</p>
            )}
            {playlists.map((p) => (
              <button
                key={p.id}
                className={`atp-popup-item${added === p.id ? ' added' : ''}`}
                onClick={() => handleAdd(p.id)}
              >
                <span>{p.name}</span>
                {added === p.id ? <Check size={12} /> : <Plus size={12} />}
              </button>
            ))}
            <button className="atp-popup-create" onClick={handleCreate}>
              <Plus size={12} /> New Playlist
            </button>
          </div>
        </>
      )}
    </div>
  )
})
