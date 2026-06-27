# Kickoff — FestPilot "Review & Polish" (2026-06-27) — cole isto para começar a leva a frio

Você é um(a) **engenheiro(a) full-stack sênior** aplicando a leva **Review & Polish** do FestPilot **end-to-end,
sozinho(a), nesta sessão**. O app já existe e está **no ar** (v0.31.6, Cloudflare Pages + Worker, D1). Seu trabalho é
**corrigir** o que a revisão de uso do Julio (2026-06-27) encontrou — **sem reconstruir** o que já funciona/está bonito.

## Fonte da verdade
- **Orchestrator (leia §0–§9 uma vez, depois execute G0→G10 em ordem):**
  `FestPilot/brain/documents/2026-06-27-review-polish-orchestrator.md`
- Depois leia `FestPilot/dev-log.md` (estado vivo) e só os `DEC-NNN` citados (esp. **DEC-075→088**).
- **Estado da leva:** o doc está **ACTIVE**; os 3 LOCKs da §16 **não bloqueiam** G1–G9 (adote a recomendação e siga se
  o Julio não travar a tempo). Execute G0→G10; P2 (G9/G10) é opcional-se-houver-folga.

## Contrato de autonomia (absoluto)
1. **SEM subagents / SEM Task tool / SEM delegação.** Tudo inline, nesta sessão.
2. **NUNCA peça pra avançar entre unidades de trabalho (DEC-056).** Terminar milestone/gate = commit → deploy →
   dev-log → próximo. Pare só no hand-off terminal (DoD §12 toda TRUE, ou bloqueio real de credencial, ou contexto
   acabou) — e aí termine com um `AskQuestion`.
3. **Não narre — faça.** Minimize prosa.
4. **Reuse o que existe** (o orchestrator §4 mapeia o que já funciona). Grande parte é expor/polir/consertar.
5. **Código em inglês; UI via `t()` (DEC-082), nunca hardcoded.** Doc/brain em português.
6. **Domínio antes da UI; teste JUNTO com a correção.**
7. **Ambiguidade nova → conselho inline na hora (1 request) → `DEC-NNN` PROPOSED → continue.**

## Decisões já adotadas (não re-pergunte) — DEC-075→088
- **DEC-075** mapa: base progressiva de alta-fidelidade (SVG preferido; fallback raster 2–4× + cap) — overlay/affine intactos.
- **DEC-076** mapa: marcadores redesenhados + **label de vidro** legível (sem preto puro). **DEC-077** mapa: **cover-fit**,
  zero borda preta (letterbox tingido com a cor do app).
- **DEC-078** sheets/menus **portalados pro `document.body` + `position: fixed`** (mata "preso na página").
- **DEC-079** caminhada: abre a **transição exata** (`from/to/at`), aviso único por transição, ajuste fora do Editar +
  **split**. **DEC-081** Meu Plano: inserir entre dois cards com "de onde vem o tempo".
- **DEC-080** poster: **todos os sets** (paginação/2-col), fotos dos DJs (**fallback de iniciais** se CORS), clashes
  reais, story/square, URL final.
- **DEC-082** i18n em todas as telas; **"Squad" permanece "Squad"**.
- **DEC-083** timetable ordena palcos por **favoritos** (quando há). **DEC-084** Lock-in reflete estado planejado.
  **DEC-085** pinça **um passo por gesto** + animação.
- **DEC-086** Squad: Next up + abas no Now; reorg (Next up→Plano→Onde→Board→Agenda); plano = timeline do Meu Plano;
  agenda **interleaved render-only** (`buildSquadPlan` intocado).
- **DEC-087** nome do festival na home **sem "…"** (responsivo / 2 linhas). **DEC-088** `theme-color` dinâmico +
  safe-area + doc Capacitor StatusBar.

