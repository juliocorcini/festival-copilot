# Review de Uso #3 — Transcrição de Voz Normalizada

> **Data:** 2026-07-08 · **Fonte:** voice memo de ~41 min do Julio
> **Contexto:** teste real pós-deploy da Leva 2 (v0.51.0) no celular, com squad ativo, dois dispositivos.
> **Status:** NORMALIZADO (pendente: priorização + orchestrator)

---

## Issues Encontradas (F01–F18)

### Bugs (comportamento quebrado)

#### F01 — "Insert between" mostra sets do horário errado
- **Severidade:** P0 (funcionalidade core quebrada)
- **Descrição:** Ao clicar em "adicionar set" num gap entre dois sets no My Plan (ex.: gap das 23:00–23:50), os sets sugeridos são sempre os das 14:00 (início do dia), e não os sets disponíveis naquela janela de tempo.
- **Reprodução:** Lock-in → My Plan → clicar "add set" em qualquer gap que NÃO seja o primeiro do dia → lista de sugestões ignora a janela temporal.
- **Root-cause provável:** `planEdit.ts` / `MyPlanScreen.tsx` — a lista de candidatos (`setsAvailable`) provavelmente não filtra pelo `startMs`/`endMs` do gap selecionado, ou passa o range errado.
- **Arquivos:** `domain/planEdit.ts`, `routes/MyPlanScreen.tsx`

#### F02 — Grupo event ("foto") aparece em TODOS os dias e no final
- **Severidade:** P0 (dado errado — confunde planejamento)
- **Descrição:** Um group event (ex.: "foto 16:00–16:30") aparece no squad plan de **todos os dias** (quinta, sexta, sábado, domingo) em vez de só no dia em que pertence. Além disso, aparece **no final** da timeline em vez da posição cronológica correta (deveria ficar entre os sets das 15:30 e das 16:00).
- **Root-cause provável:** `mergeSquadTimeline` ordena por `startMs` (correto) MAS o `SquadPlanScreen` provavelmente não filtra os group events pelo dia selecionado — passa TODOS os events pro merge independente do dia ativo. O `startsAtUtc` do event é UTC e o filtro de dia pode não estar convertendo pro timezone do festival.
- **Arquivos:** `domain/squadTimeline.ts`, `routes/squad/SquadPlanScreen.tsx`, `data/squadPlan.ts` (hook `useGroupEvents`)

#### F03 — Squad plan não sincroniza todos os dias automaticamente
- **Severidade:** P0 (a feature "squad vivo" DEC-095 não funciona como esperado)
- **Descrição:** Depois de fazer Lock-in em todos os dias, o squad plan só mostra o dia que foi compartilhado na hora de entrar no squad. Os outros dias mostram "ainda faltam escolhas". O histórico mostra "27 min atrás — quinta, +8 sets" mas NÃO mostra sexta/sábado/domingo. O auto-re-share deveria detectar que o plano existe e compartilhar TUDO.
- **Reprodução:** Entrar no squad → fazer Lock-in de sexta/sábado/domingo → ir no squad plan → sexta/sábado/domingo mostram "faltam escolhas".
- **Root-cause provável:** O auto-re-share (`ShareMyPlanScreen` / `MyPlanScreen` / `data/squadPlan.ts`) provavelmente só dispara re-share para o dia que estava ativo no momento do Lock-in, e não faz um "initial sync" de todos os dias quando o plano já existia antes de entrar no squad. Ou: o re-share loop roda por dia e só quando o usuário muda algo naquele dia (não faz bulk initial share).
- **Arquivos:** `data/squadPlan.ts`, `routes/squad/ShareMyPlanScreen.tsx`, `routes/MyPlanScreen.tsx`, `routes/lockin/LockInScreen.tsx`

#### F04 — Presença "onde está todo mundo" só funciona após abrir a tela
- **Severidade:** P1 (deveria ser passivo)
- **Descrição:** A presença de localização coarse (em qual stage a pessoa está) só começa a funcionar quando o usuário abre manualmente a tela "Onde está todo mundo?". Deveria estar ativo desde que o app abre (postando a presença em background).
- **Root-cause provável:** O envio de presença provavelmente está atrelado ao mount do `WhereScreen` (ou do componente de presença) e não roda no nível do App/root. Falta um "passive presence publisher" no root do app.
- **Arquivos:** `routes/presence/`, `App.tsx`, `data/api.ts`

