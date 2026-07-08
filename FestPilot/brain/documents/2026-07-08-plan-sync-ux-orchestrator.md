# FestPilot — Leva 3: Plan Sync, Insert Fix & UX Polish (Orchestrator)

> **Status: ✅ ACTIVE** (sem lock — todos os itens são bugs ou UX diretos; nenhuma decisão arquitetural ambígua).
> **Versão:** parte de `v0.51.0` (live) → **`v0.52.0 → v0.57.0`, um bump por gate (G1→G6)**.
> **Método:** `.cursor/skills/implementation-orchestrator/SKILL.md` — um agente, uma sessão, gate a gate.
> **Leva irmã (concluída):** `2026-06-27-squad-location-native-orchestrator.md` (G0→G10, v0.51.0). Esta é a **3ª rodada de review de uso** do Julio, focada em bugs de sync/insert + polish de UX.

---

## §0 — Missão

O FestPilot está vivo (`festpilot.pages.dev`, v0.51.0). Julio testou no celular após o deploy da Leva 2 e gravou um voice memo de 41 min. O que encontrou são **3 bugs de funcionalidade core** (insert mostra sets errados, group events repetidos em todo dia, auto-share não funciona multi-dia) + **5 falhas de UX importantes** (presença passiva, ping global, banner morto, roster empurrando mapa, Now mostrando favoritos) + **8 polimentos visuais/interação** + **2 features novas/rename** (P3, deferível).

> **A dor central, nas palavras dele:** *"eu vou aplicar no outro botão e clicar e adicionar set… ele continua mostrando o set das 2:00 da tarde, sendo que eu quero adicionar entre as 11:00 e as 11:50"* — e: *"meu plano está fechado, ele já deveria mandar automaticamente pro grupo — isso era obrigatório."*

**O que esta leva É:** corrigir os 3 P0, resolver os 5 P1, e polir os 8 P2 — tudo no app como existe hoje, sem nova feature conceitual grande.

**O que esta leva NÃO é:** não implementa o perfil 1-a-1 de membro (F17 — P3, escopo futuro), não redesenha o Lock-in flow, não muda a agregação do `buildSquadPlan`.

> **O que é o FestPilot (1 linha):** companheiro de festival — escolher artistas, virar um timetable sem conflito, e ficar junto do squad.

**Para começar, vá ao §17.**

---

## §1 — Identidade & contrato de autonomia

Você é o **engenheiro full-stack executor** desta leva, sozinho, nesta sessão. Leia §6 antes de editar; domínio antes da UI; teste junto com a mudança; commit por item; ao fechar cada gate: suíte verde + build + tsc + bump + deploy + dev-log + promove DECs. O único stop é a DoD (§12) toda TRUE, ou bloqueio real. Commit via plumbing (`G=/usr/bin/git; "$G" commit -m "…"`) porque o git local 2.25.1 não suporta `--trailer`.

---

## §2 — Ordem de leitura

1. Este doc §0–§9 (e o §10 do gate atual).
2. `FestPilot/dev-log.md` — Current State.
3. Os DECs citados (DEC-095, DEC-081, DEC-086).
4. `product-spec.md` §9 (presença), §11 (notificações).
5. A review normalizada: `documents/2026-07-08-usage-review-3-voice-normalized.md`.

---

## §3 — Não-negociáveis (ÂNCORA)

**Herdados (valem para o app todo):**
- Domínio puro (TS puro, zero React, testável). UI só orquestra.
- i18n sempre: todo texto via `t()`. PT e EN completos.
- Código em inglês. Documentos no idioma do pedido (PT).
- Hide-never-delete.
- **Invariância de dados: `buildSquadPlan` e `mergeSquadTimeline` NÃO mudam.** Sets nunca entram/reordenam/somem na timeline. O event é uma lane paralela, render-only.
- Resolver fonte do lineup (nunca hardcode).

**Novos desta leva:**
- **N1 — Insert respeita a janela:** ao clicar "add a set" de um gap/insert-context, a lista de candidatos DEVE ser filtrada pelo range temporal daquele gap.
- **N2 — Group events pertencem a um dia:** o squad plan filtra events pelo dia ativo (timezone-aware). Um event nunca aparece em mais de um dia.
- **N3 — Auto-share = todos os dias:** quando o plano de um membro está fechado e ele está num squad, o auto-sync compartilha TODOS os dias com plano (não só o dia ativo na tela).
- **N4 — Presença passiva:** publicar presença coarse desde que o app abre (não exigir que o user abra "onde está todo mundo").
- **N5 — Ping é global:** quando alguém pinga o grupo, o alerta aparece em QUALQUER tela do app como banner de prioridade.

