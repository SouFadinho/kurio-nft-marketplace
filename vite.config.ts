import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

/**
 * CP8 (performance, medido no Lighthouse): o `main.tsx` importa dinamicamente a camada de mocks e
 * o App. Sem dica no HTML, o navegador só descobre esses chunks DEPOIS de baixar e avaliar o
 * chunk principal (mais uma volta de rede no caminho crítico). Este plugin adiciona
 * `<link rel="modulepreload">` no HTML do build para eles e seus imports estáticos, para que
 * baixem em paralelo. Só antecipa o download: a ordem de avaliação continua a do main.tsx.
 */
function preloadEntryChunks(entries: string[]): Plugin {
  return {
    name: 'kurio:preload-entry-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return
        const chunks = Object.values(ctx.bundle).filter((c) => c.type === 'chunk')
        const files = new Set<string>()
        const add = (fileName: string) => {
          if (files.has(fileName)) return
          files.add(fileName)
          const chunk = chunks.find((c) => c.fileName === fileName)
          if (chunk && chunk.type === 'chunk') chunk.imports.forEach(add)
        }
        for (const chunk of chunks) {
          if (chunk.type === 'chunk' && chunk.facadeModuleId && entries.some((e) => chunk.facadeModuleId!.replaceAll('\\', '/').endsWith(e))) add(chunk.fileName)
        }
        return [...files].filter((fileName) => !html.includes(fileName)).map((fileName) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `/${fileName}` }, injectTo: 'head' as const }))
      },
    },
  }
}

/**
 * CP9.2 (medido com o Lantern do Lighthouse): pré-carregamento do chunk da ROTA ATUAL.
 *
 * Os componentes das rotas são carregados sob demanda pelo TanStack Router, que só os descobre
 * depois de baixar e executar o App: mais uma volta de rede antes do conteúdo. Um script inline
 * no HTML lê `location.pathname` e adiciona `<link rel="modulepreload">` para o chunk da tela
 * acessada (e seus imports estáticos que ainda não estão no HTML). Cada página baixa só o que
 * ela mesma vai usar; nada muda no comportamento nem na ordem de execução.
 */
function preloadRouteChunks(routes: Array<{ pattern: string; chunk: string }>): Plugin {
  return {
    name: 'kurio:preload-route-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return
        const chunks = Object.values(ctx.bundle).filter((c) => c.type === 'chunk')
        const closure = (name: string) => {
          const files: string[] = []
          const add = (fileName: string) => {
            if (files.includes(fileName) || html.includes(fileName)) return
            files.push(fileName)
            const chunk = chunks.find((c) => c.fileName === fileName)
            if (chunk && chunk.type === 'chunk') chunk.imports.forEach(add)
          }
          const root = chunks.find((c) => c.type === 'chunk' && c.name === name)
          if (!root) throw new Error(`preloadRouteChunks: chunk "${name}" não encontrado`)
          add(root.fileName)
          return files.map((f) => `/${f}`)
        }
        const table = routes.map((r) => [r.pattern, closure(r.chunk)])
        const code = `(function(){var p=location.pathname,t=${JSON.stringify(table)};for(var i=0;i<t.length;i++){if(new RegExp(t[i][0]).test(p)){for(var j=0;j<t[i][1].length;j++){var l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href=t[i][1][j];document.head.appendChild(l)}break}}})()`
        return [{ tag: 'script', children: code, injectTo: 'head' as const }]
      },
    },
  }
}

