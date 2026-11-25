/**
 * Handlers de sessão e conta (CP4): login, cadastro, sessão, logout, perfil, avatar, senha e
 * carteiras. Toda regra fica no "servidor": unicidade de e-mail e nome de usuário, validação,
 * limite de carteiras, troca da principal e autorização por dono.
 */
import { http, HttpResponse } from 'msw'
import {
  AVATAR_MAX_BYTES,
  AvatarUpload,
  LoginRequest,
  MAX_WALLETS,
  PasswordChange,
  ProfileUpdate,
  RegisterRequest,
  WalletInput,
  type ApiErrorBody,
  type Profile,
  type SessionResponse,
  type User,
  type Wallet,
} from '@/api/contracts'
import { db, type DbUser } from '../db'
import { hashPassword, randomHex } from '../crypto'
import { maybeFail, routeDelay } from '../failures'
import { realtimeControl } from '../realtime/server'
import { apiError, bearer, requireSession } from '../session'

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000

export const publicUser = (u: DbUser): User => ({ id: u.id, email: u.email, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl })
const publicProfile = (u: DbUser): Profile => ({ ...publicUser(u), walletNickname: u.walletNickname, version: u.version })

/** Converte erros do zod em `details` por campo (exibidos ao lado de cada campo). */
function validationError(issues: Array<{ path: PropertyKey[]; message: string }>, message = 'Revise os campos destacados.') {
  const details: Record<string, string> = {}
  for (const i of issues) {
    const key = String(i.path[0] ?? 'form')
    details[key] ??= i.message
  }
  return apiError(422, { code: 'VALIDATION_ERROR', message, details })
}

const conflict = (details: Record<string, string>, message = 'Alguns dados já estão em uso.') => apiError(409, { code: 'CONFLICT', message, details } satisfies ApiErrorBody)

function createSession(userId: string) {
  return db.commit((s) => {
    const created = { token: randomHex(24), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() }
    s.sessions.push(created)
    return created
  })
}

const sessionBody = (user: DbUser, session: { token: string; expiresAt: string }): SessionResponse => ({ token: session.token, expiresAt: session.expiresAt, user: publicUser(user) })

const findUser = (id: string) => db.get().users.find((u) => u.id === id)!
const json = async (request: Request) => request.json().catch(() => null)

