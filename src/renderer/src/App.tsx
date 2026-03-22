import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { TopBar } from './components/TopBar/TopBar'
import { MainContent } from './components/MainContent/MainContent'
import { Player } from './components/Player/Player'
import { QueuePanel } from './components/Player/QueuePanel'
import { LyricsPanel } from './components/Player/LyricsPanel'
import { FullLyricsView } from './components/Player/FullLyricsView'
import { FullNowPlaying } from './components/Player/FullNowPlaying'
import { TagEditor } from './components/shared/TagEditor'
import { SongContextMenu } from './components/shared/SongContextMenu'
import { WelcomeModal } from './components/WelcomeModal/WelcomeModal'
import { useLibraryStore } from './stores/libraryStore'
import { usePlayerStore } from './stores/playerStore'
import { useSettingsStore } from './stores/settingsStore'
import { useI18n } from './i18n'
import { CoverArt } from './components/shared/CoverArt'
import { SkipBack, Play, Pause, SkipForward, Maximize2, Heart, Volume2, VolumeX, ChevronRight, ListMusic, Search, ArrowLeft, AudioLines, Settings } from 'lucide-react'
import { formatDuration } from './utils/format'
import { Song } from './types'
import './styles/global.css'

const MINI_MODES = ['default', 'pill', 'card', 'visual', 'slim', 'photo', 'controls', 'lyrics-square'] as const
type MiniMode = typeof MINI_MODES[number]
type MiniPanel = null | 'queue' | 'search'

/**
 * Build a mplayer:// URL from a local file path.
 * Encodes each path SEGMENT individually (preserves / as delimiter)
 * so spaces, Turkish chars, parentheses etc. are handled correctly.
 * Input:  C:\Users\Music\Şarkı adı (feat).flac
 * Output: mplayer://local/C%3A/Users/Music/%C5%9Eark%C4%B1%20ad%C4%B1%20(feat).flac
 */
function toMplayerUrl(filePath: string): string {
  const segments = filePath.replace(/\\/g, '/').split('/')
  return `mplayer://local/${segments.map(encodeURIComponent).join('/')}`
}

