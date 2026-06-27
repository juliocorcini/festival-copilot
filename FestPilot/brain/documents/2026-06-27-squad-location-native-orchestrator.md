# FestPilot — Leva 2: Squad Vivo, Localização & Polimento Nativo (Orchestrator)

> **Status: ✅ ACTIVE** (lock não-bloqueante em §16 para as decisões sensíveis de privacidade/escopo).
> **Versão:** parte de `v0.41.0` (live) → **`v0.42.0 → v0.51.0`, um bump por gate (G1→G10)**.
> **Método:** `.cursor/skills/implementation-orchestrator/SKILL.md` — um agente, uma sessão, gate a gate.
> **Leva irmã (concluída):** `2026-06-27-review-polish-orchestrator.md` (G0→G8, v0.41.0). Esta é a **2ª rodada de review de uso** do Julio, focada em squad, localização/presença e o "feel" nativo no iPhone.

---

## §0 — Missão

O FestPilot já está vivo (`https://festpilot.pages.dev`, v0.41.0). O Julio rodou o app **de verdade no iPhone, em dois aparelhos, dentro de um squad**, e gravou um review longo. O que ele encontrou não são bugs isolados — são **fluxos que parecem quebrados quando usados a sério**: o app "instalado" no iOS fica com uma barra preta gigante e o conteúdo espremido; o **plano do squad não fica vivo** (some o "Próximo", o plano não atualiza quando alguém muda o seu); as **escolhas do grupo não se explicam** ("por que esse foi escolhido?"); a **localização precisa nunca chega em quem precisa achar a pessoa**; e vários **mapas internos ficam pretos** e **textos pretos** aparecem no escuro.

> **A dor central, nas palavras dele:** *"o principal aqui é o plano do squad ficar atualizado sempre, porque parece que ele não está atualizado sempre… na página inicial e nada agendado ainda — isso é mentira, a gente já tem um plano."* E: *"a localização precisa… eu apareço no palco, não no ponto exato — a pessoa nunca vai conseguir chegar em mim."*

**O que esta leva É:** expor, conectar e tornar honestos pedaços que **em grande parte já existem** (a agregação do squad-plan é pura e completa; o group-by-stage já existe; o changelog/PWA já existem) + construir o que falta de fato (re-share vivo + histórico, coordenada precisa no DTO, notificações locais, mural do ponto de encontro).

**O que esta leva NÃO é:** não é redesenho do algoritmo de agregação (a matemática do `buildSquadPlan` permanece intacta — invariância de dados), não é trocar a fonte de dados do lineup, não é multi-festival.

> **O que é o FestPilot (1 linha):** companheiro de festival — escolher artistas, virar um timetable pessoal sem conflito, e ficar junto do squad (plano de grupo, mapa, presença, pontos de encontro).

**Para começar, vá ao §17.**

---

## §1 — Identidade & contrato de autonomia

Você é o **engenheiro full-stack executor** desta leva, sozinho, nesta sessão. Você não delega, não abre subagentes, não para no meio. Você lê o §6 do item antes de editar, faz o domínio antes da UI, testa junto com a mudança, faz commit por item, e ao fechar cada gate: suíte verde + build + tsc + smoke + bump de versão + **deploy** + dev-log + promove os DECs do gate `PROPOSED → APPROVED`. O único stop legítimo é a Definição de Pronto (§12) toda TRUE, ou um bloqueio real de credencial/custo, ou contexto acabando (aí feche o gate atual limpo e passe o bastão no dev-log).

---

## §2 — Ordem de leitura (carregue contexto UMA vez)

1. Este doc **§0–§9** (e o §10 do gate atual, sob demanda).
2. `FestPilot/web/src/dev-log.md` — Current State + a tabela desta leva.
3. **Só** os `DEC-NNN` citados (DEC-089…DEC-106 desta leva; mais os herdados citados: DEC-006/007/015/041/046/058/072/086).
4. As entidades de `product-spec.md` tocadas (Squad Plan, Presence, Meeting Point, Notifications).
5. A leva irmã `2026-06-27-review-polish-orchestrator.md` para tom/voz.

> Não releia o brain inteiro por milestone. Releia **o arquivo do §6** do item antes de editar (símbolos se movem).

---

## §3 — Não-negociáveis (ÂNCORA)

**Herdados (valem para o app todo):**
- **Domínio puro:** lógica em TS puro, zero React, testável. UI só orquestra.
- **i18n sempre:** todo texto de UI via `t()`. **Nunca** string hardcoded. PT e EN completos.
- **Código em inglês** (identificadores, comentários, commits, arquivos). Documentos no idioma do pedido (PT).
- **Hide-never-delete:** nenhuma ação/feature é removida; no máximo reorganizada/escondida.
- **Invariância de dados:** `buildSquadPlan` e a agregação **não mudam**. Esta leva *explica e atualiza*, não recalcula. O teste de regressão do `mergeSquadTimeline` (set nunca entra/reordena/some) continua verde.
- **Privacidade é decisão de produto:** qualquer exposição de coordenada precisa segue o DEC desta leva (§7/C2) e respeita opt-out + TTL.
- **Resolver fonte do lineup** (event+uuid → CDN JSON); nunca hardcode de lineup.

**Novos desta leva:**
- **N1 — Sem barra preta no iOS:** o app instalado preenche a tela com safe-areas corretas; nada espremido/travado no topo.
- **N2 — Sem texto preto no escuro:** todo texto usa tokens de tinta legíveis sobre o tema escuro (sem `color:#000`/ink default em sheets/labels de mapa).
- **N3 — Sem mapa preto:** toda superfície de mapa (rota, ponto de encontro, convergência, presença, SOS) carrega a **mesma** base por **uma** via; se a base falhar, há fallback visível (nunca fundo preto).
- **N4 — O squad é honesto:** se existe plano, a home e o "Próximo" mostram o plano real; o CTA reflete existência ("ver/gerenciar", não "montar"); toda escolha do grupo é **explicável** em linguagem simples.
- **N5 — O squad é vivo:** mudar o plano pessoal de um membro re-propaga ao(s) squad(s) dele; mudanças no squad-plan entram num **histórico** e **notificam** o grupo com o porquê.
- **N6 — Portrait-only:** o app não gira para landscape (iOS inclusive).
- **N7 — Barras de sistema profissionais (iOS + Android):** as barras do SO (status/notificações **e** navegação) seguem o chrome do app (paleta dia/noite), nunca um cinza/branco genérico. No PWA isso vem de `theme_color`/`background_color` do manifest + `theme-color` dinâmico; no Android a barra de navegação também acompanha.

> Quebrar um não-negociável é defeito **mesmo que os testes passem**.

---

## §4 — Baseline: o que JÁ existe (reusar, não reinventar)

Confirmado lendo o código (v0.41.0):

