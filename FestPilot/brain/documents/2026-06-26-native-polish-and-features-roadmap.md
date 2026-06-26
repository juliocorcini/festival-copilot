# FestPilot — Roadmap: Polish Nativo + Novas Features (Fases 5–10)

> Documento de planejamento. **Não é implementação** — é o plano que o Julio aprova/ajusta antes de codar.
> Seeded 2026-06-26, após entregar as Fases 1–4 do "feel like a real app" (haptics, press, transição de tela, pull-to-refresh).
> Regra de custo: conselho roda **inline, 1 request, sem subagents** (ver `inline-council-no-subagents.mdc`).
> Código sempre em inglês; este documento em português (idioma do pedido).

---

## 0. Como ler

- **§1** — estado atual (fatos do código, não suposições).
- **§2** — os novos pedidos do Julio, mapeados.
- **§3** — **conselho por decisão** (D1–D7): brief neutro → perspectivas às cegas → veredito.
- **§4** — roadmap re-faseado (Fases 5–10) com escopo/ACs/risco por fase.
- **§5** — guardrail crítico (lock do plano de grupo não pode quebrar).
- **§6** — perguntas abertas para o Julio (em lote).

---

## 1. Estado atual (verificado no código)

| Área | O que já existe | Lacuna p/ o pedido |
|---|---|---|
| **My Plan** (`MyPlanScreen.tsx` + `domain/planEdit.ts`) | Já edita **sets**: add / swap / remove via menu `more_vert` por card + chip "Add a set". `planEdit.ts` garante **zero-overlap** (puro, testado). Gaps viram chips **calculados** "N min break" / "X min walk". | Não há **blocos pessoais** (comer, dormir, água, encontrar, explorar) com horário próprio. Não há **modo de edição** explícito nem amarração ao fluxo de lock. O "90 min break" é derivado, **não editável**. |
| **ArtistSheet** (`ui/ArtistSheet.tsx`) | Bottom sheet com `.sheet-grip` (barrinha), fecha por backdrop/Esc/botão. É `position:fixed`. | A barrinha é **decorativa**: arrastar o card pra baixo **não** arrasta nem fecha. Falta drag-to-dismiss seguindo o dedo. |
| **Timetable** (`TimetableScreen.tsx`) | `zoom` default **`"2h"`**; botão alterna 2h↔1h; pinça também. `showGrid` default **`true`** com **botão de toggle** das linhas. Pinça de 2 dedos p/ zoom. | Pedido: default **1h**; **remover** o toggle de linhas (linhas sempre on). |
| **Plano de grupo** (`domain/squadPlan.ts`) | Agregação por **pluralidade** dos sets travados de cada membro (sem votação). Split/conflito rotulados. Owner pode "override". | Não há **eventos de grupo com hora fixa** (ex.: foto às 16h). Conceito novo: precisa schema no servidor, **separado** da agregação e do lock. |
| **Home / Now** (`NowScreen.tsx`) | Hero "now/next" do plano/favoritos. **Zero contexto de grupo.** | Pedido: mostrar o que o **squad** está vendo / pra onde vai, de forma natural. |
| **Transições** (Fase 3) | Fade de tela (opacity, `key={pathname}`), reduced-motion. | Pedido: **mais** animações/transições (listas, sheets, números). |

---

## 2. Os novos pedidos (mapa)

1. **Drag-to-dismiss** do ArtistSheet (e demais sheets): arrastar pra baixo segue o dedo e fecha ao soltar. → **D3**
2. **Mais animações/transições** no app. → **D5**
3. **Timetable**: remover o toggle de linhas (sempre on) + **default 1h** (botão → 2h). → **D6**
4. **My Plan editável de verdade**: modo de edição; entre sets, adicionar/encolher/aumentar sets pra caber outro; e **blocos pessoais** (restaurante, dormir na barraca, água, comer, encontrar alguém, explorar). Possivelmente cair no editar **após o lock** do dia. → **D1**
5. **Plano de grupo**: eventos com **hora fixa** para todos (ex.: foto às 16h no Mainstage 16:00–16:30) como "a fazer", **sem** quebrar o lock (grupo continua sendo os sets da galera). → **D2**
6. **Home com contexto de grupo**: o que o grupo vê / pra onde vai. → **D4**
7. **Tempo de deslocamento inteligente**: quando caminhar entre palcos gera overlap, escolher (por transição) **sair antes** do set atual ou **chegar depois** no próximo — e isso **deslocar os horários do plano de verdade**, deixando claro a hora real do set vs a sua. → **D7**

