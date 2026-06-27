# FestPilot — Leva "Review & Polish" — Implementation Orchestrator (a verdade de execução desta leva)

> **Status:** ✅ ACTIVE — documento mestre de execução para a leva de revisão 2026-06-27 (briefing do Julio: mapa,
> tela inicial, timetable, line-up, Meu Plano, menus flutuantes, caminhadas, compartilhamento, tradução, squad).
> **Versão:** app hoje **v0.31.6** (deployado em produção); esta leva sobe **v0.32.0 → v0.41.0** (uma por gate).
> **Irmão de** `2026-06-24-v1-review-remediation-orchestrator.md` (R0–R11, a 1ª remediação) e
> `2026-06-26-native-polish-and-features-roadmap.md` (Fases 5–10 + R1–R11). Aqueles construíram e poliram o V1;
> **este corrige o que a revisão de uso do Julio (2026-06-27) encontrou.** Mesmo contrato de autonomia,
> mesma disciplina de git/testes/deploy.
>
> **Fonte desta leva:** o briefing gravado do Julio ("Briefing de revisão do app Fest Pilot"), normalizado aqui em
> itens **D01–D26** priorizados (P0/P1/P2), com **mapa de causa-raiz (código ↔ problema)** confirmado lendo o
> código real, **5 conselhos inline** para as decisões abertas, e **gates testáveis com critérios de aceite**.
>
> **Como ler o resto:** o brain é a verdade de *produto* (`product-spec.md`, `decision-log.md`,
> `technical-direction.md`). Este documento é a verdade de *execução*: a ordem, o diagnóstico, as correções, os
> testes, os deploys, os commits. Código sempre em inglês; este doc em português (idioma do pedido).

---

## 0. Missão (leia primeiro)

Você é um(a) engenheiro(a) full-stack sênior **endurecendo o FestPilot end-to-end, sozinho(a), nesta sessão**,
contra a revisão de uso do Julio. **O app já existe e está no ar** (v0.31.6, Pages + Worker — ver §4). Seu trabalho
**não** é reconstruir: é **corrigir os defeitos de produto/lógica/dados/UX/mapa/visual** que o Julio apontou,
**preservando tudo que já funciona e está bonito**, na ordem de prioridade dele (P0 → P1 → P2), **sem parar e sem
pedir permissão entre unidades de trabalho** (DEC-056).

**O app em um parágrafo:** companheiro de festival. Você (1) navega o line-up e **favorita** artistas (overlaps
permitidos); (2) faz **Lock in** de um **Meu Plano** sem conflito (resolução cronológica de clashes, sets parciais,
tempo de caminhada); (3) cria/entra num **squad** para montar um plano compartilhado, ver todo mundo de forma
**grosseira** num **mapa** georreferenciado bonito, perguntar "cadê todo mundo?", e largar **pontos de encontro**
exatos temporários. Festival de referência: **Tomorrowland Belgium 2026 / De Schorre** (DEC-020).

**A diretriz central desta leva (palavras do Julio, normalizadas):**

> "O app já tem uma base boa, mas algumas áreas passam sensação de produto inacabado. **O principal alerta é o
> mapa** — num app de festival, mapa ruim quebra a confiança. Depois do mapa, o segundo ponto é **o plano e o
> squad**. Não reconstrua o que funciona; **conserte qualidade, clareza e os bugs** (menus presos, caminhada
> errada, tradução faltando, foto vazando)."

**Vá para §17 para começar.** Tudo entre aqui e lá é o contrato sob o qual você executa.

---

## 1. Identidade & contrato de autonomia (idêntico aos orchestrators irmãos)

Você é o **executor**, não um coordenador. Você implementa, testa, faz deploy e commita você mesmo.

**REGRAS ABSOLUTAS — nunca violar** (espelham `inline-council-no-subagents.mdc`, `tech-lead-delegation.mdc`,
`execution-style.mdc`, `phase-delivery-hardening.mdc`):

1. **SEM subagents / SEM Task tool / SEM delegação.** Tudo inline, nesta sessão. Múltiplas perspectivas = múltiplas
  *seções de uma resposta*, nunca múltiplos agentes. (Custo é **por request**; um subagent = +1 request.)
2. **NÃO peça permissão para avançar — NUNCA, entre unidades de trabalho (DEC-056).** Terminar um milestone/gate é a
  deixa para **commitar → deployar → atualizar dev-log → próximo**, não para parar. O Julio roda isto de forma
   **assíncrona, muitas vezes dormindo**; um "posso continuar?" no meio trava o pipeline por horas. O `AskQuestion`
   terminal (exigido por `always-end-with-askquestion.mdc`) só vale no **hand-off genuíno** — quando *todos* os
   critérios da §12 forem TRUE, **ou** um bloqueio real de credencial/custo, **ou** o contexto acabar de verdade.
3. **NÃO pare porque "é muito trabalho" ou "o chat está longo".** Continue até a §12 (Definition of Done) ser toda
  TRUE — ou o contexto acabar (feche o gate atual limpo: commit + deploy + dev-log handoff e pare limpo).
4. **NÃO narre o que vai fazer — faça.** Minimize prosa.
5. **Código em inglês** (identificadores, comentários, mensagens de commit, nomes de arquivo). **Texto de UI via
  i18n `t()`** (DEC-082), nunca hardcoded. Este doc e o brain em português.
6. **Domínio/dados antes da UI**, uma correção por vez, **teste junto com a correção** (§8).
7. **Reuse o que existe — nunca reinvente** o que a §4 diz que já funciona. Grande parte desta leva é *expor,
  organizar, polir e consertar* peças que já existem (blocos do plano, travel choice, presença, sheets, i18n).
8. **Respeite a segurança de terminal WSL** (§11): sempre `git --no-pager …`, sempre `git commit -m`, nunca um
  pager/editor no terminal do agente. Sempre `nvm use 22` antes de wrangler/build.
9. **Mantenha o brain em sincronia** (§14): `FestPilot/dev-log.md` a cada milestone, `decision-log.md` em qualquer
  decisão nova, `product-spec.md`/`project-status.md` nos momentos certos.

Se uma ambiguidade **nova** aparecer que o brain + as decisões deste doc não resolvam: **rode o conselho inline na
hora** (1 request, sem subagents), escreva a síntese como `DEC-NNN (PROPOSED)` em `decision-log.md`, e **continue**.

---

## 2. Ordem de leitura (carregue uma vez, depois corrija)

No **início da leva**, leia (nesta ordem):

1. **Este documento** §0–§9, depois o gate em que você está na §10.
2. `FestPilot/dev-log.md` — o estado vivo de execução (o que já está no ar).
3. `brain/decision-log.md` — só os `DEC-NNN` citados pelo gate (esp. **DEC-075→DEC-088** novos da §7, mais os de
  contexto: DEC-030/033/034/040/050 mapa, DEC-039 i18n, DEC-073/074 blocos+travel, DEC-058 presença, DEC-066 shell).
4. Os orchestrators irmãos (`2026-06-24-…` §3/§6 e `2026-06-26-…` §3) — **não** os releia inteiros; eles dão tom e
  os invariantes herdados.

**Não releia o brain inteiro por correção.** Leia uma vez, depois confie no dev-log + neste doc + no mapa de
causa-raiz da §6. **Mas no momento em que surgir uma dúvida real, LEIA o arquivo de brain relevante** — quase tudo
é respondível lá, ou lá + um conselho inline (DEC-056). Ler o brain na dúvida **nunca** é "parar".

---

## 3. Não-negociáveis (releia antes de CADA gate) — ÂNCORA

Estes invariantes valem a leva inteira. Quebrar um é defeito mesmo se os testes passarem.

**Herdados (continuam absolutos):**

- **Line-up nunca é hardcoded** — resolve `event`+`uuid` da página oficial → CDN JSON (DEC-009). Removidos →
`active=false`, nunca hard-delete. Clientes leem **só o nosso** DB.
- **Um Meu Plano travado tem ZERO overlaps** — o resolver de clash continua cronológico, um-de-cada-vez, gated
(DEC-017). Toda edição passa por `domain/planEdit.ts` (puro, testado).
- **Matemática de tempo/clash/plano é TS puro na camada de domínio** — sem lógica de negócio dentro de componentes
React. Toda correção de lógica cai em `web/src/domain/`** com teste unitário.
- **Plano de grupo = SÓ sets** travados (`buildSquadPlan` é puro e lê só `kind==="set"`). **Blocos pessoais e
escolhas de caminhada são LOCAIS** (DEC-041/073/074) e **filtrados** de qualquer serialização pro grupo/servidor.
**Eventos de grupo** são **camada paralela** — nunca entram na agregação nem no lock; só renderizam ao lado.
- **Presença é grosseira por padrão + honesta** (DEC-058) — o feed de grupo nunca carrega `lat/lng` cru; exato só
via share explícito + expirável. Sem tracking em background.
- **Overlay do mapa é sempre uma camada vetorial separada** — labels/pins/palcos/pessoas **nunca** são "baked" na
arte (DEC-030/050).
- **Identidade visual = "Amber Glass"** (DEC-025): base escura quente, âmbar/ouro, vidro reflexivo, títulos Oswald /
corpo Albert Sans. **Preserve o que já está bonito.**

**Novos, derivados desta revisão:**

