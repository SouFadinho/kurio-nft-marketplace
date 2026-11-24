/**
 * "Banco" da simulação: estado único e consistente para todos os handlers REST
 * e para o servidor Socket.IO simulado (MOCK-02 / MOCK-10).
 *
 * - Persistido em localStorage para sustentar refresh (MOCK-03).
 * - `reset(scenario)` recria TUDO a partir do seed determinístico.
 * - Toda escrita passa por `commit()`, que persiste o estado.
 */
import type { Nft, Order } from '@/api/contracts'
import { hashPassword } from './crypto'
import { SCENARIOS, type ScenarioConfig, type ScenarioName } from './scenarios'

// v2 (CP2): NFTs ganharam image/imageAlt/network/rare; estados v1 persistidos são descartados.
const STORAGE_KEY = 'kurio:mock:db:v2'

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

export interface DbState {
  schema: 1
  scenario: ScenarioName
  seq: number
  users: DbUser[]
  sessions: DbSession[]
  nfts: Nft[]
  orders: DbOrder[]
}

/** Usuários fictícios (MOCK-05). As senhas estão documentadas no README; aqui só existem como hash. */
export const SEED_USERS = [
  { id: 'usr_ana', email: 'ana@kurio.test', displayName: 'Ana Colecionadora', password: 'Kurio#Ana2026' },
  { id: 'usr_bruno', email: 'bruno@kurio.test', displayName: 'Bruno Curador', password: 'Kurio#Bruno2026' },
] as const

/**
 * Artes: placeholders temporários (planning/ASSETS_MANIFEST.md). Personagens com a mesma
 * aparência no Figma reutilizam a mesma arte: as variações de cor do original não estão disponíveis.
 */
const ART = {
  emerald: { image: '/assets/nfts/emerald-ape.webp', imageAlt: 'Macaco de pelo castanho com óculos redondos de lentes verdes e jaqueta college verde e creme' },
  sage: { image: '/assets/nfts/sage-nomad.webp', imageAlt: 'Gorila cinza com chapéu bucket verde-oliva e moletom roxo, sobre fundo creme' },
  violet: { image: '/assets/nfts/violet-nomad.webp', imageAlt: 'Gorila cinza-escuro com chapéu bucket verde e moletom roxo, sobre fundo amarelado' },
  ivory: { image: '/assets/nfts/ivory-baron.webp', imageAlt: 'Chimpanzé de pelo preto com blazer marfim e gola alta verde, sobre fundo verde-água' },
  golden: { image: '/assets/nfts/golden-beat.webp', imageAlt: 'Orangotango de pelo dourado com fones de ouvido verdes e jaqueta creme, sobre fundo sálvia' },
} as const

const SEED_NFTS: Array<Omit<Nft, 'version'>> = [
  { id: 'nft-001', name: 'Emerald Ape #042', collection: 'Kurio Apes', ...ART.emerald, network: 'ethereum', rare: false, price: '1.19', available: 50 },
  { id: 'nft-002', name: 'Sage Nomad #009', collection: 'Kurio Apes', ...ART.sage, network: 'ethereum', rare: false, price: '1.69', available: 10 },
  { id: 'nft-003', name: 'Neon Vessel #552', collection: 'Kurio Apes', ...ART.ivory, network: 'polygon', rare: true, price: '1.99', available: 1 },
  { id: 'nft-004', name: 'Cosmic Bloom #118', collection: 'Kurio Editions', ...ART.violet, network: 'polygon', rare: false, price: '1.29', available: 25 },
  { id: 'nft-005', name: 'Violet Nomad #314', collection: 'Kurio Editions', ...ART.violet, network: 'ethereum', rare: false, price: '1.39', available: 8 },
  { id: 'nft-006', name: 'Ivory Baron #088', collection: 'Kurio Editions', ...ART.ivory, network: 'ethereum', rare: false, price: '1.79', available: 10 },
  { id: 'nft-007', name: 'Golden Beat #207', collection: 'Kurio Sound', ...ART.golden, network: 'solana', rare: false, price: '0.99', available: 50 },
  { id: 'nft-008', name: 'Golden Frequency #071', collection: 'Kurio Sound', ...ART.golden, network: 'solana', rare: false, price: '0.89', available: 0 },
  { id: 'nft-009', name: 'Golden Signal #160', collection: 'Kurio Sound', ...ART.golden, network: 'ethereum', rare: false, price: '0.39', available: 30 },
]

let state: DbState | null = null

async function seed(scenario: ScenarioName): Promise<DbState> {
  const users: DbUser[] = await Promise.all(
    SEED_USERS.map(async (u) => {
      const salt = `salt-${u.id}`
      return { id: u.id, email: u.email, displayName: u.displayName, salt, passwordHash: await hashPassword(u.password, salt) }
    }),
  )
  return {
    schema: 1,
    scenario,
    seq: 0,
    users,
    sessions: [],
    nfts: SEED_NFTS.map((n) => ({ ...n, version: 1 })),
    orders: [],
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
        if (parsed?.schema === 1) {
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
