import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { useI18n } from '../../i18n'
import { Radio, CheckCircle, XCircle, Loader, ExternalLink, LogOut, Palette, Check, Globe, Download, Upload, HardDrive } from 'lucide-react'
import { VERSIONS } from './VersionsView'

const THEMES = [
  { id: 'default', name: 'Cosmic Purple', bg: '#0B0B1E', accent1: '#8B5CF6', accent2: '#F43F5E', text: '#EDE9FE' },
  { id: 'midnight-blue', name: 'Midnight Blue', bg: '#0A0E1A', accent1: '#3B82F6', accent2: '#06B6D4', text: '#E2E8F0' },
  { id: 'rose-garden', name: 'Rose Garden', bg: '#1A0A14', accent1: '#EC4899', accent2: '#F43F5E', text: '#FDF2F8' },
  { id: 'emerald-forest', name: 'Emerald Forest', bg: '#061210', accent1: '#10B981', accent2: '#34D399', text: '#ECFDF5' },
  { id: 'sunset-orange', name: 'Sunset Orange', bg: '#1A0E08', accent1: '#F59E0B', accent2: '#EF4444', text: '#FFFBEB' },
  { id: 'cyberpunk', name: 'Cyberpunk', bg: '#0D0D0D', accent1: '#00FF87', accent2: '#FF0055', text: '#F0F0F0' },
  { id: 'ocean-breeze', name: 'Ocean Breeze', bg: '#081318', accent1: '#0EA5E9', accent2: '#7C3AED', text: '#E0F2FE' },
  { id: 'crimson-night', name: 'Crimson Night', bg: '#140808', accent1: '#DC2626', accent2: '#FB923C', text: '#FEF2F2' },
  { id: 'arctic-silver', name: 'Arctic Silver', bg: '#111318', accent1: '#A78BFA', accent2: '#C4B5FD', text: '#F1F5F9' },
  { id: 'neon-tokyo', name: 'Neon Tokyo', bg: '#0A0A12', accent1: '#E879F9', accent2: '#22D3EE', text: '#FAF5FF' },
  { id: 'golden-luxe', name: 'Golden Luxe', bg: '#12100A', accent1: '#D4A24E', accent2: '#C2873A', text: '#FDF6E3' },
  { id: 'winamp-teal', name: 'Winamp Teal', bg: '#0B1929', accent1: '#1DB9C3', accent2: '#0E7490', text: '#CFFAFE' },
  { id: 'deep-ocean', name: 'Deep Ocean', bg: '#0A1628', accent1: '#00D4FF', accent2: '#0077B6', text: '#E0F7FF' },
  { id: 'light-clean', name: 'Light Clean', bg: '#F5F5F7', accent1: '#6366F1', accent2: '#8B5CF6', text: '#1E1E2E' },
  { id: 'ruby-dark', name: 'Ruby Dark', bg: '#141414', accent1: '#D32F2F', accent2: '#FF5252', text: '#FAFAFA' },
  { id: 'violet-haze', name: 'Violet Haze', bg: '#12082A', accent1: '#9333EA', accent2: '#D946EF', text: '#F3E8FF' },
]

function applyTheme(id: string) {
  if (id === 'default') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', id)
  }
}

