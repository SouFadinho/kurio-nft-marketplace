/**
 * Auditoria Lighthouse reprodutível (CHALLENGE §10).
 *
 * - Páginas: Início e Detalhe do NFT. Perfis: mobile (padrão do Lighthouse) e desktop.
 * - 3 medições por página e perfil = 12 execuções; reporta a MEDIANA por categoria.
 * - Mesmo build da entrega (vite build + vite preview) e cenário padrão dos mocks.
 *   Nada é desligado para melhorar a nota.
 * - Saída: lighthouse/reports/*.html|json + lighthouse/summary.{md,json}.
 *
 * Uso: npm run audit:lighthouse            (faz o build e sobe o preview)
 *      LH_SKIP_BUILD=1 npm run audit:lighthouse
 *      LH_RUNS=1 npm run audit:lighthouse   (rodada rápida; não vale como entrega)
 */
import { spawn, execSync } from 'node:child_process'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'

const PORT = 4173
const ORIGIN = `http://localhost:${PORT}`
const RUNS = Number(process.env.LH_RUNS ?? 3)
const OUT = path.resolve('lighthouse')
const REPORTS = path.join(OUT, 'reports')
const PAGES = [
  { name: 'inicio', path: '/' },
  { name: 'detalhe', path: '/nft/nft-001' },
]
const PROFILES = [
  { name: 'mobile', config: undefined },
  { name: 'desktop', config: desktopConfig },
]
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* aguardando */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Servidor não respondeu em ${url}`)
}

async function main() {
  if (!process.env.LH_SKIP_BUILD) execSync('npm run build', { stdio: 'inherit' })
  // Comando completo como string (sem array de args) para evitar o DEP0190 com shell: true.
  const preview = spawn('npm run preview', { stdio: 'ignore', shell: true })
  try {
    await waitForServer(ORIGIN)
    await rm(REPORTS, { recursive: true, force: true })
    await mkdir(REPORTS, { recursive: true })

    // Chromium fixado pela versão do Playwright do projeto: ambiente reproduzível.
    const chromePath = process.env.CHROME_PATH ?? chromium.executablePath()
    const results = []

    for (const page of PAGES) {
      for (const profile of PROFILES) {
        for (let run = 1; run <= RUNS; run++) {
          const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-first-run'] })
          try {
            const runner = await lighthouse(
              `${ORIGIN}${page.path}`,
              { port: chrome.port, output: ['html', 'json'], logLevel: 'error' },
              profile.config,
            )
            const lhr = runner.lhr
            const base = `${page.name}-${profile.name}-${run}`
            await writeFile(path.join(REPORTS, `${base}.html`), runner.report[0])
            await writeFile(path.join(REPORTS, `${base}.json`), runner.report[1])
            const entry = {
              page: page.name,
              profile: profile.name,
              run,
              scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
              lcpMs: lhr.audits['largest-contentful-paint']?.numericValue ?? null,
              cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? null,
              tbtMs: lhr.audits['total-blocking-time']?.numericValue ?? null,
              lighthouseVersion: lhr.lighthouseVersion,
              userAgent: lhr.environment?.hostUserAgent,
            }
            results.push(entry)
            console.log(`${base}: ${CATEGORIES.map((c) => `${c}=${entry.scores[c]}`).join(' ')}`)
          } finally {
            await chrome.kill()
          }
        }
      }
    }

    const groups = []
    for (const page of PAGES) {
      for (const profile of PROFILES) {
        const rs = results.filter((r) => r.page === page.name && r.profile === profile.name)
        groups.push({
          page: page.name,
          profile: profile.name,
          runs: rs.length,
          median: Object.fromEntries(CATEGORIES.map((c) => [c, median(rs.map((r) => r.scores[c]))])),
          medianLcpMs: median(rs.map((r) => r.lcpMs)),
          medianCls: median(rs.map((r) => r.cls)),
          medianTbtMs: median(rs.map((r) => r.tbtMs)),
        })
      }
    }

    const env = {
      date: new Date().toISOString(),
      node: process.version,
      os: `${os.type()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model,
      lighthouse: results[0]?.lighthouseVersion,
      browser: results[0]?.userAgent,
      runsPerCombination: RUNS,
      scenario: 'default (mocks MSW ativos, build de produção, vite preview)',
    }
    await writeFile(path.join(OUT, 'summary.json'), JSON.stringify({ env, targets: TARGETS, groups, results }, null, 2))

    const ok = (c, v) => (v >= TARGETS[c] ? `${v}` : `**${v}** ⚠`)
    const official = RUNS === 3
    const md = [
      '# Lighthouse — resumo',
      '',
      ...(official
        ? []
        : [`> **NÃO OFICIAL:** ${RUNS} medição(ões) por combinação. A auditoria de entrega exige 3 (CHALLENGE §10).`, '']),
      `Gerado em ${env.date}. Node ${env.node} · ${env.os} · Lighthouse ${env.lighthouse}.`,
      `Navegador: ${env.browser}.`,
      `Medições por página e perfil: ${RUNS}. Valores = mediana. Metas: Perf ≥ 90, A11y ≥ 95, BP ≥ 95, SEO ≥ 90.`,
      '',
      '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |',
      '|---|---|---|---|---|---|---|---|---|',
      ...groups.map(
        (g) =>
          `| ${g.page} | ${g.profile} | ${ok('performance', g.median.performance)} | ${ok('accessibility', g.median.accessibility)} | ${ok('best-practices', g.median['best-practices'])} | ${ok('seo', g.median.seo)} | ${Math.round(g.medianLcpMs)} | ${g.medianCls.toFixed(3)} | ${Math.round(g.medianTbtMs)} |`,
      ),
      '',
      'Relatórios individuais em `lighthouse/reports/`.',
    ].join('\n')
    await writeFile(path.join(OUT, 'summary.md'), md)
    console.log(`\n${md}`)
  } finally {
    preview.kill()
    if (process.platform === 'win32' && preview.pid) {
      try {
        execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' })
      } catch {
        /* já encerrado */
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
