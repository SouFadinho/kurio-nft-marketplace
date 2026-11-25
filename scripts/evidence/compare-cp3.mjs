/**
 * Comparações lado a lado Figma × implementação NA MESMA ESCALA (pedido da revisão do CP2).
 * A captura do Figma é ampliada pelo fator exato do frame (largura do frame na captura →
 * largura real: 1440 ou 390) e a implementação é usada na escala 1:1; depois as duas são
 * reduzidas pelo MESMO fator para caber na imagem. Assim, tamanhos e espaçamentos são
 * comparáveis diretamente.
 */
import path from 'node:path'
import sharp from 'sharp'

const EV = 'planning/evidence/cp3'
const PAIRS = [
  // Desktop / Início: frame de 1440 ocupa x 29–401 (372 px) na captura 13_10_32.
  { name: 'inicio-desktop', ref: 'planning/referencias-figma/Imagem do ChatGPT 24 de nov. de 2026, 13_10_32.png', frame: { left: 29, top: 74, width: 372, height: 692 }, realWidth: 1440, ours: 'inicio-1440-pagina.png', out: 0.45 },
  // Desktop / Detalhes: frame x 452–796 (344 px) na mesma captura.
  { name: 'detalhe-desktop', ref: 'planning/referencias-figma/Imagem do ChatGPT 24 de nov. de 2026, 13_10_32.png', frame: { left: 452, top: 75, width: 344, height: 580 }, realWidth: 1440, ours: 'detalhe-1440-pagina.png', out: 0.45 },
  // Mobile / Início e Detalhes: frames de 328 px (= 390 px reais) na captura 13_10_47.
  { name: 'inicio-mobile', ref: 'planning/referencias-figma/Imagem do ChatGPT 24 de nov. de 2026, 13_10_47.png', frame: { left: 50, top: 37, width: 328, height: 710 }, realWidth: 390, ours: 'inicio-390-pagina.png', out: 1 },
  { name: 'detalhe-mobile', ref: 'planning/referencias-figma/Imagem do ChatGPT 24 de nov. de 2026, 13_10_47.png', frame: { left: 489, top: 37, width: 328, height: 710 }, realWidth: 390, ours: 'detalhe-390-pagina.png', out: 1 },
]

const label = (text, width) =>
  Buffer.from(`<svg width="${width}" height="40"><rect width="100%" height="100%" fill="#0b0705"/><text x="12" y="26" font-family="monospace" font-size="18" fill="#e89b55">${text}</text></svg>`)

for (const p of PAIRS) {
  const scale = p.realWidth / p.frame.width
  const refH = Math.round(p.frame.height * scale)
  const ref = await sharp(p.ref).extract(p.frame).resize({ width: p.realWidth, kernel: 'lanczos3' }).png().toBuffer()
  const meta = await sharp(path.join(EV, p.ours)).metadata()
  const ours = await sharp(path.join(EV, p.ours)).extract({ left: 0, top: 0, width: p.realWidth, height: Math.min(refH, meta.height) }).png().toBuffer()
  const w = Math.round(p.realWidth * p.out)
  const [a, b] = await Promise.all([ref, ours].map((buf) => sharp(buf).resize({ width: w, kernel: 'lanczos3' }).png().toBuffer()))
  const [am, bm] = await Promise.all([sharp(a).metadata(), sharp(b).metadata()])
  const h = Math.max(am.height, bm.height)
  await sharp({ create: { width: w * 2 + 24, height: h + 40, channels: 3, background: '#0b0705' } })
    .composite([
      { input: label(`Figma (captura × ${scale.toFixed(2)})`, w), left: 0, top: 0 },
      { input: label('Implementação CP3 (1:1)', w), left: w + 24, top: 0 },
      { input: a, left: 0, top: 40 },
      { input: b, left: w + 24, top: 40 },
    ])
    .png()
    .toFile(path.join(EV, `comparacao-${p.name}.png`))
  console.log(`comparacao-${p.name}.png (escala do Figma ${scale.toFixed(3)})`)
}