## Decisões travadas (2026-06-26, respostas do Julio) — TODAS RESPONDIDAS
- **Q1/Q2 → 6 fases (5–10) com reordenação:** após a Fase 5 vem o **My Plan editável** (sobe p/ **Fase 6**); drag-to-dismiss + `Sheet` base desce p/ **Fase 7**.
- **Q3 → sim**: um bloco pessoal "agora" pode virar **hero da Home**.
- **Q4 → todos os sheets**: extrair `Sheet` base e converter todos.
- **Q5 → entidade nova `group_event`** (semântica limpa, reusa a infra das meeting points).
- **Q6 → qualquer membro** pode criar evento de grupo em V1 (criador/owner pode apagar; sem spam-guard pesado em V1).
- **Q7 → sim**: edição do My Plan via **toggle "Editar"** que revela os controles.
- **Q8 → "sempre sair antes"** é a preferência global padrão do deslocamento (sobrescrevível por transição).
- **D7:** tempo de deslocamento inteligente (sair antes / chegar depois), por transição.

---

## 3. Conselho — vereditos por decisão

> Cada decisão roda inline. Decisões de maior risco (D1, D2) = conselho cheio (4 papéis + red team). Demais = conselho rápido (2 papéis). Viés a resistir em todas: a inércia do chat empurra "construir o editor mais ambicioso possível" — resistir; entregar a fatia que dá liberdade real com menor superfície.

### D1 — My Plan: modo de edição + blocos pessoais  ·  _conselho cheio_

**Decision Brief (neutro):** Hoje o My Plan já adiciona/troca/remove **sets** com zero-overlap (`planEdit.ts`) e mostra gaps calculados ("90 min break"). O Julio quer (a) **liberdade** de planejar o dia: encaixar sets no meio, encolher/aumentar; (b) **blocos não-set** com horário (comer, dormir, água, encontrar, explorar); (c) talvez um **modo de edição** explícito e cair nele **após o lock**. Restrição dura: blocos pessoais são **locais** (DEC-041) e **nunca** entram no plano de grupo. Fato: "encolher/aumentar set" colide com a verdade do lineup (set tem hora fixa real) — o que faz sentido é o usuário definir **quanto do set** ele fica (já existe `cutMs` — "left early") e **preencher os gaps** com blocos.

**Perspectivas (às cegas):**
- **Architect** — Reusar o que existe: `planEdit.ts` já é o guardião do zero-overlap. Estender com um **tipo novo `PlanBlock`** (kind: `eat|rest|water|meet|explore|custom`, `startMs/endMs`, `label`, `note?`) que convive com os `PlanSlot` no plano local. Ops puras novas: `addBlock/resizeBlock/removeBlock`, todas mantendo o invariante (não sobrepõe set nem outro bloco; cabe no gap). **Não** criar canvas de arrastar-redimensionar em V1 (estado complexo, colisão com scroll/haptics). **Rec:** modelo de dados + ops puras + sheet com steppers. **Confidence:** HIGH. **Outros perdem:** "aumentar/encolher set" não é livre — o set tem hora real; o controle honesto é `cutMs` (sair mais cedo) + preencher o gap, não esticar o set.
- **Advocate (usuário)** — O valor é o usuário **dono do dia**: "das 18h às 19h vou comer", "durmo na barraca 15h–16h30". Tem que ser **rápido**: tocar num gap "90 min livre" e escolher um preset (Comer/Descansar/Água/Encontrar/Explorar) que **preenche o gap inteiro** por padrão, ajustável depois. Cair no editar **depois** do lock (não antes — primeiro a vitória "dia fechado", depois "quer enfeitar?"). **Rec:** transformar cada gap calculado num **CTA de 1 toque** que vira bloco real. **Confidence:** HIGH. **Outros perdem:** se exigir digitar horário sempre, ninguém usa — preset preenche o gap, edição fina é opcional.
- **Critic (advogado do diabo)** — Onde quebra: (1) **modo de edição** redundante — o My Plan **já** é editável inline; adicionar um "modo" pode confundir. Talvez baste um cabeçalho "Editar" que só **revela** affordances (handles), sem mudar o modelo mental. (2) Blocos podem **vazar** pro grupo se o share de plano serializar tudo — tem que filtrar blocos no `ShareMyPlan`/`squadPlan` (são pessoais). (3) `cutMs`/resize gera estados inválidos se não passar tudo por `planEdit`. **Rec:** sem "modo" pesado; reusar inline + um toggle visual; **blindar o share** contra blocos. **Confidence:** MED. **Outros perdem:** o maior risco não é UX, é **vazamento** de bloco pessoal pro plano de grupo.
- **Domain** — Invariante central: o plano local é uma lista ordenada sem overlap. Hoje só `PlanSlot`. Introduzir `PlanItem = PlanSlot | PlanBlock` e fazer `buildPlanTimeline` + `planEdit` operarem sobre `PlanItem`, mas o **builder do grupo (`squadPlan`) e o `nowNext` só consideram `kind==="set"`**. Persistência: bump de versão do store local com migração (blocos default `[]`). **Rec:** tipo união + filtros explícitos nos consumidores de grupo/now. **Confidence:** HIGH. **Outros perdem:** `nowNext` (hero da Home) precisa decidir se um bloco "Comer agora" vira hero — provavelmente **sim** ("AGORA: Jantar"), o que é um bônus de produto.