| Área | Já existe (arquivo → símbolo) | GAP desta leva |
|---|---|---|
| Agregação squad | `web/src/domain/squadPlan.ts` → `buildSquadPlan` (já calcula `method: "plurality" \| "favorited" \| "owner"`, `goingCount`, `favCount`, winners) | A UI **não explica** o método nem expõe quem favoritou/quem vai. |
| Próximo do squad | `web/src/domain/squadNextUp.ts` → `squadNextUp(sets, nowMs)` (puro, pronto) | `SquadScreen` chama `SquadNextUpCard` **sem passar `sets`** (default `[]`) → "nothing scheduled" mentiroso. |
| Live do squad | `web/src/data/squadPlan.ts` → `useSquadPlan` usa `useGroupLive` + refetch on focus | Só reflete o que foi **compartilhado**; não há re-share automático ao mudar o plano pessoal. |
| Share do plano | `web/src/routes/squad/ShareMyPlanScreen.tsx` + `data/api.ts → shareMyPlan` | É **snapshot manual** (um clique). Sem auto re-share, sem histórico, sem notificação. |
| Timeline do squad | `web/src/domain/squadTimeline.ts` → `mergeSquadTimeline` (set + group events, render-only) | Falta affordance "adicionar ao plano" a partir da própria tela do plano (E21). |
| Presença | `web/src/routes/presence/presenceUi.tsx` → `groupRosterByStage` (puro, ordena por nº de pessoas) | `WhereScreen` usa `sortRoster` (lista plana). Default é **opt-in invisível**. |
| Presença precisa | `server/src/api/dto.ts → PresenceMemberDto` + `web/src/data/types.ts` | **Nenhum DTO carrega coordenada.** `CoarsePresenceMap.buildPins` plota no **palco**, nunca no ponto exato. |
| Mapa | `web/src/map/MapView.tsx` + `routes/.../*` | Cada superfície carrega a base por uma via diferente (`/maps/<id>.webp` estático vs `map.baseDayUrl` da API) → preto em sub-fluxos. |
| Bússola | `web/src/lib/useGeo.ts → useHeading` | Bloqueia a bússola quando `arrived` (<15m). |
| PWA/chrome | `web/index.html`, `web/src/lib/chrome.ts` (`THEME_COLOR`/`applyThemeColor` — DEC-088), `web/public/manifest.webmanifest` | iOS: `apple-mobile-web-app-status-bar-style=black-translucent` + sem lock de orientação → barra preta + landscape. **Android: barras de status/navegação genéricas** — `theme_color`/`background_color` do manifest + `theme-color` dinâmico não estão refletindo o chrome do app de forma profissional. |
| Notificações | `web/src/routes/settings/SettingsScreen.tsx` → pill `settings.soon` | Não implementado. |
| Join | `web/src/routes/squad/JoinScreen.tsx` → `JoinEntry` | Input único; sem QR-scan; placeholder mostra URL completa, esconde "só o código". |
| Header | `web/src/app/AppHeader.tsx` | Nome do festival invade as iniciais do avatar em PT (texto mais longo). |
| i18n | `web/src/i18n/index.ts` | `nav.timetable`/`view.timetable` = "Horários" (rejeitado); "Favoritos" estoura; muitas sub-telas de squad/meet hardcoded em inglês. |

---

## §5 — Change-set normalizado (E01…E28, por prioridade)

**P0 — quebra o "feel" / squad central / segurança:**
- **E01** iOS: barra preta enorme embaixo + conteúdo espremido/travado no topo (safe-areas).
- **E02** iOS: travar em **portrait** (não girar para landscape).
- **E28** Android: barras de **status/notificações** e de **navegação** não estão customizadas — seguir o chrome do app (profissional, padrão da paleta), nos dois sistemas.
- **E17** Mapa **preto** em "definir ponto de encontro" e "caminhar/rota" (overlay certo, base preta).
- **E18** **Texto preto** no escuro (label "near main stage", `StagePickSheet`, lista de palcos do meeting point).
- **E04** Squad "Próximo" diz "nada agendado" embora haja plano (alimentar `sets`).
- **E05** CTA "Montar plano do grupo" mesmo com plano existente → refletir existência.
- **E06** Squad-plan **todo em inglês** → i18n completo das sub-telas (squad/meet/presence).
- **E08** **Transparência das escolhas:** explicar em linguagem simples por que cada bloco foi escolhido (quem favoritou, quem vai, método) + glossário.
- **E07** **Squad vivo:** re-share automático quando o plano pessoal muda + **histórico** de alterações + **notificar** o grupo do porquê.
- **E16** **Localização precisa não chega:** quem compartilha preciso aparece só no palco; expor coordenada exata aos membros do squad + plotar o ponto exato.
- **E09** Presença **não-invisível por padrão:** pedir localização ao entrar no squad, visível (coarse) por padrão, com opt-out.

**P1:**
- **E10** "Onde está todo mundo" agrupado por **palco** (mais cheio no topo, esconder palcos vazios) na tela cheia.
- **E12** Fluxo **SOS/perdido** repensado (consciência mútua, estados claros, menos "aguardando…").
- **E13** Parar de compartilhar **não sincroniza** no outro aparelho (ainda mostra "precisa de ajuda").
- **E14** No mapa do SOS não dá **zoom**, só dropar waypoint.
- **E15** **Bússola** não ativa quando "já chegou" (deveria sempre poder ativar).
- **E19** Foto do ponto de encontro deve **abrir/zoom** ao tocar (lightbox).
- **E03** Join: opções **link / QR / código** + **escanear** QR + placeholder claro (mostra o código, não a URL).
- **E24** "Timetable" **não** vira "Horários" em PT (manter "Timetable").
- **E27** Line Up estoura em PT → encurtar "Favoritos" → "Favs".
- **E26** Nome do festival invade as iniciais do avatar em PT (header reserva espaço).
- **E25** **Notificações** têm que funcionar (hoje "em breve").

**P2 (faz se houver folga):**
- **E20** **Mural/mensagens** no ponto de encontro (comunicação por ponto).
- **E11** Mapa ainda **perde qualidade no zoom** (re-checar a base/cap do D01).
- **E21** Inserir **eventos de grupo** no squad-plan a partir da própria tela do plano (ex.: "tirar foto" entre sets).
- **E22** Agenda do grupo pode sair da frente do squad (reorg).
- **E23** Trocar de squad pelo nome no Now (futuro multi-squad).

---

## §6 — Mapa de causa-raiz (sintoma → causa exata → direção → gate)

> **Releia o arquivo citado antes de editar.** Linhas são de v0.41.0.

