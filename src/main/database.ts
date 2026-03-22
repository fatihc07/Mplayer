import initSqlJs, { Database } from 'sql.js'
import { app } from 'electron'
import { join, sep, dirname, basename, extname } from 'path'
import fs from 'fs'

let db: Database | null = null
const DB_PATH = join(app.getPath('userData'), 'mplayer.db')

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  const wasmPath = app.isPackaged
    ? join(process.resourcesPath, 'sql-wasm.wasm')
    : join(app.getAppPath(), 'node_modules/sql.js/dist/sql-wasm.wasm')

  const SQL = await initSqlJs({ locateFile: () => wasmPath })

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH))
  } else {
    db = new SQL.Database()
  }

  createTables()
  persist()
}

export function persist(): void {
  if (!db) return
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()))
}

function getDb(): Database {
  if (!db) throw new Error('Database not initialised')
  return db
}

// ─── Schema ───────────────────────────────────────────────────────────────────

function createTables(): void {
  const d = getDb()

  d.run(`
    CREATE TABLE IF NOT EXISTS songs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      path         TEXT UNIQUE NOT NULL,
      title        TEXT,
      artist       TEXT,
      album        TEXT,
      album_artist TEXT,
      duration     REAL    DEFAULT 0,
      year         INTEGER,
      genre        TEXT,
      track_number INTEGER,
      has_cover    INTEGER DEFAULT 0,
      file_size    INTEGER DEFAULT 0,
      date_added   INTEGER DEFAULT 0,
      play_count   INTEGER DEFAULT 0,
      last_played  INTEGER,
      rating       INTEGER DEFAULT 0
    )`)

  d.run(`CREATE INDEX IF NOT EXISTS idx_artist      ON songs(artist)`)
  d.run(`CREATE INDEX IF NOT EXISTS idx_album       ON songs(album)`)
  d.run(`CREATE INDEX IF NOT EXISTS idx_title       ON songs(title COLLATE NOCASE)`)
  d.run(`CREATE INDEX IF NOT EXISTS idx_play_count  ON songs(play_count DESC)`)
  d.run(`CREATE INDEX IF NOT EXISTS idx_last_played ON songs(last_played DESC)`)

  // Migrations: add columns that may not exist in older DB files
  try { d.run(`ALTER TABLE songs ADD COLUMN is_favorite INTEGER DEFAULT 0`) } catch (_) {}
  try { d.run(`ALTER TABLE songs ADD COLUMN bitrate INTEGER DEFAULT 0`) } catch (_) {}

  // Index for is_favorite (safe to add after migration)
  try { d.run(`CREATE INDEX IF NOT EXISTS idx_is_favorite ON songs(is_favorite)`) } catch (_) {}

  d.run(`
    CREATE TABLE IF NOT EXISTS play_history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id   INTEGER NOT NULL,
      played_at INTEGER NOT NULL,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    )`)

  d.run(`
    CREATE TABLE IF NOT EXISTS library_folders (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      path     TEXT UNIQUE NOT NULL,
      added_at INTEGER DEFAULT 0
    )`)

  d.run(`
    CREATE TABLE IF NOT EXISTS favorite_artists (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT UNIQUE NOT NULL,
      added_at   INTEGER DEFAULT 0
    )`)

  d.run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover_path  TEXT,
      created_at  INTEGER DEFAULT 0,
      updated_at  INTEGER DEFAULT 0
    )`)

  d.run(`
    CREATE TABLE IF NOT EXISTS playlist_songs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      song_id     INTEGER NOT NULL,
      position    INTEGER DEFAULT 0,
      added_at    INTEGER DEFAULT 0,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
      UNIQUE(playlist_id, song_id)
    )`)

  d.run(`CREATE INDEX IF NOT EXISTS idx_ps_playlist ON playlist_songs(playlist_id)`)

  d.run(`
    CREATE TABLE IF NOT EXISTS lyrics_cache (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id  INTEGER UNIQUE NOT NULL,
      lrc_text TEXT NOT NULL,
      source   TEXT DEFAULT 'lrclib',
      saved_at INTEGER DEFAULT 0,
      offset_ms INTEGER DEFAULT 0,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    )`)
  d.run(`CREATE INDEX IF NOT EXISTS idx_ps_song     ON playlist_songs(song_id)`)

  d.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`)

  // Migration: add offset_ms column if missing
  try {
    d.run(`ALTER TABLE lyrics_cache ADD COLUMN offset_ms INTEGER DEFAULT 0`)
  } catch { /* column already exists */ }
}

// ─── Song CRUD ────────────────────────────────────────────────────────────────

export interface SongInsert {
  path: string
  title?: string
  artist?: string
  album?: string
  albumArtist?: string
  duration?: number
  year?: number | null
  genre?: string | null
  trackNumber?: number | null
  hasCover?: boolean
  fileSize?: number
  bitrate?: number
}

export interface SongRow {
  id: number
  path: string
  title: string
  artist: string
  album: string
  album_artist: string
  duration: number
  year: number | null
  genre: string | null
  track_number: number | null
  has_cover: number
  file_size: number
  date_added: number
  play_count: number
  last_played: number | null
  rating: number
  is_favorite: number
  bitrate: number
}

export interface ArtistRow {
  name: string
  song_count: number
  total_plays: number
  cover_path: string | null
}

export interface AlbumRow {
  name: string
  artist: string
  song_count: number
  year: number | null
  cover_path: string | null
  format: string | null
}

export interface StatsRow {
  total_songs: number
  total_plays: number
  total_artists: number
  total_albums: number
}

// Format quality tiers — higher number = better quality
const FORMAT_TIER: Record<string, number> = {
  flac: 3, wav: 3, ape: 3, aiff: 3,
  m4a: 2, aac: 2, ogg: 2, opus: 2,
  mp3: 1, wma: 1, mp2: 1
}

function getFormatTier(filePath: string): number {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return FORMAT_TIER[ext] ?? 0
}

export function insertSong(song: SongInsert): void {
  const db = getDb()

  // Check if a song with the same title + artist + album already exists
  const stmt = db.prepare(
    `SELECT id, path FROM songs
     WHERE lower(title) = lower(?) AND lower(artist) = lower(?) AND lower(album) = lower(?)`
  )
  stmt.bind([
    song.title || 'Unknown Title',
    song.artist || 'Unknown Artist',
    song.album || 'Unknown Album'
  ])

  let existingId: number | null = null
  let existingPath: string | null = null
  if (stmt.step()) {
    const row = stmt.getAsObject() as any
    existingId = row.id as number
    existingPath = row.path as string
  }
  stmt.free()

  // ── Stem-based fallback: find any record in the same folder with the same filename stem ──
  // This runs BEFORE the tag-match check so that e.g. git.flac can absorb stats from git.mp3
  // even when the FLAC has already been inserted as a separate zero-stats record.
  {
    const dir = dirname(song.path)
    const songExt = extname(song.path).toLowerCase().slice(1)
    const songStem = basename(song.path, extname(song.path)).toLowerCase()
    const songNewTier = FORMAT_TIER[songExt] ?? 0
    const dirSongs = getSongsFromFolder(dir)

    // Find candidates: same stem, different path, lower audio tier (i.e. this file is an upgrade)
    const upgradeCandidates = dirSongs.filter((c) => {
      if (c.path === song.path) return false
      const cStem = basename(c.path, extname(c.path)).toLowerCase()
      return cStem === songStem && getFormatTier(c.path) < songNewTier
    })

    if (upgradeCandidates.length > 0) {
      // Pick the candidate with the highest play_count to preserve stats
      const stmtStats = db.prepare(
        `SELECT id FROM songs WHERE id IN (${upgradeCandidates.map(() => '?').join(',')}) ORDER BY play_count DESC LIMIT 1`
      )
      stmtStats.bind(upgradeCandidates.map((c) => c.id))
      let bestId: number | null = null
      if (stmtStats.step()) {
        const row = stmtStats.getAsObject() as any
        bestId = row.id as number
      }
      stmtStats.free()

      // Also check if the new FLAC path is already in DB (zero-stats duplicate) — if so, delete it first
      const existingFlacStmt = db.prepare(`SELECT id FROM songs WHERE path = ?`)
      existingFlacStmt.bind([song.path])
      let existingFlacId: number | null = null
      if (existingFlacStmt.step()) existingFlacId = (existingFlacStmt.getAsObject() as any).id as number
      existingFlacStmt.free()

      if (existingFlacId !== null && existingFlacId !== bestId) {
        // Remove the zero-stats FLAC duplicate so we can reuse the old record's ID
        db.run(`DELETE FROM play_history WHERE song_id = ?`, [existingFlacId])
        db.run(`DELETE FROM songs WHERE id = ?`, [existingFlacId])
      }

      if (bestId !== null) {
        // Upgrade the best candidate: point its path to the new FLAC, update all metadata, keep stats
        db.run(
          `UPDATE songs SET path=?, title=?, artist=?, album=?, album_artist=?, duration=?, year=?, genre=?, track_number=?, has_cover=?, file_size=?, bitrate=? WHERE id=?`,
          [
            song.path,
            song.title || 'Unknown Title',
            song.artist || 'Unknown Artist',
            song.album || 'Unknown Album',
            song.albumArtist || song.artist || 'Unknown Artist',
            song.duration ?? 0,
            song.year ?? null,
            song.genre ?? null,
            song.trackNumber ?? null,
            song.hasCover ? 1 : 0,
            song.fileSize ?? 0,
            song.bitrate ?? 0,
            bestId
          ]
        )
        // Remove other lower-quality duplicates (if more than one candidate)
        for (const c of upgradeCandidates) {
          if (c.id !== bestId) {
            db.run(`DELETE FROM play_history WHERE song_id = ?`, [c.id])
            db.run(`DELETE FROM songs WHERE id = ?`, [c.id])
          }
        }
        return
      }
    }

    // If the exact FLAC path already exists in DB and no upgrade candidate was found — nothing to do
    const exactStmt = db.prepare(`SELECT id FROM songs WHERE path = ?`)
    exactStmt.bind([song.path])
    const alreadyExists = exactStmt.step()
    exactStmt.free()
    if (alreadyExists) return
  }

  if (existingId !== null && existingPath !== null) {
    const newTier = getFormatTier(song.path)
    const oldTier = getFormatTier(existingPath)

    if (newTier > oldTier) {
      // Tag-match upgrade: update path + technical fields, preserve all stats
      db.run(
        `UPDATE songs SET path=?, bitrate=?, file_size=?, has_cover=? WHERE id=?`,
        [song.path, song.bitrate ?? 0, song.fileSize ?? 0, song.hasCover ? 1 : 0, existingId]
      )
    }
    // If same or lower quality — leave existing record untouched
    return
  }

  // No match — insert as new song
  db.run(
    `INSERT OR IGNORE INTO songs
       (path,title,artist,album,album_artist,duration,year,genre,track_number,has_cover,file_size,date_added,bitrate)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      song.path,
      song.title || 'Unknown Title',
      song.artist || 'Unknown Artist',
      song.album || 'Unknown Album',
      song.albumArtist || song.artist || 'Unknown Artist',
      song.duration ?? 0,
      song.year ?? null,
      song.genre ?? null,
      song.trackNumber ?? null,
      song.hasCover ? 1 : 0,
      song.fileSize ?? 0,
      Date.now(),
      song.bitrate ?? 0
    ]
  )
}

export function getSongs(limit = 100, offset = 0, search?: string): SongRow[] {
  const d = getDb()
  const params: (string | number)[] = []

  let sql = `SELECT * FROM songs`
  if (search?.trim()) {
    sql += ` WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?`
    const s = `%${search.trim()}%`
    params.push(s, s, s)
  }
  sql += ` ORDER BY title COLLATE NOCASE LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const stmt = d.prepare(sql)
  stmt.bind(params)
  const rows: SongRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as SongRow)
  stmt.free()
  return rows
}

