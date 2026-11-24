import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * Botão do KURIO (base shadcn/ui, personalizado conforme o Figma).
 * - `default`: laranja sólido, cantos de 4px (CTAs desktop: "Comprar", "Aplicar", "Entrar").
 * - `gradient`: pílula com gradiente medido #D28A4C → #B77743 (CTAs mobile: "Comprar NFT").
 * - `outline`: contorno e texto laranja ("Favoritar").
 * - `secondary`: superfície elevada; `ghost`: sem fundo; `icon-round`: círculo de superfície ("voltar").
 * Tamanhos `lg` e `icon-lg` garantem área de toque ≥ 44px no mobile.
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-mono font-semibold select-none',
    'transition-[background-color,color,border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-standard)]',
    'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'rounded-xs bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        gradient: 'rounded-full bg-primary-gradient text-primary-foreground shadow-raised hover:brightness-110 active:brightness-95',
        outline: 'rounded-xs border border-primary bg-transparent text-price hover:bg-primary/10 active:bg-primary/20',
        secondary: 'rounded-xs bg-surface-2 text-foreground hover:bg-surface-3 active:bg-surface-3/80',
        ghost: 'rounded-xs text-foreground hover:bg-surface-2 active:bg-surface-3',
        'icon-round': 'rounded-full bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground',
        link: 'h-auto rounded-xs p-0 text-price underline-offset-4 hover:underline',
        destructive: 'rounded-xs bg-destructive-surface text-destructive hover:bg-destructive-surface/70',
      },
      size: {
        sm: 'h-8 px-3 text-caption',
        md: 'h-10 px-4 text-body',
        lg: 'h-12 px-6 text-body',
        icon: 'size-10',
        'icon-sm': 'size-8',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'md',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