---

## §4 — Baseline: o que JÁ existe

| Área | Já existe (arquivo → símbolo) | GAP |
|---|---|---|
| Insert between | `domain/planEdit.ts → fittingAdds(slots, candidates)` filtra por overlap com slots existentes. `MyPlanScreen → insertSet()` seta `showAdd(true)` e passa `fittingAdds(slots, daySets)` — **todo o dia**. | Não recebe o range do gap como filtro. |
| Merge timeline | `domain/squadTimeline.ts → mergeSquadTimeline(blocks, events)` — ordena por startMs, pure. | Funciona corretamente; o problema é upstream: nenhum filtro de dia nos events antes de passar pra merge. |
| Group events hook | `data/groupEvents.ts → useGroupEvents(groupId)` — fetch todos os events do grupo (sem filtro de dia). | O SquadPlanScreen.tsx passa ALL events pro merge sem filtrar por `dayKey`. |
| Auto re-share | `data/squadPlan.ts → useLivePlanSync(groupId)` — guarda: `meShared === true` + observa `dayKey` (só o dia ativo). | Não faz initial bulk share nem observa todos os dias. |
| Presença publish | `routes/presence/` — mount no `WhereScreen` envia presença. | Não há publish no App root. |
| Ping handler | `data/groups.ts` / `routes/presence/` — recebe via GroupRoom WS mas renderiza só no WhereScreen. | Falta listener global no App. |
| Now "a seguir" | `routes/NowScreen.tsx` — `source = planChrono.hero ? "plan" : favChrono.hero ? "favorites" : null`; a LISTA abaixo usa `chrono.upcoming` que segue `source`. | Bug provavelmente é que `planChrono.upcoming` está vazio quando o hero é plan mas os sets restantes não são populados. |
| Map outside banner | `routes/MapScreen.tsx` — banner com botão. | Botão faz flyTo mas não seta `dismissed` state. |

---

## §5 — Change-set normalizado (F01–F18)

### P0 (funcionalidade core)
- **F01** — Insert "add a set" mostra candidatos do dia inteiro em vez da janela temporal do gap.
- **F02** — Group event aparece em todos os dias e no final da timeline (falta filtro de day + timezone).
- **F03** — Auto-share só funciona pro dia ativo e só se já compartilhou manualmente (não faz bulk initial share).

### P1 (importantes)
- **F04** — Presença coarse só ativa quando abre "onde está todo mundo" (deveria ser passiva no boot).
- **F05** — Ping "onde estão todos" não aparece como alerta global em qualquer tela.
- **F06** — Banner "fora do festival" nunca some ao clicar.
- **F11** — Roster de membros empurra/comprime o mapa (deveria ser sheet colapsável).
- **F13** — "A seguir" no Now mostra favoritos em vez do plano quando o plano existe.

### P2 (visual/UX)
- **F07** — Onboarding grid: coração z-index > barra sticky de dia.
- **F08** — Squad event card não mostra qual dia pertence.
- **F09** — Lock-in: DJs mostram iniciais em vez de foto.
- **F10** — Dois botões redundantes pra "inserir entre" (consolidar em um).
- **F12** — Mapa: falta double-tap zoom.
- **F14** — Timetable/Lineup abre no "Gathering day" em vez do primeiro dia real.
- **F15** — Lineup: day filters overflow (substituir por dropdown).
- **F16** — Squad section no Now screen é pobre/vazia.

### P3 (defer)
- **F17** — Perfil de membro + comparação 1-a-1 (feature nova — **DEFER**).
- **F18** — Renomear tab "Agora" → "Início".

---

## §6 — Root-cause map (code ↔ change)