export default function App(): JSX.Element {
  const { loadInitial, folders, reloadHistoryIfActive, editingSong, setEditingSong, toggleFavorite } = useLibraryStore()
  const {
    currentSong, isPlaying, volume, isMuted, progress, duration,
    setProgress, setDuration, setIsPlaying, nextSong, prevSong, pauseResume,
    incrementCurrentPlayCount, seekTo, toggleMute, setVolume, toggleFavoriteCurrentSong
  } = usePlayerStore()
  const { connected: lfmConnected, loadStatus: loadLfmStatus, lyricsFontSize, lyricsColor, setLyricsFontSize, setLyricsColor } = useSettingsStore()
  const audioRef        = useRef<HTMLAudioElement>(null)
  const loadedIdRef     = useRef<number | null>(null)
  const seekTargetRef   = useRef<number>(-1)
  const countedRef      = useRef<boolean>(false)
  const scrobbledRef    = useRef<boolean>(false)
  const songStartTsRef  = useRef<number>(Date.now())
  const lastSeekTsRef   = useRef<number>(0)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const [fullLyricsOpen, setFullLyricsOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [isMiniPlayer, setIsMiniPlayer] = useState(false)
  const [miniMode, setMiniMode] = useState<MiniMode>('default')
  const [miniPanel, setMiniPanel] = useState<MiniPanel>(null)
  const [miniSearchQuery, setMiniSearchQuery] = useState('')
  const [miniSearchResults, setMiniSearchResults] = useState<Song[]>([])
  const [fullNowPlaying, setFullNowPlaying] = useState(false)
  const lsqRef = useRef<HTMLDivElement>(null)
  const { loadLang } = useI18n()

  const [miniShowSettings, setMiniShowSettings] = useState(false)

  // Mini player lyrics state
  const [miniLyricLines, setMiniLyricLines] = useState<{ time: number; text: string }[]>([])
  const miniLyricSongRef = useRef<number | null>(null)

  useEffect(() => { loadInitial() }, [])
  useEffect(() => { loadLfmStatus() }, [])
  useEffect(() => { loadLang() }, [])

  // Start file watcher
  useEffect(() => {
    window.api.startWatcher()
    const unsub = window.api.onWatcherChange(() => {
      // Auto-refresh when files change
      useLibraryStore.getState().refreshAfterScan()
    })
    return () => {
      unsub()
      window.api.stopWatcher()
    }
  }, [])

  // Load saved theme on startup
  useEffect(() => {
    window.api.getSetting('theme').then(t => {
      if (t && t !== 'default') {
        document.documentElement.setAttribute('data-theme', t)
      }
    })
  }, [])

  // Mini player event listener
  useEffect(() => {
    const unsub = window.api.onMiniPlayerChange((isMini, mode) => {
      setIsMiniPlayer(isMini)
      if (isMini && mode) setMiniMode(mode as MiniMode)
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = window.api.onMiniModeChange((mode) => setMiniMode(mode as MiniMode))
    return unsub
  }, [])

  // Load saved mini mode on startup
  useEffect(() => {
    window.api.getSetting('miniPlayerMode').then(m => {
      if (m && MINI_MODES.includes(m as MiniMode)) setMiniMode(m as MiniMode)
    })
  }, [])

  // Fetch lyrics for mini player when song changes
  useEffect(() => {
    if (!currentSong) { setMiniLyricLines([]); miniLyricSongRef.current = null; return }
    if (currentSong.id === miniLyricSongRef.current) return
    miniLyricSongRef.current = currentSong.id
    setMiniLyricLines([])
    window.api.getLyrics(currentSong.id, currentSong.artist, currentSong.title, currentSong.album, currentSong.duration)
      .then(result => {
        if (!result?.synced) return
        const parsed: { time: number; text: string }[] = []
        for (const raw of result.lrc.split('\n')) {
          const m = raw.match(/^\[(\d{2}):(\d{2})(?:[.:]\d{2,3})?\]\s?(.*)/)
          if (m) parsed.push({ time: parseInt(m[1]) * 60 + parseInt(m[2]), text: m[3].trim() })
        }
        parsed.sort((a, b) => a.time - b.time)
        setMiniLyricLines(parsed)
      })
      .catch(() => {})
  }, [currentSong?.id])

  // Active lyric index for mini-player
  const activeLyricIdx = useMemo(() => {
    if (!miniLyricLines.length) return -1
    return miniLyricLines.findIndex((line, idx) => 
      line.time <= progress && (idx === miniLyricLines.length - 1 || miniLyricLines[idx+1].time > progress)
    )
  }, [miniLyricLines, progress])

  // Auto-scroll mini lyrics when index changes
  useEffect(() => {
    if (miniMode === 'lyrics-square' && lsqRef.current && activeLyricIdx !== -1) {
      const activeEl = lsqRef.current.children[activeLyricIdx] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeLyricIdx, miniMode])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const ctrl = e.ctrlKey || e.metaKey

      switch (e.key) {
        case ' ':
        case 'MediaPlayPause':
          e.preventDefault()
          usePlayerStore.getState().pauseResume()
          break
        case 'MediaTrackNext':
          e.preventDefault()
          usePlayerStore.getState().nextSong()
          break
        case 'MediaTrackPrevious':
          e.preventDefault()
          usePlayerStore.getState().prevSong()
          break
        case 'ArrowRight':
          if (ctrl) { e.preventDefault(); usePlayerStore.getState().nextSong() }
          break
        case 'ArrowLeft':
          if (ctrl) { e.preventDefault(); usePlayerStore.getState().prevSong() }
          break
        case 'ArrowUp':
          if (ctrl) {
            e.preventDefault()
            const v = usePlayerStore.getState().volume
            usePlayerStore.getState().setVolume(Math.min(1, v + 0.05))
          }
          break
        case 'ArrowDown':
          if (ctrl) {
            e.preventDefault()
            const v = usePlayerStore.getState().volume
            usePlayerStore.getState().setVolume(Math.max(0, v - 0.05))
          }
          break
        case 'm':
          if (ctrl) { e.preventDefault(); usePlayerStore.getState().toggleMute() }
          break
        case 'q':
          if (ctrl) { e.preventDefault(); setQueueOpen(o => !o) }
          break
        case 'f':
          if (ctrl) { e.preventDefault(); setFullNowPlaying(o => !o) }
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Global shortcuts (work even when app is minimized / in background) ─────
  useEffect(() => {
    const unsubs = [
      window.api.onGlobalShortcut('global:playPause', () => usePlayerStore.getState().pauseResume()),
      window.api.onGlobalShortcut('global:next', () => usePlayerStore.getState().nextSong()),
      window.api.onGlobalShortcut('global:prev', () => usePlayerStore.getState().prevSong()),
      window.api.onGlobalShortcut('global:volumeUp', () => {
        const s = usePlayerStore.getState()
        s.setVolume(Math.min(1, s.volume + 0.05))
      }),
      window.api.onGlobalShortcut('global:volumeDown', () => {
        const s = usePlayerStore.getState()
        s.setVolume(Math.max(0, s.volume - 0.05))
      }),
      window.api.onGlobalShortcut('global:mute', () => usePlayerStore.getState().toggleMute())
    ]
    return () => unsubs.forEach(u => u())
  }, [])

  // ── Load new song + auto-play ────────────────────────────────────────────────
  // Depends on currentSong.id only — play_count / other field changes won't reload audio
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentSong) return
    if (loadedIdRef.current === currentSong.id) return   // already loaded

    loadedIdRef.current = currentSong.id
    audio.src = toMplayerUrl(currentSong.path)
    audio.load()
    countedRef.current = false   // reset 80% flag for new song
    scrobbledRef.current = false // reset scrobble flag for new song
    songStartTsRef.current = Date.now()

    if (isPlaying) {
      audio.play().catch((err: Error) => {
        console.error('[MPlayer] play() failed:', err.message, '\nFile:', currentSong.path)
        setIsPlaying(false)
      })
      // Last.fm: update now playing when song loads
      if (lfmConnected) {
        window.api.lastfmUpdateNowPlaying(
          currentSong.artist,
          currentSong.title,
          currentSong.album,
          currentSong.duration
        )
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id])

  // ── Play / Pause toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentSong) return
    if (isPlaying) {
      audio.play().catch((err: Error) => {
        console.error('[MPlayer] play() failed:', err.message)
        setIsPlaying(false)
      })
    } else {
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  // ── Volume / mute ────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  // ── Seek: subscribe to store without triggering App re-renders on every tick
  useEffect(() => {
    return usePlayerStore.subscribe((state) => {
      const audio = audioRef.current
      if (!audio) return
      if (Math.abs(seekTargetRef.current - state.progress) > 0.2) {
        audio.currentTime = state.progress
        lastSeekTsRef.current = Date.now()
        // If store says playing but audio paused (e.g. repeat-one via manual next), restart
        if (state.isPlaying && audio.paused) {
          audio.play().catch(() => {})
        }
      }
      seekTargetRef.current = state.progress
    })
  }, [])

  // ── Callbacks ─────────────────────────────────────────────────────────────────
  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget
    const t = audio.currentTime
    const dur = audio.duration
    
    // Ignore updates for a short moment after manual seek to avoid jitter
    if (Date.now() - lastSeekTsRef.current < 500) return

    seekTargetRef.current = t   // keep ref in sync with playback
    setProgress(t)

    // ── 80% threshold: record play only once per playback session ─────────────
    if (
      !countedRef.current &&
      currentSong &&
      dur > 0 &&
      t / dur >= 0.8
    ) {
      countedRef.current = true
      window.api.recordPlay(currentSong.id).then(() => {
        incrementCurrentPlayCount()
        reloadHistoryIfActive()
      })
    }

    // ── Last.fm: scrobble at 50% or 240s, minimum 30s played ─────────────────
    if (
      lfmConnected &&
      !scrobbledRef.current &&
      currentSong &&
      dur > 0 &&
      t >= 30 &&
      t >= Math.min(dur * 0.5, 240)
    ) {
      scrobbledRef.current = true
      window.api.lastfmScrobble(
        currentSong.artist,
        currentSong.title,
        currentSong.album,
        songStartTsRef.current,
        currentSong.duration
      )
    }
  }, [setProgress, currentSong, reloadHistoryIfActive, lfmConnected])

  const handleError = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    const err = (e.target as HTMLAudioElement).error
    const codes: Record<number, string> = {
      1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED'
    }
    console.error(
      '[MPlayer] Audio error:',
      err ? codes[err.code] ?? err.code : 'unknown',
      '\nFile:', currentSong?.path
    )
    // Only auto-skip on source errors; let decode errors show in console (FLAC tolerance)
    if (err?.code === 4) nextSong()
  }, [currentSong?.path, nextSong])

  // ── Handle song end: repeat-one restarts directly, others delegate to store
  const handleEnded = useCallback(() => {
    const { repeat } = usePlayerStore.getState()
    const audio = audioRef.current
    if (repeat === 'one' && audio) {
      audio.currentTime = 0
      audio.play().catch(() => {})
    } else {
      nextSong()
    }
  }, [nextSong])


  const handleMiniProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const { lockPlaybar } = useSettingsStore.getState()
    if (lockPlaybar) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    seekTo(pct * duration)
  }, [duration, seekTo])

  const handleMiniFavorite = useCallback(async () => {
    if (!currentSong) return
    await toggleFavorite(currentSong.id)
    toggleFavoriteCurrentSong()
  }, [currentSong?.id, toggleFavorite, toggleFavoriteCurrentSong])

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0

  const toggleMiniPanel = useCallback((panel: 'queue' | 'search') => {
    setMiniPanel(prev => {
      const next = prev === panel ? null : panel
      window.api.setMiniExpanded(next !== null)
      if (next === 'search') setMiniSearchQuery('')
      return next
    })
  }, [])

  const handleMiniSearch = useCallback(async (q: string) => {
    setMiniSearchQuery(q)
    if (q.trim().length < 2) { setMiniSearchResults([]); return }
    const res = await window.api.searchAll(q.trim())
    setMiniSearchResults(res.songs || [])
  }, [])

  // Close panel when leaving mini player
  useEffect(() => {
    if (!isMiniPlayer && miniPanel) {
      setMiniPanel(null)
    }
  }, [isMiniPlayer])

  if (isMiniPlayer) {
    const audioEl = (
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
        onError={handleError}
      />
    )

    const restoreBtn = (
      <button
        className="mini-restore"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onClick={() => window.api.toggleMiniPlayer()}
        title="Return to normal mode"
      >
        <Maximize2 size={14} />
      </button>
    )

    const settingsBtn = (
      <button
        className={`mini-panel-btn${miniShowSettings ? ' active' : ''}`}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onClick={() => {
          const ns = !miniShowSettings;
          setMiniShowSettings(ns);
          window.api.setMiniExpanded(ns);
        }}
        title="Lyrics Settings"
      >
        <Settings size={13} />
      </button>
    )

    const modeBtn = (
      <button
        className="mini-mode-btn"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onClick={async (e) => {
          e.stopPropagation();
          const selected = await window.api.showMiniModeMenu();
          if (selected) {
            setMiniMode(selected as MiniMode);
            window.api.setMiniMode(selected);
          }
        }}
        title="Switch mode"
      >
        <ChevronRight size={14} />
      </button>
    )

    const queueBtn = (
      <button
        className={`mini-panel-btn${miniPanel === 'queue' ? ' active' : ''}`}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onClick={() => toggleMiniPanel('queue')}
        title="Kuyruk"
      >
        <ListMusic size={13} />
      </button>
    )

    const searchBtn = (
      <button
        className={`mini-panel-btn${miniPanel === 'search' ? ' active' : ''}`}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onClick={() => toggleMiniPanel('search')}
        title="Ara"
      >
        <Search size={13} />
      </button>
    )

    const { queue, queueIndex } = usePlayerStore.getState()
    const upcoming = queue.slice(queueIndex + 1)

    const miniPanelEl = miniPanel && (
      <div className="mp-panel">
        {miniPanel === 'queue' && (
          <>
            <div className="mp-panel-header">
              <button className="mp-panel-back" onClick={() => toggleMiniPanel('queue')}>
                <ArrowLeft size={16} />
              </button>
              <span className="mp-panel-title">Up Next</span>
            </div>
            <div className="mp-panel-list">
              {upcoming.length === 0 && (
                <p className="mp-panel-empty">No songs in queue</p>
              )}
              {upcoming.map((song, i) => (
                <button
                  key={`${song.id}-${i}`}
                  className={`mp-panel-item${currentSong?.id === song.id ? ' playing' : ''}`}
                  onClick={() => {
                    const store = usePlayerStore.getState()
                    store.playSong(song, store.queue, queueIndex + 1 + i)
                  }}
                >
                  <span className="mp-panel-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="mp-panel-song-title">{song.title}</span>
                  {currentSong?.id === song.id && isPlaying && (
                    <AudioLines size={14} className="mp-panel-playing-icon" />
                  )}
                  <span className="mp-panel-dur">{formatDuration(song.duration)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {miniPanel === 'search' && (
          <>
            <div className="mp-panel-header">
              <button className="mp-panel-back" onClick={() => toggleMiniPanel('search')}>
                <ArrowLeft size={16} />
              </button>
              <input
                className="mp-panel-search-input"
                type="text"
                placeholder="Search songs..."
                value={miniSearchQuery}
                onChange={(e) => handleMiniSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mp-panel-list">
              {miniSearchQuery.trim().length >= 2 && miniSearchResults.length === 0 && (
                <p className="mp-panel-empty">No results found</p>
              )}
              {miniSearchResults.map((song, i) => (
                <button
                  key={song.id}
                  className={`mp-panel-item${currentSong?.id === song.id ? ' playing' : ''}`}
                  onClick={() => {
                    usePlayerStore.getState().playSong(song, [song], 0)
                  }}
                >
                  <span className="mp-panel-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="mp-panel-song-title">{song.title}</span>
                  {currentSong?.id === song.id && isPlaying && (
                    <AudioLines size={14} className="mp-panel-playing-icon" />
                  )}
                  <span className="mp-panel-dur">{formatDuration(song.duration)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )

    const miniSettingsEl = miniShowSettings && (
      <div className="mp-lsq-settings" style={{ position: 'absolute', top: 38, right: 8, background: '#1e1e2d', padding: 12, borderRadius: 8, zIndex: 110, WebkitAppRegion: 'no-drag', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 10px 20px rgba(0,0,0,0.4)', width: 140 } as React.CSSProperties}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', alignItems: 'center' }}>
          <span>Lyrics Size</span>
          <span style={{color:'#00ffd5'}}>{lyricsFontSize}px</span>
        </div>
        <input type="range" min="12" max="60" value={lyricsFontSize} onChange={e => setLyricsFontSize(Number(e.target.value))} style={{ cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', alignItems: 'center', marginTop: 4 }}>
          <span>Color</span>
        </div>
        <input type="color" value={lyricsColor} onChange={e => setLyricsColor(e.target.value)} style={{ width: '100%', height: 20, border: 'none', background: 'transparent' }} />
      </div>
    )

    // Active mini lyric line
    const miniLyricText = (() => {
      if (miniLyricLines.length === 0) return ''
      let text = ''
      for (let i = 0; i < miniLyricLines.length; i++) {
        if (miniLyricLines[i].time <= progress) text = miniLyricLines[i].text
        else break
      }
      return text
    })()

    // Current + next lyric for visual mode (2-line)
    const miniLyricPair = (() => {
      if (miniLyricLines.length === 0) return { current: '', next: '' }
      let idx = 0
      for (let i = 0; i < miniLyricLines.length; i++) {
        if (miniLyricLines[i].time <= progress) idx = i
        else break
      }
      return {
        current: miniLyricLines[idx]?.text || '',
        next: miniLyricLines[idx + 1]?.text || ''
      }
    })()

    const miniLyricEl = miniLyricText ? (
      <div className="mp-lyric-line">{miniLyricText}</div>
    ) : null

    // 3-line context for photo / lyrics modes
    const miniLyricContext = (() => {
      if (miniLyricLines.length === 0) return { prev: '', current: '', next: '' }
      let idx = 0
      for (let i = 0; i < miniLyricLines.length; i++) {
        if (miniLyricLines[i].time <= progress) idx = i
        else break
      }
      return {
        prev: miniLyricLines[idx - 1]?.text || '',
        current: miniLyricLines[idx]?.text || '',
        next: miniLyricLines[idx + 1]?.text || ''
      }
    })()

    // ─── MODE: Default ───
    if (miniMode === 'default') {
      return (
        <div className="app-root mini-mode">
          {audioEl}
          <div className="mini-default-wrap">
            <div className="mini-player-root" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
              {currentSong && (
                <CoverArt songPath={currentSong.path} hasCover={!!currentSong.has_cover} size={50} className="mini-cover" />
              )}
              <div className="mini-info">
                <p className="mini-title">{currentSong?.title || 'MPlayer'}</p>
                <p className="mini-artist">{currentSong?.artist || ''}</p>
              </div>
              <div className="mini-controls" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <button onClick={prevSong}><SkipBack size={15} fill="currentColor" /></button>
                <button className="mini-play-btn" onClick={pauseResume}>
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <button onClick={nextSong}><SkipForward size={15} fill="currentColor" /></button>
              </div>
              {queueBtn}
              {searchBtn}
              {settingsBtn}
              {modeBtn}
              {restoreBtn}
            </div>
            {miniLyricText && (
              <div className="mini-default-lyric" style={{ fontSize: lyricsFontSize, color: lyricsColor }}>{miniLyricText}</div>
            )}
          </div>
          {miniSettingsEl}
          {miniPanelEl}
        </div>
      )
    }

    // ─── MODE: Pill ───
    if (miniMode === 'pill') {
      return (
        <div className="app-root mini-mode mini-pill">
          {audioEl}
          <div className="mp-pill" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <div className="mp-pill-info">
              {currentSong && (
                <CoverArt songPath={currentSong.path} hasCover={!!currentSong.has_cover} size={44} className="mp-pill-cover" />
              )}
              <p className="mp-pill-text" style={{ fontSize: Math.min(lyricsFontSize, 18), color: lyricsColor }}>
                {miniLyricText || (currentSong ? `${currentSong.artist} - ${currentSong.title}` : 'MPlayer')}
              </p>
            </div>
            <div className="mp-pill-btns" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button onClick={pauseResume}>
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>
              {settingsBtn}
              {modeBtn}
              {restoreBtn}
            </div>
          </div>
          {miniSettingsEl}
          {miniPanelEl}
        </div>
      )
    }

    // ─── MODE: Card ───
    if (miniMode === 'card') {
      return (
        <div className="app-root mini-mode mini-card">
          {audioEl}
          <div className="mp-card" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <div className="mp-card-top-btns" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              {queueBtn}
              {searchBtn}
              {settingsBtn}
              {modeBtn}
              {restoreBtn}
            </div>
            <div className="mp-card-art">
              {currentSong && (
                <CoverArt songPath={currentSong.path} hasCover={!!currentSong.has_cover} size={220} className="mp-card-cover" />
              )}
            </div>
            <div className="mp-card-info">
              <p className="mp-card-title">{currentSong?.title || 'MPlayer'}</p>
              <p className="mp-card-artist">{currentSong?.artist || ''}</p>
              {miniLyricEl}
            </div>
            <div className="mp-card-progress" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} onClick={handleMiniProgressClick}>
              <div className="mp-card-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mp-card-time">
              <span>{formatDuration(progress)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
            <div className="mp-card-controls" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button onClick={prevSong}><SkipBack size={20} fill="currentColor" /></button>
              <button className="mp-card-play" onClick={pauseResume}>
                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
              </button>
              <button onClick={nextSong}><SkipForward size={20} fill="currentColor" /></button>
            </div>
          </div>
          {miniPanelEl}
        </div>
      )
    }

    // ─── MODE: Visual (blurred bg) ───
    if (miniMode === 'visual') {
      return (
        <div className="app-root mini-mode mini-visual">
          {audioEl}
          <div className="mp-visual" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            {currentSong && (
              <div className="mp-visual-bg">
                <CoverArt songPath={currentSong.path} hasCover={!!currentSong.has_cover} size={360} className="mp-visual-bg-img" />
              </div>
            )}
            <div className="mp-visual-overlay" />
            <div className="mp-visual-top" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button className="mp-visual-fav" onClick={handleMiniFavorite}>
                <Heart size={18} fill={currentSong?.is_favorite ? 'currentColor' : 'none'} />
              </button>
              {queueBtn}
              {searchBtn}
              {settingsBtn}
              {modeBtn}
              {restoreBtn}
            </div>
            {miniLyricPair.current ? (
              <div className="mp-visual-lyrics" style={{ fontSize: lyricsFontSize, color: lyricsColor }}>
                <div className="mp-visual-lyric-active">{miniLyricPair.current}</div>
                {miniLyricPair.next && <div className="mp-visual-lyric-next" style={{ fontSize: lyricsFontSize * 0.8 }}>{miniLyricPair.next}</div>}
              </div>
            ) : <div className="mp-visual-lyrics-spacer" />}
            <div className="mp-visual-content">
              <p className="mp-visual-subtitle">{currentSong?.artist || ''}</p>
              <p className="mp-visual-title">{currentSong?.title || 'MPlayer'}</p>
              <span className="mp-visual-time">{formatDuration(duration - progress)}</span>
            </div>
            <div className="mp-visual-progress" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} onClick={handleMiniProgressClick}>
              <div className="mp-visual-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mp-visual-controls" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button onClick={handleMiniFavorite}>
                <Heart size={18} fill={currentSong?.is_favorite ? '#ff4081' : 'none'} color={currentSong?.is_favorite ? '#ff4081' : '#fff'} />
              </button>
              <button className="mp-visual-play" onClick={pauseResume}>
                {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
              </button>
              <button onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
          </div>
          {miniPanelEl}
        </div>
      )
    }

    // ─── MODE: Slim ───
    if (miniMode === 'slim') {
      return (
        <div className="app-root mini-mode mini-slim">
          {audioEl}
          <div className="mp-slim" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            {currentSong && (
              <CoverArt songPath={currentSong.path} hasCover={!!currentSong.has_cover} size={36} className="mp-slim-cover" />
            )}
            <div className="mp-slim-info">
              <p className="mp-slim-text" style={{ fontSize: Math.min(lyricsFontSize, 14), color: lyricsColor }}>
                {miniLyricText || (currentSong ? `${currentSong.artist} — ${currentSong.title}` : 'MPlayer')}
              </p>
            </div>
            <div className="mp-slim-seek" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} onClick={handleMiniProgressClick}>
              <div className="mp-slim-seek-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mp-slim-btns" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button onClick={pauseResume}>
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
              {queueBtn}
              {searchBtn}
              {settingsBtn}
              {modeBtn}
              {restoreBtn}
            </div>
          </div>
          {miniSettingsEl}
          {miniPanelEl}
        </div>
      )
    }

    // ─── MODE: Photo (split cover + lyrics) ───
    if (miniMode === 'photo') {
      return (
        <div className="app-root mini-mode mini-photo">
          {audioEl}
          <div className="mp-photo" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <div className="mp-photo-left">
              {currentSong && (
                <CoverArt songPath={currentSong.path} hasCover={!!currentSong.has_cover} size={210} className="mp-photo-bg-img" />
              )}
              <div className="mp-photo-left-overlay" />
              {currentSong && (
                <CoverArt songPath={currentSong.path} hasCover={!!currentSong.has_cover} size={88} className="mp-photo-cover" />
              )}
            </div>
            <div className="mp-photo-right">
              <div className="mp-photo-top-btns" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                {settingsBtn}{modeBtn}{restoreBtn}
              </div>
              <div className="mp-photo-info">
                <p className="mp-photo-title">{currentSong?.title || 'MPlayer'}</p>
                <p className="mp-photo-artist">{currentSong?.artist || ''}</p>
              </div>
              {miniLyricContext.current ? (
                <div className="mp-photo-lyrics" style={{ color: lyricsColor }}>
                  <p className="mp-photo-lyric-active" style={{ fontSize: lyricsFontSize }}>{miniLyricContext.current}</p>
                  {miniLyricContext.next && <p className="mp-photo-lyric-next" style={{ fontSize: lyricsFontSize * 0.8 }}>{miniLyricContext.next}</p>}
                </div>
              ) : <div className="mp-photo-lyrics-spacer" />}
              <div className="mp-photo-progress" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} onClick={handleMiniProgressClick}>
                <div className="mp-photo-progress-fill" style={{ width: `${progressPct}%` }} />
                <div className="mp-photo-progress-dot" style={{ left: `${progressPct}%` }} />
              </div>
              <div className="mp-photo-time">
                <span>{formatDuration(progress)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
              <div className="mp-photo-controls" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <button onClick={prevSong}><SkipBack size={17} fill="currentColor" /></button>
                <button className="mp-photo-play" onClick={pauseResume}>
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </button>
                <button onClick={nextSong}><SkipForward size={17} fill="currentColor" /></button>
                <button onClick={handleMiniFavorite}>
                  <Heart size={15} fill={currentSong?.is_favorite ? '#ff4081' : 'none'} color={currentSong?.is_favorite ? '#ff4081' : 'currentColor'} />
                </button>
              </div>
            </div>
          </div>
          {miniSettingsEl}
          {miniPanelEl}
        </div>
      )
    }

    if (miniMode === 'lyrics-square') {
      const activeIdx = activeLyricIdx;

      return (
        <div className="app-root mini-mode mini-lyrics-square" style={{ background: '#000000', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' } as React.CSSProperties}>
          {audioEl}
          
          <div className="mp-lsq-header" style={{ 
            height: 36, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-end', 
            padding: '0 10px', 
            gap: 8, 
            WebkitAppRegion: 'drag', 
            background: '#0a0a0a', // Solid dark background for clarity
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0,
            zIndex: 100,
            color: '#ffffff'
          } as React.CSSProperties}>
            <div style={{ display: 'flex', gap: 6, WebkitAppRegion: 'no-drag', alignItems: 'center' } as React.CSSProperties}>
              {settingsBtn}
              {modeBtn}
              {restoreBtn}
            </div>
          </div>

          {miniSettingsEl}

          <div className="mp-lsq-lyrics-container" style={{ 
            flex: 1, 
            padding: '0 20px', 
            overflowY: 'auto', 
            WebkitAppRegion: 'no-drag', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 24,
            scrollBehavior: 'smooth',
            scrollbarWidth: 'none'
          } as React.CSSProperties}
          ref={lsqRef}>
            {/* Top Spacer for centering */}
            <div style={{ height: '50%', flexShrink: 0 }} />
            
            {miniLyricLines.length > 0 ? (
              miniLyricLines.map((line, idx) => {
                const isPast = line.time < progress;
                const isCurrent = idx === activeIdx;
                return (
                  <p key={idx} style={{
                    margin: 0,
                    textAlign: 'center',
                    fontWeight: isCurrent ? 800 : 500,
                    fontSize: isCurrent ? `${lyricsFontSize + 6}px` : `${lyricsFontSize}px`,
                    color: isCurrent ? lyricsColor : isPast ? `${lyricsColor}66` : '#333344',
                    textShadow: isCurrent ? `0 0 20px ${lyricsColor}cc, 0 0 10px ${lyricsColor}66` : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    transform: isCurrent ? 'scale(1.05)' : 'scale(1)',
                    opacity: isCurrent ? 1 : isPast ? 0.6 : 0.4
                  } as React.CSSProperties} onClick={() => seekTo(line.time)}>
                    {line.text}
                  </p>
                )
              })
            ) : (
              <p style={{ margin: 'auto', textAlign: 'center', color: '#555566', fontSize: `${lyricsFontSize}px` }}>
                {currentSong?.title || '♪'}
              </p>
            )}

            {/* Bottom Spacer for centering */}
            <div style={{ height: '50%', flexShrink: 0 }} />
          </div>
          {miniPanelEl}
        </div>
      )
    }

    return (
      <div className="app-root mini-mode mini-controls-mode">
        {audioEl}
        <div className="mp-ctrls" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <div className="mp-ctrls-buttons" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {miniLyricEl}
            <button onClick={prevSong}><SkipBack size={16} fill="currentColor" /></button>
            <button className="mp-ctrls-play" onClick={pauseResume}>
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button onClick={nextSong}><SkipForward size={16} fill="currentColor" /></button>
            <button onClick={toggleMute}>
              {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            {queueBtn}
            {searchBtn}
            {modeBtn}
            {restoreBtn}
          </div>
        </div>
        {miniPanelEl}
      </div>
    )
  }

  return (
    <div className="app-root">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
        onError={handleError}
      />

      <div className="app-layout">
        <Sidebar />
        <div className="app-main">
          <TopBar />
          <div className="app-content-row">
            <MainContent />
            {lyricsOpen && <LyricsPanel onClose={() => setLyricsOpen(false)} />}
          </div>
          <Player
            audioRef={audioRef}
            lyricsOpen={lyricsOpen}
            onToggleLyrics={() => setLyricsOpen(o => !o)}
            onOpenFullLyrics={() => { setFullLyricsOpen(true); setLyricsOpen(false) }}
            queueOpen={queueOpen}
            onToggleQueue={() => setQueueOpen(o => !o)}
          />
        </div>
      </div>

      {folders.length === 0 && <WelcomeModal />}
      {fullLyricsOpen && <FullLyricsView onClose={() => setFullLyricsOpen(false)} />}
      {fullNowPlaying && <FullNowPlaying onClose={() => setFullNowPlaying(false)} />}
      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
      {editingSong && (
        <TagEditor
          song={editingSong}
          onClose={() => setEditingSong(null)}
        />
      )}
      <SongContextMenu />
    </div>
  )
}
