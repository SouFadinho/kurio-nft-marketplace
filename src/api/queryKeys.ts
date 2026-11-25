/**
 * Fábrica de query keys.
 * - Dados públicos: ['nfts', ...]. A lista inclui TODOS os parâmetros de busca: cada
 *   combinação é um cache próprio (INT-08), e uma resposta antiga nunca sobrescreve outra.
 * - Dados privados: sempre sob ['me', userId, ...]. Isso isola o cache por usuário e
 *   permite descartar toda a sessão anterior com um único prefixo.
 */
import type { CatalogParams } from './contracts'

export const queryKeys = {
  session: ['session'] as const,
  nfts: {
    all: ['nfts'] as const,
    lists: ['nfts', 'list'] as const,
    list: (params: CatalogParams) => ['nfts', 'list', params] as const,
    details: ['nfts', 'detail'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
    highlights: ['nfts', 'highlights'] as const,
  },
  me: {
    all: (userId: string) => ['me', userId] as const,
    orders: (userId: string) => ['me', userId, 'orders'] as const,
    order: (userId: string, orderId: string) => ['me', userId, 'orders', orderId] as const,
    favorites: (userId: string) => ['me', userId, 'favorites'] as const,
    profile: (userId: string) => ['me', userId, 'profile'] as const,
    wallets: (userId: string) => ['me', userId, 'wallets'] as const,
  },
}
