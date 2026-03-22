import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useI18n } from '../../i18n'
import { CoverArt } from '../shared/CoverArt'
import { Song } from '../../types'
import {
  X, SkipBack, Play, Pause, SkipForward, Repeat, Shuffle, Heart, Music
} from 'lucide-react'

export function FullNowPlaying({ onClose }: { onClose: () => void }): JSX.Element {
  const { t } = useI18n()
  const {
    currentSong, isPlaying, progress, duration,
    pauseResume, nextSong, prevSong, shuffle, repeat,
    toggleShuffle, cycleRepeat
  } = usePlayerStore()
  const [similar, setSimilar] = useState<Song[]>([])

  useEffect(() => {
    if (currentSong) {
      window.api.getSimilarSongs(currentSong.id).then(setSimilar)
    }
  }, [currentSong?.id])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const pct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="fnp-overlay" onClick={onClose}>
      <div className="fnp-container" onClick={(e) => e.stopPropagation()}>
        {/* Background blur */}
        {currentSong && (
          <div className="fnp-bg">
            <CoverArt songPath={currentSong.path} hasCover={!!currentSong.has_cover} size={600} className="fnp-bg-img" />
          </div>
        )}

        <button className="fnp-close" onClick={onClose}><X size={24} /></button>

        <div className="fnp-content">
          {/* Album art */}
          <div className="fnp-cover-wrap">
            {currentSong ? (
              <CoverArt
                songPath={currentSong.path}
                hasCover={!!currentSong.has_cover}
                size={340}
                className={`fnp-cover ${isPlaying ? 'fnp-cover-spin' : ''}`}
              />
            ) : (
              <div className="fnp-cover-placeholder"><Music size={80} /></div>
            )}
          </div>

          {/* Song info */}
          <div className="fnp-info">
            <h1 className="fnp-title">{currentSong?.title || t.nowPlaying}</h1>
            <p className="fnp-artist">{currentSong?.artist || ''}</p>
            <p className="fnp-album">{currentSong?.album || ''}</p>
          </div>

          {/* Progress */}
          <div className="fnp-progress">
            <span className="fnp-time">{formatTime(progress)}</span>
            <div className="fnp-bar-bg">
              <div className="fnp-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="fnp-time">{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div className="fnp-controls">
            <button
              className={`fnp-ctrl-btn ${shuffle ? 'fnp-active' : ''}`}
              onClick={toggleShuffle}
            >
              <Shuffle size={20} />
            </button>
            <button className="fnp-ctrl-btn" onClick={prevSong}>
              <SkipBack size={24} fill="currentColor" />
            </button>
            <button className="fnp-play-btn" onClick={pauseResume}>
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
            </button>
            <button className="fnp-ctrl-btn" onClick={nextSong}>
              <SkipForward size={24} fill="currentColor" />
            </button>
            <button
              className={`fnp-ctrl-btn ${repeat !== 'none' ? 'fnp-active' : ''}`}
              onClick={cycleRepeat}
            >
              <Repeat size={20} />
              {repeat === 'one' && <span className="fnp-repeat-badge">1</span>}
            </button>
          </div>

          {/* Similar Songs */}
          {similar.length > 0 && (
            <div className="fnp-similar">
              <h3 className="fnp-similar-title">{t.similarSongs}</h3>
              <div className="fnp-similar-list">
                {similar.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    className="fnp-similar-item"
                    onClick={() => usePlayerStore.getState().playSong(s, similar)}
                  >
                    <CoverArt songPath={s.path} hasCover={!!s.has_cover} size={44} className="fnp-similar-cover" />
                    <div className="fnp-similar-info">
                      <span className="fnp-similar-name">{s.title}</span>
                      <span className="fnp-similar-artist">{s.artist}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
