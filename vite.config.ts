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

// Ordem importa: o plugin do Router precisa rodar antes do plugin React
// para gerar src/routeTree.gen.ts e fazer code-splitting por rota.
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    preloadEntryChunks(['src/mocks/browser.ts', 'src/app/App.tsx']),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  preview: { port: 4173, strictPort: true },
})
