import { create } from 'zustand'
import { Song, Artist, Album, Stats, ViewType, HistoryEntry } from '../types'

interface ScanProgress {
  current: number
  total: number
  currentFile: string
}

interface LibraryState {
  songs: Song[]
  totalSongs: number
  artists: Artist[]
  albums: Album[]
  trending: Song[]
  recent: Song[]
  history: HistoryEntry[]
  totalHistory: number
  favorites: Song[]
  totalFavorites: number
  favoriteArtists: Artist[]
  stats: Stats | null
  currentView: ViewType
  artistDetail: string | null
  pendingAlbum: string | null
  isScanning: boolean
  scanProgress: ScanProgress
  searchQuery: string
  folders: string[]
  isLoading: boolean

  editingSong: Song | null
  setEditingSong: (song: Song | null) => void

  setCurrentView: (v: ViewType) => void
  setArtistDetail: (name: string | null) => void
  setPendingAlbum: (album: string | null) => void
  setSearchQuery: (q: string) => void
  loadInitial: () => Promise<void>
  loadSongs: (limit?: number, offset?: number, search?: string) => Promise<void>
  loadTrending: () => Promise<void>
  loadArtists: () => Promise<void>
  loadAlbums: () => Promise<void>
  loadStats: () => Promise<void>
  loadFolders: () => Promise<void>
  loadHistory: (limit?: number, offset?: number) => Promise<void>
  loadFavorites: (limit?: number, offset?: number) => Promise<void>
  toggleFavorite: (songId: number) => Promise<void>
  loadFavoriteArtists: () => Promise<void>
  toggleFavoriteArtist: (artistName: string) => Promise<void>
  deleteHistoryEntry: (songId: number, playedAt: number) => Promise<void>
  addAndScanFolder: () => Promise<void>
  refreshAfterScan: () => Promise<void>
  reloadHistoryIfActive: () => void
  reloadFavoritesIfActive: () => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  songs: [],
  totalSongs: 0,
  artists: [],
  albums: [],
  trending: [],
  recent: [],
  history: [],
  totalHistory: 0,
  favorites: [],
  totalFavorites: 0,
  favoriteArtists: [],
  stats: null,
  currentView: 'trends',
  artistDetail: null,
  pendingAlbum: null,
  isScanning: false,
  scanProgress: { current: 0, total: 0, currentFile: '' },
  searchQuery: '',
  folders: [],
  isLoading: false,

  editingSong: null,
  setEditingSong: (song) => set({ editingSong: song }),

  setCurrentView: (v) => set({ currentView: v, artistDetail: null, pendingAlbum: null }),
  setArtistDetail: (name) => set({ artistDetail: name, currentView: 'artists' }),
  setPendingAlbum: (album) => set({ pendingAlbum: album }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  loadInitial: async () => {
    await Promise.all([
      get().loadFolders(),
      get().loadStats(),
      get().loadTrending(),
      get().loadArtists(),
      get().loadSongs()
    ])
    set({ history: [], totalHistory: 0 })
  },

  loadSongs: async (limit = 100, offset = 0, search) => {
    set({ isLoading: true })
    const s = search ?? get().searchQuery
    const [songs, total] = await Promise.all([
      window.api.getSongs({ limit, offset, search: s }),
      window.api.getTotalSongs(s)
    ])
    set((state) =>
      offset === 0
        ? { songs, totalSongs: total, isLoading: false }
        : { songs: [...state.songs, ...songs], totalSongs: total, isLoading: false }
    )
  },

  loadHistory: async (limit = 100, offset = 0) => {
    const [history, total] = await Promise.all([
      window.api.getHistory({ limit, offset }),
      window.api.getTotalHistory()
    ])
    set((state) =>
      offset === 0
        ? { history, totalHistory: total }
        : { history: [...state.history, ...history], totalHistory: total }
    )
  },

  loadFavorites: async (limit = 100, offset = 0) => {
    const [favorites, total] = await Promise.all([
      window.api.getFavorites({ limit, offset }),
      window.api.getTotalFavorites()
    ])
    set((state) =>
      offset === 0
        ? { favorites, totalFavorites: total }
        : { favorites: [...state.favorites, ...favorites], totalFavorites: total }
    )
  },

  toggleFavorite: async (songId: number) => {
    await window.api.toggleFavorite(songId)
    const toggle = (s: Song) =>
      s.id === songId ? { ...s, is_favorite: s.is_favorite ? 0 : 1 } : s
    set((state) => ({
      songs: state.songs.map(toggle),
      trending: state.trending.map(toggle),
      recent: state.recent.map(toggle),
      favorites: state.favorites.map(toggle)
    }))
    if (get().currentView === 'like') {
      get().loadFavorites()
    }
  },

  loadFavoriteArtists: async () => {
    const favArtists = await window.api.getFavoriteArtists()
    set({ favoriteArtists: favArtists })
  },

  toggleFavoriteArtist: async (artistName: string) => {
    await window.api.toggleFavoriteArtist(artistName)
    // update artists list to reflect is_favorite change
    set((state) => ({
      artists: state.artists.map((a) =>
        a.name === artistName ? { ...a, is_favorite: a.is_favorite ? 0 : 1 } : a
      )
    }))
    // reload the favorites list if it's currently shown
    if (get().currentView === 'like') {
      await get().loadFavoriteArtists()
    } else {
      await get().loadFavoriteArtists()
    }
  },

  deleteHistoryEntry: async (songId: number, playedAt: number) => {
    await window.api.deleteHistoryEntry(songId, playedAt)
    set((state) => ({
      history: state.history.filter((h) => !(h.song_id === songId && h.played_at === playedAt)),
      totalHistory: state.totalHistory - 1
    }))
  },

  loadTrending: async () => {
    const [trending, recent] = await Promise.all([
      window.api.getTrending(),
      window.api.getRecent()
    ])
    set({ trending, recent })
  },

  loadArtists: async () => set({ artists: await window.api.getArtists() }),
  loadAlbums: async () => set({ albums: await window.api.getAlbums() }),
  loadStats: async () => set({ stats: await window.api.getStats() }),
  loadFolders: async () => set({ folders: await window.api.getFolders() }),

  addAndScanFolder: async () => {
    const folderPath = await window.api.addFolder()
    if (!folderPath) return

    set({ isScanning: true, scanProgress: { current: 0, total: 0, currentFile: '' } })

    const offProgress = window.api.onScanProgress((data) =>
      set({ scanProgress: data })
    )
    const offComplete = window.api.onScanComplete(async () => {
      offProgress()
      offComplete()
      set({ isScanning: false })
      await get().refreshAfterScan()
    })

    await window.api.scanLibrary(folderPath)
  },

  refreshAfterScan: async () => {
    await Promise.all([
      get().loadSongs(),
      get().loadTrending(),
      get().loadArtists(),
      get().loadAlbums(),
      get().loadStats(),
      get().loadFolders()
    ])
  },

  // Called from NowPlaying/Player after 80% threshold fires
  reloadHistoryIfActive: () => {
    if (get().currentView === 'history') get().loadHistory()
  },
  reloadFavoritesIfActive: () => {
    if (get().currentView === 'like') get().loadFavorites()
  }
}))