- **Nenhum menu/sheet flutuante "preso na página"** — todo overlay modal é renderizado via **portal no `document.body`
com `position: fixed`** (DEC-078). Nunca `position: absolute` dentro de um ancestral transformado.
- **Nada importante pixela ao dar zoom no mapa** (DEC-075) e **nenhuma borda preta** ao redor do mapa (DEC-077).
- **Caminhada mostra origem e destino corretos** — a tela de rota abre a **transição exata** que o usuário tocou,
nunca "Mainstage → Mainstage" (DEC-079).
- **A imagem de compartilhamento mostra o plano inteiro** (não esconde a maioria em "+3") e é bonita o suficiente
para postar (DEC-080).
- **Se o idioma é português, não sobra inglês nas telas principais** (DEC-082).
- **Toda informação de caminhada aparece uma vez** (sem o par duplicado "14 min walk" + "Leave early for 14 min
walk") (DEC-079).

---

## 4. Baseline — onde o app REALMENTE está (NÃO reconstrua)

> Verificado a partir de `dev-log.md` + a árvore de código, 2026-06-27. Trate como pronto; **conserte, não recrie.**

App **muito maduro**, **v0.31.6, no ar** (`festpilot.pages.dev` web + `festpilot.trippilot.workers.dev` Worker, D1 até
migração 0015). **e2e 30/30 determinístico · 677 unit (439 web + 238 server) · builds OK.** Monorepo
npm-workspaces (`server`, `web`), **Node 22** (`nvm use 22` primeiro). Versão em `web/package.json` +
`web/src/data/changelog.ts` (`APP_VERSION`); o SW é registrado com `?v=<APP_VERSION>`.

**O que JÁ existe e esta leva vai expor/polir/consertar (não rebuildar):**


| Área                                                              | O que já existe (confirmado no código)                                                                                                                                                                                                                 | A lacuna desta leva                                                                                                                                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mapa** (`web/src/map/`)                                         | Base raster WebP (`/maps/<id>.webp` + `-day`) num "world" pan/zoom (`usePanZoom` + `panClamp`, MAX_SCALE=12); **overlay vetorial separado** de palcos (círculo+estrela+nome), POIs, presença grosseira; out-of-venue honesto (DEC-051); day/night.     | **(D01)** a **base raster pixela** no zoom (fundo/árvores/terreno); **(D02)** marcadores feios (círculo+estrela, nome em texto cru); **(D03)** `fitScale` é *contain* → **letterbox preto**.                                            |
| **Sheets** (`web/src/ui/Sheet.tsx`)                               | Base única: scrim + sheet + grip + drag-to-dismiss + Esc + focus-trap + `aria-modal`. Usada por TODOS os sheets/menus (PlanItemMenu, Share, ArtistSheet, etc.).                                                                                        | **(D05/D06)** `.scrim`/`.sheet` são `position: absolute` e **não** portaladas → presas ao conteúdo rolado (sobem com o scroll).                                                                                                         |
| **Meu Plano** (`MyPlanScreen` + `domain/plan.ts`/`planEdit.ts`)   | Edita sets (add/swap/remove, zero-overlap); **blocos pessoais** (eat/rest/water/meet/explore/custom) via `BlockSheet` + steppers (DEC-073); **travel choice** leave-early/arrive-late (DEC-074); chips de caminhada/pausa calculados. Toggle "Editar". | **(D09)** sem affordance de **inserir entre dois cards específicos** com "de onde tirar o tempo"; **(D17)** caminhada **duplicada** (chip no gap + chip travelIn); **(D18)** travel chip só é clicável **no modo Editar**.              |
| **Tela inicial** (`NowScreen` + `AppHeader`)                      | Hero "now/next" sourced (plano → favoritos → vazio); `SquadNowCard` (presença + próximo evento).                                                                                                                                                       | **(D04)** nome do festival truncado em 22 chars (`shorten`); **(D10)** avatar `.ava` tem **fundo gradiente âmbar** sem `overflow:hidden` (vaza nas laterais da `<img>`); **(D20/D24)** sem abas "Meu plano / Squad" no Next up.         |
| **Timetable** (`TimetableScreen` + `domain/timetable.ts`)         | Grade TML, favoritar, only-favs, zoom 1h/2h (default 1h), gridlines (`.gl`/`.gl.half`), pinça (`usePinch`), Lock-in.                                                                                                                                   | **(D12)** palcos ordenados por `sortOrder` da fonte (não por favoritos); **(D13)** gridlines fracas (`rgba(255,255,255,0.06)`/`0.028`); **(D14)** botão "Lock in" não muda quando o dia já tem plano.                                   |
| **Line-up** (`LineupScreen`)                                      | Busca, filtros (favoritos/dia), densidade 2/3/4 col, pinça, seções "YOUR FAVORITES"/"ALL ARTISTS".                                                                                                                                                     | **(D15)** `usePinch` **re-baseliza** a cada limiar → uma pinçada pula vários níveis, sem animação; **(D16)** seção "YOUR FAVORITES" não colapsa.                                                                                        |
| **Caminhada** (`RouteScreen`)                                     | Rota palco→palco no mapa, walk time, "leave by"; aceita `?from/&to/&at`.                                                                                                                                                                               | **(D07)** o chip do plano navega só com `?day=` → `RouteScreen` recalcula de `buildNowNext` (now/next) → **origem/destino errados** ("Mainstage → Mainstage").                                                                          |
| **Compartilhar** (`SharePlanSheet` + `lib/planPoster.ts`)         | Poster em canvas (story/square), Web Share / save / copy; `buildPosterRows` puro.                                                                                                                                                                      | **(D08)** capacidade limitada → **"+N more"** esconde sets; **"0 CLASHES"** hardcoded + layout torto; **sem fotos** de DJ; nomes pequenos; muito à esquerda; **(D26)** URL = `window.location.origin` ("festpilot.pages.dev").          |
| **i18n** (`web/src/i18n/index.ts`)                                | Camada real (EN fonte, PT overlay, `useT()` reativo, persiste). **Escopo: só navegação + Settings.**                                                                                                                                                   | **(D04)** todas as telas principais (Now/Line-up/Timetable/Meu Plano/Mapa/Squad) **caem pro inglês** — precisam ser conectadas ao `t()` com as chaves.                                                                                  |
| **Squad** (`SquadScreen`, `SquadPlanScreen`, `SquadEventsScreen`) | Switcher, presença (`WhereEveryoneCard`), meeting points, board, **eventos de grupo** (DEC-D2 Fase 8), plano agregado (`buildSquadPlan`), `AgendaBand`.                                                                                                | **(D21)** home é pilha de cards sem hierarquia "Next up→Plano→Onde→Board→Agenda"; **(D22)** `SquadPlanScreen` usa `.squad-block` (≠ timeline do Meu Plano); **(D23)** agenda é tela separada + band, **não interleaved** entre os sets. |
| **Barras do sistema** (`index.html`)                              | `theme-color #0F0D09` fixo, `viewport-fit=cover`, `apple-…-status-bar-style=black-translucent`, `--safe-top/--safe-bottom`. **É PWA — sem Capacitor ainda** (DEC-035).                                                                                 | **(D11)** `theme-color` estático (não acompanha day/night); auditar safe-areas; documentar o plugin StatusBar/NavBar p/ quando o shell nativo chegar.                                                                                   |
| **Haptics** (`lib/haptics.ts`, `data-haptic`)                     | Buzz em favoritar/lock via `data-haptic`.                                                                                                                                                                                                              | **(D19)** `BottomNav` (NavLink) **sem** haptic ao trocar de aba.                                                                                                                                                                        |


**O que NÃO é desta leva:** auth permanente (anon-local), FCM/push, admin POI/travel já entregues, Capacitor nativo
(documentar, não construir). DEC-073/074 (PlanBlock/travel choice) são referenciados em código mas **não foram
back-filled** no `decision-log.md` — housekeeping de G0 (entrada curta), não escopo de produto.

---

## 5. O briefing, normalizado: D01–D26 por prioridade

> Ordem da leva = a prioridade do Julio, com sequenciamento de **risco** dentro de cada faixa (bug cirúrgico antes
> de visual pesado; mapa cedo porque é "o principal alerta"; i18n/share/plano no miolo; squad/estrutural por último).

**P0 — corrigir agora (briefing "Prioridade 0"):**

- **D01** Mapa nítido no zoom (SVG/vetorial/progressivo) — *briefing #1* — Gate **G3**
- **D02** Ícones + nomes dos palcos no mapa — *#2* — **G2**
- **D03** Remover borda preta do mapa — *#3* — **G2**
- **D04** Português em todas as telas — *#21* — **G4**
- **D05** Menu flutuante preso na página — *#14* — **G1**
- **D06** Menu de compartilhamento preso — *#20* — **G1** (mesma causa de D05)
- **D07** Caminhada com origem/destino errados — *#15* — **G1**
- **D08** Melhorar imagem de compartilhamento — *#18* — **G5**
- **D09** Inserir blocos/sets entre dois cards — *#12 + #13* — **G6**
- **D10** Foto de perfil circular na tela inicial — *#5* — **G1**

**P1 — muito importante (briefing "Prioridade 1"):**

- **D11** Barras do sistema (topo/baixo) — *#6* — **G8**
- **D12** Ordenar palcos por favoritos — *#7* — **G7**
- **D13** Contraste das linhas de tempo — *#8* — **G7**
- **D14** Estado do botão "Lock in" quando o dia já tem plano — *#9* — **G7**
- **D15** Suavizar zoom por pinça — *#10* — **G7**
- **D16** Colapsar "Your Favorites" — *#11* — **G7**
- **D17** Avisos duplicados de caminhada / leave early — *#16* — **G6**
- **D18** Ajuste rápido de caminhada fora do modo edição — *#17* — **G6**
- **D19** Vibração ao trocar de aba — *#22* — **G7**
- **D20** "Next up" do Squad — *#24* — **G9**

**P2 — melhoria estrutural (briefing "Prioridade 2"):**

- **D21** Reorganizar a tela de Squad — *#23* — **G9**
- **D22** Plano do Squad parecer com "Meu Plano" — *#25* — **G9**
- **D23** Agenda do Squad dentro do plano do Squad — *#26* — **G9**
- **D24** Integração tela Agora ↔ Squad (abas no Next up) — *#24* — **G9** (com D20)
- **D25** Nome truncado do festival (conselho) — *#4* — **G10**
- **D26** Domínio/URL no compartilhamento — *#19* — **G5** (com D08)

---

## 6. Mapa de causa-raiz (código ↔ problema) — comece aqui em CADA correção

> O coração da leva. Cada linha: o achado, a **causa-raiz confirmada no código real** (arquivo → símbolo, sem nº de
> linha — eles deslizam), e a direção da correção. Os gates da §10 expandem em ACs + testes. **Releia o arquivo
> citado antes de editar** (símbolos se movem).


| D           | Achado                                                                                                             | Causa-raiz (arquivo → símbolo)                                                                                                                                                                                                                                       | Direção da correção                                                                                                                                                                                                                                               | Gate |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **D05/D06** | Menus/sheets flutuantes "presos na página" sobem com o scroll                                                      | `web/src/ui/Sheet.tsx` renderiza `<scrim>+<sheet>` **inline** (sem portal); `styles.css` `.scrim`/`.sheet` são `position: absolute` → ancoram ao ancestral posicionado/transformado (`.world{will-change:transform}`, `.fp-rise`, transição de tela), não à viewport | **Portalar** o conteúdo da `Sheet` para `document.body` via `createPortal` + trocar `.scrim`/`.sheet` para `**position: fixed`** (DEC-078). Conserta TODOS os sheets de uma vez (PlanItemMenu, Share, ArtistSheet, pickers, squad). Preservar drag/Esc/focus-trap | G1   |
| **D10**     | Foto de perfil na home não circular, "vaza" âmbar nas laterais                                                     | `app/AppHeader.tsx` usa `.ava` (botão) com `<img className="ava-img">`. `styles.css` `.ava { background: linear-gradient(âmbar) }` **sem `overflow:hidden`**; a `<img>` não clipa o fundo gradiente                                                                  | `.ava { overflow: hidden }` + garantir `.ava-img` cobre 100% (object-fit:cover, já tem); alinhar ao tratamento do `ui/Avatar.tsx` (perfeito no perfil). CSS-only                                                                                                  | G1   |
| **D07**     | "Walk from Mainstage to Mainstage" (destino errado)                                                                | `routes/MyPlanScreen.tsx` `onRoute`/`routeHref(dayKey)` navega só com `?day=`; `routes/RouteScreen.tsx` então deriva a perna de `buildNowNext(now)` (now/next), ignorando a transição tocada → origem=destino ou perna errada                                        | Passar `**?from=&to=&at=`** reais da transição (gap/chip) tocada para `/route`; endurecer o default do `RouteScreen` para `to ≠ from` (DEC-079)                                                                                                                   | G1   |
| **D02**     | Ícones de palco feios (círculo+estrela, cores aleatórias, nome em texto, ilegível ao zoom)                         | `map/MapView.tsx` desenha `<circle stage-pin-disc> + <path STAR> + <text stage-pin-name>`; `styles.css` `.stage-pin-*`/`.lbl`                                                                                                                                        | Redesenhar marcador: ícone limpo, **label com fundo de vidro translúcido** (não preto puro), tipografia legível, hierarquia ícone↔nome, escala screen-stable (já há `pinScale`); manter vetorial (DEC-076)                                                        | G2   |
| **D03**     | Borda preta grande ao redor do mapa                                                                                | `map/panClamp.ts` `fitScale` = `min(...)` (*contain*) → letterbox; min-scale `fit*0.9` permite afastar ainda mais; fundo `.map/.world` preto                                                                                                                         | Default **cover-fit** (preencher, recortar bordas) OU letterbox **tingido com a cor do app** + clamp que impede void; melhor zoom inicial (DEC-077)                                                                                                               | G2   |
| **D01**     | Tudo pixela ao dar zoom (fundo, árvores, terreno)                                                                  | base é **raster WebP** (`/maps/<id>.webp`) escalada até MAX_SCALE=12 → bitmap borra; overlay (palcos/pessoas) já é vetorial e nítido                                                                                                                                 | **Base de alta-fidelidade** (conselho C1): servir a base **vetorial SVG** (deep-zoom) ou raster de alta-res 2–4× com MAX_SCALE honesto; **progressivo** (leve→troca). O gerador `spikes/map-art` já separa overlay da arte (DEC-075)                              | G3   |
| **D04**     | Português incompleto (Now, Line-up, Timetable, Meu Plano, Mapa, Squad, "Your Favorites", "All artists", dias…)     | `i18n/index.ts` cobre só `nav.*` + `settings.*`/`appearance.*`/`offline.*` etc.; telas principais usam **literais em inglês**                                                                                                                                        | Adicionar chaves EN+PT por tela e trocar literais por `t()`; dias (`festival.ts`/`format.ts`); revisar overflow de botão; decidir "Squad" vs "Grupo" (conselho C5 → **manter "Squad"**) (DEC-082)                                                                 | G4   |
| **D08**     | Imagem de compartilhamento fraca: "+N more" esconde sets, "0 CLASHES" torto, sem fotos, nomes pequenos, à esquerda | `lib/planPoster.ts` `metricsFor` (capacidade pequena) + `buildPosterRows` (corta em `max`, `overflow`) + `drawPlanPoster` (`countText` hardcoded "0 CLASHES", sem `<img>` de artista, layout left)                                                                   | Mostrar **todos os sets** (linha menor / 2 colunas / múltiplas imagens), **fotos** dos DJs (carregar no canvas — passar `imageUrl` por slot), corrigir/contar clashes de verdade, hierarquia, story vs square distintos (conselho C3) (DEC-080)                   | G5   |
| **D26**     | URL "festpilant.page.dev" parece temporária                                                                        | `SharePlanSheet.appOrigin()` = `window.location.origin`; `planPoster` `url = appUrl ?? "festpilot.app"`                                                                                                                                                              | Usar URL pública final (constante/env); decidir domínio com www (LOCK §16) (DEC-080)                                                                                                                                                                              | G5   |
| **D09**     | Não dá para inserir entre dois cards do plano; falta "de onde vem o tempo"                                         | `MyPlanScreen`: blocos só via "Fill {n}m" num **gap** (≥ threshold, no Editar) ou "Add a break" global; `BlockSheet` exige `rangeIsFree` (não carva tempo de set vizinho)                                                                                            | Affordance **"+" entre qualquer par de cards**; sheet "de onde tirar o tempo?" (sair antes do anterior / chegar depois no próximo / dividir / manual) reusando `applyLeaveEarly`/`applyArriveLate` (DEC-074) + `addBlock`/`addToPlan` (DEC-081)                   | G6   |
| **D17**     | Avisos duplicados ("14 min walk to Freedom" + "Leave early for 14 min walk")                                       | `MyPlanScreen` `PlanGapRow` mostra "{n} min walk to {stage}" **e** `PlanSetRow`/`TravelChip` mostra "Leave early for {n} min walk" para a mesma transição                                                                                                            | Consolidar numa única fonte por transição (a info dentro do card do set anterior; o gap só mostra pausa) (DEC-079/C2)                                                                                                                                             | G6   |
| **D18**     | Ajuste de caminhada só no modo Editar                                                                              | `MyPlanScreen` `TravelChip` é `<button>` apenas quando `editing`; senão `<span>` estático                                                                                                                                                                            | Tornar o chip clicável **também fora do Editar** → abre `TravelSheet` (sair cedo/chegar tarde/dividir/ignorar) (DEC-079/C2)                                                                                                                                       | G6   |
| **D12**     | Palcos em ordem fixa da fonte mesmo com favoritos                                                                  | `domain/timetable.ts` `buildTimetable` ordena `stagesOut` por `sortOrder` da fonte                                                                                                                                                                                   | Quando `favorites.size>0`, ordenar palcos por **contagem de favoritos desc** (tiebreak sortOrder); adicionar `favCount` ao `TimetableStage`; puro + teste (DEC-083)                                                                                               | G7   |
| **D13**     | Linhas de tempo fracas demais                                                                                      | `styles.css` `.tt-grid .gl { rgba(255,255,255,0.06) }`, `.gl.half { 0.028 }`                                                                                                                                                                                         | Hora +15–20% (~~`0.072`); meia-hora leve (~~`0.033`), mantendo-a mais fraca que a hora. CSS-only                                                                                                                                                                  | G7   |
| **D14**     | "Lock in" igual mesmo com o dia já planejado                                                                       | `TimetableScreen` `controls` `.tt-lk` sempre "Lock in"/`playlist_add_check`; não lê plano do dia                                                                                                                                                                     | Ler `usePlan(festivalId, dayKey)`; se houver plano travado → "Dia planejado"/"Editar plano" + ícone, ação vai pro Meu Plano (DEC-084 + i18n)                                                                                                                      | G7   |
| **D15**     | Pinça pula vários níveis; animação seca                                                                            | `lib/usePinch.ts` re-baseliza (`baseline = spread(...)`) a cada cruzamento (1 gesto dispara N passos); `LineupScreen`/`TimetableScreen` mudam densidade/zoom sem transição                                                                                           | `usePinch`: **um passo por gesto** (trava até `touchend`) + limiar maior; CSS transition no grid/zoom (DEC-085)                                                                                                                                                   | G7   |
| **D16**     | "Your Favorites" sempre ocupa o topo                                                                               | `LineupScreen` seção `favoriteActs` sem toggle de colapso                                                                                                                                                                                                            | Header da seção vira toggle (abre por padrão; lembra na sessão) — estado local; CSS de altura/rotação                                                                                                                                                             | G7   |
| **D19**     | Sem vibração ao trocar de aba                                                                                      | `app/BottomNav.tsx` `NavLink` sem `data-haptic`                                                                                                                                                                                                                      | `data-haptic="light"` (ou chamar `haptics`) ao navegar p/ aba **diferente** da ativa                                                                                                                                                                              | G7   |
| **D11**     | Barras do sistema não combinam                                                                                     | `index.html` `theme-color` fixo `#0F0D09`; sem Capacitor StatusBar                                                                                                                                                                                                   | `theme-color` dinâmico (day/night via JS), auditar `--safe-top/bottom` ponta-a-ponta; **documentar** `@capacitor/status-bar` overlay + NavigationBar p/ o shell nativo futuro (DEC-088)                                                                           | G8   |
| **D20/D24** | Sem "Next up" do grupo / sem abas                                                                                  | `NowScreen` hero é só pessoal; `SquadNowCard` é card separado                                                                                                                                                                                                        | "Next up" do Squad: card/abas "Meu plano / Squad" no Now (seletor de squad se >1) reusando `useGroupEvents`/`useGroupPresence`/`useMeetingPoints` (DEC-086/C4)                                                                                                    | G9   |
| **D21**     | Squad confuso, sem hierarquia                                                                                      | `SquadScreen` `GroupHome` = pilha de cards (presença, meeting, board, agenda, "build plan", lost, members)                                                                                                                                                           | Reordenar para **Next up → Plano do grupo → Onde está todo mundo → Pinned board → Agenda** (DEC-086/C4)                                                                                                                                                           | G9   |
| **D22**     | Plano do Squad ≠ Meu Plano                                                                                         | `routes/squad/SquadPlanScreen.tsx` usa `.squad-block` (lista) em vez da timeline `.plan-tl`                                                                                                                                                                          | Reusar a receita visual do `MyPlanScreen` (timeline com trilho/dots/cards), com extras do grupo (quem segue/confirmou/criador) (DEC-086/C4)                                                                                                                       | G9   |
| **D23**     | Agenda em tela separada, não entre os sets                                                                         | `SquadPlanScreen` `AgendaBand` (faixa no topo) + `SquadEventsScreen` separada                                                                                                                                                                                        | **Interleave** eventos de grupo entre os sets na timeline (merge só na renderização — ÂNCORA: nunca em `buildSquadPlan`) (DEC-086/C4)                                                                                                                             | G9   |
| **D25**     | Nome do festival truncado feio                                                                                     | `NowScreen` `shorten(name)` corta em 22 chars; `AppHeader` eyebrow                                                                                                                                                                                                   | Tratamento decidido pelo conselho (C-nome): **2 linhas/responsivo** preferido (DEC-087)                                                                                                                                                                           | G10  |


---

## 7. Decisões + conselhos inline (registradas em `decision-log.md` como PROPOSED)

> Cinco conselhos inline (1 request, sem subagents) para os forks reais. Brief neutro → vozes às cegas → red team →
> síntese. Os demais Dxx são decisões diretas (direção clara do Julio) listadas ao fim sem conselho.
> **Viés a resistir em todos:** a inércia do chat empurra "reconstruir do zero a coisa mais ambiciosa"; resistir —
> **reusar o que existe** e entregar a fatia que dá qualidade real com menor superfície (a §4 prova o quanto já existe).

### C1 — DEC-075/076/077 · Mapa: como ficar nítido + marcadores + sem borda · *conselho cheio*

**Decision Brief (neutro):** A base do mapa é um **raster WebP** escalado até 12× → fundo/árvores/terreno pixelam
(D01). Os marcadores de palco já são **overlay vetorial** (nítidos), mas são "círculo+estrela+texto" feios (D02). O
`fitScale` é *contain* → **letterbox preto** (D03). O gerador (`spikes/map-art`, DEC-031/033/034) já separa a arte
do overlay e sabe emitir SVG; a base vetorial deep-zoom é o **caminho de upgrade documentado** de DEC-030/050. Fatos:
o overlay (palcos/pessoas/pins) **nunca** deve ser baked; SVG completo pode pesar; o app é offline-first (cacheia a
base). Lean a resistir: "rebuildar todo o pipeline de mapa em SVG agora".

**Perspectivas (às cegas):**

- **Architect** — A correção de menor superfície e maior ganho: a arte do fundo é o único bitmap; tudo importante já
é vetorial. Servir a base como **SVG** (o spike já projeta a geometria) dá nitidez infinita sem tocar overlay/affine.
Risco: tamanho/parse de um SVG denso. Mitigação: **progressivo** — manter o WebP leve como first-paint, baixar o SVG
em background, trocar quando pronto (o briefing pede exatamente isso). **Rec:** SVG progressivo, raster como
placeholder. **Confidence:** MED. **Outros perdem:** o affine e o overlay **não mudam** — é troca de `<img>` por
`<svg>`/`<img src=svg>` no "world", custo contido.
- **Advocate (usuário)** — O usuário não quer "vetorial", quer **ler os nomes dos palcos e não ver quadradão preto**.
O ganho percebido vem 80% de **(a) marcadores bonitos com label de vidro legível** e **(b) sumir a borda preta** —
ambos baratos. A nitidez do *fundo* importa menos que a dos *rótulos* (que já são vetoriais). **Rec:** priorizar
D02+D03 (baratos, enormes no "parece pronto") e tratar D01 como "tirar o pior da pixelização". **Confidence:** HIGH.
**Outros perdem:** entregar só "SVG perfeito" e deixar marcador feio = ainda parece de outro app.
- **Critic (advogado do diabo)** — Onde quebra: (1) **SVG denso trava** em celular fraco (parse + paint de milhares de
nós OSM) — um raster 2–4× pode dar 90% da nitidez com risco zero de jank; (2) **cap de zoom** — hoje MAX_SCALE=12
borra qualquer raster; precisa **capar ao alcance nítido** da base escolhida; (3) trocar *contain* por *cover* pode
**cortar** stages das bordas → precisa de bleed/centragem. **Rec:** raster de alta-res + cap honesto AGORA; SVG
como tier seguinte medido. **Confidence:** MED. **Outros perdem:** o risco real é **performance/jank**, não a
estética.
- **Domain** — A matemática (affine `geoToSvg`, `panClamp`, `fitScale`) é pura e já testada. *Cover-fit* é uma troca de
`min`→`max` em `fitScale` + clamp já existente; um teste fixa "world cobre a viewport, sem void". O marcador é render
(sem domínio). A base é asset. **Rec:** isolar D03 como mudança pura testável; D01/D02 são asset+render. **Confidence:**
HIGH. **Outros perdem:** dá pra entregar D03 (borda) com teste matemático independente de D01/D02.

**Red Team (matar a opção líder "SVG progressivo já"):** SVG completo de De Schorre pode ter milhares de nós (água,
trilhas, árvores) → parse/paint lento, pior que o raster atual em campo lotado com celular fraco. **Resposta:** por
isso o veredito **separa** D01 (base) de D02/D03 (baratos, primeiro) e trata a base como **progressiva com fallback**:
se o SVG não fechar a conta de performance, um **raster 2–4× + MAX_SCALE capado** entrega a maior parte do ganho sem
risco. Não acoplar o "parece pronto" (D02/D03) ao item mais arriscado (D01).

**Synthesis (Chair):**

- **DEC-077 (D03, primeiro — G2):** `fitScale` default **cover-fit** (preencher a safe rect, recortar bordas com
bleed), letterbox remanescente **tingido com a cor do app** (nunca `#000`), zoom inicial melhor; clamp garante
nunca-void. Teste puro de "cobre a viewport".
- **DEC-076 (D02, G2):** redesenhar marcadores no overlay — ícone limpo + **label com fundo de vidro translúcido**
(Amber-Glass), tipografia legível (sem preto puro sobre o mapa), hierarquia ícone↔nome, escala screen-stable
(reusar `pinScale`). Mantém vetorial (DEC-030/050).
- **DEC-075 (D01, G3, isolado por risco):** **base progressiva** — placeholder raster leve no first-paint, **trocar
para a base de alta-fidelidade quando pronta**. Preferência: **SVG vetorial** (o `spike/map-art` já projeta a
geometria; emitir SVG sem labels), **com fallback medido** para **raster 2–4× + MAX_SCALE capado** se o SVG não
passar no orçamento de performance em celular. Overlay e affine **intactos**.
- **Lente dominante:** **Advocate + Critic** — o valor percebido e o risco mandam: D02/D03 primeiro (baratos,
"parece pronto"), D01 isolado e progressivo (sem comprometer performance). **Confidence:** MED (D01) / HIGH (D02/D03).

### C2 — DEC-079 · Caminhada: sair cedo / chegar tarde / dividir + onde mostrar/ajustar · *conselho cheio*

**Decision Brief (neutro):** Hoje o app já calcula caminhada (`useTravelMatrix`, `buildPlanTimeline`), já modela sair
cedo/chegar tarde (`applyLeaveEarly`/`applyArriveLate`, DEC-074), e tem o `TravelSheet`. Mas: (a) o **destino abre
errado** (D07 — `RouteScreen` recalcula em vez de usar a transição tocada); (b) há **aviso duplicado** (chip do gap
"14 min walk to Freedom" + chip "Leave early for 14 min walk") (D17); (c) o ajuste só é clicável **no modo Editar**
(D18). O briefing pede: entender de onde sai, pra onde vai, quanto leva, se precisa sair antes/chegar atrasado, e
ajustar fácil — **fora** do modo edição também. Lean a resistir: wizard bloqueante.

**Perspectivas (às cegas):**

- **Architect** — Reuso total: a transição já conhece `fromSetId/fromStageName/toStage/walkMinutes`. (a) O link de rota
deve carregar `**from/to/at`** dessa transição (o `RouteScreen` já aceita esses params) — fim do "Mainstage→Mainstage".
(b) Uma **única fonte** por transição: a info mora no card do set anterior (ou num chip único entre os dois), nunca
duplicada no gap. (c) O `TravelChip` vira `<button>` sempre (não só no Editar) → abre o `TravelSheet` existente.
**Rec:** 3 mudanças cirúrgicas, zero domínio novo. **Confidence:** HIGH. **Outros perdem:** tudo já existe; é fiação.
- **Advocate (usuário)** — A decisão "sair cedo / chegar tarde / dividir" é **comum em festival** — tem que ser 1 toque
no chip, com o trade-off **em minutos de música perdida** ("sai 23:20 · perde os últimos 10 min"). Mostrar **dentro
do card do artista anterior** ("Leave early for 14 min walk to Freedom") + manter o **chip "14 min walk" clicável**.
**Rec:** card mostra o aviso, chip dispara o ajuste, fora do Editar. **Confidence:** HIGH. **Outros perdem:** se
exigir entrar no Editar, ninguém ajusta — é decisão de momento.
- **Critic** — Riscos: (1) abrir ajuste fora do Editar pode **mudar o plano sem querer** → o `TravelSheet` já é
explícito (botões rotulados), então ok, mas confirmar com toast/undo; (2) **"dividir o tempo"** (split) o briefing
cita mas o `TravelSheet` hoje só tem leave-early/arrive-late — split é adicionar uma 3ª opção (metade de cada),
ainda via `planEdit` puro; (3) borda caminhada > overlap (perde dos dois lados) → ser honesto. **Rec:** reusar o
sheet, **adicionar split** como 3ª opção, manter tudo em `planEdit`. **Confidence:** MED. **Outros perdem:** o risco
é edição acidental — mitigar com rótulo claro + reversível, não bloquear.
- **Domain** — Intervalo efetivo é função pura (`planSlot`/`planEdit`). Split = derivar dois cortes simétricos que
somam o walk; manter zero-overlap. **Nada** disso toca a agregação do grupo (pessoal). **Rec:** `applySplitTravel`
puro + teste. **Confidence:** HIGH. **Outros perdem:** split bem-feito é "menor perda dos dois lados", o default
esperto.

**Red Team (matar "ajustar fora do Editar"):** ajuste fácil fora do Editar pode gerar mudanças acidentais no plano
travado. **Resposta:** o `TravelSheet` **não** muda nada sozinho — só ao tocar um botão rotulado com a consequência;
e a mudança é reversível ("usar o padrão de novo" já existe). O ganho (decisão de 1 toque) supera o risco mitigado.

**Synthesis (Chair):**

- **Veredito (DEC-079):** (1) o chip/gap de caminhada navega para `/route` com `**from/to/at` da transição tocada**
(conserta D07); endurecer o default do `RouteScreen` p/ `to≠from`. (2) **Uma única fonte** por transição: o aviso
"Leave early for {n} min walk to {stage}" vive no **card do set anterior**; o **gap** mostra só pausa livre (mata o
duplicado D17). (3) O **chip de caminhada é clicável sempre** (D18) → abre o `TravelSheet` com **3 opções**
(sair cedo / chegar tarde / **dividir**) rotuladas em **minutos de música perdida** + reversível; toast de confirmação.
- **Onde fica:** dentro do card (aviso) + chip (ação), **dentro e fora** do Editar.
- **Lente dominante:** **Advocate + Architect** (UX de momento + reuso). **Confidence:** HIGH.

### C3 — DEC-080 · Imagem de compartilhamento (story vs quadrado, não esconder em "+3") · *conselho cheio*

**Decision Brief (neutro):** O poster (`lib/planPoster.ts`) é desenhado em canvas. Defeitos confirmados: capacidade
pequena → **"+N more" esconde sets** (square esconde mais); **"0 CLASHES" hardcoded** + cálculo de posição torto;
**sem fotos** dos DJs; nomes pequenos; layout à esquerda. O briefing: mostrar **todos os sets**, **fotos**, horário,
palco, conflitos claros, corrigir quebra de texto, usar o espaço horizontal, story (lista vertical) vs quadrado
(compacto/colunas/múltiplas imagens), oferecer "Resumo" ou "Plano completo". Lean a resistir: "refazer o poster do
zero com um motor de layout genérico".

**Perspectivas (às cegas):**

- **Architect** — `buildPosterRows` (puro, testado) é o ponto de extensão: trocar o **corte por "+N"** por
**densidade adaptativa** — calcular `rowH` para caber **todos** os sets (até um piso de legibilidade); acima do piso,
**2 colunas** (square) ou **paginar em múltiplas imagens** (Web Share aceita N arquivos). Fotos: passar `imageUrl`
por linha e `drawImage` no canvas (pré-carregar com `Image()` + `await`). **Rec:** estender o puro + carregar fotos;
não reescrever o motor. **Confidence:** HIGH. **Outros perdem:** "+N" sai; densidade entra; teste do puro garante
"todos os sets ou paginação".
- **Advocate (usuário)** — A pessoa compartilha pra **mostrar os sets que vai ver** — esconder a maioria mata o
propósito. Story = lista vertical completa (cabe muita coisa em 9:16). Square = ou compacto 2-col ou "escolher
Resumo/Completo". **Fotos** dos DJs é o que dá "vontade de postar" (infográfico). **Rec:** story mostra tudo;
square oferece Resumo (top N) **ou** Completo (multi-imagem). **Confidence:** HIGH. **Outros perdem:** sem foto, é só
uma lista — não viraliza.
- **Critic** — Riscos: (1) **CORS/canvas tainted** — as fotos vêm do CDN da Tomorrowland; desenhar no canvas e exportar
PNG exige `crossOrigin="anonymous"` + CDN com `Access-Control-Allow-Origin` (senão `toBlob` lança "tainted"); precisa
testar/fallback (placeholder de iniciais se a foto falhar). (2) muitos sets → fonte minúscula; o piso de legibilidade
  - paginação resolve. (3) tempo de render com N imagens — pré-carregar em paralelo. **Rec:** **fallback de foto
  obrigatório** + piso de fonte + paginação. **Confidence:** MED. **Outros perdem:** o risco real é **CORS tainted
  canvas**, não o layout.
- **Domain** — `buildPosterRows` deve retornar **páginas** (`PosterPage[]`) em vez de `{rows, overflow}`: dado `format`
e contagem, decidir 1 imagem (cabe) ou N (pagina). Cálculo de clashes real (overlaps nos slots) substitui o "0"
hardcoded. Puro + teste. **Confidence:** HIGH. **Outros perdem:** transformar "overflow" em "paginação" é a mudança
central e é pura/testável.

**Red Team (matar "fotos no poster"):** fotos do CDN podem **tingir o canvas** (CORS) → `toBlob` falha e o
compartilhamento quebra de vez (pior que hoje). **Resposta:** verificar o header CORS do CDN da Tomorrowland (já
usamos `?width=` em `<img>`); se permitir, `crossOrigin="anonymous"` resolve; **se não**, fallback = avatar de
iniciais coloridas desenhado no canvas (já temos `readableInkOn`) — o poster fica bonito sem depender da foto. Nunca
deixar a foto quebrar o export.

**Synthesis (Chair):**

- **Veredito (DEC-080):** reescrever `buildPosterRows` → `**buildPosterPages`** (puro): densidade adaptativa que cabe
**todos os sets** até um piso; acima, **paginação** (multi-imagem) ou 2-col (square). **Fotos** dos DJs no canvas via
`Image()` + `crossOrigin` **com fallback de iniciais** se CORS/erro. **Clashes reais** (não "0"). Story = lista
vertical completa; Square = **toggle "Resumo / Plano completo"**. URL final (DEC-080 ⊃ D26). Hierarquia: nome maior,
usar o espaço horizontal, corrigir quebra/tracking.
- **Pré-checagem obrigatória (G5 milestone 1):** confirmar CORS do CDN; se bloquear, fallback de iniciais é o caminho.
- **Lente dominante:** **Advocate + Domain** (propósito + a paginação pura). **Confidence:** HIGH (layout) / MED (CORS).

### C4 — DEC-086 · Estrutura do Squad (Next up, plano = Meu Plano, agenda interleaved) · *conselho cheio*

**Decision Brief (neutro):** O Squad tem tudo, mas **espalhado**: `SquadScreen` é uma pilha de cards sem hierarquia;
`SquadPlanScreen` usa `.squad-block` (≠ a timeline bonita do `MyPlanScreen`); a agenda (eventos de grupo, DEC-D2 Fase 8)
é **tela separada** + uma `AgendaBand`, não interleaved entre os sets. O briefing quer: ao entrar no Squad, entender
rápido **o que o grupo vai fazer agora**, ordem **Next up → Plano → Onde está todo mundo → Pinned board → Agenda**, o
plano do grupo **parecido com Meu Plano**, e a agenda **misturada** ao plano (entre os sets). ÂNCORA dura: o plano de
grupo continua sendo **só sets** (`buildSquadPlan` puro); eventos são camada paralela (render-only). Lean a resistir:
recriar todo o squad.

**Perspectivas (às cegas):**

- **Advocate (usuário)** — O valor é **"o que a gente faz agora"**. Topo = **Squad Next up** (próximo set/evento do
grupo + presença resumida). Depois o **plano** com a cara do Meu Plano (familiar). Depois "onde está todo mundo",
board, agenda. **Rec:** reordenar + Next up no topo; reusar o visual do Meu Plano. **Confidence:** HIGH. **Outros
perdem:** sem o Next up, o squad é "informação solta" (a queixa exata).
- **Architect** — Reuso máximo: extrair a **receita visual** do `MyPlanScreen` (trilho/dots/cards = `.plan-tl`) num
componente compartilhado que o `SquadPlanScreen` consome (com extras do grupo: quem segue/confirmou/criador). Os
eventos **interleavam só na renderização** — merge por `startUtc` numa lane visual, **nunca** em `buildSquadPlan`
(ÂNCORA). O "Next up" reusa `useGroupEvents`/`useGroupPresence`/`useMeetingPoints` (já existem). **Rec:** componente
de timeline compartilhado + merge-render. **Confidence:** MED (refator do visual tem custo). **Outros perdem:** se
duplicar o visual em vez de compartilhar, os dois divergem na próxima mudança.
- **Critic** — Riscos: (1) **regressão do lock** — qualquer toque no plano de grupo não pode fazer evento entrar na
agregação; teste de regressão obrigatório ("evento/bloco não altera `SquadPlan`"). (2) escopo P2 grande → pode
estourar o gate; dividir em sub-milestones (Next up → reorg → plano-como-MyPlan → agenda-interleaved). (3) abas
"Meu plano/Squad" no Now (D24) podem inchar a Home — gated a ter squad. **Rec:** dividir; teste de regressão do lock
em cada milestone. **Confidence:** MED. **Outros perdem:** o risco é **acoplar agenda à agregação** — proibido.
- **Domain** — `buildSquadPlan` permanece puro e só-sets. A timeline mesclada é uma **função de view** que recebe
`blocks` (sets agregados) + `events` e devolve itens ordenados marcados por tipo — sem tocar a agregação. **Rec:**
`mergeSquadTimeline(setBlocks, events)` puro + teste de que eventos não entram na agregação. **Confidence:** HIGH.

**Red Team (matar "interleave a agenda no plano"):** misturar eventos no plano arrisca poluir a regra-mãe (plano de
grupo = só sets). **Resposta:** o merge é **só de renderização** (uma lane visual ordenada por tempo); `buildSquadPlan`
não muda; um **teste de regressão** assa "evento não altera o SquadPlan". Conflito evento×set = **só rótulo**
("durante BlackCoffee"), nunca resolução.

**Synthesis (Chair):**

- **Veredito (DEC-086):** (1) **Squad Next up** no topo do Squad (+ no Now, abas "Meu plano / Squad" gated a ter squad,
D20/D24); (2) **reordenar** o Squad: Next up → Plano → Onde está todo mundo → Pinned board → Agenda (D21); (3) o
**plano do grupo reusa a timeline do Meu Plano** (componente compartilhado) com extras do grupo (D22); (4) **agenda
interleaved** na timeline via `mergeSquadTimeline` **render-only** (D23). ÂNCORA: `buildSquadPlan` intocado +
teste de regressão em todo milestone.
- **Sub-milestones (G9):** Next up → reorg → plano-como-MyPlan → agenda-interleaved (cada um deployável).
- **Lente dominante:** **Advocate + Domain** (clareza + pureza da agregação). **Confidence:** MED.

### C5 — DEC-087 (nome do festival) + tradução de "Squad" · *conselho rápido*

**Brief:** (a) Na home o nome "Tomorrowland Belgium 2026" é truncado em 22 chars (`shorten`) → "Tomorrowland Belgium…".
O briefing pede avaliar: truncar / 2 linhas / só "Tomorrowland" / subtítulo "Belgium 2026" / fonte menor / outro
layout. (b) Traduzir "Squad" → "Grupo" ou manter "Squad"?

- **Advocate** — (a) Truncar com "…" parece quebrado/inacabado (a queixa). O nome é **identidade** — mostrar inteiro,
em **2 linhas** ("Tomorrowland" / "Belgium 2026" como subtítulo) ou fonte responsiva que encolhe até caber, é o mais
bonito e claro. (b) "Squad" já é usado em PT informal e é o nome de marca da feature; "Grupo" é mais neutro. **Rec:**
(a) **2 linhas / responsivo, sem "…"**; (b) **manter "Squad"** (string única, marca). **Confidence:** MED.
- **Critic** — (a) 2 linhas pode empurrar o layout do header; um eyebrow ("Tomorrowland Belgium") + título da tela
("Now & Next") já existe — talvez o nome inteiro caiba reduzindo a fonte/aumentando largura, sem 2 linhas. (b)
traduzir "Squad"→"Grupo" mexe em muitas strings e na aba; manter "Squad" é menos risco e consistente com o ícone.
**Rec:** (a) **fonte responsiva que encolhe até caber** (sem "…", sem quebrar a tela); 2 linhas só se não couber;
(b) **manter "Squad"** (já é a label da aba/nav; PT pode usar "Squad"). **Confidence:** MED.
- **Synthesis (DEC-087 + DEC-082 nota):** (a) **nome do festival sem "…"** — fonte responsiva que encolhe até caber, e
**2 linhas** (nome + "Belgium 2026" como subtítulo) quando ainda não couber; nunca cortar com reticências na home;
(b) **"Squad" permanece "Squad"** em PT (label de marca/nav) — registrado em DEC-082. Detalhe final do layout do nome
fica **AGUARDANDO LOCK §16** (Julio pode preferir "só Tomorrowland"). **Confidence:** MED.

### Decisões diretas (sem conselho — direção clara do Julio)

- **DEC-078 (D05/D06)** — Sheets/menus flutuantes são **portalados para `document.body` + `position: fixed`** (base
`Sheet` via `createPortal`), matando a classe inteira de "preso na página". Mantém drag/Esc/focus-trap.
- **DEC-081 (D09)** — Meu Plano permite **inserir entre dois cards** (bloco ou set) com sheet "de onde vem o tempo?"
(sair antes do anterior / chegar depois no próximo / dividir / manual), reusando `planEdit` (DEC-073/074). Pessoal,
zero-overlap, filtrado do grupo.
- **DEC-082 (D04)** — i18n cobre **todas as telas principais** (chaves EN+PT, literais → `t()`), dias da semana
traduzidos, revisão de overflow; **"Squad" permanece "Squad"** (C5).
- **DEC-083 (D12)** — Timetable ordena palcos por **contagem de favoritos desc** quando há favoritos (tiebreak
sortOrder); senão ordem da fonte.
- **DEC-084 (D14)** — Botão Lock-in reflete o **estado planejado** do dia ("Dia planejado" / "Editar plano").
- **DEC-085 (D15)** — Pinça: **um passo por gesto** + limiar maior + transição animada entre níveis.
- **DEC-088 (D11)** — `theme-color` **dinâmico** (day/night), auditoria de safe-area, e **documentação** do plugin
Capacitor StatusBar/NavigationBar para o shell nativo futuro (não construir agora — é PWA).
- Pequenos sem DEC próprio (caem nas ACs do gate): D10 avatar (CSS), D13 gridlines (CSS), D16 colapsar favoritos
(estado local), D19 haptic de aba.

> Confidence geral: **HIGH** para as diretas e C2/C4-domínio; **MED** para C1-base-do-mapa (risco de performance) e
> C3-fotos (CORS) e o layout do nome (C5). Os MED carregam fallback explícito no gate.

---

## 8. Estratégia de testes (teste JUNTO com a correção — é o gate)

Reusar a estratégia dos orchestrators irmãos (Vitest + Testing Library + Playwright + shim de migração D1 `sql.js`).
Por `test-routing.mdc`: escreva e rode testes **direto** (sem subagents, sem Task tool).

- **Toda correção de lógica é um teste unitário de domínio com números concretos:** `fitScale` cover-fit (D03),
ordenação de palcos por favoritos (D12), `usePinch` um-passo-por-gesto (D15), `buildPosterPages` paginação + clashes
(D08), `applySplitTravel` (D07/C2), `mergeSquadTimeline` render-only (D23). Puras em `web/src/domain/`**.
- **Guardas de regressão dos invariantes:** zero-overlap continua após D09/D07 (split/insert); `**buildSquadPlan`
inalterado** após D23 (evento não entra na agregação — teste explícito); presença grosseira; offline read.
- **Golden-path smoke (passa em todo gate):** (1) carregar festival+lineup → (2) favoritar + **Lock in** plano
sem-conflito → (3) abrir o **mapa** (palcos nítidos, sem void preto) → (4) abrir um **sheet** (não gruda no scroll) →
(5) compartilhar (poster com todos os sets) → (6) squad: ver o Next up. Estender por gate.
- **Comandos (de `FestPilot/`, `nvm use 22` primeiro):** `npm run typecheck && npm run test && npm run build`;
E2E `npm --workspace @festpilot/web run test:e2e`.
- **"Suíte verde entre gates"** = 0 falhas **além do baseline documentado em G0**. Cobertura: >90% no domínio mexido,
  > 70% na UI crítica mexida.

---

## 9. Protocolo por milestone + refresh de contexto

**Por correção (milestone):** ler a linha da §6 + o arquivo citado → corrigir domínio/dados → corrigir UI → escrever/
estender o teste do invariante → `typecheck && test && build` verde → **um commit** → entrada no `dev-log.md` → próximo.

**Self-check de 5 pontos (antes de cada commit):** 1) nomear o(s) Dxx + DEC(s) satisfeitos; 2) nomear **3 ACs
anteriores em risco de regressão** e verificá-los (esp. zero-overlap, `buildSquadPlan` só-sets, presença grosseira,
sheets ainda fixos); 3) testes verdes, **sem NOVAS falhas**; 4) sinalizar arquivos tocados **fora** do escopo; 5)
entrada no dev-log.