| Item | Sintoma | Causa-raiz (arquivo → símbolo) | Direção da correção | Gate |
|---|---|---|---|---|
| E01 | Barra preta + conteúdo espremido no iOS instalado | `web/index.html` → `<meta apple-mobile-web-app-status-bar-style="black-translucent">`; CSS sem `viewport-fit=cover` consistente / `--safe-*` não aplicado no shell | Auditar safe-areas: `viewport-fit=cover`, padding `env(safe-area-inset-*)` no shell/header/tab-bar; rever status-bar-style (testar `default`); garantir que o `100dvh`/`--app-height` cobre a tela | G1 |
| E02 | iOS gira para landscape | `web/public/manifest.webmanifest` sem `"orientation":"portrait"`; sem trava CSS | `orientation: "portrait"` no manifest + guarda CSS (`@media (orientation: landscape)` aviso) — iOS PWA ignora manifest, então a trava é por layout | G1 |
| E28 | Android: barras de status/navegação genéricas (não-profissionais) | `manifest.webmanifest` `theme_color`/`background_color` + `theme-color` dinâmico (`lib/chrome.ts`, DEC-088) não cobrem a barra de navegação Android; chrome não casa com a paleta | Manifest `theme_color`/`background_color` = chrome do app; confirmar `applyThemeColor` por paleta dia/noite; garantir que a barra de navegação Android (instalado) acompanha; documentar limite do PWA (controle total de nav-bar exige TWA/Capacitor — DEC-035) | G1 |
| E17 | Mapa **preto** em meeting-spot/rota | superfícies carregam base por vias diferentes: `MeetSpotScreen`/`MapView` usam `/maps/<id>.webp` (ausente em `public/maps/`), `RouteScreen` usa `map.baseDayUrl/NightUrl` da API (pode 404) | **Unificar** numa via única de base (um hook/`<MapBase>` que resolve a fonte e tem fallback de cor de palco, nunca preto) | G2 |
| E18 | Texto **preto** no escuro | `StagePickSheet.tsx` (nomes de palco), label "near main stage" no meeting point | trocar tinta hardcoded por token de tema (`--ink`/`text-…`); varrer sheets/labels de mapa | G2 |
| E04 | "Próximo" do squad mente ("nothing scheduled") | `routes/SquadScreen.tsx` chama `<SquadNextUpCard />` **sem `sets`** (default `[]`); idem aba squad no `NowScreen` | passar `sets` (do `useSquadPlan`) ao card; idem no Now | G3 |
| E05 | CTA "Montar plano do grupo" com plano já existente | `SquadScreen.tsx` CTA estático (`squad.buildPlan`) | CTA condicional: sem plano → "Montar"; com plano → "Ver/Gerenciar plano do grupo" | G3 |
| E06 | Squad-plan em inglês | `SquadPlanScreen.tsx`, `ShareMyPlanScreen.tsx`, `squadUi.tsx`, `JoinScreen.tsx`, `WhereScreen.tsx`, `SafetyScreen.tsx` com strings cruas | extrair tudo para `i18n/index.ts` (chaves novas) + PT/EN | G3 |
| E08 | "Foi escolhido — mas por quê?" | `squadUi.tsx → methodLabel` devolve rótulo cru ("plurality"/"owner pick") sem explicação; `buildSquadPlan` já tem `goingCount`/`favCount`/membros | tela/sheet "Por que isto?" por bloco: lista quem **favoritou**, quem **vai**, e a regra aplicada; + glossário dos métodos | G3 |
| E07 | Meu plano não aparece no squad depois que eu o terminei | só `ShareMyPlanScreen`/`SquadBlockScreen` chamam `shareMyPlan` (snapshot manual); edições do Meu Plano são locais | **auto re-share** o plano do membro aos squads dele ao mudar (debounced); **histórico** de mudanças do squad-plan; **notificar** o grupo (o quê/quem/porquê). Server + client | G4 |
| E16 | Compartilho preciso, mas apareço no palco | `server/src/api/dto.ts → PresenceMemberDto` **não carrega lat/lng**; `web/src/data/types.ts` idem; `CoarsePresenceMap.buildPins` plota no palco | expor coordenada exata **apenas** para membros do squad quando o usuário está em **precise + live (TTL)**; plotar o ponto exato; respeitar opt-out/expiração | G5 |
| E09 | "Onde está todo mundo: ninguém compartilhando" | `WhereScreen.tsx` checa `optedIn` (default invisível) | pedir localização no **join** do squad; default **coarse-visível**; opt-out explícito; reconciliar DEC-006/007/015/058 | G5 |
| E10 | Lista plana de nomes | `WhereScreen.tsx` usa `sortRoster`; `presenceUi.tsx → groupRosterByStage` já existe | usar `groupRosterByStage` na tela cheia (palco mais cheio no topo, esconder vazios) | G5 |
| E12/E13/E14 | SOS quebrado (dois alertando, ninguém se fala; parar não sincroniza; sem zoom) | `routes/meet/SafetyScreen.tsx` (estados/cópia), fan-out do fim do SOS, mapa sem gestos | redesenho do fluxo (consciência mútua + convergência + parar-sincroniza + mapa com zoom) | G6 |
| E15 | Bússola não ativa quando "chegou" | `web/src/lib/useGeo.ts → useHeading` bloqueia em `arrived` (<15m); `MeetNavScreen.tsx` | permitir ativar bússola sempre (manual override do estado arrived) | G6 |
| E19 | Foto do ponto fixa, não abre | `routes/meet/MeetDetailScreen.tsx` renderiza `<img>` estático | lightbox tap-to-zoom (reusar padrão de imagem cheia se houver) | G7 |
| E20 | Sem comunicação no ponto | nenhuma thread por ponto (só nota única) | mural por ponto de encontro (reusar padrão de board/mensagens) | G7 |
| E03 | Join confuso | `JoinScreen.tsx → JoinEntry` input único, placeholder = URL | três affordances (link/QR/código) + **scan** de câmera + placeholder = só o código + "ou cole o link" | G8 |
| E24 | "Horários" rejeitado | `i18n/index.ts` `nav.timetable`/`view.timetable` = "Horários" (PT) | PT = "Timetable" | G8 |
| E27 | Line Up estoura em PT | `i18n/index.ts` "Favoritos" | "Favs" (PT) + revisar largura dos botões do Line Up | G8 |
| E26 | Nome do festival sobre o avatar (PT) | `app/AppHeader.tsx` não reserva espaço do avatar | header reserva a largura do avatar; truncar o título antes de colidir | G8 |
| E25 | Notificações "em breve" | `settings/SettingsScreen.tsx` pill `settings.soon`; sem implementação | notificações **locais on-device** (lembrete de set + "saia agora" por tempo de caminhada); documentar tier de push server | G9 |
| E11 | Zoom ainda pixela | base do mapa (re-open do D01/G3 da leva 1) | re-checar fidelidade/cap da base; só ajustar se confirmado | G10 |
| E21 | Não dá pra inserir evento no squad-plan pela tela do plano | `squadTimeline.ts` já interleava events; falta affordance | botão "adicionar ao plano" no `SquadPlanScreen` cria group event do squad (reuso) | G10 |
| E22/E23 | Reorg agenda + trocar squad no Now | `SquadScreen.tsx` / `NowScreen.tsx` | reorg leve + seletor de squad quando >1 (futuro) | G10 |

---

## §7 — Decisões + conselhos inline (no subagents)

> Conselhos completos (4 vozes) para os forks reais; rápidos (2 vozes) para os menores. Cada um vira um `DEC-NNN`.

### Decisões diretas (diretivas claras do Julio — sem conselho)
- **DEC-089** — **iOS chrome + portrait.** Safe-areas corretas (sem barra preta, sem conteúdo espremido) e **portrait-only**. (E01/E02)
- **DEC-107** — **Barras de sistema profissionais (iOS + Android).** Manifest `theme_color`/`background_color` + `theme-color` dinâmico por paleta refletem o chrome do app; a barra de status/notificações e a de navegação (Android) acompanham; documentar o limite do PWA (controle total exige TWA/Capacitor — DEC-035). (E28) Refina DEC-088. **Direta.** | G1
- **DEC-090** — **Base de mapa unificada.** Uma única via de carregamento da base para todas as superfícies, com fallback de cor (nunca preto). (E17)
- **DEC-091** — **Sem texto preto.** Tinta legível em todos os sheets/labels de mapa. (E18)
- **DEC-092** — **"Próximo" do squad lê o plano agregado** (alimenta `sets`) na home e no Now. (E04)
- **DEC-093** — **CTA reflete existência** do plano ("ver/gerenciar" vs "montar"). (E05)
- **DEC-094** — **i18n das sub-telas de squad/meet/presence**; **"Timetable" fica "Timetable" em PT**; **"Favoritos"→"Favs"**. (E06/E24/E27)
- **DEC-098** — **Group-by-stage na tela cheia** (reusa `groupRosterByStage`). (E10)
- **DEC-101** — **Bússola ativável mesmo "chegado".** (E15)
- **DEC-103** — **Join com link/QR/scan/código** e placeholder claro. (E03)
- **DEC-104** — **Nome do festival nunca sob o avatar** (header reserva espaço/trunca). (E26)
- **DEC-106** — **Re-check de zoom do mapa** (re-open D01) + estrutura squad P2 (inserir eventos no plano, reorg, multi-squad) — só com folga. (E11/E21/E22/E23)

---

### C1 (conselho) → **DEC-095 — Squad vivo: re-share automático + histórico + notificação**

**Decision Brief (neutro):** Hoje compartilhar o plano com o squad é um **snapshot manual** (`shareMyPlan` num clique). Quando um membro depois edita seu plano pessoal, o squad-plan **não** muda — a dor #1 do Julio. A agregação (`buildSquadPlan`) é pura e barata e roda no cliente sobre os planos compartilhados. Fatos: já há `useGroupLive` (socket) + refetch on focus; o servidor guarda o último plano compartilhado por membro. Pergunta: **como manter o squad-plan sempre fresco** quando qualquer membro muda, **com histórico do porquê** e **notificação ao grupo** — sem fechar/relockar o squad manualmente? *Viés a resistir:* "é só chamar shareMyPlan no submit" (ignora histórico, notificação e custo de escrita).

**Architect (blind):** O modelo certo é **plano pessoal compartilhado = fonte da verdade do membro**, com re-publish automático **debounced** ao mudar (e ao reconectar). O servidor versiona o plano de cada membro (`revision`, `updatedAt`) e mantém um **squad changelog** append-only (entradas `{actor, fromSet→toSet, affectedBlock, reason}`) derivado do diff de agregação entre revisões. O socket `GroupRoom` faz fan-out de um evento `squad-plan-changed`; o cliente reagrega e mostra um toast/badge "plano do grupo atualizado". Rec: auto re-share debounced + revisão por membro + changelog derivado server-side. Confiança: ALTA. Outros perdem: sem **debounce + idempotência por revisão**, edição rápida vira tempestade de escrita/notificação.

**Advocate (blind):** O usuário quer **zero gestão**: "mudei o meu, o grupo já sabe". Nada de "relockar". A notificação tem que dizer **o porquê em humano**: "O squad agora vai pro Fisher (18h) porque você trocou Coach→Fisher" — não um diff técnico. O histórico precisa ser **uma telinha** acessível ("ver histórico do plano do grupo") com frases, não JSON. Rec: re-share invisível + notificação em linguagem natural + histórico narrado. Confiança: ALTA. Outros perdem: se a notificação disparar pra **quem causou** a mudança, irrita; notifique os **outros** membros.

