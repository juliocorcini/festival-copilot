# FestPilot — Dev Log (execution state)

> The single live execution-memory file. Update it **every milestone**. On context loss, re-read this first,
> then the current gate in `brain/documents/2026-06-27-review-polish-orchestrator.md` (ACTIVE leva) and its §3
> non-negotiables. (Earlier execution truth: `2026-06-23-v1-implementation-orchestrator.md`.) Seeded 2026-06-23.

---

## Leva "Review & Polish" (2026-06-27) — seed + checklist G0→G10

> A leva de revisão de uso do Julio (2026-06-27). Doc mestre: `brain/documents/2026-06-27-review-polish-orchestrator.md`.
> Corrige D01–D26 (P0→P1→P2) **sem reconstruir** o que já funciona. Sobe v0.32.0→v0.41.0 (uma por gate). Mais-recente no topo.

### Estado da leva (vivo)
- **gate atual:** G1 ✅ (v0.32.0 no ar) · **próximo:** G2 (mapa cover-fit + marcadores de vidro).
- **produção:** **v0.32.0** (`festpilot.pages.dev` serve `index-CSOJ87J8.js`, deploy `f85f34e1`, master).
- **baseline G0 (verificado 2026-06-27, antes de tocar em nada):** `typecheck` limpo · **677 unit** (439 web + 238 server) ·
  **e2e 30/30** (mobile-chromium, 2.2m) · `build` verde (main 367.27 kB, embute 0.31.6). LOCKs §16 respondidos pelo Julio:
  (1) mapa = SVG progressivo + fallback raster ("ok, faz isso"); (2) URL = `festpilot.pages.dev` (www não funciona); (3) nome = responsivo.

### Checklist de gates
- [x] **G0** — baseline verde + DEC-075→088 PROPOSED (já no log) + back-fill DEC-073/074 (já no log) + pipeline confirmado. *(sem bump)*
- [x] **G1** — sheets portalados+fixed (D05/D06), foto da home circular (D10), caminhada certa from/to/at (D07). → **v0.32.0** ✅
- [ ] **G2** — mapa cover-fit sem borda preta (D03) + marcadores/labels de vidro (D02). → v0.33.0
- [ ] **G3** — mapa base progressiva nítida no zoom (D01). → v0.34.0 *(fecha "o principal alerta")*
- [ ] **G4** — português em todas as telas (D04). → v0.35.0
- [ ] **G5** — poster v2 (D08) + URL final (D26). → v0.36.0
- [ ] **G6** — inserir entre cards (D09) + caminhada única/ajustável/split (D17/D18). → v0.37.0 *(fecha P0)*
- [ ] **G7** — timetable/line-up: favoritos (D12), gridlines (D13), Lock-in (D14), pinça (D15), colapsar favs (D16), haptic (D19). → v0.38.0
- [ ] **G8** — barras do sistema (D11). → v0.39.0 *(fecha P1)*
- [ ] **G9** — squad: Next up (D20/D24), reorg (D21), plano=MyPlan (D22), agenda interleaved (D23). → v0.40.0 *(P2 opcional)*
- [ ] **G10** — nome do festival (D25). → v0.41.0 *(P2 opcional)*

### G1 — Bugs cirúrgicos: menus presos, foto da home, caminhada errada ✅ — v0.32.0
> Três vitórias rápidas de baixo risco que provam o pipeline. **Conselho:** decisões diretas (DEC-078) + C2 (DEC-079);
> reuso total — RouteScreen **já** aceitava `from/to/at`, só faltava o `MyPlanScreen` passar a transição tocada.
- **G1.1 — Sheets portalados + fixed (D05/D06, DEC-078).** `ui/Sheet.tsx` renderiza scrim+sheet via `createPortal(document.body)`;
  `.scrim`/`.sheet` viraram `position: fixed` (z-index 40/50 preservado — nav=20 fica abaixo, toaster=60 acima, no contexto da raiz).
  Drag-to-dismiss/Esc/focus-trap/scroll-lock intactos. **Teste:** `Sheet.test.tsx` +1 (nó é filho de `document.body`, não do container); os 9 de drag/trap reescritos para consultar o `document.body`.
- **G1.2 — Foto da home circular (D10).** `.ava { overflow: hidden }` — clipa a `<img>` ao círculo, sem o gradiente âmbar vazando. CSS-only.
- **G1.3 — Caminhada abre a transição certa (D07, DEC-079).** `PlanGapItem` ganhou `fromStageId`/`toStageId`/`atMs`; o chip de caminhada navega `/route?from=&to=&at=&day=`.
  `chooseRouteStages()` (puro) endurece o default do `RouteScreen` para **destino ≠ origem** (mata "Mainstage → Mainstage"). O menu de 3-pontos roteia para o palco do set tocado.
  **Testes:** `route.test.ts` +6 (`chooseRouteStages`: explícito, to=from→substitui, defaults, sem palcos); `plan.test.ts` afirma o gap carregando o leg exato.
- **5-point self-check:** Dxx D05/D06/D10/D07 + DEC-078/079 ✅; ACs em risco re-verificados → **zero-overlap** intacto (só adicionei campos derivados ao gap, sem tocar `resolveSets`/`planEdit`), **sheets agora fixos/portalados** (a própria correção), **presença grosseira** não tocada; testes **452 unit** (446 web + 6 novos contam aqui? na verdade web 446) + **e2e 30/30**, sem novas falhas; nenhum arquivo fora de escopo; esta entrada.
- **Verificação:** `tsc` limpo · **web unit 446** (era 439; +1 Sheet portal, +6 route) · **e2e 30/30** (2.4m) · `build` verde (main 368.57 kB, embute 0.32.0) · **deploy master** `f85f34e1` → `festpilot.pages.dev` serve `index-CSOJ87J8.js` (confirmado por curl). Worker/D1 intactos.
- **Escopo (arquivos):** `ui/Sheet.tsx`, `ui/Sheet.test.tsx`, `styles.css` (`.scrim`/`.sheet`/`.ava`), `domain/plan.ts`(+`.test`), `domain/route.ts`(+`.test`), `routes/MyPlanScreen.tsx`, `routes/RouteScreen.tsx`, `data/changelog.ts`, `web/package.json`. **Guardrail:** nenhum invariante quebrado; nada removido.
- **DECs:** DEC-078 → **APPROVED**; DEC-079 **APPROVED (parte G1: leg exato + harden)**; o resto de DEC-079 (fonte única + split + ajuste-fora-do-Editar) fecha no **G6**.

### G0 — Setup & baseline ✅ — sem bump
> Conferi a árvore verde **antes** de qualquer mudança (DoD da §12: baseline documentado). DEC-075→088 já estavam PROPOSED no
> `decision-log.md` (authoring do orchestrator) e DEC-073/074 já back-filled — só verifiquei. Pipeline de deploy: Pages `festpilot`
> (master) + Worker `festpilot.trippilot.workers.dev` + D1 (migração 0015) — confirmado pelo dev-log de v0.31.6. Sem produção tocada.
- **Escopo (G0):** `dev-log.md` (esta seção), `brain/README.md` (índice + Last updated), `brain/documents/2026-06-27-review-polish-orchestrator.md` + `…-kickoff-prompt.md` (novos), `decision-log.md` (DEC-073→088, já presente), `package-lock.json` (web 0.2.0→0.31.6, reconciliação do `npm install`).
- **Guardrail:** zero código de produção/domínio/UI tocado; nenhum teste/assert removido; baseline registrado para medir "sem novas falhas".

---

## Nota de fact-check 26/06 — "busca/filtros no lineup" JÁ EXISTE (não é feature futura) ✅

> Ao triar o próximo passo de **produto**, verifiquei o código antes de codar (regras "No Assumptions" / "Reuse First" / fact-verification): **`web/src/routes/LineupScreen.tsx` já entrega busca por nome** (`.lineup-search`, com clear), **filtro de favoritos** e **filtro por dia** (`filter-rail`), `filtered` useMemo, estado vazio "No artists found", densidade de grid por pinch. As menções a "busca/filtros no lineup" como candidata de feature (R7–R11 e no `project-status`) eram **premissa herdada não verificada** — a feature está pronta e polida.
> **Ação:** corrigido o "Next" do `project-status` para refletir a realidade. **Nenhuma feature implementada** (seria duplicata). **Lição:** sempre verificar o código antes de citar um "gap de feature". Não há feature óbvia não-construída para pegar sozinho; um rumo novo de produto agora exige o Julio nomeá-lo (com entrada no decision-log).

---

## Rodada de melhoria R11 26/06 — rede de regressão (servidor): testes para `sha256Hex` e o ULID `db/ids` ✅ — sem bump (só-de-teste)

> Décima-primeira rodada — simétrica à R10, agora no backend. **Conselho (O QUE/SE — `/assess`):** auditei `server/src` × `server/test`. Os 3 domínios (`groupEvent`/`meeting`/`presence`) e `normalize`/`resolver`/`diff` já têm teste; as lacunas **puras** reais eram **`ingest/hash.ts`** (`sha256Hex` — usado na detecção de mudança da ingestão) e **`db/ids.ts`** (o ULID do servidor, **gêmeo** de `web/src/lib/ulid.ts` que a R10 cobriu, mas o lado servidor seguia sem teste direto). Lente dominante = **Risk**: a ingestão decide re-escrever o lineup com base no `configHash`/`stagesHash`; pinar o hash protege esse contrato. Não inventei alvos — hooks/IO/DO ficam de fora (boundary).
> **Conselho (COMO):** seguir a convenção do servidor (`test/**`, import via `../src/...`, `environment: node` com `test/setup.ts` provendo Web Crypto). **hash:** vetores **canônicos NIST** pinados (`sha256Hex("")` e `sha256Hex("abc")`), 64 hex lowercase, determinismo e sensibilidade a colisão. **ids:** espelha exatamente a R10 (base32 big-endian verificado na conta — `ulid(31)`→`…Z`, `ulid(32)`→`…10` —, prefixo monotônico/sortable, sufixo aleatório). Comentário cruzado liga os dois ULID gêmeos.
> **Decisão de risco (Critic):** **só-de-teste** → **sem** bump/changelog/redeploy. **Zero** produção tocada (2 `test/*.test.ts` novos). Nenhum teste/assert removido.
> **Verificação:** `tsc --noEmit` (servidor) limpo · **server unit 238 verde** (27 arquivos; +7: hash **3**, ids **4**; era 231) · Web Crypto via `test/setup.ts` (polyfill `webcrypto` no Node). Combinado com a R10, as duas pontas do ULID e o hash de ingestão agora têm verificação matemática.

### Current State (this batch)
- **Sem mudança de produto/produção** — produção segue em **v0.31.6** (`d276f936`). Rede de regressão densificada nas **duas** pontas (web 439 + server 238 = **677 unit** no total) + e2e 30/30 determinístico.
- **Próximo:** lógica pura crítica coberta em web e servidor; sem flaky. O maior valor restante é **produto** (feature nova → decisão no brain). Bom ponto de revisão do Julio.

### Escopo (arquivos)
- **Novos (server, só-de-teste):** `test/hash.test.ts`, `test/ids.test.ts`.
- **Guardrail intacto:** zero produção/domínio; nenhum assert/teste removido; sem bump (só-de-teste).

---

## Rodada de melhoria R10 26/06 — rede de regressão: testes para a lógica pura ainda descoberta (planSlot, format, ulid) ✅ — sem bump (só-de-teste)

