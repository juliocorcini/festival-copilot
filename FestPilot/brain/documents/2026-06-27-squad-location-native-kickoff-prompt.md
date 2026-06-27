# Kickoff — FestPilot Leva 2: Squad Vivo, Localização & Polimento Nativo

> Cole isto num agente novo para **executar** a leva sem reler tudo. Idioma de UI via `t()` (PT/EN); código em inglês.

## Papel + missão
Você é um engenheiro full-stack sênior aplicando, **sozinho e nesta sessão**, a leva 2 do FestPilot (segunda rodada de review de uso do Julio, no iPhone, dentro de um squad), **de ponta a ponta**: design → código → testes → commit → **deploy**, gate a gate. O app está vivo em `https://festpilot.pages.dev` (v0.41.0).

## Fonte da verdade
`FestPilot/brain/documents/2026-06-27-squad-location-native-orchestrator.md`. **Leia §0–§9 uma vez**, depois execute **G0→G10 em ordem**. Releia o arquivo do §6 do item **antes de editar** (símbolos se movem).

## Estado da leva
O doc está **ACTIVE**. O §16 tem 3 locks **não-bloqueantes** (presença precisa, default coarse-visível, notificações locais) — na ausência de resposta, **adote a recomendação** do conselho e siga. Execute G1→G10; G10 é opcional (P2).

## Contrato de autonomia (9 regras, condensado)
1. **Sem subagentes / sem Task tool / sem delegação.** Tudo inline, mesma sessão. 2. **Não peça permissão** para avançar entre work units depois do lock; fechar milestone/gate = commit → deploy → dev-log → próximo. 3. **Não narre — faça.** 4. **Reuse o que existe** (a maior parte já existe — veja §4). 5. **Código em inglês; UI via `t()`**; doc/brain em PT. 6. **Domínio antes da UI**, uma mudança por vez, **teste junto**. 7. **Segurança WSL** (§11). 8. **Brain em sync** (§14). 9. O **hand-off final** termina com `AskQuestion` — só num stop genuíno.
Nova ambiguidade não resolvida pelo brain/doc → **conselho inline na hora** (1 request) → `DEC-NNN (PROPOSED)` → siga.

## Decisões já adotadas (não re-perguntar)
- iOS: safe-areas corretas (sem barra preta) + **portrait-only** (DEC-089). **Barras de sistema profissionais (iOS + Android)**: status/notificações + navegação seguem o chrome da paleta (DEC-107, refina DEC-088; controle total da nav-bar = TWA/Capacitor, não agora).
- Base de mapa **unificada** com fallback de cor (nunca preto) (DEC-090); **sem texto preto** (DEC-091).
- "Próximo" do squad **lê o plano agregado** (DEC-092); CTA reflete existência (DEC-093).
- i18n das sub-telas; **"Timetable" fica "Timetable" em PT**; **"Favoritos"→"Favs"** (DEC-094).
- **Squad vivo:** re-share automático debounced + **histórico** + **notificação** (server é dono: revisão por membro + changelog coalescido + fan-out) (DEC-095).
- **Transparência:** sheet "Por que isto?" por bloco + glossário, com nomes (DEC-096) — **sem mudar a matemática**.
- **Presença precisa:** `PrecisePresenceDto` **escopo-squad + TTL**, só p/ precise+live; plota ponto exato (DEC-099).
- **Default presença:** coarse-visível ao entrar no squad (consentido no join), preciso opt-in (DEC-097); group-by-stage na tela cheia (DEC-098).
- **SOS:** corrigir fan-out do stop **primeiro**, depois consciência mútua + zoom + aviso no Agora (DEC-100); **bússola** ativável mesmo "chegado" (DEC-101).
- **Ponto de encontro:** lightbox de foto (P1) + mural se houver folga (P2) (DEC-102).
- **Join:** link/QR/scan/código + placeholder claro (DEC-103); **header** nunca deixa o nome sob o avatar (DEC-104).
- **Notificações:** locais on-device primeiro (set + leave-by), push server preparado/não-prometido (DEC-105).
- P2: re-check zoom + estrutura squad (DEC-106).

