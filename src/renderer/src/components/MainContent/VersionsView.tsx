import { GitBranch, CheckCircle, Sparkles } from 'lucide-react'

export interface VersionEntry {
  version: string
  date: string
  tag: 'major' | 'minor' | 'patch'
  features: string[]
}

export const VERSIONS: VersionEntry[] = [
  {
    version: '1.0.0',
    date: '2026-03-20',
    tag: 'major',
    features: [
      'Core music player infrastructure (HTML5 Audio + mplayer:// protocol)',
      'Local music library scanning (MP3, FLAC, WAV, OGG, M4A, AAC, WMA, APE support)',
      'Library management — song, artist, album lists',
      'Play history tracking',
      'Favorite songs and favorite artists system',
      'Playlist create, edit, delete and add/remove songs',
      '6 Smart Playlists (Last 50, Not Played in 3 Months, Most Played, Recently Added, Shortest, Longest)',
      'Search system — song, artist, album search (debounced, dropdown results)',
      'Artist detail page (Wikipedia biography, album listing)',
      'Lyrics panel + LRCLIB API integration (synced lyrics)',
      'Fullscreen lyrics view',
      'LRC file import and offset adjustment',
      'Last.fm Scrobbling integration (Now Playing + 50%/240s scrobble)',
      'Cover art LRU cache system (200 max)',
      'Format quality badge (FLAC/320kbps/MP3 etc.)',
      'Quality tier system — prefers higher quality version on duplicate plays',
      'Folder management — add, remove, rescan folders',
      'Frameless window design (minimize, maximize, close)',
      'Draggable title bar',
      'Custom mplayer:// protocol with Range request support (seek + FLAC)',
      'Zustand state management (playerStore, libraryStore, settingsStore)',
      'Dark theme (Cosmic Purple) as default design',
      'Shuffle and Repeat (none/all/one) modes',
      'Volume control + mute toggle',
    ]
  },
  {
    version: '1.1.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Trending page completely redesigned (dashboard layout)',
      'Hero banner — most listened artist with background cover',
      'Circular artist avatar row (top 7)',
      'Horizontal recently played cards',
      'Right sidebar — Most Played list + Now Playing card',
      'Clickable artist navigation (trending → artist detail)',
      'Play count display added everywhere',
    ]
  },
  {
    version: '1.2.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Statistics page added',
      '12 overview cards (total songs, artists, albums, plays, etc.)',
      'Hourly, daily, monthly play charts (bar chart)',
      'Top listened artists, songs, genres list',
      'Format distribution (FLAC/MP3 counts)',
      'Year range statistics',
    ]
  },
  {
    version: '1.3.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Color theme system added — 16 themes',
      'Cosmic Purple (default), Midnight Blue, Rose Garden, Emerald Forest, Sunset Orange',
      'Cyberpunk, Ocean Breeze, Crimson Night, Arctic Silver, Neon Tokyo, Golden Luxe',
      'Winamp Teal, Deep Ocean, Light Clean, Ruby Dark, Violet Haze',
      'Theme preference remembered (app_settings DB)',
      'Theme auto-loads on app startup',
      'Visual theme cards selection in Settings',
    ]
  },
  {
    version: '1.4.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Keyboard shortcuts system — Space, Ctrl+Right/Left, Ctrl+Up/Down, Ctrl+M, Ctrl+Q',
      'Media key support (MediaPlayPause, MediaTrackNext, MediaTrackPrevious)',
      'Shortcuts automatically disabled when input/textarea is focused',
      'Shortcut reference card in Settings',
    ]
  },
  {
    version: '1.5.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Mini Player mode — 380x130 pixel compact window',
      'Always on top feature',
      'Cover art, song info, basic controls',
      'Draggable + single-click return to normal mode',
    ]
  },
  {
    version: '1.6.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      '4 new Smart Playlists added (total 10)',
      'Random Mix — random 50 songs',
      'Lossless Quality — FLAC/WAV/APE/AIFF',
      'Forgotten Gems — songs rarely played in 30+ days',
      'One-Hit Wonders — artists with only 1 song in the library',
    ]
  },
  {
    version: '1.7.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Song Queue panel (open with Ctrl+Q)',
      'View of upcoming songs, currently playing and previous songs',
      'Play Next and Add to Queue functions',
      'Remove song from queue and clear upcoming',
    ]
  },
  {
    version: '1.8.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Song Info Editor (Tag Editor)',
      'Edit title, artist, album, year, genre, track number',
      'Updates in database (does not touch file)',
      'Active song info updates instantly',
    ]
  },
  {
    version: '1.9.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Version History page added',
      'All features listed per version',
      'Automatic version number increment',
    ]
  },
  {
    version: '1.9.1',
    date: '2026-03-20',
    tag: 'patch',
    features: [
      "Repeat One mode fixed — song restarts automatically when it ends",
      "Fixed audio pause stutter in repeat-one with manual next/prev",
      'Seek subscriber: auto-trigger play when audio is paused but store is playing',
    ]
  },
  {
    version: '1.10.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Drag-and-drop song reordering in the play queue',
      'Remove single song from queue (X button) — already existed, drag handle added',
      'Right-click context menu — "Play Next", "Add to Queue", "Add to Playlist" on all song lists',
      'Add to Playlist submenu — existing playlists + create new playlist',
      'Context menu: active in Library, Songs, Favorites, History, Playlists, Trends pages',
      'playerStore: reorderQueue() method added',
    ]
  },
  {
    version: '1.11.0',
    date: '2026-03-21',
    tag: 'major',
    features: [
      'Wrapped (Listening Report) — weekly, monthly and all-time listening statistics',
      'Wrapped: total listening duration, total plays, unique song/artist count',
      'Wrapped: top 10 songs, artists, albums and genre rankings',
      'Wrapped: hourly and daily activity charts',
      'Wrapped: longest streak, daily average, new discoveries, most active hour/day',
      'Wrapped: animated entry effects and gradient design',
      'Fullscreen Now Playing — large cover art, blur background, controls (Ctrl+F)',
      'Similar Song Suggestions — same artist/album/genre-based suggestions on Now Playing screen',
      'Customizable Sidebar — drag-and-drop reordering, hide/show toggle',
      'Sidebar settings stored persistently in database',
      'Duplicate Song Finder — groups songs with same title + artist',
      'Duplicate finder: sorted by bitrate, best quality marked',
      'Playlist Export — in JSON and M3U formats',
      'Playlist Import — create playlist from M3U and JSON files',
      'Playlist Cover Editing — set playlist cover from song cover',
      'File Watcher — automatically detects changes in library folders',
      'Multi-language Support — Turkish and English (changeable in settings)',
      'All Sidebar and main UI labels support i18n',
    ]
  },
  {
    version: '1.12.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Mini Player: 6 visual modes — Default, Pill, Card, Visual, Slim, Controls',
      'Default mode — 380x130 compact cover + controls',
      'Pill mode — 360x72 minimal pill-shaped design',
      'Card mode — 300x420 vertical card, large cover art',
      'Visual mode — 360x280 animated background effect',
      'Slim mode — 420x56 thin horizontal strip',
      'Controls mode — 260x52 controls only',
      'Mode switching works in cycle with a single key',
      'Selected mode stored persistently in database',
      'Custom window size auto-adjusted for each mode',
    ]
  },
  {
    version: '1.13.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Mini Player: Play Queue panel — openable in all modes',
      'Mini Player: Library Search panel — openable in all modes',
      'Apple Music-style clean list design (light theme)',
      'Playing song highlighted with orange accent',
      'Song numbers and equalizer animation',
      'Window auto-expands when panel opens (+360px)',
      'Window returns to previous size when panel closes',
    ]
  },
  {
    version: '1.14.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Global Keyboard Shortcuts — works even when app is in background',
      'MediaPlayPause, MediaNextTrack, MediaPreviousTrack media key support',
      'Ctrl+Alt+Space — Play/Pause (global)',
      'Ctrl+Alt+Right/Left — Next/Previous song (global)',
      'Ctrl+Alt+Up/Down — Volume up/down (global)',
      'Ctrl+Alt+M — Mute/Unmute toggle (global)',
      'Active system-wide via Electron globalShortcut API',
      'All shortcuts automatically unregistered when app closes',
    ]
  },
  {
    version: '1.15.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Full Backup & Restore system',
      'Export all data to a single JSON file',
      'Import from backup file to restore all data',
      'Smart merge — existing data preserved, new data added',
      'Backup of song paths, play statistics, listening history',
      'Backup of playlists, favorite artists, lyrics',
      'Backup of library folders and app settings',
      'Detailed statistics summary shown after import',
      'Backup & Restore card in Settings page',
      'Turkish and English language support (17 new i18n keys)',
    ]
  },
  {
    version: '1.16.0',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      '20 font options for lyrics (Google Fonts integration)',
      'Synced lyrics display in Mini Player across all modes',
      'Mini Player Visual mode: 2-line lyrics (active + next)',
      'Mini Player Default mode: large lyrics in bottom area',
      'Static neon text glow effect in lyrics',
      'Tag Editor now also updates file tags (node-taglib-sharp)',
      'Tag Editor: cover art addition — select from file',
      'Tag Editor: online cover search via MusicBrainz + Cover Art Archive',
      'Songs played multiple times on the same day in History are grouped (x4 badge)',
      'Fixed Infinity:NaN duration bug for songs opened from Mini Player search',
      'Database file size display in Statistics',
    ]
  },
  {
    version: '1.16.13',
    date: '2026-03-20',
    tag: 'patch',
    features: [
      'Artist detail page: blue verification tick (BadgeCheck) moved immediately to the right of the artist name',
      'Last Played column added to song list table',
      'Song list grid updated to 9-column layout',
    ]
  },
  {
    version: '1.16.14',
    date: '2026-03-20',
    tag: 'patch',
    features: [
      "Default app window size set to 90% of screen",
      'Volume slider now visible in player bar — grid column widened',
      'Fixed player icon overflow on small window sizes',
      'Player grid: updated to 240px auto minmax(200px,1fr) 290px structure',
    ]
  },
  {
    version: '1.16.15',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Update button added to artist detail page',
      "Pressing the button scans only that artist's library folder (including subdirectories)",
      "Much faster than full library scan since only the artist's directory is scanned",
      'All statistics (play_count, last_played) preserved including FLAC upgrades',
      'Number of songs added and deleted orphans shown on screen after scan',
      'Songs deleted from disk are automatically removed (orphan cleanup)',
    ]
  },
  {
    version: '1.16.16',
    date: '2026-03-20',
    tag: 'patch',
    features: [
      'Favorite button (heart icon) added to Listening History page',
      'Add/remove from favorites directly from history with a single click',
      'Favorite status reflected instantly (red filled icon)',
      'is_favorite field added to HistoryEntry type',
      'SQL query updated to return s.is_favorite field',
    ]
  },
  {
    version: '1.16.17',
    date: '2026-03-20',
    tag: 'patch',
    features: [
      'Artist Update: fixed issue of scanning going up to library root directory',
      'Library roots used as ceiling to determine true parent directory of the artist',
      'Correct common parent directory found even when songs are in different album folders',
      "commonAncestorOf() helper function bounded by library root boundary",
      'Falls back to scanning each album folder separately if no match found',
    ]
  },
  {
    version: '1.16.18',
    date: '2026-03-20',
    tag: 'minor',
    features: [
      'Total play count displayed on album cards',
      'Total plays info added under title in album detail page',
      'Plays and Last Played columns added to album track list',
    ]
  },
  {
    version: '1.16.19',
    date: '2026-03-20',
    tag: 'patch',
    features: [
      "Artist Update: fallback filename-based matching added when FLAC files can't match MP3 records",
      'FLAC upgrade done preserving statistics by detecting same-named file in same folder',
      'Fixed surprise deletion issue — orphan detection now folder-based instead of artist-name-based',
    ]
  },
  {
    version: '1.16.20',
    date: '2026-03-21',
    tag: 'patch',
    features: [
      'Statistics preserved even if FLAC file was previously scanned with zero stats',
      'Improved filename matching when tag matching fails during MP3 to FLAC upgrade',
      'When multiple copies exist, the record with the highest play_count is used as the base',
    ]
  },
  {
    version: '1.16.21',
    date: '2026-03-21',
    tag: 'minor',
    features: [
      'File path shown on artist detail page',
      "Clicking the path opens the artist's folder in Windows Explorer",
    ]
  },
  {
    version: '1.16.22',
    date: '2026-03-21',
    tag: 'patch',
    features: [
      'Folder open icon added next to Update button on artist detail page',
      'Long path text removed; folder path shown as tooltip',
    ]
  },
  {
    version: '1.16.23',
    date: '2026-03-21',
    tag: 'minor',
    features: [
      "Year / A-Z sort button added to Albums and Singles & EP's sections",
      'Popular list shows 5 songs with a "Show More" button to expand all songs',
      'Playing song cover card removed from Trends page right panel',
      'Last 10 search terms stored in localStorage for the search box',
      'Search history can be deleted individually or all at once from dropdown',
    ]
  },
  {
    version: '1.16.24',
    date: '2026-03-22',
    tag: 'minor',
    features: [
      'Artist folder moved detection: user is notified if folder is missing during Update',
      'Select New Location button opens folder picker and scans from new location',
      'Statistics preserved by name/filename matching at new location',
    ]
  },
  {
    version: '1.17.0',
    date: '2026-03-22',
    tag: 'minor',
    features: [
      'New modern, sleek application logo added',
      'Song right-click context menu applied to Artists and Folders tracklists',
      'Mini Player: "Lyrics Bar" mode added (narrow, text-only)',
      'Mini Player: "Lyrics Square" mode added (flowing layout)',
      'Mini Player: Font size and color customization added for Lyrics Square mode',
    ]
  },
  {
    version: '1.18.0',
    date: '2026-03-22',
    tag: 'minor',
    features: [
      'Massive Statistics upgrade with zero CPU/GPU overhead (pure SQLite aggregations)',
      '"Listening Insights" banner added to Statistics page',
      '"Longest Continuous Session" tracking (start time, duration, and song count)',
      '"Listening Streaks" tracking (current/max consecutive days played)',
      '"Record Day" tracking (shows the single day with most songs played)',
      '"Top Albums" ranking section added below top artists/songs',
      '"Unplayed Ratio" card showing percentage of library never played',
      '"Playlist Stats" added (total playlists, sizes, and largest playlist in library)',
      '"Song Language Distribution" heuristic (Turkish vs Global) added',
    ]
  },
  {
    version: '1.18.3',
    date: '2026-03-22',
    tag: 'patch',
    features: [
      'Mini Player: Quick Mode Selection menu added (dropdown list)',
      'Mini Player: Added glow effects and auto-scrolling synchronization to lyrics modes',
      'Mini Player: Active lyric line now centered and scaled for better visibility',
      'Mini Player: Shared font and color settings for all lyrics modes',
    ]
  },
]

