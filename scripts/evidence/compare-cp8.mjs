/**
 * CP8: comparações Figma × antes × depois NA MESMA ESCALA (mesmo método de compare-cp3/4/5).
 * - Figma: o frame da captura é ampliado pelo fator exato (largura do frame → 1440 ou 390).
 * - Antes: baseline visual do CP7 (início, carrinho, pagamento) ou a última captura da tela
 *   antes do CP8 (carteiras e login: CP4; recibo: CP6).
 * - Depois: captura do CP8 (`planning/evidence/cp8`).
 * As três são recortadas na altura do frame do Figma e reduzidas pelo MESMO fator.
 * O recibo não tem frame no Figma (VISUAL_ANALYSIS §14): só antes × depois.
 *
 * Uso: node scripts/evidence/compare-cp8.mjs
 */
import path from 'node:path'
import sharp from 'sharp'

const OUT = 'planning/evidence/cp8'
const B = 'planning/evidence/cp8-baselines/antes'
const REF = (t) => `planning/referencias-figma/Imagem do ChatGPT 24 de nov. de 2026, ${t}.png`
const PAIRS = [
  { name: 'inicio-desktop', ref: REF('13_10_32'), frame: { left: 29, top: 74, width: 372, height: 692 }, realWidth: 1440, before: `${B}/inicio-desktop-chromium-win32.png`, beforeLabel: 'Antes (baseline CP7)', after: `${OUT}/inicio-1440.png`, out: 0.4 },
  { name: 'inicio-mobile', ref: REF('13_10_47'), frame: { left: 50, top: 37, width: 328, height: 710 }, realWidth: 390, before: `${B}/inicio-mobile-chromium-win32.png`, beforeLabel: 'Antes (baseline CP7)', after: `${OUT}/inicio-390.png`, out: 1 },
  { name: 'carrinho-mobile', ref: REF('13_10_51'), frame: { left: 33, top: 44, width: 328, height: 710 }, realWidth: 390, before: `${B}/carrinho-mobile-chromium-win32.png`, beforeLabel: 'Antes (baseline CP7)', after: `${OUT}/carrinho-390.png`, out: 1 },
  { name: 'pagamento-desktop', ref: REF('13_10_59'), frame: { left: 893, top: 79, width: 382, height: 445 }, realWidth: 1440, before: `${B}/pagamento-desktop-chromium-win32.png`, beforeLabel: 'Antes (baseline CP7)', after: `${OUT}/pagamento-1440.png`, out: 0.4 },
  { name: 'carteiras-desktop', ref: REF('13_10_56'), frame: { left: 901, top: 62, width: 381, height: 286 }, realWidth: 1440, before: 'planning/evidence/cp4/carteiras-1440.png', beforeLabel: 'Antes (captura CP4)', after: `${OUT}/carteiras-1440.png`, out: 0.4 },
  { name: 'login-desktop', ref: REF('13_10_43'), frame: { left: 63, top: 40, width: 371, height: 510 }, realWidth: 1440, before: 'planning/evidence/cp4/login-1440.png', beforeLabel: 'Antes (captura CP4)', after: `${OUT}/login-1440.png`, out: 0.4 },
  { name: 'recibo-desktop', ref: null, height: 1050, realWidth: 1440, before: 'planning/evidence/cp6/recibo-confirmado-1440.png', beforeLabel: 'Antes (captura CP6)', after: `${OUT}/confirmacao-1440.png`, out: 0.5 },
]

const label = (text, width) =>
  Buffer.from(`<svg width="${width}" height="40"><rect width="100%" height="100%" fill="#0b0705"/><text x="12" y="26" font-family="monospace" font-size="18" fill="#e89b55">${text}</text></svg>`)

const crop = async (file, width, height) => {
  const meta = await sharp(file).metadata()
  return sharp(file).extract({ left: 0, top: 0, width, height: Math.min(height, meta.height) }).png().toBuffer()
}

for (const p of PAIRS) {
  const cols = []
  let height = p.height
  if (p.ref) {
    const scale = p.realWidth / p.frame.width
    height = Math.round(p.frame.height * scale)
    cols.push({ title: `Figma (captura × ${scale.toFixed(2)})`, buf: await sharp(p.ref).extract(p.frame).resize({ width: p.realWidth, kernel: 'lanczos3' }).png().toBuffer() })
  }
  cols.push({ title: p.beforeLabel, buf: await crop(p.before, p.realWidth, height) })
  cols.push({ title: 'Depois (CP8)', buf: await crop(p.after, p.realWidth, height) })
  const w = Math.round(p.realWidth * p.out)
  const imgs = await Promise.all(cols.map((c) => sharp(c.buf).resize({ width: w, kernel: 'lanczos3' }).png().toBuffer()))
  const hs = await Promise.all(imgs.map(async (b) => (await sharp(b).metadata()).height))
  const h = Math.max(...hs)
  await sharp({ create: { width: w * cols.length + 24 * (cols.length - 1), height: h + 40, channels: 3, background: '#0b0705' } })
    .composite(cols.flatMap((c, i) => [
      { input: label(c.title, w), left: i * (w + 24), top: 0 },
      { input: imgs[i], left: i * (w + 24), top: 40 },
    ]))
    .png()
    .toFile(path.join(OUT, `comparacao-${p.name}.png`))
  console.log(`comparacao-${p.name}.png`)
}
