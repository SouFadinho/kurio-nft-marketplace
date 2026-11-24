import { expect, test } from '@playwright/test'
import { toCatalogParams, validateCatalogSearch } from '../../src/features/catalog/search'

test.describe('features/catalog/search (validação da URL)', () => {
  test('descarta valores inválidos e mantém os válidos', () => {
    expect(validateCatalogSearch({ network: 'bitcoin', sort: 'xyz', page: -3, category: 'nada' })).toEqual({})
    expect(validateCatalogSearch({ network: 'polygon', category: 'musica', page: 2, q: 'golden' })).toEqual({ network: 'polygon', category: 'musica', page: 2, q: 'golden' })
  })

  test('aceita números vindos da URL e normaliza preços', () => {
    expect(validateCatalogSearch({ minPrice: 0.5, maxPrice: 2 })).toEqual({ minPrice: '0.5', maxPrice: '2' })
  })

  test('faixa invertida é corrigida e padrões não aparecem', () => {
    expect(validateCatalogSearch({ minPrice: '3', maxPrice: '1', tab: 'all', sort: 'recent', page: 1 })).toEqual({ minPrice: '1', maxPrice: '3' })
  })

  test('parâmetros da API sempre têm página válida', () => {
    expect(toCatalogParams({})).toEqual({ page: 1 })
  })

  test('devolve as chaves inválidas como undefined (o Router mescla sobre a query crua)', () => {
    const raw = { network: 'bitcoin', page: -3, foo: 'bar' }
    const merged = { ...raw, ...validateCatalogSearch(raw) }
    expect(merged.network).toBeUndefined()
    expect(merged.page).toBeUndefined()
    // Simula o objeto mesclado que o Router entrega ao componente (com chave desconhecida).
    expect(Object.keys(toCatalogParams(merged as Parameters<typeof toCatalogParams>[0]))).not.toContain('foo')
  })
})
