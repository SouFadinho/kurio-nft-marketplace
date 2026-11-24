import { expect, test } from '@playwright/test'
import { EventGuard } from '../../src/realtime/eventGuard'

const ev = (eventId: string, version: number, id = 'nft-001') => ({ eventId, resource: { type: 'nft', id }, version })

test.describe('realtime/EventGuard', () => {
  test('aplica versões crescentes', () => {
    const g = new EventGuard()
    expect(g.decide(ev('e1', 2), 1)).toBe('apply')
    expect(g.decide(ev('e2', 3), 2)).toBe('apply')
  })

  test('descarta duplicata pelo eventId', () => {
    const g = new EventGuard()
    expect(g.decide(ev('e1', 2), 1)).toBe('apply')
    expect(g.decide(ev('e1', 2), 2)).toBe('duplicate')
  })

  test('descarta evento antigo ou igual à versão do cache (ex.: após reconciliação REST)', () => {
    const g = new EventGuard()
    expect(g.decide(ev('e1', 3), 5)).toBe('stale')
    expect(g.decide(ev('e2', 5), 5)).toBe('stale')
  })

  test('fora de ordem: v3 chega antes de v2 → v2 descartado', () => {
    const g = new EventGuard()
    expect(g.decide(ev('e3', 3), 1)).toBe('apply')
    expect(g.decide(ev('e2', 2), 1)).toBe('stale')
  })

  test('versões independentes por recurso', () => {
    const g = new EventGuard()
    expect(g.decide(ev('a', 5, 'nft-001'), 1)).toBe('apply')
    expect(g.decide(ev('b', 2, 'nft-002'), 1)).toBe('apply')
  })

  test('memória limitada de eventIds', () => {
    const g = new EventGuard(2)
    g.decide(ev('a', 2), 1)
    g.decide(ev('b', 3), 1)
    g.decide(ev('c', 4), 1)
    // 'a' saiu da memória, mas a versão ainda o barra como antigo.
    expect(g.decide(ev('a', 2), 1)).toBe('stale')
  })
})
