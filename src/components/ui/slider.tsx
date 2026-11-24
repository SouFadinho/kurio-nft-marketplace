import * as React from 'react'
import { Slider as SliderPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * Slider (base shadcn/ui, Radix). Figma ("Faixa de preço"): trilho fino escuro, faixa laranja
 * e polegares laranja. `thumbLabels` dá nome acessível a cada polegar (o original do shadcn não
 * dá; o axe acusaria). A área de toque do polegar é ampliada por pseudo-elemento.
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn('relative flex h-6 w-full touch-none items-center select-none data-[disabled]:opacity-50', className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-1 grow overflow-hidden rounded-full bg-surface-3">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={thumbLabels?.[index]}
          className={cn(
            'relative block size-4 shrink-0 rounded-full border-2 border-background bg-primary shadow-raised',
            'transition-transform duration-[var(--duration-fast)] hover:scale-110',
            'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            "after:absolute after:-inset-3 after:content-['']",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
