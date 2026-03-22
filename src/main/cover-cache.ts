import { app } from 'electron'
import { join } from 'path'
import { createHash } from 'crypto'
import fs from 'fs'
import { mkdirSync } from 'fs'

class CoverCache {
  private dir: string

  constructor() {
    this.dir = join(app.getPath('userData'), 'covers')
    mkdirSync(this.dir, { recursive: true })
  }

  private key(songPath: string): string {
    return createHash('md5').update(songPath).digest('hex')
  }

  coverPath(songPath: string): string {
    return join(this.dir, `${this.key(songPath)}.jpg`)
  }

  async save(songPath: string, data: Uint8Array | Buffer, force = false): Promise<void> {
    const p = this.coverPath(songPath)
    if (force || !fs.existsSync(p)) fs.writeFileSync(p, data)
  }

  has(songPath: string): boolean {
    return fs.existsSync(this.coverPath(songPath))
  }

  getBase64(songPath: string): string | null {
    const p = this.coverPath(songPath)
    if (!fs.existsSync(p)) return null
    return `data:image/jpeg;base64,${fs.readFileSync(p).toString('base64')}`
  }

  getMplayerUrl(songPath: string): string | null {
    const p = this.coverPath(songPath)
    if (!fs.existsSync(p)) return null
    const encoded = encodeURIComponent(p.replace(/\\/g, '/'))
    return `mplayer://local/${encoded}`
  }
}

let instance: CoverCache | null = null
export function coverCache(): CoverCache {
  if (!instance) instance = new CoverCache()
  return instance
}