const TAG_COLORS: Record<string, string> = {
  major: '#F43F5E',
  minor: '#8B5CF6',
  patch: '#10B981',
}

const TAG_LABELS: Record<string, string> = {
  major: 'Major',
  minor: 'Minor',
  patch: 'Patch',
}

export function VersionsView(): JSX.Element {
  const latest = VERSIONS[VERSIONS.length - 1]
  const totalFeatures = VERSIONS.reduce((sum, v) => sum + v.features.length, 0)

  return (
    <div className="ver-view">
      <div className="ver-hero">
        <div className="ver-hero-icon">
          <GitBranch size={28} />
        </div>
        <div>
          <h1 className="ver-hero-title">Version History</h1>
          <p className="ver-hero-sub">
            {VERSIONS.length} versions &middot; {totalFeatures} features &middot; Latest: <strong>v{latest.version}</strong>
          </p>
        </div>
      </div>

      <div className="ver-timeline">
        {[...VERSIONS].reverse().map((entry, i) => (
          <div key={entry.version} className={`ver-entry${i === 0 ? ' latest' : ''}`}>
            <div className="ver-entry-dot" />
            <div className="ver-entry-card">
              <div className="ver-entry-header">
                <span className="ver-entry-version">v{entry.version}</span>
                <span
                  className="ver-entry-tag"
                  style={{ background: TAG_COLORS[entry.tag] }}
                >
                  {TAG_LABELS[entry.tag]}
                </span>
                <span className="ver-entry-date">{entry.date}</span>
                {i === 0 && (
                  <span className="ver-entry-latest">
                    <Sparkles size={12} /> Latest
                  </span>
                )}
              </div>
              <ul className="ver-entry-features">
                {entry.features.map((f, fi) => (
                  <li key={fi}>
                    <CheckCircle size={13} className="ver-check" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
