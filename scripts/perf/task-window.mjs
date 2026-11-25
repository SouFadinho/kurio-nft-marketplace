/**
 * CP9.2 — lista TODOS os eventos (qualquer fase/categoria, todas as threads) dentro da janela de
 * uma tarefa longa do trace, para atribuir tarefas que o Lighthouse marca como "Unattributable".
 * Uso: node scripts/perf/task-window.mjs <trace.json> <início em ms desde a navegação> [duração ms]
 */
import fs from 'node:fs'

const [file, atMs, durMs = '200'] = process.argv.slice(2)
const { traceEvents: ev } = JSON.parse(fs.readFileSync(file, 'utf8'))
const names = new Map()
for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name)
const t0 = Math.min(...ev.filter((e) => e.name === 'navigationStart' || e.name === 'TracingStartedInBrowser').map((e) => e.ts))
const a = t0 + Number(atMs) * 1000 - 5_000
const b = a + Number(durMs) * 1000 + 10_000
const hits = ev.filter((e) => e.ts >= a && e.ts <= b && e.ph !== 'M')
const agg = new Map()
for (const e of hits) {
  const k = `${names.get(`${e.pid}:${e.tid}`) ?? e.tid} | ${e.ph} | ${e.cat} | ${e.name}`
  const cur = agg.get(k) ?? { n: 0, dur: 0 }
  cur.n++
  cur.dur += e.dur ?? 0
  agg.set(k, cur)
}
for (const [k, v] of [...agg].sort((x, y) => y[1].dur - x[1].dur).slice(0, 40)) console.log(`${(v.dur / 1000).toFixed(1).padStart(8)} ms  ×${String(v.n).padStart(4)}  ${k}`)
