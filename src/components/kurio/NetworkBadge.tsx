import type { Network } from '@/api/contracts'
import { cn } from '@/lib/utils'

export const NETWORK_LABEL: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

const DOT: Record<Network, string> = {
  ethereum: 'bg-network-ethereum',
  polygon: 'bg-network-polygon',
  solana: 'bg-network-solana',
}

/** Rede do NFT/carteira. Ponto colorido + nome: a informação não depende só de cor. */
export function NetworkBadge({ network, className }: { network: Network; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-caption text-muted-foreground', className)} data-network={network}>
      <span aria-hidden className={cn('size-2 rounded-full', DOT[network])} />
      {NETWORK_LABEL[network]}
    </span>
  )
}