export const accountHandlers = [
  // ---------- Sessão ----------
  http.post('/api/auth/login', async ({ request }) => {
    await routeDelay('auth.login', new URL(request.url))
    const failure = maybeFail('auth.login')
    if (failure) return failure
    const body = LoginRequest.safeParse(await json(request))
    if (!body.success) return validationError(body.error.issues)
    const user = db.get().users.find((u) => u.email === body.data.email.toLowerCase())
    const ok = user && (await hashPassword(body.data.password, user.salt)) === user.passwordHash
    // Mensagem genérica: não revela se o e-mail existe.
    if (!user || !ok) return apiError(401, { code: 'UNAUTHORIZED', message: 'E-mail ou senha inválidos.' })
    return HttpResponse.json(sessionBody(user, createSession(user.id)))
  }),

  http.post('/api/auth/register', async ({ request }) => {
    await routeDelay('auth.register', new URL(request.url))
    const failure = maybeFail('auth.register')
    if (failure) return failure
    const body = RegisterRequest.safeParse(await json(request))
    if (!body.success) return validationError(body.error.issues)
    const email = body.data.email.toLowerCase()
    const details: Record<string, string> = {}
    if (db.get().users.some((u) => u.email === email)) details.email = 'Este e-mail já está cadastrado.'
    if (db.get().users.some((u) => u.username === body.data.username)) details.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(details).length) return conflict(details)

    const salt = randomHex(16)
    const user: DbUser = {
      id: db.nextId('usr'),
      email,
      username: body.data.username,
      displayName: body.data.username,
      walletNickname: 'Minha carteira',
      avatarUrl: null,
      version: 1,
      salt,
      passwordHash: await hashPassword(body.data.password, salt),
    }
    db.commit((s) => {
      s.users.push(user)
      s.wallets[user.id] = []
    })
    // Cadastro já autentica (a pessoa segue o fluxo de onde parou).
    return HttpResponse.json(sessionBody(user, createSession(user.id)), { status: 201 })
  }),

  http.get('/api/auth/session', async ({ request }) => {
    await routeDelay('me.profile.read', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    return HttpResponse.json({ user: publicUser(findUser(session.userId)) })
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    await routeDelay('auth.login', new URL(request.url))
    const token = bearer(request)
    if (token) {
      db.commit((s) => {
        s.sessions = s.sessions.filter((x) => x.token !== token)
      })
      realtimeControl.dropToken(token)
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------- Perfil ----------
  http.get('/api/me/profile', async ({ request }) => {
    await routeDelay('me.profile.read', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('me.profile.read')
    if (failure) return failure
    return HttpResponse.json(publicProfile(findUser(session.userId)))
  }),

  http.put('/api/me/profile', async ({ request }) => {
    await routeDelay('me.profile.write', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('me.profile.write')
    if (failure) return failure
    const body = ProfileUpdate.safeParse(await json(request))
    if (!body.success) return validationError(body.error.issues)
    const email = body.data.email.toLowerCase()
    const others = db.get().users.filter((u) => u.id !== session.userId)
    const details: Record<string, string> = {}
    if (others.some((u) => u.email === email)) details.email = 'Este e-mail já está em uso por outra conta.'
    if (others.some((u) => u.username === body.data.username)) details.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(details).length) return conflict(details)
    const updated = db.commit((s) => {
      const u = s.users.find((x) => x.id === session.userId)!
      Object.assign(u, { ...body.data, email, version: u.version + 1 })
      return { ...u }
    })
    return HttpResponse.json(publicProfile(updated))
  }),

  http.put('/api/me/avatar', async ({ request }) => {
    await routeDelay('me.avatar', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('me.avatar')
    if (failure) return failure
    const body = AvatarUpload.safeParse(await json(request))
    if (!body.success) return validationError(body.error.issues, 'Arquivo de imagem inválido.')
    // Tamanho real do arquivo (base64 → bytes).
    const bytes = Math.floor((body.data.dataUrl.split(',')[1]?.length ?? 0) * 0.75)
    if (bytes > AVATAR_MAX_BYTES) return apiError(422, { code: 'VALIDATION_ERROR', message: 'A imagem excede 512 KB.', details: { avatar: 'A imagem excede 512 KB.' } })
    const updated = db.commit((s) => {
      const u = s.users.find((x) => x.id === session.userId)!
      u.avatarUrl = body.data.dataUrl
      u.version += 1
      return { ...u }
    })
    return HttpResponse.json(publicProfile(updated))
  }),

  http.delete('/api/me/avatar', async ({ request }) => {
    await routeDelay('me.avatar', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('me.avatar')
    if (failure) return failure
    const updated = db.commit((s) => {
      const u = s.users.find((x) => x.id === session.userId)!
      u.avatarUrl = null
      u.version += 1
      return { ...u }
    })
    return HttpResponse.json(publicProfile(updated))
  }),

  http.put('/api/me/password', async ({ request }) => {
    await routeDelay('me.password', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('me.password')
    if (failure) return failure
    const body = PasswordChange.safeParse(await json(request))
    if (!body.success) return validationError(body.error.issues)
    const user = findUser(session.userId)
    if ((await hashPassword(body.data.currentPassword, user.salt)) !== user.passwordHash) {
      return apiError(422, { code: 'VALIDATION_ERROR', message: 'A senha atual está incorreta.', details: { currentPassword: 'A senha atual está incorreta.' } })
    }
    const salt = randomHex(16)
    const passwordHash = await hashPassword(body.data.newPassword, salt)
    db.commit((s) => {
      const u = s.users.find((x) => x.id === session.userId)!
      u.salt = salt
      u.passwordHash = passwordHash
      // As OUTRAS sessões do usuário são encerradas; a atual continua válida.
      s.sessions = s.sessions.filter((x) => x.userId !== u.id || x.token === session.token)
    })
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------- Carteiras ----------
  http.get('/api/me/wallets', async ({ request }) => {
    await routeDelay('me.wallets.read', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('me.wallets.read')
    if (failure) return failure
    return HttpResponse.json({ items: db.get().wallets[session.userId] ?? [] })
  }),

  http.post('/api/me/wallets', async ({ request }) => {
    await routeDelay('me.wallets.write', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('me.wallets.write')
    if (failure) return failure
    const body = WalletInput.safeParse(await json(request))
    if (!body.success) return validationError(body.error.issues)
    const list = db.get().wallets[session.userId] ?? []
    if (list.length >= MAX_WALLETS) return conflict({ form: 'Você já tem uma carteira principal e uma secundária.' }, 'Limite de carteiras atingido.')
    if (list.some((w) => w.address.toLowerCase() === body.data.address.toLowerCase())) return conflict({ address: 'Esta carteira já está cadastrada.' })
    const wallet: Wallet = {
      id: db.nextId('wal'),
      nickname: body.data.nickname,
      network: body.data.network,
      type: body.data.type,
      address: body.data.address,
      ens: body.data.ens || null,
      // A primeira carteira cadastrada é a principal.
      primary: list.length === 0,
      version: 1,
    }
    db.commit((s) => {
      s.wallets[session.userId] = [...(s.wallets[session.userId] ?? []), wallet]
    })
    return HttpResponse.json(wallet, { status: 201 })
  }),

  http.put('/api/me/wallets/:id', async ({ request, params }) => {
    await routeDelay('me.wallets.write', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('me.wallets.write')
    if (failure) return failure
    const list = db.get().wallets[session.userId] ?? []
    // Carteira de outro usuário responde 404 (não revela que existe).
    const target = list.find((w) => w.id === params.id)
    if (!target) return apiError(404, { code: 'NOT_FOUND', message: 'Carteira não encontrada.' })
    const body = WalletInput.safeParse(await json(request))
    if (!body.success) return validationError(body.error.issues)
    if (list.some((w) => w.id !== target.id && w.address.toLowerCase() === body.data.address.toLowerCase())) return conflict({ address: 'Esta carteira já está cadastrada.' })
    const updated = db.commit((s) => {
      const w = s.wallets[session.userId]!.find((x) => x.id === target.id)!
      Object.assign(w, { ...body.data, ens: body.data.ens || null, version: w.version + 1 })
      return { ...w }
    })
    return HttpResponse.json(updated)
  }),

  http.post('/api/me/wallets/:id/primary', async ({ request, params }) => {
    await routeDelay('me.wallets.write', new URL(request.url))
    const session = requireSession(request)
    if (session instanceof Response) return session
    const failure = maybeFail('me.wallets.write')
    if (failure) return failure
    const list = db.get().wallets[session.userId] ?? []
    if (!list.some((w) => w.id === params.id)) return apiError(404, { code: 'NOT_FOUND', message: 'Carteira não encontrada.' })
    const items = db.commit((s) => {
      for (const w of s.wallets[session.userId]!) {
        const next = w.id === params.id
        if (w.primary !== next) {
          w.primary = next
          w.version += 1
        }
      }
      return structuredClone(s.wallets[session.userId]!)
    })
    return HttpResponse.json({ items })
  }),
]