**Fronteira de gate:** suíte + itens cumulativos verdes; build + tsc OK; smoke de 3 jornadas; **deploy** (Pages
`--branch=master`, nunca preview, + Worker se mexeu) e capturar a URL; bump de versão (`web/package.json` +
`changelog.ts`); promover DECs PROPOSED→APPROVED; atualizar dev-log; **reler §3 + a §10 do próximo gate**; imprimir o
ANCHOR + CURRENT STATE.

**ANCHOR (reimprimir a cada ~3 milestones / fronteira de gate):** *Sem subagents. Sem pedir pra avançar — nunca, entre
unidades. Não pare num milestone/gate; commit + deploy + dev-log e continue. Ambiguidade → conselho-na-hora + DEC.
Código em inglês, UI via `t()`. Domínio antes da UI. Teste o invariante. Plano zero-overlap; grupo = só sets; presença
grosseira. Sheets portalados/fixed. Mapa nunca pixela o importante / nunca borda preta. Preserve o que funciona.
Commit por correção; deploy + dev-log por gate. `nvm use 22`, `git --no-pager`, `git commit -m`, Pages `--branch=master`.*

---

## 10. O BUILD — gates G0 → G10

> Legenda: 🔨 fazer agora · ✅ feito · ⏳ precisa credencial/asset do operador.
> Construa de cima pra baixo. Cada gate fecha com suíte verde + deploy + dev-log + bump. **P2 (G9/G10) é
> opcional-se-houver-folga**; sem folga, registre como adiado no dev-log e pare limpo.

