import { ElectronAPI } from '@electron-toolkit/preload'

type MPlayerAPI = {
  getSongs(opts: { limit?: number; offset?: number; search?: string }): Promise<import('../renderer/src/types').Song[]>
  getTotalSongs(search?: string): Promise<number>
  getTrending(): Promise<import('../renderer/src/types').Song[]>
  getRecent(): Promise<import('../renderer/src/types').Song[]>
  getArtists(): Promise<import('../renderer/src/types').Artist[]>
  getAlbums(): Promise<import('../renderer/src/types').Album[]>
  getStats(): Promise<import('../renderer/src/types').Stats>
  getDetailedStats(): Promise<any>
  getFolders(): Promise<string[]>
  getFolderDetails(): Promise<{ path: string; added_at: number; song_count: number }[]>
  addFolder(folderPath?: string): Promise<string | null>
  scanLibrary(folderPath: string): Promise<{ count: number }>
  rescanFolder(folderPath: string): Promise<{ count: number; removed: number }>
  rescanArtist(artistName: string): Promise<{ count: number; removed: number; folderMissing: boolean }>
  rescanArtistFromFolder(artistName: string, newFolder: string): Promise<{ count: number; removed: number }>
  pickFolder(): Promise<string | null>
  removeFolder(folderPath: string, deleteSongs: boolean): Promise<void>
  getSongsInFolder(folderPath: string): Promise<import('../renderer/src/types').Song[]>
  getSubfolders(folderPath: string): Promise<{ name: string; path: string; song_count: number }[]>
  getCover(songPath: string): Promise<string | null>
  getVersion(): Promise<string>
  getHistory(opts: { limit?: number; offset?: number }): Promise<import('../renderer/src/types').HistoryEntry[]>
  getTotalHistory(): Promise<number>
  deleteHistoryEntry(songId: number, playedAt: number): Promise<void>
  searchAll(query: string): Promise<import('../renderer/src/types').SearchResult>
  deleteArtist(artistName: string): Promise<void>
  getWikiSummary(artistName: string): Promise<{ extract?: string; content_urls?: { desktop?: { page?: string } } } | null>
  recordPlay(songId: number): Promise<void>
  resetAllPlays(): Promise<void>
  toggleFavorite(songId: number): Promise<void>
  getFavorites(opts: { limit?: number; offset?: number }): Promise<import('../renderer/src/types').Song[]>
  getTotalFavorites(): Promise<number>
  toggleFavoriteArtist(artistName: string): Promise<boolean>
  getFavoriteArtists(): Promise<import('../renderer/src/types').Artist[]>
  isArtistFavorite(artistName: string): Promise<boolean>
  getPlaylists(): Promise<import('../renderer/src/types').Playlist[]>
  getPlaylist(id: number): Promise<import('../renderer/src/types').Playlist | null>
  createPlaylist(name: string, description?: string): Promise<number>
  updatePlaylist(id: number, name: string, description: string): Promise<void>
  deletePlaylist(id: number): Promise<void>
  addSongToPlaylist(playlistId: number, songId: number): Promise<void>
  removeSongFromPlaylist(playlistId: number, songId: number): Promise<void>
  getPlaylistSongs(playlistId: number): Promise<import('../renderer/src/types').Song[]>
  getSmartPlaylistSongs(type: string): Promise<import('../renderer/src/types').Song[]>
  getLyrics(songId: number, artist: string, title: string, album: string, duration: number): Promise<{ synced: boolean; lrc: string; source: string } | null>
  saveLyrics(songId: number, lrcText: string, source: string): Promise<void>
  deleteLyrics(songId: number): Promise<void>
  importLrc(): Promise<string | null>
  getLyricsOffset(songId: number): Promise<number>
  saveLyricsOffset(songId: number, offsetMs: number): Promise<void>
  searchLrclib(query: string, artistHint?: string): Promise<Array<{
    id: number
    trackName: string
    artistName: string
    albumName: string
    duration: number
    hasSynced: boolean
    syncedLyrics: string | null
    plainLyrics: string | null
  }>>
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
  minimize(): Promise<void>
  maximize(): Promise<void>
  close(): Promise<void>
  lastfmGetStatus(): Promise<{ connected: boolean; username: string; apiKey: string; apiSecret: string }>
  lastfmAuthenticate(apiKey: string, apiSecret: string, username: string, password: string): Promise<{ success: boolean; error?: string }>
  lastfmDisconnect(): Promise<void>
  lastfmUpdateNowPlaying(artist: string, title: string, album: string, duration?: number): Promise<void>
  lastfmScrobble(artist: string, title: string, album: string, startTs: number, duration?: number): Promise<void>
  onScanProgress(cb: (d: { current: number; total: number; currentFile: string }) => void): () => void
  onScanComplete(cb: (d: { count: number }) => void): () => void
  updateSong(songId: number, data: {
    title?: string; artist?: string; album?: string; album_artist?: string
    year?: number | null; genre?: string | null; track_number?: number | null
  }): Promise<void>
  deleteSong(songId: number, fromDisk: boolean): Promise<void>
  setCover(songId: number, imageBase64: string, mimeType: string): Promise<void>
  pickCoverFile(): Promise<{ base64: string; mimeType: string } | null>
  searchCovers(query: string): Promise<Array<{ id: string; title: string; artist: string; coverUrl: string }>>
  downloadCover(url: string): Promise<{ base64: string; mimeType: string } | null>
  openExternal(url: string): Promise<void>
  openFolder(folderPath: string): Promise<void>
  toggleMiniPlayer(mode?: string): Promise<boolean>
  setMiniMode(mode: string): Promise<void>
  setMiniExpanded(expanded: boolean): Promise<void>
  onMiniPlayerChange(cb: (isMini: boolean, mode: string) => void): () => void
  onMiniModeChange(cb: (mode: string) => void): () => void

  // Wrapped / Listening Report
  getWrapped(period: 'week' | 'month' | 'all'): Promise<any>

  // Apple Music Replay
  getReplay(year: number): Promise<any>
  getAvailableYears(): Promise<number[]>

  // Similar Songs
  getSimilarSongs(songId: number): Promise<import('../renderer/src/types').Song[]>

  // Duplicate Finder
  getDuplicates(): Promise<Array<{ title: string; artist: string; songs: import('../renderer/src/types').Song[] }>>

  // Playlist Cover
  setPlaylistCover(playlistId: number, coverPath: string | null): Promise<void>

  // Export / Import
  exportPlaylist(playlistId: number, format: 'json' | 'm3u'): Promise<boolean>
  importPlaylist(): Promise<{ name: string; paths: string[] } | null>

  // Full Backup / Restore
  exportBackup(versions?: any[]): Promise<{ success: boolean; path?: string }>
  importBackup(): Promise<{ success: boolean; stats: Record<string, number> }>

  // File Watcher
  startWatcher(): Promise<void>
  stopWatcher(): Promise<void>
  onWatcherChange(cb: (data: { type: string; folder: string; filename: string }) => void): () => void
  onGlobalShortcut(channel: string, cb: () => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: MPlayerAPI
  }
}
