/**
 * CP9.2 — composição dos chunks por módulo de origem (bytes do código gerado atribuídos a cada
 * fonte pelo sourcemap). Pré-requisito: `npx vite build --sourcemap`.
 * Uso: node scripts/perf/bundle-composition.mjs [filtro de chunk]
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { TraceMap, eachMapping } from '@jridgewell/trace-mapping'

const filter = process.argv[2] ?? ''
const dir = 'dist/assets'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f.includes(filter))
const pkg = (src) => {
  const nm = src?.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)
  return nm ? `npm:${nm[1]}` : (src ?? '?').replace(/^.*?\/src\//, 'src/').replace(/\/[^/]+$/, '/')
}
const rows = []
for (const f of files) {
  const code = fs.readFileSync(path.join(dir, f), 'utf8')
  const gz = zlib.gzipSync(code).length
  if (!fs.existsSync(path.join(dir, `${f}.map`))) continue
  const tm = new TraceMap(fs.readFileSync(path.join(dir, `${f}.map`), 'utf8'))
  const lines = code.split('\n')
  const bySrc = new Map()
  let prev = null
  eachMapping(tm, (m) => {
    if (prev && prev.generatedLine === m.generatedLine) {
      const len = m.generatedColumn - prev.generatedColumn
      bySrc.set(pkg(prev.source), (bySrc.get(pkg(prev.source)) ?? 0) + len)
    } else if (prev) {
      const len = (lines[prev.generatedLine - 1]?.length ?? 0) - prev.generatedColumn
      bySrc.set(pkg(prev.source), (bySrc.get(pkg(prev.source)) ?? 0) + len)
    }
    prev = m
  })
  rows.push({ f, raw: code.length, gz, top: [...bySrc].sort((a, b) => b[1] - a[1]).slice(0, 8) })
}
rows.sort((a, b) => b.gz - a.gz)
for (const r of rows.slice(0, filter ? 50 : 14)) {
  console.log(`${r.f}  ${(r.raw / 1024).toFixed(0)} kB  (gzip ${(r.gz / 1024).toFixed(0)} kB)`)
  for (const [k, v] of r.top) console.log(`    ${(v / 1024).toFixed(1).padStart(6)} kB  ${k}`)
}
