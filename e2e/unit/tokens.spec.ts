/**
 * Contraste dos tokens de cor (WCAG 2.1). Lê os valores DIRETAMENTE de src/index.css, para
 * que a verificação acompanhe qualquer mudança de token.
 */
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { pageWindow } from '../../src/lib/pagination'

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')
const token = (name: string) => {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)
  if (!m?.[1]) throw new Error(`token --color-${name} não encontrado`)
  return m[1]
}
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

// [texto/elemento, fundo, mínimo]: 4.5 para texto normal; 3 para componentes de UI (1.4.11).
const PAIRS: Array<[string, string, number]> = [
  ['foreground', 'background', 4.5],
  ['foreground', 'surface', 4.5],
  ['foreground', 'surface-2', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'surface', 4.5],
  ['muted-foreground', 'band', 4.5],
  ['placeholder', 'background', 4.5],
  ['placeholder', 'surface', 4.5],
  ['price', 'background', 4.5],
  ['price', 'surface', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['primary-foreground', 'primary-active', 4.5], // fim do gradiente dos CTAs
  ['destructive', 'surface', 4.5],
  ['destructive', 'destructive-surface', 4.5],
  ['success', 'surface', 4.5],
  ['success', 'success-surface', 4.5],
  ['input', 'background', 3],
  ['input', 'surface', 3],
  ['ring', 'background', 3],
]

test.describe('tokens de cor: contraste WCAG', () => {
  for (const [fg, bg, min] of PAIRS) {
    test(`${fg} sobre ${bg} ≥ ${min}:1`, () => {
      expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(min)
    })
  }
})

test.describe('Pagination.pageWindow', () => {
  test('janela com reticências', () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 'gap', 4])
    expect(pageWindow(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10])
    expect(pageWindow(1, 1)).toEqual([1])
  })
})