**Red Team (matar a opção líder):** "Adicionar blocos pessoais" pode ser over-engineering — o usuário podia usar o calendário do celular. **Resposta:** o diferencial do FestPilot é o **dia do festival num lugar só** (sets + deslocamento + descanso); jogar pro calendário quebra a promessa. O ataque real: complexidade de edição. **Mitigação:** V1 = presets que preenchem o gap + editar horário por steppers num sheet; **sem** drag-resize livre.

**Synthesis (Chair):**
- **Veredito:** estender o domínio com `PlanBlock` e ops puras (`addBlock/resizeBlock/removeBlock`) sob o mesmo `planEdit` (zero-overlap). UI: cada **gap calculado vira um CTA "Preencher"** (presets Comer/Descansar/Água/Encontrar/Explorar/Custom) que cria um bloco preenchendo o gap; edição fina (horário/label/nota) num **sheet com steppers** (reusa o padrão de sheets). **Sem** modo de edição pesado: um toggle "Editar" no header que **revela** os controles inline já existentes + os novos.
- **Lock flow:** após o `celebrate` do Lock-in, CTA **opcional** "Adicionar pausas e planos" → cai no My Plan do dia já com "Editar" ligado. Nunca forçado.
- **Guardrails:** blocos são **locais**, `kind!=="set"` é **filtrado** em `squadPlan`, `ShareMyPlan` e em qualquer serialização pro servidor; `nowNext` **promove** um bloco a hero ("AGORA: Jantar · 45 min") — **TRAVADO: sim (Q3)**.
- **Edição (TRAVADO Q7):** **toggle "Editar"** no header revela os controles inline + os novos; sem modo pesado.
- **Fora de V1:** arrastar-redimensionar livre no timeline; recorrência de blocos.
- **Lente dominante:** Architect+Domain (é decisão de modelo/invariante). **Confidence:** HIGH.

### D2 — Plano de grupo: eventos com hora fixa  ·  _conselho cheio_

**Decision Brief (neutro):** O plano de grupo é **agregação por pluralidade** dos sets travados (sem voto). O Julio quer **eventos de hora fixa** criados para o squad (ex.: foto às 16h no Mainstage, 16:00–16:30) que apareçam **para todos** como "a fazer". Restrição dura do próprio Julio: **o plano de grupo continua sendo os sets da galera** — o evento é uma camada à parte, não pode poluir a agregação nem o lock pessoal. Isto envolve **servidor** (entidade nova + fanout).

**Perspectivas (às cegas):**
- **Architect** — Entidade nova `group_event` (id, groupId, title, startUtc, endUtc, stageId?/landmark?, createdBy, createdAt), persistida no GroupRoom (DO) como as meeting points; **não** entra em `buildSquadPlan`. Fanout pelo socket "changed" já existente. Hook `useGroupEvents(groupId)` no mesmo contrato (socket+focus+tick) dos outros. **Rec:** camada separada, reuso total do padrão Pillar-3. **Confidence:** HIGH. **Outros perdem:** já existe quase tudo (meeting points são o template exato) — custo menor do que parece.
- **Advocate (usuário)** — O valor é **coordenação**: "todo mundo no Mainstage 16h pra foto". Tem que aparecer (1) na **home do squad**, (2) no **plano de grupo** como uma faixa "Agenda do squad" e (3) idealmente na **Home pessoal** como to-do com contagem regressiva e link "no mapa". Simples: título + horário + (opcional) palco. **Rec:** criar é do **owner** em V1; ver é de todos. **Confidence:** HIGH. **Outros perdem:** sem um **lembrete** (a contagem regressiva / um aviso quando falta 15 min) o evento "morre" na lista.
- **Critic** — Riscos: (1) **escopo servidor** — é a única peça que toca backend nesta leva; estimar à parte. (2) Confundir com **meeting point** (também tem hora/lugar). Diferença: meeting point = "venha até mim/regroup"; group event = "compromisso agendado do squad". Talvez **reusar** meeting points com um flag `kind:"event"` em vez de entidade nova? Trade-off: reuso vs semântica limpa. (3) Permissão: se qualquer membro cria, vira bagunça — **owner-only** em V1. **Rec:** decidir reuse-vs-nova-entidade (Q5) antes de codar. **Confidence:** MED. **Outros perdem:** o risco é **spam/permissão**, não a UI.
- **Domain** — O plano de grupo (`squadPlan`) deve permanecer **puro e só de sets**. Eventos são um stream paralelo, ordenado por `startUtc`, mesclado **só na renderização** (uma lane visual), nunca na agregação. Conflito evento×set: apenas **rotular** ("durante BlackCoffee"), nunca resolver. **Rec:** zero acoplamento com `buildSquadPlan`. **Confidence:** HIGH. **Outros perdem:** se alguém tentar "encaixar" o evento nos blocos, quebra a regra de ouro do Julio.
- **Red Team:** "Não construa entidade nova — reuse meeting points." **Resposta:** meeting points têm semântica de convergência/expiração (lifecycle, "going/here") que não casa com "compromisso recorrente do dia"; forçar gera flags e ifs. Mas a **infra** (DO, socket, hooks) é idêntica → reusar a **plumbing**, não o **modelo**. Veredito provável: entidade própria, infra compartilhada.

