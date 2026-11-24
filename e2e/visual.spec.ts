/**
 * Regressão visual (TEST-02) de Início e Detalhe do NFT, nos projetos desktop e mobile.
 *
 * IMPORTANTE: estas baselines garantem ESTABILIDADE (nada mudou sem querer), não fidelidade
 * ao Figma; a fidelidade é avaliada nas comparações lado a lado (planning/evidence/cp3).
 * Dados estáveis: seed do mock com `?reset=1`. Fontes e imagens visíveis carregadas,
 * animações desligadas e movimento reduzido.
 * As baselines foram geradas no Windows (sufixo -win32). O CP7 gera baselines Linux em
 * container para a CI (renderização de fonte difere entre sistemas).
 */
import { expect, test, type Page } from '@playwright/test'
import { openApp } from './support'

test.use({ reducedMotion: 'reduce' })

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 25))
    }
    window.scrollTo(0, 0)
  })
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.offsetParent !== null).every((i) => i.complete && i.naturalWidth > 0))).toBe(true)
  // Estado estável antes da captura (endurecimento após 1 falha intermitente sob carga no CP3):
  // nenhuma região carregando/atualizando, nenhum skeleton e nenhuma animação em curso.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  await expect(page.locator('.skeleton:visible')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0)
  await page.waitForTimeout(150)
}

for (const [name, path] of [
  ['inicio', '/'],
  ['detalhe', '/nft/nft-001'],
] as const) {
  test(`baseline visual: ${name}`, async ({ page }) => {
    await openApp(page, path)
    await settle(page)
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 })
  })
}