export function getTotalSongs(search?: string): number {
  const d = getDb()
  const params: string[] = []

  let sql = `SELECT COUNT(*) as c FROM songs`
  if (search?.trim()) {
    sql += ` WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?`
    const s = `%${search.trim()}%`
    params.push(s, s, s)
  }
  const stmt = d.prepare(sql)
  stmt.bind(params)
  let c = 0
  if (stmt.step()) c = (stmt.getAsObject() as any).c as number
  stmt.free()
  return c
}

export function getTrendingSongs(limit = 20): SongRow[] {
  const stmt = getDb().prepare(
    `SELECT * FROM songs WHERE play_count > 0 ORDER BY play_count DESC, last_played DESC LIMIT ?`
  )
  stmt.bind([limit])
  const rows: SongRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as SongRow)
  stmt.free()
  return rows
}

export function getRecentSongs(limit = 20): SongRow[] {
  const stmt = getDb().prepare(
    `SELECT * FROM songs ORDER BY date_added DESC LIMIT ?`
  )
  stmt.bind([limit])
  const rows: SongRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as SongRow)
  stmt.free()
  return rows
}

export function getArtists(): ArtistRow[] {
  const stmt = getDb().prepare(`
    SELECT
      artist as name,
      COUNT(*) as song_count,
      COALESCE(SUM(play_count),0) as total_plays,
      (SELECT path FROM songs s2
       WHERE s2.artist = songs.artist AND s2.has_cover = 1
       LIMIT 1) as cover_path
    FROM songs
    WHERE artist IS NOT NULL AND artist != 'Unknown Artist'
    GROUP BY artist
    ORDER BY total_plays DESC, song_count DESC
  `)
  const rows: ArtistRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as ArtistRow)
  stmt.free()
  return rows
}

export function getAlbums(): AlbumRow[] {
  const stmt = getDb().prepare(`
    SELECT
      album as name,
      artist,
      COUNT(*) as song_count,
      MAX(year) as year,
      (SELECT path FROM songs s2
       WHERE s2.album = songs.album AND s2.artist = songs.artist AND s2.has_cover = 1
       LIMIT 1) as cover_path,
      CASE
        WHEN COUNT(*) = SUM(CASE WHEN LOWER(path) LIKE '%.flac' THEN 1 ELSE 0 END) THEN 'FLAC'
        WHEN COUNT(*) = SUM(CASE WHEN LOWER(path) LIKE '%.mp3' THEN 1 ELSE 0 END) THEN 'MP3'
        ELSE NULL
      END as format
    FROM songs
    WHERE album IS NOT NULL AND album != 'Unknown Album'
    GROUP BY album, artist
    ORDER BY name COLLATE NOCASE
  `)
  const rows: AlbumRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as AlbumRow)
  stmt.free()
  return rows
}

export function recordPlay(songId: number): void {
  const now = Date.now()
  getDb().run(
    `UPDATE songs SET play_count = play_count + 1, last_played = ? WHERE id = ?`,
    [now, songId]
  )
  getDb().run(
    `INSERT INTO play_history (song_id, played_at) VALUES (?,?)`,
    [songId, now]
  )
  persist()
}

export interface HistoryRow {
  history_id: number
  played_at: number
  song_id: number
  title: string
  artist: string
  album: string
  has_cover: number
  path: string
  duration: number
  play_count: number
}

export function getHistory(limit = 100, offset = 0): HistoryRow[] {
  const stmt = getDb().prepare(`
    SELECT
      MIN(ph.id)        AS history_id,
      MAX(ph.played_at) AS played_at,
      s.id              AS song_id,
      s.title           AS title,
      s.artist          AS artist,
      s.album           AS album,
      s.has_cover       AS has_cover,
      s.path            AS path,
      s.duration        AS duration,
      s.play_count      AS play_count,
      s.is_favorite     AS is_favorite,
      COUNT(*)          AS day_count
    FROM play_history ph
    JOIN songs s ON s.id = ph.song_id
    GROUP BY s.id, date(ph.played_at / 1000, 'unixepoch', 'localtime')
    ORDER BY MAX(ph.played_at) DESC
    LIMIT ? OFFSET ?
  `)
  stmt.bind([limit, offset])
  const rows: HistoryRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as HistoryRow)
  stmt.free()
  return rows
}

export function getTotalHistory(): number {
  const stmt = getDb().prepare(`SELECT COUNT(*) as c FROM (SELECT 1 FROM play_history GROUP BY song_id, date(played_at / 1000, 'unixepoch', 'localtime'))`)
  let c = 0
  if (stmt.step()) c = (stmt.getAsObject() as any).c as number
  stmt.free()
  return c
}

export function resetAllPlays(): void {
  getDb().run(`UPDATE songs SET play_count = 0, last_played = NULL`)
  getDb().run(`DELETE FROM play_history`)
  persist()
}

export function toggleFavorite(songId: number): void {
  getDb().run(
    `UPDATE songs SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?`,
    [songId]
  )
  persist()
}

export function getFavorites(limit = 100, offset = 0): SongRow[] {
  const stmt = getDb().prepare(
    `SELECT * FROM songs WHERE is_favorite = 1 ORDER BY title COLLATE NOCASE LIMIT ? OFFSET ?`
  )
  stmt.bind([limit, offset])
  const rows: SongRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as SongRow)
  stmt.free()
  return rows
}

export function getTotalFavorites(): number {
  const stmt = getDb().prepare(`SELECT COUNT(*) as c FROM songs WHERE is_favorite = 1`)
  let c = 0
  if (stmt.step()) c = (stmt.getAsObject() as any).c as number
  stmt.free()
  return c
}

export function deleteHistoryEntry(songId: number, playedAt: number): void {
  const dayStr = new Date(playedAt).toISOString().slice(0, 10)
  getDb().run(
    `DELETE FROM play_history WHERE song_id = ? AND date(played_at / 1000, 'unixepoch', 'localtime') = ?`,
    [songId, dayStr]
  )
  persist()
}

export function deleteArtist(artistName: string): void {
  const db = getDb()
  // delete history entries for this artist's songs first
  db.run(`DELETE FROM play_history WHERE song_id IN (SELECT id FROM songs WHERE artist = ? OR album_artist = ?)`, [artistName, artistName])
  // delete the songs
  db.run(`DELETE FROM songs WHERE artist = ? OR album_artist = ?`, [artistName, artistName])
  persist()
}

export interface SearchResult {
  songs: SongRow[]
  artists: ArtistRow[]
  albums: AlbumRow[]
}