**Synthesis (Chair):**
- **Veredito:** **camada separada** `group_event` no GroupRoom (reusando a plumbing das meeting points: rotas, socket, hook), **owner-create** em V1, **fora** de `buildSquadPlan`. Render: faixa "Agenda do squad" no plano de grupo + card na home do squad + to-do na Home pessoal (D4) com contagem regressiva. Conflito com set = só rótulo. Plano de grupo e lock pessoal **intocados**.
- **V1 mínimo:** owner cria (título + início/fim + palco opcional); todos veem com countdown e "ver no mapa"; **sem** RSVP (ou no máximo um "✓ vi"). **V2:** qualquer membro propõe; lembrete push.
- **Custo:** **única feature com backend** nesta leva → fase própria, estimar separado.
- **Decisão TRAVADA (Q5):** **entidade nova `group_event`** (semântica limpa; reusa rotas/socket/hook das meeting points como plumbing).
- **Lente dominante:** Domain+Architect (pureza da agregação + reuso de infra). **Confidence:** HIGH.

### D3 — Drag-to-dismiss dos sheets  ·  _conselho rápido_

**Brief:** ArtistSheet (e demais bottom sheets) são `position:fixed` com `.sheet-grip` decorativo. Quer arrastar pra baixo seguindo o dedo e fechar ao soltar.
- **Architect** — Hook reutilizável `useSheetDrag(onClose)` aplicado ao elemento `.sheet` (é fixed → transformar é seguro, sem o problema de containing-block do conteúdo). `touchstart` no sheet → segue `translateY` ≥0 → no `touchend`, se passou o threshold (≈25% da altura **ou** velocidade alta) anima saída + `onClose`; senão volta com mola. **Guarda:** só inicia o drag quando o **corpo rolável do sheet está no topo** (`scrollTop<=0`), senão o arrasto do conteúdo brigaria — exatamente o padrão que já fizemos no pull-to-refresh. **Rec:** hook único, aplicar primeiro no ArtistSheet, depois nos outros. **Confidence:** HIGH. **Outros perdem:** reaproveitar a disciplina do PTR (armar no topo, `preventDefault` cirúrgico) evita reimplementar bugs.
- **Advocate** — Tem que **seguir o dedo 1:1** (não um "swipe e some"), com a barrinha como dica, haptic leve ao fechar, e respeitar reduced-motion (sem mola → corte). Aplicar em **todos** os sheets (ArtistSheet, PlanItemMenu, SetPicker, SharePlan, sheets do squad) pra consistência. **Rec:** componente base `Sheet` que todos passam a usar. **Confidence:** MED (refator dos sheets existentes tem custo). **Outros perdem:** se só o ArtistSheet ganhar, os outros sheets parecem quebrados ("esse fecha arrastando, aquele não").
- **Synthesis (TRAVADO Q4 = todos os sheets):** hook `useSheetDrag` + componente `Sheet` base compartilhado. **Fase 6** entrega ArtistSheet **e** extrai o `Sheet` base, convertendo **todos** os sheets (PlanItemMenu, SetPicker, SharePlan, sheets do squad). Seguir-dedo 1:1, threshold por distância+velocidade, haptic no dismiss, reduced-motion. **Confidence:** HIGH.

### D4 — Home com contexto de grupo  ·  _conselho rápido_

