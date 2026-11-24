/**
 * Carteira selecionável (Figma: Mobile / Pagamento: "Reserva · nova.kurio.eth · Rede Polygon").
 * Deve ser usada dentro de um <RadioGroup> (shadcn/Radix): navegação por setas, um tab-stop.
 * O cartão inteiro é o rótulo do rádio; o menu ⋮ é opcional e fica fora do rótulo.
 */
import type { ReactNode } from 'react'
import { useId } from 'react'
import { RadioGroupItem } from '@/components/ui/radio-group'
import type { Network } from '@/api/contracts'
import { cn } from '@/lib/utils'
import { NETWORK_LABEL } from './NetworkBadge'

export function shortenAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

export function WalletCard({
  value,
  name,
  address,
  ens,
  network,
  menu,
  disabled,
  className,
}: {
  value: string
  name: string
  address: string
  ens?: string
  network: Network
  /** Ações da carteira (ex.: DropdownMenu com "Editar"). */
  menu?: ReactNode
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-lg border border-transparent bg-surface p-4 transition-colors',
        'has-[[data-state=checked]]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
        disabled && 'opacity-50',
        className,
      )}
      data-testid="wallet-card"
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} className="mt-0.5" />
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="text-title-3 text-foreground">{name}</span>
        <span className="truncate text-caption text-muted-foreground" title={address}>
          {ens ?? shortenAddress(address)}
        </span>
        <span className="text-caption text-muted-foreground">Rede {NETWORK_LABEL[network]}</span>
      </label>
      {menu}
    </div>
  )
}
