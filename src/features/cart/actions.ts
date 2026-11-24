/**
 * Contrato das ações de compra usado pelas telas do CP3 (detalhe do NFT).
 *
 * A implementação real (API de carrinho, cotação e checkout) entra no CP5. Até lá, as ações
 * NÃO simulam sucesso: informam que a compra ainda não está disponível. Quando o CP5
 * chegar, só este módulo muda; as telas continuam chamando `addToCart` e `buyNow` com o
 * mesmo formato de entrada.
 */
import { toast } from 'sonner'

export interface CartLineInput {
  nftId: string
  name: string
  editionId: string
  quantity: number
}

const unavailable = (action: string, line: CartLineInput) =>
  toast.info('Compra ainda não disponível', {
    description: `${action} (${line.name}, ${line.quantity} un.) será habilitado em breve nesta versão do KURIO.`,
  })

export function useCartActions() {
  return {
    /** false enquanto o carrinho não estiver implementado (CP5). */
    enabled: false as boolean,
    addToCart: (line: CartLineInput) => unavailable('Adicionar ao carrinho', line),
    buyNow: (line: CartLineInput) => unavailable('Comprar agora', line),
  }
}
