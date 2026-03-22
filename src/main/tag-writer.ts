import { File as TagFile, ByteVector, Picture, PictureLazy, PictureType } from 'node-taglib-sharp'
import fs from 'fs'

export interface TagWriteData {
  title?: string
  artist?: string
  album?: string
  albumArtist?: string
  year?: number | null
  genre?: string | null
  trackNumber?: number | null
}

export function writeTagsToFile(filePath: string, data: TagWriteData): void {
  const file = TagFile.createFromPath(filePath)
  try {
    const tag = file.tag

    if (data.title !== undefined) tag.title = data.title
    if (data.artist !== undefined) tag.performers = data.artist ? [data.artist] : []
    if (data.album !== undefined) tag.album = data.album
    if (data.albumArtist !== undefined) tag.albumArtists = data.albumArtist ? [data.albumArtist] : []
    if (data.year !== undefined) tag.year = data.year ?? 0
    if (data.genre !== undefined) tag.genres = data.genre ? [data.genre] : []
    if (data.trackNumber !== undefined) tag.track = data.trackNumber ?? 0

    file.save()
  } finally {
    file.dispose()
  }
}

export function writeCoverToFile(filePath: string, imageData: Buffer, mimeType: string): void {
  const file = TagFile.createFromPath(filePath)
  try {
    const pic = Picture.fromData(ByteVector.fromByteArray(imageData))
    pic.mimeType = mimeType
    pic.type = PictureType.FrontCover
    pic.description = 'Cover'

    file.tag.pictures = [pic]
    file.save()
  } finally {
    file.dispose()
  }
}
