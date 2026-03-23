import { create } from 'zustand'
import { Song } from '../types'

interface DeezerTrack {
  id: number
  title: string
  artist: { name: string }
  album: { title: string; cover_medium: string }
  duration: number
  preview: string
}

interface DeezerAlbum {
  id: number
  title: string
  cover_medium: string
  artist: { name: string }
}

interface DeezerArtist {
  id: number
  name: string
  picture_medium: string
}

interface DeezerPlaylist {
  id: number
  title: string
  picture_medium: string
  nb_tracks: number
}


interface DeezerState {
  tracks: DeezerTrack[]
  albums: DeezerAlbum[]
  artists: DeezerArtist[]
  playlists: DeezerPlaylist[]
  isSearching: boolean
  searchAll: (query: string) => Promise<void>
  loadInitialData: () => Promise<void>
  playDeezerTrack: (track: DeezerTrack) => Promise<void>
}

export const useDeezerStore = create<DeezerState>((set) => ({
  tracks: [],
  albums: [],
  artists: [],
  playlists: [],
  isSearching: false,

  loadInitialData: async () => {
    set({ isSearching: true })
    try {
      const res = await fetch('https://api.deezer.com/chart/0')
      const data = await res.json()
      set({ 
        tracks: data.tracks.data || [],
        albums: data.albums.data || [],
        artists: data.artists.data || [],
        playlists: (data.playlists?.data || []).slice(0, 10),
        isSearching: false 
      })
    } catch (err) {
      console.error('[Deezer] Load initial failed:', err)
      set({ isSearching: false })
    }
  },

  searchAll: async (query: string) => {

    if (!query.trim()) return
    set({ isSearching: true })
    try {
      const [tracks, albums, artists] = await Promise.all([
        window.api.deezerSearch(query),
        fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(query)}`).then(r => r.json()).then(d => d.data || []),
        fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}`).then(r => r.json()).then(d => d.data || [])
      ])
      set({ tracks, albums: albums.slice(0, 8), artists: artists.slice(0, 10), isSearching: false })
    } catch (err) {
      console.error('[Deezer] Search failed:', err)
      set({ isSearching: false })
    }
  },


  playDeezerTrack: async (track: DeezerTrack) => {
    const { deezerArl } = (await import('./settingsStore')).useSettingsStore.getState()
    const { playSong } = (await import('./playerStore')).usePlayerStore.getState()

    // Create a Song-compatible object
    const song: Song = {
      id: -track.id, // Use negative ID for online tracks to avoid conflicts with local DB
      path: track.preview, // Fallback to preview initially
      title: track.title,
      artist: track.artist.name,
      album: track.album.title,
      album_artist: track.artist.name,
      duration: track.duration,
      has_cover: 1,
      play_count: 0,
      is_favorite: 0,
      date_added: Date.now(),
      year: null,
      genre: null,
      track_number: null,
      file_size: 0,
      last_played: null,
      rating: 0,
      bitrate: 128 // Default for preview
    }

    // Try to get full stream URL if ARL is available
    if (deezerArl) {
      const fullUrl = await window.api.deezerGetStreamUrl(track.id.toString(), deezerArl)
      if (fullUrl) {
        song.path = fullUrl
        song.bitrate = fullUrl.includes('flac') ? 1411 : 320
      }
    }

    playSong(song, [])
  }
}))
