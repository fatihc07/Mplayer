import { useState, useCallback } from 'react'
import { Search, X, Loader2, Music, Clock, Check } from 'lucide-react'
import { formatDuration } from '../../utils/format'

interface SearchResult {
  id: number
  trackName: string
  artistName: string
  albumName: string
  duration: number
  hasSynced: boolean
  syncedLyrics: string | null
  plainLyrics: string | null
}

interface Props {
  songId: number
  initialQuery: string
  initialArtist: string
  onSelect: (lrc: string) => void
  onClose: () => void
}

export function LyricsSearchModal({ songId, initialQuery, initialArtist, onSelect, onClose }: Props): JSX.Element {
  const [query, setQuery] = useState(initialQuery)
  const [artistHint, setArtistHint] = useState(initialArtist)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [previewLrc, setPreviewLrc] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    setSelectedId(null)
    setPreviewLrc(null)
    try {
      const res = await window.api.searchLrclib(query.trim(), artistHint.trim() || undefined)
      setResults(res ?? [])
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [query, artistHint])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }, [handleSearch])

  const handlePreview = useCallback((r: SearchResult) => {
    setSelectedId(r.id)
    const lrc = r.syncedLyrics || r.plainLyrics || ''
    // Show first ~8 lines
    const lines = lrc.split('\n').slice(0, 8)
    setPreviewLrc(lines.join('\n') + (lrc.split('\n').length > 8 ? '\n...' : ''))
  }, [])

  const handleSelectAndSave = useCallback(async () => {
    const picked = results.find(r => r.id === selectedId)
    if (!picked) return
    const lrc = picked.syncedLyrics || picked.plainLyrics || ''
    if (!lrc) return
    await window.api.saveLyrics(songId, lrc, 'lrclib-manual')
    onSelect(lrc)
  }, [results, selectedId, songId, onSelect])

  return (
    <div className="lsm-overlay" onClick={onClose}>
      <div className="lsm-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="lsm-header">
          <h3 className="lsm-title">
            <Music size={18} /> Search LRCLIB Lyrics
          </h3>
          <button className="lsm-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Search inputs */}
        <div className="lsm-search-row">
          <div className="lsm-input-group">
            <input
              className="lsm-input"
              type="text"
              placeholder="Song title..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <input
              className="lsm-input"
              type="text"
              placeholder="Artist (optional)..."
              value={artistHint}
              onChange={e => setArtistHint(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button className="lsm-search-btn" onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? <Loader2 size={16} className="lyrics-spinner" /> : <Search size={16} />}
            Search
          </button>
        </div>

        {/* Results */}
        <div className="lsm-results">
          {loading && (
            <div className="lsm-status">
              <Loader2 size={22} className="lyrics-spinner" />
              <span>Searching...</span>
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="lsm-status">
              <span>No results found</span>
            </div>
          )}

          {!loading && results.map(r => (
            <div
              key={r.id}
              className={`lsm-result-item${selectedId === r.id ? ' selected' : ''}`}
              onClick={() => handlePreview(r)}
            >
              <div className="lsm-result-info">
                <span className="lsm-result-title">{r.trackName}</span>
                <span className="lsm-result-artist">{r.artistName}</span>
                {r.albumName && <span className="lsm-result-album">{r.albumName}</span>}
              </div>
              <div className="lsm-result-meta">
                <span className="lsm-result-duration">
                  <Clock size={12} /> {formatDuration(r.duration)}
                </span>
                {r.hasSynced && <span className="lsm-result-synced">Synced</span>}
              </div>
              {selectedId === r.id && <Check size={16} className="lsm-result-check" />}
            </div>
          ))}
        </div>

        {/* Preview + Select */}
        {previewLrc && (
          <div className="lsm-preview">
            <div className="lsm-preview-label">Preview:</div>
            <pre className="lsm-preview-text">{previewLrc}</pre>
          </div>
        )}

        <div className="lsm-footer">
          <button className="lsm-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="lsm-select-btn"
            onClick={handleSelectAndSave}
            disabled={selectedId === null}
          >
            <Check size={15} /> Use These Lyrics
          </button>
        </div>
      </div>
    </div>
  )
}
