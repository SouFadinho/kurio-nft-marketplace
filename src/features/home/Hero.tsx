/**
 * Hero principal com destaques (Figma Desktop e Mobile / Início).
 *
 * DESKTOP: texto à esquerda ("Bem-vindo à Kurio", título em caixa alta em duas linhas,
 * parágrafo, botão "EXPLORAR"); arte grande, de cantos arredondados, à direita; indicadores
 * "• • •" centralizados abaixo.
 * MOBILE: card com degradê marrom e círculos decorativos (como no Figma), texto à esquerda,
 * arte à direita com uma segunda arte sobreposta, "EXPLORAR →" e indicadores.
 *
 * Os destaques vêm da API (/api/highlights). Os indicadores trocam o destaque exibido (sem
 * rotação automática: nada se move sozinho na tela, o que favorece a acessibilidade).
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NftImage } from '@/components/kurio/NftImage'
import { HERO } from '@/content/home'
import { highlightsQuery } from '@/features/nfts/queries'
import { cn } from '@/lib/utils'

function Dots({ count, current, onSelect, className }: { count: number; current: number; onSelect: (i: number) => void; className?: string }) {
  if (count <= 1) return null
  return (
    <div role="group" aria-label="Destaques" className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Mostrar destaque ${i + 1} de ${count}`}
          aria-current={i === current ? 'true' : undefined}
          onClick={() => onSelect(i)}
          className="group grid size-6 place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className={cn('block size-2 rounded-full bg-primary transition-opacity', i === current ? 'opacity-100' : 'opacity-50 group-hover:opacity-80')} />
        </button>
      ))}
    </div>
  )
}

export function Hero() {
  const { data } = useQuery(highlightsQuery())
  const [index, setIndex] = useState(0)
  const slides = data?.hero ?? []
  const current = slides[index] ?? slides[0]
  const secondary = slides[(index + 1) % Math.max(1, slides.length)]

  return (
    <section aria-labelledby="hero-title" aria-roledescription="carrossel" data-testid="hero">
      {/* ---------- Desktop ---------- */}
      <div className="relative hidden grid-cols-[minmax(0,1fr)_minmax(0,440px)] items-center gap-12 pt-10 pb-12 lg:grid">
        <div className="flex max-w-xl flex-col gap-5">
          <p className="text-caption text-foreground">{HERO.eyebrow}</p>
          <h1 id="hero-title" className="text-display uppercase">
            {HERO.desktop.titleLines.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </h1>
          <p className="max-w-lg text-caption leading-relaxed text-muted-foreground">{HERO.desktop.text}</p>
          <Button asChild size="sm" className="w-fit px-6 uppercase">
            <Link to="/mercado">{HERO.cta}</Link>
          </Button>
        </div>
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-surface-2">
          {current ? (
            <Link to="/nft/$nftId" params={{ nftId: current.id }} aria-label={`Ver ${current.name}`} className="block size-full focus-visible:outline-2 focus-visible:outline-ring">
              <NftImage src={current.image} alt={current.imageAlt} priority />
            </Link>
          ) : (
            <div className="skeleton size-full" aria-hidden />
          )}
        </div>
        <Dots count={slides.length} current={index} onSelect={setIndex} className="absolute bottom-2 left-1/2 -translate-x-1/2" />
      </div>

      {/* ---------- Mobile / tablet ---------- */}
      <div
        className="relative overflow-hidden rounded-2xl px-4 pt-3 pb-6 lg:hidden"
        style={{ background: 'radial-gradient(120% 140% at 15% 20%, #6b4529 0%, #4a2f1e 45%, #2f1e15 100%)' }}
      >
        {/* Círculos decorativos do Figma (puramente visuais). */}
        <span aria-hidden className="pointer-events-none absolute -top-16 left-1/3 size-72 rounded-full border border-white/5 bg-white/[0.03]" />
        <span aria-hidden className="pointer-events-none absolute top-10 -left-20 size-64 rounded-full bg-white/[0.03]" />
        {/* CP8 (VIS-01): ~235 → ~180 px no mobile, como no Figma (menos respiro, arte quadrada). */}
        <div className="relative grid grid-cols-[minmax(0,1fr)_34%] items-center gap-3 md:grid-cols-[minmax(0,1fr)_26%]">
          <div className="flex flex-col gap-1">
            <p className="text-caption text-foreground">{HERO.eyebrow}</p>
            <p className="text-display-sm text-foreground uppercase" aria-hidden>
              {HERO.mobile.titleLines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </p>
            <h1 className="sr-only">{HERO.mobile.titleLines.join(' ')}</h1>
            <p className="text-caption text-muted-foreground">{HERO.mobile.text}</p>
            <Link to="/mercado" className="inline-flex min-h-8 w-fit items-center gap-2 text-caption font-bold text-price uppercase outline-none focus-visible:outline-2 focus-visible:outline-ring">
              {HERO.cta} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="relative aspect-square w-full">
            <div className="absolute inset-0 overflow-hidden rounded-xl bg-surface-2">
              {current ? <NftImage src={current.image} alt={current.imageAlt} priority /> : <div className="skeleton size-full" aria-hidden />}
            </div>
            {secondary && secondary.id !== current?.id && (
              <div className="absolute -bottom-3 -left-4 w-1/2 overflow-hidden rounded-lg border-2 border-[#4a2f1e] bg-surface-2 aspect-square">
                <NftImage src={secondary.image} alt="" />
              </div>
            )}
          </div>
        </div>
        <Dots count={slides.length} current={index} onSelect={setIndex} className="absolute bottom-2 left-1/2 -translate-x-1/2" />
      </div>
    </section>
  )
}
