import { Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Seletor de quantidade (Figma: "− 1 +", botões circulares escuros).
 * - Quantidades sempre inteiras, limitadas a [min, max] (o max vem da disponibilidade da API).
 * - Botões com nome acessível; o limite desabilita o botão (não só a cor).
 * - O valor é anunciado (`aria-live`). A área de toque é ampliada para 44px no mobile.
 */
export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max,
  label = 'Quantidade',
  itemName,
  disabled = false,
  className,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max: number
  label?: string
  /** Nome do item, para rótulos como "Aumentar quantidade de Emerald Ape #042". */
  itemName?: string
  disabled?: boolean
  className?: string
}) {
  const valueId = useId()
  const suffix = itemName ? ` de ${itemName}` : ''
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.trunc(next))))
  const button =
    "relative grid size-8 place-items-center rounded-full bg-surface-2 text-foreground transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40 after:absolute after:-inset-1.5 after:content-[''] lg:after:inset-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

  return (
    <div role="group" aria-label={`${label}${suffix}`} className={cn('inline-flex items-center gap-3', className)}>
      <button type="button" className={button} aria-label={`Diminuir quantidade${suffix}`} disabled={disabled || value <= min} onClick={() => set(value - 1)}>
        <Minus className="size-4" aria-hidden />
      </button>
      <output id={valueId} aria-live="polite" className="min-w-6 text-center font-mono text-body font-semibold tabular-nums">
        {value}
      </output>
      <button type="button" className={button} aria-label={`Aumentar quantidade${suffix}`} disabled={disabled || value >= max} onClick={() => set(value + 1)}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}
