/**
 * CP9.2 — diagnóstico (NÃO é a auditoria oficial). Executa o Lighthouse com a MESMA configuração
 * do `scripts/lighthouse.mjs` (mobile padrão ou desktop), em Chrome novo por execução, e guarda o
 * trace completo para análise das tarefas longas.
 *
 * Uso: node scripts/perf/lh-trace.mjs <saida> <página:/caminho> [execuções=3] [perfil=mobile]
 * Pré-requisito: build + `npm run preview` rodando em http://localhost:4173.
 * Saída: <saida>/<n>.lhr.json, <n>.trace.json (abre no painel Performance do Chrome) e
 *        <n>.tasks.txt (tarefas longas da thread principal com os eventos que as compõem).
 */
import fs from 'node:fs'
import path from 'node:path'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'

const [out, target = '/', runsArg = '3', profile = 'mobile'] = process.argv.slice(2)
if (!out) throw new Error('uso: lh-trace.mjs <saida> <caminho> [execuções] [perfil]')
fs.mkdirSync(out, { recursive: true })

/** Tarefas de topo da thread principal do renderer e a composição de cada uma (tempo próprio). */
export function analyzeTrace(events) {
  const threadNames = new Map()
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') threadNames.set(`${e.pid}:${e.tid}`, e.args.name)
  const mainKeys = [...threadNames].filter(([, n]) => n === 'CrRendererMain').map(([k]) => k)
  // Thread principal da página auditada = a com mais tempo de tarefas.
  const byThread = new Map()
  for (const e of events) {
    if (e.ph !== 'X' || e.name !== 'RunTask') continue
    const k = `${e.pid}:${e.tid}`
    if (!mainKeys.includes(k)) continue
    byThread.set(k, (byThread.get(k) ?? 0) + (e.dur ?? 0))
  }
  const main = [...byThread].sort((a, b) => b[1] - a[1])[0]?.[0]
  const onMain = events.filter((e) => `${e.pid}:${e.tid}` === main && e.ph === 'X' && typeof e.dur === 'number')
  const t0 = Math.min(...events.filter((e) => e.name === 'navigationStart' || e.name === 'TracingStartedInBrowser').map((e) => e.ts))
  const tasks = onMain.filter((e) => e.name === 'RunTask' && e.dur >= 50_000).sort((a, b) => a.ts - b.ts)
  const lines = []
  for (const t of tasks) {
    const inside = onMain.filter((e) => e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur)
    // tempo próprio = duração - filhos diretos (aproximação por aninhamento de intervalo)
    const self = inside.map((e) => {
      const kids = inside.filter((c) => c !== e && c.ts >= e.ts && c.ts + c.dur <= e.ts + e.dur)
      const direct = kids.filter((c) => !kids.some((p) => p !== c && c.ts >= p.ts && c.ts + c.dur <= p.ts + p.dur))
      return { e, self: e.dur - direct.reduce((s, c) => s + c.dur, 0) }
    })
    const agg = new Map()
    for (const { e, self: s } of self) {
      const url = e.args?.data?.url || e.args?.data?.stackTrace?.[0]?.url || e.args?.fileName || ''
      const fn = e.args?.data?.functionName || ''
      const key = `${e.name}${url ? ' ' + url.replace(/^.*\/\/[^/]+/, '') : ''}${fn ? ' ' + fn : ''}`
      agg.set(key, (agg.get(key) ?? 0) + s)
    }
    const top = [...agg].sort((a, b) => b[1] - a[1]).slice(0, 8)
    lines.push(`tarefa @${((t.ts - t0) / 1000).toFixed(0)} ms: ${(t.dur / 1000).toFixed(1)} ms reais`)
    for (const [k, v] of top) lines.push(`    ${(v / 1000).toFixed(1).padStart(7)} ms  ${k}`)
  }
  return { main, lines, totalLong: tasks.reduce((s, t) => s + t.dur, 0) / 1000, count: tasks.length }
}

const chromePath = process.env.CHROME_PATH ?? chromium.executablePath()
for (let i = 1; i <= Number(runsArg); i++) {
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-first-run'] })
  try {
    const result = await lighthouse(`http://localhost:4173${target}`, { port: chrome.port, output: 'json', logLevel: 'error' }, profile === 'desktop' ? desktopConfig : undefined)
    const lhr = result.lhr
    const trace = result.artifacts.Trace ?? result.artifacts.traces?.defaultPass
    fs.writeFileSync(path.join(out, `${i}.lhr.json`), JSON.stringify(lhr))
    fs.writeFileSync(path.join(out, `${i}.trace.json`), JSON.stringify(trace))
    const a = lhr.audits
    const { lines, totalLong, count } = analyzeTrace(trace.traceEvents)
    const head = `execução ${i}: perf ${Math.round(lhr.categories.performance.score * 100)} · TBT ${Math.round(a['total-blocking-time'].numericValue)} · LCP ${Math.round(a['largest-contentful-paint'].numericValue)} · FCP ${Math.round(a['first-contentful-paint'].numericValue)} · bench ${Math.round(lhr.environment.benchmarkIndex)} · ${count} tarefas ≥ 50 ms reais somando ${totalLong.toFixed(0)} ms`
    fs.writeFileSync(path.join(out, `${i}.tasks.txt`), [head, ...lines].join('\n') + '\n')
    console.log(head)
  } finally {
    await chrome.kill()
  }
}
