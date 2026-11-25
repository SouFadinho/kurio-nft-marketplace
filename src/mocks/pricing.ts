/**
 * Precificação da cotação (lado "servidor"). Função pura, testada por unidade.
 *
 * Toda a conta é feita em wei (bigint): subtotal = Σ preço × quantidade; desconto = piso de
 * (subtotal × percentual / 100); total = subtotal − desconto + taxa de rede. Os valores saem
 * como strings decimais canônicas (contrato `EthAmount`). Nenhum ponto flutuante.
 */
import type { Network } from '@/api/contracts'
import { addEth, mulEth, parseEth, toEthString, type Wei } from '@/lib/eth'

/**
 * Taxa de rede estimada, expressa em ETH para manter uma única unidade no resumo.
 * Ethereum reproduz o Figma (0.016 ETH). Polygon e Solana são valores fictícios menores,
 * equivalentes em ETH (R-12: o Figma mostra a taxa em ETH até na Polygon).
 */
export const NETWORK_FEE: Record<Network, string> = { ethereum: '0.016', polygon: '0.002', solana: '0.001' }

export interface PricingLine {
  lineId: string
  nftId: string
  editionId: string
  name: string
  unitPrice: string
  quantity: number
}

export interface Pricing {
  lines: Array<PricingLine & { lineTotal: string }>
  subtotal: string
  discount: string
  networkFee: string
  total: string
}

export function priceCart(lines: PricingLine[], percentOff: number, network: Network): Pricing {
  if (!Number.isInteger(percentOff) || percentOff < 0 || percentOff > 100) throw new Error('Percentual de desconto inválido')
  const priced = lines.map((l) => ({ ...l, lineTotalWei: mulEth(parseEth(l.unitPrice), l.quantity) }))
  const subtotal = addEth(...priced.map((l) => l.lineTotalWei))
  const discount = ((subtotal * BigInt(percentOff)) / 100n) as Wei
  const fee = lines.length > 0 ? parseEth(NETWORK_FEE[network]) : (0n as Wei)
  const total = (subtotal - discount + fee) as Wei
  return {
    lines: priced.map(({ lineTotalWei, ...l }) => ({ ...l, lineTotal: toEthString(lineTotalWei) })),
    subtotal: toEthString(subtotal),
    discount: toEthString(discount),
    networkFee: toEthString(fee),
    total: toEthString(total),
  }
}