## ÂNCORA (não-negociáveis — cole a cada 3 milestones e em cada fronteira de gate)
```
ÂNCORA — FestPilot Leva 2
- Domínio puro/testável; UI só orquestra. i18n SEMPRE (t()); código em inglês.
- INVARIÂNCIA: buildSquadPlan/agregação NÃO muda. Explicar/atualizar ≠ recalcular. Vencedores == baseline. Pin do mergeSquadTimeline verde.
- N1 sem barra preta iOS · N2 sem texto preto · N3 sem mapa preto (fallback de cor) · N4 squad honesto · N5 squad vivo (re-share+histórico+notify) · N6 portrait-only · N7 barras de sistema profissionais (iOS + Android).
- Privacidade: precise = escopo-squad + TTL + opt-out; coarse default só após consentir no join.
- Hide-never-delete. Sem string hardcoded. git --no-pager; commit via G=/usr/bin/git.
CURRENT STATE: gate=<G?> · último commit=<hash> · testes=<n pass/baseline> · riscos=<...> · escopo=<itens do gate>
```

## Ordem dos gates (1 linha cada + versão alvo)
- **G0** baseline + dev-log + DECs PROPOSED + pipeline.
- **G1 → v0.42.0** feel nativo: iOS chrome + portrait + **barras de sistema Android** (E01/E02/E28).
- **G2 → v0.43.0** base de mapa unificada + sem texto preto (E17/E18).
- **G3 → v0.44.0** squad honesto: Próximo real + CTA + i18n + transparência (E04/E05/E06/E08).
- **G4 → v0.45.0** squad vivo: re-share + histórico + notificação (E07).
- **G5 → v0.46.0** localização: ponto preciso + default coarse + group-by-stage (E16/E09/E10).
- **G6 → v0.47.0** SOS (stop sincroniza primeiro) + bússola (E13/E12/E14/E15).
- **G7 → v0.48.0** ponto de encontro: lightbox (+ mural se folga) (E19/E20).
- **G8 → v0.49.0** join QR/scan/código + i18n/overflow + header (E03/E24/E27/E26).
- **G9 → v0.50.0** notificações locais (E25).
- **G10 → v0.51.0** (opcional/P2) zoom do mapa + estrutura squad (E11/E21/E22/E23).

## Segurança de terminal (WSL)
`git --no-pager …` sempre; commit sempre `-m` (HEREDOC p/ multilinha). Bypass: `G=/usr/bin/git; "$G" commit -m "…"`. Nunca pager/editor/`-i`. Travou >30s → ache o pid no arquivo do terminal e mate.

## Protocolo por milestone
Antes de cada commit (5 pontos): (1) ACs satisfeitos; (2) 3 ACs anteriores em risco verificados (sobretudo invariância); (3) testes sem novas falhas; (4) arquivos fora de escopo sinalizados; (5) dev-log atualizado. A cada 3 milestones: refresh leve. Em cada fronteira de gate: releia §3 + escopo do próximo gate + Current State; imprima ÂNCORA + CURRENT STATE.

## Deploy (FestPilot, confirmar no G0)
Bump `web/package.json` + `web/src/data/changelog.ts` (`APP_VERSION` + entrada no `CHANGELOG`, pt/en) → `G=/usr/bin/git; "$G" commit -m "…"` + push → Cloudflare Pages auto-build → verificar `https://festpilot.pages.dev/version.json`. Worker do server só precisa de deploy se rotas mudarem (G4/G5 mudam → deploy do server quando tocar rotas/DTO).

## G0 — comandos
```bash
cd FestPilot/web && npm install && npm run test && npm run build && npx tsc --noEmit
cd ../server && npm install && npm run test
```
Depois semeie o dev-log (leva 2 no topo), DEC-089…107 `PROPOSED`, confirme o pipeline. Então **execute G1→G10, sem parar até a Definição de Pronto (§12) toda TRUE**.

**Confirme em UMA linha que leu o orchestrator e iniciou o G0 — e continue sem esperar resposta.**
