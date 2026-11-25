/**
 * Comparações lado a lado Figma × implementação NA MESMA ESCALA (pedido da revisão do CP2).
 * A captura do Figma é ampliada pelo fator exato do frame (largura do frame na captura →
 * largura real: 1440 ou 390) e a implementação é usada na escala 1:1; depois as duas são
 * reduzidas pelo MESMO fator para caber na imagem. Assim, tamanhos e espaçamentos são
 * comparáveis diretamente.
 */
import path from 'node:path'
import sharp from 'sharp'

const EV = 'planning/evidence/cp4'
const PAIRS = [
  // Desktop / Login e Cadastro: frames de 371 px (= 1440 reais) na captura 13_10_43.
  {"name":"login-desktop","ref":"Imagem do ChatGPT 24 de nov. de 2026, 13_10_43.png","frame":{"left":63,"top":40,"width":371,"height":510},"realWidth":1440,"ours":"login-1440.png","out":0.45},
  {"name":"cadastro-desktop","ref":"Imagem do ChatGPT 24 de nov. de 2026, 13_10_43.png","frame":{"left":486,"top":40,"width":371,"height":510},"realWidth":1440,"ours":"cadastro-1440.png","out":0.45},
  // Mobile / Login (13_10_51) e Cadastro (13_10_54): frames de 328 px (= 390 reais).
  {"name":"login-mobile","ref":"Imagem do ChatGPT 24 de nov. de 2026, 13_10_51.png","frame":{"left":912,"top":44,"width":328,"height":710},"realWidth":390,"ours":"login-390.png","out":1},
  {"name":"cadastro-mobile","ref":"Imagem do ChatGPT 24 de nov. de 2026, 13_10_54.png","frame":{"left":55,"top":36,"width":328,"height":710},"realWidth":390,"ours":"cadastro-390.png","out":1},
  // Desktop / Perfil e Carteiras: frames de 381 px (= 1440 reais) na captura 13_10_56.
  {"name":"perfil-desktop","ref":"Imagem do ChatGPT 24 de nov. de 2026, 13_10_56.png","frame":{"left":467,"top":62,"width":381,"height":286},"realWidth":1440,"ours":"perfil-1440.png","out":0.45},
  {"name":"carteiras-desktop","ref":"Imagem do ChatGPT 24 de nov. de 2026, 13_10_56.png","frame":{"left":901,"top":62,"width":381,"height":286},"realWidth":1440,"ours":"carteiras-1440.png","out":0.45},
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
      { input: label('Implementação CP4 (1:1)', w), left: w + 24, top: 0 },
      { input: a, left: 0, top: 40 },
      { input: b, left: w + 24, top: 40 },
    ])
    .png()
    .toFile(path.join(EV, `comparacao-${p.name}.png`))
  console.log(`comparacao-${p.name}.png (escala do Figma ${scale.toFixed(3)})`)
}
