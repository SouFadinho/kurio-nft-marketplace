/**
 * Cenários determinísticos da simulação (MOCK-04 / MOCK-06).
 * Um cenário é DADO, não código espalhado: os handlers consultam a configuração ativa.
 * Selecionado por `?scenario=<nome>` (com `&reset=1` para restaurar o seed) ou por
 * `window.__kurioMock.reset(nome)`.
 *
 * No CP1 existem só os cenários usados pela prova de conceito; a lista completa
 * (TECHNICAL_ARCHITECTURE §7.8) entra a partir do CP3.
 */
export interface ScenarioConfig {
  /** Latência fixa (ms) aplicada a todas as respostas REST. Fixa = reproduzível. */
  latencyMs: number
  /** 'auto': o pedido é liquidado após settleDelayMs. 'manual': só via controle do mock. */
  settlement: 'auto' | 'manual'
  settleDelayMs: number
  settleResult: 'confirmed' | 'rejected'
}

export const SCENARIOS = {
  default: { latencyMs: 120, settlement: 'auto', settleDelayMs: 1_500, settleResult: 'confirmed' },
  'payment-rejected': { latencyMs: 120, settlement: 'auto', settleDelayMs: 1_500, settleResult: 'rejected' },
  'manual-settlement': { latencyMs: 0, settlement: 'manual', settleDelayMs: 0, settleResult: 'confirmed' },
} satisfies Record<string, ScenarioConfig>

export type ScenarioName = keyof typeof SCENARIOS

export function isScenarioName(value: string): value is ScenarioName {
  return Object.hasOwn(SCENARIOS, value)
}
