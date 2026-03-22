import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { Song, Artist } from '../../types'
import { CoverArt } from '../shared/CoverArt'
import { formatDuration } from '../../utils/format'
import { Play, Heart, Music, Users } from 'lucide-react'
import { showSongContextMenu } from '../shared/SongContextMenu'

const ROW_HEIGHT = 62

export function FavoritesView(): JSX.Element {
  const [tab, setTab] = useState<'songs' | 'artists'>('songs')

  return (
    <div className="songs-view">
      <div className="fav-header">
        <h2 className="section-title">Favorites</h2>
        <div className="fav-tabs">
          <button
            className={`fav-tab${tab === 'songs' ? ' active' : ''}`}
            onClick={() => setTab('songs')}
          >
            <Music size={14} />
            Songs
          </button>
          <button
            className={`fav-tab${tab === 'artists' ? ' active' : ''}`}
            onClick={() => setTab('artists')}
          >
            <Users size={14} />
            Artists
          </button>
        </div>
      </div>

      {tab === 'songs' ? <FavSongsTab /> : <FavArtistsTab />}
    </div>
  )
}

// ─── Songs tab (virtualized) ──────────────────────────────────────────────────

function FavSongsTab(): JSX.Element {
  const { favorites, totalFavorites, loadFavorites, toggleFavorite } = useLibraryStore()
  const { playSong, currentSong, isPlaying } = usePlayerStore()
  const parentRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadFavorites() }, [])

  const virtualizer = useVirtualizer({
    count: favorites.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10
  })

  const loadMore = useCallback(async () => {
    if (favorites.length >= totalFavorites) return
    await loadFavorites(100, favorites.length)
  }, [favorites.length, totalFavorites])

  useEffect(() => {
    const items = virtualizer.getVirtualItems()
    if (!items.length) return
    const last = items[items.length - 1]
    if (last.index >= favorites.length - 10) loadMore()
  }, [virtualizer.getVirtualItems()])

  if (!favorites.length) {
    return (
      <div className="empty-view" style={{ marginTop: 40 }}>
        <Heart size={48} className="empty-icon" />
        <p>No favorite songs yet</p>
        <p className="sub">Click the heart icon next to a song to add it</p>
      </div>
    )
  }

  return (
    <>
      <div className="song-list-header">
        <span className="slh-num">#</span>
        <span className="slh-title" style={{ gridColumn: 'span 2' }}>Title</span>
        <span className="slh-artist">Artist</span>
        <span className="slh-album">Album</span>
        <span className="slh-plays">Plays</span>
        <span></span>
        <span className="slh-dur">Süre</span>
      </div>

      <div ref={parentRef} className="song-list-scroll">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const song = favorites[vRow.index]
            if (!song) return null
            const isCurrent = currentSong?.id === song.id
            return (
              <div
                key={song.id}
                style={{ position: 'absolute', top: vRow.start, width: '100%', height: ROW_HEIGHT }}
              >
                <FavSongRow
                  song={song}
                  index={vRow.index + 1}
                  isCurrent={isCurrent}
                  isPlaying={isCurrent && isPlaying}
                  onClick={() => playSong(song, favorites, vRow.index)}
                  onToggleFavorite={(id) => toggleFavorite(id)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── Artists tab ──────────────────────────────────────────────────────────────

function FavArtistsTab(): JSX.Element {
  const { favoriteArtists, loadFavoriteArtists, toggleFavoriteArtist, setArtistDetail } = useLibraryStore()

  useEffect(() => { loadFavoriteArtists() }, [])

  if (!favoriteArtists.length) {
    return (
      <div className="empty-view" style={{ marginTop: 40 }}>
        <Users size={48} className="empty-icon" />
        <p>No favorite artists yet</p>
        <p className="sub">Click the heart icon on an artist page to add them</p>
      </div>
    )
  }

  return (
    <div className="fav-artists-grid">
      {favoriteArtists.map((artist) => (
        <FavArtistCard
          key={artist.name}
          artist={artist}
          onOpen={() => setArtistDetail(artist.name)}
          onRemove={() => toggleFavoriteArtist(artist.name)}
        />
      ))}
    </div>
  )
}

const FavArtistCard = memo(function FavArtistCard({
  artist, onOpen, onRemove
}: {
  artist: Artist
  onOpen: () => void
  onRemove: () => void
}): JSX.Element {
  return (
    <div className="fav-artist-card" onClick={onOpen}>
      <div className="fav-artist-cover">
        {artist.cover_path
          ? <CoverArt songPath={artist.cover_path} hasCover className="fav-artist-cover-img" size={80} />
          : <div className="fav-artist-cover-placeholder">{artist.name.slice(0, 2).toUpperCase()}</div>
        }
      </div>
      <div className="fav-artist-info">
        <p className="fav-artist-name">{artist.name}</p>
        <p className="fav-artist-meta">{artist.song_count} songs</p>
      </div>
      <button
        className="fav-artist-remove"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        title="Remove from Favorites"
      >
        <Heart size={14} fill="currentColor" />
      </button>
    </div>
  )
})

// ─── Song row ─────────────────────────────────────────────────────────────────

const FavSongRow = memo(function FavSongRow({
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
      </div>
      <p className="slr-artist">{song.artist}</p>
      <p className="slr-album">{song.album}</p>
      <span className="slr-plays">{song.play_count > 0 ? song.play_count : '—'}</span>
      <button
        className="heart-btn slr-heart favorited"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(song.id) }}
        title="Remove from Favorites"
      >
        <Heart size={13} fill="currentColor" />
      </button>
      <span className="slr-dur">{formatDuration(song.duration)}</span>
    </div>
  )
})