**Critic (blind):** Os riscos: (1) **loop**/eco — reagregar dispara evento que dispara reagregação; (2) **flapping** — duas pessoas editando alternam o vencedor e spammam histórico; (3) **custo de socket/escrita** num festival com rede ruim; (4) **conflito com locks** — quem travou um bloco não pode ter o plano sobrescrito. Rec: changelog **coalescido** por janela (ex.: agrupa mudanças de 30–60s), re-share **idempotente por revisão**, e o diff de agregação calculado **uma vez** server-side (cliente não reescreve histórico). Confiança: MÉDIA. Outros perdem: sem coalescing, o histórico fica ilegível num grupo ativo.

**Strategist (blind):** Isto é **o coração do produto** ("juntos"). Vale investir num modelo durável: revisão por membro + changelog do grupo é a base para notificações, para "o que mudou desde que vi", e para confiança. Não terceirize a verdade ao cliente. Rec: server é dono da revisão + do changelog + do fan-out; cliente só reage. Confiança: ALTA. Outros perdem: meia-boca (auto-reshare sem histórico) reabre a dor em duas semanas.

**Red team (matar o líder):** "Auto re-share + changelog server-side é over-engineering; só re-chame `shareMyPlan` no save e deixe o `useGroupLive` puxar." — Falha porque: não há **porquê** (sem diff narrável), não há **notificação** ("avisar todo mundo que mudou e por quê" — pedido explícito), e o refetch-on-focus não acorda quem está com o app aberto noutra aba. O pedido do Julio é explicitamente histórico + aviso, não só frescor.

**Síntese (Chair):** **Servidor é dono.** (1) Plano de cada membro ganha `revision`+`updatedAt`; o cliente **re-publica automático e debounced** (~2–4s ocioso, + on-reconnect) quando o plano pessoal muda. (2) O servidor recomputa o efeito no squad-plan e grava entradas **coalescidas** num **changelog do grupo** (`{actor, change, affectedBlocks, derivedReason}`). (3) `GroupRoom` faz fan-out `squad-plan-changed`; clientes (menos o autor) recebem **notificação em linguagem natural** + badge; uma tela "Histórico do plano do grupo" narra as mudanças. (4) Locks são respeitados (re-share nunca sobrescreve bloco travado). Lente dominante = **Architect/Strategist** (é arquitetura central durável). Condições: idempotência por revisão + coalescing. Flip: se o backend não suportar versionar a tempo, **degradar** para "badge de plano desatualizado + 1 toque para atualizar" (sem perder o histórico). Confiança: ALTA.

---

### C2 (conselho) → **DEC-099 — Presença precisa: expor coordenada exata ao squad (live + TTL)**

**Decision Brief (neutro):** Quando um membro escolhe **compartilhar preciso** (ou pede SOS), os outros **não conseguem achá-lo**: o `PresenceMemberDto` **nunca carrega lat/lng** (decisão histórica DEC-046/058 — "nenhum DTO carrega coordenada"), então o `CoarsePresenceMap` plota todo mundo **no palco**. O Julio: *"mesmo compartilhando preciso, eu apareço no palco — a pessoa nunca vai chegar em mim."* Pergunta: **expor a coordenada exata** aos membros do squad **quando o usuário opta por preciso** (e no SOS), respeitando privacidade? *Viés a resistir:* "privacidade acima de tudo" (mas o usuário **pediu** para ser achado — é o caso de uso).

**Architect (blind):** Criar um canal/DTO **separado** `PrecisePresenceDto {memberId, lat, lng, accuracy, expiresAt}` entregue **só** a membros do mesmo squad e **só** enquanto o dono está em `precise + live` (TTL curto, ex. 15–60 min, renovável). Não tocar no `PresenceMemberDto` coarse (mantém o default barato/privado). Cliente plota ponto exato quando há `PrecisePresenceDto`. Rec: DTO preciso separado, escopo-squad, TTL. Confiança: ALTA. Outros perdem: misturar no DTO coarse vaza coordenada pra todo estado de presença.

**Advocate (blind):** O usuário **quer** ser encontrado — negar a coordenada quando ele pediu ajuda é o app **falhando no momento crítico**. Mostre o ponto exato + "atualizado há Xs" + um botão claro "navegar até". Sem precise ativo, mostre o palco (como hoje). Rec: precise visível ao squad quando ligado; UI deixa explícito "você está compartilhando seu ponto exato". Confiança: ALTA. Outros perdem: precisa de **feedback ao dono** ("3 pessoas podem ver seu ponto exato") senão assusta.

**Critic (blind):** Riscos: (1) **vazamento** se o escopo não for estritamente squad + TTL; (2) coordenada **velha** parecer atual (mostrar accuracy + idade); (3) **bateria/precisão** em festival; (4) abuso (alguém liga preciso e esquece). Rec: TTL obrigatório + auto-expira + indicador de idade + "parar" sempre 1 toque (e que **sincroniza** — ver E13). Confiança: MÉDIA. Outros perdem: sem TTL, "preciso" vira rastreamento permanente.

**Strategist (blind):** É **diferenciador de segurança** ("se perder no festival, o squad te acha"). Mas é o ponto mais sensível de privacidade do app — a postura tem que ser **opt-in explícito, escopo-squad, efêmero**. Bem feito, é confiança; mal feito, é manchete. Rec: enviar como feature de **segurança opt-in**, com linguagem clara. Confiança: ALTA. Outros perdem: tratar como "presença normal" some com a fronteira de privacidade.

**Red team (matar o líder):** "Nunca exponha coordenada exata — mostre só o palco + uma seta de bússola." — Falha porque: num palco lotado, 'palco' não é achável; o usuário **pediu explicitamente** o ponto exato para SOS. A bússola sem alvo preciso aponta pro centro do palco, não pra pessoa. O caso de uso é exatamente "me ache aqui".

**Síntese (Chair):** **DTO preciso separado, escopo-squad, efêmero.** Novo `PrecisePresenceDto` (lat/lng/accuracy/expiresAt) entregue **apenas** a membros do mesmo squad e **apenas** enquanto o dono está em `precise + live` (TTL renovável; auto-expira). O `PresenceMemberDto` coarse fica intacto (default privado/barato). Cliente plota ponto exato + idade + accuracy + "navegar até"; o dono vê "N pessoas podem ver seu ponto exato" e "parar" em 1 toque (sincroniza entre devices). No SOS, ligar preciso é parte do fluxo (C4). Lente dominante = **Architect+Critic** (privacidade por construção). Condições: TTL + escopo + indicador de idade. Flip: se o backend não puder garantir escopo-squad com segurança a tempo, ship só dentro do **SOS ativo** primeiro (escopo mínimo). Confiança: ALTA.

---

### C3 (conselho) → **DEC-097 — Default de presença: pedir no join, coarse-visível por padrão**

**Decision Brief (neutro):** Hoje, ao abrir "Onde está todo mundo", **ninguém aparece** (`optedIn` default = invisível) e é preciso ligar manualmente em 2 telas. O Julio: *"não deveria ser invisível por padrão; quando entro no squad já deveria pedir a localização e já ficar visível."* Há DECs de privacidade (DEC-006/007/015 coarse-by-default; DEC-058 precise opt-in). Pergunta: tornar **coarse-visível por padrão ao entrar no squad** (com pedido de permissão no join e opt-out fácil) sem violar a postura de privacidade? *Viés a resistir:* "privacidade = invisível por padrão" (o produto é **estar junto**; coarse stage-level é de baixo risco).

**Advocate (blind):** O propósito do squad é se ver. Invisível-por-padrão mata a feature: ninguém liga, ninguém aparece, parece quebrado. Pedir permissão **no momento de entrar no squad** (contexto claro) + ficar **coarse-visível** é o comportamento esperado. Opt-out em 1 toque. Rec: coarse-visível por padrão ao aceitar entrar no squad. Confiança: ALTA. Outros perdem: o pedido tem que explicar "palco-nível, não exato".

**Critic (blind):** Coarse (stage-level) é baixo risco, mas "visível por padrão" muda a postura — precisa ser **informado** (o usuário aceitou ao entrar) e **reversível** (opt-out óbvio + "ficar invisível"). Não pode ligar **preciso** por padrão (isso continua opt-in — C2). Rec: default coarse-visível **somente após** o usuário confirmar no join; preciso nunca default. Confiança: MÉDIA. Outros perdem: ligar localização sem um "sim" explícito quebra confiança/lojas.