export function SettingsView(): JSX.Element {
  const { connected, username, apiKey, apiSecret, isAuthenticating, authError, loadStatus, authenticate, disconnect } =
    useSettingsStore()
  const { loadInitial } = useLibraryStore()
  const { t, lang, setLang } = useI18n()

  const [formApiKey, setFormApiKey] = useState('')
  const [formApiSecret, setFormApiSecret] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [currentTheme, setCurrentTheme] = useState('default')
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)

  useEffect(() => {
    loadStatus()
    window.api.getSetting('theme').then(t => {
      const id = t ?? 'default'
      setCurrentTheme(id)
      applyTheme(id)
    })
  }, [])

  // Pre-fill form with existing values when loaded
  useEffect(() => {
    if (apiKey) setFormApiKey(apiKey)
    if (apiSecret) setFormApiSecret(apiSecret)
    if (username) setFormUsername(username)
  }, [apiKey, apiSecret, username])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMsg('')
    const ok = await authenticate(formApiKey.trim(), formApiSecret.trim(), formUsername.trim(), formPassword)
    if (ok) {
      setSuccessMsg('Successfully connected to Last.fm!')
      setFormPassword('')
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Last.fm will be disconnected. Are you sure?')) return
    await disconnect()
    setFormPassword('')
    setSuccessMsg('')
  }

  return (
    <div className="settings-view">
      <div className="section-header">
        <h2 className="section-title">Settings</h2>
      </div>

      {/* ── Theme Picker ──────────────────────────────────────────── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Palette size={20} />
          </div>
          <div>
            <h3 className="settings-card-title">Color Theme</h3>
            <p className="settings-card-desc">
              Change the app's appearance
            </p>
          </div>
        </div>
        <div className="theme-picker-grid">
          {THEMES.map(t => (
            <div
              key={t.id}
              className={`theme-card${currentTheme === t.id ? ' active' : ''}`}
              style={{ background: t.bg }}
              onClick={() => {
                setCurrentTheme(t.id)
                applyTheme(t.id)
                window.api.setSetting('theme', t.id)
              }}
            >
              <div className="theme-card-colors">
                <div className="theme-swatch" style={{ background: t.accent1 }} />
                <div className="theme-swatch" style={{ background: t.accent2 }} />
                <div className="theme-swatch-bar" style={{ background: `linear-gradient(90deg, ${t.accent1}, ${t.accent2})` }} />
              </div>
              <span className="theme-card-name" style={{ color: t.text }}>{t.name}</span>
              {currentTheme === t.id && (
                <div className="theme-card-check">
                  <Check size={12} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Last.fm Card ──────────────────────────────────────────── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Globe size={20} />
          </div>
          <div>
            <h3 className="settings-card-title">{t.language}</h3>
            <p className="settings-card-desc">
              {lang === 'tr' ? 'Uygulama dilini değiştir' : 'Change application language'}
            </p>
          </div>
        </div>
        <div className="lang-picker">
          <button
            className={`lang-btn ${lang === 'tr' ? 'active' : ''}`}
            onClick={() => setLang('tr')}
          >
            🇹🇷 {t.turkish}
          </button>
          <button
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => setLang('en')}
          >
            🇬🇧 {t.english}
          </button>
        </div>
      </div>

      {/* ── Playbar Lock ──────────────────────────────────────────── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Radio size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 className="settings-card-title">Playbar Lock</h3>
            <p className="settings-card-desc">
              Prevent accidental jumping by locking the seek bar
            </p>
          </div>
          <div className="quick-switch" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button 
                className={`lang-btn ${useSettingsStore.getState().lockPlaybar ? 'active' : ''}`} // Corrected condition
                onClick={() => useSettingsStore.getState().setLockPlaybar(!useSettingsStore.getState().lockPlaybar)}
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: '8px',
                  background: useSettingsStore.getState().lockPlaybar ? 'var(--c-accent)' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer'
                } as React.CSSProperties}
              >
                {useSettingsStore.getState().lockPlaybar ? 'LOCKED' : 'UNLOCKED'}
              </button>
          </div>
        </div>
      </div>

      {/* ── Last.fm Scrobbling ──────────────────────────────────── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <Radio size={20} />
          </div>
          <div>
            <h3 className="settings-card-title">Last.fm Scrobbling</h3>
            <p className="settings-card-desc">
              Save your listened songs to your Last.fm profile
            </p>
          </div>
          {connected && (
            <div className="lastfm-status-badge connected">
              <CheckCircle size={14} />
              <span>Connected · {username}</span>
            </div>
          )}
        </div>

        {connected ? (
          <div className="settings-connected-info">
            <p className="settings-connected-text">
              <CheckCircle size={15} className="icon-green" />
              <strong>{username}</strong> logged in. Songs will be scrobbled at 50% or 4 minutes.
            </p>
            <button className="settings-disconnect-btn" onClick={handleDisconnect}>
              <LogOut size={14} />
              Disconnect
            </button>
          </div>
        ) : (
          <form className="settings-form" onSubmit={handleSubmit}>
            <div className="settings-form-row">
              <label className="settings-label">
                API Key
                <a
                  href="https://www.last.fm/api/account/create"
                  target="_blank"
                  rel="noreferrer"
                  className="settings-link"
                  onClick={(e) => { e.preventDefault(); window.electron.shell?.openExternal('https://www.last.fm/api/account/create') }}
                >
                  Create <ExternalLink size={11} />
                </a>
              </label>
              <input
                className="settings-input"
                type="text"
                placeholder="Last.fm API Key"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                required
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="settings-form-row">
              <label className="settings-label">API Secret</label>
              <input
                className="settings-input"
                type="password"
                placeholder="Last.fm API Secret"
                value={formApiSecret}
                onChange={(e) => setFormApiSecret(e.target.value)}
                required
                autoComplete="off"
              />
            </div>

            <div className="settings-form-row">
              <label className="settings-label">Username</label>
              <input
                className="settings-input"
                type="text"
                placeholder="Your Last.fm username"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="settings-form-row">
              <label className="settings-label">Password</label>
              <input
                className="settings-input"
                type="password"
                placeholder="Your Last.fm password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {authError && (
              <div className="settings-error">
                <XCircle size={14} />
                <span>{authError}</span>
              </div>
            )}

            {successMsg && (
              <div className="settings-success">
                <CheckCircle size={14} />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              className="settings-submit-btn"
              type="submit"
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <>
                  <Loader size={15} className="spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Radio size={15} />
                  Connect to Last.fm
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* ── How it works ──────────────────────────────────────────── */}
      <div className="settings-info-card">
        <h4>How it works?</h4>
        <ul>
          <li>Automatically scrobbles when you've listened to a song at 50% or for 4 minutes</li>
          <li>"Now Playing" info is updated immediately when a song starts playing</li>
          <li>The <span className="neon-preview">SCROBBLING</span> text in the player bar shows an active connection</li>
          <li>You can get an API key for free at <strong>last.fm/api/account/create</strong></li>
        </ul>
      </div>

      {/* ── Backup & Restore ─────────────────────────────────── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <HardDrive size={20} />
          </div>
          <div>
            <h3 className="settings-card-title">{t.backupRestore}</h3>
            <p className="settings-card-desc">{t.backupDesc}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="settings-submit-btn"
            disabled={backupLoading}
            onClick={async () => {
              setBackupMsg(null)
              setBackupLoading(true)
              try {
                const res = await window.api.exportBackup(VERSIONS)
                if (res.success) {
                  setBackupMsg({ type: 'success', text: t.backupSuccess })
                }
              } catch {
                setBackupMsg({ type: 'error', text: t.restoreError })
              } finally {
                setBackupLoading(false)
              }
            }}
          >
            {backupLoading ? <Loader size={15} className="spin" /> : <Download size={15} />}
            {t.exportBackup}
          </button>

          <button
            className="settings-submit-btn"
            style={{ background: 'var(--accent-secondary, #F43F5E)' }}
            disabled={backupLoading}
            onClick={async () => {
              if (!window.confirm(t.restoreConfirm)) return
              setBackupMsg(null)
              setBackupLoading(true)
              try {
                const res = await window.api.importBackup()
                if (res.success) {
                  const st = res.stats
                  const parts = [
                    st.songs && `${st.songs} ${t.statSongs}`,
                    st.play_history && `${st.play_history} ${t.statHistory}`,
                    st.library_folders && `${st.library_folders} ${t.statFolders}`,
                    st.playlists && `${st.playlists} ${t.statPlaylists}`,
                    st.lyrics_cache && `${st.lyrics_cache} ${t.statLyrics}`,
                    st.app_settings && `${st.app_settings} ${t.statSettings}`,
                    st.favorite_artists && `${st.favorite_artists} ${t.statFavArtists}`,
                  ].filter(Boolean)
                  setBackupMsg({ type: 'success', text: `${t.restoreSuccess} ${t.restoreStats} ${parts.join(', ')}` })
                  await loadInitial()
                }
              } catch {
                setBackupMsg({ type: 'error', text: t.restoreError })
              } finally {
                setBackupLoading(false)
              }
            }}
          >
            {backupLoading ? <Loader size={15} className="spin" /> : <Upload size={15} />}
            {t.importBackup}
          </button>
        </div>

        {backupMsg && (
          <div className={backupMsg.type === 'success' ? 'settings-success' : 'settings-error'} style={{ marginTop: 12 }}>
            {backupMsg.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
            <span>{backupMsg.text}</span>
          </div>
        )}
      </div>

      {/* ── Keyboard Shortcuts ────────────────────────────────────── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">Klavye Kısayolları</h3>
        </div>
        <div className="shortcuts-grid">
          <ShortcutRow keys={['Space']} desc="Oynat / Duraklat" />
          <ShortcutRow keys={['Ctrl', '→']} desc="Sonraki şarkı" />
          <ShortcutRow keys={['Ctrl', '←']} desc="Önceki şarkı" />
          <ShortcutRow keys={['Ctrl', '↑']} desc="Ses yükselt" />
          <ShortcutRow keys={['Ctrl', '↓']} desc="Ses azalt" />
          <ShortcutRow keys={['Ctrl', 'M']} desc="Sessiz / Açık" />
          <ShortcutRow keys={['Ctrl', 'Q']} desc="Kuyruk paneli aç/kapat" />
          <ShortcutRow keys={['Ctrl', 'F']} desc="Tam ekran Now Playing" />
          <ShortcutRow keys={['MediaPlay']} desc="Medya tuşu: Oynat/Duraklat" />
          <ShortcutRow keys={['MediaNext']} desc="Medya tuşu: Sonraki" />
          <ShortcutRow keys={['MediaPrev']} desc="Medya tuşu: Önceki" />
        </div>
      </div>
    </div>
  )
}

function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }): JSX.Element {
  return (
    <div className="shortcut-row">
      <div className="shortcut-keys">
        {keys.map((k, i) => (
          <span key={i}>
            <kbd className="shortcut-key">{k}</kbd>
            {i < keys.length - 1 && <span className="shortcut-plus">+</span>}
          </span>
        ))}
      </div>
      <span className="shortcut-desc">{desc}</span>
    </div>
  )
}
