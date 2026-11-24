/**
 * Gera uma arte ÚNICA por NFT do catálogo a partir dos 5 personagens disponíveis
 * (public/assets/nfts/<personagem>.webp, placeholders do CP2).
 *
 * Técnica: variação do traço "Fundo" (prática comum em coleções de NFT). O personagem é
 * preservado; só o fundo é recolorido. O espelhamento horizontal amplia as combinações.
 * - Máscara do fundo: crescimento de região a partir das bordas SUPERIOR e LATERAIS
 *   (a borda inferior é evitada porque roupas claras tocam o rodapé da arte). Um pixel entra
 *   na máscara se for parecido com o vizinho já aceito E com a cor média das sementes.
 * - Recoloração: mantém a luminância relativa do fundo original (o degradê é preservado).
 * - Artes escuras (Ivory Baron, Violet Nomad) recebem ajuste de tom (pedido do CP2).
 *
 * Isto NÃO é arte original do Figma: é uma variação derivada, documentada em
 * planning/ASSETS_MANIFEST.md. Uso: node scripts/assets/build-variants.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const BASE = path.resolve('public/assets/nfts')
const OUT = path.join(BASE, 'catalog')
const SIZE = 512

/** Ajuste de tom por personagem (artes escuras do CP2). */
const TONE = {
  'emerald-ape': null,
  'sage-nomad': null,
  'violet-nomad': { brightness: 1.1, gamma: 1.12, linear: [1.05, 4] },
  'ivory-baron': { brightness: 1.3, gamma: 1.6, linear: [1.06, 10] },
  'golden-beat': null,
}

/** Paleta de fundos, coerente com as referências (creme, sálvia, verde-água, pêssego...). */
export const BACKGROUNDS = {
  original: null,
  creme: [238, 230, 208],
  salvia: [207, 220, 196],
  menta: [204, 229, 219],
  pessego: [241, 216, 194],
  ceu: [212, 225, 236],
  lilas: [222, 214, 234],
  areia: [232, 219, 190],
}

async function loadRaw(file, tone) {
  let img = sharp(file).resize(SIZE, SIZE).removeAlpha()
  if (tone) img = img.gamma(tone.gamma).modulate({ brightness: tone.brightness }).linear(tone.linear[0], tone.linear[1])
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  return { data, w: info.width, h: info.height }
}

function backgroundMask({ data, w, h }) {
  const idx = (x, y) => (y * w + x) * 3
  const dist = (a, b) => Math.hypot(data[a] - data[b], data[a + 1] - data[b + 1], data[a + 2] - data[b + 2])
  const seeds = []
  for (let x = 0; x < w; x += 2) seeds.push([x, 0])
  for (let y = 0; y < Math.floor(h * 0.6); y += 2) seeds.push([0, y], [w - 1, y])
  const mean = [0, 0, 0]
  for (const [x, y] of seeds) for (let c = 0; c < 3; c++) mean[c] += data[idx(x, y) + c] / seeds.length
  const toMean = (i) => Math.hypot(data[i] - mean[0], data[i + 1] - mean[1], data[i + 2] - mean[2])

  const mask = new Uint8Array(w * h)
  const stack = []
  for (const [x, y] of seeds) if (toMean(idx(x, y)) < 70) stack.push([x, y])
  while (stack.length) {
    const [x, y] = stack.pop()
    const p = y * w + x
    if (mask[p]) continue
    mask[p] = 255
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || mask[ny * w + nx]) continue
      const a = idx(x, y)
      const b = idx(nx, ny)
      if (dist(a, b) < 14 && toMean(b) < 70) stack.push([nx, ny])
    }
  }
  return { mask, mean }
}

async function variant(character, bgName, flip) {
  const raw = await loadRaw(path.join(BASE, `${character}.webp`), TONE[character])
  let rgb = Buffer.from(raw.data)
  const target = BACKGROUNDS[bgName]
  let coverage = 0
  if (target) {
    const { mask, mean } = backgroundMask(raw)
    // Borda suave da máscara (evita serrilhado no contorno do personagem).
    // extractChannel(0): o blur do sharp devolve 3 canais; sem isso o índice da máscara
    // fica desalinhado e a recoloração invade o personagem (defeito visto no CP3).
    const soft = await sharp(Buffer.from(mask), { raw: { width: raw.w, height: raw.h, channels: 1 } }).blur(1.4).extractChannel(0).raw().toBuffer()
    if (soft.length !== raw.w * raw.h) throw new Error(`máscara com tamanho inesperado: ${soft.length}`)
    const meanLum = (mean[0] + mean[1] + mean[2]) / 3
    for (let p = 0; p < raw.w * raw.h; p++) {
      const m = soft[p] / 255
      if (m === 0) continue
      coverage += mask[p] ? 1 : 0
      const i = p * 3
      const lum = (rgb[i] + rgb[i + 1] + rgb[i + 2]) / 3 / meanLum
      for (let c = 0; c < 3; c++) rgb[i + c] = Math.round(rgb[i + c] * (1 - m) + Math.min(255, target[c] * lum) * m)
    }
  }
  let img = sharp(rgb, { raw: { width: raw.w, height: raw.h, channels: 3 } })
  if (flip) img = img.flop()
  return { img, coverage: coverage / (raw.w * raw.h) }
}

// Especificações vêm do próprio catálogo do mock (fonte única), importado via type stripping do Node.
const { ART_SPECS: specs } = await import('../../src/mocks/fixtures/catalog.ts')
await mkdir(OUT, { recursive: true })
const report = []
for (const s of specs) {
  const { img, coverage } = await variant(s.character, s.background, s.flip)
  const png = await img.png().toBuffer()
  await sharp(png).webp({ quality: 84 }).toFile(path.join(OUT, `${s.file}.webp`))
  // Recorte de detalhe para a galeria (rosto, 1.45x).
  if (s.gallery) {
    const crop = Math.round(SIZE / 1.45)
    await sharp(png).extract({ left: Math.round((SIZE - crop) / 2), top: Math.round(SIZE * 0.12), width: crop, height: crop }).resize(SIZE, SIZE).webp({ quality: 84 }).toFile(path.join(OUT, `${s.file}-detalhe.webp`))
  }
  report.push({ ...s, backgroundCoverage: Number(coverage.toFixed(3)) })
}
await writeFile(path.join(OUT, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(`${report.length} artes geradas em ${OUT}`)