export function searchAll(query: string, limit = 5): SearchResult {
  const q = `%${query.trim()}%`
  const d = getDb()

  const songStmt = d.prepare(
    `SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? ORDER BY play_count DESC LIMIT ?`
  )
  songStmt.bind([q, q, q, limit])
  const songs: SongRow[] = []
  while (songStmt.step()) songs.push(songStmt.getAsObject() as unknown as SongRow)
  songStmt.free()

  const artistStmt = d.prepare(`
    SELECT
      artist as name,
      COUNT(*) as song_count,
      COALESCE(SUM(play_count),0) as total_plays,
      (SELECT path FROM songs s2 WHERE s2.artist = songs.artist AND s2.has_cover = 1 LIMIT 1) as cover_path
    FROM songs
    WHERE artist LIKE ?
    GROUP BY artist
    LIMIT ?
  `)
  artistStmt.bind([q, limit])
  const artists: ArtistRow[] = []
  while (artistStmt.step()) artists.push(artistStmt.getAsObject() as unknown as ArtistRow)
  artistStmt.free()

  const albumStmt = d.prepare(`
    SELECT
      album as name,
      artist,
      COUNT(*) as song_count,
      MAX(year) as year,
      (SELECT path FROM songs s2 WHERE s2.album = songs.album AND s2.artist = songs.artist AND s2.has_cover = 1 LIMIT 1) as cover_path
    FROM songs
    WHERE album LIKE ? OR artist LIKE ?
    GROUP BY album, artist
    LIMIT ?
  `)
  albumStmt.bind([q, q, limit])
  const albums: AlbumRow[] = []
  while (albumStmt.step()) albums.push(albumStmt.getAsObject() as unknown as AlbumRow)
  albumStmt.free()

  return { songs, artists, albums }
}

export function getSongById(id: number): SongRow | null {
  const stmt = getDb().prepare(`SELECT * FROM songs WHERE id = ?`)
  stmt.bind([id])
  let row: SongRow | null = null
  if (stmt.step()) row = stmt.getAsObject() as unknown as SongRow
  stmt.free()
  return row
}

// ─── Library Folders ─────────────────────────────────────────────────────────

export function getLibraryFolders(): string[] {
  const stmt = getDb().prepare(`SELECT path FROM library_folders ORDER BY added_at`)
  const paths: string[] = []
  while (stmt.step()) paths.push((stmt.getAsObject() as any).path as string)
  stmt.free()
  return paths
}

export function addLibraryFolder(folderPath: string): void {
  getDb().run(
    `INSERT OR IGNORE INTO library_folders (path, added_at) VALUES (?,?)`,
    [folderPath, Date.now()]
  )
  persist()
}

export function getLibraryFolderRows(): Array<{ path: string; added_at: number }> {
  const stmt = getDb().prepare(`SELECT path, added_at FROM library_folders ORDER BY added_at`)
  const rows: Array<{ path: string; added_at: number }> = []
  while (stmt.step()) rows.push(stmt.getAsObject() as any)
  stmt.free()
  return rows
}

export function getSongCountForFolder(folderPath: string): number {
  const prefix = folderPath.replace(/[\/\\]+$/, '') + sep + '%'
  const stmt = getDb().prepare(`SELECT COUNT(*) as c FROM songs WHERE path LIKE ?`)
  stmt.bind([prefix])
  let c = 0
  if (stmt.step()) c = (stmt.getAsObject() as any).c as number
  stmt.free()
  return c
}

export function getSongsFromFolder(folderPath: string): Array<{ id: number; path: string }> {
  const prefix = folderPath.replace(/[\/\\]+$/, '') + sep + '%'
  const stmt = getDb().prepare(`SELECT id, path FROM songs WHERE path LIKE ?`)
  stmt.bind([prefix])
  const rows: Array<{ id: number; path: string }> = []
  while (stmt.step()) rows.push(stmt.getAsObject() as any)
  stmt.free()
  return rows
}

export function getSongsInFolder(folderPath: string): SongRow[] {
  const prefix = folderPath.replace(/[\/\\]+$/, '') + sep + '%'
  const stmt = getDb().prepare(`SELECT * FROM songs WHERE path LIKE ? ORDER BY title COLLATE NOCASE`)
  stmt.bind([prefix])
  const rows: SongRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as SongRow)
  stmt.free()
  return rows
}

export function removeSong(songId: number): void {
  const db = getDb()
  db.run(`DELETE FROM play_history WHERE song_id = ?`, [songId])
  db.run(`DELETE FROM songs WHERE id = ?`, [songId])
}

export function removeSongsFromFolder(folderPath: string): void {
  const db = getDb()
  const prefix = folderPath.replace(/[\/\\]+$/, '') + sep + '%'
  db.run(`DELETE FROM play_history WHERE song_id IN (SELECT id FROM songs WHERE path LIKE ?)`, [prefix])
  db.run(`DELETE FROM songs WHERE path LIKE ?`, [prefix])
  persist()
}

export function removeLibraryFolder(folderPath: string): void {
  getDb().run(`DELETE FROM library_folders WHERE path = ?`, [folderPath])
  persist()
}

export function getArtistSongRecords(artistName: string): Array<{ id: number; path: string }> {
  const stmt = getDb().prepare(
    `SELECT id, path FROM songs WHERE lower(artist) = lower(?) OR lower(album_artist) = lower(?)`
  )
  stmt.bind([artistName, artistName])
  const rows: Array<{ id: number; path: string }> = []
  while (stmt.step()) rows.push(stmt.getAsObject() as any)
  stmt.free()
  return rows
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getStats(): StatsRow {
  const stmt = getDb().prepare(`
    SELECT
      COUNT(*)                    as total_songs,
      COALESCE(SUM(play_count),0) as total_plays,
      COUNT(DISTINCT artist)      as total_artists,
      COUNT(DISTINCT album)       as total_albums
    FROM songs
  `)
  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as StatsRow
    stmt.free()
    return row
  }
  stmt.free()
  return { total_songs: 0, total_plays: 0, total_artists: 0, total_albums: 0 }
}

export interface DetailedStats {
  total_songs: number
  total_albums: number
  total_artists: number
  total_plays: number
  total_duration: number
  total_listened_duration: number
  avg_year: number | null
  avg_song_duration: number
  avg_bitrate: number
  top_genres: Array<{ genre: string; count: number }>
  top_artists: Array<{ name: string; plays: number; song_count: number }>
  top_songs: Array<{ title: string; artist: string; play_count: number; path: string; has_cover: number }>
  hourly_plays: Array<{ hour: number; count: number }>
  daily_plays: Array<{ day: number; count: number }>
  monthly_plays: Array<{ month: string; count: number }>
  year_distribution: Array<{ year: number; count: number }>
  oldest_song: { title: string; artist: string; year: number } | null
  newest_song: { title: string; artist: string; year: number } | null
  total_favorites: number
  total_file_size: number
  recently_added_count_30d: number
  format_distribution: Array<{ format: string; count: number }>
  db_file_size: number
  total_lyrics: number
  longest_session: {
    start_time: number
    duration_sec: number
    song_count: number
  } | null
  current_streak: number
  max_streak: number
  record_day: { date: string; count: number } | null
  top_albums_played: Array<{ album: string; artist: string; total_plays: number }>
  unplayed_songs: number
  playlist_stats: {
    total_playlists: number
    total_playlist_songs: number
    biggest_playlist: { name: string; count: number } | null
  }
  language_stats: { turkish: number; global: number }
}