**Architect (blind):** Tecnicamente: mover o opt-in para o **fluxo de join** (um passo "compartilhar sua localização com o squad?" com default sim-coarse), persistir por-squad, e o `WhereScreen` deixa de exigir 2 toques. Reconciliar com DEC-006/007/015 atualizando o default **no contexto squad** (fora de squad permanece como está). Rec: estado de presença por-squad, default coarse-on ao entrar. Confiança: ALTA. Outros perdem: default global muda demais — escopar ao squad.

**Strategist (blind):** "Estar junto" é o coração; fricção aqui custa adoção. Mas a marca também é "respeita sua localização". A síntese é **transparência no momento certo**: pedir ao entrar, explicar coarse, default visível, opt-out fácil. Rec: ship como parte do onboarding de squad. Confiança: ALTA. Outros perdem: sem a tela de contexto, vira "por que esse app me rastreia?".

**Red team (matar o líder):** "Mantenha invisível por padrão; só um toque pra aparecer." — Falha porque: o Julio mostrou que esse toque **não acontece** e a tela fica vazia ("ninguém compartilhando"); a feature morre. O risco do coarse é baixo e o consentimento existe (entrar no squad + tela de permissão).

**Síntese (Chair):** **Pedir no join, coarse-visível por padrão, escopo-squad, opt-out 1 toque.** Adicionar um passo no fluxo de entrar no squad: "compartilhar sua localização (nível-palco) com o {squad}?" com default **sim**; ao aceitar, o membro fica **coarse-visível** sem toques extras no `WhereScreen`. **Preciso continua opt-in** (C2). Atualiza DEC-006/007/015 **no contexto squad** (fora de squad inalterado). Lente dominante = **Advocate+Strategist** (adoção do core), com a guarda do **Critic** (consentimento informado + reversível). Condições: tela de contexto + opt-out óbvio + preciso nunca default. Flip: se lojas/políticas exigirem opt-in estrito, manter visível-por-padrão mas com o pedido **proeminente** no primeiro acesso ao squad. Confiança: ALTA.

---

### C4 (conselho) → **DEC-100 — Redesenho do fluxo SOS/perdido (mútuo, convergência, parar-sincroniza)**

**Decision Brief (neutro):** O fluxo "estou perdido"/SOS está quebrado na prática: dois membros podem estar alertando ao mesmo tempo e **ninguém se comunica** ("aguardando o squad ver isso", "sem resposta"); o mapa do SOS **não dá zoom** (só dropar waypoint); **parar de compartilhar não sincroniza** (o outro device ainda mostra "Júlio precisa de ajuda"); e o aviso de SOS **só aparece dentro do squad** (não no "Agora"). Pergunta: como deve ser o fluxo para que **achar/ser achado** funcione de verdade e seja calmo? *Viés a resistir:* "adicionar mais botões" (o problema é fluxo/estado, não falta de botão).

**Advocate (blind):** O usuário perdido quer **uma ação**: "me achem" → liga preciso + alerta. Quem ajuda quer **uma ação**: "ir até ele" → navegação com ponto exato (C2). O estado tem que ser **mútuo e claro**: "Você e Maria estão se procurando" com botão "navegar até Maria" / "Maria está vindo". Nada de "aguardando…". Rec: reduzir a 2 ações claras + estado mútuo. Confiança: ALTA. Outros perdem: o aviso tem que estar **no Agora** também (não escondido no squad).

**Architect (blind):** Modelar SOS como **sessão de squad** com estados (`active`/`resolved`) e participantes; o fim do SOS é um evento com **fan-out** (resolve em todos os devices — corrige E13). Reusar o `PrecisePresenceDto` (C2) para o alvo. O mapa do SOS deve reusar a **mesma base + gestos** do `MapView` (zoom — corrige E14), não um mapa especial sem gestos. Rec: SOS = sessão com fan-out + reuso do MapView + precise. Confiança: ALTA. Outros perdem: sem fan-out do "resolved", o estado fantasma persiste.

**Critic (blind):** Riscos: (1) **estado preso** (E13 já mostra isso) → fan-out idempotente + TTL; (2) **vários SOS** simultâneos → lista priorizada, não um overlay sobre o outro; (3) **pânico** → cópia calma, sem vermelho agressivo; (4) bateria com preciso ligado → TTL. Rec: resolver E13 primeiro (sincronizar o fim), depois a consciência mútua. Confiança: MÉDIA. Outros perdem: redesenhar a UI sem corrigir o fan-out deixa o bug central.

**Strategist (blind):** "Não se perca do squad" é uma promessa forte do produto. Tem que **funcionar** ou vira desconfiança. O alvo é: qualquer membro perdido é achável em <1 min, qualquer um pode navegar até ele, e ninguém fica preso num estado fantasma. Rec: tratar como feature de segurança de primeira classe (aviso global no Agora + squad + push quando E25 existir). Confiança: ALTA. Outros perdem: subestimar quão visível o aviso precisa ser.

**Red team (matar o líder):** "Não redesenhe — só conserte o bug de sincronizar o stop e pronto." — Falha porque: o Julio descreveu **vários** problemas de fluxo (mútuo, zoom, visibilidade no Agora, comunicação), não só o stop. Corrigir só E13 deixa "ninguém se comunica" e "não dá zoom" intactos — ele disse "tá tudo meio quebrado, a gente tem que refazer fluxos".

**Síntese (Chair):** **SOS = sessão de squad, mútua, com reuso do mapa e fan-out do fim.** (1) **Corrigir E13 primeiro:** parar de compartilhar/encerrar SOS faz fan-out idempotente que resolve em todos os devices (sem estado fantasma). (2) **Consciência mútua:** estado claro "vocês estão se procurando", com "navegar até {nome}" (usando precise de C2) e "estou indo". (3) **Mapa do SOS reusa `MapView`** (zoom/gestos + base unificada de G2). (4) **Aviso de SOS aparece no Agora** (ambas as abas) + no squad. (5) Cópia calma; múltiplos SOS viram lista priorizada. Lente dominante = **Architect+Strategist**. Condições: E13 antes da UI; precise (C2) e base unificada (G2) já no lugar. Flip: se faltar tempo, ship o **núcleo** (E13 + aviso no Agora + zoom) e adiar a comunicação "estou indo". Confiança: MÉDIA-ALTA.

---

### C5 (conselho) → **DEC-105 — Notificações: locais on-device primeiro, push server documentado**

**Decision Brief (neutro):** As notificações estão como "em breve" (`settings.soon`). O Julio: *"as notificações são uma das coisas mais importantes desse app — têm que funcionar."* O app é PWA (iOS tem suporte a Web Push só em standalone, ≥16.4, com limitações). Pergunta: **o que entregar primeiro** que seja confiável e de alto valor? *Viés a resistir:* "push server completo agora" (caro/arriscado no iOS PWA; pode falhar no momento da demo).

**Architect (blind):** Há dois tiers: (a) **lembretes locais on-device** (Notification API + timers/Service Worker enquanto o app rodou) — sem backend, funciona offline, ideal para "seu set começa em 15 min" e "saia agora (X min de caminhada)"; (b) **Web Push server** (precisa VAPID + subscription + worker push) para eventos quando o app está fechado (SOS, mudança do squad-plan). Rec: shipar (a) já, **documentar e preparar** (b) atrás de flag. Confiança: ALTA. Outros perdem: iOS PWA push é frágil — local é o que funciona garantido.

**Advocate (blind):** O valor #1 é **não perder o artista** e **saber a hora de sair** (com tempo de caminhada — o app já sabe distâncias). Isso é **local** e já entrega 80%. O usuário não diferencia "local" de "push" — ele quer o lembrete na hora certa. Rec: lembretes de set + leave-by primeiro. Confiança: ALTA. Outros perdem: precisa de **permissão pedida no contexto certo** (ao favoritar/lockar), não de cara.

