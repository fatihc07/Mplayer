import { useState, useEffect, useCallback, memo } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { Song, Playlist } from '../../types'
import { CoverArt } from '../shared/CoverArt'
import { formatDuration } from '../../utils/format'
import {
  Plus, Play, ArrowLeft, Trash2, Clock, TrendingUp, Calendar,
  Music, Timer, Zap, ListMusic, MoreVertical, X, Heart, Pencil,
  Shuffle, Gem, Disc, User, Download, Upload, Image
} from 'lucide-react'
import { showSongContextMenu } from '../shared/SongContextMenu'
import { useI18n } from '../../i18n'

// ─── Smart Playlist Definitions ───────────────────────────────────────────────

interface SmartPlaylistDef {
  id: string
  name: string
  description: string
  icon: React.FC<any>
  gradient: string
}

const SMART_PLAYLISTS: SmartPlaylistDef[] = [
  { id: 'recent-50',          name: 'Son Dinlenen 50',          description: 'En son dinlediğin 50 şarkı',            icon: Clock,      gradient: 'linear-gradient(135deg,#6366F1,#8B5CF6)' },
  { id: 'not-played-3months', name: '3 Aydır Çalınmayan',      description: '3 aydır dinlemediğin şarkılar',          icon: Timer,      gradient: 'linear-gradient(135deg,#F43F5E,#E11D48)' },
  { id: 'most-played',        name: 'En Çok Dinlenen 50',      description: 'En yüksek play count\'lu şarkılar',      icon: TrendingUp, gradient: 'linear-gradient(135deg,#F59E0B,#D97706)' },
  { id: 'recently-added',     name: 'Yeni Eklenenler',          description: 'Kütüphaneye son eklenen 50 şarkı',       icon: Calendar,   gradient: 'linear-gradient(135deg,#10B981,#059669)' },
  { id: 'shortest',           name: 'En Kısa',                  description: 'En kısa 50 şarkı',                       icon: Zap,        gradient: 'linear-gradient(135deg,#0EA5E9,#0284C7)' },
  { id: 'longest',            name: 'En Uzun',                  description: 'En uzun 50 şarkı',                       icon: Music,      gradient: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' },
  { id: 'random-mix',         name: 'Rastgele Mix',             description: 'Rastgele seçilmiş 50 şarkı',             icon: Shuffle,    gradient: 'linear-gradient(135deg,#EC4899,#DB2777)' },
  { id: 'high-quality',       name: 'Kayıpsız Kalite',          description: 'FLAC, WAV ve lossless formatlar',        icon: Disc,       gradient: 'linear-gradient(135deg,#14B8A6,#0D9488)' },
  { id: 'forgotten-gems',     name: 'Unutulan Hazineler',       description: '30+ gündür az dinlenen şarkılar',        icon: Gem,        gradient: 'linear-gradient(135deg,#A855F7,#9333EA)' },
  { id: 'one-hit-wonders',    name: 'Tek Şarkılık Sanatçılar', description: 'Kütüphanende 1 şarkısı olan sanatçılar', icon: User,       gradient: 'linear-gradient(135deg,#F97316,#EA580C)' }
]

// ─── Main View ────────────────────────────────────────────────────────────────

export function PlaylistsView(): JSX.Element {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [activePlaylist, setActivePlaylist] = useState<number | null>(null)
  const [activeSmartId, setActiveSmartId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Playlist | null>(null)
  const { t } = useI18n()

  const loadPlaylists = useCallback(async () => {
    const p = await window.api.getPlaylists()
    setPlaylists(p)
  }, [])

  useEffect(() => { loadPlaylists() }, [loadPlaylists])

  // Show detail view
  if (activePlaylist !== null) {
    return (
      <PlaylistDetail
        playlistId={activePlaylist}
        onBack={() => { setActivePlaylist(null); loadPlaylists() }}
      />
    )
  }

  if (activeSmartId !== null) {
    const def = SMART_PLAYLISTS.find((s) => s.id === activeSmartId)!
    return (
      <SmartPlaylistDetail
        smartDef={def}
        onBack={() => setActiveSmartId(null)}
      />
    )
  }

  return (
    <div className="pl-view">
      <div className="pl-header">
        <h1 className="pl-title">Playlists</h1>
        <div className="pl-header-actions">
          <button className="pl-import-btn" onClick={async () => {
            const result = await window.api.importPlaylist()
            if (!result) return
            const id = await window.api.createPlaylist(result.name)
            // Find songs in library by path and add them
            for (const path of result.paths) {
              const allSongs = await window.api.getSongs({ limit: 99999, offset: 0 })
              const match = allSongs.find((s: Song) => s.path === path)
              if (match) await window.api.addSongToPlaylist(id, match.id)
            }
            loadPlaylists()
          }}>
            <Upload size={14} />
            {t.importPlaylist}
          </button>
          <button className="pl-create-btn" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            New Playlist
          </button>
        </div>
      </div>

      {/* Smart Playlists */}
      <section className="pl-section">
        <h2 className="pl-section-title">Smart Playlists</h2>
        <div className="pl-smart-grid">
          {SMART_PLAYLISTS.map((sp) => (
            <SmartPlaylistCard key={sp.id} def={sp} onClick={() => setActiveSmartId(sp.id)} />
          ))}
        </div>
      </section>

      {/* User Playlists */}
      <section className="pl-section">
        <h2 className="pl-section-title">My Playlists</h2>
        {playlists.length === 0 ? (
          <div className="pl-empty">
            <ListMusic size={40} />
            <p>No playlists yet</p>
            <button className="pl-empty-btn" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Create Playlist
            </button>
          </div>
        ) : (
          <div className="pl-user-grid">
            {playlists.map((p) => (
              <UserPlaylistCard
                key={p.id}
                playlist={p}
                onClick={() => setActivePlaylist(p.id)}
                onEdit={() => setEditTarget(p)}
                onDelete={async () => {
                  await window.api.deletePlaylist(p.id)
                  loadPlaylists()
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Create Dialog */}
      {showCreate && (
        <PlaylistDialog
          onClose={() => setShowCreate(false)}
          onSave={async (name, desc) => {
            await window.api.createPlaylist(name, desc)
            loadPlaylists()
          }}
        />
      )}

      {/* Edit Dialog */}
      {editTarget && (
        <PlaylistDialog
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={async (name, desc) => {
            await window.api.updatePlaylist(editTarget.id, name, desc)
            loadPlaylists()
          }}
        />
      )}
    </div>
  )
}

// ─── Smart Playlist Card ──────────────────────────────────────────────────────

const SmartPlaylistCard = memo(function SmartPlaylistCard({
  def, onClick
}: {
  def: SmartPlaylistDef; onClick: () => void
}): JSX.Element {
  const Icon = def.icon
  return (
    <div className="pl-smart-card" style={{ background: def.gradient }} onClick={onClick}>
      <Icon size={24} className="pl-smart-icon" />
      <div>
        <p className="pl-smart-name">{def.name}</p>
        <p className="pl-smart-desc">{def.description}</p>
      </div>
    </div>
  )
})

// ─── User Playlist Card ──────────────────────────────────────────────────────

const UserPlaylistCard = memo(function UserPlaylistCard({
  playlist, onClick, onEdit, onDelete
}: {
  playlist: Playlist; onClick: () => void; onEdit: () => void; onDelete: () => void
}): JSX.Element {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="pl-user-card" onClick={onClick}>
      <div className="pl-user-card-cover">
        {playlist.cover_path ? (
          <CoverArt songPath={playlist.cover_path} hasCover className="pl-user-card-img" asBackground />
        ) : (
          <ListMusic size={28} className="pl-user-card-placeholder" />
        )}
      </div>
      <div className="pl-user-card-info">
        <p className="pl-user-card-name">{playlist.name}</p>
        <p className="pl-user-card-meta">{playlist.song_count} songs</p>
      </div>
      <div className="pl-user-card-menu-wrap" onClick={(e) => e.stopPropagation()}>
        <button className="pl-user-card-menu-btn" onClick={() => setShowMenu(!showMenu)}>
          <MoreVertical size={14} />
        </button>
        {showMenu && (
          <div className="pl-user-card-menu" onMouseLeave={() => setShowMenu(false)}>
            <button onClick={() => { setShowMenu(false); onEdit() }}>
              <Pencil size={12} /> Edit
            </button>
            <button className="danger" onClick={() => { setShowMenu(false); onDelete() }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

// ─── Create/Edit Dialog ───────────────────────────────────────────────────────

function PlaylistDialog({
  initial, onClose, onSave
}: {
  initial?: Playlist
  onClose: () => void
  onSave: (name: string, description: string) => Promise<void>
}): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    await onSave(trimmed, desc.trim())
    onClose()
  }

  return (
    <div className="pl-dialog-overlay" onClick={onClose}>
      <div className="pl-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="pl-dialog-header">
          <h3>{initial ? 'Edit Playlist' : 'New Playlist'}</h3>
          <button className="pl-dialog-close" onClick={onClose}><X size={16} /></button>
        </div>
        <input
          className="pl-dialog-input"
          placeholder="Playlist name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <textarea
          className="pl-dialog-textarea"
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
        />
        <div className="pl-dialog-actions">
          <button className="pl-dialog-cancel" onClick={onClose}>Cancel</button>
          <button className="pl-dialog-save" onClick={handleSave} disabled={!name.trim()}>
            {initial ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Playlist Detail ──────────────────────────────────────────────────────────

function PlaylistDetail({
  playlistId, onBack
}: {
  playlistId: number; onBack: () => void
}): JSX.Element {
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const { playSong, currentSong, isPlaying } = usePlayerStore()
  const { toggleFavorite } = useLibraryStore()

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      window.api.getPlaylist(playlistId),
      window.api.getPlaylistSongs(playlistId)
    ])
    setPlaylist(p)
    setSongs(s)
  }, [playlistId])

  useEffect(() => { load() }, [load])

  const handleRemove = async (songId: number) => {
    await window.api.removeSongFromPlaylist(playlistId, songId)
    setSongs((prev) => prev.filter((s) => s.id !== songId))
    setPlaylist((p) => p ? { ...p, song_count: p.song_count - 1 } : p)
  }

  const playAll = () => {
    if (songs.length) playSong(songs[0], songs, 0)
  }

  if (!playlist) return <div className="pl-view" />

  const totalDur = songs.reduce((s, x) => s + x.duration, 0)

  return (
    <div className="pl-detail">
      <div className="pl-detail-hero">
        <button className="pl-detail-back" onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <div className="pl-detail-cover">
          {playlist.cover_path ? (
            <CoverArt songPath={playlist.cover_path} hasCover className="pl-detail-cover-img" asBackground />
          ) : (
            <ListMusic size={40} />
          )}
        </div>
        <div className="pl-detail-info">
          <p className="pl-detail-label">PLAYLIST</p>
          <h2 className="pl-detail-name">{playlist.name}</h2>
          {playlist.description && <p className="pl-detail-desc">{playlist.description}</p>}
          <p className="pl-detail-meta">
            {playlist.song_count} songs · {formatDuration(totalDur)}
          </p>
          <button className="pl-detail-play" onClick={playAll} disabled={!songs.length}>
            <Play size={15} fill="currentColor" /> Play All
          </button>
          <div className="pl-detail-extra-actions">
            <button className="pl-detail-action-btn" onClick={async () => {
              if (songs.length > 0) {
                const firstCover = songs[0]
                const cover = await window.api.getCover(firstCover.path)
                if (cover) {
                  await window.api.setPlaylistCover(playlistId, firstCover.path)
                  load()
                }
              }
            }} title="Set cover">
              <Image size={14} />
            </button>
            <button className="pl-detail-action-btn" onClick={() => window.api.exportPlaylist(playlistId, 'json')} title="JSON olarak dışa aktar">
              <Download size={14} /> JSON
            </button>
            <button className="pl-detail-action-btn" onClick={() => window.api.exportPlaylist(playlistId, 'm3u')} title="M3U olarak dışa aktar">
              <Download size={14} /> M3U
            </button>
          </div>
        </div>
      </div>

      {songs.length === 0 ? (
        <div className="pl-empty" style={{ marginTop: 32 }}>
          <Music size={36} />
          <p>This playlist is empty</p>
          <p className="pl-empty-hint">Use the + button on songs to add them</p>
        </div>
      ) : (
        <div className="pl-detail-songs">
          {songs.map((song, i) => {
            const isCurrent = currentSong?.id === song.id
            return (
              <div
                key={song.id}
                className={`pl-song-row${isCurrent ? ' active' : ''}`}
                onClick={() => playSong(song, songs, i)}
                onContextMenu={(e) => { e.preventDefault(); showSongContextMenu(song, e.clientX, e.clientY) }}
              >
                <span className="pl-song-num">
                  {isCurrent && isPlaying
                    ? <span className="playing-bars"><span /><span /><span /></span>
                    : isCurrent ? <Play size={12} fill="currentColor" /> : i + 1
                  }
                </span>
                <CoverArt songPath={song.path} hasCover={!!song.has_cover} className="pl-song-cover" size={40} />
                <div className="pl-song-info">
                  <p className="pl-song-title">{song.title}</p>
                  <p className="pl-song-artist">{song.artist}</p>
                </div>
                <span className="pl-song-dur">{formatDuration(song.duration)}</span>
                <button
                  className={`heart-btn pl-song-heart${song.is_favorite ? ' favorited' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(song.id) }}
                >
                  <Heart size={13} fill={song.is_favorite ? 'currentColor' : 'none'} />
                </button>
                <button
                  className="pl-song-remove"
                  onClick={(e) => { e.stopPropagation(); handleRemove(song.id) }}
                  title="Remove from playlist"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Smart Playlist Detail ────────────────────────────────────────────────────

function SmartPlaylistDetail({
  smartDef, onBack
}: {
  smartDef: SmartPlaylistDef; onBack: () => void
}): JSX.Element {
  const [songs, setSongs] = useState<Song[]>([])
  const { playSong, currentSong, isPlaying } = usePlayerStore()
  const { toggleFavorite } = useLibraryStore()

  useEffect(() => {
    window.api.getSmartPlaylistSongs(smartDef.id).then(setSongs)
  }, [smartDef.id])

  const Icon = smartDef.icon

  return (
    <div className="pl-detail">
      <div className="pl-detail-hero">
        <button className="pl-detail-back" onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <div className="pl-detail-cover pl-detail-cover-smart" style={{ background: smartDef.gradient }}>
          <Icon size={36} />
        </div>
        <div className="pl-detail-info">
          <p className="pl-detail-label">SMART PLAYLIST</p>
          <h2 className="pl-detail-name">{smartDef.name}</h2>
          <p className="pl-detail-desc">{smartDef.description}</p>
          <p className="pl-detail-meta">{songs.length} songs</p>
          <button
            className="pl-detail-play"
            onClick={() => songs.length && playSong(songs[0], songs, 0)}
            disabled={!songs.length}
          >
            <Play size={15} fill="currentColor" /> Play All
          </button>
        </div>
      </div>

      {songs.length === 0 ? (
        <div className="pl-empty" style={{ marginTop: 32 }}>
          <Music size={36} />
          <p>No suitable songs found for this playlist</p>
        </div>
      ) : (
        <div className="pl-detail-songs">
          {songs.map((song, i) => {
            const isCurrent = currentSong?.id === song.id
            return (
              <div
                key={song.id}
                className={`pl-song-row${isCurrent ? ' active' : ''}`}
                onClick={() => playSong(song, songs, i)}
                onContextMenu={(e) => { e.preventDefault(); showSongContextMenu(song, e.clientX, e.clientY) }}
              >
                <span className="pl-song-num">
                  {isCurrent && isPlaying
                    ? <span className="playing-bars"><span /><span /><span /></span>
                    : isCurrent ? <Play size={12} fill="currentColor" /> : i + 1
                  }
                </span>
                <CoverArt songPath={song.path} hasCover={!!song.has_cover} className="pl-song-cover" size={40} />
                <div className="pl-song-info">
                  <p className="pl-song-title">{song.title}</p>
                  <p className="pl-song-artist">{song.artist}</p>
                </div>
                <span className="pl-song-dur">{formatDuration(song.duration)}</span>
                <button
                  className={`heart-btn pl-song-heart${song.is_favorite ? ' favorited' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(song.id) }}
                >
                  <Heart size={13} fill={song.is_favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