export function getDetailedStats(): DetailedStats {
  const d = getDb()

  // Basic counts
  const basicStmt = d.prepare(`
    SELECT
      COUNT(*) as total_songs,
      COUNT(DISTINCT album) as total_albums,
      COUNT(DISTINCT artist) as total_artists,
      COALESCE(SUM(play_count), 0) as total_plays,
      COALESCE(SUM(duration), 0) as total_duration,
      AVG(CASE WHEN year > 0 THEN year ELSE NULL END) as avg_year,
      AVG(CASE WHEN duration > 0 THEN duration ELSE NULL END) as avg_song_duration,
      AVG(CASE WHEN bitrate > 0 THEN bitrate ELSE NULL END) as avg_bitrate,
      SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as total_favorites,
      COALESCE(SUM(file_size), 0) as total_file_size
    FROM songs
  `)
  basicStmt.step()
  const basic = basicStmt.getAsObject() as any
  basicStmt.free()

  // Total listened duration (play_count * duration for each song)
  const listenedStmt = d.prepare(`SELECT COALESCE(SUM(play_count * duration), 0) as total FROM songs`)
  listenedStmt.step()
  const totalListened = (listenedStmt.getAsObject() as any).total ?? 0
  listenedStmt.free()

  // Recently added (last 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recentStmt = d.prepare(`SELECT COUNT(*) as c FROM songs WHERE date_added > ?`)
  recentStmt.bind([thirtyDaysAgo])
  recentStmt.step()
  const recentCount = (recentStmt.getAsObject() as any).c ?? 0
  recentStmt.free()

  // Top genres
  const genreStmt = d.prepare(`
    SELECT genre, COUNT(*) as count FROM songs
    WHERE genre IS NOT NULL AND genre != ''
    GROUP BY genre ORDER BY count DESC LIMIT 10
  `)
  const topGenres: Array<{ genre: string; count: number }> = []
  while (genreStmt.step()) topGenres.push(genreStmt.getAsObject() as any)
  genreStmt.free()

  // Top artists by play count
  const artistStmt = d.prepare(`
    SELECT artist as name, SUM(play_count) as plays, COUNT(*) as song_count
    FROM songs WHERE play_count > 0
    GROUP BY artist ORDER BY plays DESC LIMIT 10
  `)
  const topArtists: Array<{ name: string; plays: number; song_count: number }> = []
  while (artistStmt.step()) topArtists.push(artistStmt.getAsObject() as any)
  artistStmt.free()

  // Top songs
  const songStmt = d.prepare(`
    SELECT title, artist, play_count, path, has_cover
    FROM songs WHERE play_count > 0
    ORDER BY play_count DESC LIMIT 10
  `)
  const topSongs: Array<{ title: string; artist: string; play_count: number; path: string; has_cover: number }> = []
  while (songStmt.step()) topSongs.push(songStmt.getAsObject() as any)
  songStmt.free()

  // Hourly play distribution (from play_history, played_at is ms epoch)
  const hourStmt = d.prepare(`SELECT played_at FROM play_history`)
  const hourlyCounts = new Array(24).fill(0)
  const dailyCounts = new Array(7).fill(0)
  const monthlyMap = new Map<string, number>()
  while (hourStmt.step()) {
    const ts = (hourStmt.getAsObject() as any).played_at
    const date = new Date(ts)
    hourlyCounts[date.getHours()]++
    dailyCounts[date.getDay()]++
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + 1)
  }
  hourStmt.free()

  const hourlyPlays = hourlyCounts.map((count, hour) => ({ hour, count }))
  const dailyPlays = dailyCounts.map((count, day) => ({ day, count }))

  // Monthly plays (last 12 months)
  const monthlyPlays = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => ({ month, count }))

  // Year distribution
  const yearStmt = d.prepare(`
    SELECT year, COUNT(*) as count FROM songs
    WHERE year IS NOT NULL AND year > 0
    GROUP BY year ORDER BY year
  `)
  const yearDistribution: Array<{ year: number; count: number }> = []
  while (yearStmt.step()) yearDistribution.push(yearStmt.getAsObject() as any)
  yearStmt.free()

  // Oldest and newest songs by year
  let oldestSong: { title: string; artist: string; year: number } | null = null
  const oldStmt = d.prepare(`SELECT title, artist, year FROM songs WHERE year > 0 ORDER BY year ASC LIMIT 1`)
  if (oldStmt.step()) oldestSong = oldStmt.getAsObject() as any
  oldStmt.free()

  let newestSong: { title: string; artist: string; year: number } | null = null
  const newStmt = d.prepare(`SELECT title, artist, year FROM songs WHERE year > 0 ORDER BY year DESC LIMIT 1`)
  if (newStmt.step()) newestSong = newStmt.getAsObject() as any
  newStmt.free()

  // Format distribution (by file extension)
  const allPathsStmt = d.prepare(`SELECT path FROM songs`)
  const extMap = new Map<string, number>()
  while (allPathsStmt.step()) {
    const p = (allPathsStmt.getAsObject() as any).path as string
    const dotIdx = p.lastIndexOf('.')
    if (dotIdx > 0) {
      const ext = p.substring(dotIdx + 1).toUpperCase()
      extMap.set(ext, (extMap.get(ext) ?? 0) + 1)
    }
  }
  allPathsStmt.free()
  const formatDistribution = Array.from(extMap.entries())
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count)

  // Lyrics count
  const lyricsStmt = d.prepare(`SELECT COUNT(*) as c FROM lyrics_cache`)
  lyricsStmt.step()
  const totalLyrics = (lyricsStmt.getAsObject() as any).c ?? 0
  lyricsStmt.free()

  // Database file size
  let dbFileSize = 0
  try {
    if (fs.existsSync(DB_PATH)) {
      dbFileSize = fs.statSync(DB_PATH).size
    }
  } catch { /* ignore */ }

  // --- Longest Session Calculation ---
  const sessionStmt = d.prepare(`
    SELECT ph.played_at, s.duration 
    FROM play_history ph 
    JOIN songs s ON s.id = ph.song_id 
    ORDER BY ph.played_at ASC
  `)
  let maxSessionDuration = 0
  let maxSessionSongs = 0
  let maxSessionStart = 0

  let currentSessionDuration = 0
  let currentSessionSongs = 0
  let currentSessionStart = 0
  let lastPlayedAt = 0
  let lastDuration = 0

  while (sessionStmt.step()) {
    const row = sessionStmt.getAsObject() as any
    const playedAt = row.played_at as number
    const duration = (row.duration as number) || 0

    if (currentSessionSongs === 0) {
      currentSessionStart = playedAt
      currentSessionSongs = 1
      currentSessionDuration = duration
      lastPlayedAt = playedAt
      lastDuration = duration
    } else {
      const gap = playedAt - lastPlayedAt
      // Maximum allowed gap: previous song duration + 15 mins (900000ms)
      const maxAllowedGap = (lastDuration * 1000) + 900000

      if (gap <= maxAllowedGap) {
        currentSessionSongs += 1
        currentSessionDuration += duration
      } else {
        // Session broken
        if (currentSessionDuration > maxSessionDuration) {
          maxSessionDuration = currentSessionDuration
          maxSessionSongs = currentSessionSongs
          maxSessionStart = currentSessionStart
        }
        // Start new session
        currentSessionStart = playedAt
        currentSessionSongs = 1
        currentSessionDuration = duration
      }
      lastPlayedAt = playedAt
      lastDuration = duration
    }
  }
  // Check the last session
  if (currentSessionDuration > maxSessionDuration) {
    maxSessionDuration = currentSessionDuration
    maxSessionSongs = currentSessionSongs
    maxSessionStart = currentSessionStart
  }
  sessionStmt.free()

  let longestSession: DetailedStats['longest_session'] = null
  if (maxSessionSongs > 1) {
    longestSession = {
      start_time: maxSessionStart,
      duration_sec: maxSessionDuration,
      song_count: maxSessionSongs
    }
  }

  // --- 1. Streaks ---
  const daysStmt = d.prepare(`SELECT DISTINCT date(played_at / 1000, 'unixepoch', 'localtime') as day FROM play_history ORDER BY day ASC`)
  const playedDays: string[] = []
  while(daysStmt.step()) playedDays.push((daysStmt.getAsObject() as any).day)
  daysStmt.free()
  
  let currentStreak = 0
  let maxStreak = 0
  if (playedDays.length > 0) {
    let tempStreak = 1
    maxStreak = 1
    for (let i = 1; i < playedDays.length; i++) {
      const d1 = new Date(playedDays[i-1])
      const d2 = new Date(playedDays[i])
      const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24))
      if (diffDays === 1) {
        tempStreak++
        maxStreak = Math.max(maxStreak, tempStreak)
      } else {
        tempStreak = 1
      }
    }
    // check if current streak is ongoing (played today or yesterday)
    const lastPlayedDay = new Date(playedDays[playedDays.length - 1])
    const today = new Date()
    const diffFromToday = Math.round((today.getTime() - lastPlayedDay.getTime()) / (1000 * 3600 * 24))
    if (diffFromToday <= 1) {
      currentStreak = tempStreak
    } else {
      currentStreak = 0 // broken
    }
  }

  // --- 4. Record Day ---
  const recordStmt = d.prepare(`SELECT date(played_at / 1000, 'unixepoch', 'localtime') as date, COUNT(*) as c FROM play_history GROUP BY date ORDER BY c DESC LIMIT 1`)
  let recordDay = null
  if (recordStmt.step()) recordDay = recordStmt.getAsObject() as any
  recordStmt.free()

  // --- 5. Top Albums ---
  const topAlbumsStmt = d.prepare(`
    SELECT album, artist, SUM(play_count) as total_plays 
    FROM songs WHERE play_count > 0 AND album IS NOT NULL AND album != 'Unknown Album' 
    GROUP BY album, artist ORDER BY total_plays DESC LIMIT 10
  `)
  const topAlbumsPlayed: Array<{ album: string; artist: string; total_plays: number }> = []
  while(topAlbumsStmt.step()) topAlbumsPlayed.push(topAlbumsStmt.getAsObject() as any)
  topAlbumsStmt.free()

  // --- 6. Unplayed Songs ---
  const unplayedStmt = d.prepare(`SELECT COUNT(*) as c FROM songs WHERE play_count = 0`)
  unplayedStmt.step()
  const unplayedSongs = (unplayedStmt.getAsObject() as any).c ?? 0
  unplayedStmt.free()

  // --- 8. Playlist Stats ---
  let totalPlaylists = 0
  let totalPlaylistSongs = 0
  let biggestPlaylist = null
  try {
    const plStmt = d.prepare(`SELECT COUNT(*) as c FROM playlists`)
    if(plStmt.step()) totalPlaylists = (plStmt.getAsObject() as any).c
    plStmt.free()

    const plsStmt = d.prepare(`SELECT COUNT(*) as c FROM playlist_songs`)
    if(plsStmt.step()) totalPlaylistSongs = (plsStmt.getAsObject() as any).c
    plsStmt.free()

    const bigPlStmt = d.prepare(`SELECT p.name, COUNT(ps.song_id) as count FROM playlists p JOIN playlist_songs ps ON p.id = ps.playlist_id GROUP BY p.id ORDER BY count DESC LIMIT 1`)
    if(bigPlStmt.step()) biggestPlaylist = bigPlStmt.getAsObject() as any
    bigPlStmt.free()
  } catch(e) {}

  // --- 9. Language Stats (Heuristic TR chars) ---
  const langStmt = d.prepare(`SELECT title, artist FROM songs`)
  let trCount = 0
  let glCount = 0
  const trRegex = /[şığçöüŞİĞÇÖÜ]/
  while(langStmt.step()) {
    const row = langStmt.getAsObject() as any
    const text = (row.title || '') + ' ' + (row.artist || '')
    if (trRegex.test(text)) trCount++
    else glCount++
  }
  langStmt.free()

  return {
    total_songs: basic.total_songs ?? 0,
    total_albums: basic.total_albums ?? 0,
    total_artists: basic.total_artists ?? 0,
    total_plays: basic.total_plays ?? 0,
    total_duration: basic.total_duration ?? 0,
    total_listened_duration: totalListened,
    avg_year: basic.avg_year ? Math.round(basic.avg_year) : null,
    avg_song_duration: basic.avg_song_duration ?? 0,
    avg_bitrate: basic.avg_bitrate ? Math.round(basic.avg_bitrate) : 0,
    top_genres: topGenres,
    top_artists: topArtists,
    top_songs: topSongs,
    hourly_plays: hourlyPlays,
    daily_plays: dailyPlays,
    monthly_plays: monthlyPlays,
    year_distribution: yearDistribution,
    oldest_song: oldestSong,
    newest_song: newestSong,
    total_favorites: basic.total_favorites ?? 0,
    total_file_size: basic.total_file_size ?? 0,
    recently_added_count_30d: recentCount,
    format_distribution: formatDistribution,
    db_file_size: dbFileSize,
    total_lyrics: totalLyrics,
    longest_session: longestSession,
    current_streak: currentStreak,
    max_streak: maxStreak,
    record_day: recordDay,
    top_albums_played: topAlbumsPlayed,
    unplayed_songs: unplayedSongs,
    playlist_stats: {
      total_playlists: totalPlaylists,
      total_playlist_songs: totalPlaylistSongs,
      biggest_playlist: biggestPlaylist
    },
    language_stats: { turkish: trCount, global: glCount }
  }
}

