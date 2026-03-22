import { ipcMain, BrowserWindow, dialog, app, net, shell, Menu, MenuItem } from 'electron'
import fs from 'fs'
import { readdir } from 'fs/promises'
import { join, dirname } from 'path'
import {
  getSongs, getTotalSongs, getTrendingSongs, getRecentSongs,
  getArtists, getAlbums, recordPlay, getHistory, getTotalHistory,
  getLibraryFolders, addLibraryFolder, getStats, resetAllPlays,
  toggleFavorite, getFavorites, getTotalFavorites,
  toggleFavoriteArtist, getFavoriteArtists, isArtistFavorite,
  deleteHistoryEntry, searchAll, deleteArtist,
  getLibraryFolderRows, getSongCountForFolder, getSongsFromFolder,
  getSongsInFolder, getArtistSongRecords,
  removeSong, removeSongsFromFolder, removeLibraryFolder, persist,
  getPlaylists, getPlaylist, createPlaylist, updatePlaylist, deletePlaylist,
  addSongToPlaylist, removeSongFromPlaylist, getPlaylistSongs,
  getSmartPlaylistSongs,
  saveLyrics, deleteLyrics,
  getLyricsOffset, saveLyricsOffset,
  getAppSetting, setAppSetting,
  getDetailedStats,
  updateSongMetadata,
  getSongById,
  setSongHasCover,
  getWrappedStats,
  getReplayStats,
  getAvailableYears,
  getSimilarSongs,
  getDuplicateSongs,
  updatePlaylistCover,
  exportPlaylistData,
  exportFullBackup,
  importFullBackup
} from './database'
import { scanDirectory } from './scanner'
import { coverCache } from './cover-cache'
import { writeTagsToFile, writeCoverToFile } from './tag-writer'
import {
  getLastFmStatus, authenticateLastFm, disconnectLastFm,
  updateNowPlaying as lfmNowPlaying, scrobble as lfmScrobble
} from './lastfm'
import { getLyrics, searchLrclibAll } from './lyrics'