**Critic (blind):** Riscos: (1) iOS mata timers em background → lembretes locais só disparam se agendados via SW e mesmo assim limitados; (2) **permissão negada** → degradar pra in-app; (3) **spam** → agrupar e respeitar quiet hours; (4) push server no iOS = suporte irregular → não prometer o que não entrega. Rec: local primeiro, com expectativas claras; push server como fase 2 medida. Confiança: MÉDIA. Outros perdem: prometer push de SOS com app fechado no iOS pode não funcionar — comunicar limite.

**Strategist (blind):** Notificações são retenção e o "fica junto" em tempo real. Mas confiabilidade > completude: melhor um lembrete local que **sempre** funciona do que um push que às vezes some. Rec: ship local agora (ganho garantido), roadmap push server (SOS/squad) como próximo. Confiança: ALTA. Outros perdem: sem permissão pedida no momento certo, taxa de opt-in despenca.

**Red team (matar o líder):** "Faça Web Push server completo agora — é o que 'notificações de verdade' significa." — Falha porque: no iOS PWA o push é instável e exige standalone + gestos; arriscar o recurso mais importante num caminho frágil pode resultar em "não chegou nada". Local entrega valor garantido já; push entra medido.

**Síntese (Chair):** **Local on-device primeiro; push server documentado/preparado.** Ship: (1) permissão pedida **no contexto** (ao favoritar/lockar 1º set ou em Settings); (2) **lembrete de set** ("começa em N min") e **leave-by** ("saia agora — X min de caminhada", reusando distâncias já calculadas); (3) agendados via Service Worker, com degradação in-app se negado; (4) quiet hours/agrupamento. **Preparar** (sem prometer) o tier de **Web Push server** (VAPID + subscription) para SOS e `squad-plan-changed` numa próxima leva, atrás de flag. Lente dominante = **Architect+Strategist** (confiabilidade). Condições: pedir permissão no contexto; comunicar limites do iOS. Flip: se o ambiente suportar push server estável a tempo, antecipar SOS/squad-change push neste mesmo gate. Confiança: ALTA.

---

### C6 (conselho rápido) → **DEC-096 — Transparência das escolhas do grupo**

**Decision Brief (neutro):** O squad mostra rótulos crus ("foi o mais favoritado", "por pluralidade", "owner pick") sem explicar o que significam nem **quem** causou. O Julio quer, por bloco, **a explicação completa**: quem favoritou, quem vai, e por que aquilo entrou — "mesmo quem não vai entende por que foi selecionado". A agregação já tem `goingCount`/`favCount`/método/membros.

**Advocate (blind):** Um toque "Por que isto?" em cada bloco abre um sheet humano: "**Mébron** entrou porque **Ana, Léo e você** favoritaram (3) — mais favoritado que as alternativas". Lista nomes, não números secos. + um glossário curto dos métodos. Rec: sheet por bloco + glossário. Confiança: ALTA. Outros perdem: tem que cobrir o caso **conflito/split** ("você está travado em Coach; o squad vai pro Fisher porque…").

**Architect (blind):** É **exposição**, não cálculo: ler o que `buildSquadPlan` já produz (membros que favoritaram/vão, método) e renderizar em frases via `t()`. Nada toca a agregação (invariância). Rec: função pura `explainSquadBlock(block) → {method, going[], favorited[], reason}` + UI. Confiança: ALTA. Outros perdem: precisa de dados de **quem** favoritou/vai por bloco (confirmar que a agregação expõe os membros, não só contagens).

**Síntese (Chair):** **Sheet "Por que isto?" por bloco + glossário dos métodos**, em linguagem natural com **nomes**, derivado do que a agregação já calcula (pura `explainSquadBlock`, zero mudança de matemática). Cobrir favorited/plurality/owner **e o caso split** (locked vs squad). Lente dominante = **Advocate** (compreensão do usuário). Condição: a agregação precisa expor os **membros** por bloco — se hoje só dá contagem, estender o domínio para listar membros (sem mudar o vencedor). Confiança: ALTA.

---

### C7 (conselho rápido) → **DEC-102 — Ponto de encontro: lightbox de foto + mural**

**Decision Brief (neutro):** A foto do ponto de encontro é estática (não abre/zoom) e não há **comunicação** por ponto. O Julio quer tocar a foto pra ampliar e um **mural** por ponto ("onde é, como chegar, dúvidas") — fotos **e** texto. Existe nota única, não thread.

**Advocate (blind):** Dois ganhos baratos e altos: (1) **lightbox** ao tocar a foto (ampliar/pinch); (2) **mural** por ponto = lista de mensagens (texto + foto) com autor e hora. Vira o canal de "tô aqui", "chegando", "é na barraca azul". Rec: lightbox + mural por ponto. Confiança: ALTA. Outros perdem: o mural deve fan-out via socket como o resto do squad (tempo real).

**Critic (blind):** Mural é **escopo novo** (P2): precisa de modelo de mensagens, fan-out, moderação mínima e i18n. Lightbox é trivial (P1, faça já). Risco de inchar a leva. Rec: lightbox no G7; mural **só com folga** (reusar padrão de board/mensagens se existir). Confiança: MÉDIA. Outros perdem: construir mural do zero quando pode reusar componente de lista/compose existente.

**Síntese (Chair):** **Lightbox = P1 (G7), agora.** **Mural = P2 (G7 se houver folga, senão deferir)**, reusando o padrão de mensagens/board existente e o fan-out do `GroupRoom`. Lente dominante = **Critic** (não inflar). Confiança: ALTA.

---

## §8 — Estratégia de testes (teste JUNTO com a mudança)

- **Domínio puro primeiro (>90%):** `squadNextUp` alimentado de verdade (E04), `explainSquadBlock` (E08/C6 — nomes/método/reason com valores concretos), diff de agregação do histórico (E07/C1 — `from→to` por revisão), `groupRosterByStage` (E10 — ordenação por nº). Cada função financeira/decisória ganha teste com números reais.
- **Invariância:** após E07/E08, o **vencedor de cada bloco é idêntico ao baseline** (a explicação/atualização não muda a matemática). Teste pin do `mergeSquadTimeline` continua verde.
- **Reusar & estender** os testes existentes de `squadPlan`/`squadTimeline`/presence — não duplicar.
- **UI crítica via E2E (>70%):** entrar no squad → ver "Próximo" real; mudar plano pessoal → squad atualiza + histórico + aviso; compartilhar preciso → ponto exato aparece pro outro; SOS → resolve nos dois devices.
- **"Suíte verde entre gates"** = 0 falhas **além** das baseline conhecidas (registrar em G0 quais são, ex.: testes que exigem Node 22/WebCrypto e só passam no CI).

---

## §9 — Protocolo por milestone + refresh de contexto

**Antes de cada commit (auto-check 5 pontos):** (1) liste os ACs satisfeitos do gate; (2) nomeie **3 ACs anteriores em risco de regressão** e verifique (sobretudo **invariância da agregação** e **não bloquear logar presença/plano**); (3) rode os testes — **sem novas falhas**; (4) sinalize qualquer arquivo tocado **fora** do escopo do milestone; (5) atualize `web/src/dev-log.md`.

**Em cada fronteira de gate:** releia §3 + o escopo do próximo gate + o Current State do dev-log; imprima o **bloco ÂNCORA** + a linha **CURRENT STATE** (gate / último commit / testes / riscos / escopo). **A cada 3 milestones:** refresh leve (regras críticas + dev-log).

---

## §10 — O BUILD — gates G0 → G10

> Cada gate fecha com: suíte verde + `build` + `tsc --noEmit` + smoke (3 jornadas) + bump de versão + **deploy** + dev-log + DECs do gate `PROPOSED→APPROVED`.

### G0 — Setup & baseline (sempre)
- **Por quê:** referência de regressão.
- **Fazer:** `npm install` (web + server); `npm run test` + `npm run build` + `tsc --noEmit` (web); registrar **contagens baseline** e falhas baseline conhecidas; semear `web/src/dev-log.md` (Current State + tabela desta leva, mais-recente no topo, preservando a leva 1); adicionar DEC-089…107 como `PROPOSED` no `decision-log.md`; confirmar pipeline (Cloudflare Pages → `festpilot.pages.dev` + `/version.json`).
- **AC:** baseline verde documentado; dev-log semeado; DECs `PROPOSED`; pipeline confirmado.

