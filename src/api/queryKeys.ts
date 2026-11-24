/**
 * Fábrica de query keys.
 * - Dados públicos: ['nfts', ...].
 * - Dados privados: sempre sob ['me', userId, ...]. Isso isola o cache por usuário (INT-08)
 *   e permite descartar toda a sessão anterior com um único prefixo.
 */
export const queryKeys = {
  session: ['session'] as const,
  nfts: {
    all: ['nfts'] as const,
    list: () => ['nfts', 'list'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
  },
  me: {
    all: (userId: string) => ['me', userId] as const,
    orders: (userId: string) => ['me', userId, 'orders'] as const,
    order: (userId: string, orderId: string) => ['me', userId, 'orders', orderId] as const,
  },
}