**Brief:** Now não mostra nada de grupo. Quer "o que o grupo vê / pra onde vai", natural.
- **Advocate** — Um **card "Squad agora"** abaixo do hero, só pra quem está em ≥1 squad: resumo do "where is everyone" (ex.: "3 no Mainstage · 1 a caminho") + próximo **group event** (D2) ou meeting point ativo, com tap pro Squad. **Rec:** 1 card, conciso, sumível. **Confidence:** HIGH. **Outros perdem:** pra quem não tem squad, **não mostrar nada** (Now do solo fica intacto).
- **Critic** — Risco de **inchar** a Home e de **custo de dados** (presença puxa a cada abertura). Mitigar: reusar os hooks que já existem (`useGroupPresence`, `useMeetingPoints`, `useGroupEvents`) e só montar o card se houver squad ativo. Cuidado com **layout shift** enquanto carrega (usar skeleton do card). **Rec:** card lazy + gated. **Confidence:** MED. **Outros perdem:** o card não pode empurrar o hero "now/next" pra baixo de forma que atrapalhe o uso principal (solo é a maioria no dia 1).
- **Synthesis:** card "Squad agora" **gated** (só com squad ativo), reusando hooks existentes, abaixo do hero, com skeleton e tap→Squad. Depende de D2 pro pedaço "pra onde o grupo vai" (group event) — sem D2, mostra só presença + meeting point ativo. **Confidence:** HIGH.

### D5 — Mais animações/transições  ·  _conselho rápido_

**Brief:** ampliar além do fade de tela (Fase 3), sem exagero.
- **Advocate** — Onde dá retorno: **stagger** de entrada nas listas (grid do Lineup, listas do Now, timeline do My Plan), **fade do conteúdo** ao abrir sheet, **indicador ativo deslizante** na bottom-nav, **tween de números** (leave-in/countdown), linhas tappáveis com feedback. **Rec:** lista curada, CSS-first. **Confidence:** HIGH. **Outros perdem:** stagger longo **atrasa** a leitura — manter 150–250ms total, não cascata lenta.
- **Critic** — Risco de jank e de violar reduced-motion. Tudo sob `prefers-reduced-motion: no-preference`, transform/opacity só (compositável), nada de animar layout. Evitar shared-element entre telas (custo alto, fragilidade). **Rec:** orçamento de performance + gating. **Confidence:** MED. **Outros perdem:** animação demais vira ruído; cada uma precisa de **propósito** (orientar atenção), não enfeite.
- **Synthesis:** pacote curado e CSS-first, tudo reduced-motion-gated, transform/opacity, ≤250ms. Distribuído nas fases (não uma fase só): stagger/sheet-fade junto da Fase 5; nav indicator + tweens na Fase 6. **Confidence:** HIGH.

### D6 — Timetable: 1h default + linhas sempre on  ·  _conselho rápido_

**Brief:** default zoom **1h** (botão → 2h); **remover** o toggle de linhas (sempre on).
- **Advocate** — 1h por padrão é mais legível (set "respira"); linhas sempre on dão referência temporal — o toggle era ruído (e o ícone já tinha confundido antes). **Rec:** aplicar. **Confidence:** HIGH. **Outros perdem:** 1h = mais scroll horizontal (360px/h vs 180) — aceitável e condiz com "detalhe por padrão".
- **Critic** — Risco mínimo. Só limpar: remover `showGrid` (state+botão), render `.tt-grid` incondicional, ajustar aria/labels; default `useState<Zoom>("1h")`. Conferir que a barra de controles não fica com buraco após remover um ícone. **Rec:** mudança cirúrgica + screenshot. **Confidence:** HIGH. **Outros perdem:** checar que e2e/specs não dependem do botão de linhas.
- **Synthesis:** aplicar como **quick win** na Fase 5. Default 1h, botão alterna p/ 2h, pinça mantida; remover toggle de linhas; linhas sempre on. **Confidence:** HIGH.

### D7 — Tempo de deslocamento: sair antes vs chegar depois  ·  _conselho cheio_

**Decision Brief (neutro):** O app **já calcula** o tempo a pé entre sets (`useTravelMatrix`; `buildPlanTimeline` mostra "X min walk"), `buildNowNext` calcula o "leave-in", e `PlanSlot.cutMs` **já modela sair cedo**. Lacuna: quando o caminhar faz A.fim ≈ B.início **sobrepor**, o plano não faz o usuário **escolher** nem **desloca os horários**. O Julio quer: por transição, **sair antes de A** (perde o fim) **ou chegar atrasado em B** (perde o começo); isso **muda os horários de verdade**; e deixar claro **hora real do set vs a sua**. Decidir **onde** perguntar (global vs set-a-set) e **como** modelar. Viés a resistir: wizard bloqueante na criação.