### G0 — Setup & baseline 🔨

- Ler §0–§9 + `dev-log.md`. `nvm use 22`. Confirmar `npm run typecheck && npm run test && npm run build` **verde** na
árvore atual **antes de tocar em nada** (baseline: 677 unit + e2e 30/30). Registrar as contagens.
- Semear seção no `dev-log.md`: "Leva Review & Polish (2026-06-27)" com o checklist G0…G10.
- Registrar **DEC-075→DEC-088** como PROPOSED em `decision-log.md` (já feito no authoring — só verificar). Back-fill
curto de **DEC-073/074** (PlanBlock/travel choice) que o código cita mas o log não tem (housekeeping, 1 entrada).
- Confirmar o pipeline de deploy (Pages `festpilot` master + Worker). **Commit:** `chore(review): baseline verde + DECs 075..088 para a leva review-polish`.

### G1 — Bugs cirúrgicos: menus presos, foto da home, caminhada errada 🔨 (P0, baixo risco, alta confiança)

**Por quê:** briefing #14/#20 (menus presos), #5 (foto), #15 (destino da caminhada). Vitórias rápidas que provam o pipeline.

- **G1.1 — Sheets portalados + fixed (D05/D06, DEC-078).** *(§6)* Em `ui/Sheet.tsx`, renderizar scrim+sheet via
`createPortal(…, document.body)`; em `styles.css`, `.scrim`/`.sheet` → `position: fixed`. Preservar drag/Esc/
focus-trap/scroll-lock. **AC:** abrir qualquer sheet (PlanItemMenu via `more_vert` com a página rolada, Share,
ArtistSheet) → fica **preso na parte de baixo da viewport**, não sobe com o scroll. **Testes:** o teste DOM de
`Sheet` continua verde (foco/Esc/drag); um teste afirma que o nó é filho de `document.body`. **Commit:**
`fix(ui): portal bottom sheets to body + fixed positioning (DEC-078)`.
- **G1.2 — Foto de perfil circular na home (D10).** *(§6)* `styles.css` `.ava { overflow: hidden }` + garantir
`.ava-img` cobre (object-fit:cover, w/h 100%); alinhar ao `ui/Avatar.tsx`. **AC:** avatar da home é círculo perfeito,
sem borda âmbar vazando; idêntico ao do perfil. **Testes:** render check do `AppHeader` com `avatarUrl`. **Commit:**
`fix(home): perfectly circular header avatar — no amber bleed`.
- **G1.3 — Caminhada abre a transição certa (D07, DEC-079).** *(§6)* Em `MyPlanScreen`, o gap/chip de caminhada navega
`/route?from=<fromStageId>&to=<toStageId>&at=<startMs>&day=<dayKey>`; endurecer `RouteScreen` p/ `to≠from` no default.
**AC:** tocar "14 min walk to Freedom" abre "Walk … to Freedom" (origem e destino corretos), nunca "Mainstage →
Mainstage". **Testes:** unit do parsing de params do `RouteScreen` (from/to/at); e2e do fluxo plano→walk. **Commit:**
`fix(route): open the exact tapped transition (from/to/at), not a recomputed leg (DEC-079)`.
- **Fecha G1:** deploy (frontend-only) **v0.32.0**; dev-log.