// Ordem importa: o plugin do Router precisa rodar antes do plugin React
// para gerar src/routeTree.gen.ts e fazer code-splitting por rota.
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    preloadEntryChunks(['src/mocks/browser.ts', 'src/app/App.tsx']),
    preloadRouteChunks([
      { pattern: '^/(mercado/?)?$', chunk: 'catalog' },
      { pattern: '^/nft/[^/]+/?$', chunk: 'detail' },
    ]),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(import.meta.dirname, './src') },
      // CP9.2: a Public Suffix List do `tldts` (251 kB, só para o cookie jar emulado do MSW, que o
      // KURIO não usa) sai do chunk do MSW. Justificativa e limites em src/mocks/vendor/tldts-lite.ts.
      { find: /^tldts$/, replacement: path.resolve(import.meta.dirname, './src/mocks/vendor/tldts-lite.ts') },
    ],
  },
  build: {
    rolldownOptions: {
      output: {
        // CP9.2 (medido com o Lantern do Lighthouse): a divisão automática gerava ~30 chunks de
        // 0,3–3 kB no carregamento inicial. Em HTTP/1.1 (6 conexões por origem), cada um ocupa uma
        // conexão por um RTT e o chunk do MSW (necessário antes de qualquer dado) entrava na fila
        // atrás deles. Os grupos abaixo juntam SÓ as dependências da inicialização; bibliotecas
        // carregadas sob demanda (drawer, diálogos, Socket.IO, MSW) continuam separadas.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/](@tanstack|axios|zod|sonner|tailwind-merge|clsx|class-variance-authority)[\\/]/ },
            // Primitivos do Radix usados pelo Tooltip e pelo Button do App (os de diálogos e
            // drawers, carregados sob demanda, ficam de fora), floating-ui e os ícones.
            {
              name: 'ui',
              test: /node_modules[\\/](@radix-ui[\\/](primitive|react-(slot|compose-refs|primitive|presence|context|use-[a-z-]+|popper|portal|dismissable-layer|visually-hidden|arrow|id|tooltip))|@floating-ui|lucide-react)[\\/]/,
            },
            // Código compartilhado da inicialização: contratos, cliente HTTP, chaves, consultas,
            // sessão e componentes básicos (antes: ~10 chunks de 0,2–3 kB).
            {
              name: 'app',
              test: /src[\\/](api|lib)[\\/]|src[\\/]features[\\/][a-z-]+[\\/](queries|search|authSearch|sessionStore|guards|intent)\.tsx?$|src[\\/]components[\\/]kurio[\\/]basics\.tsx$|src[\\/]components[\\/]ui[\\/](button|badge|skeleton)\.tsx$/,
            },
            // Componentes de exibição compartilhados pelas telas (cards, preço, imagem, estados,
            // formulários). Antes, cada um era um chunk e as telas os descobriam em cascata.
            {
              name: 'kit',
              test: /src[\\/]components[\\/]kurio[\\/](NFTCard|NFTGrid|NetworkBadge|NftImage|Pagination|PriceDisplay|QuantitySelector|RatingStars|SearchInput|SectionHeading|form|states|pages)\.tsx$|src[\\/]components[\\/]ui[\\/](input|card|label|separator|breadcrumb)\.tsx$|src[\\/]components[\\/]layout[\\/]MobileTopBar\.tsx$/,
            },
            // Início e Mercado (inclui os módulos de componente separados pelo TanStack Router). O
            // drawer e o painel de filtros (Select/Slider do Radix) continuam sob demanda.
            {
              name: 'catalog',
              includeDependenciesRecursively: false,
              test: (id) =>
                (/src[\\/]features[\\/](home|catalog|nfts)[\\/]/.test(id) && !/(FiltersDrawer|FiltersPanel|SortSelect)\.tsx$/.test(id)) ||
                /src[\\/]routes[\\/](index|mercado)\.tsx\?tsr-split/.test(id),
            },
            // Detalhe do NFT (o diálogo de ampliação continua sob demanda).
            {
              name: 'detail',
              includeDependenciesRecursively: false,
              test: (id) => (/src[\\/]features[\\/]nft-detail[\\/]/.test(id) && !/GalleryZoom\.tsx$/.test(id)) || /src[\\/]routes[\\/]nft\.\$nftId\.tsx\?tsr-split/.test(id),
            },
          ],
        },
      },
    },
  },
  preview: { port: 4173, strictPort: true },
})