**Perspectivas (às cegas):**
- **Architect** — Reuso: `cutMs` (sair cedo) já existe; adicionar o simétrico `lateStartMs` (chegar atrasado) **ou** um `travelChoice` por transição de onde derivam os horários efetivos. Builder calcula `[start', end']` efetivos. **Nunca** perguntar na criação: **default inteligente** + **override por transição** (chips no modo Editar). **Rec:** guardar a **escolha**, não a hora derivada (recalcula em swaps/adds). **Confidence:** HIGH. **Outros perdem:** guardar a hora quebra o cálculo ao re-editar.
- **Advocate** — Clareza: "BlackCoffee 22:00–23:30 · **você sai 23:20** (10 min a pé)" + alternativa "**ou chega 10 min atrasado**". Chip de conflito por transição → sheet de 2 opções **rotuladas com o que se perde** (min de música). Global só define a **preferência padrão**. **Rec:** default esperto + chip por transição. **Confidence:** HIGH. **Outros perdem:** mostrar a troca em **minutos de música**, não horas abstratas.
- **Critic** — Riscos: perguntar sempre = chato; só global = inflexível; tem que viver em `planEdit` (puro) ou invariantes derivam; borda **caminhada > overlap** (perde dos dois lados) → ser honesto. **Rec:** default + override, nunca wizard; tudo em `planEdit`. **Confidence:** MED. **Outros perdem:** o pior caso é perder música de qualquer jeito — não fingir que dá.
- **Domain** — Intervalo efetivo = **função pura**. Default = **minimizar música perdida** (cauda de A vs cabeça de B; empate → sair cedo). `buildPlanTimeline`/`nowNext` usam bounds efetivos. **Pessoal apenas** → não toca a agregação do grupo. **Confidence:** HIGH. **Outros perdem:** o default "menor perda" é o que parece inteligente.

**Red Team:** "Só auto-resolve." → auto-resolver esperto é a base (sem chatice), mas o Julio quer **controle por transição** → o override existe. Meio-termo (default + chip opcional) atende os dois.

**Synthesis (Chair):**
- **Veredito:** **default inteligente + override por transição.** Modelo: manter `cutMs` + adicionar `lateStartMs`, guardando a **escolha** por transição; horários **efetivos** puros em `plan`/`planEdit`. Default = **menor perda de música** (empate → sair cedo). Cada transição com conflito mostra um **chip claro** ("você sai 19:50 · 10 min a pé") → sheet de 2 opções rotuladas com minutos perdidos. **Settings** define só a **preferência padrão** (sair antes / chegar depois / esperto — **Q8**). Borda honesta quando a caminhada estoura o overlap. **Pessoal**, sem impacto no grupo.
- **Onde perguntar:** **não** na criação. Global (1 preferência) em Settings; **override por transição** no My Plan (modo Editar).
- **Pertence à Fase 7.** **Lente dominante:** Domain+Architect. **Confidence:** HIGH.

---

## 4. Roadmap re-faseado (Fases 5–10)

> O Julio imaginou "5 a 7"; com os novos pedidos, o corte limpo é **5–10** (cada uma deployável, 1 fase por deploy). **Reordenação aprovada (Q1/Q2):** o My Plan editável sobe para **Fase 6** (logo após a 5); drag-to-dismiss + `Sheet` base desce para **Fase 7**. Track de polish nativo (antigas 5–7) é **absorvido** na 5 e na 10.

| Fase | Nome | Tier | Toca backend? | Depende de |
|---|---|---|---|---|
| **5** | Timetable defaults + quick wins de animação | T1 | Não | — |
| **6** | My Plan editável + blocos pessoais + deslocamento (D1+D7) | T1 | Não | — |
| **7** | Drag-to-dismiss + `Sheet` base + nav/number motion | T1 | Não | — |
| **8** | Eventos de grupo (hora fixa) | T2 | **Sim** | — |
| **9** | Home = pessoal + squad | T2 | Não | 8 (parcial) |
| **10** | System chrome + toasts/feedback + auditoria (a11y/perf/resp.) | T2 | Não | — |

---

### Fase 5 — Timetable defaults + quick wins de animação
**Tier:** T1 · **Risco:** ON TRACK · **Objetivo:** o Timetable abre como o Julio quer (1h, linhas sempre on) e listas entram com vida.
- **Escopo:** (D6) default zoom `1h`; remover toggle + `showGrid`, linhas sempre on. (D5 parte 1) stagger/fade de entrada no grid do Lineup, listas do Now e timeline do My Plan; fade do conteúdo ao abrir sheets.
- **ACs:** [ ] Timetable abre em 1h; botão vai p/ 2h; pinça mantida. [ ] Sem botão de linhas; linhas sempre visíveis. [ ] Listas fazem stagger ≤250ms, reduced-motion = sem animação. [ ] e2e/specs ajustados se citavam o toggle.
- **Riscos:** specs com seletor do botão de linhas; checar a barra de controles sem buraco.
- **Deploy:** v0.24.0.

