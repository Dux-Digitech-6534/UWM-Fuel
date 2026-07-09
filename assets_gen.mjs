import sharp from 'sharp'
import { mkdirSync } from 'fs'

const LOGO = 'C:/Users/HP/Downloads/Uwm logo.jpg'
const OUT = 'assets'
mkdirSync(OUT, { recursive: true })
const IRIS = '#5C4DE6'

async function logoBuf(size) {
  return sharp(LOGO).resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer()
}

// 1) icon-foreground: transparent 1024 with logo centered (~58% -> safe zone)
async function iconForeground() {
  const s = 1024, l = 592
  const logo = await logoBuf(l)
  await sharp({ create: { width: s, height: s, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, left: (s - l) / 2, top: (s - l) / 2 }]).png().toFile(`${OUT}/icon-foreground.png`)
}
// 2) icon-background: solid white
async function iconBackground() {
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .png().toFile(`${OUT}/icon-background.png`)
}
// 3) icon-only (legacy square): white bg + logo, rounded look handled by launcher
async function iconOnly() {
  const s = 1024, l = 660
  const logo = await logoBuf(l)
  await sharp({ create: { width: s, height: s, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: logo, left: (s - l) / 2, top: (s - l) / 2 }]).png().toFile(`${OUT}/icon-only.png`)
}
// 4) splash: iris background + white rounded card holding the logo, centered
async function splash(file) {
  const S = 2732, card = 900, radius = 190, l = 620
  const bg = { create: { width: S, height: S, channels: 4, background: IRIS } }
  const cardSvg = Buffer.from(
    `<svg width="${card}" height="${card}"><rect width="${card}" height="${card}" rx="${radius}" ry="${radius}" fill="#ffffff"/></svg>`)
  const logo = await logoBuf(l)
  const cardPng = await sharp(cardSvg).png().toBuffer()
  await sharp(bg)
    .composite([
      { input: cardPng, left: (S - card) / 2, top: (S - card) / 2 },
      { input: logo, left: (S - l) / 2, top: (S - l) / 2 },
    ]).png().toFile(`${OUT}/${file}`)
}

await iconForeground()
await iconBackground()
await iconOnly()
await splash('splash.png')
await splash('splash-dark.png')
console.log('assets generated')
