/**
 * CP9: inventário de licenças a partir do lockfile instalado (sem dependências extras).
 * Lista as licenças das dependências de PRODUÇÃO (árvore completa de `npm ls --omit=dev`) e
 * resume as de desenvolvimento. Uso: node scripts/licenses.mjs
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const tree = (omitDev) => JSON.parse(execSync(`npm ls --all --json ${omitDev ? '--omit=dev' : ''}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
const collect = (node, out = new Map()) => {
  for (const [name, dep] of Object.entries(node.dependencies ?? {})) {
    const key = `${name}@${dep.version}`
    if (out.has(key) || !dep.version) continue
    let license = '?'
    try {
      const pj = JSON.parse(fs.readFileSync(path.join('node_modules', name, 'package.json'), 'utf8'))
      license = typeof pj.license === 'string' ? pj.license : pj.license?.type ?? (pj.licenses ?? []).map((l) => l.type).join(' OR ') ?? '?'
    } catch {
      // dependência opcional não instalada: licença desconhecida
    }
    out.set(key, license || '?')
    collect(dep, out)
  }
  return out
}
const summarize = (map) => {
  const by = {}
  for (const l of map.values()) by[l] = (by[l] ?? 0) + 1
  return Object.entries(by).sort((a, b) => b[1] - a[1])
}
const prod = collect(tree(true))
const all = collect(tree(false))
console.log(`Produção: ${prod.size} pacotes`)
for (const [l, n] of summarize(prod)) console.log(`  ${l}: ${n}`)
console.log(`Total (com desenvolvimento): ${all.size} pacotes`)
for (const [l, n] of summarize(all)) console.log(`  ${l}: ${n}`)
const PERMISSIVE = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'BlueOak-1.0.0', 'CC0-1.0', 'Unlicense', 'Python-2.0', 'CC-BY-4.0', 'MPL-2.0', 'OFL-1.1'])
// Expressão SPDX: cada identificador (separado por OR/AND/parênteses) precisa estar na lista.
const ok = (l) => {
  const ids = l.replace(/[()]/g, ' ').split(/\s+(?:OR|AND)\s+|\s+/).filter(Boolean)
  return ids.length > 0 && ids.every((id) => PERMISSIVE.has(id))
}
const flagged = [...all].filter(([, l]) => !ok(l))
console.log(flagged.length ? `Revisar manualmente:\n${flagged.map(([k, l]) => `  ${k}: ${l}`).join('\n')}` : 'Nenhuma licença fora da lista permissiva.')
