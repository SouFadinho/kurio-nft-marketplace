/** CP9.2: `formatRating` produz exatamente o texto do Intl pt-BR que ele substitui. */
import { expect, test } from '@playwright/test'
import { formatRating } from '../../src/lib/rating'

test('formatRating = toLocaleString pt-BR com minimumFractionDigits 1 (notas 0–5)', () => {
  const cases = [0, 1, 4, 4.5, 4.8, 4.75, 4.756, 4.9999, 3.1, 5]
  for (let r = 0; r <= 5; r += 0.05) cases.push(Math.round(r * 100) / 100)
  for (const r of cases) expect(formatRating(r), String(r)).toBe(r.toLocaleString('pt-BR', { minimumFractionDigits: 1 }))
})