| Issue | Root cause (arquivo → símbolo) | Direção do fix | Gate |
|---|---|---|---|
| F01 | `MyPlanScreen.tsx` L270: `insertSet()` seta `showAdd(true)` sem passar range do gap; L437: `fittingAdds(slots, daySets)` recebe **todos** os sets do dia. | Passar `insertFor.before`/`after` range para filtrar `daySets` no picker (nova variante `fittingAddsInWindow`). | G1 |
| F02 | `SquadPlanScreen.tsx` L100: `mergeSquadTimeline(plan.blocks, events)` passa **todos** os events sem filtro de dia. O hook `useGroupEvents(id)` retorna todos. `TimelineEvent.startsAtUtc` é UTC; o filtro de dia precisa do tz do festival. | Filtrar events por `dayKey` (tz-aware) antes de passar ao merge. Nenhuma mudança no domínio puro. | G1 |
| F03 | `data/squadPlan.ts` L271: `if (!meShared) return` + L255: `useActiveDayKey()` = só 1 dia. | (a) Quando o user tem plano local E pertence a um squad, fazer initial share de **todos** os dias com plano (não esperar manual). (b) O live-sync loop deve observar **todos** os dias que o user tem plano, não só o ativo. | G2 |
| F04 | Presença publish (`postPresence`/`updateMyPresence`) só é chamado dentro de `WhereScreen` mount. | Mover o publish pra um `<PassivePresencePublisher />` no App.tsx root (equivalente ao `ReminderScheduler`). | G3 |
| F05 | Ping WS message (`ping`) é consumido só pelo `WhereScreen`. | Adicionar global ping listener no App.tsx que mostra um toast/banner overlay em qualquer tela. | G3 |
| F06 | `MapScreen.tsx`: botão "show festival" chama `flyTo(festivalCenter)` mas não seta `outsideDismissed`. | Adicionar `setOutsideDismissed(true)` no onClick. | G4 |
| F07 | CSS: `.day-header` sticky vs `.fav-heart` z-index. | `.day-header { z-index: 3 }` vs coração ficar abaixo. | G4 |
| F08 | `eventsUi.ts` / event card não mostra dia. | Renderizar `dayLabel` no card (do `startsAtUtc` → dia da semana via tz). | G4 |
| F09 | `LockInScreen.tsx` usa `photoByKey` — provavelmente CORS ou dados missing. | Investigar se `performance.imageUrl` existe; se sim, checar headers; se não, fallback a um placeholder melhor. | G5 |
| F10 | `MyPlanScreen.tsx`: `InsertDivider` + `PlanGapRow` são CTAs separados. | Unificar: o gap-row (com "free X min") INCLUI a opção "add a set" (como no InsertSheet). Remover o divider `+` redundante. | G5 |
| F11 | `WhereScreen.tsx`: roster div com flex-grow comprime o mapa. | Converter roster em sheet arrastável com max-height padrão + "show more". | G4 |
| F12 | `map/usePanZoom.ts`: pinch detectado mas não double-tap. | Adicionar detector de double-tap (300ms) → zoom ×2 centrado no toque. | G5 |
| F13 | `NowScreen.tsx` L161–162: source seleciona plan quando `planChrono.hero` existe; MAS a lista `chrono.upcoming` pode estar vazia se `buildNowNext` não popula `upcoming` com o restante do dia. | Verificar que `chronoNowNext` popula `upcoming` com os sets do plano após o hero. | G2 |
| F14 | `lib/festival.ts → pickActiveDay`: retorna o primeiro dia da lista. | Heurística: primeiro dia cujo `stageCount ≥ 0.7 × maxStageCount`. | G5 |
| F15 | `LineupScreen.tsx`: day pills horizontais. | Substituir por dropdown (replicar pattern do TimetableScreen day selector). | G6 |
| F16 | `NowScreen.tsx` + `squadHomeCards.tsx`: squad section mostra só 1 "next up". | Enriquecer: mostrar presença resumida + meetings ativos + badge de ping. | G6 |
| F18 | `i18n/index.ts`: `nav.now`. | Rename to `nav.home` / "Início". | G6 |

---

## §7 — Decisões

Nenhuma decisão arquitetural ambígua nesta leva — são bugs + UX. Decisões diretas:

- **DEC-109** — `fittingAdds` ganha variante filtrada por range temporal (F01). Direto.
- **DEC-110** — Group events filtrados por dia (tz-aware) no SquadPlanScreen (F02). Direto.
- **DEC-111** — Auto-share faz initial bulk sync de todos os dias com plano fechado (F03). Direto.
- **DEC-112** — Presença passiva no boot + ping global (F04/F05). Direto.
- **DEC-113** — "A seguir" = plano quando existe; "First real day" heuristic (F13/F14). Direto.
- **DEC-114** — Day filter no Lineup vira dropdown; squad no Now enriquecido (F15/F16). Direto.