### G1 — Feel nativo (iOS + barras de sistema Android) · → **v0.42.0**
- **Itens:** E01, E02, E28. **DEC-089, DEC-107.**
- **Por quê:** é a **primeira** impressão e o Julio disse que "todo o app está ficando assim" (barra preta + espremido no iOS) e que no Android as barras de status/navegação não estão customizadas. Global, baixo risco, alto "consertou".
- **Causa-raiz:** `web/index.html` status-bar-style + safe-areas; `manifest.webmanifest` sem orientation; `theme_color`/`background_color` + `theme-color` dinâmico não refletindo o chrome no Android.
- **Mudança:** (iOS) `viewport-fit=cover` consistente; `env(safe-area-inset-*)` no shell/header/tab-bar; reavaliar `apple-mobile-web-app-status-bar-style` (testar `default`); altura `100dvh`/`--app-height` cobrindo a tela; `orientation:"portrait"` no manifest + guarda CSS de landscape. (Android) `theme_color`/`background_color` do manifest = chrome do app; confirmar `applyThemeColor` por paleta dia/noite cobre a status-bar; garantir que a barra de **navegação** Android (instalado) acompanha; documentar que o controle total da nav-bar exige TWA/Capacitor (DEC-035) — sem construir o wrapper agora.
- **AC:** iOS standalone sem barra preta nem conteúdo espremido/travado; tab-bar respeita o inset inferior; app não gira para landscape; **Android instalado** mostra status/notificações **e** navegação na cor do chrome do app (dia/noite), não cinza/branco genérico.
- **Testes:** smoke manual **iOS + Android** (matriz §15); unit do `applyThemeColor`/`THEME_COLOR` por paleta (reusa `chrome.test.ts`); snapshot/visual do shell se houver.

### G2 — Sem preto: base de mapa unificada + tinta legível · → **v0.43.0**
- **Itens:** E17, E18. **DEC-090, DEC-091.**
- **Por quê:** P0 visual — mapas pretos em sub-fluxos e texto preto no escuro fazem o app parecer quebrado.
- **Causa-raiz:** vias divergentes de base (`/maps/<id>.webp` ausente vs `map.baseDayUrl`); tinta hardcoded em sheets/labels.
- **Mudança:** uma via única de base (hook/`<MapBase>`) resolvendo a fonte com **fallback de cor** (nunca preto) usada por `MapView`, `MeetSpotScreen`, `RouteScreen`, `CoarsePresenceMap`, SOS; varrer e trocar tinta preta por token de tema em `StagePickSheet` e labels do meeting point.
- **AC:** todas as superfícies de mapa mostram a base (ou fallback de cor com nomes de palco) — **zero fundo preto**; nenhum texto preto no escuro.
- **Testes:** E2E que abre rota + meeting-spot e afirma que a base não é preta; revisão visual dos sheets.

### G3 — Squad honesto: Próximo real + CTA + i18n + transparência · → **v0.44.0**
- **Itens:** E04, E05, E06, E08. **DEC-092/093/094/096.**
- **Por quê:** a dor central de clareza — o squad mente ("nada agendado"), fala inglês e não se explica.
- **Causa-raiz:** `SquadNextUpCard` sem `sets`; CTA estático; strings cruas; `methodLabel` sem explicação.
- **Mudança:** alimentar `sets` do `useSquadPlan` no card (home + Now); CTA condicional ("ver/gerenciar" vs "montar"); extrair i18n de todas as sub-telas (+ "Timetable" em PT, "Favs"); `explainSquadBlock` puro + sheet "Por que isto?" por bloco + glossário (cobrir split).
- **AC:** com plano, a home e o Now mostram o **próximo real**; CTA reflete existência; nenhuma string de squad em inglês quando PT; tocar um bloco explica em frases (com nomes) por que entrou; **vencedores idênticos ao baseline**.
- **Testes:** `squadNextUp` com `sets` reais; `explainSquadBlock` (favorited/plurality/owner/split) com valores; invariância da agregação; E2E "vejo o próximo real".

### G4 — Squad vivo: re-share + histórico + notificação · → **v0.45.0**
- **Itens:** E07. **DEC-095.**
- **Por quê:** **a dor #1** — o plano do grupo precisa ficar sempre fresco. Toca servidor → gate próprio (risco).
- **Causa-raiz:** `shareMyPlan` é snapshot manual; sem revisão/histórico/fan-out.
- **Mudança (server+client):** `revision`+`updatedAt` por plano de membro; cliente **re-publica debounced** ao mudar o plano pessoal (+ on-reconnect, idempotente por revisão); servidor recomputa o efeito e grava **changelog coalescido**; `GroupRoom` fan-out `squad-plan-changed`; clientes (≠ autor) recebem **aviso em linguagem natural** + badge; tela "Histórico do plano do grupo". Locks respeitados.
- **AC:** mudei meu plano → em segundos o squad-plan reflete e os outros são avisados do **porquê**; existe histórico narrado; sem loop/spam (coalescido); bloco travado nunca sobrescrito.
- **Testes:** diff de agregação por revisão (domínio, valores concretos); idempotência por revisão; E2E dois clientes (A muda → B vê + histórico).
- **Flip documentado:** se o backend não versionar a tempo → degradar para "badge desatualizado + 1 toque atualizar" (mantendo histórico).

### G5 — Verdade de localização: ponto preciso + default + group-by-stage · → **v0.46.0**
- **Itens:** E16, E09, E10. **DEC-099/097/098.**
- **Por quê:** P0 de segurança/adoção — ser achável e ver o squad por palco.
- **Causa-raiz:** DTO sem coordenada; `optedIn` invisível default; `WhereScreen` lista plana.
- **Mudança:** `PrecisePresenceDto` (lat/lng/accuracy/expiresAt) **escopo-squad + TTL**, entregue só p/ precise+live; cliente plota ponto exato + idade + "navegar até"; dono vê "N podem ver seu ponto" + parar 1 toque; passo de localização no **join** (coarse-visível default, opt-out); `WhereScreen` usa `groupRosterByStage`.
- **AC:** compartilhei preciso → o outro vê meu **ponto exato** (com idade), não o palco; ao entrar no squad fico coarse-visível após consentir; "Onde está todo mundo" agrupa por palco (mais cheio no topo, esconde vazios).
- **Testes:** `groupRosterByStage` (ordenação/contagem); E2E "preciso aparece pro outro"; verificação de escopo/TTL do DTO preciso.

### G6 — SOS/segurança + navegação · → **v0.47.0**
- **Itens:** E13, E12, E14, E15. **DEC-100/101.**
- **Por quê:** "não se perca do squad" tem que funcionar.
- **Mudança:** **(E13 primeiro)** encerrar SOS/parar compartilhamento faz fan-out idempotente (resolve em todos os devices); **(E12)** estado mútuo "vocês estão se procurando" + "navegar até {nome}" (usa preciso de G5) + aviso de SOS **no Agora** e no squad; **(E14)** mapa do SOS reusa `MapView` (zoom/gestos + base de G2); **(E15)** bússola ativável mesmo "chegado" (override do estado arrived em `useHeading`/`MeetNavScreen`).
- **AC:** parei → o outro device some o "precisa de ajuda"; vejo o aviso de SOS no Agora; dá pra dar zoom no mapa do SOS; posso ativar a bússola mesmo já no local.
- **Testes:** E2E dois clientes (stop sincroniza); unit do override da bússola; smoke do zoom.
- **Flip:** sem tempo → ship núcleo (E13 + aviso no Agora + zoom + bússola), adiar "estou indo".

### G7 — Ponto de encontro: lightbox (+ mural se houver folga) · → **v0.48.0**
- **Itens:** E19 (P1), E20 (P2). **DEC-102.**
- **Mudança:** lightbox tap-to-zoom na foto (`MeetDetailScreen`); **se houver folga**, mural por ponto (lista mensagens texto+foto, autor/hora, fan-out `GroupRoom`) reusando padrão de mensagens existente.
- **AC:** tocar a foto amplia; (mural) consigo postar e ver mensagens do ponto em tempo real.
- **Testes:** smoke do lightbox; (mural) E2E básico de postar/ver.

### G8 — Join + i18n/overflow + header · → **v0.49.0**
- **Itens:** E03, E24, E27, E26. **DEC-103/094/104.**
- **Mudança:** join com 3 affordances (link/QR/código) + **scan** de câmera + placeholder = só o código ("ou cole o link"); confirmar "Timetable" em PT e "Favs"; header reserva a largura do avatar e trunca o título antes de colidir.
- **AC:** entro por código, link ou escaneando QR; "Timetable" não vira "Horários"; botões do Line Up não estouram em PT; nome do festival nunca encosta no avatar.
- **Testes:** E2E join por código; revisão visual header/Line Up em PT.