### G2 — Mapa: marcadores, labels & enquadramento 🔨 (P0 mapa, metade barata)

**Por quê:** #2 (marcadores feios), #3 (borda preta). "Parece pronto" por baixo custo.

- **G2.1 — Sem borda preta / cover-fit (D03, DEC-077).** *(§6)* `map/panClamp.ts` `fitScale` → **cover** (preencher a
safe rect); letterbox remanescente tingido com a cor do app (`.map`/`.world` bg ≠ `#000`); `fitView`/clamp ajustados;
melhor zoom inicial. **AC:** abrir o mapa nunca mostra borda/void preto; arrastar até as bordas não revela preto.
**Testes:** unit puro de cover-fit (world cobre a viewport em vários tamanhos/escala). **Commit:**
`fix(map): cover-fit framing + app-tinted background — kill the black border (DEC-077)`.
- **G2.2 — Marcadores + labels de palco redesenhados (D02, DEC-076).** *(§6)* `map/MapView.tsx` + `styles.css`: ícone
limpo, **label com fundo de vidro translúcido** (sem preto puro), tipografia legível, hierarquia ícone↔nome, escala
screen-stable (`pinScale`). Mantém vetorial (DEC-030/050). **AC:** dá pra identificar cada palco rápido em qualquer
zoom; combina com o Amber-Glass. **Testes:** render check de que o label é overlay (não a base). **Commit:**
`feat(map): redesigned glass stage markers + legible labels (DEC-076)`.
- **Fecha G2:** deploy **v0.33.0**; dev-log. (Se a base raster precisar regenerar sem labels, é só G3.)

