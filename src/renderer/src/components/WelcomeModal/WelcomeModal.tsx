import { useLibraryStore } from '../../stores/libraryStore'
import { FolderOpen, Loader2 } from 'lucide-react'

export function WelcomeModal(): JSX.Element {
  const { addAndScanFolder, isScanning, scanProgress } = useLibraryStore()
  const pct = scanProgress.total > 0
    ? Math.round((scanProgress.current / scanProgress.total) * 100)
    : 0

  return (
    <div className="welcome-overlay">
      <div className="welcome-modal">
        <div className="welcome-icon">🎵</div>
        <h2>Welcome to MPlayer</h2>
        <p>Manage and play your local music files.<br />Handles 10,000+ songs with ease.</p>

        {isScanning ? (
          <div className="scan-progress-box">
            <div className="scan-bar-track">
              <div className="scan-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="scan-count">{scanProgress.current.toLocaleString()} / {scanProgress.total.toLocaleString()} songs scanned</p>
            {scanProgress.currentFile && (
              <p className="scan-file">{scanProgress.currentFile}</p>
            )}
            <div className="scan-spinner">
              <Loader2 size={20} className="spin" />
              <span>Scanning…</span>
            </div>
          </div>
        ) : (
          <button className="btn-primary" onClick={addAndScanFolder}>
            <FolderOpen size={18} />
            <span>Select Music Folder</span>
          </button>
        )}
      </div>
    </div>
  )
}
