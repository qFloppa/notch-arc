import { useEffect, useState } from 'react'

/*
 * notch.jpg is a 3D render of the tally-stick on a near-black background. Dropping that
 * background with a CSS blend leaves a faint rectangle on the app's (also dark) surfaces,
 * so instead we key it out for real: once, on first use, we luminance-key the dark pixels
 * to transparent, auto-crop to the subject, and cache the resulting PNG data URL. No image
 * tooling or build step — just a canvas. Every placement then uses a clean transparent mark.
 */

let cache: Promise<string> | null = null

/** Clamped linear ramp: dark background → alpha 0, bright subject → alpha 255. */
function alphaForLuminance(l: number): number {
  const LO = 16
  const HI = 46
  if (l <= LO) return 0
  if (l >= HI) return 255
  return Math.round(((l - LO) / (HI - LO)) * 255)
}

function keyAndCrop(img: HTMLImageElement): string {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return '/notch.jpg'
  ctx.drawImage(img, 0, 0)
  const image = ctx.getImageData(0, 0, w, h)
  const px = image.data

  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
      const a = alphaForLuminance(l)
      px[i + 3] = a
      if (a > 24) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  ctx.putImageData(image, 0, 0)

  if (maxX < minX || maxY < minY) return canvas.toDataURL('image/png') // nothing keyed — bail safely

  const pad = Math.round(Math.max(w, h) * 0.015)
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(w - 1, maxX + pad)
  maxY = Math.min(h - 1, maxY + pad)
  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  const out = document.createElement('canvas')
  out.width = cw
  out.height = ch
  out.getContext('2d')?.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch)
  return out.toDataURL('image/png')
}

function processNotchLogo(): Promise<string> {
  if (cache) return cache
  cache = new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try { resolve(keyAndCrop(img)) } catch { resolve('/notch.jpg') }
    }
    img.onerror = reject
    img.src = '/notch.jpg'
  })
  return cache
}

interface Props {
  width: number
  height: number
  rotate?: number
  glow?: boolean
  opacity?: number
  grayscale?: boolean
  className?: string
  style?: React.CSSProperties
}

export default function NotchLogo({ width, height, rotate = 0, glow = true, opacity = 1, grayscale = false, className, style }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let on = true
    void processNotchLogo().then(s => { if (on) setSrc(s) }).catch(() => {})
    return () => { on = false }
  }, [])

  const filters = [
    glow ? 'drop-shadow(0 3px 12px rgba(58,130,246,0.45))' : '',
    grayscale ? 'grayscale(65%)' : '',
  ].filter(Boolean).join(' ')

  // Hold the layout box until the cutout is ready, so nothing flashes or shifts.
  if (!src) return <span aria-hidden className={className} style={{ display: 'inline-block', width, height, ...style }} />

  return (
    <img
      src={src}
      alt="Notch"
      aria-hidden={opacity < 0.3 || undefined}
      className={className}
      style={{
        width,
        height,
        objectFit: 'contain',
        opacity,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        filter: filters || undefined,
        userSelect: 'none',
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
