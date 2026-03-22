export interface Song {
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
  cover?: string | null
}

export interface Artist {
  name: string
  song_count: number
  total_plays: number
  cover_path?: string | null
  is_favorite?: number
}

export interface Album {
  name: string
  artist: string
  song_count: number
  year: number | null
  cover_path?: string | null
  format?: string | null
}

export interface Stats {
  total_songs: number
  total_plays: number
  total_artists: number
  total_albums: number
}

export interface HistoryEntry {
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
  day_count: number
  is_favorite: number
}

export interface SearchResult {
  songs: Song[]
  artists: Artist[]
  albums: Album[]
}

export interface Playlist {
  id: number
  name: string
  description: string
  cover_path: string | null
  created_at: number
  updated_at: number
  song_count: number
}

export type ViewType =
  | 'trends'
  | 'artists'
  | 'library'
  | 'songs'
  | 'history'
  | 'like'
  | 'playlists'
  | 'settings'
  | 'folders'
  | 'stats'
  | 'versions'
  | 'wrapped'
  | 'replay'
  | 'duplicates'
