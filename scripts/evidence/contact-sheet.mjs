/**
 * CP9: folha de contato das 9 telas obrigatórias (topo de cada captura) para inspeção final.
 * Uso: node scripts/evidence/contact-sheet.mjs <pasta> <largura> <altura do recorte> <saida.png>
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const [dir, width, cropH, out] = process.argv.slice(2)
const W = Number(width)
const H = Number(cropH)
const SCREENS = ['inicio', 'detalhe', 'carrinho', 'pagamento', 'confirmacao', 'login', 'cadastro', 'perfil', 'carteiras']
const scale = W > 1000 ? 0.32 : 0.6
const tw = Math.round(W * scale)
const th = Math.round(H * scale)
const tiles = []
for (const name of SCREENS) {
  const file = path.join(dir, `${name}-${W}.png`)
  if (!fs.existsSync(file)) throw new Error(`faltando: ${file}`)
  const meta = await sharp(file).metadata()
  const img = await sharp(file).extract({ left: 0, top: 0, width: W, height: Math.min(H, meta.height) }).resize({ width: tw }).png().toBuffer()
  const label = Buffer.from(`<svg width="${tw}" height="28"><rect width="100%" height="100%" fill="#0b0705"/><text x="8" y="19" font-family="monospace" font-size="15" fill="#e89b55">${name} @${W}</text></svg>`)
  tiles.push({ img, label })
}
const cols = 3
const rows = Math.ceil(tiles.length / cols)
await sharp({ create: { width: cols * (tw + 12), height: rows * (th + 40), channels: 3, background: '#0b0705' } })
  .composite(tiles.flatMap((t, i) => {
    const x = (i % cols) * (tw + 12)
    const y = Math.floor(i / cols) * (th + 40)
    return [{ input: t.label, left: x, top: y }, { input: t.img, left: x, top: y + 28 }]
  }))
  .png()
  .toFile(out)
console.log(out)
