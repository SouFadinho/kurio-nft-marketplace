/**
 * Seções editoriais da página inicial (Figma Desktop / Início):
 * - Banners promocionais: dois cards lado a lado (arte à esquerda, texto e botão laranja
 *   à direita). Os botões levam a filtros REAIS do catálogo.
 * - "Diário da Cunhagem": título centralizado e 4 cards (arte, data, tempo de leitura,
 *   título, resumo, "Ler mais"). Artigos editoriais estão fora do escopo da entrega:
 *   "Ler mais" informa a indisponibilidade em vez de simular uma página.
 * No mobile (sem frame no Figma), as mesmas seções são empilhadas.
 */
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UnavailableAction } from '@/components/kurio/basics'
import { NftImage } from '@/components/kurio/NftImage'
import { SectionHeading } from '@/components/kurio/SectionHeading'
import { DIARY, PROMO_BANNERS } from '@/content/home'

export function PromoBanners() {
  return (
    <section aria-label="Destaques do mercado" className="grid gap-4 md:grid-cols-2 lg:gap-6">
      {PROMO_BANNERS.map((b) => (
        <article key={b.id} className="grid grid-cols-[minmax(0,40%)_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-sm bg-surface p-3 lg:gap-6">
          <div className="aspect-square overflow-hidden rounded-lg bg-surface-2">
            <NftImage src={b.image} alt={b.imageAlt} />
          </div>
          <div className="flex flex-col items-start gap-2 pr-2">
            <h2 className="text-title-3 font-bold">{b.title}</h2>
            <p className="text-caption text-muted-foreground">{b.text}</p>
            <Button asChild size="sm" className="mt-1">
              <Link to="/mercado" search={b.search}>
                {b.cta} <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

export function MintDiary() {
  return (
    <section aria-labelledby="diary-title" className="flex flex-col gap-8">
      <SectionHeading id="diary-title" variant="center" title={DIARY.title} description={DIARY.description} />
      <ul className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
        {DIARY.posts.map((p) => (
          <li key={p.id}>
            <article className="flex h-full flex-col overflow-hidden rounded-sm bg-surface">
              <div className="aspect-[4/3] overflow-hidden bg-surface-2">
                <NftImage src={p.image} alt={p.imageAlt} />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-overline text-muted-foreground">
                  <time>{p.date}</time> <span aria-hidden>|</span> {p.read}
                </p>
                <h3 className="text-title-3 font-bold">{p.title}</h3>
                <p className="flex-1 text-caption text-muted-foreground">{p.excerpt}</p>
                <UnavailableAction label={`Ler mais: ${p.title}`} className="inline-flex min-h-9 items-center gap-1.5 text-caption font-semibold text-price">
                  Ler mais <ArrowRight className="size-3.5" aria-hidden />
                </UnavailableAction>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
