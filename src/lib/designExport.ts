import { crops, designColours, formatSpecs, type DesignFormat } from './designFormats'
import type { DepartmentKey, DesignStyle } from '../types/domain'

/**
 * Renders a design to a PNG at its real size. Measurements mirror the on-screen canvas CSS
 * (all in % of the canvas width, i.e. "cqw"), so the download matches what was approved.
 */
type Metrics = {
  photo: number // share of height (stack) or width (split) taken by the photo
  padTop: number
  padBottom: number
  padX: number
  gap: number
  brand: number
  headline: number
  headlineLines: number
  rule: [number, number]
  offer: number
  offerLines: number
  cta: number
  ctaPad: [number, number]
}

const metrics: Record<DesignFormat, Metrics> = {
  'Social square': { photo: 0.56, padTop: 4.5, padBottom: 4.5, padX: 7, gap: 1.6, brand: 2.3, headline: 6, headlineLines: 2, rule: [9, 0.45], offer: 3, offerLines: 2, cta: 2.4, ctaPad: [1.6, 3.4] },
  'Instagram story': { photo: 0.5, padTop: 7, padBottom: 24, padX: 9, gap: 2.4, brand: 3.4, headline: 8.4, headlineLines: 3, rule: [9, 0.45], offer: 4.6, offerLines: 2, cta: 3.8, ctaPad: [2.4, 5] },
  'Email header': { photo: 0.56, padTop: 2.4, padBottom: 2.4, padX: 3.2, gap: 1, brand: 1.1, headline: 3, headlineLines: 3, rule: [4, 0.22], offer: 1.45, offerLines: 2, cta: 1.15, ctaPad: [0.8, 1.6] },
  'Website banner': { photo: 0.62, padTop: 2.4, padBottom: 2.4, padX: 3.2, gap: 1, brand: 1.1, headline: 2.5, headlineLines: 3, rule: [4, 0.22], offer: 1.25, offerLines: 2, cta: 1.15, ctaPad: [0.8, 1.6] },
}