// ─── Favorite Artists ─────────────────────────────────────────────────────────

export function toggleFavoriteArtist(artistName: string): boolean {
  const db = getDb()
  const stmt = db.prepare(`SELECT id FROM favorite_artists WHERE name = ?`)
  stmt.bind([artistName])
  const exists = stmt.step()
  stmt.free()
  if (exists) {
    db.run(`DELETE FROM favorite_artists WHERE name = ?`, [artistName])
    persist()
    return false
  } else {
    db.run(`INSERT OR IGNORE INTO favorite_artists (name, added_at) VALUES (?,?)`, [artistName, Date.now()])
    persist()
    return true
  }
}

export function getFavoriteArtists(): ArtistRow[] {
  const stmt = getDb().prepare(`
    SELECT
      fa.name                                AS name,
      COUNT(s.id)                            AS song_count,
      COALESCE(SUM(s.play_count), 0)         AS total_plays,
      (SELECT path FROM songs s2 WHERE s2.artist = fa.name AND s2.has_cover = 1 LIMIT 1) AS cover_path
    FROM favorite_artists fa
    LEFT JOIN songs s ON s.artist = fa.name OR s.album_artist = fa.name
    GROUP BY fa.name
    ORDER BY fa.added_at DESC
  `)
  const rows: ArtistRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as ArtistRow)
  stmt.free()
  return rows
}

export function isArtistFavorite(artistName: string): boolean {
  const stmt = getDb().prepare(`SELECT id FROM favorite_artists WHERE name = ?`)
  stmt.bind([artistName])
  const exists = stmt.step()
  stmt.free()
  return exists
}

// ─── Playlists ────────────────────────────────────────────────────────────────

interface PlaylistRow {
  id: number
  name: string
  description: string
  cover_path: string | null
  created_at: number
  updated_at: number
  song_count: number
}

export function getPlaylists(): PlaylistRow[] {
  const stmt = getDb().prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS song_count
    FROM playlists p
    ORDER BY p.updated_at DESC
  `)
  const rows: PlaylistRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as PlaylistRow)
  stmt.free()
  return rows
}

export function getPlaylist(id: number): PlaylistRow | null {
  const stmt = getDb().prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS song_count
    FROM playlists p WHERE p.id = ?
  `)
  stmt.bind([id])
  const row = stmt.step() ? (stmt.getAsObject() as unknown as PlaylistRow) : null
  stmt.free()
  return row
}

export function createPlaylist(name: string, description = ''): number {
  const now = Date.now()
  getDb().run(
    `INSERT INTO playlists (name, description, created_at, updated_at) VALUES (?,?,?,?)`,
    [name, description, now, now]
  )
  const stmt = getDb().prepare(`SELECT last_insert_rowid() AS id`)
  stmt.step()
  const id = (stmt.getAsObject() as any).id as number
  stmt.free()
  persist()
  return id
}

export function updatePlaylist(id: number, name: string, description: string): void {
  getDb().run(
    `UPDATE playlists SET name = ?, description = ?, updated_at = ? WHERE id = ?`,
    [name, description, Date.now(), id]
  )
  persist()
}

export function deletePlaylist(id: number): void {
  getDb().run(`DELETE FROM playlist_songs WHERE playlist_id = ?`, [id])
  getDb().run(`DELETE FROM playlists WHERE id = ?`, [id])
  persist()
}

export function addSongToPlaylist(playlistId: number, songId: number): void {
  const db = getDb()
  // Get next position
  const ps = db.prepare(`SELECT COALESCE(MAX(position),0)+1 AS pos FROM playlist_songs WHERE playlist_id = ?`)
  ps.bind([playlistId])
  ps.step()
  const pos = (ps.getAsObject() as any).pos as number
  ps.free()
  db.run(
    `INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position, added_at) VALUES (?,?,?,?)`,
    [playlistId, songId, pos, Date.now()]
  )
  db.run(`UPDATE playlists SET updated_at = ? WHERE id = ?`, [Date.now(), playlistId])
  // Auto-set cover from first song if playlist has no cover
  const cv = db.prepare(`SELECT cover_path FROM playlists WHERE id = ? AND cover_path IS NOT NULL`)
  cv.bind([playlistId])
  const hasCover = cv.step()
  cv.free()
  if (!hasCover) {
    const sc = db.prepare(`SELECT s.path FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id WHERE ps.playlist_id = ? AND s.has_cover = 1 LIMIT 1`)
    sc.bind([playlistId])
    if (sc.step()) {
      const path = (sc.getAsObject() as any).path as string
      db.run(`UPDATE playlists SET cover_path = ? WHERE id = ?`, [path, playlistId])
    }
    sc.free()
  }
  persist()
}

export function removeSongFromPlaylist(playlistId: number, songId: number): void {
  getDb().run(`DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`, [playlistId, songId])
  getDb().run(`UPDATE playlists SET updated_at = ? WHERE id = ?`, [Date.now(), playlistId])
  persist()
}

export function getPlaylistSongs(playlistId: number): SongRow[] {
  const stmt = getDb().prepare(`
    SELECT s.* FROM playlist_songs ps
    JOIN songs s ON s.id = ps.song_id
    WHERE ps.playlist_id = ?
    ORDER BY ps.position ASC
  `)
  stmt.bind([playlistId])
  const rows: SongRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as SongRow)
  stmt.free()
  return rows
}

// ─── Smart Playlists ──────────────────────────────────────────────────────────

export function getSmartPlaylistSongs(type: string): SongRow[] {
  const db = getDb()
  let sql = ''
  switch (type) {
    case 'recent-50':
      // Last 50 played songs
      sql = `
        SELECT DISTINCT s.* FROM play_history ph
        JOIN songs s ON s.id = ph.song_id
        ORDER BY ph.played_at DESC
        LIMIT 50
      `
      break
    case 'not-played-3months':
      // Songs not played in 3 months (or never played)
      sql = `
        SELECT * FROM songs
        WHERE last_played IS NULL OR last_played < ${Date.now() - 90 * 24 * 60 * 60 * 1000}
        ORDER BY RANDOM()
        LIMIT 100
      `
      break
    case 'most-played':
      // Top 50 most played
      sql = `
        SELECT * FROM songs
        WHERE play_count > 0
        ORDER BY play_count DESC
        LIMIT 50
      `
      break
    case 'recently-added':
      // Last 50 added to library
      sql = `
        SELECT * FROM songs
        ORDER BY date_added DESC
        LIMIT 50
      `
      break
    case 'shortest':
      // Shortest 50 songs
      sql = `
        SELECT * FROM songs
        WHERE duration > 0
        ORDER BY duration ASC
        LIMIT 50
      `
      break
    case 'longest':
      // Longest 50 songs
      sql = `
        SELECT * FROM songs
        WHERE duration > 0
        ORDER BY duration DESC
        LIMIT 50
      `
      break
    case 'random-mix':
      sql = `SELECT * FROM songs ORDER BY RANDOM() LIMIT 50`
      break
    case 'high-quality':
      sql = `
        SELECT * FROM songs
        WHERE LOWER(path) LIKE '%.flac'
           OR LOWER(path) LIKE '%.wav'
           OR LOWER(path) LIKE '%.ape'
           OR LOWER(path) LIKE '%.aiff'
        ORDER BY play_count DESC
        LIMIT 100
      `
      break
    case 'forgotten-gems':
      sql = `
        SELECT * FROM songs
        WHERE play_count < 3
          AND date_added < ${Date.now() - 30 * 24 * 60 * 60 * 1000}
        ORDER BY RANDOM()
        LIMIT 50
      `
      break
    case 'one-hit-wonders':
      sql = `
        SELECT s.* FROM songs s
        JOIN (SELECT artist, COUNT(*) AS cnt FROM songs GROUP BY artist HAVING cnt = 1) a
        ON s.artist = a.artist
        ORDER BY s.play_count DESC
        LIMIT 50
      `
      break
    default:
      return []
  }
  const stmt = db.prepare(sql)
  const rows: SongRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as SongRow)
  stmt.free()
  return rows
}

