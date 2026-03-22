import { create } from 'zustand'

interface LastFmState {
  connected: boolean
  username: string
  apiKey: string
  apiSecret: string
  isAuthenticating: boolean
  authError: string | null

  lockPlaybar: boolean
  lyricsFontSize: number
  lyricsColor: string
  autoMiniOnMinimize: boolean
  lastMiniMode: string
  setLockPlaybar: (v: boolean) => void
  setLyricsFontSize: (v: number) => void
  setLyricsColor: (v: string) => void
  setAutoMiniOnMinimize: (v: boolean) => void
  setLastMiniMode: (v: string) => void
  loadStatus: () => Promise<void>
  authenticate: (apiKey: string, apiSecret: string, username: string, password: string) => Promise<boolean>
  disconnect: () => Promise<void>
}

export const useSettingsStore = create<LastFmState>((set) => ({
  connected: false,
  username: '',
  apiKey: '',
  apiSecret: '',
  isAuthenticating: false,
  authError: null,

  lockPlaybar: false,
  lyricsFontSize: 20,
  lyricsColor: '#ffffff',
  autoMiniOnMinimize: false,
  lastMiniMode: 'default',
  setLockPlaybar: (v: boolean) => {
    set({ lockPlaybar: v })
    window.api.setSetting('lockPlaybar', v)
  },
  setLyricsFontSize: (v: number) => {
    set({ lyricsFontSize: v })
    window.api.setSetting('lyricsFontSize', v)
  },
  setLyricsColor: (v: string) => {
    set({ lyricsColor: v })
    window.api.setSetting('lyricsColor', v)
  },
  setAutoMiniOnMinimize: (v: boolean) => {
    set({ autoMiniOnMinimize: v })
    window.api.setSetting('autoMiniOnMinimize', v)
  },
  setLastMiniMode: (v: string) => {
    set({ lastMiniMode: v })
    window.api.setSetting('lastMiniMode', v)
  },
  loadStatus: async () => {
    const status = await window.api.lastfmGetStatus()
    const lock = await window.api.getSetting('lockPlaybar')
    const fsize = await window.api.getSetting('lyricsFontSize')
    const fcolor = await window.api.getSetting('lyricsColor')
    const autoMini = await window.api.getSetting('autoMiniOnMinimize')
    const lastM = await window.api.getSetting('lastMiniMode')
    set({
      connected: status.connected,
      username: status.username,
      apiKey: status.apiKey,
      apiSecret: status.apiSecret,
      lockPlaybar: !!lock,
      lyricsFontSize: fsize ? Number(fsize) : 20,
      lyricsColor: fcolor ?? '#ffffff',
      autoMiniOnMinimize: !!autoMini,
      lastMiniMode: (lastM as string) ?? 'default'
    })
  },

  authenticate: async (apiKey, apiSecret, username, password) => {
    set({ isAuthenticating: true, authError: null })
    const result = await window.api.lastfmAuthenticate(apiKey, apiSecret, username, password)
    if (result.success) {
      set({ connected: true, username, apiKey, apiSecret, isAuthenticating: false })
      return true
    } else {
      set({ isAuthenticating: false, authError: result.error ?? 'Connection failed' })
      return false
    }
  },

  disconnect: async () => {
    await window.api.lastfmDisconnect()
    set({ connected: false, username: '', authError: null })
  }
}))
