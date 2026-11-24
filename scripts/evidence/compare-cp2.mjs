/**
 * Monta comparações lado a lado (Figma × implementação) para o relatório do CP2.
 * Esquerda: recorte da captura do Figma, ampliado para a mesma altura. Direita: captura
 * da implementação (gerada por `EVIDENCE=1 npx playwright test --project=evidence`).
 * As capturas do Figma têm baixa resolução e marcadores de comentário: servem para comparar
 * composição, proporção, hierarquia e espaçamento, não detalhes de pixel.
 */
import path from 'node:path'
import sharp from 'sharp'

const EV = 'planning/evidence/cp2'
const REF = {
  homeDesk: 'Imagem do ChatGPT 24 de nov. de 2026, 13_10_32.png',
  mobile: 'Imagem do ChatGPT 24 de nov. de 2026, 13_10_47.png',
  mobileCart: 'Imagem do ChatGPT 24 de nov. de 2026, 13_10_51.png',
  profile: 'Imagem do ChatGPT 24 de nov. de 2026, 13_10_56.png',
}
const PAIRS = [
  { name: 'header-desktop', ref: REF.homeDesk, region: { left: 29, top: 74, width: 372, height: 26 }, ours: 'el-header-desktop.png', height: 160 },
  { name: 'footer-desktop', ref: REF.homeDesk, region: { left: 478, top: 490, width: 318, height: 166 }, ours: 'el-footer-desktop.png', height: 640 },
  { name: 'conta-desktop', ref: REF.profile, region: { left: 490, top: 80, width: 340, height: 210 }, ours: 'el-conta-desktop.png', height: 560 },
  { name: 'cards-mobile', ref: REF.mobile, region: { left: 62, top: 300, width: 306, height: 370 }, ours: 'el-cards-mobile.png', height: 760 },
  { name: 'bottom-nav-mobile', ref: REF.mobile, region: { left: 50, top: 668, width: 328, height: 78 }, ours: 'el-bottom-nav-mobile.png', height: 140 },
  { name: 'carrinho-mobile', ref: REF.mobileCart, region: { left: 33, top: 50, width: 328, height: 440 }, ours: 'el-carrinho-mobile.png', height: 760 },
]

const label = (text, width) =>
  Buffer.from(`<svg width="${width}" height="36"><rect width="100%" height="100%" fill="#0b0705"/><text x="12" y="24" font-family="monospace" font-size="16" fill="#e89b55">${text}</text></svg>`)

for (const p of PAIRS) {
  const left = await sharp(p.ref).extract(p.region).resize({ height: p.height, kernel: 'lanczos3' }).png().toBuffer()
  const right = await sharp(path.join(EV, p.ours)).resize({ height: p.height, kernel: 'lanczos3' }).png().toBuffer()
  const [lm, rm] = await Promise.all([sharp(left).metadata(), sharp(right).metadata()])
  const gap = 24
  const width = lm.width + rm.width + gap
  await sharp({ create: { width, height: p.height + 36, channels: 3, background: '#0b0705' } })
    .composite([
      { input: label('Figma (captura)', lm.width), left: 0, top: 0 },
      { input: label('Implementação CP2', rm.width), left: lm.width + gap, top: 0 },
      { input: left, left: 0, top: 36 },
      { input: right, left: lm.width + gap, top: 36 },
    ])
    .png()
    .toFile(path.join(EV, `comparacao-${p.name}.png`))
  console.log(`comparacao-${p.name}.png`)
}
