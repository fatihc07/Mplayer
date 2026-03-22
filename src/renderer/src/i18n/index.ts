import { create } from 'zustand'
import { tr } from './tr'
import { en } from './en'

export type Lang = 'tr' | 'en'
export type Translations = typeof tr

const translations: Record<Lang, Translations> = { tr, en }

interface I18nState {
  lang: Lang
  t: Translations
  setLang: (l: Lang) => void
  loadLang: () => Promise<void>
}

export const useI18n = create<I18nState>((set) => ({
  lang: 'tr',
  t: tr,
  setLang: (l) => {
    set({ lang: l, t: translations[l] })
    window.api.setSetting('language', l)
  },
  loadLang: async () => {
    const saved = (await window.api.getSetting('language')) as Lang | null
    if (saved && translations[saved]) {
      set({ lang: saved, t: translations[saved] })
    }
  }
}))
