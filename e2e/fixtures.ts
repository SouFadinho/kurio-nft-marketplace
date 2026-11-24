/**
 * `test` do projeto: o do Playwright + uma fixture AUTOMÁTICA que reprova o teste se a página
 * lançar uma exceção não tratada (`pageerror`).
 *
 * Motivo (CP3): uma recursão infinita no cache estourou a pilha dentro do listener do socket;
 * a interface parecia funcionar e só um contador denunciou o problema. Com esta fixture, uma
 * exceção na página nunca mais passa em silêncio.
 */
import { test as base, expect } from '@playwright/test'

export const test = base.extend<{ failOnPageError: void }>({
  failOnPageError: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await use()
      expect(errors, 'exceções não tratadas na página').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
