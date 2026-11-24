/**
 * Gera os PLACEHOLDERS TEMPORÁRIOS das artes de NFT a partir das capturas de referência.
 *
 * Contexto: o Figma do desafio está numa equipe restrita, somente consulta e sem login.
 * Exportar e inspecionar exigem conta, e não temos autorização (decisão do candidato no CP2).
 * Recortamos SOMENTE a arte individual de cada personagem, em regiões sem sobreposição de
 * comentários do Figma, nunca a tela inteira. Cada arte está listada como faltante em
 * planning/ASSETS_MANIFEST.md.
 *
 * Etapas:
 *  1. Recorte na resolução nativa da captura (72–270 px).
 *  2. (Opcional) Super-resolução 4x com Real-ESRGAN (realesrgan-ncnn-vulkan, modelo
 *     realesrgan-x4plus), executado localmente. Autorizado pelo candidato no CP2 para
 *     reduzir a pixelização. A IA RECONSTRÓI detalhe plausível: não é a arte original.
 *     Indique o binário em REALESRGAN_BIN; sem ele, usa apenas Lanczos3.
 *  3. Saída quadrada em 512 px (WebP + AVIF) e manifest.json com a origem de cada arquivo.
 *
 * Os arquivos finais ficam versionados em public/assets/nfts: o checkout limpo não precisa
 * do Real-ESRGAN.
 *
 * Uso: REALESRGAN_BIN=".cache/realesrgan/bin/realesrgan-ncnn-vulkan.exe" node scripts/assets/build-placeholders.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SRC = {
  mobileHomeDetail: 'Imagem do ChatGPT 24 de nov. de 2026, 13_10_47.png',
  mobileCartPayLogin: 'Imagem do ChatGPT 24 de nov. de 2026, 13_10_51.png',
}
const OUT = path.resolve('public/assets/nfts')
const WORK = path.resolve('.cache/upscale')
const FINAL_SIZE = 512
const BIN = process.env.REALESRGAN_BIN ? path.resolve(process.env.REALESRGAN_BIN) : null
const MODEL = 'realesrgan-x4plus'

/** Regiões medidas nas capturas (px da imagem de origem). Todas sem sobreposição. */
const ARTWORKS = [
  { id: 'emerald-ape', source: 'mobileHomeDetail', region: { left: 520, top: 89, width: 270, height: 256 }, note: 'Mobile / Detalhes do NFT, imagem principal' },
  { id: 'sage-nomad', source: 'mobileHomeDetail', region: { left: 235, top: 352, width: 116, height: 116 }, note: 'Mobile / Início, card da coluna direita' },
  { id: 'violet-nomad', source: 'mobileCartPayLogin', region: { left: 58, top: 213, width: 75, height: 72 }, note: 'Mobile / Carrinho, miniatura 2' },
  { id: 'ivory-baron', source: 'mobileCartPayLogin', region: { left: 58, top: 309, width: 75, height: 72 }, note: 'Mobile / Carrinho, miniatura 3' },
  { id: 'golden-beat', source: 'mobileCartPayLogin', region: { left: 58, top: 404, width: 75, height: 72 }, note: 'Mobile / Carrinho, miniatura 4' },
]

const useAi = BIN !== null && existsSync(BIN)
if (BIN && !useAi) throw new Error(`REALESRGAN_BIN não encontrado: ${BIN}`)

await rm(WORK, { recursive: true, force: true })
await mkdir(path.join(WORK, 'in'), { recursive: true })
await mkdir(path.join(WORK, 'out'), { recursive: true })
await mkdir(OUT, { recursive: true })

// 1. Recorte nativo, quadrado (proporção 1:1 dos cards do Figma).
for (const art of ARTWORKS) {
  const size = Math.min(art.region.width, art.region.height)
  art.nativeSize = size
  await sharp(SRC[art.source]).extract(art.region).resize(size, size, { fit: 'cover' }).png().toFile(path.join(WORK, 'in', `${art.id}.png`))
}

// 2. Super-resolução (opcional).
// Tiles de 64 px, GPU 0 e uma thread de processamento: com o tile automático, a Intel Iris Xe
// deste ambiente perdeu o dispositivo ("vkQueueSubmit failed -4") e gerou saídas corrompidas
// sem erro de saída. Por isso há também a verificação de sanidade abaixo.
if (useAi) {
  for (const art of ARTWORKS) {
    execFileSync(
      BIN,
      ['-i', path.join(WORK, 'in', `${art.id}.png`), '-o', path.join(WORK, 'out', `${art.id}.png`), '-n', MODEL, '-s', '4', '-t', '64', '-g', '0', '-j', '1:1:1', '-m', path.join(path.dirname(BIN), 'models')],
      { stdio: 'ignore' },
    )
    const [a, b] = await Promise.all([
      sharp(path.join(WORK, 'in', `${art.id}.png`)).stats(),
      sharp(path.join(WORK, 'out', `${art.id}.png`)).stats(),
    ])
    const drift = Math.max(...[0, 1, 2].map((c) => Math.abs(a.channels[c].mean - b.channels[c].mean)))
    if (drift > 12) throw new Error(`Saída do upscaler suspeita para ${art.id} (desvio de cor média ${drift.toFixed(1)}). Abortando.`)
  }
}

// 3. Saída final.
const manifest = []
for (const art of ARTWORKS) {
  const input = path.join(WORK, useAi ? 'out' : 'in', `${art.id}.png`)
  const pipeline = sharp(input).resize(FINAL_SIZE, FINAL_SIZE, { fit: 'cover', kernel: 'lanczos3' })
  await pipeline.clone().webp({ quality: 86 }).toFile(path.join(OUT, `${art.id}.webp`))
  await pipeline.clone().avif({ quality: 60 }).toFile(path.join(OUT, `${art.id}.avif`))
  manifest.push({
    id: art.id,
    width: FINAL_SIZE,
    height: FINAL_SIZE,
    nativeSize: art.nativeSize,
    upscaler: useAi ? `Real-ESRGAN ncnn-vulkan v0.2.5.0 (${MODEL}, 4x) + Lanczos3` : 'Lanczos3',
    source: SRC[art.source],
    region: art.region,
    note: art.note,
    status: 'placeholder-temporario',
  })
  console.log(`${art.id}: ${art.nativeSize}px → ${FINAL_SIZE}px (${useAi ? 'IA' : 'Lanczos3'})`)
}
await writeFile(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
