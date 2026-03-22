export interface LyricsFont {
  name: string
  css: string
  google?: boolean // true = load from Google Fonts
}

export const LYRICS_FONTS: LyricsFont[] = [
  // ── System ──
  { name: 'System Default', css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },

  // ── Sans-Serif (Modern) ──
  { name: 'Inter', css: "'Inter', sans-serif", google: true },
  { name: 'Roboto', css: "'Roboto', sans-serif", google: true },
  { name: 'Open Sans', css: "'Open Sans', sans-serif", google: true },
  { name: 'Lato', css: "'Lato', sans-serif", google: true },
  { name: 'Poppins', css: "'Poppins', sans-serif", google: true },
  { name: 'Nunito', css: "'Nunito', sans-serif", google: true },
  { name: 'Montserrat', css: "'Montserrat', sans-serif", google: true },
  { name: 'Raleway', css: "'Raleway', sans-serif", google: true },
  { name: 'Work Sans', css: "'Work Sans', sans-serif", google: true },
  { name: 'DM Sans', css: "'DM Sans', sans-serif", google: true },
  { name: 'Plus Jakarta Sans', css: "'Plus Jakarta Sans', sans-serif", google: true },
  { name: 'Outfit', css: "'Outfit', sans-serif", google: true },
  { name: 'Quicksand', css: "'Quicksand', sans-serif", google: true },
  { name: 'Comfortaa', css: "'Comfortaa', sans-serif", google: true },
  { name: 'Exo 2', css: "'Exo 2', sans-serif", google: true },
  { name: 'Ubuntu', css: "'Ubuntu', sans-serif", google: true },
  { name: 'Signika', css: "'Signika', sans-serif", google: true },

  // ── Display / Condensed ──
  { name: 'Oswald', css: "'Oswald', sans-serif", google: true },
  { name: 'Bebas Neue', css: "'Bebas Neue', sans-serif", google: true },
  { name: 'Barlow Condensed', css: "'Barlow Condensed', sans-serif", google: true },
  { name: 'Righteous', css: "'Righteous', sans-serif", google: true },
  { name: 'Abril Fatface', css: "'Abril Fatface', serif", google: true },
  { name: 'Cinzel', css: "'Cinzel', serif", google: true },

  // ── Serif ──
  { name: 'Playfair Display', css: "'Playfair Display', serif", google: true },
  { name: 'Merriweather', css: "'Merriweather', serif", google: true },
  { name: 'Lora', css: "'Lora', serif", google: true },
  { name: 'Libre Baskerville', css: "'Libre Baskerville', serif", google: true },
  { name: 'Cormorant Garamond', css: "'Cormorant Garamond', serif", google: true },

  // ── Cursive / Handwritten ──
  { name: 'Dancing Script', css: "'Dancing Script', cursive", google: true },
  { name: 'Pacifico', css: "'Pacifico', cursive", google: true },
  { name: 'Satisfy', css: "'Satisfy', cursive", google: true },
  { name: 'Caveat', css: "'Caveat', cursive", google: true },
  { name: 'Lobster', css: "'Lobster', cursive", google: true },
  { name: 'Kaushan Script', css: "'Kaushan Script', cursive", google: true },
  { name: 'Amatic SC', css: "'Amatic SC', cursive", google: true },
  { name: 'Permanent Marker', css: "'Permanent Marker', cursive", google: true },

  // ── Typewriter / Retro ──
  { name: 'Special Elite', css: "'Special Elite', cursive", google: true },
  { name: 'Courier Prime', css: "'Courier Prime', monospace", google: true },

  // ── Monospace ──
  { name: 'Fira Code', css: "'Fira Code', monospace", google: true },
  { name: 'JetBrains Mono', css: "'JetBrains Mono', monospace", google: true },
  { name: 'Space Mono', css: "'Space Mono', monospace", google: true },
  { name: 'IBM Plex Mono', css: "'IBM Plex Mono', monospace", google: true },
]

const loadedFonts = new Set<string>()

export function loadGoogleFont(name: string): void {
  const font = LYRICS_FONTS.find(f => f.name === name)
  if (!font?.google || loadedFonts.has(name)) return
  loadedFonts.add(name)

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;600;700;800&display=swap`
  document.head.appendChild(link)
}