export type DesignInput = {
  format: DesignFormat
  area: DepartmentKey
  image: string
  brand: string
  headline: string
  offerText: string
  cta: string
  style: DesignStyle
  variant: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The photo could not be loaded'))
    // Ask for a sharper source than the on-screen thumbnail.
    image.src = src.startsWith('data:') ? src : src.replace(/([?&])w=\d+/, '$1w=2400')
  })
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.split(' ').slice(0, -1).join(' ')
  kept[maxLines - 1] = `${last}…`
  return kept
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  // letterSpacing is widely supported in current browsers; older ones just ignore it.
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`
}

export async function renderDesignPng(input: DesignInput): Promise<Blob> {
  const spec = formatSpecs[input.format]
  const m = metrics[input.format]
  const W = spec.width
  const H = spec.height
  const u = W / 100 // 1cqw
  const colours = designColours(input.area, input.style)
  const minimal = input.style === 'Minimal'

  await Promise.all([document.fonts.load(`500 ${Math.round(m.headline * u)}px "Playfair Display"`), document.fonts.load(`600 ${Math.round(m.headline * u)}px "Playfair Display"`), document.fonts.load(`700 20px "DM Sans"`), document.fonts.load(`400 20px "DM Sans"`)])
  const photo = await loadImage(input.image)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser')

  // Layout: photo and copy panel never overlap.
  const split = spec.layout === 'split'
  const flipped = split && input.variant % 2 === 1
  const photoRect = split
    ? { x: flipped ? W * (1 - m.photo) : 0, y: 0, w: W * m.photo, h: H }
    : { x: 0, y: 0, w: W, h: H * m.photo }
  const panel = split
    ? { x: flipped ? 0 : W * m.photo, y: 0, w: W * (1 - m.photo), h: H }
    : { x: 0, y: H * m.photo, w: W, h: H * (1 - m.photo) }

  ctx.fillStyle = colours.panel
  ctx.fillRect(0, 0, W, H)

  // Photo, cropped like object-fit: cover with the chosen focus point.
  const [fx, fy] = crops[input.variant % crops.length].split(' ').map((value) => parseFloat(value) / 100)
  const scale = Math.max(photoRect.w / photo.naturalWidth, photoRect.h / photo.naturalHeight)
  const sw = photoRect.w / scale
  const sh = photoRect.h / scale
  const sx = (photo.naturalWidth - sw) * fx
  const sy = (photo.naturalHeight - sh) * fy
  ctx.drawImage(photo, sx, sy, sw, sh, photoRect.x, photoRect.y, photoRect.w, photoRect.h)

  // Copy block, vertically centred in the panel.
  const maxWidth = panel.w - 2 * m.padX * u
  const blocks: { height: number; draw: (y: number) => void }[] = []
  const x = panel.x + m.padX * u

  if (!minimal) {
    const size = m.brand * u
    blocks.push({
      height: size * 1.2,
      draw: (y) => {
        ctx.font = `700 ${size}px "DM Sans"`
        setSpacing(ctx, size * 0.25)
        ctx.fillStyle = colours.accent
        ctx.textBaseline = 'top'
        ctx.fillText(input.brand.toUpperCase(), x, y)
        setSpacing(ctx, 0)
      },
    })
  }

  const headSize = m.headline * u
  ctx.font = `${input.style === 'Bold' ? 600 : 500} ${headSize}px "Playfair Display"`
  const headLines = wrap(ctx, input.headline, maxWidth, m.headlineLines)
  blocks.push({
    height: headLines.length * headSize * 1.12,
    draw: (y) => {
      ctx.font = `${input.style === 'Bold' ? 600 : 500} ${headSize}px "Playfair Display"`
      ctx.fillStyle = colours.heading
      ctx.textBaseline = 'top'
      headLines.forEach((line, index) => ctx.fillText(line, x, y + index * headSize * 1.12))
    },
  })

  blocks.push({
    height: Math.max(1, m.rule[1] * u),
    draw: (y) => {
      ctx.fillStyle = colours.accent
      ctx.fillRect(x, y, m.rule[0] * u, Math.max(1, m.rule[1] * u))
    },
  })

  const showOffer = input.offerText.trim() && input.offerText.trim().toLowerCase() !== input.headline.trim().toLowerCase()
  if (showOffer) {
    const size = m.offer * u
    ctx.font = `400 ${size}px "DM Sans"`
    const lines = wrap(ctx, input.offerText, maxWidth, m.offerLines)
    blocks.push({
      height: lines.length * size * 1.3,
      draw: (y) => {
        ctx.font = `400 ${size}px "DM Sans"`
        ctx.fillStyle = colours.text
        ctx.textBaseline = 'top'
        lines.forEach((line, index) => ctx.fillText(line, x, y + index * size * 1.3))
      },
    })
  }

  const ctaSize = m.cta * u
  ctx.font = `700 ${ctaSize}px "DM Sans"`
  setSpacing(ctx, ctaSize * (minimal ? 0.08 : 0.12))
  const ctaText = input.cta.toUpperCase()
  const ctaWidth = ctx.measureText(ctaText).width
  setSpacing(ctx, 0)
  const [padY, padX] = minimal ? [0, 0] : [m.ctaPad[0] * u, m.ctaPad[1] * u]
  blocks.push({
    height: 0.8 * u + ctaSize * 1.2 + padY * 2 + (minimal ? 0.85 * u : 0),
    draw: (y) => {
      const top = y + 0.8 * u
      if (!minimal) {
        ctx.fillStyle = colours.ctaBg
        ctx.fillRect(x, top, ctaWidth + padX * 2, ctaSize * 1.2 + padY * 2)
      }
      ctx.font = `700 ${ctaSize}px "DM Sans"`
      setSpacing(ctx, ctaSize * (minimal ? 0.08 : 0.12))
      ctx.fillStyle = colours.ctaText
      ctx.textBaseline = 'top'
      ctx.fillText(ctaText, x + padX, top + padY + ctaSize * 0.1)
      setSpacing(ctx, 0)
      if (minimal) {
        ctx.fillStyle = colours.accent
        ctx.fillRect(x, top + ctaSize * 1.2 + 0.5 * u, ctaWidth, Math.max(1, 0.35 * u))
      }
    },
  })

  const gap = m.gap * u
  const total = blocks.reduce((sum, block) => sum + block.height, 0) + gap * (blocks.length - 1)
  const top = panel.y + m.padTop * u
  const available = panel.h - (m.padTop + m.padBottom) * u
  let y = top + Math.max(0, (available - total) / 2)
  for (const block of blocks) {
    block.draw(y)
    y += block.height + gap
  }

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))), 'image/png'))
}
