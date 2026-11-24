/**
 * Campo de busca (Figma mobile: "Explorar coleções" em barra preenchida, lupa caramelo).
 * - `filled`: fundo de superfície (mobile). `outline`: borda (desktop).
 * - Rótulo acessível obrigatório (o placeholder não substitui o label).
 * - Botão de limpar quando há texto.
 */
import { Search, X } from 'lucide-react'
import { forwardRef, useId, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const SearchInput = forwardRef<
  HTMLInputElement,
  Omit<ComponentProps<'input'>, 'type'> & { label: string; variant?: 'filled' | 'outline'; onClear?: () => void }
>(function SearchInput({ label, variant = 'filled', onClear, className, value, id: idProp, ...props }, ref) {
  const autoId = useId()
  const id = idProp ?? autoId
  const hasValue = typeof value === 'string' ? value.length > 0 : false
  return (
    <div className={cn('relative flex items-center', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute left-4 size-5 text-placeholder" aria-hidden />
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        className={cn(
          'h-12 w-full rounded-lg pr-11 pl-12 font-mono text-body text-foreground outline-none [&::-webkit-search-cancel-button]:hidden',
          'transition-[border-color,box-shadow] focus-visible:shadow-[0_0_0_2px_var(--color-ring)]',
          variant === 'filled' ? 'bg-surface' : 'border border-input bg-transparent focus-visible:border-primary lg:h-10 lg:rounded-xs',
        )}
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={onClear}
          className="absolute right-2 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
})
