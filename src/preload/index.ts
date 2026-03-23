import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Library
  getSongs: (opts: { limit?: number; offset?: number; search?: string }) =>
    ipcRenderer.invoke('library:getSongs', opts),
  getTotalSongs: (search?: string) =>
    ipcRenderer.invoke('library:getTotalSongs', search),
  
  // Deezer
  deezerSearch: (query: string) => ipcRenderer.invoke('deezer:search', query),
  deezerGetStreamUrl: (trackId: string, arl: string) => ipcRenderer.invoke('deezer:getStreamUrl', trackId, arl),

  getTrending: () => ipcRenderer.invoke('library:getTrending'),
  getRecent: () => ipcRenderer.invoke('library:getRecent'),
  getArtists: () => ipcRenderer.invoke('library:getArtists'),
  getAlbums: () => ipcRenderer.invoke('library:getAlbums'),
  getStats: () => ipcRenderer.invoke('library:getStats'),
  getDetailedStats: () => ipcRenderer.invoke('library:getDetailedStats'),
  getFolders: () => ipcRenderer.invoke('library:getFolders'),
  getFolderDetails: () => ipcRenderer.invoke('library:getFolderDetails'),
  addFolder: (folderPath?: string) => ipcRenderer.invoke('library:addFolder', folderPath),
  scanLibrary: (folderPath: string) => ipcRenderer.invoke('library:scan', folderPath),
  rescanFolder: (folderPath: string) => ipcRenderer.invoke('library:rescanFolder', folderPath),
  rescanArtist: (artistName: string) => ipcRenderer.invoke('library:rescanArtist', artistName),
  rescanArtistFromFolder: (artistName: string, newFolder: string) =>
    ipcRenderer.invoke('library:rescanArtistFromFolder', artistName, newFolder),
  removeFolder: (folderPath: string, deleteSongs: boolean) =>
    ipcRenderer.invoke('library:removeFolder', folderPath, deleteSongs),
  getSongsInFolder: (folderPath: string) => ipcRenderer.invoke('library:getSongsInFolder', folderPath),
  getSubfolders: (folderPath: string) => ipcRenderer.invoke('library:getSubfolders', folderPath),
  getCover: (songPath: string) => ipcRenderer.invoke('library:getCover', songPath),

  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // History
  getHistory: (opts: { limit?: number; offset?: number }) =>
    ipcRenderer.invoke('library:getHistory', opts),
  getTotalHistory: () => ipcRenderer.invoke('library:getTotalHistory'),
  deleteHistoryEntry: (songId: number, playedAt: number) => ipcRenderer.invoke('library:deleteHistoryEntry', songId, playedAt),
  searchAll: (query: string) => ipcRenderer.invoke('library:searchAll', query),
  deleteArtist: (artistName: string) => ipcRenderer.invoke('library:deleteArtist', artistName),
  getWikiSummary: (artistName: string) => ipcRenderer.invoke('library:getWikiSummary', artistName),

  // Player — called at 80% listen threshold
  recordPlay: (songId: number) => ipcRenderer.invoke('player:recordPlay', songId),
  resetAllPlays: () => ipcRenderer.invoke('player:resetAllPlays'),
  toggleFavorite: (songId: number) => ipcRenderer.invoke('player:toggleFavorite', songId),

  // Favorites
  getFavorites: (opts: { limit?: number; offset?: number }) =>
    ipcRenderer.invoke('library:getFavorites', opts),
  getTotalFavorites: () => ipcRenderer.invoke('library:getTotalFavorites'),
  toggleFavoriteArtist: (artistName: string) => ipcRenderer.invoke('library:toggleFavoriteArtist', artistName),
  getFavoriteArtists: () => ipcRenderer.invoke('library:getFavoriteArtists'),
  isArtistFavorite: (artistName: string) => ipcRenderer.invoke('library:isArtistFavorite', artistName),

  // Playlists
  getPlaylists: () => ipcRenderer.invoke('playlist:getAll'),
  getPlaylist: (id: number) => ipcRenderer.invoke('playlist:get', id),
  createPlaylist: (name: string, description?: string) => ipcRenderer.invoke('playlist:create', name, description),
  updatePlaylist: (id: number, name: string, description: string) => ipcRenderer.invoke('playlist:update', id, name, description),
  deletePlaylist: (id: number) => ipcRenderer.invoke('playlist:delete', id),
  addSongToPlaylist: (playlistId: number, songId: number) => ipcRenderer.invoke('playlist:addSong', playlistId, songId),
  removeSongFromPlaylist: (playlistId: number, songId: number) => ipcRenderer.invoke('playlist:removeSong', playlistId, songId),
  getPlaylistSongs: (playlistId: number) => ipcRenderer.invoke('playlist:getSongs', playlistId),
  getSmartPlaylistSongs: (type: string) => ipcRenderer.invoke('playlist:getSmartSongs', type),

  // Lyrics
  getLyrics: (songId: number, artist: string, title: string, album: string, duration: number) =>
    ipcRenderer.invoke('lyrics:get', songId, artist, title, album, duration),
  saveLyrics: (songId: number, lrcText: string, source: string) =>
    ipcRenderer.invoke('lyrics:save', songId, lrcText, source),
  deleteLyrics: (songId: number) => ipcRenderer.invoke('lyrics:delete', songId),
  importLrc: () => ipcRenderer.invoke('lyrics:importLrc'),
  getLyricsOffset: (songId: number) => ipcRenderer.invoke('lyrics:getOffset', songId),
  saveLyricsOffset: (songId: number, offsetMs: number) => ipcRenderer.invoke('lyrics:saveOffset', songId, offsetMs),
  searchLrclib: (query: string, artistHint?: string) => ipcRenderer.invoke('lyrics:search', query, artistHint),

  // App Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),

  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Last.fm
  lastfmGetStatus: () => ipcRenderer.invoke('lastfm:getStatus'),
  lastfmAuthenticate: (apiKey: string, apiSecret: string, username: string, password: string) =>
    ipcRenderer.invoke('lastfm:authenticate', apiKey, apiSecret, username, password),
  lastfmDisconnect: () => ipcRenderer.invoke('lastfm:disconnect'),
  lastfmUpdateNowPlaying: (artist: string, title: string, album: string, duration?: number) =>
    ipcRenderer.invoke('lastfm:updateNowPlaying', artist, title, album, duration),
  lastfmScrobble: (artist: string, title: string, album: string, startTs: number, duration?: number) =>
    ipcRenderer.invoke('lastfm:scrobble', artist, title, album, startTs, duration),

  // Events
  onScanProgress: (
    cb: (data: { current: number; total: number; currentFile: string }) => void
  ) => {
    const listener = (_: unknown, data: any) => cb(data)
    ipcRenderer.on('scan:progress', listener)
    return () => ipcRenderer.removeListener('scan:progress', listener)
  },
  onScanComplete: (cb: (data: { count: number }) => void) => {
    const listener = (_: unknown, data: any) => cb(data)
    ipcRenderer.on('scan:complete', listener)
    return () => ipcRenderer.removeListener('scan:complete', listener)
  },

  // Song metadata editing
  updateSong: (songId: number, data: {
    title?: string; artist?: string; album?: string; album_artist?: string
    year?: number | null; genre?: string | null; track_number?: number | null
  }) => ipcRenderer.invoke('song:update', songId, data),

  // Song deletion
  deleteSong: (songId: number, fromDisk: boolean) => ipcRenderer.invoke('song:delete', songId, fromDisk),

  // Cover art
  setCover: (songId: number, imageBase64: string, mimeType: string) =>
    ipcRenderer.invoke('song:setCover', songId, imageBase64, mimeType),
  pickCoverFile: () => ipcRenderer.invoke('song:pickCoverFile') as Promise<{ base64: string; mimeType: string } | null>,
  searchCovers: (query: string) => ipcRenderer.invoke('song:searchCovers', query) as
    Promise<Array<{ id: string; title: string; artist: string; coverUrl: string }>>,
  downloadCover: (url: string) => ipcRenderer.invoke('song:downloadCover', url) as
    Promise<{ base64: string; mimeType: string } | null>,
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  openFolder: (folderPath: string) => ipcRenderer.invoke('shell:openFolder', folderPath),
  pickFolder: () => ipcRenderer.invoke('library:pickFolder') as Promise<string | null>,

  // Mini Player
  toggleMiniPlayer: (mode?: string) => ipcRenderer.invoke('window:toggleMini', mode),
  setMiniMode: (mode: string) => ipcRenderer.invoke('window:setMiniMode', mode),
  showMiniModeMenu: () => ipcRenderer.invoke('window:showMiniModeMenu') as Promise<string | null>,
  setMiniExpanded: (expanded: boolean) => ipcRenderer.invoke('window:setMiniExpanded', expanded),
  onMiniPlayerChange: (cb: (isMini: boolean, mode: string) => void) => {
    const listener = (_: unknown, isMini: boolean, mode: string) => cb(isMini, mode)
    ipcRenderer.on('mini:changed', listener)
    return () => ipcRenderer.removeListener('mini:changed', listener)
  },
  onMiniModeChange: (cb: (mode: string) => void) => {
    const listener = (_: unknown, mode: string) => cb(mode)
    ipcRenderer.on('mini:modeChanged', listener)
    return () => ipcRenderer.removeListener('mini:modeChanged', listener)
  },

  // Wrapped / Listening Report
  getWrapped: (period: 'week' | 'month' | 'all') =>
    ipcRenderer.invoke('library:getWrapped', period),

  // Apple Music Replay
  getReplay: (year: number) => ipcRenderer.invoke('library:getReplay', year),
  getAvailableYears: () => ipcRenderer.invoke('library:getAvailableYears'),

  // Similar Songs
  getSimilarSongs: (songId: number) =>
    ipcRenderer.invoke('library:getSimilarSongs', songId),

  // Duplicate Finder
  getDuplicates: () => ipcRenderer.invoke('library:getDuplicates'),

  // Playlist Cover
  setPlaylistCover: (playlistId: number, coverPath: string | null) =>
    ipcRenderer.invoke('playlist:setCover', playlistId, coverPath),

  // Export / Import
  exportPlaylist: (playlistId: number, format: 'json' | 'm3u') =>
    ipcRenderer.invoke('playlist:export', playlistId, format),
  importPlaylist: () => ipcRenderer.invoke('playlist:import'),

  // Full Backup / Restore
  exportBackup: (versions?: any[]) => ipcRenderer.invoke('data:export', versions),
  importBackup: () => ipcRenderer.invoke('data:import'),

  // File Watcher
  startWatcher: () => ipcRenderer.invoke('watcher:start'),
  stopWatcher: () => ipcRenderer.invoke('watcher:stop'),
  onWatcherChange: (cb: (data: { type: string; folder: string; filename: string }) => void) => {
    const listener = (_: unknown, data: any) => cb(data)
    ipcRenderer.on('watcher:change', listener)
    return () => ipcRenderer.removeListener('watcher:change', listener)
  },

  // Global shortcuts (work even when app is in background)
  onGlobalShortcut: (channel: string, cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (e) {
    console.error(e)
  }
} else {
  // @ts-ignore (non-sandboxed)
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
