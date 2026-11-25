/**
 * Regressão visual (TEST-02) de Início, Detalhe do NFT, Carrinho e Pagamento (CP5), nos
 * projetos desktop e mobile.
 *
 * IMPORTANTE: estas baselines garantem ESTABILIDADE (nada mudou sem querer), não fidelidade
 * ao Figma; a fidelidade é avaliada nas comparações lado a lado (planning/evidence/cp3).
 * Dados estáveis: seed do mock com `?reset=1`. Fontes e imagens visíveis carregadas,
 * animações desligadas e movimento reduzido.
 * As baselines foram geradas no Windows (sufixo -win32). O CP7 gera baselines Linux em
 * container para a CI (renderização de fonte difere entre sistemas).
 */
import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { USERS, openApp, seedCart, signIn, summaryValue } from './support'

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
  // complete=true não garante decodificação concluída (diff do CP3: só a última arte divergia).
  await page.evaluate(() => Promise.all([...document.images].filter((i) => i.offsetParent !== null).map((i) => i.decode().catch(() => undefined))))
  // Estado estável antes da captura (endurecimento após 1 falha intermitente sob carga no CP3):
  // nenhuma região carregando/atualizando, nenhum skeleton e nenhuma animação em curso.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  await expect(page.locator('.skeleton:visible')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0)
  await page.waitForTimeout(150)
}

const CART = [
  { nftId: 'nft-001', editionId: 'ed-10', quantity: 2 },
  { nftId: 'nft-005', editionId: 'ed-50', quantity: 1 },
  { nftId: 'nft-006', editionId: 'ed-50', quantity: 3 },
]

for (const [name, path] of [
  ['inicio', '/'],
  ['detalhe', '/nft/nft-001'],
  ['carrinho', '/carrinho'],
  ['pagamento', '/pagamento'],
] as const) {
  test(`baseline visual: ${name}`, async ({ page }) => {
    if (name === 'carrinho' || name === 'pagamento') {
      // Mesmos 3 itens do Figma (Emerald Ape, Violet Nomad, Ivory Baron); pagamento com Ana logada.
      await openApp(page, '/')
      if (name === 'pagamento') await signIn(page, USERS.ana)
      await seedCart(page, CART)
      await page.goto(path)
      await expect(summaryValue(page, 'quote-total')).toBeVisible()
    } else await openApp(page, path)
    await settle(page)
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 })
  })
}
