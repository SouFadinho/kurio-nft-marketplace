/**
 * Regra de merge do carrinho de visitante no carrinho do usuário (função pura, testada por
 * unidade). Determinística:
 * 1. linhas do usuário mantêm a posição; linhas novas do visitante entram no fim, na ordem;
 * 2. mesma linha (NFT + edição): as quantidades SOMAM;
 * 3. o resultado é limitado ao estoque atual e a `MAX_LINE_QUANTITY`; linha sem estoque sai;
 * 4. cupom: vale o do usuário; se ele não tiver, o do visitante.
 */
import { MAX_LINE_QUANTITY } from '@/api/contracts'

export interface MergeLine {
  nftId: string
  editionId: string
  quantity: number
  priceAtAdd: string
}

export interface MergeCart {
  lines: MergeLine[]
  couponCode: string | null
}

export function mergeCartLines(
  user: MergeCart,
  guest: MergeCart,
  availableOf: (nftId: string, editionId: string) => number,
  nameOf: (nftId: string) => string,
): { cart: MergeCart; adjusted: Array<{ name: string; requested: number; kept: number }>; merged: number } {
  const lines = user.lines.map((l) => ({ ...l }))
  for (const g of guest.lines) {
    const existing = lines.find((l) => l.nftId === g.nftId && l.editionId === g.editionId)
    if (existing) existing.quantity += g.quantity
    else lines.push({ ...g })
  }
  const adjusted: Array<{ name: string; requested: number; kept: number }> = []
  const kept = lines.filter((l) => {
    const keep = Math.min(l.quantity, availableOf(l.nftId, l.editionId), MAX_LINE_QUANTITY)
    if (keep !== l.quantity) adjusted.push({ name: nameOf(l.nftId), requested: l.quantity, kept: Math.max(0, keep) })
    l.quantity = keep
    return keep > 0
  })
  return { cart: { lines: kept, couponCode: user.couponCode ?? guest.couponCode }, adjusted, merged: guest.lines.length }
}
