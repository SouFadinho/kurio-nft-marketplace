/** Avaliação em estrelas (Figma: "★★★★★ 19 avaliações de colecionadores"). Texto alternativo completo. */
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RatingStars({ rating, count, className, compact = false }: { rating: number; count: number; className?: string; compact?: boolean }) {
  const label = `Avaliação ${rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} de 5, ${count} avaliações de colecionadores`
  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full border border-primary px-2.5 py-1 text-caption font-semibold', className)} aria-label={label} role="img">
        <Star className="size-3.5 text-price" fill="currentColor" aria-hidden />
        {rating.toFixed(1)}
        <span className="text-muted-foreground">({count})</span>
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-2 text-caption', className)} role="img" aria-label={label}>
      <span className="flex" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn('size-3.5', i < Math.round(rating) ? 'text-price' : 'text-surface-3')} fill="currentColor" />
        ))}
      </span>
      <span aria-hidden className="text-muted-foreground">
        {count} avaliações de colecionadores
      </span>
    </span>
  )
}