### Fase 6 — My Plan editável + blocos pessoais + deslocamento inteligente
**Tier:** T1 · **Risco:** AT RISK (maior fase desta leva) · **Objetivo:** o usuário é dono do dia — encaixa sets, adiciona pausas/atividades e controla como faz cada deslocamento. _(Subiu de 7 → 6 por Q1/Q2.)_
- **Escopo (D1) — blocos pessoais:** `domain/types`: `PlanBlock` + `PlanItem = PlanSlot | PlanBlock`; `planEdit`: `addBlock/resizeBlock/removeBlock` (zero-overlap, puro, testado); `buildPlanTimeline` entende blocos; cada **gap calculado vira CTA "Preencher"** com presets (Comer/Descansar/Água/Encontrar/Explorar/Custom) preenchendo o gap; sheet de edição fina (steppers de horário, label, nota). **Toggle "Editar"** no header revela controles (Q7). CTA opcional pós-lock ("Adicionar pausas e planos"). `nowNext` promove bloco "agora" a hero (Q3).
- **Escopo (D7) — deslocamento:** manter `cutMs` + adicionar `lateStartMs`; guardar a **escolha** por transição; horários **efetivos** puros; **default = "sempre sair antes" (Q8)**, sobrescrevível por transição; **chip de conflito por transição** ("você sai 19:50 · 10 min a pé") → sheet de 2 opções rotuladas com minutos perdidos; **preferência global** em Settings (sair antes [padrão] / chegar depois / esperto); borda honesta quando caminhada > overlap.
- **Guardrails:** blocos/escolhas de deslocamento são **locais** (migração do store local, default vazio); `kind!=="set"` e ajustes de horário pessoais **filtrados** de `squadPlan`, `ShareMyPlan` e qualquer POST (a agregação de grupo segue lendo só os sets, hora real).
- **ACs:** [ ] Tocar num gap cria bloco preset preenchendo o gap. [ ] Editar horário/label/nota num sheet; zero-overlap garantido. [ ] Remover bloco. [ ] Bloco "agora" vira hero na Home. [ ] Transição com overlap mostra chip claro + sheet com os dois trade-offs em minutos; escolher **muda os horários efetivos** do plano. [ ] Preferência global "sair antes" em Settings aplica como default. [ ] Blocos/escolhas **não** alteram o `SquadPlan` (teste de regressão). [ ] Migração do store local sem perder planos. [ ] Lock → celebrate → CTA opcional cai no editar.
- **Riscos:** vazamento pro grupo (Critic); migração do store; intervalo efetivo puro (Domain); escopo grande → considerar dividir em **6a (blocos)** e **6b (deslocamento)** com deploys separados.
- **Deploy:** v0.25.0 (ou 6a v0.25.0 + 6b v0.25.1 se dividido).

### Fase 7 — Drag-to-dismiss + componente `Sheet` base
**Tier:** T1 · **Risco:** ON TRACK · **Objetivo:** todo sheet fecha arrastando pra baixo, seguindo o dedo. _(Desceu de 6 → 7 por Q1/Q2.)_
- **Escopo:** (D3) hook `useSheetDrag` + extrair `ui/Sheet.tsx` base; converter ArtistSheet, PlanItemMenu, SetPickerSheet, SharePlanSheet e sheets do squad. (D5 parte 2) indicador ativo deslizante na bottom-nav + tween de números (leave-in/countdown).
- **ACs:** [ ] Arrastar o sheet pra baixo segue o dedo 1:1; soltar além do threshold (dist/velocidade) fecha; abaixo, volta com mola. [ ] Só arma com corpo no topo (não briga com scroll interno). [ ] Haptic leve no dismiss; reduced-motion = corte. [ ] Todos os bottom sheets usam o `Sheet` base. [ ] Testes: math do threshold/seguir-dedo (puro) + DOM (fecha além, volta aquém).
- **Riscos:** refator dos sheets existentes (manter a11y: foco, Esc, aria-modal); sheets com corpo rolável.
- **Deploy:** v0.26.0.

