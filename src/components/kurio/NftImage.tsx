/**
 * Imagem de NFT com espaço reservado e FALLBACK quando o arquivo não carrega.
 * - width/height + o contêiner do chamador (aspect-square) evitam deslocamento de layout.
 * - Falha de carregamento: troca por um painel "Imagem indisponível" do mesmo tamanho,
 *   anunciado com o texto alternativo (o conteúdo continua compreensível).
 * - `priority`: primeira dobra/LCP (eager + fetchpriority alta); demais em lazy loading.
 */
import { ImageOff } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function NftImage({
  src,
  alt,
  priority = false,
  size = 512,
  className,
}: {
  src: string
  alt: string
  priority?: boolean
  size?: number
  className?: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (failedSrc === src) {
    return (
      <div role="img" aria-label={`${alt} (imagem indisponível)`} className={cn('flex size-full flex-col items-center justify-center gap-2 bg-surface-2 text-muted-foreground', className)} data-testid="image-fallback">
        <ImageOff className="size-6" aria-hidden />
        <span className="text-caption" aria-hidden>
          Imagem indisponível
        </span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
      onError={() => setFailedSrc(src)}
      className={cn('size-full object-cover', className)}
    />
  )
}
