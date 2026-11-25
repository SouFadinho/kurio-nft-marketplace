/**
 * CP9.1 (auditoria da substituição feita no CP9.2): o build do navegador troca o `tldts` por
 * `src/mocks/vendor/tldts-lite.ts` (alias no vite.config.ts). Estes testes rodam no Node, onde o
 * alias NÃO se aplica, e comparam o substituto com a biblioteca real.
 *
 * 1. Contrato: o `tough-cookie` (única dependência do `tldts` no app) usa só `getDomain`.
 * 2. Diferencial: mesma resposta que o `tldts` real nos hosts em que o app roda.
 * 3. Diferenças conhecidas: listadas explicitamente; qualquer outra quebra o teste.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import { getDomain as real } from 'tldts'
import { getDomain as lite } from '../../src/mocks/vendor/tldts-lite'

const OPTIONS = { allowIcannDomains: true, allowPrivateDomains: true }
const require = createRequire(import.meta.url)

test('contrato: tough-cookie importa do tldts apenas getDomain (builds ESM e CJS)', () => {
  const dir = path.dirname(path.dirname(require.resolve('tough-cookie')))
  // ESM (usado pelo Vite no navegador): import { ... } from "tldts"
  const esm = fs.readFileSync(path.join(dir, 'dist/index.js'), 'utf8')
  const esmImports = [...esm.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']tldts["']/g)].flatMap((m) => m[1]!.split(',').map((s) => s.trim()).filter(Boolean))
  expect(esmImports).toEqual(['getDomain'])
  // CJS: var import_tldts = require("tldts"); ... import_tldts.<nome>
  const cjs = fs.readFileSync(path.join(dir, 'dist/index.cjs'), 'utf8')
  const used = new Set([...cjs.matchAll(/import_tldts\.(\w+)/g)].map((m) => m[1]))
  expect([...used]).toEqual(['getDomain'])
})

test('contrato: o MSW chega ao tldts só pelo cookie jar do tough-cookie', () => {
  const pkg = JSON.parse(fs.readFileSync(require.resolve('msw/package.json'), 'utf8')) as { dependencies: Record<string, string> }
  expect(Object.keys(pkg.dependencies)).toContain('tough-cookie')
  expect(Object.keys(pkg.dependencies)).not.toContain('tldts')
})

test('diferencial: mesmo resultado do tldts real nos hosts usados pelo app', () => {
  // Desenvolvimento, preview, testes e IPs: onde o app de fato roda.
  const same = ['localhost', 'LOCALHOST', '127.0.0.1', '[::1]', 'kurio.test', 'example.com', 'www.example.com', 'app.example.org', 'a.b.example.com', 'kurio-nft.vercel.app.example.com']
  for (const host of same) expect(lite(host), host).toBe(real(host, OPTIONS))
})

test('diferenças conhecidas (só sufixos públicos de vários níveis): documentadas, não silenciosas', () => {
  // O tldts real conhece a Public Suffix List (inclui sufixos privados como vercel.app e github.io);
  // o substituto usa os dois últimos rótulos. Efeito prático: só a validação de `Domain=` de
  // cookies SIMULADOS nesses domínios; o KURIO não usa cookies (sessão no header Authorization).
  const known: Array<[string, string | null, string | null]> = [
    ['kurio-nft-marketplace.vercel.app', 'kurio-nft-marketplace.vercel.app', 'vercel.app'],
    ['user.github.io', 'user.github.io', 'github.io'],
    ['shop.example.co.uk', 'example.co.uk', 'co.uk'],
  ]
  for (const [host, expectedReal, expectedLite] of known) {
    expect(real(host, OPTIONS), `real ${host}`).toBe(expectedReal)
    expect(lite(host), `lite ${host}`).toBe(expectedLite)
  }
})
