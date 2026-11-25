/**
 * Cliente HTTP único da aplicação (INT-03). Toda chamada REST passa por aqui.
 *
 * - Injeta o token da sessão.
 * - Converte erros HTTP em ApiError tipado (código estável vindo do contrato).
 * - 401 numa requisição AUTENTICADA = sessão expirada/inválida → `sessionStore.expire()`;
 *   o SessionEffects leva ao login preservando a rota e a ação pendente (ACC-04).
 * - Guarda de época (ELIM-04): cada requisição é carimbada com a época da sessão. Se a sessão
 *   mudou enquanto ela estava em voo (logout, troca de usuário, expiração), a resposta é
 *   DESCARTADA (STALE_SESSION) e nunca chega ao cache da sessão nova.
 * - Aceita AbortSignal (o TanStack Query repassa) para cancelar respostas obsoletas (INT-07).
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { ApiErrorBody, type ApiErrorCode } from './contracts'
import { sessionStore } from '@/features/auth/sessionStore'
import { saveIntent, type NewIntent } from '@/features/auth/intent'

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Ação do usuário que esta requisição executa. Se a sessão tiver expirado (401), a intenção
     * é guardada ANTES de encerrar a sessão, para ser retomada após o novo login (ACC-04).
     */
    kurioIntent?: NewIntent
  }
}

export class ApiError extends Error {
  readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'STALE_SESSION' | 'UNKNOWN'
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

type KurioConfig = InternalAxiosRequestConfig & { kurioEpoch?: number; kurioAuthenticated?: boolean }

export const http = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config: KurioConfig) => {
  const session = sessionStore.get()
  config.kurioEpoch = sessionStore.getEpoch()
  config.kurioAuthenticated = !!session
  if (session) config.headers.set('Authorization', `Bearer ${session.token}`)
  return config
})

const staleError = () => new ApiError('STALE_SESSION', 'A sessão mudou durante a requisição; resposta descartada.', null)
const isStale = (config: KurioConfig | undefined) => !!config?.kurioAuthenticated && config.kurioEpoch !== sessionStore.getEpoch()

http.interceptors.response.use(
  (response) => (isStale(response.config as KurioConfig) ? Promise.reject(staleError()) : response),
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error)
    if (!(error instanceof AxiosError)) return Promise.reject(new ApiError('UNKNOWN', 'Erro inesperado', null))
    const config = error.config as KurioConfig | undefined
    if (isStale(config)) return Promise.reject(staleError())

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

    // Só uma requisição feita COM sessão pode expirá-la (o 401 do login é "credenciais inválidas").
    if (status === 401 && config?.kurioAuthenticated) {
      if (config.kurioIntent) saveIntent(config.kurioIntent)
      sessionStore.expire()
    }
    return Promise.reject(apiError)
  },
)