---

## §8 — Estratégia de testes

- Domínio puro (>90%): `fittingAddsInWindow`, event day-filter, bulk share logic, `pickActiveDay` heuristic.
- E2E: squad-plan day filter, insert-set-in-gap, auto-share all-days.
- Invariância: `mergeSquadTimeline` regression (set invariance test verde).
- Full suite green entre gates (baseline: web 553 + server 260 = 813).

---

## §9 — Per-milestone protocol

5-point self-check antes de cada commit:
1. AC do gate satisfeitas.
2. 3 ACs anteriores em risco de regressão → verificar (especialmente invariância de `buildSquadPlan`, N-i18n, N-hide-never-delete).
3. Testes — nenhuma falha nova.
4. Arquivos fora de escopo → flag.
5. dev-log atualizado.

---

## §10 — THE BUILD — Gates G0→G6

### G0 — Baseline + seed (sem bump)
- Instalar deps, rodar suite (web+server), confirmar build+tsc limpos.
- Seed dev-log (leva 3).
- Registrar DEC-109…114 como PROPOSED no decision-log.
- **AC:** baseline documentada, 0 falhas novas, DECs registrados.

### G1 — Insert + Event day filter (F01 + F02) → v0.52.0
- **F01:** criar `fittingAddsInWindow(slots, candidates, gapStart, gapEnd)` em `planEdit.ts`; no `MyPlanScreen`, `insertSet()` passa o range do gap ao picker; o picker usa `fittingAddsInWindow` em vez de `fittingAdds`.
- **F02:** no `SquadPlanScreen`, filtrar `events` por `dayKey` (tz-aware) antes de passar ao `mergeSquadTimeline`. O event só aparece no dia em que `startsAtUtc` cai (convertido pelo tz do festival).
- **Testes:** unit para `fittingAddsInWindow`; unit para event-day-filter helper.
- **AC:** insert mostra só sets do gap; events aparecem só no dia correto; suite verde.

### G2 — Auto-share all days + Now "a seguir" fix (F03 + F13) → v0.53.0
- **F03:** (a) No `useLivePlanSync`, quando `meShared === true` pro dia ativo, também verificar e share os OUTROS dias com plano local que ainda não foram compartilhados. (b) Quando o user entra num squad e já tem plano fechado em múltiplos dias, trigger initial share de todos. (c) Se `meShared === false` mas o user tem plano local completo (Lock-in done), prompt/toast sugerindo "compartilhar com o squad" (não forçar — privacidade).
- **F13:** verificar `chronoNowNext` em `NowScreen.tsx` — se a lista "upcoming" não contém os sets do plano após o hero, corrigir.
- **Testes:** unit para o multi-day sync logic; mock do localStore com múltiplos dias.
- **AC:** squad plan mostra todos os dias compartilhados; "a seguir" mostra o plano; suite verde.

### G3 — Presença passiva + ping global (F04 + F05) → v0.54.0
- **F04:** Extrair o publish de presença coarse do `WhereScreen` para um `<PassivePresencePublisher />` no App root. Publica a cada N segundos (como o ReminderScheduler) usando geolocation.
- **F05:** Adicionar global listener de ping WS no App root. Quando recebe "ping", mostrar um toast/banner em qualquer tela ("Fulano quer saber onde todos estão — [Responder]"). Link leva ao WhereScreen.
- **Testes:** unit para a lógica de publish interval; e2e que verifica o banner aparecendo.
- **AC:** presença publica no boot; ping aparece globalmente; suite verde.

### G4 — Map/UX fixes (F06 + F07 + F08 + F11) → v0.55.0
- **F06:** `MapScreen.tsx` — botão "show festival" → adicionar `setOutsideDismissed(true)`.
- **F07:** CSS — z-index do `.day-header` > coração no grid.
- **F08:** Event card no squad timeline → mostrar dia da semana.
- **F11:** `WhereScreen` roster → converter em sheet com max-height + indicador "more" + arrastável.
- **Testes:** e2e para banner dismiss; visual check do z-index (screenshot).
- **AC:** banner some; corações não passam sobre sticky; event mostra dia; roster não esmaga mapa; suite verde.