### Fase 8 — Eventos de grupo (hora fixa)
**Tier:** T2 · **Risco:** AT RISK (única com backend) · **Objetivo:** o squad combina compromissos com hora (foto às 16h) e todos veem.
- **Pré-requisitos travados:** **Q5 = entidade nova `group_event`** (reusa rotas/socket/hook das meeting points como plumbing); **Q6 = qualquer membro cria** (delete só do criador ou do owner).
- **Escopo:** servidor — entidade/estado no GroupRoom + rotas CRUD (qualquer membro cria; delete = criador/owner) + fanout socket; cliente — `data/groupEvents.ts` (`useGroupEvents`), UI de criação (qualquer membro), faixa "Agenda do squad" no plano de grupo, card na home do squad. **Fora** de `buildSquadPlan`. Conflito com set = só rótulo.
- **ACs:** [ ] Qualquer membro cria evento (título + início/fim + palco opcional). [ ] Todos veem com countdown e "ver no mapa". [ ] Criador/owner pode apagar; outros não. [ ] Evento **não** entra na agregação de sets nem no lock pessoal (teste). [ ] Fanout em tempo real (socket) + focus refetch. [ ] (Opcional V1) "✓ vi".
- **Riscos:** escopo backend; permissão/spam (mitigado por delete do criador/owner); semântica vs meeting point.
- **Deploy:** v0.27.0 (+ deploy do worker).

### Fase 9 — Home = pessoal + squad
**Tier:** T2 · **Risco:** ON TRACK · **Objetivo:** a Home mostra, naturalmente, o que o squad está fazendo.
- **Escopo:** (D4) card "Squad agora" no Now, **gated** a squad ativo: resumo de presença ("3 no Mainstage · 1 a caminho") + próximo group event (Fase 8) ou meeting point ativo + tap→Squad. Reusa hooks existentes; skeleton no load; sumível pra solo.
- **ACs:** [ ] Sem squad → Now intacto (nada novo). [ ] Com squad → 1 card abaixo do hero, sem layout shift perceptível. [ ] Mostra presença + próximo evento/meeting point. [ ] Tap abre o Squad.
- **Riscos:** inchar a Home; custo de dados; layout shift.
- **Deploy:** v0.28.0.

### Fase 10 — System chrome + toasts/feedback + auditoria
**Tier:** T2 · **Risco:** ON TRACK · **Objetivo:** fechar o "feel like a real app" e auditar.
- **Escopo:** (antiga 5) `theme-color`/status bar, auditoria de safe-area, splash; (antiga 6) toasts unificados + estados de erro/empty com feedback visual+haptic; (antiga 7) auditoria a11y/perf/responsivo + correções P0–P2.
- **ACs:** [ ] `theme-color` e safe-areas corretos em standalone. [ ] Toast unificado usado nas ações (favoritar/lock/erros) com haptic. [ ] Auditoria gera relatório com P0–P2 corrigidos.
- **Deploy:** v0.29.0 / v0.30.0.

---

## 5. Guardrail crítico — o lock do grupo não pode quebrar

Repetir em **toda** fase que toca plano (7, 8, 9):
1. **Plano de grupo = só sets** travados (`buildSquadPlan` é puro e só lê `kind==="set"`).
2. **Blocos pessoais (Fase 7)** são **locais** e filtrados de qualquer serialização pro grupo/servidor.
3. **Eventos de grupo (Fase 8)** são **camada paralela** — nunca entram na agregação nem no lock; só renderizam ao lado.
4. Todo PR dessas fases inclui **teste de regressão**: "bloco/evento não altera o `SquadPlan`".

---

## 6. Perguntas abertas para o Julio (lote)

**Todas respondidas (Julio, 2026-06-26):**
- ✅ **Q1/Q2** → 6 fases (5–10); **My Plan sobe p/ Fase 6** (após a 5); drag-to-dismiss desce p/ Fase 7.
- ✅ **Q3** → **sim**: bloco pessoal "agora" pode virar hero da Home.
- ✅ **Q4** → **todos os sheets**: extrair `Sheet` base e converter todos.
- ✅ **Q5** → **entidade nova `group_event`** (reusa a plumbing das meeting points).
- ✅ **Q6** → **qualquer membro** cria evento de grupo (delete do criador/owner).
- ✅ **Q7** → **toggle "Editar"** que revela os controles.
- ✅ **Q8** → **"sempre sair antes"** como preferência global padrão (sobrescrevível por transição).

---

## 7. Próximo passo

Plano aprovado e todas as decisões travadas. Execução pela ordem reordenada — **Fase 5 → Fase 6 (My Plan) → Fase 7 (sheets) → 8 → 9 → 10** — no mesmo loop das fases 1–4: conselho onde houver dúvida → implementar → testes verdes → build → prova → deploy → commit → dev-log.