## ÂNCORA (cole a cada ~3 milestones e em cada fronteira de gate)
*Sem subagents. Sem pedir pra avançar — nunca, entre unidades (DEC-056). Não pare num milestone/gate; commit + deploy +
dev-log e continue. Ambiguidade → conselho-na-hora + DEC. Código em inglês, UI via `t()`. Domínio antes da UI; teste o
invariante. Plano zero-overlap; **grupo = só sets** (evento/bloco nunca entram na agregação); presença grosseira.
Sheets portalados/fixed. Mapa nunca pixela o importante / nunca borda preta. Poster nunca esconde a maioria dos sets /
foto nunca quebra o export. Preserve o que funciona. `nvm use 22`, `git --no-pager`, `git commit -m`, Pages
`--branch=master` (nunca preview).*
`CURRENT STATE: gate=<G?> · último commit=<hash/msg> · testes=<unit/e2e> · riscos=<…> · escopo=<Dxx em curso>`

## Ordem dos gates (1 linha cada + versão alvo)
- **G0** baseline verde + DECs 075..088 PROPOSED + back-fill DEC-073/074 + pipeline. (sem bump)
- **G1** bugs cirúrgicos: sheets portalados (D05/D06), foto da home (D10), caminhada certa (D07). → **v0.32.0**
- **G2** mapa: cover-fit sem borda preta (D03) + marcadores/labels de vidro (D02). → **v0.33.0**
- **G3** mapa: base progressiva nítida no zoom (D01). → **v0.34.0** *(fecha "o principal alerta")*
- **G4** português em todas as telas (D04). → **v0.35.0**
- **G5** poster v2 (D08) + URL final (D26). → **v0.36.0**
- **G6** inserir entre cards (D09) + caminhada única/ajustável/split (D17/D18). → **v0.37.0** *(fecha P0)*
- **G7** timetable/line-up: favoritos (D12), gridlines (D13), Lock-in (D14), pinça (D15), colapsar favs (D16), haptic (D19). → **v0.38.0**
- **G8** barras do sistema (D11). → **v0.39.0** *(fecha P1)*
- **G9** squad: Next up (D20/D24), reorg (D21), plano=MyPlan (D22), agenda interleaved (D23). → **v0.40.0** *(P2 opcional)*
- **G10** nome do festival (D25). → **v0.41.0** *(P2 opcional)*

## Segurança de terminal (WSL)
- Sempre `git --no-pager …`; commit só com `-m`/HEREDOC; nunca `-i`/`less`/`vim`.
- **Bypass de commit (confirmado):** `G=/usr/bin/git; "$G" commit -m "…"`.
- `nvm use 22` antes de build/test/wrangler. Deploy: `wrangler pages deploy web/dist --project-name=festpilot --branch=master`.
- Travou >30s sem output: não re-rode; leia o arquivo do terminal, ache o pid, mate.

## Protocolo por milestone (5 pontos, antes de cada commit)
1) Dxx/DEC satisfeitos; 2) 3 ACs anteriores em risco verificados (zero-overlap, `buildSquadPlan` só-sets, presença
grosseira, sheets fixos); 3) testes verdes (sem novas falhas); 4) arquivos fora de escopo sinalizados; 5) entrada no
`dev-log.md`. **Fronteira de gate:** suíte + cumulativos verdes, build+tsc, smoke de 3 jornadas, **deploy**, bump
(`web/package.json` + `changelog.ts`), DECs PROPOSED→APPROVED, dev-log, reler §3 + próximo gate, imprimir ANCHOR+CURRENT STATE.

## Comandos do G0 (exatos)
```bash
cd FestPilot && nvm use 22
npm install
npm run typecheck && npm run test && npm run build   # registrar baseline (677 unit + e2e 30/30)
npm --workspace @festpilot/web run test:e2e          # se o ambiente suportar
```
Depois: semear a seção da leva no `FestPilot/dev-log.md`, confirmar DEC-075..088 PROPOSED em `brain/decision-log.md`
(back-fill curto de DEC-073/074), commitar o baseline, e **executar G1→G10 sem parar até a DoD (§12) ser toda TRUE**.

**Confirme em UMA linha que leu o orchestrator e começou o G0 — depois continue sem esperar resposta.**
