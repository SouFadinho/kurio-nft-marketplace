/**
 * Ações de compra usadas pelo catálogo e pelo detalhe do NFT (contrato definido no CP3).
 *
 * - Adicionar: a API valida estoque e soma à linha existente (NFT + edição). Feedback em toast
 *   (região aria-live) com atalho "Ver carrinho".
 * - Comprar agora: adiciona e vai para o pagamento. Visitante passa pelo login (o carrinho de
 *   visitante é mesclado) e volta ao pagamento.
 * `mutateAsync`: o resultado chega mesmo se o componente desmontar (ex.: navegação).
 */
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/http'
import { apiErrorMessage } from '@/components/kurio/form'
import { useAddToCart } from './queries'

export interface CartLineInput {
  nftId: string
  name: string
  /** Vazio = a API escolhe a primeira edição disponível (card do catálogo). */
  editionId?: string
  quantity: number
}

function failure(name: string, error: unknown) {
  if (error instanceof ApiError && error.code === 'OUT_OF_STOCK') {
    toast.error(`Sem estoque suficiente de ${name}`, { description: error.message })
  } else {
    toast.error(`Não foi possível adicionar ${name} ao carrinho`, { description: apiErrorMessage(error) })
  }
}

export function useCartActions() {
  const add = useAddToCart()
  const navigate = useNavigate()

  const send = (line: CartLineInput) =>
    add.mutateAsync({ nftId: line.nftId, editionId: line.editionId || undefined, quantity: line.quantity, name: line.name })

  return {
    enabled: true as boolean,
    pendingNftId: add.isPending ? add.variables?.nftId : undefined,
    addToCart: (line: CartLineInput) =>
      send(line).then(
        () =>
          toast.success(`${line.name} adicionado ao carrinho`, {
            description: line.quantity > 1 ? `${line.quantity} unidades.` : undefined,
            action: { label: 'Ver carrinho', onClick: () => void navigate({ to: '/carrinho' }) },
          }),
        (error: unknown) => failure(line.name, error),
      ),
    buyNow: (line: CartLineInput) =>
      send(line).then(
        () => void navigate({ to: '/pagamento' }),
        (error: unknown) => failure(line.name, error),
      ),
  }
}