### G3 — Mapa: base nítida no zoom 🔨 (P0 mapa, maior risco — gate próprio)

**Por quê:** #1 (fundo/árvores/terreno pixelam). O item mais arriscado → isolado.

- **G3.1 — Base progressiva de alta-fidelidade (D01, DEC-075).** *(§6 + C1)* Servir uma **base vetorial SVG**
(preferida; `spikes/map-art` projeta a geometria — emitir SVG sem labels) **OU**, se o SVG não passar no orçamento de
performance em celular, **raster 2–4× + MAX_SCALE capado ao alcance nítido**; **estratégia progressiva** (placeholder
leve no first-paint → trocar quando a base de alta-fidelidade carregar). Overlay + affine **intactos**. **AC:** ao dar
zoom, fundo/nomes/ícones/pessoas continuam nítidos; nada importante pixela; first-paint não regride. **Testes:** o
smoke do mapa segue verde; um check de que o overlay continua vetorial e o affine inalterado. **⏳ se** o asset de
alta-fidelidade exigir rodar o spike/gerador localmente — nesse caso entregar a troca progressiva + cap honesto e
marcar o asset final como ⏳ no dev-log. **Commit:** `feat(map): crisp progressive high-fidelity base; honest zoom cap (DEC-075)`.
- **Fecha G3:** deploy **v0.34.0**; dev-log. **Fecha o "principal alerta" do Julio (o mapa).**

