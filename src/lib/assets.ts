import { seedAssets } from '../data/brain'
import { parseCsv } from './audience'
import type { AssetKind, MediaAsset } from '../types/domain'
import { usePersistentState } from './usePersistentState'

export const ASSETS_KEY = 'otel:assets'
export const assetKinds: AssetKind[] = ['Brand', 'Image', 'Video', 'Template', 'Brochure', 'Menu', 'Price list', 'Report']
/** Reports feed the AI's business data; everything else is creative for campaigns. */
export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024

export function useAssets() {
  return usePersistentState<MediaAsset[]>(ASSETS_KEY, seedAssets)
}

export function kindFromFile(name: string, type = ''): AssetKind {
  const lower = name.toLowerCase()
  if (type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/.test(lower)) return 'Video'
  if (/menu/.test(lower)) return 'Menu'
  if (/price|tariff|rates/.test(lower)) return 'Price list'
  if (/logo|brand|guideline|font/.test(lower)) return 'Brand'
  if (/template/.test(lower)) return 'Template'
  if (/report|pickup|export|trading|diary|sheet/.test(lower) || /\.(csv|xlsx?|txt)$/.test(lower)) return 'Report'
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/.test(lower)) return 'Image'
  if (/\.pdf$/.test(lower)) return 'Brochure'
  return 'Brand'
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** A small JPEG preview for images, so the library can show thumbnails without storing the original. */
export async function makePreview(file: File, maxSize = 360): Promise<string | undefined> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return undefined
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const data = canvas.toDataURL('image/jpeg', 0.7)
    return data.length < 120_000 ? data : undefined
  } catch {
    return undefined
  }
}

// ---------- Report extraction ----------

export const readableReport = (name: string) => /\.(csv|txt)$/i.test(name)

/**
 * Reads simple CSV reports without the AI: either "metric,value" rows, or a header row with
 * one row per period (the latest row is used). Returns null when the layout isn't recognisable.
 */
export function parseReportCsv(text: string): Record<string, string> | null {
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell !== ''))
  if (rows.length < 2) return null
  const pairs = rows.every((row) => row.length === 2 || (row.length > 2 && row.slice(2).every((cell) => cell === '')))
  if (pairs) {
    const body = /^(metric|field|name|kpi)$/i.test(rows[0][0]) ? rows.slice(1) : rows
    const fields = Object.fromEntries(body.filter((row) => row[0] && row[1]).map((row) => [row[0], row[1]]))
    return Object.keys(fields).length ? fields : null
  }
  const [header, ...data] = rows
  const latest = data[data.length - 1]
  const fields = Object.fromEntries(header.map((col, index) => [col, latest[index] ?? '']).filter(([col, value]) => col && value))
  return Object.keys(fields).length ? fields : null
}
