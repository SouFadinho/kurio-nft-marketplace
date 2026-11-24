/**
 * Seleção de edição (Figma: chips "1/10 · 1/1 · 1/50 · ABERTA", a selecionada com contorno
 * laranja). Grupo de rádio (Radix): setas navegam, uma edição por vez.
 * Edição esgotada fica desabilitada, riscada e anunciada como "esgotada" (não só por cor).
 */
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import type { Edition } from '@/api/contracts'
import { cn } from '@/lib/utils'

export function EditionPicker({ editions, value, onChange, labelId }: { editions: Edition[]; value: string | undefined; onChange: (id: string) => void; labelId: string }) {
  return (
    <RadioGroupPrimitive.Root aria-labelledby={labelId} value={value} onValueChange={onChange} className="flex flex-wrap gap-2" orientation="horizontal">
      {editions.map((e) => {
        const soldOut = e.available === 0
        return (
          <RadioGroupPrimitive.Item
            key={e.id}
            value={e.id}
            disabled={soldOut}
            aria-label={`Edição ${e.label}${soldOut ? ', esgotada' : `, ${e.available} disponíveis`}`}
            className={cn(
              'min-h-9 min-w-14 rounded-full border px-3.5 text-caption font-semibold uppercase transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:min-h-8',
              'data-[state=checked]:border-primary data-[state=checked]:text-price data-[state=unchecked]:border-border-strong data-[state=unchecked]:text-muted-foreground',
              'hover:enabled:border-muted-foreground disabled:cursor-not-allowed disabled:line-through disabled:opacity-45',
            )}
          >
            {e.label}
          </RadioGroupPrimitive.Item>
        )
      })}
    </RadioGroupPrimitive.Root>
  )
}

/** Edição padrão: a limitada com mais unidades disponíveis; senão a aberta; senão a primeira. */
export function defaultEdition(editions: Edition[]): string | undefined {
  const limited = editions.filter((e) => e.supply !== null && e.available > 0).sort((a, b) => b.available - a.available)
  return limited[0]?.id ?? editions.find((e) => e.available > 0)?.id ?? editions[0]?.id
}
