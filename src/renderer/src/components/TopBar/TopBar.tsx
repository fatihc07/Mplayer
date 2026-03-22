import { useState, useEffect, useRef } from 'react'
import { Search, Moon, Bell, Minus, Square, X, Clock } from 'lucide-react'
import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { SearchResult } from '../../types'
import { CoverArt } from '../shared/CoverArt'

const HISTORY_KEY = 'mplayer_search_history'
const MAX_HISTORY = 10

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}
function saveHistory(term: string): void {
  const prev = loadHistory().filter((h) => h.toLowerCase() !== term.toLowerCase())
  const next = [term, ...prev].slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}
function removeHistory(term: string): void {
  const next = loadHistory().filter((h) => h !== term)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}

export function TopBar(): JSX.Element {
  const { setSearchQuery, loadSongs, setCurrentView, setArtistDetail, setPendingAlbum } = useLibraryStore()
  const { playSong } = usePlayerStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [history, setHistory] = useState<string[]>(loadHistory)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    clearTimeout(timer.current)
    if (!query.trim()) {
      setResults(null)
      setShowDropdown(false)
      setSearchQuery('')
      loadSongs(100, 0, '')
      return
    }
    timer.current = setTimeout(async () => {
      setSearchQuery(query)
      loadSongs(100, 0, query)
      const r = await window.api.searchAll(query)
      setResults(r)
      setShowDropdown(true)
    }, 300)
    return () => clearTimeout(timer.current)
  }, [query])

  function commitAndClose(term?: string): void {
    const t = (term ?? query).trim()
    if (t) { saveHistory(t); setHistory(loadHistory()) }
    setShowDropdown(false)
    setQuery('')
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasResults = results && (results.songs.length || results.artists.length || results.albums.length)

  return (
    <header className="topbar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div
        ref={containerRef}
        className="topbar-search"
        style={{ WebkitAppRegion: 'no-drag', position: 'relative' } as React.CSSProperties}
      >
        <Search size={15} className="topbar-search-icon" />
        <input
          type="text"
          placeholder="Search: songs, artists, albums…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim() && results && hasResults) setShowDropdown(true)
            else if (!query.trim() && history.length) setShowDropdown(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setShowDropdown(false); setQuery('') }
            if (e.key === 'Enter' && query.trim()) commitAndClose()
          }}
          className="topbar-search-input"
        />
        {query && (
          <button
            className="search-clear-btn"
            onClick={() => { setQuery(''); setShowDropdown(false) }}
          >
            <X size={13} />
          </button>
        )}

        {showDropdown && !query.trim() && history.length > 0 && (
          <div className="search-dropdown">
            <div className="search-section">
              <div className="search-history-header">
                <p className="search-section-title">Recent Searches</p>
                <button className="search-history-clear-all" onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); setShowDropdown(false) }}>Clear</button>
              </div>
              {history.map((h) => (
                <div key={h} className="search-result-item search-history-item" onClick={() => { setQuery(h); setShowDropdown(false) }}>
                  <Clock size={14} className="search-history-icon" />
                  <span className="sr-title">{h}</span>
                  <button className="search-history-remove" onClick={(e) => { e.stopPropagation(); removeHistory(h); setHistory(loadHistory()) }}><X size={11} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showDropdown && hasResults && (
          <div className="search-dropdown">
            {results!.songs.length > 0 && (
              <div className="search-section">
                <p className="search-section-title">Songs</p>
                {results!.songs.map((s) => {
                  const ext = s.path.split('.').pop()?.toUpperCase() ?? ''
                  const isLossless = ext === 'FLAC' || ext === 'WAV' || ext === 'AIFF' || ext === 'ALAC'
                  return (
                    <div
                      key={s.id}
                      className="search-result-item"
                      onClick={() => { playSong(s, [s], 0); commitAndClose() }}
                    >
                      <CoverArt songPath={s.path} hasCover={!!s.has_cover} size={32} className="sr-cover" />
                      <div className="sr-info">
                        <p className="sr-title">{s.title}</p>
                        <p className="sr-sub">{s.artist}</p>
                      </div>
                      {ext && (
                        <span
                          className={`format-badge ${isLossless ? 'format-badge--lossless' : 'format-badge--lossy'}`}
                          style={{ marginLeft: 'auto', flexShrink: 0 }}
                        >{ext}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {results!.artists.length > 0 && (
              <div className="search-section">
                <p className="search-section-title">Artists</p>
                {results!.artists.map((a) => (
                  <div
                    key={a.name}
                    className="search-result-item"
                    onClick={() => { setArtistDetail(a.name); commitAndClose() }}
                  >
                    <div className="sr-avatar">{a.name.slice(0, 1).toUpperCase()}</div>
                    <div className="sr-info">
                      <p className="sr-title">{a.name}</p>
                      <p className="sr-sub">{a.song_count} songs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results!.albums.length > 0 && (
              <div className="search-section">
                <p className="search-section-title">Albums</p>
                {results!.albums.map((a) => (
                  <div
                    key={`${a.name}-${a.artist}`}
                    className="search-result-item"
                    onClick={() => { setArtistDetail(a.artist); setPendingAlbum(a.name); commitAndClose() }}
                  >
                    <CoverArt
                      songPath={a.cover_path ?? ''}
                      hasCover={!!a.cover_path}
                      size={32}
                      className="sr-cover"
                    />
                    <div className="sr-info">
                      <p className="sr-title">{a.name}</p>
                      <p className="sr-sub">{a.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="topbar-right" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button className="topbar-icon-btn"><Moon size={17} /></button>
        <button className="topbar-icon-btn"><Bell size={17} /></button>
        <div className="topbar-avatar">
          <span>M</span>
        </div>
        <div className="window-controls">
          <button className="wc-btn wc-min" onClick={() => window.api.minimize()}><Minus size={11} /></button>
          <button className="wc-btn wc-max" onClick={() => window.api.maximize()}><Square size={10} /></button>
          <button className="wc-btn wc-close" onClick={() => window.api.close()}><X size={11} /></button>
        </div>
      </div>
    </header>
  )
}
