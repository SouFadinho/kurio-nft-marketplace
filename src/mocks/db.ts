/**
 * "Banco" da simulação: estado único e consistente para todos os handlers REST
 * e para o servidor Socket.IO simulado (MOCK-02 / MOCK-10).
 *
 * - Persistido em localStorage para sustentar refresh (MOCK-03).
 * - `reset(scenario)` recria TUDO a partir do seed determinístico.
 * - Toda escrita passa por `commit()`, que persiste o estado.
 */
import type { Order, Wallet } from '@/api/contracts'
import { buildCatalog, type CatalogNft } from './fixtures/catalog'
import { hashPassword } from './crypto'
import { SCENARIOS, type ScenarioConfig, type ScenarioName } from './scenarios'

// v4 (CP4): usuários com perfil completo, avatar e carteiras; estados anteriores são descartados.
const STORAGE_KEY = 'kurio:mock:db:v4'

export interface DbUser {
  id: string
  email: string
  displayName: string
  username: string
  walletNickname: string
  avatarUrl: string | null
  /** Versão do perfil (cresce a cada alteração). */
  version: number
  /** Salt aleatório por usuário + hash PBKDF2: a senha nunca é guardada em claro (ACC-08). */
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
  schema: 4
  scenario: ScenarioName
  seq: number
  users: DbUser[]
  sessions: DbSession[]
  nfts: DbNft[]
  orders: DbOrder[]
  /** Favoritos por usuário (ids de NFT, mais recente primeiro). */
  favorites: Record<string, string[]>
  /** Carteiras por usuário (no máximo uma principal e uma secundária). */
  wallets: Record<string, Wallet[]>
}

/** Usuários fictícios (MOCK-05). As senhas estão documentadas no README; aqui só existem como hash. */
export const SEED_USERS = [
  { id: 'usr_ana', email: 'ana@kurio.test', displayName: 'Ana Colecionadora', username: 'ana.coleciona', walletNickname: 'Principal', password: 'Kurio#Ana2026' },
  { id: 'usr_bruno', email: 'bruno@kurio.test', displayName: 'Bruno Curador', username: 'bruno.curador', walletNickname: 'Cofre', password: 'Kurio#Bruno2026' },
] as const

/** Carteiras fictícias. As de Ana reproduzem o Figma (Mobile / Pagamento: "Principal" e "Reserva · nova.kurio.eth · Rede Polygon"). */
const SEED_WALLETS: Record<string, Wallet[]> = {
  usr_ana: [
    { id: 'wal_ana_1', nickname: 'Principal', network: 'ethereum', type: 'metamask', address: '0xA91F7c2D3e4F5a6B7c8D9e0F1a2B3c4D5e6FE82C', ens: null, primary: true, version: 1 },
    { id: 'wal_ana_2', nickname: 'Reserva', network: 'polygon', type: 'coinbase', address: '0x8f3Cb6aD61b5e2B7C9a4d1E0f2A3b4C5d6E7F801', ens: 'nova.kurio', primary: false, version: 1 },
  ],
  usr_bruno: [{ id: 'wal_bruno_1', nickname: 'Cofre', network: 'solana', type: 'walletconnect', address: '7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2', ens: null, primary: true, version: 1 }],
}

let state: DbState | null = null

async function seed(scenario: ScenarioName): Promise<DbState> {
  const users: DbUser[] = await Promise.all(
    SEED_USERS.map(async (u) => {
      const salt = `salt-${u.id}`
      return { id: u.id, email: u.email, displayName: u.displayName, username: u.username, walletNickname: u.walletNickname, avatarUrl: null, version: 1, salt, passwordHash: await hashPassword(u.password, salt) }
    }),
  )
  return {
    schema: 4,
    scenario,
    seq: 0,
    users,
    sessions: [],
    nfts: buildCatalog().map((n) => ({ ...n, version: 1 })),
    orders: [],
    favorites: {},
    wallets: structuredClone(SEED_WALLETS),
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
        if (parsed?.schema === 4) {
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
