/**
 * Ícones de redes sociais do rodapé. O lucide-react 1.x removeu os ícones de marca;
 * estes são desenhos geométricos simples (não são os logotipos oficiais), traço de 1.75px,
 * para combinar com o estilo de linha do restante da interface. Decorativos (aria-hidden):
 * o nome acessível fica no controle que os contém.
 */
import type { SVGProps } from 'react'

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const FacebookIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M15 4h-2a4 4 0 0 0-4 4v3H7v3h2v6h3v-6h2.5l.5-3h-3V8.5a1 1 0 0 1 1-1h2z" />
  </svg>
)

export const InstagramIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.25" cy="6.75" r="0.6" fill="currentColor" />
  </svg>
)

export const XSocialIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 4l16 16M20 4L4 20" />
  </svg>
)

export const LinkedinIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    <path d="M8 10.5V16M8 7.75v.01M11.5 16v-5.5M11.5 13a2.5 2.5 0 0 1 5 0v3" />
  </svg>
)

export const YoutubeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
    <path d="M10.5 9.5v5l4.5-2.5z" fill="currentColor" />
  </svg>
)
