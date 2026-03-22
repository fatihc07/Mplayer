import { BrowserWindow } from 'electron'
import { readdir, stat } from 'fs/promises'
import { join, extname, basename } from 'path'
import { parseFile } from 'music-metadata'
import { insertSong, persist, SongInsert } from './database'
import { coverCache } from './cover-cache'

const AUDIO_EXTS = new Set([
  '.mp3', '.flac', '.aac', '.m4a', '.ogg', '.wav', '.wma', '.opus', '.ape'
])

export async function scanDirectory(
  dirPath: string,
  window: BrowserWindow
): Promise<{ count: number }> {
  const files: string[] = []
  await collectFiles(dirPath, files)

  const total = files.length
  let processed = 0
  let added = 0

  for (const filePath of files) {
    try {
      const meta = await parseFile(filePath, { duration: true, skipCovers: false })
      const c = meta.common
      const f = meta.format

      let hasCover = false
      if (c.picture?.length) {
        await coverCache().save(filePath, c.picture[0].data)
        hasCover = true
      }

      const fileStat = await stat(filePath)

      const song: SongInsert = {
        path: filePath,
        title: c.title || basename(filePath, extname(filePath)),
        artist: c.artist || c.artists?.[0],
        album: c.album,
        albumArtist: c.albumartist,
        duration: f.duration,
        year: c.year ?? null,
        genre: c.genre?.[0] ?? null,
        trackNumber: c.track?.no ?? null,
        hasCover,
        fileSize: fileStat.size,
        bitrate: typeof f.bitrate === 'number' ? Math.round(f.bitrate) : 0
      }

      insertSong(song)
      added++
    } catch {
      // Unreadable metadata – skip silently
    }

    processed++

    if (processed % 20 === 0 || processed === total) {
      window.webContents.send('scan:progress', {
        current: processed,
        total,
        currentFile: files[processed - 1]?.split(/[\\/]/).pop() ?? ''
      })
    }

    if (processed % 200 === 0) persist()
  }

  persist()
  window.webContents.send('scan:complete', { count: added })
  return { count: added }
}

async function collectFiles(dir: string, out: string[]): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        await collectFiles(full, out)
      } else if (e.isFile() && AUDIO_EXTS.has(extname(e.name).toLowerCase())) {
        out.push(full)
      }
    }
  } catch {
    // Permission errors – skip
  }
}