### G5 — Lock-in photos + double-tap + redundant buttons + default day (F09 + F10 + F12 + F14) → v0.56.0
- **F09:** Investigar `photoByKey` no Lock-in — se CORS, usar proxy ou fallback melhor. Se dado missing no lineup JSON, fallback placeholder.
- **F10:** Unificar InsertDivider + gap-row — "free X min" button inclui "add a set" no sheet.
- **F12:** `usePanZoom.ts` — detector de double-tap (300ms) → zoom ×2.
- **F14:** `pickActiveDay` heuristic — primeiro dia com ≥70% dos stages do dia com mais stages.
- **Testes:** unit para double-tap detect; unit para pickActiveDay heuristic.
- **AC:** Lock-in mostra fotos (ou fallback explícito com explicação); insert unificado; double-tap zoom funciona; timetable/lineup abre no dia certo; suite verde.

### G6 — Lineup filter + Now squad enrichment + rename (F15 + F16 + F18) → v0.57.0
- **F15:** Day filter no Lineup → dropdown (replicate TimetableScreen pattern).
- **F16:** Squad section no Now → mostrar presença resumida + meetings + ping count.
- **F18:** Rename `nav.now` → `nav.home` / "Início" (PT) / "Home" (EN).
- **F17:** DEFER — registrar no dev-log como P3 futuro.
- **Testes:** e2e para dropdown; i18n check.
- **AC:** filtro é dropdown; squad no Now mostra informações úteis; tab renomeada; suite verde.

---

## §11 — Terminal safety (WSL)

- Sempre `git --no-pager`.
- Commit via plumbing: `G=/usr/bin/git; "$G" commit -m "…"` (git 2.25.1 não suporta `--trailer` injetado pelo Cursor).
- Nunca pager/editor.
- Se hang >30s: kill pid.

---

## §12 — Definition of Done

- [ ] F01 (insert gap-filtered) entregue e testado
- [ ] F02 (event day-filter) entregue e testado
- [ ] F03 (auto-share all days) entregue e testado
- [ ] F04 (presença passiva) entregue
- [ ] F05 (ping global) entregue
- [ ] F06–F16, F18 entregues
- [ ] F17 deferred com registro
- [ ] DEC-109…114 APPROVED
- [ ] Suite verde (web + server ≥ baseline)
- [ ] Build + tsc limpos
- [ ] Deployed em produção (Pages + Worker se server mudou)
- [ ] Brain synced (dev-log, decision-log, project-status)

---

## §13 — Anti-patterns

- ❌ Mudar `buildSquadPlan` ou `mergeSquadTimeline` (invariância).
- ❌ Forçar share sem consentimento (privacidade — prompt, não auto-publish sem opt-in prévio).
- ❌ Subagents / Task tool.
- ❌ Hardcoded strings (usar `t()`).
- ❌ Commits via porcelain `git commit` (usa plumbing).

---

## §14 — Brain sync

- `dev-log.md` — a cada milestone.
- `decision-log.md` — DEC-109…114 PROPOSED no G0, APPROVED por gate.
- `project-status.md` — no fim da leva.
- `README.md` — apontar para este doc como ACTIVE.

---

## §15 — Smoke matrix (pós-deploy)

| Jornada | iOS PWA | Android |
|---|---|---|
| Insert set num gap noturno → candidatos do horário certo | ✓ | ✓ |
| Squad plan → event aparece só no dia correto, na posição | ✓ | ✓ |
| Lock-in multi-dia → squad plan mostra todos os dias | ✓ | ✓ |
| Abrir app → presença publicada (sem abrir Where) | ✓ | ✓ |
| Ping → banner aparece no Now | ✓ | ✓ |
| Mapa → double-tap zoom | ✓ | ✓ |
| Lineup → dropdown de dias | ✓ | ✓ |

---

## §16 — Locks (nenhum)

Nenhuma decisão bloqueante. Todas diretas (bugs + UX). Doc está **ACTIVE**.

---

## §17 — GO — start here

**G0 commands:**
```bash
cd FestPilot/web && npm install && npm run test && npm run build
cd ../server && npm install && npm run test
```
Seed dev-log, registrar DECs 109–114 PROPOSED. Confirmar baseline. Então executar G1→G6 sem parar até a DoD ser toda TRUE.