### G4 — Português em todas as telas 🔨 (P0)

**Por quê:** #21 (PT incompleto). Mecânico mas cuidadoso.

- **G4.1 — Chaves + fiação por tela (D04, DEC-082).** *(§6)* Adicionar chaves EN+PT para Now, Line-up, Timetable, Meu
Plano, Mapa, Squad e labels citadas ("Your Favorites"→"Seus favoritos", "All artists"→"Todos os artistas",
"Favorites"→"Favoritos", "All days"→"Todos os dias", "Next up"→"A seguir", etc.); trocar literais por `t()`. **Dias
da semana** (`lib/festival.ts`/`format.ts`) traduzidos (Friday→Sexta, Fri→Sex…). **"Squad" permanece "Squad"** (C5).
**AC:** com o app em PT, **nenhum** texto em inglês nas telas principais; botões não estouram (overflow revisado).
**Testes:** unit que uma string de cada tela vira PT no switch; e2e troca idioma → navegação/labels em PT. **Commit(s):**
um por tela, `feat(i18n): translate <screen> (DEC-082)`.
- **Fecha G4:** deploy **v0.35.0**; dev-log.

### G5 — Imagem de compartilhamento v2 🔨 (P0)

**Por quê:** #18 (poster fraco), #19 (URL).

- **G5.1 — Checar CORS do CDN (C3 pré-requisito).** Confirmar se o CDN de fotos da Tomorrowland permite `crossOrigin`
no canvas; decidir foto-real vs fallback-iniciais. Registrar no dev-log. **Commit:** (parte do G5.2).
- **G5.2 — Poster paginado, com fotos, todos os sets (D08, DEC-080).** *(§6 + C3)* `lib/planPoster.ts`:
`buildPosterRows` → `**buildPosterPages`** (puro) com densidade adaptativa que cabe **todos os sets** (piso de
legibilidade → paginação multi-imagem / 2-col no square); **fotos** dos DJs no canvas (`Image()` + `crossOrigin`,
**fallback de iniciais** se CORS/erro); **clashes reais** (não "0"); hierarquia (nome maior, usar largura, corrigir
quebra/tracking). Story = lista vertical completa; Square = toggle **"Resumo / Plano completo"**. **AC:** o poster
mostra **todos** os sets (ou pagina), com fotos ou fallback, sem "+N" escondendo a maioria, texto sem quebrar.
**Testes:** unit de `buildPosterPages` (cabe-tudo vs pagina; contagem de clashes). **Commit:**
`feat(share): poster v2 — all sets, DJ photos, real clashes, story/square (DEC-080)`.
- **G5.3 — URL final (D26, DEC-080).** *(§6)* Trocar `appOrigin()` por a URL pública final (constante/env). **LOCK
§16:** domínio final (com/sem www). **AC:** a imagem mostra uma URL limpa e final. **Commit:** `fix(share): final public URL`.
- **Fecha G5:** deploy **v0.36.0**; dev-log.

### G6 — Meu Plano: inserir entre cards + clareza de caminhada 🔨 (P0 #9 + P1 #16/#17)

**Por quê:** #12/#13 (inserir entre cards), #16 (duplicado), #17 (ajuste fora do Editar).

- **G6.1 — "de onde vem o tempo?" + inserir entre cards (D09, DEC-081).** *(§6 + C2)* Affordance **"+" entre qualquer
par de cards** (não só em gaps grandes); sheet que pergunta **sair antes do anterior / chegar depois no próximo /
dividir / horário manual**, reusando `applyLeaveEarly`/`applyArriveLate` (DEC-074) + `addBlock`/`addToPlan` (DEC-073).
Bloco e set. **AC:** inserir água/banheiro/comida/outro set entre Alok e Avicii sem recriar o plano; zero-overlap
mantido; pessoal (não vaza pro grupo). **Testes:** unit que insert/carve mantém zero-overlap; e2e inserir entre dois
cards. **Commit:** `feat(my-plan): insert blocks/sets between any two cards with time-source choice (DEC-081)`.
- **G6.2 — Caminhada sem duplicar + ajuste fora do Editar + split (D17/D18, DEC-079).** *(§6 + C2)* Consolidar o aviso
numa única fonte (no card do set anterior; gap só pausa); `TravelChip` clicável **sempre** → `TravelSheet` com **3ª
opção "dividir"** (`applySplitTravel` puro) + toast/undo. **AC:** nenhuma transição mostra aviso duplicado; tocar o
chip fora do Editar abre as opções rotuladas em minutos perdidos. **Testes:** unit `applySplitTravel`; e2e ajustar
caminhada fora do Editar. **Commit:** `feat(my-plan): single walk source + tap-to-adjust outside edit + split (DEC-079)`.
- **Fecha G6:** deploy **v0.37.0**; dev-log. **Fecha todo o P0.**

### G7 — Timetable & Line-up: polimento 🔨 (P1)

**Por quê:** #7/#8/#9/#10/#11/#22 (6 milestones — teto do gate).

- **G7.1 — Palcos por favoritos (D12, DEC-083).** `domain/timetable.ts` ordena por favCount desc quando há favoritos.
**Teste:** unit de ordenação. **Commit:** `feat(timetable): order stages by favorite count (DEC-083)`.
- **G7.2 — Contraste dos gridlines (D13).** `styles.css` `.gl` ~+15–20%, `.gl.half` leve. **Commit:** `style(timetable): stronger time gridlines`.
- **G7.3 — Estado do Lock-in (D14, DEC-084).** `TimetableScreen` lê plano do dia → "Dia planejado"/"Editar plano" + i18n.
**Commit:** `feat(timetable): lock-in button reflects planned day (DEC-084)`.
- **G7.4 — Pinça suave (D15, DEC-085).** `lib/usePinch.ts` um-passo-por-gesto + limiar maior; transição animada no
grid/zoom. **Teste:** unit do gesto (uma pinça = um passo). **Commit:** `fix(gesture): smooth one-step pinch (DEC-085)`.
- **G7.5 — Colapsar favoritos (D16).** `LineupScreen` header da seção "YOUR FAVORITES" vira toggle (aberto por padrão;
lembra na sessão). **Commit:** `feat(lineup): collapsible Your Favorites section`.
- **G7.6 — Haptic de aba (D19).** `BottomNav` dispara haptic leve ao trocar p/ aba diferente. **Commit:** `feat(nav): haptic on tab change`.
- **Fecha G7:** deploy **v0.38.0**; dev-log.

### G8 — Barras do sistema 🔨 (P1)

**Por quê:** #6.

- **G8.1 — `theme-color` dinâmico + safe-area + doc Capacitor (D11, DEC-088).** `theme-color` acompanha day/night (via
JS), auditoria de `--safe-top/bottom` ponta-a-ponta, **documentar** `@capacitor/status-bar` (overlay) + NavigationBar
para o shell nativo futuro (não construir — é PWA). **AC:** standalone com `theme-color` correto por palette; safe-areas
ok; doc do nativo registrada. **Commit:** `feat(chrome): dynamic theme-color + safe-area audit + native status-bar doc (DEC-088)`.
- **Fecha G8:** deploy **v0.39.0**; dev-log. **Fecha P1.**

### G9 — Paridade do Squad 🔨 (P1/P2 — opcional se houver folga)

**Por quê:** #24/#23/#25/#26. Sub-milestones (C4); teste de regressão do lock em cada um.

- **G9.1 — Squad "Next up" (+ abas no Now) (D20/D24, DEC-086).** Card/abas "Meu plano / Squad" no Now (gated a ter
squad) + Next up no topo do Squad, reusando hooks existentes. **Commit:** `feat(squad): squad Next up + Now tabs (DEC-086)`.
- **G9.2 — Reorganizar a home do Squad (D21).** Ordem Next up → Plano → Onde está todo mundo → Board → Agenda. **Commit:**
`feat(squad): reorganize squad home hierarchy (DEC-086)`.
- **G9.3 — Plano do grupo = timeline do Meu Plano (D22).** Extrair a receita visual do `MyPlanScreen` num componente
compartilhado; `SquadPlanScreen` consome (com extras do grupo). **Commit:** `feat(squad): squad plan reuses My Plan timeline (DEC-086)`.
- **G9.4 — Agenda interleaved (D23).** `mergeSquadTimeline(setBlocks, events)` **render-only**; eventos entre os sets;
conflito = só rótulo. **Teste de regressão:** `buildSquadPlan` inalterado (evento não entra na agregação). **Commit:**
`feat(squad): interleave group agenda into the plan timeline (render-only) (DEC-086)`.
- **Fecha G9:** deploy **v0.40.0**; dev-log.

