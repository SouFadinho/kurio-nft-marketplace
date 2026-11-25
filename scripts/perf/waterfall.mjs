/**
 * CP9.2 — waterfall observado (sem simulação) de uma execução do Lighthouse e linha do tempo das
 * tarefas de topo da thread principal, para entender o caminho crítico até o LCP.
 * Uso: node scripts/perf/waterfall.mjs <lhr.json>
 */
import fs from 'node:fs'

const lhr = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const a = lhr.audits
const reqs = a['network-requests'].details.items
console.log('início    fim   kB  tipo        prioridade  SW  url')
for (const r of reqs) {
  console.log(
    String(Math.round(r.networkRequestTime)).padStart(5),
    String(Math.round(r.networkEndTime)).padStart(6),
    String(Math.round((r.transferSize ?? 0) / 1024)).padStart(4),
    (r.resourceType ?? '').padEnd(11),
    (r.priority ?? '').padEnd(11),
    r.fromServiceWorker ? 'SW' : '  ',
    r.url.replace(/^.*\/\/[^/]+/, '').slice(0, 70),
  )
}
const m = a.metrics.details.items[0]
console.log(`observado: FCP ${m.observedFirstContentfulPaint} · LCP ${m.observedLargestContentfulPaint} · DCL ${m.observedDomContentLoaded} · load ${m.observedLoad}`)
console.log(`simulado:  FCP ${Math.round(m.firstContentfulPaint)} · LCP ${Math.round(m.largestContentfulPaint)} · TBT ${Math.round(m.totalBlockingTime)} · SI ${Math.round(m.speedIndex)}`)
const tasks = a['main-thread-tasks']?.details?.items ?? []
console.log('tarefas da thread principal ≥ 20 ms (observado):', tasks.filter((t) => t.duration >= 20).map((t) => `${Math.round(t.startTime)}+${Math.round(t.duration)}`).join(' '))
