/**
 * Peças básicas do design system: Logo, Container e UnavailableAction.
 */
import type { ComponentProps, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/** Logotipo textual (Figma: "KURIO" em caixa alta, monoespaçado, espaçado). */
export function Logo({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <Link
      to="/"
      aria-label="KURIO — página inicial"
      className={cn(
        'inline-flex items-center font-bold tracking-[0.18em] text-foreground',
        size === 'md' ? 'text-body' : 'text-[1.75rem] tracking-[0.12em]',
        className,
      )}
    >
      KURIO
    </Link>
  )
}

/** Largura útil do site: 1200px (medida no frame de 1440) com respiro lateral. */
export function Container({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-(--container-site) px-4 md:px-6', className)} {...props} />
}

export const UNAVAILABLE_MESSAGE = 'Indisponível na demonstração'

/**
 * Ação ou link fora do escopo da entrega (páginas editoriais, suporte, ofertas, redes sociais…).
 * O enunciado exige comportamento coerente SEM aparentar sucesso. Por isso, o controle é
 * focável, anuncia que está indisponível e mostra um toast informativo, nunca de sucesso.
 */
export function UnavailableAction({
  children,
  label,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'onClick'> & { label: string; children?: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={`${label} (${UNAVAILABLE_MESSAGE.toLowerCase()})`}
      data-unavailable="true"
      className={cn('cursor-pointer text-left outline-none focus-visible:outline-2 focus-visible:outline-ring', className)}
      onClick={() => toast.info(UNAVAILABLE_MESSAGE, { description: `“${label}” não faz parte desta demonstração.` })}
      {...props}
    >
      {children ?? label}
    </button>
  )
}
