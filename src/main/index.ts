import { app, shell, BrowserWindow, protocol, net, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIpcHandlers } from './ipc-handlers'
import { initDatabase } from './database'
import icon from '../../resources/icon.png?asset'

// ── MUST be called before app is ready ───────────────────────────────────────
// 'stream: true' enables Range request support → required for seeking & FLAC
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mplayer',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])

function createWindow(): void {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const winW = Math.round(sw * 0.9)
  const winH = Math.round(sh * 0.9)
  const mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    minWidth: 1060,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : { icon }),
    frame: false,
    backgroundColor: '#0B0B1E',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Audio MIME types – explicit mapping ensures FLAC/OGG/OPUS etc. play correctly
const AUDIO_MIME: Record<string, string> = {
  mp3:  'audio/mpeg',
  flac: 'audio/flac',
  wav:  'audio/wav',
  ogg:  'audio/ogg',
  opus: 'audio/ogg; codecs=opus',
  m4a:  'audio/mp4',
  aac:  'audio/aac',
  wma:  'audio/x-ms-wma',
  ape:  'audio/x-ape',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp'
}

function getMime(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return AUDIO_MIME[ext] ?? 'application/octet-stream'
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.mplayer.app')

  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))

  // Custom protocol: mplayer://local/<per-segment-encoded-path>
  // Supports Range requests (required for seeking and lossless audio / FLAC)
  protocol.handle('mplayer', async (request) => {
    try {
      const url = new URL(request.url)
      // pathname example: /C%3A/Users/Music/My%20Song.flac
      const segments = url.pathname.slice(1).split('/')
      const filePath = segments.map(decodeURIComponent).join('/')
      const fileUrl = pathToFileURL(filePath).toString()
      // Forward Range headers so scrubbing / seeking works
      const response = await net.fetch(fileUrl, { headers: request.headers })
      // Build new headers with explicit Content-Type for audio formats
      const headers = new Headers(response.headers)
      headers.set('Content-Type', getMime(filePath))
      headers.set('Accept-Ranges', 'bytes')
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
    } catch (err) {
      console.error('[MPlayer] protocol error:', err)
      return new Response('Not found', { status: 404 })
    }
  })

  await initDatabase()
  setupIpcHandlers()
  createWindow()

  // ── Global keyboard shortcuts (work even when app is in background) ────────
  const send = (channel: string): void => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send(channel)
  }

  globalShortcut.register('MediaPlayPause', () => send('global:playPause'))
  globalShortcut.register('MediaNextTrack', () => send('global:next'))
  globalShortcut.register('MediaPreviousTrack', () => send('global:prev'))
  globalShortcut.register('MediaStop', () => send('global:playPause'))

  // Ctrl+Alt combos for when media keys are not available
  globalShortcut.register('Ctrl+Alt+Space', () => send('global:playPause'))
  globalShortcut.register('Ctrl+Alt+Right', () => send('global:next'))
  globalShortcut.register('Ctrl+Alt+Left', () => send('global:prev'))
  globalShortcut.register('Ctrl+Alt+Up', () => send('global:volumeUp'))
  globalShortcut.register('Ctrl+Alt+Down', () => send('global:volumeDown'))
  globalShortcut.register('Ctrl+Alt+M', () => send('global:mute'))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
