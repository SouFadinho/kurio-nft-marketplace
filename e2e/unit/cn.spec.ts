import { expect, test } from '@playwright/test'
import { cn } from '../../src/lib/utils'

test.describe('lib/utils cn (tailwind-merge com tokens do KURIO)', () => {
  test('tamanho de texto personalizado convive com cor', () => {
    expect(cn('text-caption text-foreground/80')).toBe('text-caption text-foreground/80')
    expect(cn('text-body', 'text-primary-foreground')).toBe('text-body text-primary-foreground')
  })

  test('dois tamanhos de texto: vence o último', () => {
    expect(cn('text-body', 'text-caption')).toBe('text-caption')
    expect(cn('text-title-2', 'text-sm')).toBe('text-sm')
  })

  test('alinhamento não conflita com tamanho', () => {
    expect(cn('text-left', 'text-caption')).toBe('text-left text-caption')
  })
})