#### F05 — Ping "onde está todo mundo" não aparece como alerta global
- **Severidade:** P1 (prioridade total segundo Julio — "base de tudo")
- **Descrição:** Quando alguém pinga "onde está todo mundo?", o alerta/notificação só aparece dentro da tela "Onde está todo mundo?". Deveria aparecer como um banner/toast/alerta em QUALQUER tela do app (NowScreen, SquadScreen, MapScreen, etc.) com alta prioridade.
- **Root-cause provável:** O handler do ping provavelmente só é consumido pelo componente que vive dentro do `WhereScreen` em vez de estar num listener global (talvez no `App.tsx` ou num provider de nível raiz).
- **Arquivos:** `routes/squad/squadHomeCards.tsx` (SafetyBannerLive?), `App.tsx`, websocket/DO handlers

#### F06 — Banner "fora do festival" nunca some
- **Severidade:** P1 (UX break — tapa o mapa permanentemente)
- **Descrição:** No mapa, existe um aviso "Você está fora do festival — mostrar o mapa do festival" com um botão. Ao clicar no botão, o mapa centra no festival mas o banner **não desaparece**.
- **Root-cause provável:** O handler do botão faz `flyTo` / `setCenter` mas não seta o state que controla a visibilidade do banner.
- **Arquivos:** `routes/MapScreen.tsx` (ou `map/` components)

---

### Problemas de UX (funciona mas errado/feio)

#### F07 — Onboarding grid: coração passa por cima da barra sticky de dia
- **Severidade:** P2 (visual glitch)
- **Descrição:** No modo grid do onboarding (seleção de DJs), o ícone de coração (favoritar) tem z-index maior que a barra sticky que mostra o nome do dia. Ao scrollar, os corações "passam por cima" dessa barra.
- **Root-cause provável:** CSS z-index — o `.day-header` (sticky) precisa de um z-index maior que o `.fav-heart` (ou o card grid item).
- **Arquivos:** `styles.css`, `routes/onboarding/` (componente de grid)

#### F08 — Squad event não mostra o dia em que pertence
- **Severidade:** P2 (informação missing — satélite de F02)
- **Descrição:** Na squad agenda e no "Next up", um group event (ex.: "foto 16:00–16:30 por Julio") não indica qual DIA pertence. O user não sabe se é quinta, sexta, etc.
- **Root-cause provável:** O componente de evento na timeline não renderiza o label de dia (provavelmente nunca precisou porque assumia que já estava dentro de um dia-filter — mas com F02 mostrando em todos os dias, fica impossível saber).
- **Arquivos:** `routes/squad/eventsUi.ts`, `routes/squad/SquadPlanScreen.tsx`

#### F09 — Lock-in clash: DJs mostram iniciais em vez de foto
- **Severidade:** P2 (feio, confuso — dificulta a escolha no Lock-in)
- **Descrição:** No Lock-in (resolução de clashes), os DJs em conflito são mostrados com suas iniciais (fallback) em vez da foto real. As fotos deveriam estar maiores e mostrando as imagens reais dos artistas.
- **Root-cause provável:** O `LockInScreen` usa `photoByKey` / `actPhotoUrl` mas pode não estar resolvendo o CDN URL corretamente, ou o CORS policy está bloqueando (retornando `null` e caindo no fallback de iniciais), ou o dado simplesmente não existe no lineup JSON importado.
- **Arquivos:** `routes/lockin/LockInScreen.tsx`, `data/lineup.ts` (resolução de foto)

#### F10 — Botões redundantes para "inserir entre" no My Plan
- **Severidade:** P2 (UX confusa — dois caminhos para a mesma ação)
- **Descrição:** No My Plan, entre dois sets, existem DOIS botões que levam basicamente à mesma ação: (1) um botão "free 36 minutes" que abre diretamente a lista de sugestões, e (2) um botão "+" que abre uma tela intermediária. Deveriam ser unificados num só (o "free X minutes" incluiria a opção de adicionar um set, além das opções pessoais como comida/descanso).
- **Arquivos:** `routes/MyPlanScreen.tsx`

