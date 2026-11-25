/**
 * CP9.2 — diagnóstico do LCP SIMULADO (Lantern), NÃO é a auditoria oficial.
 *
 * Roda o Lighthouse mobile padrão com LANTERN_DEBUG=1 e exporta, para as simulações do LCP
 * (otimista e pessimista), cada nó do grafo: requisições (URL, bytes) e tarefas de CPU, com
 * início/fim simulados. Mostra o que de fato compõe os ~4 s.
 *
 * Uso: node scripts/perf/lantern-lcp.mjs <caminho=/> [saida=.cache/perf/lantern]
 */
process.env.LANTERN_DEBUG = '1'
import fs from 'node:fs'
import path from 'node:path'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'
import * as Lantern from 'lighthouse/core/lib/lantern/lantern.js'

const [target = '/', out = '.cache/perf/lantern'] = process.argv.slice(2)
fs.mkdirSync(out, { recursive: true })
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-first-run'] })
let lhr
try {
  ;({ lhr } = await lighthouse(`http://localhost:4173${target}`, { port: chrome.port, output: 'json', logLevel: 'error' }))
} finally {
  await chrome.kill()
}
const a = lhr.audits
const report = [`LCP simulado ${Math.round(a['largest-contentful-paint'].numericValue)} · FCP ${Math.round(a['first-contentful-paint'].numericValue)} · TBT ${Math.round(a['total-blocking-time'].numericValue)} · perf ${Math.round(lhr.categories.performance.score * 100)}`]
const all = Lantern.Simulation.Simulator.allNodeTimings
report.push(`simulações: ${[...all.keys()].join(', ')}`)
for (const [label, timings] of all) {
  if (!/LargestContentfulPaint/i.test(label)) continue
  const rows = []
  let cpu = 0
  let bytes = 0
  for (const [node, t] of timings) {
    if (node.type === 'network') {
      const r = node.request ?? node.record
      bytes += r?.transferSize ?? 0
      rows.push({ s: t.startTime, e: t.endTime, d: `NET ${(r?.url ?? '').replace(/^.*\/\/[^/]+/, '').slice(0, 60)} ${Math.round((r?.transferSize ?? 0) / 1024)} kB${r?.fromWorker || r?.fetchedViaServiceWorker ? ' (SW)' : ''}` })
    } else {
      cpu += t.endTime - t.startTime
      const ev = node.event ?? {}
      const kids = (node.childEvents ?? []).filter((c) => c.args?.data?.url).map((c) => c.args.data.url.replace(/^.*\/\/[^/]+/, '')).slice(0, 2)
      rows.push({ s: t.startTime, e: t.endTime, d: `CPU ${Math.round(t.endTime - t.startTime)} ms ${ev.name ?? ''} ${kids.join(' ')}` })
    }
  }
  rows.sort((x, y) => x.s - y.s)
  const end = Math.max(...rows.map((r) => r.e))
  report.push('', `== ${label}: fim ${Math.round(end)} ms · ${rows.length} nós · CPU simulada ${Math.round(cpu)} ms · ${Math.round(bytes / 1024)} kB`)
  for (const r of rows) report.push(`${String(Math.round(r.s)).padStart(6)} → ${String(Math.round(r.e)).padStart(6)}  ${r.d}`)
}
const file = path.join(out, `${target.replace(/\W+/g, '_') || 'root'}.txt`)
fs.writeFileSync(file, report.join('\n') + '\n')
console.log(report.slice(0, 2).join('\n'))
console.log(report.filter((l) => l.startsWith('==')).join('\n'))
console.log('detalhes em', file)
