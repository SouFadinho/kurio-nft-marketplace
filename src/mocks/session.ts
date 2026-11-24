import { HttpResponse } from 'msw'
import type { ApiErrorBody } from '@/api/contracts'
import { db, type DbSession } from './db'

export function resolveSession(token: string | null): DbSession | null {
  if (!token) return null
  const session = db.get().sessions.find((s) => s.token === token)
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null
  return session
}

export function bearer(request: Request): string | null {
  const header = request.headers.get('Authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

export function apiError(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status })
}

/** Retorna a sessão ou uma resposta 401 pronta. */
export function requireSession(request: Request): DbSession | Response {
  const token = bearer(request)
  const session = resolveSession(token)
  if (session) return session
  return apiError(401, {
    code: token ? 'SESSION_EXPIRED' : 'UNAUTHORIZED',
    message: token ? 'Sua sessão expirou. Entre novamente.' : 'Autenticação necessária.',
  })
}
