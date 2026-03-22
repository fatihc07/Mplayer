import { create } from 'zustand'
import { Song } from '../types'

type RepeatMode = 'none' | 'one' | 'all'

interface PlayerState {
  currentSong: Song | null
  queue: Song[]
  queueIndex: number
  isPlaying: boolean
  progress: number
  duration: number
  volume: number
  isMuted: boolean
  shuffle: boolean
  repeat: RepeatMode
  shuffledIndices: number[]

  playSong: (song: Song, queue?: Song[], index?: number) => void
  pauseResume: () => void
  nextSong: () => void
  prevSong: () => void
  seekTo: (time: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  setProgress: (p: number) => void
  setDuration: (d: number) => void
  setIsPlaying: (v: boolean) => void
  incrementCurrentPlayCount: () => void
  resetCurrentSongPlayCount: () => void
  toggleFavoriteCurrentSong: () => void

  // Queue management
  playNext: (song: Song) => void
  addToQueue: (song: Song) => void
  removeFromQueue: (index: number) => void
  clearUpcoming: () => void
  reorderQueue: (fromIndex: number, toIndex: number) => void
}

function makeShuffled(length: number, currentIdx: number): number[] {
  const indices = Array.from({ length }, (_, i) => i).filter((i) => i !== currentIdx)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return [currentIdx, ...indices]
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  shuffle: false,
  repeat: 'none',
  shuffledIndices: [],

  playSong: (song, queue, index) => {
    const q = queue ?? [song]
    const idx = index ?? q.findIndex((s) => s.id === song.id)
    const realIdx = idx >= 0 ? idx : 0
    set({
      currentSong: song,
      queue: q,
      queueIndex: realIdx,
      isPlaying: true,
      progress: 0,
      shuffledIndices: get().shuffle ? makeShuffled(q.length, realIdx) : []
    })
    // play_count is incremented at 80% listen threshold (see App.tsx)
  },

  pauseResume: () => set((s) => ({ isPlaying: !s.isPlaying })),

  nextSong: () => {
    const { queue, queueIndex, shuffle, shuffledIndices, repeat } = get()
    if (!queue.length) return

    if (repeat === 'one') {
      set({ progress: 0, isPlaying: true })
      return
    }

    const order = shuffle && shuffledIndices.length ? shuffledIndices : queue.map((_, i) => i)
    const posInOrder = order.indexOf(queueIndex)
    const nextPos = posInOrder + 1

    if (nextPos >= order.length) {
      if (repeat === 'all') {
        const nextIdx = order[0]
        set({ queueIndex: nextIdx, currentSong: queue[nextIdx], progress: 0, isPlaying: true })
      } else {
        set({ isPlaying: false })
      }
    } else {
      const nextIdx = order[nextPos]
      set({ queueIndex: nextIdx, currentSong: queue[nextIdx], progress: 0, isPlaying: true })
    }
  },

  prevSong: () => {
    const { queue, queueIndex, shuffle, shuffledIndices, progress } = get()
    if (!queue.length) return

    if (progress > 3) { set({ progress: 0 }); return }

    const order = shuffle && shuffledIndices.length ? shuffledIndices : queue.map((_, i) => i)
    const posInOrder = order.indexOf(queueIndex)
    const prevPos = posInOrder - 1

    if (prevPos < 0) {
      set({ progress: 0 })
    } else {
      const prevIdx = order[prevPos]
      set({ queueIndex: prevIdx, currentSong: queue[prevIdx], progress: 0, isPlaying: true })
    }
  },

  seekTo: (p) => set({ progress: p }),
  setVolume: (v) => set({ volume: v, isMuted: v === 0 }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleShuffle: () => {
    const { shuffle, queue, queueIndex } = get()
    set({
      shuffle: !shuffle,
      shuffledIndices: !shuffle ? makeShuffled(queue.length, queueIndex) : []
    })
  },
  cycleRepeat: () => {
    const map: Record<RepeatMode, RepeatMode> = { none: 'all', all: 'one', one: 'none' }
    set((s) => ({ repeat: map[s.repeat] }))
  },
  setProgress: (p) => set({ progress: p }),
  setDuration: (d) => set({ duration: isFinite(d) ? d : (get().currentSong?.duration ?? 0) }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  incrementCurrentPlayCount: () => {
    const { currentSong } = get()
    if (currentSong) {
      set({ currentSong: { ...currentSong, play_count: currentSong.play_count + 1 } })
    }
  },
  resetCurrentSongPlayCount: () => {
    const { currentSong } = get()
    if (currentSong) {
      set({ currentSong: { ...currentSong, play_count: 0 } })
    }
  },
  toggleFavoriteCurrentSong: () => {
    const { currentSong } = get()
    if (currentSong) {
      set({ currentSong: { ...currentSong, is_favorite: currentSong.is_favorite ? 0 : 1 } })
    }
  },

  // ── Queue management ──────────────────────────────────────────────────────
  playNext: (song) => {
    const { queue, queueIndex } = get()
    const newQueue = [...queue]
    newQueue.splice(queueIndex + 1, 0, song)
    set({ queue: newQueue })
  },

  addToQueue: (song) => {
    set((s) => ({ queue: [...s.queue, song] }))
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex } = get()
    if (index === queueIndex) return
    const newQueue = queue.filter((_, i) => i !== index)
    set({
      queue: newQueue,
      queueIndex: index < queueIndex ? queueIndex - 1 : queueIndex
    })
  },

  clearUpcoming: () => {
    const { queue, queueIndex } = get()
    set({ queue: queue.slice(0, queueIndex + 1) })
  },

  reorderQueue: (fromIndex, toIndex) => {
    const { queue, queueIndex } = get()
    if (fromIndex === toIndex) return
    if (fromIndex <= queueIndex || toIndex <= queueIndex) return
    const newQueue = [...queue]
    const [moved] = newQueue.splice(fromIndex, 1)
    newQueue.splice(toIndex, 0, moved)
    set({ queue: newQueue })
  }
}))
