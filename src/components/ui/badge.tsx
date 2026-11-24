import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * Selos (base shadcn/ui).
 * - `rare`: "RARO" do Figma: retângulo laranja, texto escuro, caixa alta.
 * - `chip`: pílula com contorno (chips de edição e nota "4.8 (19)").
 * - `count`: contador do carrinho no header.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap font-mono font-semibold [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        rare: 'rounded-xs bg-primary px-2.5 py-1 text-overline uppercase text-primary-foreground',
        chip: 'rounded-full border border-input px-3 py-1 text-caption text-muted-foreground',
        count: 'min-w-4 rounded-full bg-primary px-1 text-[0.625rem] leading-4 text-primary-foreground',
        neutral: 'rounded-xs bg-surface-2 px-2 py-0.5 text-caption text-muted-foreground',
        success: 'rounded-xs bg-success-surface px-2 py-0.5 text-caption text-success',
        danger: 'rounded-xs bg-destructive-surface px-2 py-0.5 text-caption text-destructive',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

function Badge({
  className,
  variant = 'neutral',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'
  return <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