// ─── Lyrics Cache ─────────────────────────────────────────────────────────────

export function getSavedLyrics(songId: number): string | null {
  const stmt = getDb().prepare(`SELECT lrc_text FROM lyrics_cache WHERE song_id = ?`)
  stmt.bind([songId])
  if (stmt.step()) {
    const row = stmt.getAsObject() as { lrc_text: string }
    stmt.free()
    return row.lrc_text
  }
  stmt.free()
  return null
}

export function saveLyrics(songId: number, lrcText: string, source: string): void {
  getDb().run(
    `INSERT OR REPLACE INTO lyrics_cache (song_id, lrc_text, source, saved_at) VALUES (?, ?, ?, ?)`,
    [songId, lrcText, source, Date.now()]
  )
  persist()
}

export function deleteLyrics(songId: number): void {
  getDb().run(`DELETE FROM lyrics_cache WHERE song_id = ?`, [songId])
  persist()
}

export function getLyricsOffset(songId: number): number {
  const stmt = getDb().prepare(`SELECT offset_ms FROM lyrics_cache WHERE song_id = ?`)
  stmt.bind([songId])
  let offset = 0
  if (stmt.step()) offset = (stmt.getAsObject() as any).offset_ms ?? 0
  stmt.free()
  return offset
}

export function saveLyricsOffset(songId: number, offsetMs: number): void {
  const db = getDb()
  // If no lyrics_cache row exists yet, create one with empty text
  const stmt = db.prepare(`SELECT id FROM lyrics_cache WHERE song_id = ?`)
  stmt.bind([songId])
  const exists = stmt.step()
  stmt.free()
  if (exists) {
    db.run(`UPDATE lyrics_cache SET offset_ms = ? WHERE song_id = ?`, [offsetMs, songId])
  } else {
    db.run(
      `INSERT INTO lyrics_cache (song_id, lrc_text, source, saved_at, offset_ms) VALUES (?, '', 'user', ?, ?)`,
      [songId, Date.now(), offsetMs]
    )
  }
  persist()
}

// ─── Update Song Metadata (DB only, no file modification) ─────────────────────

export function setSongHasCover(songId: number, hasCover: boolean): void {
  getDb().run('UPDATE songs SET has_cover = ? WHERE id = ?', [hasCover ? 1 : 0, songId])
  persist()
}

export function updateSongMetadata(
  songId: number,
  data: {
    title?: string
    artist?: string
    album?: string
    album_artist?: string
    year?: number | null
    genre?: string | null
    track_number?: number | null
  }
): void {
  const db = getDb()
  const fields: string[] = []
  const values: (string | number | null)[] = []

  if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title) }
  if (data.artist !== undefined) { fields.push('artist = ?'); values.push(data.artist) }
  if (data.album !== undefined) { fields.push('album = ?'); values.push(data.album) }
  if (data.album_artist !== undefined) { fields.push('album_artist = ?'); values.push(data.album_artist) }
  if (data.year !== undefined) { fields.push('year = ?'); values.push(data.year) }
  if (data.genre !== undefined) { fields.push('genre = ?'); values.push(data.genre) }
  if (data.track_number !== undefined) { fields.push('track_number = ?'); values.push(data.track_number) }

  if (fields.length === 0) return

  values.push(songId)
  db.run(`UPDATE songs SET ${fields.join(', ')} WHERE id = ?`, values)
  persist()
}

export function getAppSetting(key: string): string | null {
  const stmt = getDb().prepare(`SELECT value FROM app_settings WHERE key = ?`)
  stmt.bind([key])
  let val: string | null = null
  if (stmt.step()) val = (stmt.getAsObject() as any).value
  stmt.free()
  return val
}

export function setAppSetting(key: string, value: string): void {
  getDb().run(
    `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
    [key, value]
  )
  persist()
}

// ─── Wrapped / Listening Report ───────────────────────────────────────────────

export interface WrappedData {
  period: string
  totalListeningTime: number
  totalPlays: number
  uniqueSongs: number
  uniqueArtists: number
  topSongs: Array<{ title: string; artist: string; total_plays: number; path: string; has_cover: number }>
  topArtists: Array<{ artist: string; total_plays: number; song_count: number; cover_path: string | null }>
  topAlbums: Array<{ album: string; artist: string; total_plays: number; cover_path: string | null }>
  topGenres: Array<{ genre: string; total_plays: number }>
  hourlyActivity: number[]
  dailyActivity: number[]
  longestStreak: number
  avgDailyPlays: number
  newDiscoveries: number
  mostActiveHour: number
  mostActiveDay: number
}

export function getWrappedStats(period: 'week' | 'month' | 'all'): WrappedData {
  const d = getDb()
  const now = Date.now()
  let since = 0
  if (period === 'week') since = now - 7 * 24 * 60 * 60 * 1000
  else if (period === 'month') since = now - 30 * 24 * 60 * 60 * 1000

  const timeFilter = since > 0 ? `AND ph.played_at >= ${since}` : ''
  const songTimeFilter = since > 0 ? `WHERE ph.played_at >= ${since}` : ''

  // Total plays and unique count
  const basicStmt = d.prepare(`
    SELECT COUNT(*) as total_plays,
           COUNT(DISTINCT ph.song_id) as unique_songs,
           COUNT(DISTINCT s.artist) as unique_artists
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${songTimeFilter}
  `)
  basicStmt.step()
  const basic = basicStmt.getAsObject() as any
  basicStmt.free()

  // Total listening time
  const durStmt = d.prepare(`
    SELECT COALESCE(SUM(s.duration), 0) as total
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${songTimeFilter}
  `)
  durStmt.step()
  const totalListeningTime = (durStmt.getAsObject() as any).total ?? 0
  durStmt.free()

  // Top songs
  const topSongsStmt = d.prepare(`
    SELECT s.title, s.artist, COUNT(*) as total_plays, s.path, s.has_cover
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${songTimeFilter}
    GROUP BY ph.song_id ORDER BY total_plays DESC LIMIT 10
  `)
  const topSongs: WrappedData['topSongs'] = []
  while (topSongsStmt.step()) topSongs.push(topSongsStmt.getAsObject() as any)
  topSongsStmt.free()

  // Top artists
  const topArtistsStmt = d.prepare(`
    SELECT s.artist, COUNT(*) as total_plays, COUNT(DISTINCT s.id) as song_count,
           (SELECT path FROM songs s2 WHERE s2.artist = s.artist AND s2.has_cover = 1 LIMIT 1) as cover_path
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${songTimeFilter}
    GROUP BY s.artist ORDER BY total_plays DESC LIMIT 10
  `)
  const topArtists: WrappedData['topArtists'] = []
  while (topArtistsStmt.step()) topArtists.push(topArtistsStmt.getAsObject() as any)
  topArtistsStmt.free()

  // Top albums
  const topAlbumsStmt = d.prepare(`
    SELECT s.album, s.artist, COUNT(*) as total_plays,
           (SELECT path FROM songs s2 WHERE s2.album = s.album AND s2.has_cover = 1 LIMIT 1) as cover_path
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${songTimeFilter}
    GROUP BY s.album ORDER BY total_plays DESC LIMIT 10
  `)
  const topAlbums: WrappedData['topAlbums'] = []
  while (topAlbumsStmt.step()) topAlbums.push(topAlbumsStmt.getAsObject() as any)
  topAlbumsStmt.free()

  // Top genres
  const genreStmt = d.prepare(`
    SELECT s.genre, COUNT(*) as total_plays
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${songTimeFilter}
    ${since > 0 ? 'AND' : 'WHERE'} s.genre IS NOT NULL AND s.genre != ''
    GROUP BY s.genre ORDER BY total_plays DESC LIMIT 10
  `)
  const topGenres: WrappedData['topGenres'] = []
  while (genreStmt.step()) topGenres.push(genreStmt.getAsObject() as any)
  genreStmt.free()

  // Hourly & daily activity
  const actStmt = d.prepare(`SELECT played_at FROM play_history ph ${songTimeFilter}`)
  const hourly = new Array(24).fill(0)
  const daily = new Array(7).fill(0)
  const daySet = new Set<string>()
  while (actStmt.step()) {
    const ts = (actStmt.getAsObject() as any).played_at as number
    const date = new Date(ts)
    hourly[date.getHours()]++
    daily[date.getDay()]++
    daySet.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`)
  }
  actStmt.free()

  const mostActiveHour = hourly.indexOf(Math.max(...hourly))
  const mostActiveDay = daily.indexOf(Math.max(...daily))
  const activeDays = daySet.size || 1
  const avgDailyPlays = Math.round((basic.total_plays ?? 0) / activeDays)

  // Longest streak (consecutive days with plays)
  const sortedDays = Array.from(daySet).sort()
  let longestStreak = 0, currentStreak = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1])
    const curr = new Date(sortedDays[i])
    const diff = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000)
    if (diff <= 1) { currentStreak++; longestStreak = Math.max(longestStreak, currentStreak) }
    else currentStreak = 1
  }
  longestStreak = Math.max(longestStreak, currentStreak)

  // New discoveries (first time played in period)
  let newDiscoveries = 0
  if (since > 0) {
    const discStmt = d.prepare(`
      SELECT COUNT(DISTINCT ph.song_id) as c
      FROM play_history ph
      WHERE ph.played_at >= ?
        AND ph.song_id NOT IN (SELECT DISTINCT song_id FROM play_history WHERE played_at < ?)
    `)
    discStmt.bind([since, since])
    if (discStmt.step()) newDiscoveries = (discStmt.getAsObject() as any).c ?? 0
    discStmt.free()
  }

  return {
    period,
    totalListeningTime,
    totalPlays: basic.total_plays ?? 0,
    uniqueSongs: basic.unique_songs ?? 0,
    uniqueArtists: basic.unique_artists ?? 0,
    topSongs, topArtists, topAlbums, topGenres,
    hourlyActivity: hourly,
    dailyActivity: daily,
    longestStreak,
    avgDailyPlays,
    newDiscoveries,
    mostActiveHour,
    mostActiveDay
  }
}

