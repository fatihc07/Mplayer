import { useState, useCallback } from 'react'
import { X, Save, Search, Upload, Loader } from 'lucide-react'
import { Song } from '../../types'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { CoverArt } from './CoverArt'

interface CoverResult {
  id: string
  title: string
  artist: string
  coverUrl: string
}

export function TagEditor({ song, onClose }: { song: Song; onClose: () => void }): JSX.Element {
  const [title, setTitle] = useState(song.title)
  const [artist, setArtist] = useState(song.artist)
  const [album, setAlbum] = useState(song.album)
  const [year, setYear] = useState(song.year?.toString() ?? '')
  const [genre, setGenre] = useState(song.genre ?? '')
  const [trackNum, setTrackNum] = useState(song.track_number?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  // Cover art state
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [pendingCover, setPendingCover] = useState<{ base64: string; mimeType: string } | null>(null)
  const [coverTab, setCoverTab] = useState<'none' | 'search'>('none')
  const [coverQuery, setCoverQuery] = useState(`${song.artist} ${song.album}`.trim())
  const [coverResults, setCoverResults] = useState<CoverResult[]>([])
  const [coverSearching, setCoverSearching] = useState(false)
  const [coverDownloading, setCoverDownloading] = useState<string | null>(null)

  const { loadSongs, loadArtists, loadAlbums } = useLibraryStore()
  const { currentSong } = usePlayerStore()

  const handlePickFile = async (): Promise<void> => {
    const result = await window.api.pickCoverFile()
    if (result) {
      setPendingCover(result)
      setCoverPreview(`data:${result.mimeType};base64,${result.base64}`)
    }
  }

  const handleSearchCovers = useCallback(async () => {
    if (!coverQuery.trim()) return
    setCoverSearching(true)
    try {
      const results = await window.api.searchCovers(coverQuery.trim())
      setCoverResults(results)
    } finally {
      setCoverSearching(false)
    }
  }, [coverQuery])

  const handleSelectCover = async (result: CoverResult): Promise<void> => {
    setCoverDownloading(result.id)
    try {
      const fullUrl = result.coverUrl.replace('-250', '')
      const data = await window.api.downloadCover(fullUrl)
      if (data) {
        setPendingCover(data)
        setCoverPreview(`data:${data.mimeType};base64,${data.base64}`)
        setCoverTab('none')
      }
    } finally {
      setCoverDownloading(null)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await window.api.updateSong(song.id, {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
        year: year ? parseInt(year, 10) : null,
        genre: genre.trim() || null,
        track_number: trackNum ? parseInt(trackNum, 10) : null
      })

      // Save cover art if changed
      if (pendingCover) {
        await window.api.setCover(song.id, pendingCover.base64, pendingCover.mimeType)
      }

      // Refresh library data
      await Promise.all([loadSongs(), loadArtists(), loadAlbums()])
      // Update current song if it's the one being edited
      if (currentSong?.id === song.id) {
        usePlayerStore.setState({
          currentSong: {
            ...currentSong,
            title: title.trim(),
            artist: artist.trim(),
            album: album.trim(),
            year: year ? parseInt(year, 10) : null,
            genre: genre.trim() || null,
            track_number: trackNum ? parseInt(trackNum, 10) : null,
            has_cover: pendingCover ? 1 : currentSong.has_cover
          }
        })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tag-overlay">
      <div className="tag-editor" onClick={(e) => e.stopPropagation()}>
        <div className="tag-header">
          <h3>Edit Song Info</h3>
          <button className="tag-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Cover art section */}
        <div className="tag-cover-section">
          <div className="tag-cover-preview">
            {coverPreview ? (
              <img src={coverPreview} alt="cover" className="tag-cover-img" />
            ) : (
              <CoverArt songPath={song.path} hasCover={!!song.has_cover} size={120} className="tag-cover-img" />
            )}
          </div>
          <div className="tag-cover-actions">
            <button className="tag-cover-btn" onClick={handlePickFile}>
              <Upload size={14} /> Select from File
            </button>
            <button className="tag-cover-btn" onClick={() => setCoverTab(coverTab === 'search' ? 'none' : 'search')}>
              <Search size={14} /> Online Ara
            </button>
            {pendingCover && (
              <span className="tag-cover-changed">✓ New cover selected</span>
            )}
          </div>
        </div>

        {/* Cover search panel */}
        {coverTab === 'search' && (
          <div className="tag-cover-search">
            <div className="tag-cover-search-bar">
              <input
                value={coverQuery}
                onChange={(e) => setCoverQuery(e.target.value)}
                placeholder="Search artist or album..."
                onKeyDown={(e) => e.key === 'Enter' && handleSearchCovers()}
              />
              <button onClick={handleSearchCovers} disabled={coverSearching}>
                {coverSearching ? <Loader size={14} className="tag-spinner" /> : <Search size={14} />}
              </button>
            </div>
            <div className="tag-cover-results">
              {coverResults.map((r) => (
                <div
                  key={r.id}
                  className="tag-cover-result"
                  onClick={() => handleSelectCover(r)}
                >
                  <img
                    src={r.coverUrl}
                    alt={r.title}
                    className="tag-cover-thumb"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <div className="tag-cover-result-info">
                    <span className="tag-cover-result-title">{r.title}</span>
                    <span className="tag-cover-result-artist">{r.artist}</span>
                  </div>
                  {coverDownloading === r.id && <Loader size={14} className="tag-spinner" />}
                </div>
              ))}
              {!coverSearching && coverResults.length === 0 && (
                <p className="tag-cover-empty">Search or no results found</p>
              )}
            </div>
          </div>
        )}

        <div className="tag-fields">
          <label className="tag-field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>
          <label className="tag-field">
            <span>Artist</span>
            <input value={artist} onChange={(e) => setArtist(e.target.value)} />
          </label>
          <label className="tag-field">
            <span>Album</span>
            <input value={album} onChange={(e) => setAlbum(e.target.value)} />
          </label>
          <div className="tag-row">
            <label className="tag-field">
              <span>Year</span>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="—" />
            </label>
            <label className="tag-field">
              <span>Genre</span>
              <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="—" />
            </label>
            <label className="tag-field">
              <span>Track #</span>
              <input type="number" value={trackNum} onChange={(e) => setTrackNum(e.target.value)} placeholder="—" />
            </label>
          </div>
        </div>

        <p className="tag-hint">Changes are saved to both the database and the file.</p>

        <div className="tag-actions">
          <button className="tag-cancel" onClick={onClose}>Cancel</button>
          <button className="tag-save" onClick={handleSave} disabled={saving || !title.trim()}>
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
