import { useState, useEffect, useCallback, useRef } from 'react'
import { ListPlus, Plus, Check, Play, ListEnd, ChevronRight } from 'lucide-react'
import { usePlayerStore } from '../../stores/playerStore'
import { Song, Playlist } from '../../types'

interface ContextMenuState {
  song: Song
  x: number
  y: number
}

let _showMenu: ((state: ContextMenuState) => void) | null = null

/** Call this from any component to show the context menu for a song */
export function showSongContextMenu(song: Song, x: number, y: number): void {
  _showMenu?.({ song, x, y })
}

export function SongContextMenu(): JSX.Element | null {
  const [state, setState] = useState<ContextMenuState | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [showPlaylists, setShowPlaylists] = useState(false)
  const [addedId, setAddedId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)

  const { playNext, addToQueue } = usePlayerStore()

  // Register global trigger
  useEffect(() => {
    _showMenu = setState
    return () => { _showMenu = null }
  }, [])

  // Close on click outside or Escape
  useEffect(() => {
    if (!state) return
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setState(null)
      }
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setState(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [state])

  // Position adjustment
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (!state) return
    const mw = 200, mh = 180
    const vw = window.innerWidth, vh = window.innerHeight
    setPos({
      x: state.x + mw > vw ? vw - mw - 8 : state.x,
      y: state.y + mh > vh ? vh - mh - 8 : state.y
    })
    setShowPlaylists(false)
    setAddedId(null)
  }, [state])

  const close = useCallback(() => setState(null), [])

  const handlePlayNext = useCallback(() => {
    if (!state) return
    playNext(state.song)
    close()
  }, [state, playNext, close])

  const handleAddToQueue = useCallback(() => {
    if (!state) return
    addToQueue(state.song)
    close()
  }, [state, addToQueue, close])

  const handleShowPlaylists = useCallback(async () => {
    const p = await window.api.getPlaylists()
    setPlaylists(p)
    setShowPlaylists(true)
  }, [])

  const handleAddToPlaylist = useCallback(async (playlistId: number) => {
    if (!state) return
    await window.api.addSongToPlaylist(playlistId, state.song.id)
    setAddedId(playlistId)
    setTimeout(() => close(), 500)
  }, [state, close])

  const handleCreatePlaylist = useCallback(async () => {
    if (!state) return
    const name = prompt('New playlist name:')
    if (!name?.trim()) return
    const id = await window.api.createPlaylist(name.trim())
    await window.api.addSongToPlaylist(id, state.song.id)
    setAddedId(id)
    setTimeout(() => close(), 500)
  }, [state, close])

  if (!state) return null

  // Submenu direction
  const subLeft = pos.x + 200 + 180 > window.innerWidth

  return (
    <div className="scm-overlay">
      <div className="scm-menu" ref={menuRef} style={{ left: pos.x, top: pos.y }}>
        <button className="scm-item" onClick={handlePlayNext}>
          <Play size={14} />
          <span>Play Next</span>
        </button>
        <button className="scm-item" onClick={handleAddToQueue}>
          <ListEnd size={14} />
          <span>Add to Queue</span>
        </button>
        <div className="scm-divider" />
        <div
          className={`scm-item scm-has-sub${showPlaylists ? ' active' : ''}`}
          onMouseEnter={handleShowPlaylists}
        >
          <ListPlus size={14} />
          <span>Add to Playlist</span>
          <ChevronRight size={12} className="scm-chevron" />

          {showPlaylists && (
            <div
              className={`scm-submenu${subLeft ? ' scm-sub-left' : ''}`}
              ref={subRef}
            >
              {playlists.length === 0 && (
                <p className="scm-sub-empty">No playlists yet</p>
              )}
              {playlists.map((p) => (
                <button
                  key={p.id}
                  className={`scm-sub-item${addedId === p.id ? ' added' : ''}`}
                  onClick={() => handleAddToPlaylist(p.id)}
                >
                  <span>{p.name}</span>
                  {addedId === p.id ? <Check size={12} /> : <Plus size={12} />}
                </button>
              ))}
              <div className="scm-divider" />
              <button className="scm-sub-item scm-sub-create" onClick={handleCreatePlaylist}>
                <Plus size={12} /> New Playlist
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