// ─── Similar Songs ────────────────────────────────────────────────────────────

export function getSimilarSongs(songId: number): SongRow[] {
  const d = getDb()
  const songStmt = d.prepare(`SELECT artist, album, genre FROM songs WHERE id = ?`)
  songStmt.bind([songId])
  if (!songStmt.step()) { songStmt.free(); return [] }
  const song = songStmt.getAsObject() as any
  songStmt.free()

  const stmt = d.prepare(`
    SELECT * FROM songs
    WHERE id != ? AND (artist = ? OR album = ? OR (genre IS NOT NULL AND genre = ?))
    ORDER BY
      CASE WHEN artist = ? THEN 0 ELSE 1 END,
      CASE WHEN album = ? THEN 0 ELSE 1 END,
      play_count DESC
    LIMIT 20
  `)
  stmt.bind([songId, song.artist, song.album, song.genre, song.artist, song.album])
  const rows: SongRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as SongRow)
  stmt.free()
  return rows
}

// ─── Duplicate Finder ─────────────────────────────────────────────────────────

export interface DuplicateGroup {
  title: string
  artist: string
  songs: SongRow[]
}

export function getDuplicateSongs(): DuplicateGroup[] {
  const d = getDb()
  const stmt = d.prepare(`
    SELECT LOWER(title) as lt, LOWER(artist) as la, COUNT(*) as cnt
    FROM songs
    GROUP BY lt, la
    HAVING cnt > 1
    ORDER BY cnt DESC
    LIMIT 100
  `)
  const groups: DuplicateGroup[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as any
    const detailStmt = d.prepare(
      `SELECT * FROM songs WHERE LOWER(title) = ? AND LOWER(artist) = ? ORDER BY bitrate DESC, file_size DESC`
    )
    detailStmt.bind([row.lt, row.la])
    const songs: SongRow[] = []
    while (detailStmt.step()) songs.push(detailStmt.getAsObject() as unknown as SongRow)
    detailStmt.free()
    if (songs.length > 1) {
      groups.push({ title: songs[0].title, artist: songs[0].artist, songs })
    }
  }
  stmt.free()
  return groups
}

// ─── Playlist Cover ───────────────────────────────────────────────────────────

export function updatePlaylistCover(playlistId: number, coverPath: string | null): void {
  getDb().run(`UPDATE playlists SET cover_path = ?, updated_at = ? WHERE id = ?`, [coverPath, Date.now(), playlistId])
  persist()
}

// ─── Export Playlist ──────────────────────────────────────────────────────────

export function exportPlaylistData(playlistId: number): { playlist: any; songs: SongRow[] } | null {
  const pl = getPlaylist(playlistId)
  if (!pl) return null
  const songs = getPlaylistSongs(playlistId)
  return { playlist: pl, songs }
}

// ─── Apple Music Replay Stats ─────────────────────────────────────────────────

export interface ReplayData {
  year: number
  totalMinutes: number
  totalPlays: number
  totalSongs: number
  totalArtists: number
  totalAlbums: number
  topSongs: Array<{ title: string; artist: string; total_plays: number; path: string; has_cover: number }>
  topArtists: Array<{ artist: string; total_plays: number; total_minutes: number; song_count: number; cover_path: string | null }>
  topAlbums: Array<{ album: string; artist: string; total_plays: number; total_minutes: number; cover_path: string | null }>
  topGenres: Array<{ genre: string; total_plays: number }>
  monthlyTopArtists: Array<{ month: number; artist: string; cover_path: string | null }>
  monthlyTopSongs: Array<{ month: number; title: string; artist: string; path: string; has_cover: number }>
  monthlyTopAlbums: Array<{ month: number; album: string; artist: string; cover_path: string | null }>
}

export function getAvailableYears(): number[] {
  const d = getDb()
  const stmt = d.prepare(`SELECT DISTINCT strftime('%Y', played_at / 1000, 'unixepoch', 'localtime') as yr FROM play_history ORDER BY yr DESC`)
  const years: number[] = []
  while (stmt.step()) {
    const y = parseInt((stmt.getAsObject() as any).yr)
    if (!isNaN(y)) years.push(y)
  }
  stmt.free()
  return years
}

export function getReplayStats(year: number): ReplayData {
  const d = getDb()
  const yearStart = new Date(year, 0, 1).getTime()
  const yearEnd = new Date(year + 1, 0, 1).getTime()
  const timeFilter = `WHERE ph.played_at >= ${yearStart} AND ph.played_at < ${yearEnd}`

  // Basic counts
  const basicStmt = d.prepare(`
    SELECT COUNT(*) as total_plays,
           COUNT(DISTINCT ph.song_id) as unique_songs,
           COUNT(DISTINCT s.artist) as unique_artists,
           COUNT(DISTINCT s.album) as unique_albums
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${timeFilter}
  `)
  basicStmt.step()
  const basic = basicStmt.getAsObject() as any
  basicStmt.free()

  // Total listening minutes
  const durStmt = d.prepare(`
    SELECT COALESCE(SUM(s.duration), 0) as total
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${timeFilter}
  `)
  durStmt.step()
  const totalMinutes = Math.round(((durStmt.getAsObject() as any).total ?? 0) / 60)
  durStmt.free()

  // Top songs (10)
  const topSongsStmt = d.prepare(`
    SELECT s.title, s.artist, COUNT(*) as total_plays, s.path, s.has_cover
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${timeFilter}
    GROUP BY ph.song_id ORDER BY total_plays DESC LIMIT 10
  `)
  const topSongs: ReplayData['topSongs'] = []
  while (topSongsStmt.step()) topSongs.push(topSongsStmt.getAsObject() as any)
  topSongsStmt.free()

  // Top artists with minutes
  const topArtistsStmt = d.prepare(`
    SELECT s.artist, COUNT(*) as total_plays,
           ROUND(COALESCE(SUM(s.duration), 0) / 60.0) as total_minutes,
           COUNT(DISTINCT s.id) as song_count,
           (SELECT path FROM songs s2 WHERE s2.artist = s.artist AND s2.has_cover = 1 LIMIT 1) as cover_path
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${timeFilter}
    GROUP BY s.artist ORDER BY total_plays DESC LIMIT 10
  `)
  const topArtists: ReplayData['topArtists'] = []
  while (topArtistsStmt.step()) topArtists.push(topArtistsStmt.getAsObject() as any)
  topArtistsStmt.free()

  // Top albums with minutes
  const topAlbumsStmt = d.prepare(`
    SELECT s.album, s.artist, COUNT(*) as total_plays,
           ROUND(COALESCE(SUM(s.duration), 0) / 60.0) as total_minutes,
           (SELECT path FROM songs s2 WHERE s2.album = s.album AND s2.has_cover = 1 LIMIT 1) as cover_path
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${timeFilter}
    GROUP BY s.album ORDER BY total_plays DESC LIMIT 10
  `)
  const topAlbums: ReplayData['topAlbums'] = []
  while (topAlbumsStmt.step()) topAlbums.push(topAlbumsStmt.getAsObject() as any)
  topAlbumsStmt.free()

  // Top genres
  const genreStmt = d.prepare(`
    SELECT s.genre, COUNT(*) as total_plays
    FROM play_history ph JOIN songs s ON s.id = ph.song_id
    ${timeFilter} AND s.genre IS NOT NULL AND s.genre != ''
    GROUP BY s.genre ORDER BY total_plays DESC LIMIT 5
  `)
  const topGenres: ReplayData['topGenres'] = []
  while (genreStmt.step()) topGenres.push(genreStmt.getAsObject() as any)
  genreStmt.free()

  // Monthly top artist
  const monthArtistStmt = d.prepare(`
    SELECT m, artist, cover_path FROM (
      SELECT CAST(strftime('%m', ph.played_at / 1000, 'unixepoch', 'localtime') AS INTEGER) as m,
             s.artist,
             (SELECT path FROM songs s2 WHERE s2.artist = s.artist AND s2.has_cover = 1 LIMIT 1) as cover_path,
             COUNT(*) as cnt,
             ROW_NUMBER() OVER (PARTITION BY CAST(strftime('%m', ph.played_at / 1000, 'unixepoch', 'localtime') AS INTEGER) ORDER BY COUNT(*) DESC) as rn
      FROM play_history ph JOIN songs s ON s.id = ph.song_id
      ${timeFilter}
      GROUP BY m, s.artist
    ) WHERE rn = 1 ORDER BY m
  `)
  const monthlyTopArtists: ReplayData['monthlyTopArtists'] = []
  while (monthArtistStmt.step()) monthlyTopArtists.push(monthArtistStmt.getAsObject() as any)
  monthArtistStmt.free()

  // Monthly top song
  const monthSongStmt = d.prepare(`
    SELECT m, title, artist, path, has_cover FROM (
      SELECT CAST(strftime('%m', ph.played_at / 1000, 'unixepoch', 'localtime') AS INTEGER) as m,
             s.title, s.artist, s.path, s.has_cover,
             COUNT(*) as cnt,
             ROW_NUMBER() OVER (PARTITION BY CAST(strftime('%m', ph.played_at / 1000, 'unixepoch', 'localtime') AS INTEGER) ORDER BY COUNT(*) DESC) as rn
      FROM play_history ph JOIN songs s ON s.id = ph.song_id
      ${timeFilter}
      GROUP BY m, ph.song_id
    ) WHERE rn = 1 ORDER BY m
  `)
  const monthlyTopSongs: ReplayData['monthlyTopSongs'] = []
  while (monthSongStmt.step()) monthlyTopSongs.push(monthSongStmt.getAsObject() as any)
  monthSongStmt.free()

  // Monthly top album
  const monthAlbumStmt = d.prepare(`
    SELECT m, album, artist, cover_path FROM (
      SELECT CAST(strftime('%m', ph.played_at / 1000, 'unixepoch', 'localtime') AS INTEGER) as m,
             s.album, s.artist,
             (SELECT path FROM songs s2 WHERE s2.album = s.album AND s2.has_cover = 1 LIMIT 1) as cover_path,
             COUNT(*) as cnt,
             ROW_NUMBER() OVER (PARTITION BY CAST(strftime('%m', ph.played_at / 1000, 'unixepoch', 'localtime') AS INTEGER) ORDER BY COUNT(*) DESC) as rn
      FROM play_history ph JOIN songs s ON s.id = ph.song_id
      ${timeFilter}
      GROUP BY m, s.album
    ) WHERE rn = 1 ORDER BY m
  `)
  const monthlyTopAlbums: ReplayData['monthlyTopAlbums'] = []
  while (monthAlbumStmt.step()) monthlyTopAlbums.push(monthAlbumStmt.getAsObject() as any)
  monthAlbumStmt.free()

  return {
    year,
    totalMinutes,
    totalPlays: basic.total_plays ?? 0,
    totalSongs: basic.unique_songs ?? 0,
    totalArtists: basic.unique_artists ?? 0,
    totalAlbums: basic.unique_albums ?? 0,
    topSongs, topArtists, topAlbums, topGenres,
    monthlyTopArtists, monthlyTopSongs, monthlyTopAlbums
  }
}

