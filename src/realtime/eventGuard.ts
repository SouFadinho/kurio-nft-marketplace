/**
 * Decide se um evento de tempo real deve ser aplicado (RT-03 / RT-04).
 *
 * Regras, na ordem:
 *  1. eventId já processado            → 'duplicate' (não reaplica efeitos)
 *  2. version <= versão conhecida       → 'stale'     (não regride estado mais novo)
 *  3. caso contrário                    → 'apply'
 *
 * A "versão conhecida" é a maior entre a última aplicada por evento e a que está no cache
 * (que pode ter vindo do REST numa reconciliação). Função pura, fácil de testar.
 */
export type GuardDecision = 'apply' | 'duplicate' | 'stale'

export class EventGuard {
  private readonly seen = new Set<string>()
  private readonly order: string[] = []
  private readonly versions = new Map<string, number>()

  private readonly capacity: number

  constructor(capacity = 500) {
    this.capacity = capacity
  }

  decide(event: { eventId: string; resource: { type: string; id: string }; version: number }, cachedVersion?: number): GuardDecision {
    if (this.seen.has(event.eventId)) return 'duplicate'
    this.remember(event.eventId)

    const key = `${event.resource.type}:${event.resource.id}`
    const known = Math.max(this.versions.get(key) ?? 0, cachedVersion ?? 0)
    if (event.version <= known) return 'stale'

    this.versions.set(key, event.version)
    return 'apply'
  }

  private remember(eventId: string) {
    this.seen.add(eventId)
    this.order.push(eventId)
    if (this.order.length > this.capacity) {
      const oldest = this.order.shift()
      if (oldest) this.seen.delete(oldest)
    }
  }
}