> Décima rodada. **Conselho (O QUE/SE — `/assess`):** com o último flaky fechado (R9) e o teto de polish user-facing atingido, a melhoria de maior valor **que não exige decisão de produto** é reforçar a rede que protege o requisito-mãe do Julio ("não fazer regressões"). Auditei domínio+lib (`Glob` de `*.ts` × `*.test.ts`) e achei lacunas **reais** (não enchi linguiça): **`domain/planSlot.ts`** (o "intervalo efetivo" usado em TODO check de overlap/clash, Now & Next, edição de plano e filtro de squad) e **`lib/format.ts`** (cor de palco + hora/dia no fuso do festival, puro e usado em todo lugar) estavam **sem teste** — e ambas as docstrings de `planSlot.ts`/`types.ts` **afirmavam** "exhaustively unit-tested" (mismatch doc×realidade). `lib/ulid.ts` (ID de auth, 26-char base32) também sem teste. Lente dominante = **Risk** (cobrir a matemática de borda corta risco de regressão silenciosa). Hooks `useGeo`/`usePinch`/`usePhotoPrefetch` ficam de fora por design (boundary/React; a regra manda testar lógica pura e mockar só boundaries).
> **Conselho (COMO):** seguir o padrão do repo (`// @vitest-environment node` p/ puro, `describe`/`it`, asserts numéricos concretos com a conta no comentário). **planSlot:** fronteiras estritas de `effectiveStart`/`effectiveEnd` (== início/fim **não** aplicam; dentro aplica) + `effectiveInterval` compondo as duas escolhas, incluindo o caso de janela invertida (each bound validado contra o **agendado**, não um contra o outro — pinado p/ tornar qualquer clamp futuro uma decisão consciente). **format:** offset de fuso real (`20:30Z` → UTC `20:30`, Brussels `22:30`, São Paulo `17:30`), rollover de dia na fronteira do fuso, 24h, e `stageColorRgb("MAINSTAGE") === "255, 90, 54"` (#ff5a36). **ulid:** base32 big-endian verificado na conta (`ulid(31)` → `…Z`, `ulid(32)` → `…10`), prefixo monotônico/sortable, sufixo aleatório difere no mesmo instante.
> **Decisão de risco (Critic):** **só-de-teste** → **sem** bump/changelog/redeploy (igual R7/R9; não pode cache-bustar o SW). **Zero** arquivo de produção tocado (3 `*.test.ts` novos e nada mais). Nenhum teste/assert removido.
> **Verificação:** `tsc --noEmit` limpo · **unit 439 verde** (53 arquivos; +28: planSlot **11**, format **13**, ulid **4**; era 411) · sem mudança em build/produção. `ulid.test.ts` roda no jsdom padrão (tem `crypto.getRandomValues`); os de fuso usam `Intl` com `timeZone` explícito (determinístico).

### Current State (this batch)
- **Sem mudança de produto/produção** — produção segue em **v0.31.6** (`d276f936`). Só a rede de regressão ficou mais densa: 3 unidades puras críticas que estavam descobertas agora têm testes matemáticos.
- **Próximo:** sem flaky e com a lógica pura crítica coberta. O maior valor restante é **produto** (ex.: busca/filtros no lineup — feature nova, exige decisão no brain). Bom ponto de revisão do Julio.

### Escopo (arquivos)
- **Novos (web, só-de-teste):** `src/domain/planSlot.test.ts`, `src/lib/format.test.ts`, `src/lib/ulid.test.ts`.
- **Guardrail intacto:** zero produção/domínio/UI; nenhum assert/teste removido; sem bump (só-de-teste). As docstrings que diziam "exhaustively unit-tested" agora são verdade para `planSlot`.

---

## Rodada de melhoria R9 26/06 — e2e determinístico: SW-settle no `goto` + espera do resolver no myplan (mata o último flaky) ✅ — sem bump (só-de-teste)

> Nona rodada. **Conselho (O QUE/SE — `/assess`):** fecha o item deferido em R8.A (último flaky, ~1 por suíte, recuperado por `retries:1`). O conselho do R8 deferiu por crer que "o único fix limpo bloqueia o SW e sacrifica a fidelidade as-shipped". **Fato re-verificado:** existe um fix **sem bloquear** o SW — esperar ele **assentar** após o `goto` (nomeado nas notas de R7/R8.A). Lente dominante = **Risk** (o ponto inteiro do R8 era fidelidade; este fix a preserva). Lean resistido: a tentação de só baixar flaky a qualquer custo (bloquear/desregistrar o SW) — proibida.
> **Conselho (COMO):** investiguei a raiz e achei **duas** causas distintas, não uma:
> - **(1) reload do SW (onboarding):** no 1º acesso a página carrega sem controller; `registerSW.ts` registra no `load`, `sw.js` faz `clients.claim()` no activate → `controllerchange` → `location.reload()` ~centenas de ms depois, em cima do `fill`/`click`. **Fix:** a fixture compartilhada do R7 passa a **envolver `page.goto`** e, após navegar, espera `navigator.serviceWorker.controller != null` (claim+reload assentados) — `waitForFunction` é resiliente a navegação, então sobrevive ao reload (ao contrário do `addStyleTag` one-shot). **Não** bloqueia/desregistra o SW: ele instala/ativa/claim/reload exatamente como em produção (fidelidade offline/update intacta); só sincronizamos o teste ao estado estável. Best-effort com timeout 15s + catch → nunca pior que hoje.
> - **(2) corrida de loading no lock-in (myplan):** comparando com o `lockin.spec` (estável), o myplan checava `.lk-clash-title` **imediatamente** após `.tt-lk`, mas o `LockInScreen` mostra `LoadingState` até o lineup chegar → contava **0** clashes, saía do `while` na hora e caía num `expect(.celebrate-title)` que nunca vinha (o resolver carregava depois mostrando o clash). **Fix:** espelhar o guard **já provado** do `lockin.spec` — `Promise.race` esperando `.lk-clash-title` **ou** `.celebrate-title` visível **antes** do loop. Intent-preserving; copia padrão existente do repo, não inventa lógica.
> **Decisão de risco (Critic):** **só-de-teste** → **sem** bump de versão / changelog / redeploy (igual R7; uma mudança de teste não pode cache-bustar o SW nem disparar o banner "nova versão" no meio do teste do Julio no celular). Nenhum código de produção/domínio/UI tocado; nenhum assert/teste removido.
> **Verificação (sem rede de segurança, `--retries=0`):** onboarding **10/10** (`--repeat-each=5`, antes a vítima canônica do reload) · myplan **6/6** (`--repeat-each=6`, e 4× mais rápido: ~6s vs ~22s de timeout antes) · **suíte cheia as-shipped: 30/30, ZERO flaky** (antes era 29 + 1 flaky-recuperado). A classe inteira de flaky de e2e (reload do SW + loading do resolver) foi **eliminada** — o sinal de "sem regressões" para rodadas futuras agora é honesto sem depender do `retries:1`.

### Current State (this batch)
- **Sem mudança de produto/produção** — só a malha e2e ficou determinística. **Nada deployado** (nenhum artefato de produção alterado); produção segue em **v0.31.6** (`d276f936`).
- **Próximo:** sem flaky conhecido restante. O maior valor daqui é **produto** (ex.: busca/filtros no lineup — feature nova, exige decisão no brain/decision-log). Bom ponto de revisão do Julio.

### Escopo (arquivos)
- **Editados (e2e):** `web/e2e/fixtures.js` (+`waitForServiceWorkerSettled` no wrap de `page.goto`, mantendo o freeze via `addInitScript` do R7), `web/e2e/myplan.spec.js` (+`Promise.race` de settle do resolver antes do loop de lock-in).
- **Guardrail intacto:** zero produção/domínio/UI; SW **não** bloqueado/desregistrado (fidelidade preservada); nenhum assert/teste removido; sem bump (só-de-teste). Screenshots regeneradas pelos runs **não** versionadas (ruído binário).

---

## Rodada de melhoria R8 26/06 — A11y: focus-trap na base Sheet (completa o padrão de dialog modal) ✅ — v0.31.6

> Oitava rodada. **Conselho (O QUE/SE):** triagem honesta no teto de polish. **(A)** matar o flake de interação do SW (test-only, já recuperado pelo `retries:1`; único fix limpo = bloquear o SW, que sacrifica a fidelidade "as-shipped" do gate e pode **mascarar** regressão de SW/offline) → **DEFER**. **(B)** focus-trap na base `Sheet` → **vencedor**: hoje a `Sheet` faz foco-no-open + Escape + `aria-modal` + restauração de foco, mas **não** prende o Tab — gap do padrão WAI-ARIA de dialog modal (WCAG 2.4.3). Aditivo, **1 arquivo**, beneficia **todos** os sheets (ArtistSheet, StagePick, MeetingPoint, Share… todos usam a base `Sheet`). **(C)** features (busca no lineup) → exigem decisão no brain, fora de polish. Lente dominante = **Architect** (correção contida e padrão).
> **Conselho (COMO):** estende o `keydown` que a `Sheet` **já** registra (trata Escape) para também envolver `Tab`/`Shift+Tab`: coleta os focáveis do diálogo, faz wrap nas bordas (último→primeiro / primeiro→último) e **puxa o foco de volta** se ele estiver no container ou tiver escapado. Sem novo componente, sem CSS, sem dependência. `aria-modal` já escondia o fundo do AT; o trap fecha o caso de **teclado/switch** (PWA desktop/tablet).
> **Decisão de risco (Critic):** é código de **produção** → bump **0.31.6** + changelog. **Sem auto-redeploy** — Julio está testando no celular; o trap é só-teclado (invisível no mobile), então empurrar um deploy agora só mostraria o banner "nova versão" no meio do teste. Deploy oferecido no fim. Nada removido; Escape/drag-to-dismiss/scrim/restauração de foco **intactos**.
> **Verificação:** `tsc` limpo · **unit 411 verde** (50 arquivos; `Sheet.test.tsx` agora **10**: +4 do trap — wrap nas 2 pontas, Tab no container → 1º focável, e "sem focáveis → foco preso no diálogo") · `vite build` verde (main **367 kB**, embute 0.31.6) · **e2e 29 + 1 flaky-recuperado** (onboarding = a corrida de interação do SW **deferida** acima — **não** é regressão do trap: o trap é só-teclado e o onboarding falha no `fill→click`, sem Tab).
> **R8.A (sinalizada, deferida):** flake de interação do SW (`controllerchange→reload` limpa estado no meio de `fill`/multi-step; ~1 por suíte, recuperado pelo `retries:1`). Fix candidato sem perder fidelidade: esperar o SW **assentar** após o `goto`. Rodada futura, se o Julio quiser fechar o último flaky.

### Current State (this batch)
- **No ar (v0.31.6, deploy `d276f936`):** com um teclado, qualquer painel (detalhe de artista, picker de palco, compartilhar plano) mantém o foco dentro dele; Esc fecha e devolve o foco. Aditivo; invisível no toque/mobile. **Produção sincronizada com o repo** — `festpilot.pages.dev` serve `index-CooOZCJR.js` (v0.31.6); worker + D1 (0015) intactos e saudáveis. (1ª tentativa de deploy subiu os 66 arquivos mas travou no passo "Deploying…" por stall de rede — o re-run finalizou na hora, "0 files / 66 already uploaded".)
- **Próximo:** teto de polish atingido — o maior valor restante é de **produto** (ex.: busca/filtros no lineup) e precisa de decisão do Julio (brain/decision-log), ou fechar o último flaky de e2e (R8.A). Bom ponto de revisão.

### Escopo (arquivos)
- **Editados (web):** `ui/Sheet.tsx` (+ trap de Tab no `useEffect` de a11y já existente), `ui/Sheet.test.tsx` (+4 testes), `data/changelog.ts` (+entrada, `APP_VERSION` → **0.31.6**), `package.json` (**0.31.6**).
- **Guardrail intacto:** sem novo componente/CSS; nenhum assert/teste removido; Escape/drag/scrim/restauração de foco preservados; só código de a11y aditivo na base `Sheet`.

---

## Rodada de melhoria R7 26/06 — hardening sistêmico do e2e (freeze via fixture, fim da corrida do addStyleTag) ✅ — sem bump (só-de-teste)

> Sétima rodada. **Conselho (O QUE/SE):** triagem honesta num app já muito maduro. Candidatos user-facing **descartados por evidência**: `loading="lazy"` regrediria a estratégia de fotos (SW cache-first + `usePhotoPrefetch`/`useKeepFavoritePhotos`); a11y de sheet **já** existe (`Sheet` tem `role=dialog`+`aria-modal`+Escape+focus-trap+restauração); offline/PWA maduro; reduced-motion amplamente gated; busca no lineup = **feature nova** (exige decisão no brain, não cabe em polish). Vencedor por impacto×risco×evidência: **dívida de teste isolada** — 38 `page.addStyleTag({content:FREEZE})` pós-`goto` em 17 specs compartilhavam a corrida com o `controllerchange→reload` do SW ("Execution context was destroyed", ~10%/goto). Lente dominante = **Strategist** (ROI composto: o guardrail honesto protege o requisito-mãe do Julio — "sem regressões" — em toda rodada futura). Risco de produção = **zero** (só-de-teste).
> **Conselho (COMO):** fixture Playwright compartilhada `e2e/fixtures.js` — `page` estendida injeta o FREEZE via **`addInitScript`** (roda em **toda** criação de documento → presente antes do 1º paint e **sobrevive ao reload**, ao contrário do `addStyleTag` pós-`goto`). Specs passam a importar `test`/`expect` da fixture. A chamada racy precisou **SAIR** (não basta adicionar a fixture — o `addStyleTag` ainda lançaria): removidos os 38. `timetable` consolidado (removido seu bloco `addInitScript` bespoke + const local, agora cobertos pela fixture). FREEZE definido **uma vez** (DRY).
> **Decisão de risco (Critic):** **sem** bump de versão / changelog / redeploy — mudança só-de-teste **não** deve cache-bustar o SW nem disparar o banner "nova versão" (isso seria, ele mesmo, uma micro-regressão). Destoa do padrão das rodadas anteriores **por design**. Nada de domínio/UI/produção tocado; nenhum teste/assert removido (só relocado o mecanismo de freeze).
> **Verificação:** grep confirma **zero** `addStyleTag` e **zero** `FREEZE` órfão fora da fixture · **2 suítes cheias** = 29✓ + 1 flaky-recuperado cada (verde, exit 0), e o flaky foi spec **diferente** a cada vez (onboarding→myplan) · **repeat-each=3** de 8 specs leves "goto+screenshot" (timetable/now/map/route/shell/about/squad-board/offline) = **30/30 limpo, zero flaky, zero "execution context destroyed"**. A classe de erro do `addStyleTag` foi **eliminada**.
> **Achado → dívida R8 (sinalizada):** o flake remanescente é **outro e mais raro** (~1 por suíte cheia, sempre recuperado pelo `retries:1`): o reload do SW limpa **estado no meio de interações** (`fill`, fluxos multi-step) — visto em onboarding ("Let's go" segue `disabled` após o `fill`) e myplan (`.celebrate-title` some). Fix candidato: esperar o SW **assentar** após o `goto` (controller ativo) antes de interagir, ou bloquear o SW nos specs que **não** testam offline (preservando `offline.spec.js`, que cobre o SW de propósito). Rodada dedicada.

### Current State (this batch)
- **Sem mudança de produto/produção** — só a malha e2e ficou robusta: a corrida do `addStyleTag` (mais frequente e espalhada) foi eliminada; o sinal de regressão para as próximas rodadas é honesto. **Nada deployado** (não há artefato de produção alterado).
- **Próximo:** R8 candidata = matar a corrida de interação do SW (settle pós-`goto` ou block seletivo) — fecha a última fonte de flaky. Ou rodada a definir pelo conselho. Bom ponto de revisão do Julio.

### Escopo (arquivos)
- **Novo (e2e):** `web/e2e/fixtures.js` (fixture com freeze via `addInitScript`, FREEZE único).
- **Editados (e2e, 18 specs):** import → `./fixtures.js` + remoção do `const FREEZE` e dos `addStyleTag` em onboarding/shell/now/myplan/lockin/presence/squad/squad-split/about/meeting-points/safety/meeting-lifecycle/squad-board/squad-plan/offline/route/map; `timetable` consolidado (bloco bespoke removido). `a11y.spec.js` intacto (não usava freeze).
- **Guardrail intacto:** zero produção/domínio/UI; nenhum assert/teste removido; só relocação do mecanismo de freeze. Sem bump de versão (só-de-teste).

---

## Deploy de produção 26/06 — tudo das Fases 5–10 + R1–R6 no ar ✅ — v0.31.5

> **Por quê:** o último deploy parou na Fase 7 (D1 remoto estava em 0014; Pages servia bundle antigo) — por isso o Julio não via as novidades no celular. Este deploy publica **tudo** que acumulou: Fases 8 (eventos de grupo), 9 (home pessoal+squad), 10a/10b (toasts+auditoria) e as 6 rodadas de melhoria (R1 code-split, R2 drag-to-dismiss, R3 a11y de toque, R4 prefetch idle, R5 ErrorBoundary, R6 a11y de navegação).
> **Auth:** wrangler não-interativo via `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` do `.dev.vars` (conta Juliojcmedeiros@gmail.com).
> **Web (Pages):** rebuild fresco do `web/dist` (embute **v0.31.5** + changelog R6 → bundle `index-B9sAHNKX.js`, main 366 kB / gzip 118 kB) → `wrangler pages deploy ../web/dist --project-name=festpilot --branch=master` → **https://festpilot.pages.dev** (55 arquivos novos).
> **D1:** `wrangler d1 migrations apply festpilot --remote` aplicou a única pendente **`0015_group_event.sql`** (aditiva; 0001–0014 já remotas) — ✅.
> **Worker (API):** `wrangler deploy` → **https://festpilot.trippilot.workers.dev** (Version `7ca6d861`), bindings OK: GROUP_ROOM (DO), DB `festpilot` (D1), MEDIA `festpilot-media` (R2), cron 0 */6.
> **Smoke de produção (verificado):** `GET /api/health` → `{ok:true,service:"festpilot-api"}` · `GET /api/festivals` → Tomorrowland Belgium 2026 (`withTimetable:true`) · web `HTTP 200` servindo `index-B9sAHNKX.js` (o bundle recém-buildado). **Tudo live e testável no celular.**
> **Sem deploy de DO novo:** Fase 8 guarda `group_event` no D1 (migration 0015), não no DO — a classe `GroupRoom` (tag v1) já estava migrada de deploys anteriores; `wrangler deploy` só atualizou o código do worker.

### Current State (this batch)
- **No ar:** `festpilot.pages.dev` (web v0.31.5) + `festpilot.trippilot.workers.dev` (worker `7ca6d861`) + D1 em 0015. Todas as notas "Deploy pendente" das rodadas abaixo estão **superadas** por esta entrada.
- **Como testar no celular:** abrir **https://festpilot.pages.dev** (se o app já estava instalado/PWA, o banner dourado "New version available" aparece sozinho; senão, um reload pega a v0.31.5).
- **Próximo:** rodada a definir pelo conselho (6 entregues; bom ponto de revisão). Candidata viva: hardening dos ~40 `addStyleTag` pós-`goto` no e2e (dívida de teste pré-existente).

---

## Rodada de melhoria R6 26/06 — A11y de navegação SPA: route announcer + skip-link + título por rota ✅ — v0.31.5

> Sexta rodada. **Conselho (O QUE/SE):** item herdado da synthesis da R5. Evidência (verificada): `rg` confirma **zero** skip-to-content, **zero** announcer global e **zero** `document.title` por rota — a Fase 10b auditou labels/reduced-motion mas **não** navegação. Aditivo, sem remover nada; AT (VoiceOver/TalkBack) é uso real em PWA; título por rota beneficia todos (aba/histórico).
> **Conselho (COMO):** peças isoladas — helper **puro** `lib/routeTitle.ts` (`routeName`/`routeTitle`, data-driven, ordenado specific→generic) + 2 componentes burros (`RouteAnnouncer`, `SkipLink`) montados em `App` dentro do Router. `RouteAnnouncer` mantém `document.title` e fala o nome da tela num `<p class="sr-only" role=status aria-live=polite aria-atomic>` — **pula o 1º paint** (não duplica com o load do browser). `SkipLink` = `<a href="#main">` off-screen-até-`:focus`. Alvo `#main` + `tabIndex={-1}` nos `<main>` já existentes (App/Stack/Admin) — 1 atributo, sem novo DOM. **Decisão de risco (Critic):** **não** auto-mover foco a cada navegação (evita roubar foco/atritar com o route-fade); skip-link + announcer cobrem sem isso. `.sr-only` robusto (clip+1px, **não** `display:none`, senão o AT silencia).
> **Happy path = invisível:** só +1 `<p>` sr-only e +1 `<a>` off-screen; zero impacto visual/layout/route-fade/dock/Artist Sheet. **Nada removido; nenhuma feature mudou.**
> **Verificação:** `tsc` limpo · **web tests 407 verde** (50 arquivos; novo `routeTitle.test.ts`, 6 casos cobrindo as abas, stack, sub-flows de squad por sufixo, admin e fallback) · `vite build` verde (main 365 kB, sem aviso de 500 kB) · **e2e 30/30**.
> **Bônus (commit separado b0f7183):** de-flake do `timetable.spec.js` — o FREEZE de animação saiu de `addStyleTag` pós-`goto` (que corria com o reload do SW → "execution context destroyed", ~10%/goto, 1/10 em isolamento) para `addInitScript` (presente desde o 1º init, sobrevive a reload). Estável: **16/16** com `--repeat-each=8`. **Dívida sinalizada:** ~40 outros `addStyleTag` pós-`goto` no e2e têm a mesma raiz → rodada dedicada de hardening de teste.

### Current State (this batch)
- **Pronto p/ deploy (v0.31.5):** leitor de tela anuncia a tela ao trocar de aba; "Skip to content" no teclado; título do navegador por tela. Aditivo.
- **Deploy pendente (sessão Cloudflare):** só web (Pages). Sem backend.
- **Próximo:** rodada a definir pelo conselho (6 rodadas entregues; bom ponto p/ o Julio revisar). Candidata viva: hardening dos ~40 `addStyleTag` do e2e (dívida pré-existente).

### Escopo (arquivos)
- **Novos (web):** `lib/routeTitle.ts` (puro) + `lib/routeTitle.test.ts`, `app/RouteAnnouncer.tsx`, `app/SkipLink.tsx`.
- **Editados (web):** `App.tsx` (SkipLink + RouteAnnouncer), `app/AppLayout.tsx` + `app/StackLayout.tsx` + `admin/AdminLayout.tsx` (`#main` + `tabIndex`), `styles.css` (`.sr-only`/`.skip-link`/`main:focus`), `data/changelog.ts` + `web/package.json` (**0.31.5**). De-flake em `e2e/timetable.spec.js` foi commit à parte (b0f7183).
- **Guardrail intacto:** sem auto-foco; reusa os `<main>` existentes; happy path +2 nós ocultos; nada de domínio/backend.

---

## Rodada de melhoria R5 26/06 — RESILIÊNCIA: error boundary (fim da tela branca em chunk lazy que falha) ✅ — v0.31.4

> Quinta rodada. **Conselho (O QUE/SE):** triagem honesta de candidatos — (A) error boundary p/ falha de chunk lazy, (B) foco/skip-link a11y na navegação SPA, (C) varredura Lighthouse, (D) poda de CSS morto. Vencedor por **impacto × risco × evidência: (A)**. Evidência: `rg` confirma **zero** ErrorBoundary no app; R1/R4 introduziram `import()` dinâmico em ~40 rotas; `<Suspense>` cobre o *pending* mas **relança** uma lazy *rejeitada* → sem boundary acima, a árvore desmonta em **tela branca**. Num festival (sinal ruim no campo) isso = "o app morreu". Fecha um risco que o **próprio** code-split (R1/R4) abriu. Red team ("o SW já cacheia") refutado: o SW só serve o que já baixou — um cluster nunca aberto (Map/Settings) sob sinal ruim na 1ª visita falha.
> **Conselho (COMO):** classe `ErrorBoundary` (só classe captura erro de render) **reusando** o `ErrorState` canônico (`ui/states.tsx`) — **zero CSS novo**. Predicado **puro** `lib/chunkError.ts` (testado com as strings reais de Vite/Chromium/Firefox/Safari/webpack) decide a copy ("Couldn't load this section" vs "Something went wrong"). Recuperação = **reload** (uma promise de `lazy()` rejeitada é memoizada; só um reload rebusca o chunk — o SW pode até servir do cache). Montado **2×**: no topo (`main.tsx`, catch-all) e **dentro** de cada layout, **acima** do `<Suspense>` (`AppLayout`/`StackLayout`) — assim a falha de uma aba mostra a recuperação **dentro** da casca (bottom-nav permanece; trocar de aba remonta o boundary via `key={pathname}` do `<main>` → erro some sem reload).
> **Happy path = invisível:** sem erro o boundary devolve `children` direto (**nenhum** nó DOM extra) → zero impacto em layout/route-fade/dock fixo/Artist Sheet. **Nada removido; nenhuma feature mudou.** Admin cai no boundary de topo (escopo enxuto; não toquei no AdminLayout).
> **Verificação:** `tsc` limpo · **web tests 401 verde** (49 arquivos; novo `lib/chunkError.test.ts`, 5 casos: Vite/Firefox/Safari/webpack/CSS-chunk + não-disparo em erro comum/valor não-erro) · `vite build` verde (main **363 kB** / gzip 117 kB, **sem** aviso de 500 kB; `MapScreen`/`SquadScreen` seguem chunks separados — code-split do R1/R4 preservado) · **e2e 30/30**. (No 1º run paralelo o `timetable` flakou com a corrida pré-existente "execution context destroyed" no `addStyleTag` pós-`goto`; isolado deu **6/6** com `--repeat-each=3` e o re-run completo `--workers=2` deu **30/30** — flakiness de carga, não regressão. Rota `/timetable` é eager, sem chunk.)

### Current State (this batch)
- **Pronto p/ deploy (v0.31.4):** falha ao baixar um trecho do app vira uma tela amigável com **Reload** (ou recupera ao trocar de aba) — nunca mais tela branca. Cobre o cenário real de conectividade ruim no festival.
- **Deploy pendente (sessão Cloudflare):** só web (Pages). Sem backend.
- **Próximo:** rodada a definir pelo conselho (5 rodadas entregues; bom ponto p/ o Julio revisar).

### Escopo (arquivos)
- **Novos (web):** `lib/chunkError.ts` (puro) + `lib/chunkError.test.ts`, `app/ErrorBoundary.tsx`.
- **Editados (web):** `main.tsx` (boundary no topo), `app/AppLayout.tsx` + `app/StackLayout.tsx` (boundary acima do `Suspense`), `data/changelog.ts` + `web/package.json` (**0.31.4**).
- **Guardrail intacto:** reusa `ErrorState` (sem CSS novo); happy path sem DOM extra; admin coberto pelo boundary de topo; nada de domínio/backend.

---

## Rodada de melhoria R4 26/06 — PERF: prefetch em idle das abas lazy (completa o R1) ✅ — v0.31.3

> Quarta rodada. Conselho: a resiliência (erros/retry/empty/skeleton/reconnect) **já é forte** — não é gap. O item de maior valor restante é **completar o R1**: remover seu único custo (flash de fallback no 1º toque das abas lazy Map/Squad).
> **Mudança (frontend puro, só timing de carga):** `app/prefetchRoutes.ts` — `prefetchPrimaryTabs()` aquece, em **idle** (após o 1º paint), os chunks de `MapScreen` e `SquadScreen` usando os **mesmos** specifiers do `lazy()` do `App.tsx` (Vite serve o mesmo chunk; nunca baixa 2×). Chamado uma vez via `useEffect` no `AppLayout`. **Festival-aware:** pula se `navigator.connection.saveData` ou `effectiveType` 2g (não gasta dado de quem nunca abre Map/Squad). `requestIdleCallback` (timeout 3s) com fallback `setTimeout(1.5s)`.
> **Efeito:** 1º toque em Map/Squad fica instantâneo (sem o `RouteFallback`), preservando o ganho do R1 (esses chunks seguem **fora** do bundle inicial — build confirma `MapScreen` 12 kB / `SquadScreen` 16 kB separados; main 361 kB sem aviso de 500 kB).
> **Verificação:** myplan (a única flaky no run paralelo) passou 3/3 isolada (`--repeat-each=3`) — flakiness é carga de máquina, não a mudança (R4 só adiciona prefetch). `tsc` limpo · `vite build` verde · **e2e 30/30**.

### Current State (this batch)
- **Pronto p/ deploy (v0.31.3):** abas Map/Squad abrem instantâneas após o app assentar; respeita data-saver/rede lenta. **Sem mudança de comportamento; nada removido; chunks do R1 preservados.**
- **Deploy pendente (sessão Cloudflare):** só web (Pages). Sem backend.
- **Próximo:** rodada a definir (4 rodadas de melhoria entregues; bom ponto p/ o Julio revisar).

### Escopo (arquivos)
- **Novos (web):** `app/prefetchRoutes.ts`.
- **Editados (web):** `app/AppLayout.tsx` (useEffect → prefetch), `data/changelog.ts` + `web/package.json` (**0.31.3**).
- **Guardrail intacto:** nada de domínio/backend; só aquece cache de chunk; `buildSquadPlan`/lock intocados.

---

## Rodada de melhoria R3 26/06 — A11y de toque: hit-area dos close × ≥44px ✅ — v0.31.2

> Terceira rodada, conselho HOW rápido (Critic/Maintainability + Advocate). Fecha o item P3 da auditoria 10b (× do toast 26px) ampliado numa **varredura** dos close × mais reusados.
> **Achado da varredura:** os menores alvos interativos são os botões de fechar — `.sheet-x` (~22px, o × no head de **todos** os 8 sheets base), `.toast-x` (26px) e `.stage-sheet-close` (34px). `.ava` (40px) fica (é avatar visual; redimensionar mexe no header). Todos **acima** do mínimo AA (24px), mas abaixo do confortável 44px (WCAG 2.5.5/2.5.8) — relevante no festival (uma mão, movimento).
> **Mudança (CSS-only, layout-neutra):** `position: relative` + `::before { inset: -11px }` transparente em `.toast-x`/`.sheet-x`/`.stage-sheet-close` → área de toque ~44px **sem** redimensionar o glifo nem mudar layout. O overlay só cobre vizinhos **não-interativos** (texto da mensagem / título do sheet, sempre à esquerda do ×), então nunca rouba toque de outro controle.
> **Verificação:** SafetyScreen (a única flaky no run paralelo) **não** usa nenhuma dessas classes — flakiness era carga de máquina; safety isolada passou 4/4 (`--repeat-each=2`). `vite build` 360.36 kB (sem aviso 500 kB) · **e2e 30/30** (fecha-por-× coberto em ArtistSheet/MyPlan/Lock-in/Share/SquadEvents/StagePick + dismiss de toast).

### Current State (this batch)
- **Pronto p/ deploy (v0.31.2):** os × de fechar (toasts + sheets) têm alvo de toque ~44px; **visual idêntico, layout idêntico.** Nada removido.
- **Deploy pendente (sessão Cloudflare):** só web (Pages). Sem backend.
- **Próximo:** rodada a definir pelo conselho (candidatos: split de CSS, estados de erro/empty, micro-perf de re-render).

### Escopo (arquivos)
- **Editados (web):** `styles.css` (bloco de hit-area `.toast-x`/`.sheet-x`/`.stage-sheet-close`), `data/changelog.ts` + `web/package.json` (**0.31.2**).
- **Guardrail intacto:** CSS-only; nenhum glifo redimensionado, nenhum layout alterado; domínio/backend intocados.

---

## Rodada de melhoria R2 26/06 — Consistência: StagePickSheet → drag-to-dismiss ✅ — v0.31.1

> Segunda rodada, conselho HOW rápido (Architect+Critic). Fecha a dívida deliberada da Fase 7: o `StagePickSheet` (responder ping com palco / escolher palco de encontro) era o **único** bottom sheet sem arrastar-pra-fechar — só tap no scrim/×.
> **Achado que mudou a abordagem:** a classe `.stage-sheet` é **compartilhada** com o overlay de info-do-palco do mapa (dois blocos CSS) e o sheet é `position:fixed`/`z-200` sobre o mapa. Converter pro `Sheet` base (`position:absolute`/`z-40` + desemaranhar CSS) seria risco de regressão. **Escolha:** **reusar o hook `useSheetDrag`** no markup próprio (provado sobre o mapa), sem tocar posição/z-index/CSS.
> **Mudança:** `StagePickSheet` ganhou refs (section + scrim) + `useSheetDrag(sheetRef, scrimRef, onClose)` + marcador **`sheet-scroll`** na `.stage-sheet-list`. O hook teve o seletor de scroller **ampliado** de `.sheet-body` → `.sheet-body, .sheet-scroll` (aditivo: os 8 sheets base seguem casando `.sheet-body` primeiro). Agora segue o dedo 1:1, flick/>25% fecha, mola se aquém, haptic no dismiss, reduced-motion = corte — paridade total com os outros sheets.
> `tsc` limpo · **web 396 testes** (sem regressão; `sheetDrag` math + `Sheet` DOM intactos) · `vite build` 359.87 kB (sem aviso 500 kB) · **e2e 30/30** (cobre o `StagePickSheet` em presence "Which stage are you at?" + meeting "A stage", e os 8 sheets base via myplan/lockin).

### Current State (this batch)
- **Pronto p/ deploy (v0.31.1):** todo bottom sheet do app — agora **inclusive** o de palco sobre o mapa — fecha arrastando. **Zero mudança de feature; CSS/posição/z-index do sheet do mapa intocados.**
- **Deploy pendente (sessão Cloudflare):** só web (Pages). Sem backend.
- **Próximo:** R3 — alvo de toque do `×` do toast ≥44px + varredura de alvos < 44px.

### Escopo (arquivos)
- **Editados (web):** `routes/presence/StagePickSheet.tsx` (refs + hook + `sheet-scroll`), `ui/useSheetDrag.ts` (seletor ampliado, aditivo), `data/changelog.ts` + `web/package.json` (**0.31.1**).
- **Guardrail intacto:** nada de domínio/backend; CSS `.stage-sheet` (compartilhada com o mapa) **não tocada**; só comportamento de arrastar.

---

## Rodada de melhoria R1 26/06 — PERF: code-split por cluster (route-level lazy) ✅ — v0.31.0

> Primeira rodada de melhoria pós-fases, guiada por **conselho inline** (sem subagents). Conselho de triagem (WHAT/IF, 4 papéis + red team) elegeu **carga inicial** como o ganho de maior alavancagem/menor risco (contexto: festival = rede saturada; bundle inicial acima do aviso de 500 kB); conselho HOW (Architect+Critic) fechou em **lazy puro + Suspense, sem `manualChunks`** (evita acoplar o squad-eager: `NowScreen` importa `SquadNowCard`).
> **Mudança (frontend puro, só carregamento):** os clusters não-hot-path agora são `React.lazy` — `MapScreen`, `RouteScreen`, `LockInScreen`, **todo** o squad (`squad/*`), presence (`presence/*`), meet (`meet/*`) e settings (`settings/*`). Hot path **eager**: Now/Timetable/Lineup/MyPlan + Onboarding + shells/gates. Os dois layouts (`AppLayout`, `StackLayout`) ganharam um `Suspense` com `RouteFallback` (full-height → sem CLS; spin neutralizado pelo safeguard global de reduced-motion). `App.tsx` ganhou um helper `named()` p/ os lazy de export nomeado (DRY também nos 7 admin já split).
> **Resultado medido:** bundle inicial **555.62 kB → 359.18 kB** (gzip **170.21 → 116.14 kB**, −32%); **aviso de >500 kB eliminado**. Cada cluster virou chunk sob demanda (squad 16 kB, lockin 13.6 kB, map 12 kB, invite 26.8 kB — QR sob demanda) + chunks compartilhados hoistados pelo Rollup (`squadPlan`, `squadUi`, `meetUi`, `usePanZoom`, `transform`, `useGeo`).
> `tsc` limpo · **web 396 testes** (sem regressão) · `vite build` verde · **e2e 30/30** (gate real do lazy routing — navegação resolve os chunks transparentemente).

### Current State (this batch)
- **Pronto p/ deploy (v0.31.0):** abre mais leve (−35% no JS inicial); 1º toque em Map/Squad/Settings carrega o chunk daquela área e segue instantâneo. **Zero mudança de comportamento/feature; nada removido — só reorganização de carregamento.**
- **Deploy pendente (sessão Cloudflare):** só web (Pages). Sem backend.
- **Próximo:** R2 — `StagePickSheet` → drag-to-dismiss (fecha dívida da Fase 7).

### Escopo (arquivos)
- **Novos (web):** `app/RouteFallback.tsx`.
- **Editados (web):** `App.tsx` (lazy dos clusters + helper `named`), `app/AppLayout.tsx` + `app/StackLayout.tsx` (Suspense + fallback), `styles.css` (`.route-fallback`), `data/changelog.ts` + `web/package.json` (**0.31.0**).
- **Guardrail intacto:** nada de domínio/backend; `buildSquadPlan`/lock/`slotToShareInput` intocados; só mudou **quando** o código carrega.

---

## Fase 10b 26/06 — Auditoria a11y/perf/responsivo + correções P0–P2 (parte 2 de 2) ✅ — v0.30.0

> Fechamento da Fase 10 (e da leva 5–10). Auditoria **inline** (sem subagents) de a11y/perf/responsivo do `FestPilot/web`. Relatório completo: `.cursor/docs/reports/2026-06-26-phase-10b-a11y-perf-responsive-audit.md` (+ INDEX).
> **Resultado:** app já estava forte (alt em toda `<img>`, inputs rotulados, `:focus-visible`, safe-areas, chrome PWA completo). **Zero P0.** Achados e correções:
> - **A11Y-1 (P1) — corrigido:** animações **infinitas** (shimmer, swipeCue, presence-pulse avatar+pin, `.pulse` do mapa, safetyPulse, adminSpin) eram sempre-on, fora do gate `no-preference`. Adicionado **safeguard global** `@media (prefers-reduced-motion: reduce)` que zera duração/iteração de toda animação/transição. Complementa (não substitui) os gates existentes.
> - **A11Y-2 (P2) — corrigido:** busca do **Lock-in** só tinha `placeholder` → `aria-label="Search any artist"` (consistência com Lineup/My Plan).
> - **PERF-1 (P2) — parcial:** bundle único ~593 kB. **Code-split do admin** (7 telas via `React.lazy` + um `Suspense` no `AdminLayout`): principal → **555 kB (170 kB gzip)**, admin carrega sob demanda (chunks por tela). Restante (>500 kB) **deferido** (split por rota de map/squad) p/ rodada futura — evita risco no hot path.
> - **CHROME-1 (P3) — corrigido:** `html` sem background → `background: var(--bg)` em `html,body,#root` (evita flash no overscroll/pré-paint).
> - **A11Y-3 (P3) — aceito:** `×` do toast 26px (alvo secundário; auto-dismiss é o caminho primário). Registrado.
> - **Responsivo:** revisado 320–480px + frame desktop — fluido, ellipsis, safe-areas; sem P0–P2.
> `tsc` limpo · **web 396 testes** (sem regressão) · `vite build` verde com chunks de admin separados.

### Current State (this batch)
- **Pronto p/ deploy (v0.30.0):** reduced-motion respeitado em todo o app; start mais leve (admin fora do bundle inicial); polish a11y/chrome. **Nenhuma mudança de comportamento/feature.**
- **Deploy pendente (sessão Cloudflare):** só web (Pages). Sem backend.
- **Leva 5–10 COMPLETA.** Próximo: revisão geral pós-fases + rodadas de melhoria guiadas por conselho.

### Escopo (arquivos)
- **Novos:** `.cursor/docs/reports/2026-06-26-phase-10b-a11y-perf-responsive-audit.md` (+ INDEX).
- **Editados (web):** `styles.css` (safeguard reduced-motion + `html` bg), `routes/lockin/LockInScreen.tsx` (aria-label), `App.tsx` (lazy admin) + `admin/AdminLayout.tsx` (Suspense), `data/changelog.ts` + `web/package.json` (**0.30.0**).
- **Guardrail intacto:** mudanças só de apresentação/carregamento; domínio/backend/`buildSquadPlan`/lock intocados; 396 testes verdes.

---

## Fase 10a 26/06 — Toasts unificados + feedback (parte 1 de 2) ✅ — v0.29.0

> Fase 10 do roadmap (`brain/documents/2026-06-26-native-polish-and-features-roadmap.md`), **dividida em 10a (chrome+toasts, v0.29.0)** e **10b (auditoria a11y/perf/resp., v0.30.0)**. Frontend puro.
> **System chrome — auditado, já conforme:** `theme-color`/`background_color` (#0F0D09) no `index.html` **e** no `manifest.webmanifest`; `viewport-fit=cover`; `apple-mobile-web-app-capable` + `status-bar-style black-translucent` + `apple-touch-icon`; `display:standalone`, `orientation:portrait`, ícones 192/512/maskable. Safe-areas via `--safe-top`/`--safe-bottom` (`env(safe-area-inset-*)`) usadas em todo header/nav/sheet/dock. **Nada a corrigir aqui** — registrado como verificado.
> **Toast unificado (a lacuna real — antes só havia banners inline no admin):**
> - `lib/toast.ts` (**store leve, agnóstico de React** — testável): API imperativa `toast.success/info/error/show/dismiss` (espelha a ergonomia do `haptic()`), tons com ícone+duração padrão (info/success 2.6s, error 4.2s), **chave de coalescência** (repetições rápidas no mesmo `key` **substituem**, não empilham), **cap de 3** (estouro derruba o mais antigo), haptic no show (`haptic:false` quando o toque que disparou já vibrou), auto-dismiss com timers.
> - `ui/Toaster.tsx`: um único live region montado na raiz (`App`), lê o store via `useSyncExternalStore`. **A11y:** cada toast carrega seu próprio role — `status` (polite) p/ info/success, `alert` (assertive) p/ erro — em vez de aninhar live regions; `×` p/ dispensar; entrada `fp-rise` (gated por reduced-motion). Fixo, centralizado no frame de 480px, **acima da bottom-nav**.
> **Ligações (favoritar / lock / erros — AC):** coração do **Lineup** e do **Timetable** → toast "Saved/Removed {artista}" (`key:"favorite"`, `haptic:false` pois o toque já vibra); **Lock-in** persistido → `toast.success("Plan locked in · N artists")` (com buzz de sucesso, que antes não existia nesse instante); **Share my plan** → sucesso "Plan shared" (sobrevive à navegação) + **erro** (antes silencioso: só `setBusy(false)`) → "Couldn't share your plan…". **Onboarding (swipe/grid) propositalmente NÃO toasta** (seria ruído).
> `tsc` limpo · **web 396 testes** (+8 `toast`: defaults por tom, coalescência por key, cap 3, auto-dismiss, sticky, subscribe/unsubscribe, snapshot estável) · `vite build` ok (`index-B0a1tMm6.js`).

### Current State (this batch)
- **Pronto p/ deploy (v0.29.0):** confirmações rápidas (favoritar/lock/share) + erros visíveis (share) com haptic, reduced-motion-aware, a11y por role. Chrome auditado e conforme.
- **Deploy pendente (sessão Cloudflare):** só web (Pages). Sem backend.
- **Próximo (10b, v0.30.0):** auditoria a11y/perf/responsivo + correções P0–P2 + relatório.

### Escopo (arquivos)
- **Novos (web):** `lib/toast.ts` (+`toast.test.ts`), `ui/Toaster.tsx`.
- **Editados (web):** `App.tsx` (monta `<Toaster/>`), `routes/LineupScreen.tsx` + `routes/TimetableScreen.tsx` (toast no coração), `routes/lockin/LockInScreen.tsx` (toast no lock), `routes/squad/ShareMyPlanScreen.tsx` (sucesso+erro), `styles.css` (`.toaster`/`.toast*`), `data/changelog.ts` + `web/package.json` (**0.29.0**).
- **Guardrail intacto:** nada de backend/domínio; toasts são só apresentação. `buildSquadPlan`/lock intocados.

---

## Fase 9 26/06 — Home = pessoal + squad · card "Squad now" (D4) ✅ — v0.28.0

> Fase 9 do roadmap (`brain/documents/2026-06-26-native-polish-and-features-roadmap.md`). **Frontend puro — zero backend** (reusa hooks existentes). Traz um pedaço do squad pra home pessoal (Now & Next): um card **"Squad now"** abaixo do hero com **onde o squad está agora** (resumo de presença, ex.: "3 at FREEDOM · 1 between A & B") + **o próximo combinado** (group event ao vivo/futuro; senão um meeting point ativo) com countdown, e **abre o Squad ao tocar**.
> **Auto-gated em 2 camadas (solo intocado):** (1) **sem conta → `null` antes de qualquer chamada de rede** (a maioria dos solo nunca bate na API de grupos); (2) com conta mas **sem squad → `null`** assim que a lista volta vazia (sem layout shift). Com squad: skeleton in-card no 1º load da presença (já sabemos que há squad).
> **Lente do squad ativo:** lê a mesma chave `fp.activeGroup.v1` que o `SquadScreen` grava, então a home espelha o squad que o usuário viu por último (senão o primeiro).
> **Reuso, sem novas abstrações:** `groupRosterByStage` (presença), `eventBadge`/`eventCountdown`/`eventLifecycleFromIso` (Fase 8), tons `meet-badge`, `.glass`/`.tappable`/`.shimmer`. Lógica com ramificação isolada em `routes/squad/squadNowUi.ts` (**puro**): `presenceSummary` (top-2 lugares + overflow "+N more", bucket off ignorado, fallback mudo) · `pointBadge` (safety > all-here > wrapping-up > default) · `firstActivePoint`.
> **Montagem:** `SquadNowCard` (gate de conta) → `SquadNowGate` (gate de squad + escolhe ativo) → `SquadNowInner` (hooks `useGroupPresence`/`useGroupEvents`/`useMeetingPoints`). Plugado no `NowScreen` **abaixo do hero** e também no topo do estado vazio (squad com set times ainda não saídos continua vendo o squad).
> `tsc` limpo · **web 388 testes** (+8 `squadNowUi`: resumo top-2/overflow/off/fallback, badges de ponto, primeiro ativo) · `vite build` ok (`index-zVEyV_R-.js`).

### Current State (this batch)
- **Pronto p/ deploy (v0.28.0):** Now & Next mostra "Squad now" pra quem tem squad (presença + próximo combinado + countdown), toca → Squad. **Solo: home idêntica à de antes** (nenhum card, nenhuma chamada de rede extra).
- **Deploy pendente (sessão Cloudflare do Julio):** só web (Pages) — **sem mudança de worker/D1 nesta fase**. Validado localmente (tsc/test/build verdes).

### Escopo (arquivos)
- **Novos (web):** `routes/squad/SquadNowCard.tsx`, `routes/squad/squadNowUi.ts` (+`squadNowUi.test.ts`).
- **Editados (web):** `routes/NowScreen.tsx` (import + card abaixo do hero + no topo do estado vazio), `styles.css` (`.squad-now*` + reduced-motion), `data/changelog.ts` + `web/package.json` (**0.28.0**).
- **Guardrail intacto:** nada no backend; o card **só lê** hooks existentes — nunca escreve, nunca alimenta `buildSquadPlan` nem lock pessoal.

---

## Fase 8 26/06 — Eventos de grupo (hora fixa) · `group_event` (D2 / Q5 / Q6) ✅ — v0.27.0

> Fase 8 do roadmap (`brain/documents/2026-06-26-native-polish-and-features-roadmap.md`). **A única fase desta leva que toca backend.** O squad agora combina **momentos de hora fixa** ("foto às 16h no Mainstage") que aparecem **para todos** com contagem regressiva — uma **camada paralela** ao plano de grupo, **nunca** dentro da agregação de sets nem do lock pessoal (guardrail §5).
> **Decisões travadas:** **Q5 = entidade nova `group_event`** (semântica limpa, reusa a *plumbing* das meeting points: rotas/socket/hook) · **Q6 = qualquer membro cria** (delete só do criador **ou** do owner do squad).
> **Backend (Cloudflare Worker + D1):**
> - `migrations/0015_group_event.sql`: tabela `group_event` (id, group_id, created_by, title, note?, stage_id?, starts/ends_at_utc, created_at) + `group_event_seen` (✓ vi, aditivo) + índice por grupo.
> - `domain/groupEvent.ts` (**puro**): `normalizeEventWindow` (valida/clampa a janela: fim sempre > início, mín 5min / máx 12h) + `eventLifecycle` (upcoming→soon→live→past, derivado do relógio) + `isLiveEvent`.
> - `api/groupEvents.ts`: `create/get/list/delete/markSeen`. `list` = eventos não-passados (ends > now), `starts ASC`; `delete` = criador **ou** owner (404 vs 403 resolvido na rota); stage name derivado via `listStages`; `seenCount`/`mySeen`/`memberCount` no DTO; `canDelete` calculado com o `role` do chamador.
> - Rotas em `groups-routes.ts`: `GET/POST /:id/events`, `POST /:id/events/:eventId/seen`, `DELETE /:id/events/:eventId` — fanout `notifyGroup("events")` (DO inalterado; topic novo já funciona, `useGroupLive` recarrega em qualquer "changed").
> **Cliente:** `data/types.ts` (`GroupEventDto`/`CreateGroupEventInput`/`GroupEventLifecycle`) · `data/api.ts` (4 métodos) · `data/groupEvents.ts` (`useGroupEvents` — mesmo contrato socket+focus+tick 30s) · `routes/squad/eventsUi.ts` (puro: `eventLifecycleFromIso`/`eventCountdown`/`durationLabel`/`eventBadge`, re-derivados no tick como o `closesInLabel`).
> **UI:** `SquadEventsScreen` (`squad/:id/events`) — lista com countdown ao vivo, chip de palco + "no mapa", "✓ Got it" (tally N/total), delete (só `canDelete`), e **sheet de criação** reusando o `ui/Sheet` base da Fase 7 (título + `datetime-local` + chips de duração + palco opcional + nota) · card **"Squad agenda"** na home do squad (`squadHomeCards`) · **faixa "Squad agenda"** no `SquadPlanScreen` acima dos blocos (ao lado da agregação, nunca dentro).
> **Guardrail testado:** `getSquadPlanData` é **byte-for-byte idêntico** antes/depois de criar vários eventos (teste de regressão em `test/groupEvents.test.ts`).
> `tsc` limpo (web+server) · **server 231 testes** (+16: 9 domínio + 7 repo/regressão) · **web 380 testes** (+9 `eventsUi`) · `vite build` ok (`index-DbxlDqpn.js`) · worker `--dry-run` ok (216 KiB).

### Current State (this batch)
- **Pronto p/ deploy (v0.27.0):** squad combina momentos de hora fixa; todos veem com countdown; qualquer membro cria; criador/owner apaga; "✓ vi" opcional. **Camada separada — plano de grupo segue só os sets.**
- **Deploy pendente (precisa da sessão Cloudflare do Julio):** `wrangler deploy` (worker) + `wrangler d1 migrations apply festpilot --remote` (migração 0015) + deploy do web (Pages). Tudo validado localmente (build/dry-run verdes).

### Escopo (arquivos)
- **Novos (server):** `migrations/0015_group_event.sql`, `src/domain/groupEvent.ts`, `src/api/groupEvents.ts`, `test/groupEvent-domain.test.ts`, `test/groupEvents.test.ts`.
- **Editados (server):** `src/api/dto.ts` (+`GroupEventDto`/`GroupEventLifecycle`), `src/api/groups-routes.ts` (import + 4 rotas + notify "events").
- **Novos (web):** `data/groupEvents.ts`, `routes/squad/eventsUi.ts` (+`eventsUi.test.ts`), `routes/squad/SquadEventsScreen.tsx`.
- **Editados (web):** `data/types.ts`, `data/api.ts`, `routes/squad/squadHomeCards.tsx` (+`SquadAgendaCard`), `routes/squad/SquadPlanScreen.tsx` (+`AgendaBand`), `routes/SquadScreen.tsx` (wire card+refresh), `App.tsx` (rota), `styles.css` (eventos/agenda/faixa), `data/changelog.ts` + `web/package.json` (**0.27.0**).
- **Guardrail intacto:** `buildSquadPlan`/`squadPlan`/`slotToShareInput` **não tocados**; `group_event` nunca entra na agregação (provado por teste).

---

## Native polish 7/10 26/06 — Drag-to-dismiss sheets + base `Sheet` + nav indicator + number pop (D3+D5.2) ✅ — v0.26.0

> Fase 7 do roadmap (`brain/documents/2026-06-26-native-polish-and-features-roadmap.md`). **Todo bottom sheet fecha arrastando pra baixo**, seguindo o dedo 1:1 (flick rápido ou >25% da altura fecha; abaixo volta com mola), com haptic no dismiss e **reduced-motion = corte**.
> **D3 — `ui/Sheet.tsx` base (Q4 = todos os sheets):** um componente único para o padrão `scrim + sheet` que centraliza scrim, grip, drag-to-dismiss, Esc, foco no dialog (volta ao gatilho no unmount) e `aria-modal`. Convertidos **8 sheets**: ArtistSheet, SharePlanSheet, PlanItemMenu, SetPickerSheet, BlockSheet, TravelSheet (My Plan), ClashesSheet, AddSheet (Lock-in). Hook `useSheetDrag` espelha a disciplina do pull-to-refresh: **arma só com o corpo (`.sheet-body`) no topo**, `preventDefault` cirúrgico, math pura em `lib/sheetDrag.ts`.
> **D5 parte 2 — motion:** indicador deslizante na bottom-nav (`.nav-ind`, transform por `--active` 0–4, reduced-motion-gated) + "pop" (fade) dos números ao vivo (leave-in / countdown) no Now via re-key do span.
> **Exclusão deliberada:** `StagePickSheet` (`.sheet-scrim`/`.stage-sheet`, `position:fixed` sobre o mapa) — contexto de posicionamento diferente; manteve o tap-no-scrim pra fechar. Fica pra uma rodada de melhoria se o conselho pedir.
> `tsc` limpo · **371 testes** (+17: 11 `sheetDrag` math + 6 `Sheet` DOM — arrasta/fecha, arrasto curto volta, corpo rolado não arma, preventDefault só ao dominar, Esc, scrim) · `vite build` ok (`index-BSFyCvqD.js`) · **e2e `lockin` + `myplan` verdes** após sanar 2 seletores **pré-existentes desatualizados** (`.tt-lockin`→`.tt-lk` do redesign do Timetable; e o menu do set agora abre pelo `more_vert`/`.plan-state-ico-btn`, não pelo corpo do card que abre o ArtistSheet).

### Current State (this batch)
- **No ar (v0.26.0):** todos os bottom sheets padrão arrastam pra fechar; bottom-nav com marcador deslizante; números do Now dão um fade ao mudar.
- **Novos:** `lib/sheetDrag.ts` (+test), `ui/Sheet.tsx` (+test), `ui/useSheetDrag.ts`.
- **Editados:** `ui/ArtistSheet.tsx`, `routes/share/SharePlanSheet.tsx`, `routes/MyPlanScreen.tsx` (4 sheets), `routes/lockin/LockInScreen.tsx` (2 sheets), `app/BottomNav.tsx` (useLocation + `.nav-ind`), `routes/NowScreen.tsx` (count-pop key), `styles.css` (`.nav-ind`, `.count-pop`), `e2e/{myplan,lockin}.spec.js` (seletores atuais), `data/changelog.ts` + `web/package.json` (**0.26.0**).
- **Guardrail intacto:** nenhuma mudança no domínio de plano/grupo; conversão é só de apresentação (markup/comportamento de sheet). `slotToShareInput` e `buildSquadPlan` intocados.

---

## Feedback patch 26/06 — Link de convite atravessa o onboarding → auto-join no squad ✅ DEPLOYED — v0.25.2

> Item mais pedido: quem clica num link de convite (`/j/:token`) sem ter o app **perdia o contexto** — o `RequireOnboarding` redirecionava pro `/onboarding` descartando o token, e o onboarding terminava em `/` (home). A pessoa nunca entrava no squad.
> **Fix (3 pontos):**
> 1. `RequireOnboarding` agora **carrega o destino tentado** como `?next=<path>` (com guarda anti open-redirect).
> 2. `OnboardingScreen.finish()` **honra o `next`** via `resolveOnboardingNext()` — e para rotas de convite anexa `auto=1`.
> 3. `JoinPreview` **auto-entra** quando `auto=1` + perfil pronto + preview ok (uma vez, via ref). Fallbacks intactos: sem perfil → signin (carrega o `next`); já membro → `/squad`; offline → botão Join manual. Usuário já onboarded vê o preview normal (sem auto), preservando o consentimento.
> Helpers puros isolados em `app/onboardingRedirect.ts` (`safeNext`/`withAutoJoin`/`resolveOnboardingNext`).
> `tsc` limpo · **354 testes** (+8 onboardingRedirect: same-origin, `//host`/absolute/js: rejeitados, flag de invite, merge de query, fallback home) · `vite build` ok (`index-lWE45tTD.js`) · deploy `--branch=master` → `festpilot.pages.dev`.

### Current State (this batch)
- **No ar (v0.25.2):** link de convite → onboarding → entra direto no squad. Link clicado por quem já tem o app continua mostrando o preview "Fulano convidou você".
- **Fluxo:** `/j/TOKEN` (deslogado/novo) → `RequireOnboarding` → `/onboarding?next=%2Fj%2FTOKEN` → finish → `/j/TOKEN?auto=1` → `JoinPreview` auto-join → share/`squad`.

### Escopo (arquivos)
- **Novos:** `app/onboardingRedirect.ts` + `app/onboardingRedirect.test.ts`.
- **Editados:** `app/RequireOnboarding.tsx` (useLocation + next), `routes/onboarding/OnboardingScreen.tsx` (useSearchParams + resolveOnboardingNext no finish), `routes/squad/JoinScreen.tsx` (auto-join: useSearchParams/useCallback/useRef), `data/changelog.ts` + `web/package.json` (**0.25.2**).

---

## Feedback patch 26/06 — Onboarding: swipe por flick + haptics distintos + nome no grid + Undo reposicionado ✅ DEPLOYED — v0.25.1

> Primeiro patch da cadência incremental (0.0.1 por feature/milestone, sem esperar fechar a fase). 4 itens de feedback do onboarding:
> 1. **Swipe por velocidade (flick):** novo `swipeRelease(dx, vx)` no domínio — além do commit por distância (threshold **90→72px**), um **arremesso rápido** (`|vx| ≥ 0.55px/ms`, deslocamento ≥ 28px, mesma direção) já confirma. Puxar o dedo de volta no fim **cancela** (sinal de velocidade ≠ sinal do deslocamento). `StepSwipe` amostra velocidade em `onPointerMove` via `e.timeStamp`.
> 2. **Haptics distintos:** keep = `success` `[12,28,18]`, skip = `warning` `[20,40,20]` — disparados no `commit()` e espelhados nos botões (`data-haptic` em Nah/Yes).
> 3. **Nome no grid legível:** `.gcard` é `<button>` e não setava `color` → nome herdava preto. Agora `color: var(--ink)`.
> 4. **Undo reposicionado:** era `position:absolute` colado na linha da %. Agora numa linha flex (`.swipe-head-top`): progresso à esquerda, Undo à direita; barra/dia abaixo.
> `tsc` limpo · **346 testes** (swipe +5: distância vs flick vs jitter vs pull-back) · `vite build` ok (`index-BVu13ISx.js`) · deploy `--branch=master` → `62cf774c.festpilot.pages.dev` (alias `festpilot.pages.dev`).

### Current State (this batch)
- **No ar (v0.25.1):** onboarding swipe responde a flick rápido; vibração diferente pra keep/skip; nomes do grid legíveis; Undo fora da linha de progresso.
- **Domínio:** `domain/swipe.ts` ganhou `SWIPE_VELOCITY`, `SWIPE_FLICK_MIN_DX`, `swipeRelease()` (threshold baixado pra 72). `swipeOutcome` mantido (back-compat).

### Escopo (arquivos)
- **Editados:** `domain/swipe.ts` (+`swipeRelease`/constantes), `domain/swipe.test.ts` (+5 testes de flick), `routes/onboarding/OnboardingScreen.tsx` (velocidade+haptics+head reestruturado+data-haptic), `styles.css` (`.gcard color`, `.swipe-head-top`, `.swipe-undo.sm` estático), `data/changelog.ts` + `web/package.json` (**0.25.1**).

---

## Native polish 6/10 26/06 — My Plan editável + blocos pessoais + deslocamento inteligente (D1+D7) + update descobrível ✅ DEPLOYED — v0.25.0

> Fase 6 do roadmap (D1 + D7 num só deploy). **My Plan ganha modo Editar**: blocos pessoais (comer/descansar/água/encontro/explorar/custom) com presets, steppers ±15min e nota; CTA "Preencher" nos vãos longos; **invariante zero-overlap** preservada (planEdit puro).
> **Deslocamento inteligente (D7):** quando a caminhada entre dois sets invadiria o próximo, o plano resolve por **sair antes** (corta o fim) ou **chegar depois** (empurra o início) — escolha por trajeto + **preferência padrão** em Settings → Aparência. Tempos honestos via effectiveStart/End centralizados em `planSlot.ts`.
> **Guardrail:** blocos e escolhas de trajeto ficam **só no device** (`slotToShareInput` não serializa `lateStartMs`/blocks) — nunca vão pro grupo.
> **Update descobrível:** "Buscar atualização"/"Forçar atualização" agora na tela **Sobre** (ao lado da versão), via hook `useUpdateCheck`; Offline reusa o mesmo. (Auto-discovery em background já existia desde v0.19.0.)
> `tsc` limpo · **341 testes** · `vite build` ok (`index-FQcZCJwT.js`) · deploy `--branch=master` → festpilot.pages.dev.

### Current State (this batch)
- **No ar (v0.25.0):** My Plan editável + blocos + travel; Settings → Aparência tem o seletor "Caminhadas apertadas" (Sair antes / Chegar depois); Sobre tem "Buscar atualização".
- **Domínio novo:** `planSlot.ts` (effectiveStart/End/Interval honrando `cutMs`+`lateStartMs`); `plan.ts` reescrito (resolveSets + interleave blocks/gaps + `TravelInfo` por transição); `planEdit.ts` (+addBlock/resizeBlock/editBlockMeta/removeBlock + applyLeaveEarly/applyArriveLate/clearTravelChoice + rangeIsFree).
- **Store/Settings:** `PersistedPlan.blocks` + `setPlanBlocks` + `usePlan.saveBlocks`; `settings.useTravelPref` (default leave-early).
- **Pós-lock CTA:** Celebration ganhou "Add breaks & plans" → My Plan já em `?edit=1`.

### Escopo (arquivos)
- **Novos:** `domain/planSlot.ts`, `app/useUpdateCheck.ts`.
- **Editados:** `domain/plan.ts`, `domain/planEdit.ts`, `domain/nowNext.ts`, `data/localStore.ts`, `data/api.ts`, `app/settings.ts`, `routes/MyPlanScreen.tsx` (reescrita), `routes/settings/{AboutScreen,OfflineScreen,AppearanceScreen}.tsx`, `routes/lockin/LockInScreen.tsx`, `routes/squad/{ShareMyPlanScreen,SquadBlockScreen}.tsx`, `i18n/index.ts`, `styles.css`, `data/changelog.ts` + `web/package.json` (**0.25.0**) · testes estendidos (plan/planEdit/nowNext/localStore/api).

---

## Native polish 5/10 26/06 — Timetable defaults (1h + linhas sempre on) + animações de entrada ✅ DEPLOYED — v0.24.0

> Primeira fase do roadmap re-faseado (`brain/documents/2026-06-26-native-polish-and-features-roadmap.md`, conselho D1–D7, decisões Q1–Q8 travadas).
> **D6 (Timetable):** abre em **1h por padrão** (set "respira", times legíveis), **linhas de hora sempre on** (removido o toggle `straighten`/`showGrid` que confundia com "modo grid"); zoom→2h e pinça mantidos.
> **D5 parte 1 (animações de entrada):** **stagger-rise** CSS-only nos itens recém-montados (grid do Lineup, lista "later" do Now, timeline do My Plan) + **fade de conteúdo** ao abrir bottom sheet.
> Conselho (inline, 1 request): CSS-first, **transform/opacity** (compositável), one-shot no mount, tudo **reduced-motion-gated**; `--i` clampado em JS e só nos ~10 primeiros itens → lista de 600 acts **nunca** ripple por segundos.
> `tsc` limpo · **320** testes (sem novos — mudança é estado default + CSS) · `vite build` ok · e2e `timetable.spec` (2) verdes após atualizar seletores velhos · screenshot de prova (1h + linhas) · deploy `--branch=master`.

### Current State (this batch)
- **Timetable no ar (v0.24.0):** default `zoom="1h"` (era `"2h"`); `.tt-grid` renderiza **incondicional** (linhas sempre visíveis); estado `showGrid` + botão `straighten` **removidos**. Barra de controles fica sem buraco: [zoom_out] [favoritos] [Lock in].
- **Animações de entrada:** keyframe `fp-rise` (opacity 0→1 + translateY(9px)→0, 260ms, `cubic-bezier(.22,1,.36,1)`, `backwards` p/ não flashar no delay); classe `.fp-rise` com `animation-delay: calc(var(--i)*26ms)`. Fade de conteúdo do sheet: `.sheet .sheet-body` usa `fp-fade` (300ms, delay 80ms) — segue o slide-up sem brigar com ele.
- **Onde aplicado:** Lineup `renderCard` (só `index<10` cascateia; resto monta instantâneo); Now `NowList` (lista "later"); My Plan `PlanSetRow`/`PlanGapRow` (`--i` clampado a 11). Toggle de favorito move o card entre as grids → re-monta → "pop" agradável (sem custo).
- **Acessibilidade/perf:** todo o pacote sob `@media (prefers-reduced-motion: no-preference)` → quem pede menos movimento vê tudo instantâneo. Só transform/opacity (sem reflow). Zero libs.
- **E2E saneado:** `timetable.spec.js` referenciava `.tt-toggle`/"Only my favs"/`.poster "Lineup"` (velhos do header pré-redesign) → atualizado p/ ícones atuais (`getByRole`), assert de `.tt-grid` visível, e zoom 1h→2h agora **estreita** a grid (`toBeLessThan`).

### Escopo (arquivos)
- **Editados:** `routes/TimetableScreen.tsx` (default 1h, remove `showGrid`+botão, `.tt-grid` incondicional), `routes/LineupScreen.tsx` (`renderCard` index + `.fp-rise`), `routes/NowScreen.tsx` (`CSSProperties` + stagger na lista later), `routes/MyPlanScreen.tsx` (`CSSProperties` + `i` em `PlanSetRow`/`PlanGapRow`), `styles.css` (`@keyframes fp-rise` + `.fp-rise` + `.sheet .sheet-body` fade, reduced-motion-gated), `e2e/timetable.spec.js` (seletores atuais), `data/changelog.ts` + `web/package.json` (**0.24.0**).

---

## Native polish 4/7 26/06 — pull-to-refresh + polish de scroll ✅ DEPLOYED — v0.23.0

> Gesto-músculo de app real: **puxar pra baixo** do topo do Lineup / Now / Squad home **atualiza os dados**, com buzz no gatilho e spinner nativo.
> Conselho inline (Architect/Performance/Critic/Advocate): componente **auto-contido** `<PullToRefresh onRefresh>` que acha o scroller compartilhado via
> `closest('.scr')` e renderiza **só o indicador** — nunca transforma o conteúdo (quebraria o `position:fixed` do view-switch dock; mesma restrição do fade).
> `preventDefault` **cirúrgico**: só quando o pull é "dono" do gesto (1 dedo, `scrollTop<=0`, puxando pra baixo) → scroll normal e a **pinça de 2 dedos** do Lineup intactos.
> `tsc` limpo · **320** testes (+12: 8 math rubber-band/threshold + 4 DOM de gesto provando que pull curto/scrollado não dispara e scroll-up não é bloqueado) · build ok · deploy `--branch=master`.

### Current State (this batch)
- **Pull-to-refresh no ar (v0.23.0)** em **Lineup, Now e Squad home** (os 3 scrollers verticais de 1 dedo no `.scr`). **Fora**: Timetable (scroll interno `.tt-scroll` + pinça + altura cheia) e Map (`absolute` full-bleed) — lá PTR vira bug, não feature.
- **Encaixe (decisão Architect):** o `.scr` é remontado por rota (`key={pathname}`), então PTR não pode morar no layout com ref fixo nem virar 2º scroller (aninhado). O componente acha o `.scr` via `closest`, anexa listeners de toque a ele e o `useEffect` re-anexa a cada mount.
- **Indicador-only (Performance):** transladar **só** o spinner (transform/opacity compositáveis), nunca o conteúdo → preserva o dock `fixed` e evita reflow. Sem libs (0 bytes).
- **Guardas (Critic):** armar só com 1 dedo em `scrollTop<=0`; lock durante `refreshing`; rubber-band com gatilho a 64px; `haptic("select")` no cruzamento + `haptic("light")` ao disparar; **min-spin 600ms** para o reload silencioso do lineup ler como refresh real.
- **Refresh real:** Lineup/Now = `useLineup.reload()` (revalida em background); Squad home = fan-out de `reloadMembers/Points/Safety/Presence/Board + onChanged`.
- **Polish de scroll:** `overscroll-behavior: contain` no `.scr` e no `.tt-scroll` → fling não encadeia pro body. Reduced-motion: spinner sem rotação infinita e sem transição de snap-back.
- **Lógica pura testável:** `lib/pullToRefresh.ts` (`resistPull`/`shouldTrigger`/`pullProgress`/`pullRotation`) separada da UI (`ui/PullToRefresh.tsx`).

### Escopo (arquivos)
- **Novos:** `lib/pullToRefresh.ts` (+ `.test.ts`, 8 math), `ui/PullToRefresh.tsx` (+ `.test.tsx`, 4 DOM).
- **Editados:** `routes/LineupScreen.tsx` + `routes/NowScreen.tsx` (2 returns) + `routes/SquadScreen.tsx` (captura `reload` dos hooks + `refreshAll`), `styles.css` (`.ptr` + `@keyframes ptr-spin` reduced-motion-gated + `overscroll-behavior: contain` em `.scr`/`.tt-scroll`), `data/changelog.ts` + `web/package.json` (**0.23.0**).

---

## Native polish 3/7 26/06 — transição de tela + skeleton em grid ✅ DEPLOYED — v0.22.0

> O "A": telas deixam de **cortar seco** e passam a **fade-in** na navegação; cada tela abre no topo. Conselho rápido (Architect+Critic):
> achado que **skeletons já existem** (`LoadingState` shimmer em TODAS as telas via `status==='loading'`; zero spinner) e o lineup é **cacheado**
> (`useSyncExternalStore`, abas instantâneas) → a transição com remount **não** flasha skeleton. Decisão técnica crítica: **opacity-only** —
> `transform` deixaria containing-block (`translate(0)` ≠ `none`) e quebraria `position:fixed` (dock do view-switch, scrims, ArtistSheet) dentro do `.scr`.
> `tsc` limpo · **308** testes · `vite build` ok · e2e de navegação (shell+timetable) verdes · deploy `--branch=master` (deploy único: inclui também o fix 0.21.1).

### Current State (this batch)
- **Transição de tela no ar (v0.22.0).** `.scr` (container de scroll) é **re-keyado por pathname** nos dois layouts (`AppLayout`/`StackLayout`) → cada navegação **re-anima** a entrada (`.route-fade`, opacity 0→1, 200ms, `cubic-bezier(.2,.8,.2,1)`) e **reseta o scroll pro topo** (bônus do remount). Antes era corte seco e o scroll às vezes "herdava" a posição.
- **Por que keyar o `<main>` e não um wrapper:** telas full-height (`.tt-screen`/`.lockin`/`.route`/mapa `position:absolute`) dependem da cadeia de `height:100%` a partir do `.scr`; um wrapper intermediário quebraria isso. Keyar o próprio `.scr` preserva a cadeia.
- **Skeleton content-shaped no Lineup:** `LoadingState` ganhou `variant: "list" | "grid"`; Lineup usa `grid` (6 cards `aspect-ratio 3/4`) — placeholder de cold-load que lembra o grid real, não barras genéricas. Demais telas seguem `list`.
- **Acessibilidade:** `.route-fade` só sob `@media (prefers-reduced-motion: no-preference)` → quem pede menos movimento tem corte instantâneo.
- **Adiado (escopo):** **UI otimista** (amplo/arriscado — toca mutações em todo lugar) fica para uma fase própria. Skeletons por-tela além do grid também adiados (genérico já cobre).
- **Tests:** web **308** unit (40 files; sem novos — mudança é layout/CSS) · `tsc` limpo · e2e shell+timetable verdes.

### Escopo (arquivos)
- **Editados:** `app/AppLayout.tsx` + `app/StackLayout.tsx` (`key={pathname}` + `.route-fade` no `<main>`), `ui/states.tsx` (`LoadingState` `variant`), `routes/LineupScreen.tsx` (`variant="grid"`), `styles.css` (`@keyframes route-fade-in` + `.route-fade` reduced-motion-gated + `.shimmer-grid`), `data/changelog.ts` + `web/package.json` (**0.22.0**).

---

## Fix 26/06 — haptic só em tap genuíno (não em scroll) ✅ DEPLOYED — v0.21.1

> Bug reportado: rolar/arrastar o dedo no Timetable/Lineup **já vibrava** (os cards são botões, e o delegate estava em `pointerdown`,
> que dispara no início do toque, inclusive num scroll). Conselho rápido (Architect+Critic): trocar o delegate de `pointerdown` → **`click`**
> — o browser só emite `click` num **tap confirmado** (down+up no mesmo alvo, sem virar scroll/arrasto), então zero falso-positivo ao rolar.
> Capture-phase mantido (roda antes dos handlers); `data-haptic`/disabled idênticos. `tsc` limpo · **308** testes (+1 regressão: `pointerdown` não vibra, `click` vibra).
> `navigator.vibrate()` substitui a vibração anterior → o "light" do delegate + `success` imperativo do lock-in colapsam em só "success" (sem buzz duplo perceptível).

### Escopo (arquivos)
- **Editados:** `lib/haptics.ts` (`pointerdown` → `click`, docstring), `lib/haptics.test.ts` (`tap` via `click` + teste de regressão), `data/changelog.ts` + `web/package.json` (**0.21.1**).

---

## Native polish 2/7 26/06 — toque tátil / micro-interações (press) ✅ DEPLOYED — v0.21.0

> O par **visual** do haptic da fase 1: todos os controles **afundam** ao toque e voltam com mola, e o atraso de ~300 ms do navegador some.
> Conselho rápido inline (Architect + Critic): **lista curada** (não `button` global, p/ não pisar transições ricas de `.gcard`/`.pick`), transição
> **superset** das props já animadas (transform additivo), tudo **dentro de `@media (prefers-reduced-motion: no-preference)`**. Loop inline, sem subagentes:
> `tsc --noEmit` limpo · `npm run test` **307** 0 falhas · `vite build` ok (bundle `index-frzunNtR.js` / css `index-CnREThSe.css`) ·
> **prova visual+computada** (harness `e2e/.output/press-shot.mjs`, desktop p/ `mouse.down` acionar `:active`): transform computado ao vivo =
> nav `matrix(0.88…)`, view-switch `0.965`, heart `0.8` (com `translateY(-50%)` preservado → `…,-13.5`), lock-in `0.965` · deploy `--branch=master`.

### Current State (this batch)
- **Press feedback no ar (v0.21.0).** CSS-only. Pareado com o buzz da fase 1, cada tap agora **afunda** o controle: CTAs/chips/opções/segs `scale(.965)`, **bottom-nav** `scale(.88)` (mergulha mais), **hearts** `scale(.8)` (aperto). `touch-action: manipulation` global nos controles mata o atraso de ~300 ms e o zoom de duplo-toque.
- **Acessibilidade:** todos os `:active{transform}` ficam sob `prefers-reduced-motion: no-preference` → quem pede menos movimento não vê o shrink (o tap ainda vibra). Botões `:disabled` não afundam.
- **Sem regressão de layout:** lista curada + transição superset (transform + background/border/color/box-shadow/opacity), `.gcard`/`.pick`/`.swipe-undo` (que já tinham `:active`) **intocados**; o heart do timetable preserva a centralização (`translateY(-50%) scale(.8)`).
- **Tests:** web **307** unit (40 files; sem novos — mudança é CSS) · `tsc` limpo · build OK (~546 KiB / 165 KiB gz). **Server não tocado.**

### Escopo (arquivos)
- **Editados:** `styles.css` (bloco "Native-feel press feedback" no fim: `touch-action` + transições + `:active` por controle), `data/changelog.ts` + `web/package.json` (**0.21.0**), `dev-log.md` (esta entrada + backfill v0.20.0).
- **Harness (gitignored):** `e2e/.output/press-shot.mjs`.

---

## Native polish 1/7 26/06 — haptics (vibração) ✅ DEPLOYED — v0.20.0  _(backfill)_

> Primeira fase do "feel like a real app". O app **responde ao toque** com vibração sutil. Conselho inline (Strategist/Architect/Critic/Advocate)
> → **híbrido**: delegate global de `pointerdown` dá um `light` em todo controle (`button`/`[role=button]`), com `data-haptic` p/ customizar (`select`,
> `medium`) ou desligar (`off`); e chamadas **imperativas** semânticas nos momentos de resultado (`success` no lock-in, `warning` no "I'm lost").
> Degrada com elegância: `canVibrate()` → no-op onde não há Web Vibration API (iOS Safari). Controle do usuário: toggle em Settings → Appearance (default ON).
> Commit `60c8c01` · deploy `--branch=master`. _(Entrada registrada retroativamente — o commit do feature não atualizou o dev-log.)_

### Current State (this batch)
- **Haptics no ar (v0.20.0).** `lib/haptics.ts` encapsula a Web Vibration API com padrões semânticos (`light/select/medium/heavy/success/warning/error`). `initHaptics()` (chamado no `main.tsx`) instala um delegate `pointerdown` em captura: todo `button`/`[role=button]` recebe `light` salvo `data-haptic` (custom/`off`).
- **Semântica imperativa:** `success` ao resolver clashes (`LockInScreen`), `warning` no broadcast "I'm lost" (`SafetyScreen`), `select` ao favoritar (Timetable/Lineup hearts), `medium` no Update do banner.
- **Controle + honestidade:** toggle "Haptic feedback" em Appearance (preview `success` ao ligar); mensagem honesta de que iPhones não vibram em web apps.
- **Tests:** web **307** unit (40 files; **+10** em `lib/haptics.test.ts`) · `tsc` limpo.

### Escopo (arquivos)
- **Novos:** `lib/haptics.ts` (+`.test.ts`).
- **Editados:** `main.tsx` (`initHaptics`), `app/settings.ts` (`useHaptics`/`hapticsEnabled`), `routes/settings/AppearanceScreen.tsx` (toggle), `routes/{TimetableScreen,LineupScreen}.tsx` (`data-haptic="select"`), `routes/lockin/LockInScreen.tsx` (`success`), `routes/meet/SafetyScreen.tsx` (`warning`), `app/UpdateBanner.tsx` (`medium`), `i18n/index.ts` (haptics.*), `data/changelog.ts` + `web/package.json` (**0.20.0**).

---

## PWA auto-updates 26/06 — descoberta automática + banner + força ✅ DEPLOYED — v0.19.0

> O app instalado passa a **procurar novas versões sozinho** e a oferecer a atualização sem o usuário ir nas configurações.
> Loop orquestrado inline, sem subagentes: `tsc --noEmit` limpo · `npm run test` **297** 0 falhas · `vite build` ok (~542 KiB / 163 KiB gz) ·
> screenshot headless do banner + botão (preview `:4180`) · commit `b4b6576` · deploy `--branch=master` → `festpilot.pages.dev` (bundle `index-BEC46TVO.js`
> verificado em produção: contém `0.19.0` + `fp:update-ready` + "New version available"; `sw.js?v=0.19.0` → 200).

### Current State (this batch)
- **Auto-update no ar (v0.19.0).** Antes só havia "Check for updates" manual (Settings → Offline); agora a descoberta é **proativa**: re-checa no launch, ao **voltar o foco** (`visibilitychange`), ao **reconectar** (`online`) e num **intervalo** (30 min). Dois gatilhos acendem o banner: worker **installed & waiting** OU o `index.html` publicado **não referenciar mais o bundle** desta aba (cobre sessões longas, onde a URL `?v=` do worker não muda).
- **Banner global proativo** (`app/UpdateBanner.tsx`, montado no `App`): barra dourada "New version available" + **Update** (uma tap) + **Dismiss**. Fica acima do shell (`z-index:90`) e **abaixo** do artist sheet (200).
- **Botão "Force update"** (Settings → Offline): `forceUpdate()` ativa o worker em espera (reload via `controllerchange`) **ou** faz reload de rede — garante o build mais novo mesmo quando o worker ainda não sinalizou.
- **Tests:** web **297** unit (39 files; **+4** em `app/registerSW.test.ts` p/ `forceUpdate` e o sinal `onUpdateReady`/`hasWaitingUpdate`) · `tsc` limpo. Server não tocado.

### Escopo (arquivos)
- **Novos:** `app/UpdateBanner.tsx`.
- **Editados:** `app/registerSW.ts` (`onUpdateReady`/`hasWaitingUpdate`/`forceUpdate` + `wireAutoUpdate` + `deployedDiffers`), `app/registerSW.test.ts` (+4), `App.tsx` (monta o banner), `routes/settings/OfflineScreen.tsx` (força), `i18n/index.ts` (EN+PT `update.bannerTitle/now/later/force/forcing`), `styles.css` (`.update-banner*`, `.link-btn`), `data/changelog.ts` + `web/package.json` (**0.19.0**).
- **Nota:** este commit (`b4b6576`) consolidou também o lote de feedback (v0.16–0.17) e o redesign do Squad (v0.18.0), que estavam não-commitados desde o v0.15.0.

---

## Squad redesign 26/06 — home content-first (Fases A+B+C) ✅ DEPLOYED — v0.18.0

> Redesign completo do Squad home seguindo `brain/wireframes/directions/20-amber-squad.html`, decidido por **conselho inline**
> (Strategist/Architect/Critic/Advocate → plano faseado A+B+C). Loop orquestrado inline, sem subagentes:
> `tsc --noEmit` limpo · `npm run test` **293** 0 falhas · `vite build` ok · screenshot headless com **grupo real semeado** (owner +
> 4 membros, presença por palco, meeting point, board) e **geolocalização do Playwright** · deploy `--branch=master` → `festpilot.pages.dev`.

### Current State (this batch)
- **Squad home reescrito "content-first"** e no ar (**v0.18.0**). As 3 perguntas da galera respondidas sem tap: **Where is everyone** (roster agrupado por palco + Ping all), **Meeting point com bússola ao vivo** (distância/direção reais + Go), **Pinned board** (últimas notas + Add note). Estados vazios calmos em cada card.
- **Paridade preservada (Fase C):** switcher de squads (tab-row), banner de SOS/safety, "Build the squad plan", "I'm lost", members + **invite movido pro topo-direito** (`person_add`, fiel ao wireframe; Settings segue no menu do avatar do Now & Next), Leave.
- **Tests:** web **293** unit (39 files; **+6** em `presence/presenceUi.test.ts` p/ `groupRosterByStage`) · `tsc` limpo · build OK (~538 KiB / 162 KiB gz). **Server não tocado.**
- **Verificação visual:** harness `e2e/.output/squad-shot.mjs` (gitignored) cria um squad descartável na API live (mesma técnica dos e2e), semeia presença em palcos reais (coords do `/map`), board e meeting point, **geolocaliza o browser ~120 m a NE do spot** e screenshota `/squad` (top+bottom) no preview local **e** em produção. Conferido: bússola mostra **"120 m · NE"** ao vivo, MAINSTAGE "· with you" com cluster JU/AN/TH, FREEDOM BY BUD + LU, "Location off" + RA.

### Reuso > código novo (Fase B = quase tudo reaproveitado)
- **Geo:** `domain/travel.ts` já tinha `metersBetween`/`bearingDegrees`/`compassPoint` → **zero helper novo**. Extraí `useHeading`/`useMyFix` da `MeetNavScreen` p/ **`lib/useGeo.ts`** (mesmo comportamento) e a MeetNav passou a importar de lá — agora compartilhados com o card da home.
- **Dados:** `useGroupPresence`, `useMeetingPoints`/`useSafety`, **`useBoard`** (já existia) reusados; cards são **apresentacionais** (dados descem por props; só sensores do device — GPS/compass — são lidos no card que de fato mostra distância).
- **UI:** `PresenceAvatar`, `.squad-live-stack`, `stageColor`, `formatMeters`/`closesInLabel`, `ago` reaproveitados.

### Fases (uma entrada por fase)
- **Fase A — cards content-first.** Novo `routes/squad/squadHomeCards.tsx` com `WhereEveryoneCard` (roster por palco, dots com cor do palco, "· with you", cluster de até 4 + "+N", **Ping all** que só aparece havendo alguém "pingável" e dispara `api.sendPing` nos stale/ghost com flash "Pinged"), `MeetingCompassCard` e `BoardPreviewCard` (top 3 notas, "Add note", `relativeTime` via `ago`). Cada um com empty-state navegável (role=button + teclado Enter/Espaço).
- **Fase B — bússola/distância ao vivo.** `MeetingCompassCard` usa `useMyFix`+`useHeading` (de `lib/useGeo`) e `metersBetween`/`bearingDegrees`/`compassPoint`; seta gira por `bearing − heading` (north-up sem bússola), degrada p/ "Locating…/Location off". Helper **puro** novo `groupRosterByStage` em `presenceUi.tsx` (palcos primeiro/mais cheios, depois between, venue, e "Location off" por último) + **6 testes** com casos concretos.
- **Fase C — ações + paridade.** Header `right` = **invite** (`person_add`); ordem nova: switcher → SOS → Where → Meeting(compass)/CTA "Set a meeting point" → demais points → "Set another" → Board → Plan → I'm lost → Members(+Invite) → Leave. **Decisão de escopo:** o switcher fica na **tab-row existente** (não no eyebrow) p/ **não** alterar a API compartilhada do `AppHeader` (string-only) — mesma função, risco menor.

### Escopo (arquivos)
- **Novos:** `lib/useGeo.ts`, `routes/squad/squadHomeCards.tsx`.
- **Editados:** `routes/SquadScreen.tsx` (GroupHome reorganizado; old "Where's the squad" CTA e `liveMembers/whereSub` removidos), `routes/presence/presenceUi.tsx`(+`.test.ts`), `routes/meet/MeetNavScreen.tsx` (importa os hooks extraídos), `styles.css` (cards/compass/where rows/board preview), `data/changelog.ts` + `web/package.json` (**0.18.0**).

---

## Pós-V9 26/06 — Correções de feedback + novos controles ✅ DEPLOYED — v0.17.0

> Feedback do usuário após o shell V9, em **2 change sets orquestrados** (inline, sem subagentes). Cada um fechou em
> `tsc --noEmit` limpo · `npm run test` **288** 0 falhas · `vite build` ok · screenshot headless conferido (preview local
> `:4173`, app servido do `dist` + dados da API live) · deploy `--branch=master` → `festpilot.pages.dev`.

### Current State (this batch)
- **6 itens fechados e no ar** (2 deploys): **ícone das linhas**, **Lineup por fim de semana**, **ArtistSheet (imagem instantânea + sem pulo do fundo)**, **Settings → Festival & weekend**, **pinch-to-zoom**. Versão consolidada **v0.17.0** (`package.json` + `APP_VERSION` + entrada de changelog).
- **Tests:** web **288** unit (39 files; +3 em `domain/lineup.test.ts` p/ `performancesForWeekends`) · `tsc` limpo · build OK (~531 KiB / 160 KiB gz). Server não tocado.
- **Verificação visual:** preview local serve o `dist` novo e a API cai no worker de prod (`API_BASE` default). Conferidos: header do TT com o ícone `straighten` (linhas on/âmbar), ArtistSheet (foto idêntica à do card, fundo parado), **prova do escopo W2** (favoritos 10→2, sheet só com o slot da W2), Settings (linha "Festival & weekend") e a tela `/settings/festival` (W1 selecionado → dias Jul 17/18/19).

### Change set 1 — fixes (ícone + Lineup/semana + ArtistSheet) ✅ DEPLOYED
- **Ícone das linhas de horário (conselho inline).** `grid_on` passava ideia de "modo grade"; trocado por **`straighten`** (régua = marcações ao longo do eixo de tempo). `aria-label` dinâmico ("Show/Hide hour lines"), `title="Hour lines"`. *Arquivo:* `routes/TimetableScreen.tsx`.
- **Lineup respeita o(s) fim(ns) de semana do onboarding (DEC-048).** Novo helper **puro** `performancesForWeekends(perfs, weekendIds)` em `domain/lineup.ts` (vazio = todos; mantém perfs sem `weekendId`); `daysForWeekends` refatorado p/ usá-lo. `LineupScreen` e `ArtistSheetProvider` (`useArtistSheet`) agora lêem `onboarding.weekendIds` e escopam **performances → dias, acts, favoritos e os slots do sheet**. *Antes:* W2 via acts/dias/slots da W1 (ex.: domingo mostrava 36 "favoritos" da W1). *Arquivos:* `domain/lineup.ts`(+`.test.ts` +3), `lib/festival.ts`, `routes/LineupScreen.tsx`, `ui/useArtistSheet.ts`.
- **ArtistSheet — imagem instantânea.** Hero passou de `PHOTO_WIDTH.detail` (560) p/ `PHOTO_WIDTH.grid` (220) → reaproveita o cache da foto do card tocado (mesmo `?width=`); `KEEP_WIDTHS` do offline alinhado p/ `grid` e a largura morta `detail` removida do mapa. *Arquivos:* `ui/ArtistSheet.tsx`, `lib/usePhotoPrefetch.ts`, `lib/photo.ts`.
- **ArtistSheet — fim do "pulo" do fundo.** `closeRef.focus({ preventScroll:true })` evita o browser rolar o timetable atrás ao abrir o sheet. *Arquivo:* `ui/ArtistSheet.tsx`.

### Change set 2 — novos controles (settings de semana + pinch) ✅ DEPLOYED
- **Settings → Festival & weekend (trocar a escolha pós-onboarding).** Nova tela `routes/settings/FestivalScreen.tsx` (rota `settings/festival`) + linha em `SettingsScreen` (ícone `festival`). Reusa o padrão `.opt` do onboarding: escolhe W1/W2/Both e os dias; **aplica na hora** (como Appearance) com flash "Saved", recomputa `dayKeys` ao trocar de semana e preserva `seenActKeys`. i18n EN+PT (`settings.festival*`, `festival.*`). *Arquivos:* novo `FestivalScreen.tsx`, `SettingsScreen.tsx`, `App.tsx`, `i18n/index.ts`, `styles.css` (`.save-flash`).
- **Pinch-to-zoom.** Novo hook `lib/usePinch.ts` (gesto de 2 dedos discreto e multi-step; **callback ref** p/ anexar quando o conteúdo monta após o load; `preventDefault` só no gesto de 2 dedos). **Timetable**: spread→`1h` / pinch→`2h`. **Lineup**: spread→menos colunas / pinch→mais (clamp 2–4). *Arquivos:* novo `usePinch.ts`, `routes/TimetableScreen.tsx`, `routes/LineupScreen.tsx`.

### Pendente (planejamento, sem código neste lote)
- ~~**Squad redesign → `brain/wireframes/directions/20-amber-squad.html`**~~ — **✅ FEITO** no lote abaixo "Squad redesign 26/06" (v0.18.0).

---

## Lote de Skin 26/06 — ICON / TT / LU / DAY / SH (orquestrado por `brain/design-sync.md`) ✅ DEPLOYED (DEC-066)

> Os 5 gates de redesign do `design-sync.md` aplicados, testados e **publicados** no Cloudflare Pages (um deploy por gate).
> Loop inline, sem subagentes. Cada gate fechou em: `tsc --noEmit` + `npm run -w web test` 0 falhas · `vite build` ok ·
> screenshot headless bate com o alvo (N6/L5/V8/V9) · `git diff --stat` só os arquivos do gate · tabela de Status atualizada.

### Current State (this batch)
- **5 gates fechados ✅ e no ar** — **ICON** (Lock-in `lock`→`playlist_add_check`), **TT** (cápsula color-glass + foto círculo 56px + estado live + ★/palco + heart), **LU** (grid de cards imersivos + densidade 2/3/4 col persistida), **DAY** (`DayDropdown` + `countFavoritesPerDay` puro/testado, remove as pills), **SH** (shell unificado: `ViewSwitch` em dock flutuante + eyebrow espelhado + respiro).
- **Tests:** web **285** unit (39 files; +9 em `lib/festival.test.ts` — 6 originais restaurados + DAY-2/DAY-1) · `tsc --noEmit` limpo · `vite build` OK (~524 KiB / 158 KiB gz). Server **não tocado** neste lote.
- **Verificação visual:** Playwright headless (`web/e2e/.output/skin-shot.mjs`, gitignored) semeia onboarding completo + 10 favoritos reais (via API live) em 390×844 e screenshota cada deploy. Conferidos: N6 (cápsulas/fotos/★/hearts), L5 (grid 2 e 4 col), V8 (dropdown aberto: Day N · dia · data · ★/dia · check), V9 (eyebrow espelhado + dock idêntico nas duas telas).
- **Deploy:** publicado a cada gate em `festpilot.pages.dev`; consolidado em **v0.16.0** e refinado para o V9 em **v0.16.1** (ver "Refino V9 26/06"). Branch de produção do projeto Pages é **`master`** (não `main`) — deploys vão para `--branch=master`. A bottom-nav (5 tabs) segue acima do dock (z-index) e acessível.
- **Escopo (só estes arquivos):** `routes/TimetableScreen.tsx`, `routes/LineupScreen.tsx`, `styles.css`, `lib/festival.ts`(+`.test.ts`), **novo** `ui/DayDropdown.tsx`, `brain/design-sync.md` (Status) + `decision-log.md`/`dev-log.md` (registro). O WIP **pré-existente do DEC-065** segue não-tocado.

### Gates (uma entrada por gate)

- **ICON ✅ (DEC-066.2)** — *Feito:* glifo do "Lock in" `lock`→`playlist_add_check` (rótulo "Lock in" intacto, DEC-005). *Arquivo:* `routes/TimetableScreen.tsx`. *Regressão:* navegação `/lockin` e estado de dia inalterados.

- **TT ✅ (DEC-066 / N6)** — *Feito:* TT-1 `.set` vira cápsula color-glass (`border-radius:999px`, tint `rgba(var(--c)…)`, blur); TT-2 `.photo` círculo 56px (gradiente do palco + iniciais com gloss; foto real quando existe); TT-3 estado `live` (anel degradê mascarado via `::before`); TT-4 ★ contagem de favoritos por palco (`.stage-name .ct`); TT-5 `EDGE=9px` descola **só** o card colado ao início da janela (`set.startMs === windowStartMs`) sem mexer na grade (encolhe a largura); TT-6 heart branco + fav fino. *Arquivos:* `styles.css`, `routes/TimetableScreen.tsx`. *INVARIANTE respeitada:* `set-inner` sticky e a math de `domain/timetable.ts` **intactas** (mudou só apresentação + leitura de `isFav`/`isLive`).

- **LU ✅ (DEC-066 / L5)** — *Feito:* LU-1 `renderRow`→`renderCard`: cards-pôster (`aspect-ratio:3/4`, gradiente do palco, `ArtistPhoto className="gc-photo"` full-bleed `width=grid`, scrim + nome Oswald + chip `STAGE · day`, heart **separado** do alvo que abre o ArtistSheet — INVARIANTE ART-6); LU-2 densidade 2/3/4 col com segmented control ancorado à direita do **1º** `.sec` visível, persistido em `localStorage` (`fp.lineup.cols`, self-contained na tela). *Arquivos:* `routes/LineupScreen.tsx`, `styles.css`. *Regressão:* chrome (busca/filtros) inalterado; favoritar nunca abre o sheet.

- **DAY ✅ (DEC-066.3 / V8)** — *Feito:* DAY-1 novo `ui/DayDropdown.tsx` (gatilho compacto `📅 {wd} {dia} ▾` + painel vertical: `Day N` · dia-da-semana · data · ★/dia · check; fecha em backdrop/Esc/seleção; a11y `aria-haspopup`/`role="listbox"`/`role="option"`); DAY-2 `countFavoritesPerDay` **puro** em `lib/festival.ts` (act em 2 dias = 1 em cada; mesmo act 2× no dia = 1; dia sem fav ausente do mapa) + **7 testes** com números concretos; `dayOfMonth` **movido** do `TimetableScreen` p/ `lib/festival.ts` (reuso, não duplica) + 2 testes; DAY-3 header passa a usar o dropdown e **remove** as pills `.tt-days/.tt-day` (CSS órfão removido). *Regressão:* trocar de dia continua chamando `onSelectDay` → `model` recalcula igual; **sem** mudança de domínio; 6 testes originais de `festival.test.ts` restaurados.

- **SH ✅ (DEC-066.1 / V9)** — *Feito:* SH-1 `ViewSwitch` sai dos dois headers e vira **dock fixo** (`.view-switch-dock`, `position:fixed`, centralizado, `bottom:calc(78px+safe)`, z **acima** do conteúdo e **abaixo** da bottom-nav que ganhou `z-index:20`) — só quando `dataState==="timetable"`, **componente inalterado**; SH-2 **eyebrow espelhado** (`.shell-eyebrow`: `{festival.name}` + view em accent/Oswald) nas duas telas, substituindo o `h1 "Timetable"` e o `h1 "Lineup"`+badge de contagem (convergência ao V9); SH-3 respiro: `padding-bottom` no `.tt-content` e no `.screen.has-view-dock` p/ a última linha rolar acima do dock. *Arquivos:* ambos os screens, `styles.css`. *Decisão de escopo:* a densidade do Lineup **fica no `.sec`** (como o LU-2 definiu), não foi movida pro header; o badge "X favorites" do header do Lineup foi **removido** p/ espelhar o V9 (contagem segue no filtro Favorites e em My Plan). *Regressão:* alternar Timetable↔Lineup não move o switch; bottom-nav acessível; ArtistSheet (z-40) ainda cobre tudo.

### Refino V9 26/06 (pixel sign-off do shell) ✅ DEPLOYED — v0.16.1

> Dois ajustes finos após comparar produção × V9 (`brain/wireframes/unified-shell-v2/V9-final-shell.html`). `tsc` limpo · **285** unit ok · build ok · medição headless confirma · deploy `master` (`festpilot.pages.dev`).

- **Barra de contexto do Timetable → estrutura exata do V9.** Antes o dia ficava numa linha (`.tt-day-row`) e os controles numa **2ª linha** separada (`.tt-controls`, pills de texto "2h view / Only my favs / Grid / Lock in"). Agora tudo numa **única barra** `.tt-bar` = `[DayDropdown] … [ícones] [Lock in]`: os 3 controles secundários viram **botões-ícone compactos** `.tt-ic` (zoom_in/zoom_out · favorite · grid_on — funções reais; o "search" do mock é placeholder e não existe no TT) empurrados à direita (`margin-left:auto`), e o **Lock in** vira `.tt-lk` (gradiente, **com texto** — invariante "Lock in nunca corta"). `TimetableHeader` ganhou prop opcional `controls?: JSX.Element` (composição, sem inchar props). Bloco `.tt-controls/.tt-controls-left/.tt-toggle/.tt-lockin` e `.tt-day-row` removidos (CSS órfão limpo).
- **Sobrancelha pixel-idêntica nas duas telas (fim do "pulo" ao trocar).** Igualados o offset de topo e o inset: `.tt-top` → `padding: calc(8px+safe) 16px 8px; gap:12` e o `.screen` do Lineup → `paddingTop: calc(8px+safe)` + `paddingInline:16` (alinha ao inset 16 do TT/V9, isolado na tela, sem mexer no `.screen` global). **Medição headless** (`e2e/.output/measure.mjs`, gitignored): ambos `top=8 · left=16 · bottom=20 · gap=12` → zero deslocamento vertical **e** horizontal ao alternar Timetable↔Lineup.
- *Arquivos:* `routes/TimetableScreen.tsx`, `routes/LineupScreen.tsx`, `styles.css`, `web/package.json` (→ **0.16.1**). *Regressão:* zoom/favs/grid/Lock-in mantêm `onClick`/estado/`aria`; densidade do Lineup e grid intactos (só deslocam 2px junto); 285 testes seguem verdes.

---

## Lote de Campo 25/06 — IMG / OBV / ART (orquestrado por `brain/design-sync.md`) ✅

> Loop + INVARIANTES + gates em `brain/design-sync.md`. Inline, sem subagentes (constituição de custo).
> Um change set por vez; o gate fecha em: tsc + `npm run test` (web **e** server) 0 falhas · build ok ·
> golden path · screenshot bate com o alvo · `git diff --stat` só os arquivos do gate · tabela de Status atualizada.

### Current State (this batch)
- **3 gates fechados ✅** — **IMG** (fotos: anti-corrida + buffer + cache + favoritos offline), **OBV** (onboarding Safari/iPhone: nome sempre visível), **ART** (Artist Detail Sheet + socials).
- **Tests:** web **276** unit (39 files) · server **215** unit (23 files) · ambos `tsc --noEmit` limpos · web `vite build` OK · server `wrangler deploy --dry-run` OK (208 KiB).
- **Verificação visual:** Playwright headless contra o `dist` (preview :4174) — o Node (com rede) busca o lineup live e o Playwright intercepta `**/api/**` (o Chromium do sandbox não tem egress). Golden path + as 4 superfícies de toque; screenshots lidos e conferidos.
- **Deploy:** **NÃO** publicado neste lote (mudança de código). O worker em produção ainda **não foi re-ingerido**, então a coluna `socials` fica vazia em prod até o próximo ingest (DEC-069).
- **Escopo:** apenas arquivos de IMG/OBV/ART foram tocados. O WIP **pré-existente do DEC-065** (editor de POI/travel/mapa + consumidores: `admin.ts`, `routes.ts`, `poiRepo.ts`, `travelTimeRepo.ts`, `api.ts`, `usePois.ts`, `useTravelMatrix.ts`, `travel.ts`, `MapView.tsx`, `poiMeta.ts`) **não foi tocado** e segue não-commitado na árvore.

### Gates (uma entrada por gate)

- **IMG ✅ (DEC-067)** — *Feito:* IMG-1 `<ArtistPhoto>` à prova de corrida (reseta `loaded`/`failed` ao mudar `src`/`name` → foto nunca pinta sob o nome errado) + IMG-6 retry/backoff + diagnóstico; IMG-2 `lib/photoBuffer.ts` (fila **pura**, testada) + IMG-3 `usePhotoPrefetch` (5 fotos à frente no swipe); IMG-4 cache dedicado de fotos no `public/sw.js` com **teto LRU**; IMG-5 `useKeepFavoritePhotos` (montado no `AppLayout`) fixa as fotos dos favoritos **isentas do LRU**. *Arquivos:* `ui/ArtistPhoto.tsx`, `lib/photoBuffer.ts`(+test), `lib/usePhotoPrefetch.ts`, `public/sw.js`, `app/AppLayout.tsx`, `styles.css`. *Testes:* +`photoBuffer` (6). *Regressão verificada:* API pública do `<ArtistPhoto>` `{src,name,width,className}` e o fallback de iniciais **intactos**; cache network-first `/api` do SW **preservado**; nenhuma math de domínio mudou.

- **OBV ✅ (DEC-068)** — *Feito:* OBV-1 card do swipe escala pela **altura** disponível; OBV-2 cabeçalho do swipe compacta em viewport baixa; OBV-3 passo do swipe `overflow:hidden` (o **grid** continua rolando); OBV-4 nome do artista **clamped e sempre visível** com o toggle de favorito preservado. *Arquivos:* `routes/onboarding/OnboardingScreen.tsx`, `styles.css` (CSS-only + layout). *Regressão verificada:* grid ainda rola; toggle de favorito intacto; nome visível em viewport curta iPhone/Safari (screenshots do segmento anterior).

- **ART ✅ (DEC-069; ART-7 → DEC-070 pendente)** — *Feito:* **servidor** ART-1 `SourceArtist` ganha socials; ART-2 `normalize` preserva via `pickSocials` **puro** (data-driven sobre `ARTIST_SOCIAL_KEYS`); ART-3 migração **aditiva** `0014_artist_socials.sql` (`socials TEXT` default NULL) + `ingest/store.ts` grava JSON + `ArtistDto.socials?` + `repo.parseSocials`. **web** ART-4 `ArtistSocials` espelhado + `Act.socials` propagado por `uniqueActs` (first-non-empty) + `buildArtistDetail` **puro** (cada show = dot da cor do palco + dia/data + início–fim na tz; tag W1/W2 só quando cruza os 2 fins de semana); ART-5 `ArtistSheet` (`role="dialog"`, foco gerido, Esc) + CSS (hero, glifos SVG dos socials, slots); ART-6 wire dos toques — Timetable `.set-inner` (heart segue separado), Lineup foto+info viram `<button>` (heart separado), Now hero/lista, My Plan corpo do card (edição movida pro `⋮`), via `ArtistSheetProvider` no `AppLayout` + helper `openOnActivate`. ART-7 **não implementado** (gênero/bio ausentes na fonte → DEC-070). *Testes:* server `pickSocials` + `normalize` (Afrojack 8 socials) + d1 round-trip de socials; web `buildArtistDetail` (horários concretos: Sun Jul 19 22:00–23:00, etc.) + `uniqueActs` socials. *Golden path (Playwright):* Timetable → trocar dia (Sáb 18) → favoritar um set (`Add`→`Remove`, **sem** abrir o sheet) → Lineup → buscar "Afrojack" → abrir o ArtistSheet com **2 slots** (THE GREAT LIBRARY · W1 · Sun Jul 19 22:00–23:00 · MAINSTAGE · W2 · Sun Jul 26 19:40–20:40). Also: hero do Now e card do My Plan abrem o sheet; o `⋮` do My Plan abre o menu de edição **sem** abrir o sheet. *Regressão verificada:* math de domínio (`actKey`/`uniqueActs`/`imageByActKey`/janelas) e API do `<ArtistPhoto>` **intactas**; favoritar **nunca** abre o sheet (`sheetOpenedByHeart=false`); migração aditiva + ingestão idempotente (`festivals.test` re-ingest = no_changes); edição do My Plan ainda acessível (`editMenuFromMoreVert=true`, `editDidNotOpenArtistSheet=true`).

---

## Review-Remediation Pass (2026-06-24) — ACTIVE

> Execution truth: `brain/documents/2026-06-24-v1-review-remediation-orchestrator.md`. Order: R0→R11 (P0 first,
> then P1, then Admin). Commit per fix; deploy + dev-log per gate. Autonomy: never stop to ask to advance (DEC-056).

### Current State (this pass)
- **Gate:** **R11.1c REOPENED + DONE ✅ — deployed + live (v0.14.0).** DEC-062's deferral was reversed (DEC-063) once a
  **headless Playwright** screenshot loop proved visual verification works in this env. Shipped the two consumed slices:
  **festival onboarding & management** (add a festival live from its official page · per-festival + bulk re-import · edit
  name/timezone — commit 260ebf7) and the **map editor** (R2 base upload · georeference via ≥3 control points → ported
  least-squares `fitAffine`/`residual` → 6-coeff affine + pixel-error readout · stage coordinate placement numeric or
  click-the-map · live `geoToSvg` preview · saves the `MapTransformDoc` with revision auto-bump — commit e7a41c0).
  **Still deferred → V1.1 (DEC-064): POI editor + travel-time matrix** — their tables (`poi`, `stage_travel_time`) have **no
  client consumer** today, so an editor would be a dead surface. Map **ART** generation stays the local Node spike (a Worker
  can't render the cartography). Earlier R11.0–R11.5 (admin shell, overview, lineup dashboard, data-source registry,
  suggestions, metrics+runway, test console) remain closed (v0.13.0).
- **Admin backend (R11):** one Hono sub-app `server/src/api/admin.ts` mounted under `/admin`, **fail-closed** behind
  `requireAdmin` (`x-admin-token` === `ADMIN_TOKEN` secret — already set in prod). New repos: `dataSource.ts` (festival data
  origin + capture method, falls back to operational `lineup_source`), `runway.ts` (**pure**, unit-tested free-tier estimator —
  Workers 100k req/day, D1 5M reads / 100k writes / 5GB, R2 10GB + 1M/10M ops; cumulative vs daily), `metricsRepo.ts` (real
  users excl. `is_test`, country + last-seen, R2 bytes from `media_object` ledger, `me_touch` activity, orchestrates runway),
  `testConsole.ts` (spawn `is_test=1` member → add to group → `injectStageFix` via the **real** `recordFix` pipeline → live on
  the map → `purgeTestData` deletes every test entity FK-safe). `me.get` records a fire-and-forget `me_touch` daily counter.
- **Honesty invariant held:** metrics show **only first-party measured** data; platform figures that need the CF Analytics
  token are surfaced as **`locked` services**, never fabricated. Synthetic members carry `isTest` end-to-end
  (`PresenceMemberDto` → `WhereScreen` shows a small **`test`** badge); purge leaves real members intact.
- **Admin frontend (R11):** desktop shell `web/src/admin/` — `AdminLayout` nav, `adminApi.ts` client, new screens
  `AdminDataSourceScreen` / `AdminMetricsScreen` (KPI + runway cards + locked-services + demographics) /
  `AdminTestConsoleScreen`. Routes `/admin/data-sources`, `/admin/metrics`, `/admin/test-console`. **No dead affordances** (no
  nav entry for the deferred R11.1c screens).
- **DB:** remote migrations **0012** (`festival_data_source`) + **0013** (`app_user.is_test` + `usage_counter`) **applied to
  prod D1**. Migrations through **0013** now applied.
- **Tests now:** typecheck clean (server + web) · **server 197 + web 259 unit** pass (+14 server festival routes, +6 web
  affine/transform) · build OK · **production map-editor smoke green** (Playwright on `festpilot.pages.dev`: editor loads,
  base raster + 10 stage pins render, control-point tool drops a marker + table row, **zero console/page errors**).
- **Deployed:** **Worker Version `57b3f511-9add-487d-a8e7-8efbbdc447b1`** (festival onboarding + multi-festival ingest + map
  routes: `GET /admin/festivals/:id/map`, `POST .../map-asset` R2 upload, revision auto-bump on `POST .../map`).
  **Pages Production (branch `master`)** serves **`index-BDQM8Uev.js`** (v0.14.0) — verified on the production domain.
- **Baseline (2026-06-24, pre-pass):** server 121 + web 147 unit. Live D1 `e6753623-2b4e-41ce-9725-4bd417966cfa`. R2 bucket
  `festpilot-media` live.
- Live URLs: app https://festpilot.pages.dev (v0.14.0) · API https://festpilot.trippilot.workers.dev (Worker `57b3f511`, R2 + admin).

### Gate checklist
- [x] **R0** — Setup: nvm22, baseline green, DEC-048..061 verified in decision-log, dev-log seeded, commit.
- [x] **R1** (P0 data/logic) — festival-day blocks (DEC-048) · clash anchor-overlap (headline) · artist photo re-ingest (DEC-061). **CLOSED 2026-06-24.**
- [x] **R2** (P0 map) — pan clamp + safe-area · interactive vector stage overlay (DEC-050) · real presence + out-of-venue (DEC-051) · meeting picker zoom. **CLOSED 2026-06-24 (v0.8.2).**
- [x] **R3** (P0 perf) — shared lineup cache (stale-while-revalidate; instant tab switch). **CLOSED 2026-06-24.**
- [x] **R4** (P0 nav/data-states) — hasLineup/hasTimetable (DEC-052) · discoverable Lineup (DEC-049) · dynamic days + revisit-favorites · suggest-a-festival (DEC-055). **CLOSED 2026-06-24 (v0.9.0). ← all P0 (R0–R4) done.**
- [x] **R5** (P1 favorites) — identity name+email (DEC-060) · real swipe · grid mode · per-day grouping · artist photos everywhere (DEC-061). **CLOSED 2026-06-24 (v0.10.0).**
- [x] **R6** (P1 now/next) — plan-then-favorites, never arbitrary (DEC-022). **CLOSED 2026-06-24 (v0.10.1).**
- [x] **R7** (P1 timetable polish) — card recipe · gridlines · touching-card margin · compact top bar. **CLOSED 2026-06-24 (v0.10.2).**
- [x] **R8** (P1 my-plan) — editable timeline (swap/remove/add) keeping zero-overlap. **CLOSED 2026-06-24 (v0.10.3).**
- [x] **R9** (P1 squad) — multiple squads · honest copy · AI-icon/J-menu · auto-share (DEC-054) · avatar on R2 + custom emoji (DEC-059) · real mini-map · richer meeting card + meeting photo on R2 (DEC-047) · squad-home density. **CLOSED 2026-06-24 (v0.11.0).**
- [x] **R10** (P1 settings/polish) — i18n EN/PT · PWA install · check-updates · About · contrast + no-select. **CLOSED 2026-06-24 (v0.12.0). ← all P1 (R5–R10) done.**
- [x] **R11** (Admin, DEC-057) — auth+shell · festivals overview · lineup/timetable dashboard · data-source registry · suggestions inbox · usage metrics + runway · live test console. **CLOSED 2026-06-24 (v0.13.0).**
- [x] **R11.1c REOPENED** (DEC-063/064) — **festival onboarding & management** (add live from official page · re-import one/all · edit name/tz) + **map editor** (R2 base upload · georeference affine · stage placement · live preview · save MapTransformDoc). **POI editor + travel-matrix still deferred → V1.1 (DEC-064, no client consumer).** **CLOSED 2026-06-24 (v0.14.0), verified live via Playwright.**

### Pass log (most recent first)
- **R11.1c REOPENED + CLOSED ✅ (2026-06-24) — deployed + live (v0.14.0).** Julio reversed the DEC-062 deferral ("hoje ainda
  não dá para adicionar e gerenciar festivais novos") and asked for a **complete, well-functioning admin** for festivals + the
  map tools, verified with a real browser. **Verification loop:** the `plugin-browse-browser` daemon wouldn't start in this
  WSL env, so we used **headless Playwright** screenshot scripts (`web/scripts/admin-*-verify.mjs`) — the same engine already
  green for e2e — proving visual verification works without a display. Recorded **DEC-063** (reverse DEC-062; reuse the
  parametric ingest) + **DEC-064** (build only what the app consumes: base+affine+stages; defer POI/travel; ART stays the
  local spike).
  **Slice 1 — festival onboarding & management (commit 260ebf7):** new `server/src/ingest/festivals.ts` — "add a festival" =
  register its official page + run the **existing parametric `ingest()`** (resolve ref → CDN JSON → normalize → diff → upsert);
  **no new scraper, no hardcoded lineup** (DEC-009/061). `readOnboardInput`/`readMetaPatch`/`normalizeSlug`/`isValidTimezone`
  (pure, unit-tested), `festivalSlugExists`, `updateFestivalMeta`, `listIngestTargets` (latest active source per festival via
  correlated subquery), `ingestAllFestivals` (cron + "re-import all"; falls back to the env-seed only while the registry is
  empty). Routes: `POST /admin/festivals` (409 dup slug · 502 honest "couldn't resolve a lineup"), `PATCH /admin/festivals/:id`,
  `POST /admin/festivals/:id/ingest`, `POST /admin/ingest` → all festivals; `scheduled` now ingests all. Web: refactored
  `AdminFestivalsScreen` (Add-festival form w/ live slug preview + advanced saved-ref · per-row Re-import/Edit/Map · banners),
  `adminApi` surfaces server `{error}` messages; `AdminLineupScreen` re-import targets the viewed festival.
  **Slice 2 — map editor (commit e7a41c0):** ported the proven **`fitAffine`/`residual`** least-squares solver into
  `web/src/map/transform.ts` (+6 unit: exact recovery · residual-on-noise · min-3-points); `server/src/media/store.ts`
  `MAX_MAP_BASE_BYTES` (4 MB); routes `GET /admin/festivals/:id/map` + `POST .../map-asset` (R2 upload, type/size guard) +
  revision **auto-bump** on `POST .../map`. New `AdminMapEditorScreen` — mode toolbar (Pan / Add control point), an SVG canvas
  over the base raster, control-point table (x/y/lng/lat → Fit affine + pixel-error pill), stage table (numeric or
  click-the-map via `svgToGeo`), live `geoToSvg` preview, base URL/upload + venue; reachable per-festival via a contextual
  **Map** action (no global dead nav). **Verified live (Playwright on prod):** editor loads, base + **10 stage pins** render,
  control-point drop works, **0 errors**. Gate close: server **197** + web **259** unit · build OK · **Worker `57b3f511`** +
  **Pages master `index-BDQM8Uev.js` v0.14.0** deployed · changelog 0.14.0 entry. Holds the invariants: real ingest (no
  fabricated lineup), honest resolve-failure UX, **no dead affordances** (POI/travel not built since nothing consumes them).
- **R11 GATE CLOSED ✅ (2026-06-24) — deployed + live (v0.13.0). Review-remediation pass COMPLETE: R0–R11 done.** The admin
  back-office (DEC-057), one Hono sub-app under `/admin` behind `requireAdmin` (`x-admin-token` === `ADMIN_TOKEN`, fail-closed).
  **R11.0** guarded shell + token gate + `AdminLayout` nav (commit 171478d). **R11.1a** Festivals overview — KPIs + per-festival
  health table (171478d). **R11.1b** Lineup & timetable dashboard (60f53c3). **R11.3** Festival-suggestions inbox (60f53c3).
  **R11.2** Data-source registry — `migrations/0012_festival_data_source.sql`, `dataSource.ts` (origin official_page/manual/
  ai_assisted + capture method; **falls back to the operational `lineup_source`** so a fresh festival prefills, not empty),
  GET/PUT `/admin/festivals/:id/data-source`, `AdminDataSourceScreen` (commit c030354). **R11.4** Usage metrics + free-tier
  runway — `migrations/0013` (`app_user.is_test` + `usage_counter`), **pure** `runway.ts` (`estimateRunway`: usedPct/daysLeft/
  status; cumulative vs daily; verified CF free-tier limits), `metricsRepo.ts` (real users **excl. is_test**, country + last-seen,
  R2 bytes from the `media_object` ledger, `me_touch` activity), `me.get` fire-and-forget `recordUsage("me_touch")`, GET
  `/admin/metrics`, `AdminMetricsScreen` (KPI + runway cards + **locked-services** + demographics). **Honesty:** only
  first-party measured data is shown; platform figures needing the CF Analytics token render as **`locked`**, never invented
  (commit e792df8). **R11.5** Live test console — `testConsole.ts` (`spawnTestMember` → `is_test=1` user added to a group,
  `injectStageFix` drives presence through the **real** `recordFix`/`GroupRoom` pipeline so a synthetic member appears live on
  `WhereScreen`, `purgeTestData` deletes every test entity FK-safe), `isTest` plumbed `PresenceMemberDto` → `presence.ts` →
  `WhereScreen` **`test` badge**, routes under `/admin/test/*`, `AdminTestConsoleScreen`. **Deferred R11.1c** (map editor /
  georeference / POI / travel-matrix) → **V1.1 admin (DEC-062)**: heavy visual drag/affine UI, unverifiable in this no-browser
  env; the `festival_map` publish pipeline (local `generateMap` + `POST /admin/festivals/:id/map`, DEC-034/040) already covers
  onboarding, and **no dead nav affordance** was added. Tests: server **153→183** (+30: admin/data-source, runway, metrics,
  test-console), web **256** (isTest woven into existing presence fixtures). Gate close: typecheck clean · server 183 + web 256
  unit · **e2e 30/30** · build OK · remote migrations 0012+0013 applied · **Worker `a83f97e3`** deployed · **Pages Production
  (master)** `index-BRgh7bLG.js` v0.13.0 (verified Environment=Production). Bundle web 485.82 KB / gzip 147.09; worker 193.91 KiB
  / gzip 45.09.
- **R10 GATE CLOSED ✅ (2026-06-24) — deployed + live (v0.12.0). All P0 + P1 (R0–R10) done.** Four polish slices:
  **R10.1 i18n EN/PT.** New `web/src/i18n/index.ts`: `EN` dictionary is the source of truth, `PT` a partial overlay,
  `interpolate()` for `{var}` substitution, `translate(key, lang, vars)` is **pure with EN fallback**, `useT()` subscribes to
  the persisted appearance-store language so the switch **actually changes the app live**. Wired through `BottomNav`,
  `SettingsScreen`, `AppearanceScreen`, `OfflineScreen`. EN copy kept byte-identical so existing e2e text assertions hold.
  Tests: new `i18n.test.ts` (EN default · PT override · EN fallback · interpolation · end-to-end contract).
  **R10.2 PWA install + honest SW update.** New `web/src/app/pwaInstall.ts`: `initInstallCapture()` stashes
  `beforeinstallprompt` (called from `main.tsx`), `isIOS()` detects iOS Safari, `useInstallPrompt()` exposes
  installed/installable/iOS/unavailable + a real `prompt()`. Rewrote `registerSW.ts` to register a **version-stamped**
  `/sw.js?v=<APP_VERSION>` (so a new release is a byte-different SW → genuine update) with `checkForUpdate()` (reports
  waiting worker) and `applyUpdate()` (posts `SKIP_WAITING`, reloads on `controllerchange`). `public/sw.js` now derives its
  cache version from the `?v=` query, **removed `self.skipWaiting()` from install** (new worker waits so we can prompt), and
  added a `message` handler for `SKIP_WAITING`. `OfflineScreen` drives the install button (with the iOS step list) + an
  honest "update ready → reload" / "you're on the latest" state. Tests: `registerSW.test.ts` extended (version-stamped URL ·
  unsupported · updated · current · first-install · `applyUpdate` posts SKIP_WAITING).
  **R10.3 About.** Build date sourced from the latest changelog entry; honest in-app links to **Privacy** and **Offline**
  settings (both reachable routes) + a data-source credit line.
  **R10.4 no-select + contrast.** Global `user-select:none` / `-webkit-user-select:none` / `-webkit-touch-callout:none` on
  `body`, with `input`/`textarea`/`[contenteditable]`/`.selectable` re-enabling text selection (app-feel without breaking
  typing). New `web/src/lib/contrast.ts`: `parseHex` · `relativeLuminance` · `contrastRatio` · **`readableInkOn(bg)`** picks
  dark/light ink by WCAG luminance; applied to **every initial-avatar** (`Avatar`, `presenceUi`, `squadUi`, `JoinScreen`,
  `SquadBoardScreen`, `MeetDetailScreen`) so e.g. white ink replaces near-black on violet `#7C3AED`. Tests: `contrast.test.ts`
  (luminance · ratio · ink choice across colors · malformed input) + e2e `a11y.spec.js` (body blocks selection, the
  onboarding name input keeps it). **Regression caught + fixed:** the new SW's network-first `/api` shadowed Playwright's
  `page.route` stubs in `presence.spec` (SW-originated fetches bypass routing → preview 404 → presence poll errored);
  added `test.use({ serviceWorkers: "block" })` to that spec (same precedent as `about.spec`), SW behaviour stays covered by
  the `registerSW` unit tests. **Gate:** **server 153 + web 256 unit · full e2e 30/30 green · typecheck + build OK.**
  **Deployed:** Worker **unchanged** (`b5f9ce0d`, R10 is frontend-only); Pages → Production `master`
  (`festpilot.pages.dev` serves **`index-COu_AK2r.js`**, v0.12.0). Version bump 0.11.0 → **0.12.0** + "Your language,
  installable, always fresh" changelog entry (also re-stamps the SW URL so existing installs get the update prompt).
  → **R11 (Admin back-office, DEC-057) — the final gate.**
- **R9 GATE CLOSED ✅ (2026-06-24) — deployed + live (v0.11.0).** Closes the **R9.5** slice and the whole P1 Squad cluster.
  **R9.5 — real mini-map + richer meeting card + meeting photo on R2 (DEC-047) + squad-home density.** *Meeting photo
  (backend):* `meeting_point.photo_url` already existed; surfaced it as `MeetingPointDto.photoUrl` (server + web types,
  `assembleDto`/`SELECT_POINT`). New `meetingPoints.getMeetingPhotoContext` (creator + existing key) and `setMeetingPhoto`;
  reused the R9.3 media adapter for **`POST /api/media/meeting/:id/photo`** — **creator-only** (403 otherwise, 404 unknown),
  quota-checked at `MAX_MEETING_PHOTO_BYTES` (512 KB), versioned key `meetings/<mpId>-<ts>.<ext>`, purges the prior photo,
  ledgers it. *Meeting photo (frontend):* generalised `imageCompress.ts` into `compressImage(opts)` exposing `compressAvatar`
  (square ≤512px) + **`compressMeetingPhoto`** (aspect-preserving ≤1280px ~400 KB); `api.uploadMeetingPhoto`; `MeetDetailScreen`
  shows a banner photo with a creator-only **Add/Change photo** action (honest reject reason surfaced); `MeetingPointCard`
  shows the photo as a thumbnail + **who set it** (creator attribution) instead of a bare flag icon. *Real mini-map:*
  `CoarsePresenceMap` gained `showBase` — on **"Where's the squad"** it now renders the **actual venue base image**
  (day/night via `useAppearance`, correct aspect) with the squad plotted on it, while the full-screen `PreciseSharingScreen`
  keeps the clean gradient (`showBase={false}`). *Squad-home density:* the "Where's the squad" CTA now reads live presence
  (`useGroupPresence`) and renders a **count + avatar stack** of who's active, not a static chevron. **Tests:** **+3**
  `media.test.ts` (meeting route: 404 unknown / 403 non-creator / 200 sets `photoUrl` + ledgers); `meetUi.test.ts` fixture
  updated for the new `photoUrl` field. **server 153 + web 240 unit · full e2e 29/29 green · typecheck + build OK.**
  **Deployed:** Worker **Version `b5f9ce0d`** (R2 + `/api/media/meeting/:id/photo` + `photoUrl`); Pages → Production `master`
  (`festpilot.pages.dev` serves **`index-CCNjzyCU.js`**, v0.11.0). Version bump 0.10.3 → **0.11.0** + "Your squad, upgraded"
  changelog entry. → **R10 (P1 Settings/polish)**.
- **R9.3 ✅ (2026-06-24) — Avatar photo on R2 + custom emoji (DEC-059).** R2 is enabled (card on file), so the avatar is a
  **real photo on Cloudflare R2**, not just initials. **Backend:** new storage adapter `server/src/media/store.ts` — the
  only code that touches the `MEDIA` bucket (`putImage`/`getImage`/`deleteImage`, content-type allowlist jpeg/png/webp,
  immutable cache headers). The **app** enforces the quota (Cloudflare has no hard spend cap): pure **`checkMediaQuota`**
  (allowlist → per-object ≤256 KB → global object-count ceiling → total-byte budget, **overwrite-aware** so replacing an
  avatar reuses its slot) over a new D1 ledger table **`media_object`** (one row per stored object, migration **0011**).
  Routes: `POST /api/media/avatar` (raw image body; ensures the user, computes a **versioned** key
  `avatars/<userId>-<ts>.<ext>`, stores, ledgers, purges the prior object, points `app_user.avatar_url` at `/media/<key>`),
  `DELETE /api/media/avatar` (purge + clear), and `GET /media/*` served straight from R2 (no auth, immutable long-cache —
  versioned keys make a new photo a new URL, so no stale cache). `GroupMemberDto` gained `avatarUrl`; `users.setAvatarUrl`
  writes the literal value (the COALESCE path can't clear). **Frontend:** `ui/imageCompress.ts` downscales to ≤512px and
  steps JPEG quality to ~150 KB before upload; `ui/Avatar.tsx` renders photo-or-initials consistently (header, squad member
  roster, profile preview); `ProfileScreen` got a tappable avatar + camera badge (pick → compress → upload, with the
  server's **honest reject reason** surfaced) + **Remove photo**; `CreateSquadScreen` got a **custom emoji** input
  (grapheme-clamped via `Intl.Segmenter`) beside the picker. **Tests:** **+14** `server/test/media.test.ts` — quota
  allowlist/empty/oversize, count-ceiling (new vs replacement), byte-budget with replaced-bytes credit, `mediaKeyFromUrl`,
  D1 ledger accounting, and the **route accept/reject** flow (401/415, store, **replace purges old + count stays 1**,
  delete) against an in-memory R2 mock. **server 150 + web 240 unit · typecheck + build OK.** **Deployed:** migration 0011
  → remote D1; Worker redeployed with the `MEDIA` binding (Version `95c8462e`). Pages redeploy deferred to the R9 gate close.
  Prod smoke: `POST /api/media/avatar` → 401 (no auth), `GET /media/<missing>` → 404, OPTIONS preflight → 204. → **R9.5**.
- **R9.1 / R9.2 / R9.6 / R9.4 ✅ (2026-06-24, committed prior — logged here for the record).** **R9.1** `SquadScreen` reads the
  full `useMyGroups()` list and renders a **squad switcher** (active squad remembered in `localStorage`, data isolated per
  `group.id`). **R9.2** honest hero copy (dropped the "signal dies / 2% battery" promise). **R9.6** the squad-plan "AI" icon
  became an honest **refresh** action, and the Now/Next **"J"** opens a **profile menu** (Profile / Settings) sourced from
  the real user initials instead of a hardcoded letter jumping to Settings. **R9.4** auto-share: joining a squad routes to a
  one-time **Share your plan?** confirm (defaults on: plan + favorites) via `ShareMyPlanScreen?joined=1`, with a **Settings
  opt-out** (`autoShareOnJoin`); join flow + e2e updated. Commits `b455c02`, `e9088ea`, `c7b13f9`.
- **R8 GATE CLOSED ✅ (2026-06-24) — deployed + live (v0.10.3, frontend-only).** My Plan is **editable in place**
  (review §6 / DEC-017/029/041) without re-running Lock-in. New pure **`domain/planEdit.ts`**: `removeFromPlan` (can never
  create an overlap), `addToPlan` (chronological insert, rejects an overlap or a duplicate act, returns `null` when it
  can't fit), `swapInPlan` (replace one set, checked against every *other* slot via `setFits(..., exceptSetId)`), plus
  `fittingAdds`/`fittingSwaps` to **gate the pickers** so only non-clashing options are ever shown — the **zero-overlap
  invariant holds by construction**. `MyPlanScreen` wires it up: each `PlanSetRow` is now a button with a `more_vert`
  kebab → a sheet menu (View on map / Swap set / Remove from plan); **Add a set** and **Swap** reuse one `SetPickerSheet`
  (searchable) fed by `fittingAdds(daySets)` / `fittingSwaps(nearbySets(window))`; after any edit `plan.save(...)` persists
  locally (DEC-041) and `buildPlanTimeline` redraws the walk/break chips. **Tests:** **+13 unit** in `planEdit.test.ts`
  (remove, add incl. touching-endpoint fit + duplicate-act no-op, swap incl. self/overlap rejection, `setFits` edges,
  `fittingAdds`/`fittingSwaps` filters); new **`myplan.spec.js`** e2e builds a plan via Lock-in then **removes → adds →
  swaps** from the timeline (count drops 1, returns to baseline, swap keeps count) — `lockin.spec` still green (PlanSetRow
  → button didn't regress it). **server 136 + web 240 unit · e2e green · typecheck + build OK.** **Deployed:** Pages →
  Production `master` (`festpilot.pages.dev` serves `index-Cp8KCfov.js`); Worker untouched (no backend change). → **R9 (P1 Squad)**.
- **R7 GATE CLOSED ✅ (2026-06-24) — deployed + live (v0.10.2, frontend-only).** Timetable & Lineup polish (review §5/§10),
  all in `TimetableScreen.tsx` + `styles.css` (+ pure `domain/timetable.ts`): **R7.1 card recipe** — replaced the
  gradient top-line-under-a-white-border (which read as a doubled line) with a single **2px stage-color top border** and
  a subtle full outline; no bottom colored line; heart stays vertically centered; photos already render (R5.4).
  **R7.2 gridlines** — `buildTimetable` now emits `gridLines` (a line every 30 min; odd steps flagged `half`), rendered
  as a discreet `.tt-grid` behind the cards with a **Grid** toggle (default on); +1 unit asserts the half-hour marks/positions.
  **R7.3 touching-card gap** — card width is `calc(widthPct% − 3px)` so back-to-back sets (`endMs == nextStartMs`) never
  glue while real gaps stay proportional. **R7.4 compact top bar (DEC-032)** — smaller title, a single **non-wrapping**
  day row (horizontal scroll), tighter paddings so controls don't steal grid height. **server 136 + web 227 unit · e2e
  green** (timetable favorite→gold, only-favs, zoom, Lineup switch all still pass) · typecheck + build OK. **Deployed:**
  Pages → Production `master` (`festpilot.pages.dev` serves `index-D6WOW1aw.js`); Worker untouched. → **R8 (P1 My Plan editable)**.
- **R6 GATE CLOSED ✅ (2026-06-24) — deployed + live (v0.10.1, frontend-only).** Now & Next is **sourced, never arbitrary**
  (review §4 / DEC-022). New pure **`chronoNowNext`** (`domain/nowNext.ts`): orders any `HomeSet[]` by absolute start and
  returns `{live, hero, next, later}`. `NowScreen` now picks the hero in strict priority — (1) the active day's **locked
  My Plan** (rich hero: NOW + live **LEAVE IN** + walk, reusing `buildNowNext`'s travel math), (2) else the user's
  **favorites** mapped to `HomeSet`s and run through `chronoNowNext`, (3) else an **honest empty state** with a CTA
  ("Pick the acts you can't miss" / "Set times aren't out yet" / "Nothing coming up" → lineup). Removed the old
  arbitrary `timed[0]` lineup-wide hero fallback. Extended `EmptyState` with an optional CTA `action` (no dead ends).
  **Tests:** `chronoNowNext` **+4 unit** (during/before/unsorted/all-ended branches); rewrote the `now` Playwright spec
  to the new truth — (a) no favorites → empty state, no `.now-hero`; (b) favorite 6 acts via the Lineup → the hero **and**
  every "up next" row are acts the user picked (`src` reads "From your favorites"). Caught + fixed a test bug: an
  unconditional `addInitScript` re-seed was wiping favorites on `goto("/")`; made the seed idempotent. **server 136 +
  web 226 unit · e2e green · typecheck + build OK.** **Deployed:** Pages → Production `master` (`festpilot.pages.dev`
  serves `index-CaczvcIx.js`); Worker untouched (no backend change). → **R7 (P1 Timetable polish)**.
- **R5 GATE CLOSED ✅ (2026-06-24) — deployed + live.** Five milestones (R5.0 identity, R5.1 real swipe, R5.2 grid mode,
  R5.3 per-day grouping/progress, R5.4 photos everywhere). User-visible, so bumped **v0.9.0 → v0.10.0** (`changelog.ts`
  single source + `package.json`) with an "A favorites flow with a face" note. Cumulative **server 136 + web 222 unit**
  green, **e2e green** (onboarding swipe+grid, timetable, squad), typecheck + build clean. **Remote D1:** migration
  **0010** applied (`app_user.email/country/last_seen_utc`). **Deployed:** Worker → `555c03b9` (smoke: `/api/health` ok,
  `/festivals` `withTimetable:true`, lineup `hasLineup/hasTimetable=true`, 813 perfs / **670 artists with photo**;
  verified the CDN `?width=160` resizer cuts a 565 KB press shot to **80 KB**) · Pages → Production `master`
  (`festpilot.pages.dev` serves `index-BEYZTPQv.js`). Brain sync: dev-log + decision-log (DEC-060/061 → IMPLEMENTED) +
  project-status. → **R6 (P1 Now & Next)**.
- **R5.4 ✅ (2026-06-24) — artist photos on every surface (DEC-061), commit `09ad8d4`.** Shared **`<ArtistPhoto>`**
  (CDN `?width=` per surface: ~96 avatar / 160 list / 360 card; idempotent URL-encode for the raw-space CDN paths;
  branded **initials fallback** when null or on `onerror`). Wired into: **swipe card** (full-bleed + scrim), **grid**,
  **Lineup** rows, **timetable** cards, **My Plan** cards, **Now/Next** hero + up-next/later rows, and the **map stage
  sheet** (now + next). New `domain/lineup → imageByActKey` resolves a photo for surfaces that render by `actKey`/
  `PlanSlot` without threading it through every shape; removed the now-dead `initials`/`stageColor` imports in Lineup.
  **Tests:** `imageByActKey` +2 unit (first-non-null upgrade; null kept); onboarding + timetable e2e green.
  **web 222 unit · typecheck + build OK.** → R5 gate close.
- **R5.3 ✅ (2026-06-24) — per-day grouping + progress + intent copy, commit `cac105d`.** Picker acts grouped by the
  derived festival-day block (DEC-048): the swipe deck advances day by day with per-day progress ("Day 1 of 3 · 70%" +
  an in-day "k of n" counter), the grid renders a **sticky section per day**, each act shown once under the earliest day
  it plays (DEC-026/028). Added an **intent explainer** to both modes ("building favorites, not the final plan — clashes
  solved later"). New pure `domain/onboardingDays` (`groupActsByDay`/`dayProgressAt`) **+4 unit** (earliest-day
  placement, contiguous blocks, progress clamp). Pointed the undo e2e at the deterministic `.swipe-day` counter (pct can
  round equal between adjacent swipes). **web 220 unit · onboarding e2e green · typecheck + build OK.** → R5.4.
- **R5.2 ✅ (2026-06-24) — grid pick mode + shared ArtistPhoto, commit `2f61a36`.** A **Swipe ⇆ Grid** mode toggle on
  step 4; grid = 2-col photo+name, tapping a card toggles the favorite into the **same store** the swipe deck writes.
  Introduced the shared `<ArtistPhoto>` + `lib/photo → artistPhotoSrc` (CDN `?width=`, idempotent encode). **Tests:**
  photo helper **+3 unit**; e2e picks two acts via the grid and confirms they reach the Lineup. **web 216 unit ·
  onboarding e2e (swipe+grid) green · typecheck + build OK.** → R5.3.
- **R5.1 ✅ (2026-06-24) — real swipe gesture + first-use hint, commit `ba3ea2a`.** `StepSwipe` now has a real pointer
  **drag** (right = keep, left = skip) with card tilt + Keep/Skip stamps and a fly-out, plus a first-use "swipe" cue;
  the **Nah/I'd see this** buttons stay as an explicit fallback. New pure `domain/swipe` (`swipeOutcome`/`cardDragStyle`)
  **+4 unit** (thresholds, stamp reveal, tilt clamp). **web 213 unit · onboarding e2e green · typecheck + build OK.** → R5.2.
- **R5.0 ✅ (2026-06-24) — lightweight identity at first run (DEC-060).** Onboarding now opens with a **StepIdentity**
  welcome: **name (required)** + **email (optional, no password, one-tap skip)**, gated before the festival picker.
  Saved on-device (new `localStore.profile`) and **best-effort** synced to the server (`PUT /api/me`) for admin
  metrics — never blocks the user on the network; the lineup loads in the background meanwhile. **Privacy:** email is
  PII — stored server-side (metrics only, DEC-057c) and **never** in the shared `UserDto` (group members can't see it);
  **country** comes from the edge `CF-IPCountry` header, never the client body. Server **migration 0010** adds
  `app_user.email/country/last_seen_utc`; `ensureUser` persists them COALESCE-safe and refreshes last-seen on every
  touch. `ProfileScreen` prefills its name from the onboarding identity. **Tests:** server `me` +4 (email/country/
  last-seen persisted; PII not leaked; COALESCE-preserve), web `localStore` +3 + `validate` +2, onboarding e2e fills
  name + proceeds with email skipped. Fixed the 6 user-touching server test harnesses to include migration 0010.
  **server 136 · web 209 unit · e2e onboarding+squad green · typecheck + build OK.** → R5.1 (real swipe).
- **R4 GATE CLOSED ✅ (2026-06-24) — deployed + live. ALL P0 (R0–R4) COMPLETE.** Four milestones (R4.1 backend
  data-state, R4.2 discoverable Lineup, R4.3 revisit-favorites, R4.4 suggest-a-festival). User-visible, so bumped
  **v0.8.2 → v0.9.0** (`changelog.ts` single source + `package.json`) with a "Find the full lineup — and never miss a
  change" note. Cumulative **server 132 + web 204 unit** green, **e2e 26/26** green (incl. new Timetable⇆Lineup switch
  and the onboarding walk with the new suggest affordance), typecheck + build clean. **Remote D1:** migration **0009**
  applied (`festival_suggestion`). **Deployed:** Worker → `b66bb712` (new POST `/api/festival-suggestions` +
  guarded admin inbox; smoke: POST→`{ok,count:1}`, short-name→400, admin→401, lineup `hasLineup/hasTimetable=true`,
  813 perfs) · Pages → Production `master` (`festpilot.pages.dev` serves `index-BlIoikkP.js`). Brain sync: dev-log +
  decision-log (DEC-048/049/052/055 → IMPLEMENTED) + project-status. → **R5 (P1 favorites)**.
- **R4.4 ✅ (2026-06-24) — suggest a festival, capture + admin inbox (DEC-055).** Onboarding step 1 had a dead
  "More festivals — coming soon" button. Replaced it with a real **"Suggest a festival"** affordance: tapping it reveals
  an inline input → **POST `/api/festival-suggestions`** (public, no login; the anon bearer rides only for analytics).
  Server `api/festivalSuggestions.ts` **normalizes** the name (trim/lower/collapse-space), **dedupes** on it via
  `INSERT … ON CONFLICT(name_normalized) DO UPDATE count=count+1`, and records the optional `suggested_by`. New
  **migration 0009** `festival_suggestion` (unique normalized name, count, status, count-desc index). Guarded
  **GET `/admin/festival-suggestions`** returns the inbox ranked by demand (wires R11.3 later). Validation: name 2–80
  chars → 400 otherwise. **Tests +5** (`festival-suggestions`: normalize · new=count1 · case/space dedupe bumps & keeps
  first spelling · ranked by count desc · records caller id). **server 132 unit · typecheck · build OK.**
- **R4.3 ✅ (2026-06-24) — dynamic days + revisit-favorites on data updates (DEC-048/052).** Lineups change after a user
  has favorited: new acts appear, favorited acts get cut. Pure `domain/lineupDiff.ts` `lineupChangesSince(seen, current,
  favorites)` → `{addedActKeys, removedFavoriteKeys}`; `OnboardingState` gains **`seenActKeys`** (baseline captured at
  onboarding finish) + an **`acknowledgeLineup`** reducer. New `ui/LineupUpdateBanner.tsx` (mounted on Timetable +
  Lineup) shows a dismissible prompt only when there's a real delta — "N newly added", "M of your picks were removed" —
  with **Review** (→ favorites) and **Dismiss** (acknowledges = re-baselines `seenActKeys`). Day pills already derive
  from the live lineup, so dynamic days fall out for free; this closes the "silent drift" half. **Tests +5**
  (`lineupDiff`: added-only · removed-favorite-only · both · none · re-ack clears). **web 199 unit.**
- **R4.2 ✅ (2026-06-24) — discoverable Lineup + default to it when no timetable (DEC-049).** The full lineup was hidden
  behind a tiny icon. New pure `domain/dataState.ts` maps `{hasLineup,hasTimetable}` → **`nothing` / `lineup_only` /
  `timetable`**, plus `showsViewSwitch`. New `ui/ViewSwitch.tsx` segmented **Timetable ⇆ Lineup** control. **Timetable**
  now **redirects to `/lineup`** when `lineup_only`, shows an honest **empty state** when `nothing`, and carries the
  switch in a compact top row (day pills below). **Lineup** shows the switch only when a timetable exists, a
  "timetable isn't out yet" note when `lineup_only`, and the same empty state when `nothing`. **Tests +5** (`dataState`
  all transitions + switch visibility) and a new e2e "reaches the Lineup in one tap via the switch". **web 194 unit.**
- **R4.1 ✅ (2026-06-24) — honest data-state from the API (DEC-052).** Backend now tells the client which of the 3
  states a festival is in. New **migration 0008** adds `festival.with_timetable` (default 1; persisted through
  `normalize.ts`→`store.ts` from the source `config.withTimetable`). `repo.getLineup` computes, over the **whole
  festival** (not the filtered slice): **`hasLineup`** = any active non-placeholder act with artists; **`hasTimetable`**
  = `with_timetable` AND any active non-placeholder act with a start time. Threaded into `LineupDto`/`FestivalDto`
  (server + web mirror). **Tests +5** (`repo-datastate`: nothing / lineup-only / timetable / published-but-no-times /
  flags-ignore-day-filter) + integration assertions. **server 127 unit.** Deploy ordering: 0008 + Worker shipped
  before the R4.2 frontend so the new DTO fields exist in Production.
- **R3 GATE CLOSED ✅ (2026-06-24) — deployed + live.** Single milestone (R3.1) — perf only, no user-facing copy, so
  **no version bump** (per orchestrator R3 close = "deploy; dev-log"). Cumulative **server 122 + web 194 unit** green,
  typecheck + build clean, e2e map + meeting-points still green. **Deployed:** Pages → Production `master`
  (https://6f2701f1.festpilot.pages.dev → alias `festpilot.pages.dev`). Worker untouched (web-only change), no redeploy. → R4.
- **R3.1 ✅ (2026-06-24) — shared lineup cache, instant tab switches (review §18.1, §6 perf).** Every screen's
  `useLineup` refetched **and reparsed** the whole festival lineup on each mount (~3 s per tab switch). New
  `data/lineupCache.ts` is a tiny **stale-while-revalidate** store keyed by the `(weekend, day)` query — in V1 every
  consumer requests the full lineup, so there's a single entry. Concurrent mounts **share one in-flight request**; a
  stale entry (>5 min) refreshes in the **background without dropping** what's on screen; a failed revalidation **keeps
  the stale lineup** instead of blanking to an error. `useLineup` now reads it via **`useSyncExternalStore`** (stable
  snapshot) and only kicks a fetch/revalidate per query — same `{status, lineup, error, reload}` shape, **zero consumer
  changes**. The SW network-first `/api` cache stays the offline layer; this only removes the redundant in-session
  fetch/parse. Considered caching the map `transform.json` too (re-fetched per Map mount) but it's a few KB already on
  the browser+SW HTTP cache — not a clear win, left as-is (orchestrator: don't over-engineer). **Tests +5**
  (`lineupCache`: shared single fetch across two consumers · switched-to tab served from memory with no 2nd call ·
  `reload` refetches · cold error · stale kept on failed revalidate); `MapView.test` resets the cache per test.
  **web 194 unit · typecheck · build OK.** → R3 gate close.
- **R2 GATE CLOSED ✅ (2026-06-24) — deployed + live.** Cumulative **server 122 + web 189 unit** green, **e2e map +
  meeting-points** green, typecheck + build clean. Golden-path holds (onboarding → favorites → lock-in → My Plan;
  map; squad meeting create). Bumped **v0.8.1 → v0.8.2** (`changelog.ts` single source + `package.json`) with a
  user-facing "A living stage map" note. **Deployed:** Pages → Production `master` (web 0.8.2) and confirmed live
  (`festpilot.pages.dev` serves the new bundle `index-D3h1Kugq.js`). **Worker unchanged this gate** (all R2 work is
  web: map overlay, presence wiring, picker zoom — no server/API change), so no Worker redeploy. Brain sync:
  DEC-050 + DEC-051 marked IMPLEMENTED with notes; dev-log + project-status updated. → R3 shared lineup cache.
- **R2.4 ✅ (2026-06-24) — zoomable meeting-spot picker + use-my-location (review §16, §6 #16 map half).**
  The spot picker (`routes/meet/MeetSpotScreen.tsx`) was a **static** base (fixed ~1000 px, no zoom) so a tap
  could only land within coarse base resolution. Now it **reuses the R2.1 `usePanZoom`**: drag to pan, wheel/pinch
  to zoom, and the base + stage dots + pin ride the shared transformed world. Tap-to-drop inverts the live
  pan/zoom transform (`geoFromClient`) so the pin lands exactly under the finger at any zoom; a release far from
  the press is treated as a pan, not a drop (8 px guard). "Drop pin" now resets to the current view centre;
  "My spot" (GPS) and "A stage" quick-picks unchanged. Kept the picker **in-flow with the venue aspect-ratio** so
  the body keeps its height and the "Use this spot" bar stays below (an absolute-fill viewport regressed the
  layout — the action bar overlapped the chips and ate the tap; caught by the e2e, fixed). **AC:** zoom while
  choosing + drop on exact GPS. **Tests:** the meeting Playwright flow passes with zoom enabled, and the map smoke
  was updated to assert the honest no-squad empty state (R2.3). **e2e map + meeting-points green; web 189 unit ·
  typecheck · build OK.** → R2 gate close (deploy + release bump).
- **R2.3 ✅ (2026-06-24) — real coarse presence on the map + honest out-of-venue (DEC-051/058, §6 #7/#8).**
  Retired the **mock** `map/presence.ts` (random people + fake meeting + raw-coord walk) — the map now reads the
  **real** active squad: `useMyGroups()[0]` → `useGroupPresence`. Friends render as **coarse, stage-anchored
  pins** via new pure `map/presencePins.ts` (`coarsePresencePins` mirrors the Phase-5 placement: anchor at the
  resolved stage, fan duplicates, "between A&B" → midpoint, drop ghost/stale/no-fix) — the pin carries **only
  screen x/y, never a lng/lat** (DEC-058 holds end-to-end). "You" is a precise dot only from the **device's own**
  fix via new display-only `useDeviceLocation` (permission-gated, **never prompts** just for opening the map, never
  POSTs). Out-of-venue (`isOutsideVenue(bbox, …, 150 m margin)`): beyond the venue → an honest banner +
  **"Show festival map"** button (recenters; R2.1 clamp already kills the black void) and we drop the off-canvas
  me-dot. Friends-sheet rebuilt on the real roster (`PresenceAvatar` + `presenceLine` + `sortRoster`) with honest
  empty states ("Join a squad…" / "No one's sharing yet") — **never invented friends**. Tests +11:
  `presencePins` (10 — placement, fan, between, ghost/stale drop, **no-raw-coord** invariant, you-accent;
  out-of-venue centre/edge/far/margin) and `MapView` (1 — empty state + no mock people; renders under Router).
  **web 189 unit · typecheck · build OK.** Next: R2.4 zoomable meeting-spot picker + use-my-location.
- **R2.2 ✅ (2026-06-24) — interactive vector stage overlay + de-baked base (DEC-050, §6 #5).** The base raster
  baked the 10 stage medallions + names → they pixelated at zoom and weren't tappable. Added a `stageMarkers`
  toggle through the map-art engine (`draw.ts` ArtOptions → `generate.ts` GenerateOptions → `run.ts`
  `NO_STAGE_MARKERS`), regenerated De Schorre **offline** (cached OSM, no Overpass) into a **label-free** SVG, and
  re-rasterized to WebP (resvg+sharp, Node 22) → shipped `web/public/maps/*.webp` (night 420 KB / day 388 KB).
  Verified 0 `<text class="stage-label">` baked. `MapView` now draws stages as a crisp vector overlay from
  `transform.stages` via `geoToSvg`: amber medallion (per-stage `stageColor`), star, screen-stable label
  (`pinScale = min(1/scale, 1.6)` so it never balloons zoomed-out), a live-dot when a set is on, and **tap → a
  stage info sheet** with now-playing + next (pure `domain/stageProgramme.ts` over `useLineup`'s sets, formatted
  with `timeInZone`). Tap-vs-pan guarded by comparing the click point to the pointer-down point. Tests +10:
  `stageProgramme` (7 — live/next/gap/exclusive-end/per-stage), `MapView` render (3 — pins are overlay nodes not
  the base, tap opens the sheet with now-playing, drag doesn't). **web 178 unit · typecheck · build · spike
  typecheck OK.** Next: R2.3 real coarse presence on the map + out-of-venue state (DEC-051).
- **R2.1 ✅ (2026-06-24) — pan clamp + safe-area fit (§6 #4/#6).** New pure `map/panClamp.ts`
  (`fitScale`/`fitView`/`clampPan`): the scaled world must always cover the viewport's **safe rect**
  (viewport minus the in-canvas chrome insets), with a 40px cosmetic bleed; under-sized worlds centre
  instead of pinning. `usePanZoom` now takes `insets`, clamps every pan/zoom through `clampPan`, fits via
  `fitView`, and re-clamps (not re-fits) on geometry/viewport changes once the user has moved (ResizeObserver)
  so a growing sheet never strands the art nor yanks zoom. `MapView` measures the topbar + friends-sheet
  heights (callback refs + ResizeObserver) and feeds them as insets, so the initial view frames the venue in
  the visible area and the bottom sheet never hides it. **AC:** can't drag into the void; venue framed; bottom
  bar clear. Tests +7 (`panClamp`: fit + cover invariant across 3 sizes × 4 scales, centre, insets, bleed).
  **web 168 unit pass · typecheck OK.** Next: R2.2 interactive vector stage overlay (DEC-050).
- **R1 GATE CLOSED ✅ (2026-06-24) — deployed + photos live.** Cumulative **server 122 + web 161 unit** green,
  typecheck + build clean. Golden-path smoke (onboarding day-select → favorites → lock-in → My Plan) holds.
  Bumped app **v0.8.0 → v0.8.1** (`changelog.ts`, single source) with a user-facing "Sharper days & honest
  clashes" note + how-to-test. **Deployed:** Pages → Production `master` (web 0.8.1) and confirmed live;
  **Worker had no R1 changes** (festival-day, clash and photo *pipeline* logic are all web/already-deployed —
  R1.3 needed only a re-ingest, which the live cron already ran: the API serves W1 artist photos). Brain sync:
  DEC-048 + DEC-061 marked IMPLEMENTED with the plurality-id note; dev-log + project-status updated. → R2 map.
- **R1.3 ✅ code (2026-06-24) — artist photos pipeline verified + regression test (DEC-061).** Confirmed the
  full path already carries the CDN photo end to end — `normalize.ts` keeps `a.image` → `store.ts` upserts
  `artist.image_url` with `ON CONFLICT(source_artist_id) DO UPDATE SET image_url = excluded.image_url` (so a
  re-ingest **backfills** photos onto rows imported before the field existed, idempotently) → `repo.ts`
  selects `a.image_url` and serves it as `imageUrl`. **No production code change, no new scraper/endpoint
  (DEC-009).** The spike HAR fixtures predate the field, so added a `sql.js` integration test that injects a
  photo onto one real W1 artist (every occurrence, so first-seen dedup keeps it) and asserts `image_url`
  stored + served as `imageUrl`, with photoless artists staying **null** (no fabrication). **server 122 + web
  161 unit pass · typecheck · build OK.** Live re-ingest happens at gate-close R1 (deploy + verify on the API).
- **R1.2 ✅ (2026-06-24) — Lock-in clash = anchor-overlap, not transitive chain (headline bug).** New
  `intervals.ts → clashAt(sets, fromEnd)`: anchors on the earliest unresolved set and returns it plus
  **only its true overlaps** (`overlaps(anchor, x)`), sorted by start — no transitive chaining. Used in
  `resolver.advance` (the surfaced `decision.options`), `countRemainingClashes` and
  `previewRemainingClashes` so the progress count matches the actual walk. **The gate is untouched** (a
  pick still consumes the timeline to its end), so the zero-overlap property test (300 seeds × 3
  strategies) stays green. `LockInScreen` needed **no change** — it already reads `decision.startMs`
  (now the anchor's start, "16:00") and `decision.options` (now anchor-overlap only). `clusterByOverlap`
  is kept (still unit-tested) but no longer used by the resolver. Tests +5: `clashAt` (3, incl. the
  A∩B,B∩C,A∌C non-chain case), Julio's 12/13/14:30 + 16–22 spread (each decision anchor-overlap only;
  16:00 never offers 21:00; next decision is the next real overlap), preview count == decisionsTotal.
  Updated the gate test's transitive expectation (`["short","long","t1","t2"]` → `["short","long"]`).
  **161 web unit pass · typecheck · build OK.** Next: R1.3 artist photo re-ingest (DEC-061).
- **R1.1 ✅ (2026-06-24) — festival-day blocks (DEC-048), commit `24142e7`.** New pure `domain/festivalDay.ts`:
  `assignFestivalDays(perfs, gapHours=3)` sorts by start and splits into contiguous blocks on a ≥3h all-stage gap
  (running **max-end**, so a long set's tail holds the night together); window = first-start..max-end so it crosses
  midnight; block `id` = **plurality** of the block's source `day` labels. Plurality (not the first set's label) was
  the key call: live W1 has 2 mis-tagged strays out of 408 ("Not My Type" tagged FRIDAY but plays Sat 15:30; "Poleen"
  FRIDAY but plays Sun 12:00) — plurality outvotes them and the gap-split re-homes them by time, while the id stays
  `FRIDAY`/`SATURDAY`/`SUNDAY` so persisted `planKey`/onboarding `dayKeys` are untouched (verified: favorites are
  festival-scoped, plans are `${festivalId}:${dayKey}`). Routed `daysForWeekends` (chips, same-id merge for W1+W2),
  `buildTimetable` (block **membership**, not raw label), and onboarding act day-grouping (`uniqueActs` gained an
  optional `dayOf`) through it; Now & Next needs no change (per-day slots keyed by the same stable id). Tests +7
  (midnight cross, 3h boundary, multi-stage tail, plurality re-homes stray, timetable midnight window). **156 web
  unit pass · typecheck · build OK.** Next: R1.2 clash anchor-overlap.
- **R0 ✅ (2026-06-24):** confirmed baseline green on the untouched tree (server 121 + web 147; typecheck/build clean);
  verified DEC-048→DEC-061 present in `decision-log.md`; seeded this section. Next: R1.1 festival-day blocks.

---

## Current State
- 🔨 **BUILD IN PROGRESS (2026-06-24).** Executing the orchestrator autonomously. **PHASE 0 + 1 + 2 + 4 + 5 COMPLETE + LIVE; PHASE 3 core done; PHASE 6 G6.1 ✅ + G6.2 ✅ + G6.3 ✅ → PHASE 6 COMPLETE.** **V1.x follow-ups (undo / split / share) ✅ + LIVE.**
  Design pass + brain are done (59 screens locked, prototypes `23`–`30`). About screen + changelog shipped (single-source `APP_VERSION`, now `0.8.0`).
- Active Phase / Gate: **PHASE 6 COMPLETE + V1.x polish COMPLETE.** G6.1 "come to me" ✅ + G6.2 lifecycle ✅ + **G6.3 compass nav + "I'm lost" safety ✅** (live).
  **V1.x follow-ups requested by Julio — ALL DONE & LIVE this session:** ✅ **undo / "what did I give up"** (clash resolver + onboarding swipe), ✅ **rich group split view** (#24.5), ✅ **share my plan as branded image/link** (canvas poster, Web Share files / save / copy).
  P5 ✅ (presence pipeline + G5.1 consent + G5.2 roster/coarse map + G5.3 ping/sharing-picker/privacy; precise exact-dot rides this Phase-6 channel per DEC-046).
  P3 core ✅ (travel matrix + coord→stage, Now & Next, stage routing/walking nav, offline contract); POI layer deferred (needs data).
  Phase 0: G0.1–G0.4 ✅ (live). Phase 1: **G1.1 ✅ · G1.2 ✅**. Phase 2: **G2.1 ✅ · G2.2 ✅ · G2.3 ✅**. Phase 3: **G3.2 ✅ · G3.3 ✅**.
- **P4 G4.1 identity ✅ (this session):** auth **seam** `server/src/auth.ts` (`parseAuthIdentity`/`getUserFromRequest`) — V1
  ships **anonymous-local** (`anon.<ulid>` bearer → `app_user` is_anonymous, DEC-042); Firebase JWT verification slots in
  later unchanged. `api/users.ts` (`ensureUser` upsert by firebase_uid, idempotent, COALESCE profile edits) + `api/me.ts`
  (`GET/PUT /api/me`) + migration `0003_app_user_profile.sql` (avatar_color) applied remote. Web: `data/authToken.ts`
  (token mint + Authorization header + cached user), `data/identity.ts` (`useIdentity`, `initialsOf`, dot palette),
  `api.getMe/updateMe`. Screens: **Sign-in** (#23.2 guest primary, Google/email-link "Soon", no Apple) + **Profile**
  (#23.3 name + initials avatar + dot color) + **Squad** rebuilt (empty hero #23.1 → ready state). 7 server + 5 web unit
  tests + a `squad` Playwright flow (empty→guest→profile→ready, 3 screenshots). Worker redeployed; Pages
  https://218bfb60.festpilot.pages.dev.
- **P4 G4.2 groups ✅ (this session):** first **Durable Object** — `GroupRoom` (SQLite backend, `new_sqlite_classes` in
  `wrangler.toml`; $0 on Free per DEC-037) for realtime **fan-out**: writes POST the DO `/notify` → broadcasts
  `{changed,rev,topic}` to hibernatable WS clients → they re-fetch (+ focus-refetch fallback). **D1 source of truth.**
  Server: `api/groups.ts` (create / join-by-token idempotent + **cap 50** / members owner-first / invite preview / leave
  with **owner-transfer**), `api/groups-routes.ts` (`POST /api/groups`, `GET /mine`, `GET /invite/:token`, `POST /join`,
  `GET /:id`, `GET /:id/socket` [WS `?t=`], `POST /:id/leave`), migration `0004_app_group_emoji.sql` applied remote.
  Web: `data/groups.ts` (`useMyGroups`/`useGroup` + WS+focus live), `api` group methods + `qrcode` for a real scannable
  QR. Screens: **Create** (#23.4 emoji+name, festival locked), **Invite** (#23.5 QR + link + share, no-expiry),
  **Join** (#23.6 paste-code + invite preview, guest gated through sign-in/profile via `?next`), **Squad** rebuilt to
  group-home (#23.7 plan CTA + member list + invite + leave). **10 server + 0 new web unit** (covered by repo tests) +
  `squad` Playwright rewritten: 2 flows (owner empty→create→invite→home; joiner link→guest→join→**members 2**) with 6
  screenshots. DEC-043. Worker + Pages deployed (https://cd81a5da.festpilot.pages.dev).
- **P4 G4.3 shared timetable ✅ (this session):** the squad timetable is **server-raw + client-aggregated** (DEC-044).
  Server stays a thin store: migration `0005_group_shared_plan.sql` (`group_member_plan` raw locked picks w/ partial-set
  cuts; `group_member_favorite` **act-keyed**, opt-in only; `plan_shared_at_utc`/`share_favorites` flags on
  `group_member`; owner overrides reuse `group_plan_slot`), `api/squadPlan.ts` (`shareMyPlan`/`unshareMyPlan`/
  `getSquadPlanData`/`set+clearOverride`) + 5 routes (`GET/PUT/DELETE /:id/plan`, `POST/DELETE /:id/plan/override`,
  all member-gated, override owner-gated), `notifyGroup(...,"plan")`. **Aggregation is the pure `domain/squadPlan.ts`
  `buildSquadPlan`** (plurality → favorited → owner; split; "who's going"; YOUR status following/own/**conflict**;
  favorites-fallback DEC-019) — **11 domain tests**. `data/squadPlan.ts` (`useSquadPlan` joins raw + lineup + local favs,
  reusing the G4.2 WS+focus refresh). Screens (4): **Share my plan** (#23.8 toggles + locked preview), **Squad plan
  overview** (#24.1 blocks + day seg + NOW + needs-input #24.6 + share CTA), **Block detail** (#24.2/3/5 squad pick +
  avatars + split + **never-silent** Join/Keep + fallback — DEC-013), **Owner override** (#24.4 candidate list + pin/
  revert). Shared `squadUi.tsx` (avatar stack, status pill, method label). **55 server + 95 web unit + 12 e2e green**
  (new `squad-plan` spec: share→overview→block→override, 4 screenshots). Worker live (migration 0005 remote + routes);
  Pages https://282aabd7.festpilot.pages.dev. Web `0.2.0`→`0.3.0`.
- **P4 G4.4 group board ✅ (this session):** lightweight **pinned notes — NOT chat** (UC-39, DEC-013, DEC-045). Reused the
  pre-existing `group_board_note` table (**no new migration**). Server `api/board.ts`: `listNotes` (pinned-first then
  newest-first), `postNote`, `editNote` (**author-only**, stamps `updated_at_utc`), `setPinned` (**owner-only**),
  `removeNote` (**author or owner**); body cap 500. 4 member-gated routes (`GET/POST /:id/board`,
  `PUT/DELETE /:id/board/:noteId`), each `notifyGroup(...,"board")` → DO fan-out (reuses G4.2 WS+focus). Web:
  `data/board.ts` (`useBoard` reusing `useGroupLive`), `api` board methods, `types.ts BoardNoteDto`. Screen
  **SquadBoardScreen** (`/squad/:id/board`, entered from a new group-home card #23.7): glass note cards (avatar + author +
  relative time + body), amber **PINNED** flag, inline edit box, bottom composer (no wireframe existed → designed to the
  squad DNA). `d1-shim` upgraded to return `meta.changes` (`getRowsModified()`). **61 server + 95 web unit + 13 e2e green**
  (new `squad-board` spec: post→edit→pin→remove, 2 screenshots; per-test 120s budget for the live-API round-trips). Worker
  live (board routes deployed + smoke-validated last session); Pages https://25c7fe2e.festpilot.pages.dev.
- **P5 presence pipeline ✅ (backend, committed `224a434` + LIVE):** coarse-only, **server-only raw coords** (DEC-007/008/
  015/046). Pure `domain/presence.ts` (`coarsenPresence`: raw fix → `at`/`near`/`between`/`none` + confidence by distance
  & GPS accuracy; `presenceExpiry`: gps 15 min, manual/push 45 min) + `metersBetween`. Repo `api/presence.ts`: `recordFix`
  (resolves stage coords from the **`festival_map` transform** — `stage_location` is never populated — coarsens, writes
  `presence` for groups where the member shares), `getGroupPresence` (coarse roster — **never lat/lng**), `setGroupShareMode`
  (stage/precise[60-min hard expiry]/ghost), `setSharingForAllGroups` (master pause), `purgeExpiredPresence` (cron). Routes:
  `POST /api/presence` (raw intake, all my groups), `POST /api/presence/pause`, `GET /api/groups/:id/presence`,
  `PUT /api/groups/:id/share` — DO fan-out `notifyGroup(...,"presence")`; cron purge wired in `index.ts`. **14 tests** (incl.
  the privacy "no coordinate leaks" contract). Live smoke validated (coarse "at FREEDOM BY BUD/high", precise→live 3600s,
  ghost→hidden). **DEC-046:** Phase 5 ships coarse-only; the *exact moving dot* for "precise" defers to Phase 6 (rides the
  meeting-point exact-coords channel) — precise UI here honestly shows a high-confidence coarse position + countdown.
- **P5 G5.1 + G5.2 presence frontend ✅ (this session):** mirrored DTOs + `api` methods (`getGroupPresence`/`reportFix`/
  `setShareMode`/`pauseSharing`). `data/presence.ts`: `useGroupPresence` (WS+focus+15s tick for live countdowns) and
  `useLocationSharing` — the device engine: geolocation consent, **battery-aware** sampling (coarse accuracy, cached fixes,
  significant-move ≥25 m + 75 s keepalive), posts raw fixes; **foreground-only** (runs while a presence screen is open).
  `data/shareOptIn.ts` reactive opt-in flag. Screens (3): **Consent** (#25.1/2 pre-prompt → real OS prompt → set stage +
  open roster), **Where's the squad** (#25.4 coarse map peek with pins **placed on resolved stages, never raw coords** +
  roster: at/near/between/last-seen/not-sharing, live ring, **current-artist auto-detect** "watching …", invisible-banner
  when not opted in), **Precise control** (#25.5 countdown ring to the 60-min hard auto-off, who-can-see-you stack, +60 /
  Coarse / Stop). Shared `presenceUi.tsx` (`presenceLine`/`ago`/`mmss` + live-ring avatar) — **12 unit tests**. Entry: a
  "Where's the squad" group-home card. **75 server + 107 web unit + 16 e2e green** (new `presence` spec: consent/roster/
  precise, 3 screenshots faithful to #25). Web `0.3.0`→`0.4.0`. Pages https://3fce6f1a.festpilot.pages.dev.
- **P5 G5.3 ping round-trip + sharing-mode picker + privacy ✅ (this session) → PHASE 5 COMPLETE:** the interactive
  "where is everyone?" loop **without FCM** (push is Phase 3+; shipped the **in-app channel** over the existing DO fan-out).
  Server: migration `0006_presence_ping.sql` (`presence_ping` — `locate`/`nudge`, `answered_at_utc` closes a ping; inbox
  index), `api/pings.ts` (`sendPing` w/ **5-min dedupe** + 30-min TTL, `listInbox`, `answerPing`, `dismissPing`),
  `recordStageReply` in `api/presence.ts` (**answer with GPS off** — un-ghosts a `nudge` target to stage, resolves the
  picked stage's coords from the map transform, records a `push_reply` fix → honest "at <stage>"). 3 member-gated routes
  (`POST /:id/ping`, `POST /:id/ping/:pingId/{answer,dismiss}`), each `notifyGroup(...,"presence")`; the inbox is **merged
  into the roster DTO** (`GroupPresenceDto.inbox`). Web: `data/shareOptIn.ts` extended (reactive **default mode** +
  **precise-expiry minutes**, 15–180 step 15); `api` ping methods. Screens: **Visibility picker** (#25.3 Stage/Precise/
  Ghost, per-squad scope DEC-015), **Location & privacy** (#25.6 master switch + default-mode segment + precise-expiry
  stepper + squad-only audience + **pause-all** → server ghost, privacy promise), and the **roster** now drives the loop —
  incoming-ping prompt ("Ana asked where you are" → one-tap **stage-pick sheet**, no GPS), **Ping** a stale member / **Nudge**
  a ghost. New pure helpers `rosterRank`/`sortRoster`/`pingKindFor` in `presenceUi.tsx`. **78 server + 112 web unit + 19 e2e
  green** (3 new presence specs: picker #25.3, privacy #25.6, ping round-trip #25.4; 4 screenshots faithful to #25).
  Migration 0006 applied remote, Worker redeployed. Pages https://8d596d1c.festpilot.pages.dev.
- **P6 G6.1 "come to me" meeting point ✅ (this session):** the squad drops an **exact spot to regroup** (UC-32/33, #26).
  **Photo deferred → DEC-047** (R2 isn't enabled on the account, error 10042; same R2 deferral as the deep-zoom map per
  DEC-038 Q1 — the create UI ships without the optional photo). Schema was pre-built upfront (`meeting_point` +
  `meeting_point_member` in `0001_init`); only added migration **`0007_meeting_point_meet_at.sql`** (`meet_at_utc` + an
  active-listing index). **Expiry is derived, not picked** (wireframe #26.4 "auto-closes 30 min after the time"): pure
  `domain/meeting.ts` — `meetingExpiry(meetAtMs, now, grace)` (meet-time-or-now + grace), `clampGraceMinutes` (10–240,
  default 30), and **`landmarkLabel`** (reuses the presence coarsen: at/near/between the nearest resolved stages → human
  label like "between FREEDOM BY BUD & CORE"). Repo `api/meetingPoints.ts`: `createMeetingPoint` (writes point + creator's
  `going` member row, derives `expires_at_utc`, labels via the `festival_map` transform stage coords), `listMeetingPoints`
  (active only, member statuses, `isMine`/`myStatus`). 2 member-gated routes (`GET/POST /:id/meeting-points`), each
  `notifyGroup(...,"meeting")` → DO fan-out. Web: client DTOs mirrored, `api.listMeetingPoints/createMeetingPoint`,
  `data/meetingPoints.ts` (`useMeetingPoints` reusing the WS+focus+30s-tick refresh), and **`map/transform.ts svgToGeo`**
  (inverse affine for drop-pin → geo). Screens (2, #26.1/#26.2): **Pick a spot** (`/squad/:id/meet` — georeferenced map,
  **Drop pin / My spot (GPS) / A stage** quick-picks reusing `StagePickSheet`, live coarse label, "Use this spot") +
  **Details** (`/squad/:id/meet/new` — name, WHEN now/15/30/60→`meetAtUtc`, WHO "Whole squad", optional note, "Send to
  squad"). Squad home (#23.7) gains a **"Set a meeting point"** CTA + **active-point cards** (title · landmark · "N going ·
  closes in Xm" · Active badge). **91 server + 115 web unit + 20 e2e green** (13 new server [`meetingPoints` + `meeting`
  domain], `transform` round-trip test, new `meeting-points` spec: home→pick→details→active-card, 4 screenshots faithful to
  #26; SW blocked in that spec so multi-nav stays on stubs). Migration 0007 applied remote, Worker redeployed. Pages
  https://f262f5a4.festpilot.pages.dev.
- **P6 G6.2 meeting lifecycle ✅ (this session):** the going/here/can't loop + live ETAs + the "everyone's here"
  reunion + auto-fade/purge (UC-28, #26.3/#26.4). **Lifecycle is DERIVED at read time — no schema change, NO
  migration** (the persisted `status` stays coarse active/archived/cancelled; the rich state is computed from the
  responders + expiry + now, so it stays honest as people respond and the clock moves). Pure `domain/meeting.ts`:
  `meetingLifecycle` (active→on_the_way→everyone_here→expiring_soon→expired/cancelled; order = terminal first, then
  reunion needs **≥2 committed all-here** so a solo creator never triggers it), `isLiveLifecycle`, `walkEtaMinutes`
  (the shared ~67 m/min ×1.3 walk model), `creatorDrifted` (>250 m from the spot), `EXPIRING_SOON_MS`/`DRIFT_RADIUS_M`
  — **20 domain tests**. Repo `api/meetingPoints.ts`: `getMeetingPoint` (the WHOLE squad roster — responders +
  non-responders synthesized as `no_response`; **per-member walk ETA + distance DERIVED server-side from the raw
  presence fix, NEVER a coordinate** — DEC-007/015/046; `creatorDrifted`), `setMyMeetingStatus` (going/arrived/
  not_going; refuses a non-active point → **409**), `endMeetingPoint` (**creator-only** cancel/close), and the cron
  `purgeExpiredMeetingPoints` (archive past-expiry active points, then delete archived/cancelled after a grace —
  DEC-015). `assembleDto` derives lifecycle + everyoneHere; new `getGroupRawFixes` in `api/presence.ts` is the
  **server-only** raw-fix source for ETAs (lat/lng never leave the Worker). 3 member-gated routes (`GET
  /:id/meeting-points/:mpId`, `POST .../status`, `POST .../end`), cron wired in `index.ts`. Web: DTOs mirrored
  (`no_response`, `MeetingLifecycle`, eta/distance/lifecycle/everyoneHere/creatorDrifted), `api.getMeetingPoint/
  setMeetingStatus/endMeetingPoint`, `useMeetingPoint` (reuses the WS+focus+30s-tick refresh). Pure **`meetUi.tsx`**
  (`lifecycleBadge`/`memberStatusLine`/`etaLabel`/`formatMeters`/`convergenceSummary`/`closesInLabel`/`whenLabel`)
  — **14 unit tests**. **`MeetConvergenceMap`** (exact-spot flag + coarse converging member pins on resolved stages,
  reuses `geoToSvg`, degrades to just the flag). **`MeetDetailScreen`** (#26.3 active convergence detail — map +
  roster sorted here→ETA→no-response→can't + the going/here/can't picker + drift/closing prompts + creator cancel;
  #26.4 **reunion** "the squad's back together" + close / keep-open; terminal cancelled/expired states). Route
  `squad/:id/meet/:mpId`; the squad-home active card now opens the detail. **116 server + 129 web unit + 21 e2e green**
  (new `meeting-lifecycle` spec: active detail → "I'm here" → reunion, 2 screenshots faithful to #26.3/#26.4; the 6.1
  spec is unchanged). **No migration.** Worker redeployed + **live smoke validated** (create→drop[active]→join→
  `[going,no_response]`→member arrived[on_the_way]→owner arrived[**everyone_here**]→cancel[cancelled]→dropped from the
  active list→status-on-cancelled **409**). Pages https://8879f4ba.festpilot.pages.dev. Web `0.5.0`→`0.6.0`.
- **About screen + changelog ✅ (this session):** new `data/changelog.ts` = the **single source of `APP_VERSION`** (fixes
  the stale `0.4.0` hardcoded in Settings) + a retroactive, dual-audience changelog (each release has `whatsNew` for
  users + a collapsible `howToTest` for the maker). `routes/settings/AboutScreen.tsx` (identity: what the app is +
  **creator Julio Corcini** + version, then the What's-new timeline; native `<details>` for the dev notes), wired at
  `settings/about` + a Settings row. `about` e2e (identity + creator + changelog + expand, 2 screenshots).
- **P6 G6.3 navigation + "I'm lost" safety ✅ (this session):** the regroup-and-reassure half of Pillar 2 (UC-28,
  #26.5/#26.6, DEC-022/046). **Safety is a meeting point flagged `is_safety`** (the column already existed → **NO
  migration**): the lost member shares their **exact** spot (the one deliberate exact-coordinate share) so the squad
  converges to help. Server `api/meetingPoints.ts`: `createMeetingPoint` now takes `isSafety` (long **240-min** grace —
  it ends on "I'm okay", not a timer), `is_safety` in the SELECT + DTO, new `listActiveSafetyPoints` (own lane,
  reuses `getMeetingPoint` for the converging roster + live ETAs); the list + cron purge already excluded `is_safety`.
  Routes: `POST /:id/meeting-points` accepts `isSafety` (notify topic `safety`), new `GET /:id/safety`. **5 new server
  tests** (flagged + exact spot + 4 h life; own lane in/out; converging ETAs; "I'm okay"=close clears the lane; purge
  never fades safety). Web: pure `domain/travel.ts` `bearingDegrees` + `compassPoint` (**+7 unit tests**); `useSafety`
  hook (15 s tick); `api.listSafetyPoints` (defensive `?? []`) + `createMeetingPoint(isSafety)`. **`MeetNavScreen`**
  (`/squad/:id/meet/:mpId/nav`) — compass dial + arrow (device heading − bearing; **north-up fallback** when no
  compass, iOS permission button), live distance/ETA from `watchPosition`, "you're here" inside 15 m, every layer
  degrades on its own. **`SafetyScreen`** (`/squad/:id/safety`) — calm menu (#26.5: share+alert primary · nearest
  landmark from the local map coarsener · medical/info/exit **degrades honestly** — no POI data, no fake safety info)
  and the active broadcast (#26.6: steady banner · squad converging w/ ETAs · "I'm okay — stop sharing"). Squad home
  gets a live **SOS banner** + a calm "I'm lost" entry; meeting-detail "Navigate" now opens the compass. **No phone
  calling** (anon V1 has no numbers) — the squad broadcast is the channel; **nearest help degrades** until POIs are
  mapped. **121 server + 136 web unit + e2e green** (new `safety` spec: menu→share+alert[`isSafety:true`]→active→I'm
  okay, + compass distance/ETA; 3 screenshots). **No migration.** Web `0.6.0`→`0.7.0`.
- **V1.x follow-ups ✅ (this session) — undo / split / share (web-only, no server/migration):** the three SHOULD
  items from product-spec §"V1.x". **(1) Undo / "what did I give up"** — `LockInScreen` keeps a snapshot stack: every
  pick pushes the prior `ResolverSnapshot` + the dropped clash options, surfacing a `GiveUpBanner` ("Locked X · you
  gave up Y, Z +N · Undo") on the resolving screen, an always-reachable `Undo` in the bar, and an undo affordance on
  the celebration (resets the save-guard so re-completion re-saves). `OnboardingScreen` swipe now records
  `{index, favoritedActKey}` and an **Undo** steps back, un-favoriting **only** the act that swipe created.
  **(2) Rich split view (#24.5)** — pure `domain/squadPlan.ts` `stageEntriesForBlock` (winner first, then each
  non-winner pick by headcount, the entry with YOU flagged; **+3 unit tests**); new **`SquadSplitScreen`**
  (`/squad/:id/plan/:perfId/split`) renders per-stage cards (color bar, count, act, avatar stack, "· you" highlight),
  "the squad splits here" framing, an undecided footnote, and a **"Set a meet-up after"** CTA → `/squad/:id/meet`;
  entry is a "See who's where" link in the block detail's split section. **(3) Share my plan as branded image/link** —
  dependency-free **canvas poster** `lib/planPoster.ts` (`buildPosterRows` pure **+5 tests**; `drawPlanPoster` Amber-Glass
  poster in **Story 9:16 / Square 1:1**: FESTPILOT wordmark, auto-shrink festival headline, day, "N sets · 0 clashes",
  per-set rows w/ stage dots, "Make yours" pill + url) + `lib/stageColorHex` (canvas can't resolve CSS vars).
  `lib/share.ts` gains `sharePlanImage` (Web Share **files** → Stories/WhatsApp), `downloadBlob`, `copyPlanText`,
  link-footer in `formatPlanText` (**+3 tests**). **`SharePlanSheet`** (live preview + format toggle + Share / Save /
  Copy) wired into **My Plan** header + the **Lock-in celebration** (replacing the old text-only share). **147 web unit
  + e2e green**: onboarding-undo + lockin give-up-undo + share-poster (Story→Square→Save) assertions, new `squad-split`
  spec (two overlapping picks → block → "See who's where" → 2 stage cards, live Worker), `about` spec made
  changelog-content-agnostic. Web `0.7.0`→`0.8.0`; new `0.8.0` changelog entry. **Pages-only deploy.**
- **P3 G3.2/G3.3 ✅ (this session):** pure `domain/travel.ts` — `metersBetween` (haversine), `buildTravelMatrix`
  (auto-estimate walk minutes from georeferenced stage coords: detour ×1.3, ~67 m/min, min 2 min, fallback flat),
  `coordToStage` (in-radius hit + nearest fallback + HIGH/MED/LOW confidence). `data/useTravelMatrix.ts` joins the
  lineup stages with the map transform's georeferenced stages → a real `TravelMatrix` (flat fallback when map absent).
  Wired into `MyPlanScreen`, `LockInScreen` (real partial-set cut feasibility). `domain/nowNext.ts` — `buildNowNext`
  (live set + next + **leave-in countdown** accounting for walk time + progress + later list). `NowScreen` rebuilt:
  plan-driven **LEAVE IN** hero when a plan exists for the active day; lineup-driven **DOORS IN** fallback pre-festival.
  11 new domain tests (travel + nowNext) + a `now` Playwright spec (hero + up-next + screenshot `phase3-now.png`).
- **P3 B7.4/B7.5 ✅ (this session):** stage-to-stage **routing + walking nav** (#29 screens 4/5). Pure `domain/route.ts`
  (`buildRouteLeg`: matrix minutes + straight-line metres + leaveBy = set start − walk) + 6 tests. `RouteScreen`
  (`/route`, full-screen under StackLayout): from→to picker (defaults to current→next set from the plan via
  `buildNowNext`, or first-two-stages ad-hoc) over the georeferenced map (real WebP base + affine line/pins),
  walk-time sheet + "Leave by HH:MM" nudge, GPS-free "Start walking" guidance (live position deferred to Phase 5).
  Entry points wired from Now&Next walk line + My Plan now-card/walk-chips. `route` Playwright spec + 2 screenshots
  (`phase3-route`, `phase3-route-walking`). **74 web unit + 7 e2e green**; Playwright capped to 2 workers + retry:1
  (specs hit the live API → was flaking under parallel load). Deployed to Pages (https://a2911147.festpilot.pages.dev).
- **P3 offline contract ✅ (this session):** `data/offline.ts` — `getOfflineStatus` (checks the Cache Storage API
  for the festivals list + lineup + map doc + map art) + `primeOffline` (fetches them through the SW so its
  network-first handlers cache them). `OfflineScreen` rebuilt (#28 B6.5): real Lineup/Venue-map/Map-artwork status
  rows + a "Make available offline" / "Saved for offline" action + unsupported-context fallback. 5 unit tests
  (mocked Cache API) + an `offline` Playwright spec (rows + prime → all Ready, screenshot `phase3-offline.png`).
  **79 web unit + 8 e2e green.** Deployed to Pages (https://d1e6c432.festpilot.pages.dev).
- **POI layer deferred (honest-data):** festival POIs (toilets/water/medical/exits) are temporary infra not in OSM;
  the brain's valid sources are KML import / the admin POI editor (not built yet). Building it now = inventing data
  (violates fact-verification). Sequenced after the admin POI editor (G3.4 B8.5) or a real KML/capture.
- **P2 G2.3 ✅ (this session):** A5 **Lock in** (#12c) — gated one-at-a-time clash picker (`LockInScreen`) over the day's
  favorites: progress bar, **all-clashes** overview (`resolver.previewRemainingClashes`), **add-nearby** sheet
  (`lineup.nearbySets`), **partial-set scissors** (`resolver.pickSet`/`pickOption(cut)` + `partialSet.latestFeasibleDeparture`).
  A6 **Celebration** (#13) → persists the plan locally (DEC-041), View My Plan / Share (`lib/share.ts`, Web Share + clipboard).
  A7 **My Plan** (#21) — pure `domain/plan.ts` timeline (done/now/upcoming + walk/break gap chips); empty-state CTA; a
  **Lock in** entry added to the Timetable controls. 8 new domain tests + a full Playwright flow (favorite→resolve→celebrate→plan)
  with 3 screenshots. commit **cbdbc9b**, deployed to Pages (**5b294f17**, alias festpilot.pages.dev).
- **P2 G2.2 ✅ (this session):** A3 Timetable (#15e) — pure numeric layout (`domain/timetable.ts`: window snapped to
  local hours, sets as time-percentages, stage ordering, per-stage/​per-set fav flags) + `stageColorRgb` for the
  card recipe. `TimetableScreen` renders the TML grid: sticky time header + stage pills, dark-glass cards w/ gold
  favorites + per-card heart, live NOW line, **only-my-favs** filter and **1h/2h zoom**. Day pills from the onboarding
  weekend. 5 domain tests + Playwright grid spec (favorite→gold, filter hides non-favs, zoom widens). commit pending.
- **P2 G2.1 ✅ (this session):** pure clash-resolution **domain** (`web/src/domain/`: intervals, gated chronological
  resolver, partial-set feasibility, lineup act-mapping) — framework-free, **property-tested for the zero-overlap invariant**;
  **local-first store** (DEC-041) — versioned localStorage for onboarding/favorites/plan + React hooks (no server identity
  until Phase 4 auth); **Onboarding #17** (festival→weekend→days→swipe) gated by `RequireOnboarding`; **Lineup #22**
  (search, favorites/day filters, heart toggles). `festival.ts` weekend-date parsing hardened for the API's
  `"YYYY-MM-DD HH:MM"` shape (rolls early-morning ends back a night; never throws). commit **c89b81b**, deployed to Pages.
- **P1 ✅ (this session):** Amber-Glass app shell — 5-tab bottom nav (Now/Timetable/My Plan/Map/Squad, DEC-032),
  design-system §1–§4 tokens + glass recipe in `styles.css`, PWA manifest + branded icons (192/512/maskable +
  apple-touch), hand-written **service worker** (network-first nav, cache-first assets, network-first /api with
  offline fallback; precaches shell + map + lineup), SPA `_redirects`, typed API client (`data/api.ts`, `VITE_API_URL`),
  `react-router-dom` routing (tabs + settings stack). Screens: **Now** (A2, renders the LIVE 813-set lineup), Timetable/
  My Plan/Squad shells, **Map** (wraps the working MapView), Settings hub (B5.5), Appearance+language (B5.6),
  Offline/sync shell (B6.5), system states (B6.6). Appearance/lang are a persisted single source of truth (map palette reads it).
- **🌎 LIVE URLs (test on phone):** App → **https://festpilot.pages.dev** · API → **https://festpilot.trippilot.workers.dev**
  (`/api/festivals`, `/api/festivals/:id/lineup`, `/api/festivals/:id/stages`, `/api/festivals/:id/map`).
- **Live festival id:** `01KVVF5VERH4AB28NAM6NM65VD` (Tomorrowland Belgium 2026) — **813 performances**, 15 stages,
  2 weekends (W1/W2), all UTC instants correct. `festival_map` row published (affine + 10 georeferenced stages).
- **G0.4 ✅ (live bring-up):** D1 `festpilot` created + migrated (remote); Worker deployed (cron `0 */6 * * *`);
  live lineup ingest **status=updated, 813 changes**; Pages project `festpilot` created + `dist` deployed.
  Fixed two live issues: WAF **403** on the page (→ added `BROWSER_HEADERS`) and Workers **Illegal invocation**
  (→ call `fetch` via a local ref). Added a documented **saved-ref fallback** (`LINEUP_EVENT`/`UUID`, page tried first).
- **G0.2 ✅**: map base **444 KB / 415 KB WebP** (was 19.8 MB SVG ×2). **G0.3 ✅**: `festival_map` + map API.
- **DEC-040:** V1 map ships as a pre-rendered raster base (WebP) + live vector overlay; the ~20 MB inline-relief SVG
  is dropped from shipped assets. R2 stays out (DEC-038).
- Last green test run: 2026-06-23 — **server 49 pass** (+ auth seam + ensureUser + **10 groups: create/join/cap-50/
  preview/members/leave-owner-transfer**), **web 84 vitest**, **10 Playwright** e2e (phase0-map + phase1 shell + phase2
  onboarding/timetable/lock-in + phase3 now/route/offline + **phase4 squad: owner create→invite→home + joiner→members-2**;
  1 pre-existing shell flake passed on retry). Screenshots in `web/e2e/screenshots/` (… + phase4-create / phase4-invite /
  phase4-group-home / phase4-join / phase4-group-home-2).
- typecheck: clean (server + web). build: server deploy OK; **web build OK + deployed to Pages**.
- Live: D1 **created+migrated** · Worker **deployed+ingesting** · Pages **deployed** · R2 **NOT used** (DEC-038 Q1).
- Credentials: Cloudflare token **saved + verified**. Firebase: deferred (DEC-038/042) — V1 squad identity is
  **anonymous-local** (`anon.<ulid>` behind `getUserFromRequest`); Google/email-link + token verification are ⏳ Firebase.
- Confidence: 90% (Phase 0 verified end-to-end in production).

## Completed (most recent first)
- [x] **P2 G2.3** — Lock-in resolver + Celebration + My Plan (DEC-017/018/029): `LockInScreen` (#12c) gated multi-option
  picker w/ progress, all-clashes overview, add-nearby sheet, partial-set scissors; Celebration (#13) persists plan
  (DEC-041) + Share (`lib/share.ts`); `MyPlanScreen` (#21) pure `domain/plan.ts` timeline (done/now/upcoming + walk/break
  chips) + empty-state CTA; Timetable "Lock in" entry. 8 new domain tests + full Playwright flow + 3 screenshots
  (57 web unit + 5 e2e green). commit **cbdbc9b**, deployed to Pages (**5b294f17**).
- [x] **P2 G2.2** — A3 Timetable (#15e, DEC-027): pure `domain/timetable.ts` (local-hour window snap, time-% set
  positions, stage ordering, fav flags) + `stageColorRgb`; `TimetableScreen` TML grid (sticky time header + stage
  pills, dark-glass cards + gold favorites + per-card heart, live NOW line, only-favs filter, 1h/2h zoom). 5 domain
  tests + Playwright grid spec. commit **b4dfc8c**, deployed to Pages.
- [x] **P2 G2.1** — onboarding + Lineup favorites + local-first domain: pure `web/src/domain/` (intervals, gated
  resolver w/ zero-overlap property tests, partial-set feasibility, lineup mapping); `localStore.ts` (DEC-041);
  `OnboardingScreen` (#17) + `RequireOnboarding` gate; `LineupScreen` (#22). Hardened `festival.ts` date parsing
  (fixed `RangeError: Invalid time value` from the API's `"YYYY-MM-DD HH:MM"` weekend dates). 44 web unit + 3 e2e green.
  Playwright config + specs ported to ESM `.js` (Node 18). commit **c89b81b**, deployed to Pages (preview 98a3beea).
- [x] **P1 (G1.1 + G1.2)** — Amber-Glass PWA shell: 5-tab nav, tokens+glass in `styles.css`, manifest + icons,
  hand-written service worker, SPA `_redirects`, typed API client (`VITE_API_URL`), react-router (tabs + settings stack);
  **Now screen reads the LIVE lineup**; Timetable/Plan/Squad shells; Map wraps MapView; Settings/Appearance/Offline/states.
  10 web unit tests + 2 Playwright e2e. Deployed to Pages, **v0.2.0**. commit pending.
- [x] **P0 G0.4** — LIVE bring-up: D1 created+migrated (remote), Worker deployed (cron), **live ingest 813 perfs**
  (fixed WAF 403 via browser headers + Workers illegal-invocation via local `fetch` ref + saved-ref fallback),
  `festival_map` published, **Pages deployed** (festpilot.pages.dev). Playwright mobile visual smoke green (+screenshot).
  Server **32 tests**, web **3 vitest + 1 e2e**. commit pending.
- [x] **P0 G0.3** — map data API: `festival_map` table (migration 0002) + `GET /api/festivals/:id/map` +
  guarded admin upsert; static asset keys → URLs (no R2, DEC-038); 4 sql.js tests (29 total).
- [x] **P0 G0.2** — slim the map (DEC-040): `rasterize-base.ts` (resvg+sharp) → WebP base; dropped the 20 MB SVGs;
  MapView reads `.webp`; web Vitest+Testing-Library+jsdom stack added; 3 asset tests. typecheck+build green.
- [x] **P0 G0.1** — toolchain baseline: Node 22 confirmed, server 25 tests green, brain synced (DEC-040). commit 053a35c.
- [x] Authored the master orchestrator `brain/documents/2026-06-23-v1-implementation-orchestrator.md`.
- [x] Initialized git on `master` (baseline commit pending in P0 G0.1).
- [x] Phase 1 backend — Worker ingestion + full V1 D1 schema (28 tables) + read API + cron. 25 tests green.
- [x] Map generator productized (`generateMap`) + admin map editor (`spikes/map-art`).
- [x] PWA shell started (`web/`): georeferenced map view (SVG + affine, live overlay, day/night, coarse labels).

## Decisions made this session (mirror into decision-log if structural)
- **DEC-039** — design-pass answers (group blocks per-set; no Favorites screen; auth Google+email-link, **no Apple/iOS,
  native Android-only**; profile at first join; in-app inbox; safety in Squad; admin = map-verify+lineup-dash; map POI +
  stage routing; default language English). Apple Sign-In dropped (supersedes the DEC-035 iOS blocker).
- Adopted the V1 implementation orchestrator as the execution source of truth (DEC-036).
- V1 is **$0 infra** (DEC-037): Durable Objects are FREE on the Workers Free plan (SQLite backend), so the
  WS-via-DO presence (DEC-035) costs nothing; Pages via direct upload; deploy with a Cloudflare API token.
- **Intake answered → DEC-038** (locked): no R2 (static-asset map); lineup = both weekends via the brain's
  documented capture process (`research/2026-06-23-festival-lineup-data-source.md`, don't invent); Firebase + push
  deferred (anon/local); PWA only; domain `festpilot.pages.dev`; squad cap 50; invite link no-expiry-until-event-ends;
  Cloudflare Web Analytics; **private GitHub repo wanted (gh blocker)**; autonomy confirmed; generate PRIVACY/TERMS.
- **Process:** every operator hand-off turn ends with an `AskQuestion` (workspace rule
  `.cursor/rules/always-end-with-askquestion.mdc`, alwaysApply; orchestrator §1 rule 2 clarified).

## What the operator must supply
- **Cloudflare token:** ✅ DONE — in `server/.dev.vars`, verified.
- **Operator intake (`brain/operator-intake.md`):** ⏳ created 2026-06-23, awaiting answers. Blanks default to recommendations,
  so the build can start the moment the user says "intake done". Key forks: R2 enable vs static-asset map (Q1);
  lineup ingest from official site vs file (Q2); Firebase now vs later (Q3).
- **Firebase (Spark/free):** optional until Phase 4 (auth) / Phase 3 (push) — see intake Q3 + Part 5.

## Known issues / ⏳ blocked-on-credentials
- **R2 decided OUT for V1** (DEC-038 Q1) — map ships as a static asset; no R2 bucket, no card. (`code 10042` moot.)
- **GitHub repo (DEC-038 Q13) ✅ done:** remote `origin` = `git@github.com:juliocorcini/festival-copilot.git`
  (SSH auth works for `juliocorcini`); `master` pushed + tracking. Push per phase from now on.
- Shipped map SVG currently inlines the relief raster (~19MB) — slimmed in P0 G0.2.
- System default node is v18; **must `nvm use 22`** before any wrangler/build command (`.node-version` = 22 is set).

## Next (resume point — P3 in progress)
- **Shipped this session (P3 core):** travel matrix + coord→stage (`domain/travel.ts`, `data/useTravelMatrix.ts`),
  Now & Next home (`domain/nowNext.ts`, `NowScreen` rebuilt). 68 web unit + 6 e2e green · typecheck/build clean ·
  committed **cb6517b** · **deployed to Pages** (https://555bcdff.festpilot.pages.dev → alias festpilot.pages.dev).
- **Remaining P3 (forks — pick by priority):**
  1. **Admin desktop map-verify (G3.1, B8.*):** persist pins to `stage_location` via a guarded Worker route →
     unlocks the **POI editor (B8.5)** → real POI data → then the POI layer (#29 1-3/6). Separate desktop track.
  2. **Phase 4 groups + GroupRoom DO (mock/anonymous-local auth per DEC-038):** buildable on the Cloudflare token; large multi-gate.
  - ✅ **Done this session:** travel matrix + coord→stage (G3.2), Now & Next (G3.3), stage routing + walking nav (B7.4/B7.5), offline contract (B6.5).
  - ⏳ **Credential-gated:** FCM/push (G3.4) + permanent auth (P4) need Firebase — run mock/local, mark ⏳ (orchestrator §5/§19).
- **Older design-pass backlog (already RESOLVED — kept for history):**
- **Review Batch 1** (`brain/wireframes/directions/23-amber-groups-flow.html`, 8 screens) + **Batch 2**
  (`24-amber-group-timetable.html`, 6 screens: plan overview · block detail · locked-conflict+fallback · owner override ·
  split view · needs-input) → apply Julio's edits.
- **Batch 3** delivered (`25-amber-presence-consent.html`, 6 screens: pre-prompt · OS dialog · sharing mode
  (stage/precise-60min/ghost) · where's-the-squad · precise-active control · privacy settings).
- **Batch 4** delivered (`26-amber-meeting-safety.html`, 6 screens: pick spot · details · active detail w/ ETAs ·
  lifecycle (here/on-the-way/expired/cancelled) · "I'm lost" menu · safety-active broadcast + nearest help).
- **Batch 5** delivered (`27-amber-identity-settings.html`, 6 screens: sign-in (Google/email-link/guest, no Apple) ·
  magic-link sent · edit profile (upload/initials) · account (guest→save, sign out, delete) · settings hub ·
  language (EN default/PT) & appearance (auto/day/night)).
- **Batch 6** delivered (`28-amber-states-notifications.html`, 6 screens: personal gap (+ first-class breaks, Q-L) ·
  notification inbox (Q-G) · alert prefs (reminders+lead time, walk alerts, clashes, pings, squad) · OS push lock-screen ·
  offline/sync · empty/loading/error states).
- **Batch 7** delivered (`29-amber-map-poi-routing.html`, 6 screens: map+POI layer (filter chips) · nearest essentials ·
  POI detail · stage-to-stage routing ("leave by" nudge) · walking nav · layers/legend — DEC-039 Q-J).
- **Batch 8** delivered (`30-amber-admin.html`, 6 desktop screens: overview/festivals · lineup dashboard (source =
  documented capture) · **map editor drag-pins→generate** · georeference/verify (affine, fix off-position stages) ·
  POI editor · travel-time matrix — DEC-039 Q-I).
- ✅ **DESIGN PASS COMPLETE (8/8)** + ✅ **brain UI docs updated** (ui-decisions-locked §§9–16, screen-catalog,
  design-system; screen-inventory marked RESOLVED) + ✅ **orchestrator upgraded to screen-complete** (every §13
  gate lists its screens; DEC-039 Apple/iOS fixes applied throughout).
- **NEXT = START THE BUILD at P0 G0.1** (`brain/documents/2026-06-23-v1-implementation-orchestrator.md` §13):
  git baseline + node-22 pin → P0 G0.2 slim SVG → P0 G0.3 D1 create+migrate + map row → P0 G0.4 deploy
  Worker + Pages (`festpilot.pages.dev`) → live lineup API + in-app map. Then P1 shell → P2 favorites/My Plan → …
- Remember: `nvm use 22` before any wrangler/build; push per phase; end each operator hand-off with an `AskQuestion`.
