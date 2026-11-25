/**
 * CP9: verificação do BUILD PÚBLICO (o mesmo que vai para a Vercel), sem as rotas internas.
 * - `/demo`, `/demo/poc` e `/demo/componentes` mostram a página 404 do app;
 * - nenhum chunk `demo.*` é requisitado;
 * - deep links das telas públicas respondem após refresh (rewrites de SPA no preview).
 *
 * Uso: npm run build && npm run preview (em outro terminal) && node scripts/check-public-build.mjs
 * Ou:  node scripts/check-public-build.mjs --serve   (faz build + preview sozinho)
 */
import { execSync, spawn } from 'node:child_process'
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
let server
if (process.argv.includes('--serve')) {
  const env = { ...process.env }
  delete env.VITE_DEMO_ROUTES
  execSync('npm run build', { stdio: 'inherit', env })
  // Grupo de processos próprio (POSIX): no fim, mata o npm E o vite preview filho; senão a porta
  // 4173 ficaria ocupada e o próximo passo (Playwright, --strictPort) falharia.
  server = spawn('npm', ['run', 'preview'], { shell: true, env, stdio: 'ignore', detached: process.platform !== 'win32' })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) break
    } catch {
      // servidor ainda subindo: tenta de novo
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

const browser = await chromium.launch()
const page = await browser.newPage()
const demoChunks = []
page.on('request', (r) => /\/assets\/demo\./.test(r.url()) && demoChunks.push(r.url()))
const failures = []
for (const path of ['/demo', '/demo/poc', '/demo/componentes']) {
  await page.goto(BASE + path)
  const h1 = await page.locator('h1').first().textContent({ timeout: 15_000 })
  const ok = /não encontrada/i.test(h1 ?? '')
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${path} → h1 "${h1?.trim()}"`)
  if (!ok) failures.push(path)
}
for (const path of ['/mercado', '/nft/nft-001', '/login', '/perfil', '/pedidos']) {
  const res = await page.goto(BASE + path)
  const ok = res?.status() === 200
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${path} → HTTP ${res?.status()} (deep link)`)
  if (!ok) failures.push(path)
}
console.log(demoChunks.length ? `FAIL chunks demo requisitados: ${demoChunks.join(', ')}` : 'OK   nenhum chunk demo.* requisitado')
if (demoChunks.length) failures.push('chunks')
await browser.close()
if (server) {
  if (process.platform === 'win32') execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' })
  else process.kill(-server.pid, 'SIGTERM')
}
process.exit(failures.length ? 1 : 0)
