import { usePlayerStore } from '../../stores/playerStore'
import { CoverArt } from '../shared/CoverArt'
import { formatDuration, getFormatBadge } from '../../utils/format'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2 } from 'lucide-react'

export function NowPlaying(): JSX.Element {
  const { currentSong, queue, queueIndex, isPlaying } = usePlayerStore()

  const nextSongs = queue.slice(queueIndex + 1, queueIndex + 5)

  return (
    <aside className="now-playing">
      {/* Currently Playing */}
      <section className="np-section">
        <h3 className="np-section-title">Currently playing</h3>
        <div className="np-card">
          <AnimatePresence mode="wait">
            {currentSong ? (
              <motion.div
                key={currentSong.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="np-inner"
              >
                <div className="np-cover-wrap">
                  <CoverArt
                    songPath={currentSong.path}
                    hasCover={!!currentSong.has_cover}
                    className="np-cover"
                    size={80}
                  />
                  {isPlaying && <SoundWave />}
                  {(() => {
                    const badge = getFormatBadge(currentSong.path, currentSong.bitrate ?? 0)
                    return (
                      <span className={`np-format-badge ${badge.isLossless ? 'np-format-badge--lossless' : 'np-format-badge--lossy'}`}>
                        {badge.label}
                      </span>
                    )
                  })()}
                </div>
                <p className="np-title">{currentSong.title}</p>
                <p className="np-artist">
                  {currentSong.artist}
                  {currentSong.album !== 'Unknown Album' && (
                    <span className="np-album"> · {currentSong.album}</span>
                  )}
                </p>
                {currentSong.play_count > 0 && (
                  <p className="np-plays">{currentSong.play_count} plays</p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="np-empty"
              >
                <Volume2 size={32} />
                <p>No song selected</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Next songs */}
      {nextSongs.length > 0 && (
        <section className="np-section">
          <h3 className="np-section-title">Next songs</h3>
          <div className="np-queue">
            {nextSongs.map((song) => (
              <div key={song.id} className="np-queue-item">
                <CoverArt
                  songPath={song.path}
                  hasCover={!!song.has_cover}
                  className="np-queue-cover"
                  size={44}
                />
                <div className="np-queue-info">
                  <p className="np-queue-title">{song.title}</p>
                  <p className="np-queue-artist">{song.artist}</p>
                </div>
                <span className="np-queue-dur">{formatDuration(song.duration)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}

function SoundWave(): JSX.Element {
  return (
    <div className="sound-wave">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  )
}
