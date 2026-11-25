/**
 * CP9.2 — perfil de CPU da inicialização (diagnóstico, NÃO é a auditoria oficial).
 *
 * Chromium do Playwright, contexto novo (sem Service Worker nem localStorage), CPU 4× mais lenta
 * (mesmo multiplicador do perfil mobile do Lighthouse). Grava o perfil do V8 até a primeira imagem
 * de NFT visível e atribui o tempo próprio às FONTES ORIGINAIS via sourcemap.
 *
 * Pré-requisitos: `npx vite build --sourcemap` e `npm run preview` em http://localhost:4173.
 * Uso: node scripts/perf/profile-startup.mjs [caminho=/] [execuções=3] [saida=.cache/perf/profile]
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'

const [target = '/', runsArg = '3', out = '.cache/perf/profile'] = process.argv.slice(2)
fs.mkdirSync(out, { recursive: true })
const maps = new Map()
const mapFor = (url) => {
  const file = path.join('dist', new URL(url).pathname)
  if (!maps.has(file)) maps.set(file, fs.existsSync(`${file}.map`) ? new TraceMap(fs.readFileSync(`${file}.map`, 'utf8')) : null)
  return maps.get(file)
}
const bucket = (src) => {
  if (!src) return '(sem fonte)'
  const nm = src.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)
  if (nm) return `npm:${nm[1]}`
  return src.replace(/^.*?\/src\//, 'src/')
}

const totals = new Map()
const fnTotals = new Map()
let grand = 0
const browser = await chromium.launch()
for (let run = 1; run <= Number(runsArg); run++) {
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
  await cdp.send('Profiler.start')
  const t0 = Date.now()
  await page.goto(`http://localhost:4173${target}`)
  await page.waitForFunction(() => [...globalThis.document.images].some((i) => i.src.includes("/assets/nfts/") && i.complete && i.naturalWidth > 0 && i.getBoundingClientRect().top < globalThis.innerHeight), null, { timeout: 60_000 })
  const elapsed = Date.now() - t0
  const { profile } = await cdp.send('Profiler.stop')
  fs.writeFileSync(path.join(out, `run-${run}.cpuprofile`), JSON.stringify(profile))
  // Tempo próprio por nó = amostras × intervalo médio.
  const dt = new Map()
  for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i + 1] ?? 0))
  let runTotal = 0
  for (const node of profile.nodes) {
    const us = dt.get(node.id) ?? 0
    if (!us) continue
    const { url, functionName, lineNumber, columnNumber } = node.callFrame
    if (['(idle)', '(program)', '(garbage collector)'].includes(functionName) && !url) {
      const k = functionName
      totals.set(k, (totals.get(k) ?? 0) + us)
      if (functionName !== '(idle)') runTotal += us
      continue
    }
    runTotal += us
    let src = null
    let name = functionName || '(anônima)'
    if (url.startsWith('http://localhost:4173/assets/')) {
      const tm = mapFor(url)
      if (tm) {
        const pos = originalPositionFor(tm, { line: lineNumber + 1, column: columnNumber })
        src = pos.source
        if (pos.name) name = pos.name
      }
    }
    const b = url.includes('mockServiceWorker') ? 'mockServiceWorker.js' : bucket(src ?? (url ? new URL(url).pathname : null))
    totals.set(b, (totals.get(b) ?? 0) + us)
    const fk = `${b} › ${name}`
    fnTotals.set(fk, (fnTotals.get(fk) ?? 0) + us)
  }
  grand += runTotal
  console.log(`execução ${run}: imagem visível em ${elapsed} ms; CPU ativa ${(runTotal / 1000).toFixed(0)} ms (sob 4×)`)
  await context.close()
}
await browser.close()
const n = Number(runsArg)
const fmt = (us) => `${(us / 1000 / n).toFixed(0).padStart(6)} ms`
console.log(`\nMédia por execução (CPU 4×): ${(grand / 1000 / n).toFixed(0)} ms ativos\n— por origem —`)
for (const [k, v] of [...totals].filter(([k]) => k !== '(idle)').sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(fmt(v), k)
console.log('— funções mais caras —')
for (const [k, v] of [...fnTotals].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(fmt(v), k)
