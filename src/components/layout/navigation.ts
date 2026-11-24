/**
 * Itens de navegação compartilhados por header, bottom nav, rodapé e conta.
 * `unavailable: true` = fora do escopo da entrega (CHALLENGE §3): renderizado com
 * UnavailableAction, sem aparentar funcionar.
 */
export const PRIMARY_NAV = [
  { label: 'Início', to: '/' },
  { label: 'Mercado', to: '/mercado' },
  { label: 'Criadores', to: '/criadores' },
  { label: 'Aprenda', to: '/aprenda' },
] as const

export type FooterLink = { label: string; to?: '/perfil' | '/favoritos' | '/mercado'; unavailable?: true }

export const FOOTER_COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Meu perfil',
    links: [
      { label: 'Meu perfil', to: '/perfil' },
      { label: 'Minha coleção', unavailable: true },
      { label: 'Atividade', unavailable: true },
      { label: 'Estúdio do criador', unavailable: true },
      { label: 'Lista de interesse', to: '/favoritos' },
    ],
  },
  {
    title: 'Central de ajuda',
    links: [
      { label: 'Central de ajuda', unavailable: true },
      { label: 'Como comprar NFTs', unavailable: true },
      { label: 'Carteira e segurança', unavailable: true },
      { label: 'Política do mercado', unavailable: true },
      { label: 'Denunciar item', unavailable: true },
    ],
  },
  {
    title: 'Coleções',
    links: [
      { label: 'Arte digital', to: '/mercado' },
      { label: 'Fotografia', to: '/mercado' },
      { label: 'Música', to: '/mercado' },
      { label: 'Arte 3D', to: '/mercado' },
      { label: 'Utilidade', to: '/mercado' },
    ],
  },
]

export const BENEFITS = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
] as const

export const ACCOUNT_NAV = [
  { key: 'profile', label: 'Dados do perfil', to: '/perfil', icon: 'user' },
  { key: 'wallets', label: 'Carteiras', to: '/perfil/carteiras', icon: 'wallet' },
  { key: 'activity', label: 'Atividade', unavailable: true, icon: 'activity' },
  { key: 'wishlist', label: 'Lista de interesse', to: '/favoritos', icon: 'heart' },
  { key: 'offers', label: 'Ofertas', unavailable: true, icon: 'tag' },
  { key: 'downloads', label: 'Arquivos baixados', unavailable: true, icon: 'download' },
  { key: 'support', label: 'Suporte', unavailable: true, icon: 'support' },
] as const

export type AccountNavKey = (typeof ACCOUNT_NAV)[number]['key']
