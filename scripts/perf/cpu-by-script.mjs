/**
 * CP9.2 — tempo de CPU da thread principal ATÉ um instante (padrão: LCP observado), atribuído ao
 * script responsável (evento com URL mais próximo na pilha de aninhamento) ou à categoria
 * (Layout, Paint, GC, parse HTML...). Uso: node scripts/perf/cpu-by-script.mjs <trace.json> [até ms]
 */
import fs from 'node:fs'

const [file, untilArg] = process.argv.slice(2)
const { traceEvents: ev } = JSON.parse(fs.readFileSync(file, 'utf8'))
const names = new Map()
for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name)
const t0 = Math.min(...ev.filter((e) => e.name === 'navigationStart').map((e) => e.ts))
const lcp = ev.filter((e) => e.name === 'largestContentfulPaint::Candidate').at(-1)
const until = untilArg ? t0 + Number(untilArg) * 1000 : lcp.ts
const mainKey = (() => {
  const tot = new Map()
  for (const e of ev) if (e.ph === 'X' && e.name === 'RunTask' && names.get(`${e.pid}:${e.tid}`) === 'CrRendererMain') tot.set(`${e.pid}:${e.tid}`, (tot.get(`${e.pid}:${e.tid}`) ?? 0) + e.dur)
  return [...tot].sort((a, b) => b[1] - a[1])[0][0]
})()
const xs = ev.filter((e) => `${e.pid}:${e.tid}` === mainKey && e.ph === 'X' && e.dur > 0 && e.ts >= t0 && e.ts < until).sort((a, b) => a.ts - b.ts || b.dur - a.dur)
const urlOf = (e) => (e.args?.data?.url || e.args?.data?.stackTrace?.[0]?.url || e.args?.fileName || '').replace(/^.*\/\/[^/]+/, '')
// Pilha por aninhamento de intervalo.
const stack = []
const self = new Map()
const attribute = (e) => {
  for (let i = stack.length; i >= 0; i--) {
    const node = i === stack.length ? e : stack[i]
    const u = urlOf(node)
    if (u) return u
  }
  return `[${e.name}]`
}
const records = xs.map((e) => ({ e, childDur: 0 }))
const st = []
for (const r of records) {
  while (st.length && st.at(-1).e.ts + st.at(-1).e.dur <= r.e.ts) st.pop()
  if (st.length) st.at(-1).childDur += r.e.dur
  stack.length = 0
  for (const s of st) stack.push(s.e)
  r.key = r.e.name === 'RunTask' ? '[RunTask sem filhos / tempo próprio]' : attribute(r.e)
  st.push(r)
}
for (const r of records) self.set(r.key, (self.get(r.key) ?? 0) + Math.max(0, r.e.dur - r.childDur))
const total = [...self.values()].reduce((s, v) => s + v, 0)
console.log(`thread principal até ${((until - t0) / 1000).toFixed(0)} ms: ${(total / 1000).toFixed(0)} ms de CPU (×4 na simulação mobile ≈ ${((total * 4) / 1000).toFixed(0)} ms)`)
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${(v / 1000).toFixed(1).padStart(7)} ms  ${k}`)