export function setupIpcHandlers(): void {
  // ── App info ─────────────────────────────────────────────────────────────────
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // ── Library queries ────────────────────────────────────────────────────────
  ipcMain.handle('library:getSongs', (_, opts: { limit?: number; offset?: number; search?: string }) =>
    getSongs(opts.limit ?? 100, opts.offset ?? 0, opts.search)
  )

  ipcMain.handle('library:getTotalSongs', (_, search?: string) =>
    getTotalSongs(search)
  )

  ipcMain.handle('library:getTrending', () => getTrendingSongs(20))
  ipcMain.handle('library:getRecent', () => getRecentSongs(20))
  ipcMain.handle('library:getArtists', () => getArtists())
  ipcMain.handle('library:getAlbums', () => getAlbums())
  ipcMain.handle('library:getStats', () => getStats())
  ipcMain.handle('library:getDetailedStats', () => getDetailedStats())

  // ── Folders & scan ────────────────────────────────────────────────────────
  ipcMain.handle('library:getFolders', () => getLibraryFolders())

  ipcMain.handle('library:getFolderDetails', () => {
    const rows = getLibraryFolderRows()
    return rows.map((r) => ({
      path: r.path,
      added_at: r.added_at,
      song_count: getSongCountForFolder(r.path)
    }))
  })

  ipcMain.handle('library:rescanFolder', async (event, folderPath: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { count: 0, removed: 0 }
    // Step 1: scan for new/upgraded files
    const result = await scanDirectory(folderPath, win)
    // Step 2: remove orphaned songs (files that no longer exist on disk)
    const songs = getSongsFromFolder(folderPath)
    let removed = 0
    for (const song of songs) {
      if (!fs.existsSync(song.path)) {
        removeSong(song.id)
        removed++
      }
    }
    if (removed > 0) persist()
    return { count: result.count, removed }
  })

  ipcMain.handle('library:removeFolder', async (_, folderPath: string, deleteSongs: boolean) => {
    if (deleteSongs) removeSongsFromFolder(folderPath)
    removeLibraryFolder(folderPath)
  })

  ipcMain.handle('library:rescanArtist', async (event, artistName: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { count: 0, removed: 0 }

    // 1. Get all song records for this artist from DB
    const records = getArtistSongRecords(artistName)
    if (!records.length) return { count: 0, removed: 0 }

    // 2. Unique album-level dirs (parent dir of each song file)
    const albumDirs = [...new Set(records.map((r) => dirname(r.path)))]

    // 3. For each registered library folder, find artist dirs that live inside it
    //    and compute their common ancestor — but never go above the library root.
    const libraryFolders = getLibraryFolders()
    const foldersToScan: string[] = []

    for (const libRoot of libraryFolders) {
      const normRoot = libRoot.replace(/[\\/]+$/, '')
      const dirsInLib = albumDirs.filter((d) =>
        d.toLowerCase().startsWith(normRoot.toLowerCase() + '\\') ||
        d.toLowerCase().startsWith(normRoot.toLowerCase() + '/')
      )
      if (!dirsInLib.length) continue

      const ancestor = commonAncestorOf(dirsInLib)
      // Only use the ancestor if it is deeper than the library root itself
      if (
        ancestor &&
        ancestor.toLowerCase() !== normRoot.toLowerCase() &&
        ancestor.toLowerCase().startsWith(normRoot.toLowerCase())
      ) {
        foldersToScan.push(ancestor)
      } else {
        // Songs are all directly in the library root or span multiple roots — scan each album dir
        dirsInLib.forEach((d) => foldersToScan.push(d))
      }
    }

    // Fallback: no library root matched — scan each album dir individually
    if (!foldersToScan.length) albumDirs.forEach((d) => foldersToScan.push(d))

    // 4. Scan (new songs added, FLAC upgrades preserve stats via insertSong logic)
    // First check if any of the folders actually exist — if none do, the artist folder was moved.
    const existingFolders = [...new Set(foldersToScan)].filter((f) => fs.existsSync(f))
    if (!existingFolders.length) {
      return { count: 0, removed: 0, folderMissing: true }
    }

    let totalAdded = 0
    for (const folder of existingFolders) {
      const result = await scanDirectory(folder, win)
      totalAdded += result.count
    }

    // 5. Remove orphaned songs in the scanned folders (path-based, not artist-based)
    //    This handles cases where FLAC files have different artist tags than the old MP3s.
    const folderSongMap = new Map<number, string>()
    for (const folder of existingFolders) {
      for (const s of getSongsFromFolder(folder)) {
        folderSongMap.set(s.id, s.path)
      }
    }
    let removed = 0
    for (const [id, path] of folderSongMap) {
      if (!fs.existsSync(path)) {
        removeSong(id)
        removed++
      }
    }
    if (removed > 0) persist()

    return { count: totalAdded, removed, folderMissing: false }
  })

  // Rescan artist from a user-specified new folder (used when original folder was moved)
  ipcMain.handle('library:rescanArtistFromFolder', async (event, artistName: string, newFolder: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { count: 0, removed: 0 }
    if (!fs.existsSync(newFolder)) return { count: 0, removed: 0 }

    // Scan the new folder — insertSong will match by name/stem and preserve stats
    const { count } = await scanDirectory(newFolder, win)

    // Remove old records for this artist that no longer exist on disk
    const afterRecords = getArtistSongRecords(artistName)
    let removed = 0
    for (const song of afterRecords) {
      if (!fs.existsSync(song.path)) {
        removeSong(song.id)
        removed++
      }
    }
    if (removed > 0) persist()

    return { count, removed }
  })

  ipcMain.handle('library:getSongsInFolder', (_, folderPath: string) =>
    getSongsInFolder(folderPath)
  )

  ipcMain.handle('library:getSubfolders', async (_, folderPath: string) => {
    try {
      const entries = await readdir(folderPath, { withFileTypes: true })
      const subdirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => ({ name: e.name, path: join(folderPath, e.name) }))
      return subdirs
        .map((d) => ({ name: d.name, path: d.path, song_count: getSongCountForFolder(d.path) }))
        .filter((d) => d.song_count > 0)
    } catch {
      return []
    }
  })

  ipcMain.handle('library:addFolder', async (_, folderPath?: string) => {
    if (!folderPath) {
      const res = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Music Folder'
      })
      if (res.canceled || !res.filePaths.length) return null
      folderPath = res.filePaths[0]
    }
    addLibraryFolder(folderPath)
    return folderPath
  })

  ipcMain.handle('library:scan', async (event, folderPath: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { count: 0 }
    return scanDirectory(folderPath, win)
  })

  // ── Cover art ─────────────────────────────────────────────────────────────
  ipcMain.handle('library:getCover', (_, songPath: string) =>
    coverCache().getBase64(songPath)
  )

  // ── History ───────────────────────────────────────────────────────────────
  ipcMain.handle('library:getHistory', (_, opts: { limit?: number; offset?: number }) =>
    getHistory(opts?.limit ?? 100, opts?.offset ?? 0)
  )

  ipcMain.handle('library:getTotalHistory', () => getTotalHistory())

  // ── History delete & search ──────────────────────────────────────────────────
  ipcMain.handle('library:deleteHistoryEntry', (_, songId: number, playedAt: number) => deleteHistoryEntry(songId, playedAt))
  ipcMain.handle('library:searchAll', (_, query: string) => searchAll(query, 5))
  ipcMain.handle('library:deleteArtist', (_, artistName: string) => deleteArtist(artistName))

  // ── Wikipedia summary (routed through main to bypass renderer CSP) ──────────
  ipcMain.handle('library:getWikiSummary', async (_, artistName: string) => {
    try {
      const encoded = encodeURIComponent(artistName.replace(/ /g, '_'))
      const res = await net.fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
        headers: { Accept: 'application/json' }
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  })

  // ── Player ────────────────────────────────────────────────────────────────
  // Called from renderer when 80% of a song has been listened to
  ipcMain.handle('player:recordPlay', (_, songId: number) => recordPlay(songId))
  ipcMain.handle('player:resetAllPlays', () => resetAllPlays())
  ipcMain.handle('player:toggleFavorite', (_, songId: number) => toggleFavorite(songId))

  // ── Favorites ─────────────────────────────────────────────────────────────
  ipcMain.handle('library:getFavorites', (_, opts: { limit?: number; offset?: number }) =>
    getFavorites(opts?.limit ?? 100, opts?.offset ?? 0)
  )
  ipcMain.handle('library:getTotalFavorites', () => getTotalFavorites())
  ipcMain.handle('library:toggleFavoriteArtist', (_, artistName: string) => toggleFavoriteArtist(artistName))
  ipcMain.handle('library:getFavoriteArtists', () => getFavoriteArtists())
  ipcMain.handle('library:isArtistFavorite', (_, artistName: string) => isArtistFavorite(artistName))

  // ── Playlists ─────────────────────────────────────────────────────────
  ipcMain.handle('playlist:getAll', () => getPlaylists())
  ipcMain.handle('playlist:get', (_, id: number) => getPlaylist(id))
  ipcMain.handle('playlist:create', (_, name: string, description?: string) => createPlaylist(name, description))
  ipcMain.handle('playlist:update', (_, id: number, name: string, description: string) => updatePlaylist(id, name, description))
  ipcMain.handle('playlist:delete', (_, id: number) => deletePlaylist(id))
  ipcMain.handle('playlist:addSong', (_, playlistId: number, songId: number) => addSongToPlaylist(playlistId, songId))
  ipcMain.handle('playlist:removeSong', (_, playlistId: number, songId: number) => removeSongFromPlaylist(playlistId, songId))
  ipcMain.handle('playlist:getSongs', (_, playlistId: number) => getPlaylistSongs(playlistId))
  ipcMain.handle('playlist:getSmartSongs', (_, type: string) => getSmartPlaylistSongs(type))

  // ── Lyrics ─────────────────────────────────────────────────────────────────
  ipcMain.handle('lyrics:get', async (_, songId: number, artist: string, title: string, album: string, duration: number) =>
    getLyrics(songId, artist, title, album, duration)
  )

  ipcMain.handle('lyrics:save', (_, songId: number, lrcText: string, source: string) => {
    saveLyrics(songId, lrcText, source)
  })

  ipcMain.handle('lyrics:delete', (_, songId: number) => {
    deleteLyrics(songId)
  })

  ipcMain.handle('lyrics:importLrc', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: 'Select LRC File',
      filters: [{ name: 'LRC Files', extensions: ['lrc', 'txt'] }]
    })
    if (res.canceled || !res.filePaths.length) return null
    return fs.readFileSync(res.filePaths[0], 'utf-8')
  })

  ipcMain.handle('lyrics:getOffset', (_, songId: number) => getLyricsOffset(songId))
  ipcMain.handle('lyrics:saveOffset', (_, songId: number, offsetMs: number) => saveLyricsOffset(songId, offsetMs))
  ipcMain.handle('lyrics:search', async (_, query: string, artistHint?: string) =>
    searchLrclibAll(query, artistHint)
  )

  // ── App Settings ──────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', (_, key: string) => getAppSetting(key))
  ipcMain.handle('settings:set', (_, key: string, value: string) => setAppSetting(key, value))

  // ── Window controls ───────────────────────────────────────────────────────
  ipcMain.handle('window:minimize', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    const autoMini = await getAppSetting('autoMiniOnMinimize')
    if (autoMini) {
      // Toggle mini player instead of minimize
      // This logic replicates window:toggleMini but for minimization event
      if (!isMiniPlayer) {
        isMiniPlayer = true
        currentMiniMode = await getAppSetting('lastMiniMode') || 'default'
        normalBounds = win.getBounds()
        const sz = MINI_SIZES[currentMiniMode] || MINI_SIZES.default
        win.setMinimumSize(sz.w, sz.h)
        win.setSize(sz.w, sz.h)
        win.setAlwaysOnTop(true, 'floating')
        win.webContents.send('mini:changed', true, currentMiniMode)
      } else {
        win.minimize() // If already mini, then regular minimize
      }
    } else {
      win.minimize()
    }
  })
  ipcMain.handle('window:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    w?.isMaximized() ? w.unmaximize() : w?.maximize()
  })
  ipcMain.handle('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  // ── Last.fm ───────────────────────────────────────────────────────────────
  ipcMain.handle('lastfm:getStatus', () => getLastFmStatus())
  ipcMain.handle('lastfm:authenticate', (_, apiKey: string, apiSecret: string, username: string, password: string) =>
    authenticateLastFm(apiKey, apiSecret, username, password)
  )
  ipcMain.handle('lastfm:disconnect', () => disconnectLastFm())
  ipcMain.handle('lastfm:updateNowPlaying', (_, artist: string, title: string, album: string, duration?: number) =>
    lfmNowPlaying(artist, title, album, duration)
  )
  ipcMain.handle('lastfm:scrobble', (_, artist: string, title: string, album: string, startTs: number, duration?: number) =>
    lfmScrobble(artist, title, album, startTs, duration)
  )

  // ── Song metadata editing ──────────────────────────────────────────────────
  ipcMain.handle('song:update', (_, songId: number, data: {
    title?: string; artist?: string; album?: string; album_artist?: string
    year?: number | null; genre?: string | null; track_number?: number | null
  }) => {
    updateSongMetadata(songId, data)
    // Also write tags to the actual audio file
    const song = getSongById(songId)
    if (song) {
      try {
        writeTagsToFile(song.path, {
          title: data.title,
          artist: data.artist,
          album: data.album,
          albumArtist: data.album_artist,
          year: data.year,
          genre: data.genre,
          trackNumber: data.track_number
        })
      } catch {
        // File write failed (read-only, corrupt, etc.) — DB is already updated
      }
    }
  })

  // ── Song deletion (DB only or DB + disk) ─────────────────────────────────
  ipcMain.handle('song:delete', (_, songId: number, fromDisk: boolean) => {
    const song = getSongById(songId)
    if (!song) return
    removeSong(songId)
    persist()
    if (fromDisk) {
      try {
        if (fs.existsSync(song.path)) fs.unlinkSync(song.path)
      } catch { /* file may be locked or read-only */ }
    }
  })

  // ── Cover art update ──────────────────────────────────────────────────────
  ipcMain.handle('song:setCover', async (_, songId: number, imageBase64: string, mimeType: string) => {
    const song = getSongById(songId)
    if (!song) return
    const buf = Buffer.from(imageBase64, 'base64')
    // Save to cover cache
    await coverCache().save(song.path, buf, true)
    // Write to file tags
    try {
      writeCoverToFile(song.path, buf, mimeType)
    } catch { /* file write can fail */ }
    // Update DB has_cover flag
    setSongHasCover(songId, true)
  })

  ipcMain.handle('song:pickCoverFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Cover Image',
      filters: [{ name: 'Resimler', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths.length) return null
    const filePath = result.filePaths[0]
    const data = fs.readFileSync(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() || 'jpg'
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', bmp: 'image/bmp' }
    return { base64: data.toString('base64'), mimeType: mimeMap[ext] || 'image/jpeg' }
  })

  // ── Cover art search (MusicBrainz + Cover Art Archive) ────────────────────
  ipcMain.handle('song:searchCovers', async (_, query: string) => {
    try {
      const encoded = encodeURIComponent(query)
      const res = await net.fetch(
        `https://musicbrainz.org/ws/2/release/?query=${encoded}&fmt=json&limit=12`,
        { headers: { 'User-Agent': 'MPlayer/1.0 (music-player-app)', Accept: 'application/json' } }
      )
      if (!res.ok) return []
      const data = await res.json() as { releases?: Array<{ id: string; title: string; 'artist-credit'?: Array<{ name: string }> }> }
      if (!data.releases) return []
      const results: Array<{ id: string; title: string; artist: string; coverUrl: string }> = []
      for (const r of data.releases.slice(0, 12)) {
        const artist = r['artist-credit']?.[0]?.name || 'Unknown'
        results.push({
          id: r.id,
          title: r.title,
          artist,
          coverUrl: `https://coverartarchive.org/release/${r.id}/front-250`
        })
      }
      return results
    } catch {
      return []
    }
  })

  ipcMain.handle('song:downloadCover', async (_, url: string) => {
    try {
      const res = await net.fetch(url, {
        headers: { 'User-Agent': 'MPlayer/1.0 (music-player-app)' }
      })
      if (!res.ok) return null
      const contentType = res.headers.get('content-type') || 'image/jpeg'
      const arrayBuf = await res.arrayBuffer()
      return { base64: Buffer.from(arrayBuf).toString('base64'), mimeType: contentType }
    } catch {
      return null
    }
  })

  // ── Open external URL ─────────────────────────────────────────────────────
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    if (url.startsWith('https://')) {
      await shell.openExternal(url)
    }
  })

  // ── Open folder in file explorer ──────────────────────────────────────────
  ipcMain.handle('shell:openFolder', async (_, folderPath: string) => {
    await shell.openPath(folderPath)
  })

  // ── Pick a folder via dialog (no side effects) ─────────────────────────────
  ipcMain.handle('library:pickFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const res = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Artist Folder'
    })
    return res.canceled || !res.filePaths.length ? null : res.filePaths[0]
  })

  // ── Mini Player ────────────────────────────────────────────────────────────
  let isMiniPlayer = false
  let normalBounds: Electron.Rectangle | null = null
  let currentMiniMode = 'default'

  const MINI_SIZES: Record<string, { w: number; h: number }> = {
    default:  { w: 380, h: 130 },
    pill:     { w: 360, h: 72 },
    card:     { w: 300, h: 420 },
    visual:   { w: 360, h: 280 },
    slim:     { w: 420, h: 56 },
    controls: { w: 260, h: 52 },
    photo:    { w: 500, h: 210 },
    lyrics:   { w: 360, h: 380 },
  }

  ipcMain.handle('window:toggleMini', (e, mode?: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return false

    if (isMiniPlayer) {
      isMiniPlayer = false
      win.setAlwaysOnTop(false)
      win.setMinimumSize(1060, 680)
      if (normalBounds) win.setBounds(normalBounds)
      win.webContents.send('mini:changed', false, 'default')
    } else {
      isMiniPlayer = true
      const savedMode = mode || getAppSetting('lastMiniMode') || 'default'
      currentMiniMode = savedMode
      normalBounds = win.getBounds()
      const sz = MINI_SIZES[currentMiniMode] || MINI_SIZES.default
      win.setMinimumSize(sz.w, sz.h)
      win.setSize(sz.w, sz.h)
      win.setAlwaysOnTop(true, 'floating')
      win.webContents.send('mini:changed', true, currentMiniMode)
    }
    return isMiniPlayer
  })

  ipcMain.handle('window:setMiniMode', (e, mode: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win || !isMiniPlayer) return
    currentMiniMode = mode
    const sz = MINI_SIZES[mode] || MINI_SIZES.default
    win.setMinimumSize(sz.w, sz.h)
    win.setSize(sz.w, sz.h)
    win.webContents.send('mini:modeChanged', mode)
  })

  // Expand/collapse mini player for queue/search panel
  ipcMain.handle('window:setMiniExpanded', (e, expanded: boolean) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win || !isMiniPlayer) return
    const base = MINI_SIZES[currentMiniMode] || MINI_SIZES.default
    if (expanded) {
      const expandedH = base.h + 360
      const expandedW = Math.max(base.w, 360)
      win.setMinimumSize(expandedW, expandedH)
      win.setSize(expandedW, expandedH)
    } else {
      win.setMinimumSize(base.w, base.h)
      win.setSize(base.w, base.h)
    }
  })

  ipcMain.handle('window:showMiniModeMenu', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null

    const menu = new Menu()
    const modes = ['default', 'pill', 'card', 'visual', 'slim', 'controls', 'photo', 'lyrics-square']
    
    return new Promise((resolve) => {
      modes.forEach((m) => {
        menu.append(new MenuItem({
          label: m.charAt(0).toUpperCase() + m.slice(1).replace('-', ' '),
          click: () => resolve(m)
        }))
      })
      menu.on('menu-will-close', () => setTimeout(() => resolve(null), 100))
      menu.popup({ window: win })
    })
  })

  // ── Wrapped / Listening Report ──────────────────────────────────────────────
  ipcMain.handle('library:getWrapped', (_, period: 'week' | 'month' | 'all') =>
    getWrappedStats(period)
  )

  // ── Apple Music Replay ─────────────────────────────────────────────────────
  ipcMain.handle('library:getReplay', (_, year: number) => getReplayStats(year))
  ipcMain.handle('library:getAvailableYears', () => getAvailableYears())

  // ── Similar Songs ─────────────────────────────────────────────────────────
  ipcMain.handle('library:getSimilarSongs', (_, songId: number) =>
    getSimilarSongs(songId)
  )

  // ── Duplicate Finder ──────────────────────────────────────────────────────
  ipcMain.handle('library:getDuplicates', () => getDuplicateSongs())

  // ── Playlist Cover ────────────────────────────────────────────────────────
  ipcMain.handle('playlist:setCover', (_, playlistId: number, coverPath: string | null) =>
    updatePlaylistCover(playlistId, coverPath)
  )

  // ── Export / Import ───────────────────────────────────────────────────────
  ipcMain.handle('playlist:export', async (event, playlistId: number, format: 'json' | 'm3u') => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    const data = exportPlaylistData(playlistId)
    if (!data) return false
    const ext = format === 'json' ? 'json' : 'm3u'
    const res = await dialog.showSaveDialog(win, {
      defaultPath: `${data.playlist.name}.${ext}`,
      filters: [{ name: format.toUpperCase(), extensions: [ext] }]
    })
    if (res.canceled || !res.filePath) return false
    if (format === 'json') {
      fs.writeFileSync(res.filePath, JSON.stringify(data, null, 2), 'utf-8')
    } else {
      const lines = ['#EXTM3U', `#PLAYLIST:${data.playlist.name}`]
      for (const s of data.songs) {
        lines.push(`#EXTINF:${Math.round(s.duration)},${s.artist} - ${s.title}`)
        lines.push(s.path)
      }
      fs.writeFileSync(res.filePath, lines.join('\n'), 'utf-8')
    }
    return true
  })

  ipcMain.handle('playlist:import', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: 'Select Playlist File',
      filters: [{ name: 'Playlist', extensions: ['m3u', 'm3u8', 'json'] }]
    })
    if (res.canceled || !res.filePaths.length) return null
    const filePath = res.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    const ext = filePath.split('.').pop()?.toLowerCase()
    if (ext === 'json') {
      try {
        const data = JSON.parse(content)
        const name = data.playlist?.name || 'Imported Playlist'
        return { name, paths: (data.songs || []).map((s: any) => s.path).filter(Boolean) as string[] }
      } catch { return null }
    } else {
      // M3U
      const lines = content.split(/\r?\n/)
      const paths: string[] = []
      let name = 'Imported Playlist'
      for (const line of lines) {
        if (line.startsWith('#PLAYLIST:')) name = line.slice(10).trim()
        else if (!line.startsWith('#') && line.trim()) paths.push(line.trim())
      }
      return { name, paths }
    }
  })

  // ── Full Backup / Restore ─────────────────────────────────────────────────
  ipcMain.handle('data:export', async (event, versions?: any[]) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { success: false }
    const res = await dialog.showSaveDialog(win, {
      defaultPath: `MPlayer-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'MPlayer Backup', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return { success: false }
    const data = exportFullBackup() as Record<string, any>
    if (versions?.length) data.versions = versions
    fs.writeFileSync(res.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true, path: res.filePath }
  })

  ipcMain.handle('data:import', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { success: false, stats: {} }
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: 'Select MPlayer Backup File',
      filters: [{ name: 'MPlayer Backup', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePaths.length) return { success: false, stats: {} }
    try {
      const content = fs.readFileSync(res.filePaths[0], 'utf-8')
      const backup = JSON.parse(content)
      return importFullBackup(backup)
    } catch {
      return { success: false, stats: {} }
    }
  })

  // ── File Watcher ──────────────────────────────────────────────────────────
  const watchers = new Map<string, fs.FSWatcher>()

  ipcMain.handle('watcher:start', (event) => {
    const folders = getLibraryFolders()
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    // Stop existing watchers
    for (const [, w] of watchers) w.close()
    watchers.clear()
    for (const folder of folders) {
      if (!fs.existsSync(folder)) continue
      try {
        const watcher = fs.watch(folder, { recursive: true }, (eventType, filename) => {
          if (!filename) return
          const ext = filename.split('.').pop()?.toLowerCase() ?? ''
          const audioExts = ['mp3','flac','wav','ogg','m4a','aac','wma','ape','opus','aiff']
          if (!audioExts.includes(ext)) return
          win.webContents.send('watcher:change', { type: eventType, folder, filename })
        })
        watchers.set(folder, watcher)
      } catch { /* ignore inaccessible folders */ }
    }
  })

  ipcMain.handle('watcher:stop', () => {
    for (const [, w] of watchers) w.close()
    watchers.clear()
  })
}

// ─── Helper: deepest common ancestor of a list of absolute directory paths ───
function commonAncestorOf(dirs: string[]): string | null {
  if (!dirs.length) return null
  if (dirs.length === 1) return dirs[0]

  const pathSep = dirs[0].includes('\\') ? '\\' : '/'
  const parts = dirs.map((d) => d.split(/[\\/]/))
  const minLen = Math.min(...parts.map((p) => p.length))

  const common: string[] = []
  for (let i = 0; i < minLen; i++) {
    if (parts.every((p) => p[i].toLowerCase() === parts[0][i].toLowerCase())) {
      common.push(parts[0][i])
    } else {
      break
    }
  }

  if (!common.length) return null
  return common.join(pathSep)
}
