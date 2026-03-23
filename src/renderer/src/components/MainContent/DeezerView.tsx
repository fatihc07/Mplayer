import { useState, useEffect } from 'react'
import { Search, Loader, Globe, ChevronRight } from 'lucide-react'
import { useDeezerStore } from '../../stores/deezerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { formatDuration } from '../../utils/format'
import '../../styles/deezer.css'

export function DeezerView(): JSX.Element {
  const { tracks, albums, artists, playlists, isSearching, searchAll, loadInitialData, playDeezerTrack } = useDeezerStore()
  const { deezerArl } = useSettingsStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!tracks.length && !isSearching) {
      loadInitialData()
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchAll(query)
  }

  return (
    <div className="dz-dash">
      <form className="dz-search-bar" onSubmit={handleSearch}>
        <div className="dz-search-prefix">
          <Globe size={20} color="#F43F5E" />
          {!deezerArl && <span className="dz-badge">Preview Mode</span>}
        </div>
        <input
          className="dz-search-input"
          placeholder="Search what you feel today..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {isSearching && <Loader size={20} className="spin" color="#F43F5E" />}
      </form>

      {isSearching && !tracks.length && (
        <div className="dz-loading">
          <Loader size={48} className="spin" color="#F43F5E" />
          <p>Tuning into Deezer...</p>
        </div>
      )}

      {tracks.length > 0 && (
        <div className="dz-grid-layout">
          <div className="dz-main-col">
            {/* ── Albums Section ──────────────────────────────────────── */}
            {albums.length > 0 && (
              <section className="dz-section">
                <div className="dz-section-header">
                  <h2 className="dz-section-title">Trending Albums</h2>
                  <ChevronRight size={18} color="#999" />
                </div>
                <div className="dz-albums-row">
                  {albums.map((album) => (
                    <div key={album.id} className="dz-album-card">
                      <img src={album.cover_medium} className="dz-album-cover" alt="" />
                      <span className="dz-album-name">{album.title}</span>
                      <span className="dz-album-artist">{album.artist.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Playlists Section ───────────────────────────────────── */}
            {playlists.length > 0 && (
              <section className="dz-section">
                <div className="dz-section-header">
                  <h2 className="dz-section-title">Top Playlists</h2>
                  <ChevronRight size={18} color="#999" />
                </div>
                <div className="dz-playlists-grid">
                  {playlists.map((pl) => (
                    <div key={pl.id} className="dz-pl-card">
                      <img src={pl.picture_medium} className="dz-pl-img" alt="" />
                      <div className="dz-pl-info">
                        <span className="dz-pl-name">{pl.title}</span>
                        <span className="dz-pl-meta">{pl.nb_tracks} tracks</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Artists Section ──────────────────────────────────────── */}
            {artists.length > 0 && (
              <section className="dz-section">
                <div className="dz-section-header">
                  <h2 className="dz-section-title">Recommended Artists</h2>
                  <ChevronRight size={18} color="#999" />
                </div>
                <div className="dz-artists-row">
                  {artists.map((artist) => (
                    <div key={artist.id} className="dz-artist-item">
                      <img src={artist.picture_medium} className="dz-artist-pic" alt="" />
                      <span className="dz-artist-name">{artist.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>


          {/* ── Tracks Side Column ──────────────────────────────────────── */}
          <div className="dz-tracks-col">
            <h2 className="dz-section-title" style={{ marginBottom: 20 }}>Tracks</h2>
            <div className="dz-tracks-list">
              {tracks.map((track) => (
                <div key={track.id} className="dz-track-row" onClick={() => playDeezerTrack(track)}>
                  <img src={track.album.cover_medium} className="dz-track-art" alt="" />
                  <div className="dz-track-info">
                    <span className="dz-track-name">{track.title}</span>
                    <span className="dz-track-artist">{track.artist.name}</span>
                  </div>
                  <span className="dz-track-dur">{formatDuration(track.duration)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