### G10 — Nome do festival + polimento final 🔨 (P2 — opcional)

**Por quê:** #4.

- **G10.1 — Nome do festival sem "…" (D25, DEC-087).** `NowScreen`/`AppHeader`: fonte responsiva que encolhe até caber;
2 linhas (nome + "Belgium 2026" subtítulo) quando não couber; **AGUARDANDO LOCK §16** se o Julio preferir "só
Tomorrowland". **AC:** o nome fica bonito e claro sem quebrar a tela nem cortar com reticências. **Commit:**
`fix(home): festival name treatment — no ellipsis (DEC-087)`.
- **Fecha G10:** deploy **v0.41.0**; dev-log. **Fecha a leva.**

---

## 11. Tabela de problemas (situação → ação) + segurança de pager WSL


| Situação                                                      | Ação                                                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qualquer git read** (`log`/`diff`/`show`/`status`)          | Sempre `git --no-pager …`; commit só com `-m`/HEREDOC. Nunca `-i`/interativo, nunca `less`/`vim`.                                                          |
| Comando trava >30s sem output                                 | Não re-rode/espere. Leia o arquivo do terminal p/ achar o pid do bash; `ps` por `less`/editor preso; mate.                                                 |
| `wrangler`/`vite` falha no Node 18/20                         | `nvm use 22` primeiro.                                                                                                                                     |
| Fotos no poster tingem o canvas (CORS)                        | `crossOrigin="anonymous"`; se o CDN não permitir → **fallback de iniciais** desenhado no canvas (C3). Nunca deixar a foto quebrar o export.                |
| Base de mapa de alta-fidelidade precisa rodar o gerador local | Entregar a troca **progressiva** + cap honesto; marcar o asset final como ⏳ no dev-log; seguir.                                                            |
| Deploy ao vivo precisa de credencial que você não tem         | Rode o equivalente `--local`/`wrangler dev`, marque ⏳, continue.                                                                                           |
| Daemon de browser/screenshot trava (WSL)                      | Não bloqueie na verificação visual; verifique por testes + build; deixe nota "rodar localmente".                                                           |
| Mudança contradiz uma decisão do brain                        | Se é direção do Julio (esta revisão), adote como `DEC-NNN` PROPOSED (§7) e siga; senão pegue o default consistente e escreva o DEC.                        |
| Testes falham após uma mudança                                | Recovery §9; conserte pra frente com novo commit; nunca `--amend` em trabalho já pushado.                                                                  |
| Pages deploy aparece como **Preview**                         | Deploy com `wrangler pages deploy web/dist --project-name=festpilot --branch=master`; confirme que caiu em **Production** (master), não preview (DEC-037). |
| Ambiguidade genuína, brain em silêncio                        | Rode o conselho inline **agora** (1 request, sem subagents), registre `DEC-NNN` PROPOSED, **continue** — nunca pare pra perguntar (DEC-056).               |


---

## 12. Definition of Done / Critérios de parada

**Um gate está pronto quando:** seus testes + itens cumulativos passam; `typecheck`/`test`/`build` limpos; o smoke de
3 jornadas passa; deployado (ou ⏳ com prova local); commitado; dev-log atualizado.

**Chegar a um gate NUNCA é razão pra parar ou pedir permissão** — commit, deploy, dev-log e continue (DEC-056). Pare só
no hand-off terminal. **A leva está pronta — PARE só quando TODOS forem TRUE:**

- [ ] **P0 corrigido:** mapa nítido no zoom (D01) + marcadores bonitos/legíveis (D02) + sem borda preta (D03); PT em
  todas as telas (D04); sheets/menus não grudam no scroll (D05/D06); caminhada com origem/destino certos (D07); poster
  mostra todos os sets com fotos (D08); inserir entre cards funciona (D09); foto da home circular (D10).
- [ ] **P1 corrigido:** barras do sistema (D11); palcos por favoritos (D12); gridlines mais fortes (D13); botão Lock-in
  reflete o estado (D14); pinça suave (D15); favoritos colapsáveis (D16); caminhada sem duplicar + ajuste fora do Editar
  (D17/D18); haptic de aba (D19); Squad Next up (D20).
- [ ] **P2 corrigido OU adiado-com-nota:** Squad reorganizado (D21), plano = Meu Plano (D22), agenda interleaved (D23),
  Now↔Squad (D24), nome do festival (D25), domínio (D26).
- [ ] **Invariantes intactos:** zero-overlap; `buildSquadPlan` só-sets (evento/bloco não entram); presença grosseira;
  sheets fixos/portalados; nada baked no mapa.
- [ ] Suíte cheia verde (unit + integração + e2e), sem novas falhas além do baseline G0; cobertura nos alvos.
- [ ] `dev-log.md`, `decision-log.md` (DEC-075→088 APPROVED) e `project-status.md` atuais; deployado em Pages **(master,
  não preview)** + Worker (se mexeu).
- [ ] Matriz de smoke manual (§15) passa no celular, ou está documentada com o que é ⏳.

---

## 13. Anti-padrões (NÃO faça)

- ❌ Reconstruir telas/fluxos que já funcionam em vez de consertar (§0/§4). A maior parte desta leva é **expor/polir/
consertar** o que já existe (blocos, travel choice, sheets, i18n, squad).
- ❌ Acoplar a agenda do squad à agregação (`buildSquadPlan` deve continuar só-sets — ÂNCORA D23).
- ❌ Deixar a foto do poster **quebrar o export** (CORS) — fallback de iniciais obrigatório.
- ❌ Trocar o resolver pra um plano poder ter overlap; "consertar" a caminhada sem manter zero-overlap.
- ❌ Acoplar o item arriscado do mapa (D01 base) aos baratos (D02/D03) — mantê-los em gates separados.
- ❌ Texto de UI hardcoded (use `t()`); código fora de inglês.
- ❌ Subagents / Task tool / delegação. ❌ `git` sem `--no-pager`. ❌ pager/editor no terminal.
- ❌ Pedir pra avançar (DEC-056); parar no meio porque o chat está longo.
- ❌ Editar uma migração já aplicada; commitar com testes vermelhos; `--amend` em trabalho pushado.

---

## 14. Sincronia do brain

- **Todo milestone:** `FestPilot/dev-log.md` (seção "Leva Review & Polish (2026-06-27)", mais-recente no topo).
- **Toda decisão nova/mudada:** as entradas DEC-075→088 em `brain/decision-log.md`; marcar o que cada uma refina
(DEC-030/050 mapa, DEC-039/082 i18n, DEC-073/074 plano, DEC-066 shell); bumpar o `Last updated`.
- **Fim da leva:** `brain/project-status.md` (o que a leva entregou, o que ficou ⏳/adiado).
- **Qualquer edição de doc:** atualizar seu `> Last updated:`.

---

## 15. Matriz de smoke manual (rodar no celular nas fronteiras de gate)

**Mapa:** abrir → zoom (fundo + nomes + ícones nítidos, sem pixelar) → arrastar até as bordas (sem borda/void preto) →
tocar um palco (label de vidro legível). **Sheets:** rolar a página, abrir o menu de 3 pontos de um set / o share →
o menu fica preso embaixo da **tela**, não some/sobe com o scroll. **Home:** foto de perfil é círculo perfeito (sem
âmbar nas laterais); nome do festival bonito (sem "…"). **Caminhada:** tocar "X min walk to Freedom" → abre
"… to Freedom" (não Mainstage→Mainstage); ajustar sair-cedo/chegar-tarde/dividir **sem** entrar no Editar; nenhum aviso
duplicado. **Meu Plano:** inserir água/banheiro/outro set **entre** dois cards com "de onde vem o tempo". **Timetable:**
palcos ordenados por favoritos; linhas de tempo mais visíveis; botão "Dia planejado" quando há plano; pinça suave (um
passo). **Line-up:** colapsar "Seus favoritos"; pinça de densidade suave. **Idioma:** trocar p/ PT → Now/Line-up/
Timetable/Meu Plano/Mapa/Squad **sem inglês**. **Compartilhar:** poster mostra **todos** os sets com fotos, sem "+3",
texto sem quebrar, URL final. **Squad:** Next up no topo; plano com a cara do Meu Plano; agenda entre os sets.
**Abas:** trocar de aba dá vibração leve.

---

## 16. Decisões para o Julio (LOCK) — não bloqueiam G1–G9; resolver antes de G5.3 e G10

> A leva está **ACTIVE** e executa G0→G9 sem esperar. Estes 3 itens têm a recomendação do conselho; se o Julio não
> travar a tempo, **adote a recomendação e siga** (DEC-056), registrando como PROPOSED.

1. **Base do mapa (DEC-075, afeta G3):** SVG vetorial (preferido) vs raster 2–4× + cap, ambos progressivos.
  **Rec:** progressivo com SVG preferido + fallback raster medido se houver jank. *(Bloqueia só a escolha do asset, não G1/G2.)*  
  *ok, faz isso.*  

2. **URL/domínio do compartilhamento (DEC-080, afeta G5.3):** qual é a **URL pública final** (com ou sem `www`)?
  **Rec:** usar o domínio final do produto; se aceitar `www`, `www.festpilot…`, senão o domínio sem `www`.  
  acabei de testar, com www. não funciona, tem que ser só `festpilot.pages.dev` ou se não https://`festpilot.pages.dev que eu acho menos profissional..`  

3. **Nome do festival na home (DEC-087, afeta G10):** 2 linhas/responsivo (rec) vs "só Tomorrowland" vs subtítulo.
  **Rec:** responsivo sem "…", 2 linhas quando não couber.  
  Responsivo.

---

## 17. GO — comece aqui

1. Leia §0–§9 + `dev-log.md`. `nvm use 22`; confirme a árvore verde (baseline 677 unit + e2e 30/30).
2. **Comece o G0**, depois gate a gate **G1 → G10** (P0 → P1 → P2), commitando por correção e deployando por gate
  (Pages **master**, nunca preview), até a §12 ser toda TRUE. Mantenha o brain em sincronia (§14). **Nunca peça pra
   avançar** — ambiguidade → conselho-na-hora + DEC + continue (DEC-056). Não pare. Conserte.

> *Este orchestrator é a verdade de execução da leva Review & Polish; o brain é a verdade de produto; os orchestrators
> de 24/06 e 26/06 são a verdade do build/polish anterior. Se conflitarem, resolva explicitamente (atualize o brain +
> adicione um `DEC-NNN`), depois continue.*

