# IMPLEMENTATION_PLAN — KURIO (48 h)

Ordem guiada por risco: as integrações mais incertas (MSW + Socket.IO, MSW em produção, Playwright contra o build) são validadas **nas primeiras horas**, antes de investir em telas.
Cada checkpoint termina com uma parada para aprovação. Orçamento total ≈ 44 h + 4 h de margem.

| CP | Nome | Horas (est.) | Depende de |
|---|---|---|---|
| CP0 | Análise e planejamento | 2 | — |
| CP1 | Fundação técnica + spikes | 5 | CP0 aprovado |
| CP2 | Design system e assets | 5 | CP1 |
| CP3 | Catálogo e detalhes | 6 | CP1, CP2 |
| CP4 | Autenticação e conta | 5 | CP1, CP2 |
| CP5 | Carrinho e checkout | 7 | CP3, CP4 |
| CP6 | Pedidos e tempo real | 5 | CP1 (spike WS), CP5 |
| CP7 | Testes automatizados | 4 (+ testes contínuos em cada CP) | CP3–CP6 |
| CP8 | Performance e acessibilidade | 3 | CP7 |
| CP9 | Auditoria final e deploy | 2 | CP8 + autorização de deploy |

---

## Ajustes do CP0.1 (prevalecem sobre o restante)
- **Fonte oficial:** `CHALLENGE.md`. Metas de Lighthouse: Perf ≥ 90, A11y ≥ 95, BP ≥ 95, SEO ≥ 90. Elas substituem a "meta interna" do CP8.
- **CP1** passa a ser uma prova de conceito com 12 itens obrigatórios: Axios + MSW; Query (query e mutation); socket.io-client real; `nft.updated`; `order.updated`; auth e isolamento no socket; desconexão e reconexão; reconciliação REST; descarte de antigos e duplicados; build de produção; acesso direto e refresh; Playwright. O binding tem investigação limitada a **60 min**. Scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test:e2e`, `audit:lighthouse`. Sem telas definitivas. Git local e commit; sem remoto.
- **CP3** inclui skeletons com shimmer (catálogo, detalhe) e páginas fora do escopo coerentes (Criadores, Aprenda), sem simular função.
- **CP4** inclui avatar, expiração de sessão (navegação e checkout) e troca de usuário; perfil e carteiras mobile derivados.
- **CP5** usa o recurso **cotação**; carteira com conexão, recusa e desconexão simuladas; etapa de revisão; skeleton do resumo.
- **CP6** cobre a tela de Confirmação (procurar a referência no Figma; mobile derivado), o recibo como snapshot e a remoção parcial do carrinho após a confirmação.
- **CP7** cobre os **12 grupos E2E** (E2E-01..12, ver matriz), a regressão visual das **4 telas** (Início, Detalhe, Carrinho, Pagamento) × desktop e mobile com baselines versionadas, e verificações nas larguras 390, 768 e 1440 (overflow horizontal).
- **CP8** faz **12 medições Lighthouse** (2 páginas × 2 perfis × 3 execuções), com mediana, LCP, CLS e TBT, relatórios HTML/JSON e análise abaixo da meta.
- **CP9** entrega `README.md` e `ARCHITECTURE.md` na raiz; deploy na Vercel **somente com autorização**; repositório remoto somente com autorização.

## CP0 — Análise e planejamento ✅ (este documento)
- **Entregáveis:** os 6 documentos em `planning/`.
- **Aceite:** aprovação do candidato; lista de pendências registrada.
- **Riscos:** o enunciado oficial está ausente (R-01).

## CP1 — Fundação técnica
- **Dependências:** CP0 aprovado. Idealmente com o README oficial disponível (se não estiver, seguir com as hipóteses documentadas).
- **Entregáveis:**
  1. Projeto Vite + React + TS (strict) + ESLint/Prettier; aliases.
  2. Tailwind v4 + `shadcn init` com tokens provisórios.
  3. TanStack Router (file-based) com rotas vazias; TanStack Query provider; Axios com interceptors e `ApiError`.
  4. MSW 2.x fixado: worker, `db` com seed determinístico e persistência, `scenarios.ts`.
  5. **Spike Socket.IO** (timebox de 2 h): `socket.io-client` (`transports: ['websocket']`) ↔ `ws.link` + `toSocketIo`. Validar: handshake, emit/on nos dois sentidos, auth no CONNECT, desconexão forçada e reconexão, funcionamento em `vite preview`. Se falhar → adaptador próprio (TECHNICAL_ARCHITECTURE §3.3).
  6. **Spike Playwright:** 1 teste smoke rodando contra `vite build && vite preview` com MSW ativo.
  7. `lib/eth.ts` com testes unitários.
- **Aceite:** `npm run typecheck`, `lint`, `build` e `test:e2e` (smoke) passam; o relatório do spike WS documenta o que funciona e o que não funciona, com o log.
- **Testes:** unitários de `eth.ts`; smoke E2E; teste E2E do spike recebendo um evento Socket.IO mockado.
- **Riscos:** R-02 (binding), R-03 (versões novas: Vite 8, TS), R-05 (MSW em produção).

## CP2 — Design system e assets
- **Dependências:** CP1.
- **Entregáveis:** tokens em `@theme` (paleta medida em VISUAL_ANALYSIS §3); fonte mono self-hosted; tema shadcn (Button com variantes solid e gradiente pílula, Input, Select, Tabs, Dialog, Sheet, Card, Badge, RadioGroup, Slider, Pagination, Breadcrumb, Carousel, Toast/Sonner); componentes de layout (Header, BottomNav, Footer); `NftCard`, `PriceTag`, `QuantityStepper`, `RatingStars`, `EditionChips`; assets otimizados (AVIF/WebP + srcset); página `/_dev/ui` (somente em dev) para revisão.
- **Aceite:** comparação lado a lado com os recortes das referências; contraste AA nos pares de texto; nenhum componente usa cor fora dos tokens.
- **Testes:** snapshot visual da página de componentes; axe.
- **Riscos:** R-06 (fonte não confirmada), R-07 (assets em baixa resolução).

## CP3 — Catálogo e detalhes
- **Dependências:** CP1, CP2.
- **Entregáveis:** Home desktop e mobile (hero/carrossel, abas, filtros com search params tipados, ordenação, paginação, masonry mobile, sheet de filtros mobile, banners, Diário da Cunhagem, rodapé); Detalhe desktop e mobile (galeria, edição, quantidade, favoritar otimista, abas, "Mais desta coleção", CTA fixo mobile); estados de loading, vazio e erro.
- **Aceite:** filtros refletidos na URL e restaurados ao recarregar; favoritar faz rollback em falha forçada; telas fiéis nas duas larguras.
- **Testes:** E2E de navegação, filtros, paginação e detalhe; baselines visuais das telas UI-01 a UI-04.
- **Riscos:** R-08 (telas sem referência: Mercado, Criadores, Aprenda).

## CP4 — Autenticação e conta
- **Dependências:** CP1, CP2.
- **Entregáveis:** `/login` e `/cadastro` (Dialog com abas no desktop; página inteira no mobile); validações zod; sessão (memória + sessionStorage); guards; logout com limpeza e BroadcastChannel; perfil (dados + senha); carteiras (CRUD); botões sociais com aviso honesto.
- **Aceite:** usuário B não vê dados de A; rota protegida redireciona e volta; o 401 da API derruba a sessão.
- **Testes:** E2E de cadastro, login (sucesso/401), logout em duas abas, isolamento com dois contextos de browser e rotas protegidas; baselines UI-05 a UI-10.
- **Riscos:** R-09 (armazenamento de token num app sem backend), R-10 (login social).

## CP5 — Carrinho e checkout
- **Dependências:** CP3, CP4.
- **Entregáveis:** carrinho desktop (tabela) e mobile (lista + painel); mutations otimistas com `scope` e `If-Match`; persistência e merge; cupom; totais em bigint; pagamento desktop (formulário + resumo) e mobile (carteira/provedor); `POST /orders` com Idempotency-Key persistida; tratamento de `PRICE_CHANGED`, `OUT_OF_STOCK`, 500 e timeout.
- **Aceite:** um retry após falha cria exatamente 1 pedido; os totais batem com o cálculo de referência dos testes; reload no meio do checkout mantém a chave.
- **Testes:** E2E de todos os cenários acima; unitários de totais; baselines UI-11 a UI-14.
- **Riscos:** R-04 (precisão), R-11 (idempotência entre abas), R-12 (inconsistências do mockup).

## CP6 — Pedidos e tempo real
- **Dependências:** CP1 (spike aprovado), CP5.
- **Entregáveis:** `realtime/socket.ts` (singleton ligado à sessão); `eventProcessor` puro; `orderLifecycle` no mock (pending → confirming → minted → completed/failed, delays configuráveis); tela `/pedidos/$orderId` e lista em `/perfil/atividade` (derivadas, sem referência); indicador de conexão; fallback de polling quando desconectado; reconciliação no `connect` e no `visibilitychange`.
- **Aceite:** o status nunca regride; duplicados são ignorados; uma lacuna dispara refetch; depois de uma queda forçada, o estado final bate com o REST.
- **Testes:** unitários do processador (tabela de casos); E2E `ws-duplicate-events`, `ws-out-of-order`, `ws-gap` e `ws-disconnect-mid-order`.
- **Riscos:** R-02, R-13 (múltiplas abas e eventos).

## CP7 — Testes automatizados (consolidação)
- **Dependências:** CP3 a CP6 (testes já escritos incrementalmente).
- **Entregáveis:** suíte organizada por fluxo; fixtures (`loginAs`, `withScenario`, `seed`); projetos desktop e mobile; baselines visuais gerados em container Linux; scripts `test:e2e`, `test:visual`, `test:unit`; CI opcional (GitHub Actions) **somente se** o candidato autorizar a criação de repositório remoto.
- **Aceite:** suíte verde 3 vezes seguidas (sem flakiness); relatório HTML salvo; nenhum `test.skip` sem justificativa escrita.
- **Riscos:** R-14 (diferenças de renderização entre SOs), R-15 (flakiness por tempo).

## CP8 — Performance e acessibilidade
- **Dependências:** CP7.
- **Entregáveis:** code-splitting por rota; MSW em `import()` dinâmico; preload de fonte; imagens com dimensões fixas, `loading="lazy"` e `fetchpriority` no LCP; auditoria axe; navegação por teclado (Dialog, Sheet, Carousel, Stepper); `prefers-reduced-motion`; `lighthouserc.cjs` com assertions; relatórios mobile e desktop.
- **Aceite:** metas de Lighthouse definidas pelo enunciado (se existirem). Na ausência delas, meta interna ≥ 90 em Performance, Accessibility, Best Practices e SEO, registrada como meta interna. Os resultados reais são registrados como medidos, mesmo que abaixo da meta, com análise.
- **Riscos:** R-05 (custo do MSW no carregamento), R-16 (contraste do laranja sobre o marrom).

## CP9 — Auditoria final e deploy
- **Dependências:** CP8 e **autorização explícita** para o deploy.
- **Entregáveis:** revisão da matriz (cada linha com evidência real); README do projeto (setup, scripts, arquitetura, cenários, decisões, limitações); busca por segredos; deploy estático com fallback de SPA; smoke E2E contra a URL pública; Lighthouse na URL pública.
- **Aceite:** todos os itens P e V estão `VALIDADO` ou têm justificativa escrita; a URL pública funciona em uma janela anônima.
- **Riscos:** R-17 (host/scope do service worker), R-01.

## Estratégia de testes contínua
Cada CP entrega seus próprios testes. O CP7 consolida, não começa do zero. Nenhum resultado é reportado sem a saída real do comando.
