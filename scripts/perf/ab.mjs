/**
 * CP9.2 — comparação A/B INTERCALADA (diagnóstico, não é a auditoria oficial).
 *
 * A máquina de medição (notebook, CPU híbrida) varia ao longo do tempo (`benchmarkIndex` do próprio
 * Lighthouse entre ~1500 e ~2300). Comparar lotes sequenciais mistura a mudança com essa deriva.
 * Aqui dois builds são servidos ao mesmo tempo (vite preview em portas diferentes) e as execuções
 * se alternam A, B, A, B…, com a mesma configuração mobile padrão do Lighthouse.
 *
 * Uso: node scripts/perf/ab.mjs <distA> <distB> <caminho> [pares=6]
 */
import { execSync, spawn } from 'node:child_process'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'

const [distA, distB, target = '/', pairsArg = '6'] = process.argv.slice(2)
const servers = []
const serve = (dir, port) => {
  const p = spawn(`npx vite preview --outDir ${dir} --port ${port} --strictPort`, { shell: true, stdio: 'ignore', detached: process.platform !== 'win32' })
  servers.push(p)
}
serve(distA, 4181)
serve(distB, 4182)
for (const port of [4181, 4182]) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/`)).ok) break
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}
const results = { A: [], B: [] }
const run = async (label, port) => {
  const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-first-run'] })
  try {
    const { lhr } = await lighthouse(`http://localhost:${port}${target}`, { port: chrome.port, output: 'json', logLevel: 'error' })
    const a = lhr.audits
    const r = { perf: Math.round(lhr.categories.performance.score * 100), tbt: Math.round(a['total-blocking-time'].numericValue), lcp: Math.round(a['largest-contentful-paint'].numericValue), fcp: Math.round(a['first-contentful-paint'].numericValue), cls: a['cumulative-layout-shift'].numericValue, bench: Math.round(lhr.environment.benchmarkIndex) }
    results[label].push(r)
    console.log(label, JSON.stringify(r))
  } finally {
    await chrome.kill()
  }
}
for (let i = 0; i < Number(pairsArg); i++) {
  // alterna também a ordem dentro do par
  if (i % 2 === 0) {
    await run('A', 4181)
    await run('B', 4182)
  } else {
    await run('B', 4182)
    await run('A', 4181)
  }
}
const med = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
for (const k of ['A', 'B']) {
  const rs = results[k]
  console.log(`${k}: mediana perf ${med(rs.map((r) => r.perf))} · TBT ${med(rs.map((r) => r.tbt))} · LCP ${med(rs.map((r) => r.lcp))} · FCP ${med(rs.map((r) => r.fcp))} · CLS máx ${Math.max(...rs.map((r) => r.cls)).toFixed(3)}`)
}
for (const p of servers) {
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' })
    else process.kill(-p.pid, 'SIGTERM')
  } catch {
    // já encerrado
  }
}
process.exit(0)