// ─── Full Backup / Restore ────────────────────────────────────────────────────

export function exportFullBackup(): object {
  const d = getDb()

  const songs = d.exec(`SELECT * FROM songs`)
  const play_history = d.exec(`SELECT * FROM play_history`)
  const library_folders = d.exec(`SELECT * FROM library_folders`)
  const favorite_artists = d.exec(`SELECT * FROM favorite_artists`)
  const playlists = d.exec(`SELECT * FROM playlists`)
  const playlist_songs = d.exec(`SELECT * FROM playlist_songs`)
  const lyrics_cache = d.exec(`SELECT * FROM lyrics_cache`)
  const app_settings = d.exec(`SELECT * FROM app_settings`)

  const toRows = (result: any[]) => {
    if (!result.length) return []
    const { columns, values } = result[0]
    return values.map((row: any[]) => {
      const obj: Record<string, any> = {}
      columns.forEach((col: string, i: number) => { obj[col] = row[i] })
      return obj
    })
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    app: 'MPlayer',
    data: {
      songs: toRows(songs),
      play_history: toRows(play_history),
      library_folders: toRows(library_folders),
      favorite_artists: toRows(favorite_artists),
      playlists: toRows(playlists),
      playlist_songs: toRows(playlist_songs),
      lyrics_cache: toRows(lyrics_cache),
      app_settings: toRows(app_settings)
    }
  }
}

export function importFullBackup(backup: any): { success: boolean; stats: Record<string, number> } {
  const d = getDb()
  if (!backup?.data || backup.app !== 'MPlayer') {
    return { success: false, stats: {} }
  }

  const stats: Record<string, number> = {}
  const data = backup.data

  // Songs — upsert by path (keep existing if duplicate)
  if (data.songs?.length) {
    const stmt = d.prepare(`INSERT OR IGNORE INTO songs
      (path, title, artist, album, album_artist, duration, year, genre, track_number,
       has_cover, file_size, date_added, play_count, last_played, rating, is_favorite, bitrate)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    let count = 0
    for (const s of data.songs) {
      stmt.run([s.path, s.title, s.artist, s.album, s.album_artist, s.duration,
        s.year, s.genre, s.track_number, s.has_cover, s.file_size, s.date_added,
        s.play_count, s.last_played, s.rating, s.is_favorite ?? 0, s.bitrate ?? 0])
      count++
    }
    stmt.free()
    // Update play_count / last_played / is_favorite for existing songs
    const upStmt = d.prepare(`UPDATE songs SET
      play_count = MAX(play_count, ?), last_played = MAX(COALESCE(last_played,0), ?),
      is_favorite = MAX(is_favorite, ?), rating = MAX(rating, ?)
      WHERE path = ?`)
    for (const s of data.songs) {
      upStmt.run([s.play_count ?? 0, s.last_played ?? 0, s.is_favorite ?? 0, s.rating ?? 0, s.path])
    }
    upStmt.free()
    stats.songs = count
  }

  // Build path→id map for relational data
  const pathMap = new Map<number, number>() // old_id → new_id
  if (data.songs?.length) {
    for (const s of data.songs) {
      const row = d.exec(`SELECT id FROM songs WHERE path = ?`, [s.path])
      if (row.length && row[0].values.length) {
        pathMap.set(s.id, row[0].values[0][0] as number)
      }
    }
  }

  // Play history
  if (data.play_history?.length) {
    const stmt = d.prepare(`INSERT OR IGNORE INTO play_history (song_id, played_at) VALUES (?, ?)`)
    let count = 0
    for (const h of data.play_history) {
      const newId = pathMap.get(h.song_id)
      if (newId) { stmt.run([newId, h.played_at]); count++ }
    }
    stmt.free()
    stats.play_history = count
  }

  // Library folders
  if (data.library_folders?.length) {
    const stmt = d.prepare(`INSERT OR IGNORE INTO library_folders (path, added_at) VALUES (?, ?)`)
    let count = 0
    for (const f of data.library_folders) { stmt.run([f.path, f.added_at]); count++ }
    stmt.free()
    stats.library_folders = count
  }

  // Favorite artists
  if (data.favorite_artists?.length) {
    const stmt = d.prepare(`INSERT OR IGNORE INTO favorite_artists (name, added_at) VALUES (?, ?)`)
    let count = 0
    for (const a of data.favorite_artists) { stmt.run([a.name, a.added_at]); count++ }
    stmt.free()
    stats.favorite_artists = count
  }

  // Playlists
  const playlistMap = new Map<number, number>() // old_id → new_id
  if (data.playlists?.length) {
    let count = 0
    for (const p of data.playlists) {
      // Check if playlist with same name exists
      const existing = d.exec(`SELECT id FROM playlists WHERE name = ?`, [p.name])
      if (existing.length && existing[0].values.length) {
        playlistMap.set(p.id, existing[0].values[0][0] as number)
      } else {
        d.run(`INSERT INTO playlists (name, description, cover_path, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)`,
          [p.name, p.description || '', p.cover_path, p.created_at, p.updated_at])
        const newId = d.exec(`SELECT last_insert_rowid() as id`)[0].values[0][0] as number
        playlistMap.set(p.id, newId)
        count++
      }
    }
    stats.playlists = count
  }

  // Playlist songs
  if (data.playlist_songs?.length) {
    const stmt = d.prepare(`INSERT OR IGNORE INTO playlist_songs
      (playlist_id, song_id, position, added_at) VALUES (?, ?, ?, ?)`)
    let count = 0
    for (const ps of data.playlist_songs) {
      const newPlaylistId = playlistMap.get(ps.playlist_id)
      const newSongId = pathMap.get(ps.song_id)
      if (newPlaylistId && newSongId) {
        stmt.run([newPlaylistId, newSongId, ps.position, ps.added_at])
        count++
      }
    }
    stmt.free()
    stats.playlist_songs = count
  }

  // Lyrics cache
  if (data.lyrics_cache?.length) {
    const stmt = d.prepare(`INSERT OR IGNORE INTO lyrics_cache
      (song_id, lrc_text, source, saved_at, offset_ms) VALUES (?, ?, ?, ?, ?)`)
    let count = 0
    for (const l of data.lyrics_cache) {
      const newId = pathMap.get(l.song_id)
      if (newId) { stmt.run([newId, l.lrc_text, l.source, l.saved_at, l.offset_ms ?? 0]); count++ }
    }
    stmt.free()
    stats.lyrics_cache = count
  }

  // App settings (merge, don't overwrite)
  if (data.app_settings?.length) {
    const stmt = d.prepare(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`)
    let count = 0
    for (const s of data.app_settings) { stmt.run([s.key, s.value]); count++ }
    stmt.free()
    stats.app_settings = count
  }

  persist()
  return { success: true, stats }
}
