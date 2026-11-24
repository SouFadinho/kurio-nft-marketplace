/**
 * Cliente HTTP único da aplicação (INT-03). Toda chamada REST passa por aqui.
 *
 * - Injeta o token da sessão.
 * - Converte erros HTTP em ApiError tipado (código estável vindo do contrato).
 * - 401 encerra a sessão local: o Router redireciona para o login preservando o destino.
 * - Aceita AbortSignal (o TanStack Query repassa) para cancelar respostas obsoletas (INT-07).
 */
import axios, { AxiosError } from 'axios'
import { ApiErrorBody, type ApiErrorCode } from './contracts'
import { sessionStore } from '@/features/auth/sessionStore'

export class ApiError extends Error {
  readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'UNKNOWN'
  readonly status: number | null
  readonly details: Record<string, string> | undefined

  constructor(code: ApiError['code'], message: string, status: number | null, details?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export const http = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const session = sessionStore.get()
  if (session) config.headers.set('Authorization', `Bearer ${session.token}`)
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error)
    if (!(error instanceof AxiosError)) return Promise.reject(new ApiError('UNKNOWN', 'Erro inesperado', null))

    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return Promise.reject(new ApiError('TIMEOUT', 'O servidor demorou para responder.', null))
    }
    if (!error.response) {
      return Promise.reject(new ApiError('NETWORK_ERROR', 'Sem conexão com o servidor.', null))
    }

    const { status, data } = error.response
    const parsed = ApiErrorBody.safeParse(data)
    const apiError = parsed.success
      ? new ApiError(parsed.data.code, parsed.data.message, status, parsed.data.details)
      : new ApiError('UNKNOWN', `Erro HTTP ${status}`, status)

    if (status === 401) sessionStore.clear()
    return Promise.reject(apiError)
  },
)
