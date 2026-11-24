/**
 * "Banco" da simulação: estado único e consistente para todos os handlers REST
 * e para o servidor Socket.IO simulado (MOCK-02 / MOCK-10).
 *
 * - Persistido em localStorage para sustentar refresh (MOCK-03).
 * - `reset(scenario)` recria TUDO a partir do seed determinístico.
 * - Toda escrita passa por `commit()`, que persiste o estado.
 */
import type { Order } from '@/api/contracts'
import { buildCatalog, type CatalogNft } from './fixtures/catalog'
import { hashPassword } from './crypto'
import { SCENARIOS, type ScenarioConfig, type ScenarioName } from './scenarios'

// v3 (CP3): catálogo de 36 NFTs com edições e favoritos; estados anteriores são descartados.
const STORAGE_KEY = 'kurio:mock:db:v3'

export interface DbUser {
  id: string
  email: string
  displayName: string
  salt: string
  passwordHash: string
}

export interface DbSession {
  token: string
  userId: string
  expiresAt: string
}

export interface DbOrder extends Order {
  idempotencyKey: string
  requestHash: string
  /** Momento (epoch ms) em que a liquidação automática deve acontecer; null = manual. */
  settleAt: number | null
}

/** NFT no banco: dados do catálogo + versão do recurso (ordenação de eventos). */
export interface DbNft extends CatalogNft {
  version: number
}

export interface DbState {
  schema: 3
  scenario: ScenarioName
  seq: number
  users: DbUser[]
  sessions: DbSession[]
  nfts: DbNft[]
  orders: DbOrder[]
  /** Favoritos por usuário (ids de NFT, mais recente primeiro). */
  favorites: Record<string, string[]>
}

/** Usuários fictícios (MOCK-05). As senhas estão documentadas no README; aqui só existem como hash. */
export const SEED_USERS = [
  { id: 'usr_ana', email: 'ana@kurio.test', displayName: 'Ana Colecionadora', password: 'Kurio#Ana2026' },
  { id: 'usr_bruno', email: 'bruno@kurio.test', displayName: 'Bruno Curador', password: 'Kurio#Bruno2026' },
] as const

let state: DbState | null = null

async function seed(scenario: ScenarioName): Promise<DbState> {
  const users: DbUser[] = await Promise.all(
    SEED_USERS.map(async (u) => {
      const salt = `salt-${u.id}`
      return { id: u.id, email: u.email, displayName: u.displayName, salt, passwordHash: await hashPassword(u.password, salt) }
    }),
  )
  return {
    schema: 3,
    scenario,
    seq: 0,
    users,
    sessions: [],
    nfts: buildCatalog().map((n) => ({ ...n, version: 1 })),
    orders: [],
    favorites: {},
  }
}

function persist() {
  if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const db = {
  async init(options: { reset: boolean; scenario: ScenarioName | null }) {
    if (!options.reset) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const parsed = raw ? (JSON.parse(raw) as DbState) : null
        if (parsed?.schema === 3) {
          state = parsed
          if (options.scenario) state.scenario = options.scenario
          persist()
          return
        }
      } catch {
        // Persistência corrompida: recomeça do seed.
      }
    }
    state = await seed(options.scenario ?? 'default')
    persist()
  },

  async reset(scenario: ScenarioName = 'default') {
    state = await seed(scenario)
    persist()
  },

  get(): DbState {
    if (!state) throw new Error('Mock DB não inicializado')
    return state
  },

  scenario(): ScenarioConfig {
    return SCENARIOS[db.get().scenario]
  },

  /** Aplica uma alteração e persiste. Toda escrita no estado passa por aqui. */
  commit<T>(mutate: (s: DbState) => T): T {
    const result = mutate(db.get())
    persist()
    return result
  },

  nextId(prefix: string): string {
    return db.commit((s) => `${prefix}_${String(++s.seq).padStart(6, '0')}`)
  },
}