#### F11 — Painel do "onde está todo mundo" empurra o mapa
- **Severidade:** P1 (o mapa fica inutilizável com muitos membros)
- **Descrição:** No mapa + presença, a lista de membros (barra de roster) cresce verticalmente conforme mais pessoas entram no squad, comprimindo a área visível do mapa. Deveria ser um sheet arrastável (colapsável): padrão mostrando 1–2 nomes + indicador de "mais", arrastável pra cima para ver todos e pra baixo para liberar o mapa.
- **Root-cause provável:** O roster é provavelmente um `div` com height auto/flex-grow em vez de um sheet posicionado absolutamente sobre o mapa.
- **Arquivos:** `routes/presence/WhereScreen.tsx`, `styles.css`

#### F12 — Mapa: falta gestos de double-tap zoom
- **Severidade:** P2 (padrão mobile esperado, mas funcional sem ele)
- **Descrição:** O mapa suporta pinch-to-zoom mas NÃO suporta: (1) double-tap para zoom-in, (2) double-tap-hold-and-drag para zoom contínuo. São gestos padrão de apps de mapa (Google Maps, Apple Maps).
- **Root-cause provável:** O hook `usePanZoom.ts` implementa pinch mas não detecta double-tap.
- **Arquivos:** `map/usePanZoom.ts`

#### F13 — "A seguir" no Now mostra favoritos em vez do plano
- **Severidade:** P1 (contradiz o modelo — plano > favoritos)
- **Descrição:** A lista "A seguir" (abaixo do hero) na tela Now mostra os artistas **favoritos** em vez dos artistas do **plano fechado**. O plano fechado (Lock-in) é a fonte de verdade do que o user vai ver; favoritos são só "candidatos". Se o plano existe, a lista deveria mostrar os próximos sets do plano.
- **Root-cause provável:** O `NowScreen.tsx` já tem lógica de `planChrono` vs `favChrono` (leu-se no grep). O hero usa `plan` quando existe, mas a lista **abaixo** (a "full list") pode estar sempre mostrando `favChrono`. Olhar o `source` vs a renderização da lista completa.
- **Arquivos:** `routes/NowScreen.tsx`

#### F14 — Timetable/Lineup abre no "Gathering day" em vez do primeiro dia real
- **Severidade:** P2 (UX — user tem que trocar o dia toda vez)
- **Descrição:** O timetable e o lineup abrem no dia 23 (quinta, "The Gathering") que é um dia com poucos stages (pré-festival / só camping). Deveria abrir no primeiro dia "real" — o primeiro dia em que todos/a maioria dos stages estão ativos.
- **Root-cause provável:** A lógica de `pickActiveDay` / default day provavelmente pega simplesmente o primeiro dia da lista. Precisa de uma heurística: o primeiro dia cujo número de stages é ≥ X% do máximo de stages.
- **Arquivos:** `lib/festival.ts` (`pickActiveDay`), `routes/TimetableScreen.tsx`, `routes/LineupScreen.tsx`

#### F15 — Lineup: filtros de dia overflow (domingo cortado)
- **Severidade:** P2 (visual — user precisa scrollar pra ver o último dia)
- **Descrição:** Com 4 dias no filtro do Lineup (Favs · All · Thu · Fri · Sat · Sun), os pills horizontais ficam apertados e "domingo" é cortado/precisa scroll horizontal. Julio pede substituir por um dropdown (como o timetable usa).
- **Arquivos:** `routes/LineupScreen.tsx`, `styles.css`

#### F16 — Squad section na tela Now é pobre
- **Severidade:** P2 (informação insuficiente)
- **Descrição:** A seção "Squad" no Now screen mostra só 1 DJ "a seguir" sem mais detalhes. Deveria mostrar: próximos eventos do grupo, se alguém está perdido/SOS, onde estão as pessoas, meetings ativos — um resumo vivo do squad.
- **Arquivos:** `routes/NowScreen.tsx`, `routes/squad/squadHomeCards.tsx`

