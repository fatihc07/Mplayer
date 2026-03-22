import { create } from 'zustand'

interface LastFmState {
  connected: boolean
  username: string
  apiKey: string
  apiSecret: string
  isAuthenticating: boolean
  authError: string | null

  lockPlaybar: boolean
  setLockPlaybar: (v: boolean) => void
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
  setLockPlaybar: (v: boolean) => {
    set({ lockPlaybar: v })
    window.api.setSetting('lockPlaybar', v)
  },
  loadStatus: async () => {
    const status = await window.api.lastfmGetStatus()
    const lock = await window.api.getSetting('lockPlaybar')
    set({
      connected: status.connected,
      username: status.username,
      apiKey: status.apiKey,
      apiSecret: status.apiSecret,
      lockPlaybar: !!lock
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
