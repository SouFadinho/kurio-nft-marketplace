/**
 * CP9.2: relação entre a velocidade de CPU medida pelo próprio Lighthouse em cada execução
 * (`environment.benchmarkIndex`) e o resultado (Performance, TBT, LCP), em todas as rodadas
 * versionadas. Uso: node scripts/perf/variance.mjs [perfil=mobile]
 */
import fs from 'node:fs'
import path from 'node:path'

const profile = process.argv[2] ?? 'mobile'
const roots = ['planning/evidence/cp8-perf', 'planning/evidence/cp9-perf', 'planning/evidence/cp9-2-perf']
const rows = []
for (const root of roots) {
  if (!fs.existsSync(root)) continue
  for (const round of fs.readdirSync(root)) {
    const dir = path.join(root, round, 'reports')
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json') && n.includes(`-${profile}-`))) {
      const lhr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      const a = lhr.audits
      rows.push({
        round: `${path.basename(root)}/${round}`,
        file: f.replace('.json', ''),
        bench: Math.round(lhr.environment.benchmarkIndex),
        perf: Math.round(lhr.categories.performance.score * 100),
        tbt: Math.round(a['total-blocking-time'].numericValue),
        lcp: Math.round(a['largest-contentful-paint'].numericValue),
        fcp: Math.round(a['first-contentful-paint'].numericValue),
      })
    }
  }
}
rows.sort((x, y) => x.file.localeCompare(y.file) || x.bench - y.bench)
console.log('rodada'.padEnd(46), 'execução'.padEnd(20), 'bench', 'perf', '  TBT', '  LCP', '  FCP')
for (const r of rows) console.log(r.round.padEnd(46), r.file.padEnd(20), String(r.bench).padStart(5), String(r.perf).padStart(4), String(r.tbt).padStart(5), String(r.lcp).padStart(5), String(r.fcp).padStart(5))
// Correlação de Pearson por página.
for (const page of ['inicio', 'detalhe']) {
  const xs = rows.filter((r) => r.file.startsWith(page))
  const corr = (k) => {
    const n = xs.length
    const mx = xs.reduce((s, r) => s + r.bench, 0) / n
    const my = xs.reduce((s, r) => s + r[k], 0) / n
    const cov = xs.reduce((s, r) => s + (r.bench - mx) * (r[k] - my), 0)
    const sx = Math.sqrt(xs.reduce((s, r) => s + (r.bench - mx) ** 2, 0))
    const sy = Math.sqrt(xs.reduce((s, r) => s + (r[k] - my) ** 2, 0))
    return (cov / (sx * sy)).toFixed(2)
  }
  console.log(`${page} ${profile}: n=${xs.length} · corr(bench, perf)=${corr('perf')} · corr(bench, TBT)=${corr('tbt')} · bench ${Math.min(...xs.map((r) => r.bench))}–${Math.max(...xs.map((r) => r.bench))}`)
}
