import { RefObject, useCallback } from 'react'
import {
  SkipBack, Play, Pause, SkipForward,
  Shuffle, Repeat, Repeat1, Volume2, VolumeX, Heart, MicVocal, Maximize2,
  ListMusic, Minimize2, Pencil
} from 'lucide-react'
import { usePlayerStore } from '../../stores/playerStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { CoverArt } from '../shared/CoverArt'
import { formatDuration, getFormatBadge } from '../../utils/format'

interface Props {
  audioRef: RefObject<HTMLAudioElement>
  lyricsOpen: boolean
  onToggleLyrics: () => void
  onOpenFullLyrics: () => void
  queueOpen: boolean
  onToggleQueue: () => void
}

export function Player({ audioRef, lyricsOpen, onToggleLyrics, onOpenFullLyrics, queueOpen, onToggleQueue }: Props): JSX.Element {
  const {
    currentSong, isPlaying, progress, duration,
    volume, isMuted, shuffle, repeat,
    pauseResume, nextSong, prevSong,
    setVolume, toggleMute, toggleShuffle, cycleRepeat, seekTo,
    toggleFavoriteCurrentSong
  } = usePlayerStore()

  const { toggleFavorite, setArtistDetail, setEditingSong } = useLibraryStore()
  const { connected: lfmConnected } = useSettingsStore()

  const handleToggleFavorite = useCallback(async () => {
    if (!currentSong) return
    await toggleFavorite(currentSong.id)
    toggleFavoriteCurrentSong()
  }, [currentSong?.id])

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { lockPlaybar } = useSettingsStore.getState()
      if (lockPlaybar) return
      const rect = e.currentTarget.getBoundingClientRect()
      const pct = (e.clientX - rect.left) / rect.width
      seekTo(pct * duration)
    },
    [duration, seekTo]
  )

  const handleVolumeClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const pct = (e.clientX - rect.left) / rect.width
      setVolume(Math.max(0, Math.min(1, pct)))
    },
    []
  )

  return (
    <footer className="player-bar">
      {/* Song info */}
      <div className="player-song-info">
        {currentSong && (
          <>
            <CoverArt
              songPath={currentSong.path}
              hasCover={!!currentSong.has_cover}
              className="player-cover"
              size={48}
            />
            <div className="player-meta">
              <p className="player-title">{currentSong.title}</p>
              <button
                className="player-artist-btn"
                onClick={() => setArtistDetail(currentSong.artist)}
                title={`Go to ${currentSong.artist}'s page`}
              >
                {currentSong.artist}
              </button>
              {(() => {
                const badge = getFormatBadge(currentSong.path, currentSong.bitrate ?? 0)
                return (
                  <span className={`format-badge ${badge.isLossless ? 'format-badge--lossless' : 'format-badge--lossy'}`}>
                    {badge.label}
                  </span>
                )
              })()}
            </div>
            <button
              className={`heart-btn player-heart-btn${currentSong.is_favorite ? ' favorited' : ''}`}
              onClick={handleToggleFavorite}
              title={currentSong.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              <Heart size={16} fill={currentSong.is_favorite ? 'currentColor' : 'none'} />
            </button>
          </>
        )}
        {lfmConnected && isPlaying && currentSong && (
          <span className="scrobbling-badge">SCROBBLING</span>
        )}
      </div>

      {/* Controls */}
      <div className="player-controls">
        <button
          className={`ctrl-btn ${shuffle ? 'active' : ''}`}
          onClick={toggleShuffle}
          title="Shuffle"
        >
          <Shuffle size={17} />
        </button>

        <button className="ctrl-btn ctrl-prev" onClick={prevSong} title="Previous">
          <SkipBack size={20} fill="currentColor" />
        </button>

        <button className="ctrl-btn ctrl-play" onClick={pauseResume}>
          {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>

        <button className="ctrl-btn ctrl-next" onClick={nextSong} title="Next">
          <SkipForward size={20} fill="currentColor" />
        </button>

        <button
          className={`ctrl-btn ${repeat !== 'none' ? 'active' : ''}`}
          onClick={cycleRepeat}
          title="Repeat"
        >
          {repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
        </button>
      </div>

      {/* Progress */}
      <div className="player-progress-area">
        <span className="player-time">{formatDuration(progress)}</span>
        <div className="progress-track" onClick={handleProgressClick}>
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          <div className="progress-thumb" style={{ left: `${progressPct}%` }} />
        </div>
        <span className="player-time">{formatDuration(duration)}</span>
      </div>

      {/* Volume & extras */}
      <div className="player-volume">
        {currentSong && (
          <button
            className="ctrl-btn edit-song-btn"
            onClick={() => setEditingSong(currentSong)}
            title="Edit song info"
          >
            <Pencil size={15} />
          </button>
        )}
        <button
          className={`ctrl-btn lyrics-toggle-btn${lyricsOpen ? ' active' : ''}`}
          onClick={onToggleLyrics}
          title="Lyrics"
        >
          <MicVocal size={17} />
        </button>
        <button
          className="ctrl-btn fl-open-btn"
          onClick={onOpenFullLyrics}
          title="Fullscreen lyrics"
        >
          <Maximize2 size={16} />
        </button>
        <button
          className={`ctrl-btn queue-toggle-btn${queueOpen ? ' active' : ''}`}
          onClick={onToggleQueue}
          title="Upcoming songs (Ctrl+Q)"
        >
          <ListMusic size={17} />
        </button>
        <button
          className="ctrl-btn mini-player-btn"
          onClick={() => window.api.toggleMiniPlayer()}
          title="Mini Player"
        >
          <Minimize2 size={16} />
        </button>
        <button className="ctrl-btn" onClick={toggleMute}>
          {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        <div className="volume-track" onClick={handleVolumeClick}>
          <div className="volume-fill" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} />
        </div>
      </div>
    </footer>
  )
}