### G9 — Notificações (locais) · → **v0.50.0**
- **Itens:** E25. **DEC-105.**
- **Mudança:** permissão pedida **no contexto** (ao favoritar/lockar 1º set ou em Settings); **lembrete de set** + **leave-by** (reusa distâncias/tempo de caminhada já calculados); agendamento via Service Worker + degradação in-app; quiet hours/agrupamento; trocar pill "em breve". Preparar (flag, sem prometer) o tier de Web Push server.
- **AC:** recebo lembrete "começa em N min" e "saia agora (X min)"; permissão pedida no momento certo; degrada in-app se negada.
- **Testes:** unit do agendador (quando disparar); smoke de permissão concedida/negada.

### G10 — (Opcional/P2) Zoom do mapa + estrutura squad · → **v0.51.0**
- **Itens:** E11, E21, E22, E23. **DEC-106.**
- **Mudança:** re-checar fidelidade/cap da base do mapa (re-open D01) e ajustar **só** se confirmado; affordance "adicionar ao plano" no `SquadPlanScreen` (cria group event — reuso); reorg leve da agenda; seletor de squad no Now (futuro multi-squad).
- **AC:** zoom sem perda perceptível (ou registrado como limite da fonte); consigo inserir um evento de grupo pela tela do plano; (se feito) troco de squad no Now.
- **Nota:** se não houver folga, registrar como **deferido** no dev-log.

---

## §11 — Segurança de terminal (WSL)

- **Sempre `git --no-pager …`** (`log`/`diff`/`show`/`status`). **Commit sempre com `-m`** (HEREDOC p/ multilinha). Nunca `less`/`more`/`man`/`vim`/`nano`/`-i`/`rebase -i`. CLIs incertas → `| cat`.
- **Bypass de commit (confirmado nesta máquina):** o harness injeta `--trailer`, rejeitado pelo git 2.25.1. Commitar por caminho que não expõe o literal `git commit`: `G=/usr/bin/git; "$G" commit -m "…"`.
- Comando travado >30s sem output: não re-rode; leia o arquivo do terminal, ache o pid, mate.

---

## §12 — Definição de Pronto (tudo TRUE)

- [ ] **Todos os P0/P1 (E01–E10, E12–E19, E24–E28 + E07/E08/E16) entregues.** P2 (E11/E20/E21/E22/E23) feitos ou registrados como deferidos.
- [ ] **N1–N7 honrados:** sem barra preta iOS; sem texto preto; sem mapa preto; squad honesto; squad vivo; portrait-only; **barras de sistema profissionais (iOS + Android)**.
- [ ] **Invariância:** vencedores da agregação idênticos ao baseline; teste pin do `mergeSquadTimeline` verde.
- [ ] Suíte **verde** (além das falhas baseline documentadas); `build` + `tsc --noEmit` OK.
- [ ] **Deploy por gate** feito; `/version.json` reflete a versão do gate.
- [ ] **Brain sincronizado:** dev-log a cada milestone; DECs `APPROVED`; `product-spec`/`project-status` atualizados; README aponta este doc.
- [ ] Smoke 3-plataformas (§15) das jornadas-chave passou.

---

## §13 — Anti-padrões (NÃO faça)

- ❌ Mudar a **matemática** da agregação para "explicar"/"atualizar" (invariância). Esta leva expõe/atualiza, não recalcula o vencedor.
- ❌ Vazar coordenada precisa fora do **escopo-squad** ou sem **TTL** (C2).
- ❌ Ligar **preciso** por padrão (só coarse é default — C3).
- ❌ Redesenhar a UI do SOS **sem** antes corrigir o fan-out do "stop" (C4/E13).
- ❌ Prometer **Web Push server** no iOS sem entregar; local primeiro (C5).
- ❌ Mapa com **fundo preto** como estado aceitável; sempre fallback de cor.
- ❌ String de UI hardcoded; código não-inglês; deletar ação/feature.
- ❌ Re-rodar/re-startar um gate que o dev-log mostra concluído.
- ❌ Editar arquivo do §6 sem reler antes.

---

## §14 — Brain sync

- `web/src/dev-log.md` — **todo milestone** (Current State + entrada); leva 2 no topo, leva 1 preservada abaixo.
- `brain/decision-log.md` — DEC-089…107 `PROPOSED` no G0 → `APPROVED` pelo gate que entrega.
- `brain/product-spec.md` — registrar regras novas quando o gate fecha: squad vivo (revisão/histórico/notify), presença precisa escopo-squad+TTL, default coarse-visível no join, notificações locais, portrait-only.
- `brain/project-status.md` — status/pendências/próximos no fim da leva.
- `brain/README.md` — apontar para este orchestrator enquanto `ACTIVE`.

---

## §15 — Matriz de smoke manual (jornadas-chave)

| Jornada | iOS (PWA standalone) | Android (PWA) | Desktop/Web |
|---|---|---|---|
| Instalar/abrir — sem barra preta, sem espremido, portrait-only | ✅ obrigatório | ✅ | n/a (resize) |
| Barras de sistema (status/notificações + navegação) na cor do chrome | ✅ status-bar | ✅ **obrigatório** (status + navegação) | n/a |
| Entrar no squad (código/link/QR/scan) + pedido de localização | ✅ | ✅ | ✅ |
| Home/Now mostra o **Próximo real** do squad | ✅ | ✅ | ✅ |
| Mudar plano pessoal → squad atualiza + histórico + aviso | ✅ (2 devices) | ✅ | ✅ |
| Tocar bloco → "Por que isto?" explica com nomes | ✅ | ✅ | ✅ |
| Compartilhar preciso → outro vê ponto exato + navegar | ✅ (2 devices) | ✅ | ✅ |
| SOS → parar sincroniza nos dois; zoom no mapa; aviso no Agora | ✅ (2 devices) | ✅ | ✅ |
| Ponto de encontro: foto amplia (lightbox) | ✅ | ✅ | ✅ |
| Mapas internos (rota/meeting/SOS) sem fundo preto | ✅ | ✅ | ✅ |
| Notificação de set + leave-by dispara | ✅ | ✅ | ✅ |

---

## §16 — Decisões para o usuário (lock — não-bloqueante)

> O doc está **ACTIVE**: na ausência de lock, a execução adota a **recomendação** de cada conselho. Estas três são sensíveis (privacidade/escopo) — confirme antes de G4/G5/G9 se quiser ajustar:

1. **Presença precisa (C2/DEC-099):** expor coordenada exata **ao squad** quando o usuário liga "preciso" (+ TTL/opt-out). *Rec:* sim, DTO separado escopo-squad+TTL. **Lock?**
2. **Default de presença (C3/DEC-097):** **coarse-visível por padrão** ao entrar no squad (após consentir no join), preciso sempre opt-in. *Rec:* sim. **Lock?**
3. **Notificações (C5/DEC-105):** **locais primeiro**, push server documentado/preparado (não prometido). *Rec:* sim. **Lock?**

Os demais DECs (089–096, 098, 100–104, 106) são diretivas claras do Julio ou de baixo risco → adotados.

---

## §17 — GO — comece aqui

**G0 (rode primeiro):**
```bash
cd FestPilot/web && npm install
npm run test    # registre contagem + falhas baseline
npm run build && npx tsc --noEmit
cd ../server && npm install && npm run test   # se houver
```
Depois: semeie `web/src/dev-log.md` (Current State + tabela da leva 2 no topo), adicione DEC-089…107 `PROPOSED` no `decision-log.md`, confirme o pipeline (`festpilot.pages.dev` + `/version.json`).

**Loop de execução:** para cada gate G1→G10 — releia o arquivo do §6 do item → domínio + testes → UI + E2E → auto-check 5 pontos → commit por item → no fim do gate: suíte + build + tsc + smoke → bump de versão → **deploy** → DECs `APPROVED` → dev-log → imprima ÂNCORA + CURRENT STATE → refresh. **Não pare** até a Definição de Pronto (§12) toda TRUE (ou contexto acabando → feche o gate atual limpo + hand-off no dev-log).
