import { useEffect } from 'react'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { CoverArt } from '../shared/CoverArt'
import { Disc } from 'lucide-react'

export function AlbumsView(): JSX.Element {
  const { albums, loadAlbums } = useLibraryStore()
  const { playSong } = usePlayerStore()

  useEffect(() => {
    if (!albums.length) loadAlbums()
  }, [])

  const playAlbum = async (albumName: string) => {
    const songs = await window.api.getSongs({ limit: 200, search: albumName })
    const albumSongs = songs.filter(s => s.album === albumName)
    const toPlay = albumSongs.length ? albumSongs : songs
    if (toPlay.length) playSong(toPlay[0], toPlay, 0)
  }

  if (!albums.length) {
    return (
      <div className="empty-view">
        <Disc size={48} className="empty-icon" />
        <p>No albums yet</p>
        <p className="sub">Add a music folder to get started</p>
      </div>
    )
  }

  return (
    <div className="albums-view">
      <div className="section-header">
        <h2 className="section-title">Albums</h2>
        <span className="count-badge">{albums.length} albums</span>
      </div>
      <div className="album-grid">
        {albums.map((album) => (
          <div key={`${album.name}-${album.artist}`} className="album-card" onClick={() => playAlbum(album.name)}>
            <div className="album-cover">
              {album.cover_path
                ? <CoverArt
                    songPath={album.cover_path}
                    hasCover={true}
                    className="album-cover-img"
                    asBackground={true}
                  />
                : <Disc size={32} className="album-placeholder-icon" />
              }
              {album.format && (
                <span className={`album-cover-format-badge ${album.format === 'FLAC' ? 'badge-flac' : 'badge-lossy'}`}>
                  {album.format}
                </span>
              )}
            </div>
            <div className="album-info">
              <p className="album-name">{album.name}</p>
              <p className="album-artist">{album.artist}</p>
              <p className="album-meta">{album.song_count} songs{album.year ? ` · ${album.year}` : ''}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