---

### Features novas / melhorias pedidas

#### F17 — Perfil de membro + comparação 1-a-1 de plano
- **Severidade:** P3 (feature nova — não existia)
- **Descrição:** Clicar num membro do squad deveria abrir um perfil mostrando: favoritos, plano, e uma **comparação 1-a-1** (o que temos em comum vs diferente, dia a dia). Com opção de "fazer um plano específico com esse membro" — como o squad plan mas individual entre 2 pessoas.
- **Complexidade:** ALTA — requer nova UI, novo domínio de comparação, e potencialmente nova persistência (plano entre 2).

#### F18 — Renomear tab "Agora" para "Início"
- **Severidade:** P3 (naming)
- **Descrição:** Julio sugere trocar o nome da tab de "Agora" (Now) para "Início" (Home/Start), pois a tela funciona como home mesmo quando nada está acontecendo "agora".
- **Arquivos:** `i18n/index.ts`, `App.tsx`

---

## Classificação por Prioridade

| Prioridade | Issues | Tema |
|---|---|---|
| **P0** | F01, F02, F03 | Plan insert quebrado · event em todo dia · sync não funciona |
| **P1** | F04, F05, F06, F11, F13 | Presença passiva · ping global · banner · mapa roster · agora=plano |
| **P2** | F07, F08, F09, F10, F12, F14, F15, F16 | z-index · dia no event · foto lock-in · botões · gestos · defaults · filtro · now sparse |
| **P3** | F17, F18 | Feature nova (perfil 1-a-1) · rename tab |

---

## Mapa Code↔Fix (rastreio de arquivos)

| Issue | Arquivos principais | Domínio (pure) | UI |
|---|---|---|---|
| F01 | `domain/planEdit.ts` | `insertBetween` / candidatos filtrados por gap | `MyPlanScreen.tsx` |
| F02 | `domain/squadTimeline.ts` | `mergeSquadTimeline` (ok) | `SquadPlanScreen.tsx` (falta filtro de day nos events) |
| F03 | `data/squadPlan.ts` | auto-share loop | `ShareMyPlanScreen.tsx`, `LockInScreen.tsx` |
| F04 | nenhum existente | — | mount presence publisher no `App.tsx` |
| F05 | nenhum existente | — | global ping listener no `App.tsx` |
| F06 | `routes/MapScreen.tsx` | — | banner state toggle |
| F07 | `styles.css` | — | z-index do `.day-header` vs `.fav-heart` |
| F08 | `routes/squad/eventsUi.ts` | — | renderizar day label no event card |
| F09 | `routes/lockin/LockInScreen.tsx` | — | resolução de `photoUrl` / CORS |
| F10 | `routes/MyPlanScreen.tsx` | — | unificar os dois CTAs |
| F11 | `routes/presence/WhereScreen.tsx` | — | sheet arrastável / height-cap |
| F12 | `map/usePanZoom.ts` | — | detectar double-tap |
| F13 | `routes/NowScreen.tsx` | — | "a seguir" lista = plan, não favs |
| F14 | `lib/festival.ts` | `pickActiveDay` heurística | `TimetableScreen`, `LineupScreen` |
| F15 | `routes/LineupScreen.tsx` | — | dropdown em vez de pills |
| F16 | `routes/NowScreen.tsx` | — | enriched squad section |
| F17 | novo | novo domínio | nova tela |
| F18 | `i18n/index.ts` | — | rename `nav.now` |

---

## Observações do Julio (regras/prioridades explícitas)
- "Isso é prioridade total — é a base de tudo" (sobre F05: ping global)
- "Não precisava desses 2 botões" (sobre F10: consolidar)
- "O meu plano está fechado, ele já deveria mandar automaticamente pro grupo — isso era obrigatório" (sobre F03)
- "Já era pra tá funcionando sempre" (sobre F04: presença passiva)
- "O a seguir deveria mostrar o a seguir do meu plano" (sobre F13)
