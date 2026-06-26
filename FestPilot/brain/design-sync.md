# Design-Sync — Aplicação dos Wireframes no App Real

> **Orquestrador vivo de deltas.** Porta os wireframes aprovados para o app real mexendo **só no que mudou**.
> Não é um redesign — é um *diff de skin*: wireframes e app já compartilham as mesmas classes.
> **É feito pra crescer:** cada novo lote de mudança vira um **GATE** novo (com change sets `XX-n`) no mesmo
> formato — ver **"Como estender"** no fim. O loop, os invariantes e o registro de status valem pra todos.
>
> **Última atualização:** 2026-06-25 — adicionado o **lote de feedback de campo (teste real do Julio)**: gates
> **OBV** (onboarding no Safari/iPhone — nome do artista sempre visível), **IMG** (fotos de artista — buffer de
> pré-carga + cache + fim da "foto do DJ anterior com o nome novo") e **ART** (Artist Detail Sheet ao tocar em
> qualquer artista + captura dos socials da fonte). Decisões a registrar: **DEC-067 (IMG)**, **DEC-068 (OBV)**,
> **DEC-069 (ART)**, **DEC-070 (enriquecimento de gênero/bio — pendente)**. Antes disso entraram os gates
> **SH / DAY / ICON** (shell unificado, dropdown de dia, ícone do Lock in) do **DEC-066**; **TT / LU** (skin N6/L5)
> já existiam.
>
> **Nota de pipeline (lote 25/06):** os gates IMG/OBV são de **comportamento + CSS** (corrigem bugs vistos no
> teste), e o ART é **feature nova que toca o servidor** (ingestão → DTO). Não são "diff de skin" puro como
> TT/LU/SH, mas seguem o mesmo formato de change set e o mesmo loop/fecho de gate — o orquestrador "é feito pra
> crescer".

**Fontes (spec — a verdade visual):**
- Timetable (card) → `brain/wireframes/timetable-design-v2/06-capsule-color-gradient.html` (N6)
- Lineup (grid) → `brain/wireframes/lineup-design/05-photo-immersive.html` (L5)
- Shell unificado + dia em dropdown → `brain/wireframes/unified-shell-v2/V9-final-shell.html` (**canônico**, interativo);
  apoio: `V7-unified-twin`, `V8-day-dropdown`. Galeria: `unified-shell-v2/index.html`.
- Decisão de produto: **DEC-066** (encadeada na DEC-032/049; ícone não mexe na DEC-005).

**Índice de gates** (ordem de aplicação sugerida — menor risco/dependência primeiro):

| Gate | Tema | Fonte | Risco | Depende de |
|---|---|---|---|---|
| **ICON** | Lock in: `lock` → `playlist_add_check` | DEC-066 | trivial | — |
| **TT** | Timetable card → cápsula color-glass (N6) | N6 | baixo | — |
| **LU** | Lineup lista → grid imersivo (L5) | L5 | médio | — |
| **DAY** | Seletor de dia → dropdown | V8/V9 | médio | — |
| **SH** | Shell unificado (switch embaixo + header espelhado) | V7/V9 | médio | DAY, ICON (visual) |
| **OBV** | Onboarding (Safari/iPhone): nome do artista sempre visível, sem perder o toggle Swipe/Grid | feedback 25/06 | baixo (CSS) | — |
| **IMG** | Fotos de artista: buffer de pré-carga (≥5) + cache persistente + fim da "foto errada" | feedback 25/06 | médio | — |
| **ART** | Artist Detail Sheet (tocar em qualquer artista → onde/quando toca + socials) | feedback 25/06 + TML HAR | médio-alto | toca servidor (ingest→DTO); usa ART-1..4 antes da UI |

> **Ordem sugerida do lote 25/06 (impacto × risco):** **IMG-1** primeiro (1 arquivo, mata o bug mais feio do
> teste), depois **OBV** (CSS puro), depois o resto de **IMG** (buffer/cache/offline), por fim **ART**
> (servidor → UI). IMG e OBV são independentes; ART depende do seu próprio sub-pipeline (ART-1..4) antes da UI.

---

## Como usar — o loop (o "orchestrator")

Para **cada** change set, sempre nesta ordem:

1. **Baseline verde** — `tsc --noEmit` + `npm run test` antes de tocar em nada.
2. **Aplicar 1 change set** (e só ele).
3. **Verificar:** `tsc --noEmit` → `npm run test` (o domínio **tem** que continuar verde) → `npm run build`.
4. **Verificação visual:** screenshot Playwright da tela real vs o wireframe-fonte.
5. **Scope-creep check:** `git diff --stat` bate **exatamente** com os arquivos do change set.
6. **Registrar** o status na tabela e seguir para o próximo.

Gates fecham com: testes 0 falhas + build ok + golden path (abrir Timetable, favoritar um set, abrir Lineup).

---

## INVARIANTES — NÃO TOCAR

Estes itens **provam** que não saímos do escopo. Se um deles mudar, é scope creep.

- **`domain/timetable.ts`** e toda a math de layout (`leftPct`, `widthPct`, janelas, snap de hora). **0 mudança.**
- **`.set-inner { position: sticky; left: 0 }`** (`styles.css`) — o movimento foto+texto fixo à esquerda. Já funciona.
- **`ArtistPhoto` + `lib/photo.ts`** — foto via CDN com fallback de iniciais. Reusar, não reescrever.
- **Store de favoritos**, filtros (favoritos/dia), navegação, `LineupUpdateBanner`.
- **`time-row`, `tt-grid`, `now-line`** e seus cálculos de posição.
- **`ViewSwitch`** — o **comportamento** (rotas `/timetable` ⇄ `/lineup`, `active`, a11y `role=tablist`) **não muda**;
  o gate SH só muda **onde** ele é renderizado e o CSS de posição. Nada de reescrever a lógica de navegação.
- **Estado do dia** no `TimetableScreen` (`selectedDay`/`setSelectedDay`, `days`, `dayKey`) e o estado do Lineup
  (`query`, `dayFilter`, `favOnly`) — reusados como estão; os gates DAY/SH só trocam a **apresentação**.
- **`daysForWeekends`, `buildTimetable`, `uniqueActs`** e toda a `domain/**` — **0 mudança**.
- **Testes de domínio** (`src/tests/**` de `timetable`, `lineup`) permanecem 100% verdes o tempo todo.

**Limites do lote 25/06 (IMG / OBV / ART)** — o que continua intocável mesmo nestes gates de comportamento/feature:
- **Math de domínio** (timetable/lineup: `leftPct`, janelas, `actKey`, `uniqueActs`, `imageByActKey`) — **0 mudança**.
  ART **só adiciona** (campo `socials` + um helper puro novo); não reescreve nada de identidade/dedup de acts.
- **`ArtistPhoto`**: o gate IMG **corrige o reuso** do elemento (race de imagem), **sem mudar a API pública**
  `{ src, name, width, className }` nem o fallback de iniciais — todas as telas que o usam continuam iguais.
- **`lib/photo.ts` (`artistPhotoSrc` + `PHOTO_WIDTH`)**: reusar como está (já encoda URLs com espaço/`©` e aplica `?width=`).
- **Favoritar é sempre um alvo de clique separado**: abrir o Artist Sheet **nunca** pode favoritar por engano
  (no Timetable o `.heart` já tem a barreira `padding-right:44px` — preservar; no Lineup o coração fica fora da área que abre o sheet).
- **Migração D1 do ART é aditiva** (nova coluna `socials`), sem quebrar leituras/escritas existentes; ingestão idempotente.
- **Domínio do swipe** (`domain/swipe.ts`: thresholds, `cardDragStyle`) — OBV mexe **só em CSS**; o gesto não muda.

---

## GATE TT — Timetable → N6 · risco BAIXO (≈90% CSS)

Estrutura HTML/JSX **não muda** (`.tt-screen` › `.tt-content` › `.stage` › `.track` › `.set` › `.set-inner` + `.heart`).

### TT-1 — `.set` vira cápsula color-glass
- **Arquivo:** `web/src/styles.css` (`.tt-content .set`)
- **Delta:** retângulo dark-glass → cápsula tintada na cor do palco. Mantém `padding-right:44px` (a barreira do coração **já existe**).
- **Alvo (N6):**
```css
.tt-content .set { position: absolute; top: 2px; bottom: 2px; border-radius: 999px; cursor: pointer; padding-right: 44px;
  background: linear-gradient(155deg, rgba(var(--c), .46), rgba(var(--c), .14) 60%, rgba(12, 10, 7, .6)), rgba(14, 11, 8, .5);
  border: 1px solid rgba(var(--c), .5);
  backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); box-shadow: 0 9px 20px -12px rgba(0, 0, 0, .78); }
```
- **AC:** card em formato pílula, fundo na cor do palco; `--c` já é injetado via `cardStyle`. **Não** adicionar `overflow:hidden` (quebraria o sticky).
- **Verificar:** screenshot vs N6; confirmar que foto+texto continuam grudados à esquerda ao rolar.

### TT-2 — `.photo` 36px quadrado → 56px círculo na cor
- **Arquivo:** `web/src/styles.css` (`.tt-content .photo`)
- **Alvo (N6):** `width:56px; height:56px; border-radius:50%;` fundo `linear-gradient(150deg, rgb(var(--c)), #0c0a07 96%)` + gloss.
- **Atenção:** o gloss `::after` só renderiza no fallback de iniciais (`<span>`), não em `<img>` (replaced element) — ok, foto não precisa de gloss. Cabe na `.track` de 64px (56 + 2+2).
- **AC:** com foto → círculo coberto; sem foto → iniciais sobre o gradiente da cor.

### TT-3 — estado **LIVE** (anel branco em degradê)
- **Arquivos:** `web/src/routes/TimetableScreen.tsx` (render) + `web/src/styles.css`
- **Render:** `now` já existe no componente. Computar por set e adicionar a classe:
```ts
const isLive = now >= set.startMs && now < set.endMs;
// className={`set${set.isFav ? " fav" : ""}${isLive ? " live" : ""}`}
```
- **Alvo (N6):**
```css
.tt-content .set.live { border-color: rgba(255, 255, 255, .16); }
.tt-content .set.live::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: .8px; z-index: 5; pointer-events: none;
  background: linear-gradient(95deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 34%, rgba(255,255,255,.5) 66%, rgba(255,255,255,.98) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
```
- **AC:** anel branco fino, invisível perto da foto, brilhando perto do coração. **Sem** mudança de domínio.

### TT-4 — contagem de favoritos por palco (★ N)
- **Arquivos:** `web/src/routes/TimetableScreen.tsx` (render) + `web/src/styles.css`
- **Render:** `const favCount = stage.sets.filter((s) => s.isFav).length;` → `{favCount > 0 && <span className="ct">★ {favCount}</span>}` dentro de `.stage-name`.
- **Alvo (N6):** `.tt-content .stage-name .ct { display:inline-flex; align-items:center; gap:2px; font-size:9.5px; font-weight:800; color:var(--accent); }`
- **AC:** estrela + contagem aparecem só quando há favoritos. `model.stages[].sets[].isFav` já existe → **sem mudança de domínio**.

### TT-5 — margem do 1º card sem deslocar a grade
- **Arquivo:** `web/src/routes/TimetableScreen.tsx`
- **Delta:** `const EDGE = 9;` — no `.map((set, index) => …)`, para `index === 0`:
```ts
left:  index === 0 ? `${EDGE}px` : `${set.leftPct}%`,
width: index === 0 ? `calc(${set.widthPct}% - ${EDGE}px - 3px)` : `calc(${set.widthPct}% - 3px)`,
```
- **AC (crítico — alerta do Julio):** o 1º card desgruda da borda esquerda **sem** mover os horários. `time-row`/`grid`/`now-line` usam `leftPct` do model → ficam parados. Confirmar no screenshot que os marcadores de hora não se moveram.

### TT-6 — ajuste fino de `.heart` e `.set.fav`
- **Arquivo:** `web/src/styles.css`
- **Delta:** `.heart` cor `var(--accent)` → branco (`rgba`); `.set.fav` já é gold — casar borda/foto com N6 (sem borda dourada dupla).
- **AC:** favorito = preenchimento dourado, **sem** anel dourado extra; heart legível sobre a cápsula colorida.

---

## GATE LU — Lineup → L5 · risco MÉDIO (tela isolada)

Chrome (header, switch, busca, filtros) **não muda**. Muda o corpo: lista → grid.

### LU-1 — lista → grid de cards imersivos
- **Arquivos:** `web/src/routes/LineupScreen.tsx` (render) + `web/src/styles.css`
- **Delta:** `renderRow` (`.art-row`) → `renderCard` (`.gc`); cada `.sec` é seguido de `<div className="grid">`. Cor do palco via `stageColorRgb(stage)` em `--c`.
- **Reuso:** `ArtistPhoto` com `className="gc-photo"`:
  - `<img class="artphoto gc-photo">` → `position:absolute; inset:0; width/height:100%; object-fit:cover`.
  - fallback `.artphoto-ph` → `background:transparent` (herda o gradiente do `.gc`) + iniciais grandes centradas.
- **Alvo (L5):** `.gc` (aspect-ratio 3/4, radius 18px), `.gc-scrim` (gradiente da cor no rodapé), `.gc-name`, `.gc-chip` (palco · dia), `.gc-heart`, `.gc.on`.
- **AC:** grid 2 colunas idêntico ao L5; com foto preenche, sem foto mostra cor + iniciais; favoritar fica dourado.

### LU-2 — densidade 2/3/4 col + controle (decisão do council)
- **Arquivos:** `web/src/routes/LineupScreen.tsx` (estado + render) + `web/src/styles.css`
- **Estado:** `const [cols, setCols] = useState<2 | 3 | 4>(2)` — **persistir** a preferência (padrão localStore, DEC-041).
- **Controle (council):** segmented de densidade **fora** dos filtros, ancorado à direita do **primeiro `.sec` visível**. Ícones de grade (`grid_view` / `view_module` / `view_comfy`) — **não** lupa (colide com o ícone de busca). Renderizar **uma vez**.
- **Alvo (L5):** classes `.cols-2|3|4 .grid` + escalas de `.gc-init/.gc-name/.gc-chip/.gc-scrim/.gc-heart`; `.density` segmented no `.sec` (que vira `display:flex; justify-content:space-between`).
- **AC:** filtros nunca cortados; segmented reflete o estado; em 3/4 col as iniciais não colidem com o nome (já resolvido no wireframe via `padding-bottom`).

---

## GATE ICON — Lock in: `lock` → `playlist_add_check` · risco TRIVIAL (DEC-066)

### ICON-1 — trocar o glifo do Lock in
- **Arquivo:** `web/src/routes/TimetableScreen.tsx` (botão `.tt-lockin`, ~linha 128).
- **Delta (uma linha):** `lock` → `playlist_add_check`. O rótulo "Lock in" **permanece** (DEC-005); a rota `/lockin` **não muda**.
```tsx
<span className="ms" style={{ fontSize: 15 }}>playlist_add_check</span>
```
- **AC:** Lock in mostra o ícone de "lista confirmada", texto intacto, nenhuma outra mudança.
- **Verificar:** screenshot do header; `tsc`/test/build verdes.

---

## GATE DAY — Seletor de dia → dropdown · risco MÉDIO (V8/V9, DEC-066)

Substitui as pills `.tt-days` por um dropdown. Estado do dia (`selectedDay`/`dayKey`/`days`) é **reusado** — só muda a apresentação.

### DAY-1 — componente `DayDropdown`
- **Arquivo:** novo `web/src/ui/DayDropdown.tsx`.
- **Conteúdo:** gatilho compacto (`📅 {weekdayShort} {dia} ▾`) + painel com uma linha por dia (`Dia N` · dia-da-semana em negrito · data por extenso · `★ count` · check no selecionado). Fecha ao escolher, no backdrop e no `Esc`.
- **Props:** `{ days: DayInfo[]; dayKey: string | null; tz: string; favByDay: Map<string, number>; onSelect: (key: string) => void }`.
- **Alvo (V8/V9):** portar as classes `.dsel`/`.dsel.open`, `.day-dd`/`.dd-opt`/`.dd-opt.on`, `.dd-fav`, `.dd-check`, `.dd-backdrop` para `styles.css` (padrão Amber Glass já existe).
- **Reuso:** `dayOfMonth` já existe no `TimetableScreen` → **mover para `lib/festival.ts`** (pura) e reusar; nada de duplicar.
- **AC:** abre/fecha; dia por extenso; muitos dias rolam **vertical** no painel (sem scroll horizontal). A11y: gatilho `aria-haspopup` + `aria-expanded`; opções `role="option"`.

### DAY-2 — favoritos por dia (helper puro + teste)
- **Arquivo:** `web/src/lib/festival.ts` (ou `domain/lineup.ts`) — helper **puro** `countFavoritesPerDay(performances, favoriteKeys, days) → Map<dayKey, number>`.
- **Teste (regra test-routing):** `src/tests/**` com números concretos — act favoritado que toca em 2 dias conta **1 em cada**; não-favorito conta **0**; dia sem favorito não aparece no mapa.
- **Wire:** no `TimetableScreen`, `const favByDay = useMemo(() => countFavoritesPerDay(lineup.performances, favorites.keys, days), [lineup, favorites.keys, days])`.
- **AC:** a ★ no dropdown reflete o nº real por dia e muda ao (des)favoritar.

### DAY-3 — header usa o dropdown (remove as pills)
- **Arquivo:** `web/src/routes/TimetableScreen.tsx` (`TimetableHeader`) + `styles.css`.
- **Delta:** remover o bloco `.tt-days` (pills `.tt-day`) e renderizar `<DayDropdown … />`; passar `favByDay` como nova prop do header. Remover CSS órfão `.tt-days`/`.tt-day` (hygiene).
- **AC:** sem rolagem lateral de dias; trocar de dia continua chamando `onSelectDay` → o `model` recalcula igual. **Sem** mudança de domínio.

---

## GATE SH — Shell unificado (switch embaixo + header espelhado) · risco MÉDIO (V7/V9, DEC-066)

Faz Timetable e Lineup parecerem **uma tela só**. Aplicar **depois** de DAY+ICON (o topo do Timetable já no formato final). `ViewSwitch` **comportamento intacto** — muda só onde renderiza + CSS.

### SH-1 — `ViewSwitch` vira dock flutuante (mesma posição nas duas telas)
- **Arquivos:** `web/src/routes/TimetableScreen.tsx`, `web/src/routes/LineupScreen.tsx`, `web/src/styles.css`.
- **Delta:** tirar `<ViewSwitch>` de dentro do header das duas telas (Timetable `.tt-top-row`; Lineup `.lineup-switch-row`) e renderizar num **dock fixo embaixo**, idêntico nas duas: `.view-switch-dock { position: fixed; bottom: calc(<bottom-nav> + var(--safe-bottom)); left/right; centralizado; z acima do conteúdo, abaixo da bottom-nav }`. O componente `ViewSwitch` **não muda**.
- **AC:** o switch fica **no mesmo lugar** em ambas as telas; alternar **não move** o botão (zero fricção); a bottom-nav (5 tabs) continua acessível. Só aparece quando `dataState === "timetable"` (igual hoje).
- **Verificar:** screenshot das duas telas; o centro do switch coincide pixel-a-pixel.

### SH-2 — header espelhado (sobrancelha + barra "primário + controles fixos")
- **Arquivos:** ambos os screens + `styles.css`.
- **Delta:** convergir a casca do topo para o esqueleto do V9: **sobrancelha** igual (`{festival.name}` + a view) nas duas, e a primeira barra no padrão **primário flexível + controles fixos** (Timetable: `DayDropdown` + zoom/grade/favoritos/Lock in; Lineup: busca + densidade/filtros). Hoje o Timetable tem `h1 "Timetable"` sem eyebrow e o Lineup tem eyebrow + `h1 "Lineup"` — alinhar os dois.
- **AC:** ao alternar, a sobrancelha troca a palavra **no mesmo lugar**; a primeira barra mantém forma/posição; nada de "duas telas diferentes".

### SH-3 — respiro pro dock flutuante
- **Arquivo:** `styles.css` (`.tt-scroll` e a área rolável do Lineup / `.screen`).
- **Delta:** `padding-bottom` suficiente pro conteúdo rolar **acima** do dock (espelha o V9; resolve o "switch cobrindo conteúdo").
- **AC:** o último set / a última linha de cards nunca fica escondido atrás do switch.

---

## GATE IMG — Fotos de artista: buffer + cache + fim da "foto errada" · risco MÉDIO (DEC-067, feedback 25/06)

> **Sintoma no teste (Julio):** durante o swipe do onboarding, ao avançar o card "voltava com um nome diferente
> mas a mesma foto do DJ anterior", e segundos depois a foto trocava. No fim do dia 3, "parou de aparecer foto"
> (zero do ponto X em diante). Quer um **buffer de ≥5 fotos engatilhadas** (baixa as próximas enquanto vê a atual),
> fotos **salvas** (offline) — ao menos as dos **favoritos** — e fim do "nome de um, foto de outro".

**Causa-raiz (confirmada no código):**
1. **Race de imagem (o bug "feio").** `ArtistPhoto` (`web/src/ui/ArtistPhoto.tsx`) renderiza um `<img>` **sem `key`**:
   ao trocar de card o React **reusa o mesmo elemento DOM** e o browser **mantém o bitmap antigo** até a nova
   imagem decodificar → "nome novo + foto antiga". Além disso, o estado `failed` (`useState`) **não reseta** quando
   `src` muda — uma vez que uma imagem falha, o card seguinte pode nascer já no fallback de iniciais.
2. **Sem pré-carga / buffer.** O onboarding monta a foto só quando o card aparece (`loading="lazy"`). Não há fila
   nem prefetch das próximas — daí a espera e o "flash" da foto anterior.
3. **Sem cache persistente.** `public/sw.js` usa `cacheFirst` para assets, mas as fotos do TML são **cross-origin**
   (`artist-lineup-cdn.tomorrowland.com`) e voltam como **resposta opaca** (`status 0`); o guard `if (res && res.ok)`
   é **falso** para opaco → **nada é cacheado**. Não há precache dos favoritos. Trocar de tela/relançar re-baixa tudo.
4. **"Zero foto" no fim do dia 3.** Esperado-em-parte: a fonte só tem imagem para **~76% (340/446)** dos artistas —
   os demais caem no fallback de iniciais. O resto provavelmente é **erro de rede sem retentativa** + blocos
   *placeholder* ("More to be announced"); falta robustez e um sinal de diagnóstico.

### IMG-1 — `ArtistPhoto` à prova de corrida (mata o bug visual)
- **Arquivo:** `web/src/ui/ArtistPhoto.tsx`.
- **Delta:** dar **identidade** ao `<img>` por `src` e **resetar** o estado a cada troca. Duas formas equivalentes —
  preferir (a): (a) `key={resolvedSrc}` no `<img>` para o React **substituir** o nó (sem carregar o bitmap antigo);
  (b) `useEffect(() => setFailed(false), [src])`. Enquanto a nova imagem **não** decodificou (`onLoad`), mostrar o
  **fallback de iniciais** (nunca o bitmap do artista anterior). API pública `{ src, name, width, className }` **não muda**.
- **Alvo (pseudo):**
```tsx
const resolved = src ? artistPhotoSrc(src, width) : null;
const [loaded, setLoaded] = useState(false);
useEffect(() => { setFailed(false); setLoaded(false); }, [resolved]);
if (!resolved || failed) return <span className={`${cls} artphoto-ph`}>{initialsOf(name)}</span>;
return (<>
  {!loaded && <span className={`${cls} artphoto-ph`} aria-hidden>{initialsOf(name)}</span>}
  <img key={resolved} className={cls} src={resolved} alt="" decoding="async" draggable={false}
       style={loaded ? undefined : { display: "none" }}
       onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
</>);
```
- **AC:** ao avançar o swipe rápido, **jamais** aparece a foto de um artista sob o nome de outro; sem foto → iniciais
  imediatas; com foto → ela só aparece quando carregada. **Sem** `loading="lazy"` no swipe (a foto da vez é prioritária).
- **Verificar:** swipe rápido em rede 3G lenta (DevTools throttling); screenshot; `tsc`/test/build verdes.

### IMG-2 — fila de pré-carga (helper **puro** + teste)
- **Arquivo:** novo `web/src/lib/photoBuffer.ts`.
- **Delta:** `prefetchWindow(urls: (string|null)[], index: number, size = 5): string[]` — devolve as próximas `size`
  URLs **não-nulas** a partir de `index` (pula quem não tem foto), sem repetir; e `BUFFER_AHEAD = 5`.
- **Teste (regra test-routing):** números concretos — `index 0`, lista com nulos intercalados → retorna as 5 primeiras
  **com** foto; perto do fim retorna menos; itens nulos nunca entram; não duplica.
- **AC:** função pura, sem DOM, 100% testada; é a "verdade" de qual foto engatilhar.

### IMG-3 — prefetch real no onboarding (sempre 5 à frente)
- **Arquivos:** `web/src/routes/onboarding/OnboardingScreen.tsx` + novo hook `web/src/lib/usePhotoPrefetch.ts`.
- **Delta:** computar `orderedActs.map(a => a.imageUrl)` e, a cada `swipeIndex` (e **já no Step Identity/Festival**,
  para "começar a baixar as 5 primeiras cedo"), pré-carregar `prefetchWindow(...)` via `new Image(); img.src = artistPhotoSrc(u, PHOTO_WIDTH.card)`
  (o browser/SW seguram no cache). Quando o card N aparece, a foto **já está** decodificada; ao ver o card 2, a 7ª já baixa.
- **AC:** ao chegar no próximo card a foto aparece **sem flash/espera**; a janela acompanha o índice (sobe ao avançar,
  volta no undo). Sem travar a UI (prefetch é fire-and-forget, sem `await`). Mesmo helper reusável no Lineup (scroll).
- **Verificar:** Network mostra as próximas ~5 imagens já requisitadas antes de o card aparecer.

### IMG-4 — service worker: cache dedicado de fotos (com teto)
- **Arquivo:** `web/public/sw.js`.
- **Delta:** rota específica para `host === "artist-lineup-cdn.tomorrowland.com"` (e demais hosts de foto) →
  **cache-first dedicado** `PHOTO_CACHE = ${VERSION}-photos`, aceitando resposta **opaca** (cachear quando
  `res.ok || res.type === "opaque"`), com **LRU por contagem/bytes** (ex.: teto ~300 fotos / ~60 MB; ao exceder,
  apagar as mais antigas). Não poluir o `ASSET_CACHE`.
- **AC:** segunda exibição da mesma foto (trocar de tela, reabrir o app) sai do cache, **sem rede**; o cache não cresce
  sem limite. (Opaco não é legível, mas é exibível — suficiente para `<img>`.)
- **Verificar:** offline depois de ver alguns artistas → as fotos vistas continuam aparecendo; `Application > Cache Storage` mostra `-photos` com teto respeitado.

### IMG-5 — favoritos ficam offline (fixar a foto ao favoritar)
- **Arquivos:** hook de favoritos (`web/src/data/localStore.ts` — `useFavorites`) + `usePhotoPrefetch`/`sw.js`.
- **Delta:** ao **favoritar** um act, disparar prefetch da sua foto em `PHOTO_WIDTH.detail` e `.list` e **marcar como
  "keep"** (isenta do LRU do IMG-4). Assim Lineup/My Plan/Now mostram favoritos **sem buscar a internet** — "buscar no
  próprio celular", como pediu o Julio.
- **AC:** favoritar offline depois e abrir My Plan → fotos dos favoritos presentes; o LRU nunca descarta foto de favorito.
- **Nota de escopo:** "salvar **todas** as fotos" é o IMG-4 (com teto). "Salvar **os favoritos** garantidamente" é o IMG-5.
  Se o teto do IMG-4 for problemático, IMG-5 é o piso obrigatório.

### IMG-6 — robustez + diagnóstico do "zero foto"
- **Arquivos:** `web/src/ui/ArtistPhoto.tsx` (retry) + um contador leve (dev only).
- **Delta:** em `onError`, **1 retry** com pequeno backoff (cache-buster suave) antes de cair pro fallback; logar em dev
  quantas imagens falharam por sessão (sem PII) para distinguir "artista sem foto" (esperado, ~24%) de "rede/limite"
  (a investigar). **Não** há rate-limit conhecido na CDN — o teto do IMG-4 e o retry cobrem o cenário do teste.
- **AC:** uma falha transitória de rede se recupera sozinha; "sem foto na fonte" mostra iniciais na hora; o diagnóstico
  permite confirmar a causa do "dia 3" sem achismo (regra fact-verification).

---

## GATE OBV — Onboarding no Safari/iPhone: nome do artista sempre visível · risco BAIXO (CSS) (DEC-068, feedback 25/06)

> **Sintoma no teste (Julio):** no iPhone/Safari (viewport mais curta por causa das barras do iOS) o passo de swipe
> abre **sem mostrar o nome do artista** — vê o toggle Swipe/Grid, o card e o botão de baixo, mas o **nome** só
> aparece **rolando a página** (e aí o toggle some). "O toggle Swipe/Grid é importante, mas ver o nome do artista é
> ainda mais — tem que manter os dois."

**Causa-raiz (confirmada no CSS):** `.art-card` é `width:100%` + `aspect-ratio:4/5` (`styles.css` ~515) dentro de
`.swipe-stage { flex:1 }` (~533). Em viewport curta o card fica **mais alto** que o espaço; o `.ob-body`
(`overflow-y:auto`, ~463) ganha rolagem e o **nome** (no rodapé do card via `.art-inner` → `.art-name`, ~525/528)
cai **abaixo da dobra**. Rolando, o toggle/heads saem de cena e o nome aparece — exatamente o relato.

### OBV-1 — o card escala pela ALTURA disponível (não pela largura)
- **Arquivo:** `web/src/styles.css` (`.swipe-stage`, `.art-card`).
- **Delta:** no contexto do swipe, o card passa a ser limitado pela **altura**: mantém `aspect-ratio:4/5` mas
  `height:100%; max-height:100%; width:auto; max-width:100%; margin-inline:auto;`. `.swipe-stage` ganha `min-height:0`
  (já é flex column centrado). Assim o card **inteiro** (com o nome no rodapé) cabe sem rolar.
- **Alvo:**
```css
.swipe-stage { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.swipe-stage .art-card { height: 100%; max-height: 100%; width: auto; max-width: 100%; aspect-ratio: 4 / 5; margin-inline: auto; }
```
- **AC:** num iPhone (Safari, barras visíveis) o nome do artista fica **100% visível sem rolar**; o card não estoura a área.

### OBV-2 — compactar o cabeçalho do swipe em telas baixas
- **Arquivo:** `web/src/styles.css` (media query por **altura**).
- **Delta:** `@media (max-height: 720px)` reduz paddings/tamanhos de `.pick-toggle`, `.swipe-head`, `.swipe-q` (e some com
  a `.hint` ou encolhe), liberando altura pro card+nome+ações. Sem mudar JSX.
- **AC:** em 667–720px de altura, toggle + card + nome + "Nah/I'd see this" cabem juntos, sem scroll.

### OBV-3 — o passo de swipe não rola (é tela cheia)
- **Arquivos:** `web/src/styles.css` (+ classe condicional no `OnboardingScreen` quando `pickMode === "swipe"`).
- **Delta:** no swipe, o corpo é **`overflow: hidden`** (o card se ajusta via OBV-1); o **grid** continua rolando
  (lá faz sentido). Ex.: `.ob-body.is-swipe { overflow: hidden; }` aplicada só no passo 4 em modo swipe.
- **AC:** no swipe não há rolagem que esconda o toggle; o toggle Swipe/Grid e o nome convivem na mesma tela.

### OBV-4 — nome garantido + toggle preservado
- **Arquivo:** `web/src/styles.css` (`.art-card .art-name`).
- **Delta:** `font-size: clamp(26px, 8vw, 38px)` para o nome encolher junto com o card menor (sem clipar); confirmar o
  `.art-card-scrim` cobrindo o rodapé pra legibilidade. **Não** remover/realocar o `pick-toggle` (DEC: manter os dois).
- **AC (crítico — alerta do Julio):** no menor iPhone suportado, **nome do artista + toggle Swipe/Grid visíveis
  simultaneamente**, sem rolagem. **Verificar:** screenshots em 375×667 (SE) e 390×844 (Safari com barra) vs Android.

---

## GATE ART — Artist Detail Sheet (tocar em qualquer artista) + socials · risco MÉDIO-ALTO (DEC-069, feedback 25/06 + TML HAR)

> **Pedido (Julio):** tocar num artista em **qualquer lugar** (timetable, lineup, foto/nome) abre uma visão com **foto
> grande**, **nome**, **onde** e **quando** ele toca (incluindo **vários palcos/horários** quando há mais de um) e, se
> tivermos, **gênero** e **redes sociais**. Referência visual: o overlay do Tomorrowland (avatar redondo grande, nome,
> ícone de social, lista de performances "Week N · dia · horário · palco").

**O que a fonte realmente entrega (verificado no HAR `belgium.tomorrowland.comArtist.har`, event TL26BE):**
- Por artista: `id`, `name`, `image` (**URL completa**, ex. `…/33881383-Afrojack_LS.jpg`; pode ter espaço/`©` → já tratado
  por `artistPhotoSrc`), e **socials como URLs completas**: `instagram` (132), `spotify` (32), `soundcloud` (28),
  `facebook` (24), `tiktok` (16), `youtube` (15), `website` (8), `twitter` (4).
- **NÃO existe** `genre`, `biography`/`description` nem `country` na fonte. → **Gênero/bio ficam fora do V1** (ver ART-7).
- "Onde/quando toca (vários)" **já está modelado**: `Act.performances[]` (de `uniqueActs`) agrega todas as performances
  do mesmo artista, cada uma com palco + `startAtUtc`/`endAtUtc` + `day` + `weekendId`. Falta **expor na UI** e **capturar
  os socials** (hoje descartados na ingestão).

### ART-1 — tipos da fonte ganham os socials (servidor)
- **Arquivo:** `server/src/lineup/types.ts` (`SourceArtist`).
- **Delta:** adicionar campos **opcionais** `instagram?, spotify?, soundcloud?, facebook?, tiktok?, youtube?, website?, twitter?: string`.
- **AC:** compila; nenhum campo obrigatório novo (a maioria dos artistas tem só alguns).

### ART-2 — `normalize` preserva os socials (servidor) + teste
- **Arquivo:** `server/src/lineup/normalize.ts` (`normalizePerformance`, hoje `a => ({ id, name, image })`).
- **Delta:** mapear também os socials presentes (omitir os ausentes — sem chaves `undefined` poluindo). Helper puro
  `pickSocials(a): ArtistSocials` data-driven sobre a lista de chaves conhecidas.
- **Teste:** fixture com Afrojack (8 socials) → todos preservados; artista sem social → objeto `socials` vazio/omitido.
- **AC:** a normalização não perde mais dado da fonte; sets/horários inalterados (não tocar a math de tempo).

### ART-3 — persistir + expor (schema D1 + DTO)
- **Arquivos:** `server/src/ingest/store.ts` (tabela `artist`), migração D1 em `server/migrations/**`, `server/src/api/dto.ts`
  (`ArtistDto`) e o mapper do endpoint de lineup.
- **Delta:** coluna **aditiva** `socials TEXT` (JSON) na tabela `artist` (1 coluna, simples; evita 8 colunas esparsas);
  gravar no upsert do artista; ler e expor `ArtistDto.socials?: ArtistSocials`. Migração **aditiva** (default NULL).
- **AC:** re-ingestão idempotente preenche `socials`; `GET /lineup` devolve `socials` quando houver; ausência → campo omitido.
- **Verificar:** `npm run test` do servidor (ingest/dto) verde; uma re-ingestão real popula Afrojack & cia.

### ART-4 — web types + domínio (Act.socials + helper puro) + teste
- **Arquivos:** `web/src/data/types.ts` (espelhar `ArtistDto.socials` + tipo `ArtistSocials`), `web/src/domain/lineup.ts`
  (`Act` ganha `socials`), novo helper **puro** `web/src/domain/artistDetail.ts`.
- **Delta:** `Act.socials` propagado em `uniqueActs` (primeiro artista não-vazio vence, como `imageUrl`).
  `buildArtistDetail(act, stages, days, tz) → { name, imageUrl, socials, slots: { stageName, stageColorKey, dayLabel, dateLabel, start, end, weekendName }[] }`,
  com `slots` **ordenados por início** e rotulando dia/horário no fuso do festival. Reusa `toPlannableSets`/`timeInZone` (não duplica math).
- **Teste (regra test-routing):** artista que toca em **2 palcos** → **2 slots** ordenados por hora, com horários concretos;
  artista de 1 set → 1 slot; socials só os presentes.
- **AC:** o sheet recebe dados prontos; nenhuma lógica de tempo nova fora do domínio testado.

### ART-5 — componente `ArtistSheet` (UI) + CSS
- **Arquivos:** novo `web/src/ui/ArtistSheet.tsx` + `web/src/styles.css` (classes `.artist-sheet*`).
- **Delta:** **bottom sheet** reusando o padrão existente (ver `web/src/routes/share/SharePlanSheet.tsx` e
  `web/src/routes/presence/StagePickSheet.tsx`; classes `.sheet-body` já existem). Conteúdo, espelhando o overlay do TML:
  **foto grande** (`ArtistPhoto width={PHOTO_WIDTH.detail}`, redonda ou full-bleed com scrim), **nome** (Oswald),
  **linha de socials** (ícones → `<a target="_blank" rel="noopener noreferrer">` para a URL da fonte; só os presentes),
  e **lista de performances** (`slots`): cada uma com **ponto na cor do palco** + nome do palco + dia + `start–end`
  (e `weekendName` quando houver 2 weekends). Fecha no **backdrop**, **Esc** e botão. A11y: `role="dialog"`,
  `aria-modal`, foco inicial no botão fechar, devolve foco ao gatilho.
- **AC:** abre por `actKey`; mostra **todos** os locais/horários (não só o primeiro); socials abrem em nova aba; sem
  socials/sem foto degrada com elegância (iniciais + sem linha de socials). Visual coerente com o tema Amber Glass.
- **Verificar:** screenshot vs o overlay de referência do TML; `tsc`/test/build verdes.

### ART-6 — tornar artistas clicáveis (wire dos pontos de entrada)
- **Arquivos:** `web/src/routes/TimetableScreen.tsx`, `web/src/routes/LineupScreen.tsx`, `web/src/routes/NowScreen.tsx`,
  `web/src/routes/MyPlanScreen.tsx` (+ provider leve de sheet, ex. `web/src/ui/useArtistSheet.ts`).
- **Delta:** um estado/escopo `openArtist(actKey)` que monta o `ArtistSheet`. Pontos de clique:
  - **Timetable:** `.set-inner` (foto+texto) abre o sheet; o `.heart` (barreira 44px) **continua** só favoritando.
  - **Lineup:** foto+`.art-info` viram alvo (`role="button"`) que abre o sheet; o coração permanece separado.
  - **Now/Next** e **My Plan:** foto/nome abrem o sheet.
  - **Onboarding:** **fora do V1** — no swipe o gesto manda; no grid o tap **favorita** (função primária ali). Não
    sobrecarregar o tap do onboarding (decisão de escopo; reavaliar long-press em V2).
- **AC:** tocar no artista em Timetable/Lineup/Now/My Plan abre o sheet; **nunca** favorita por engano; favoritar
  continua um toque distinto. Voltar fecha o sheet (history-friendly).
- **Verificar:** golden path + checar que o heart do timetable/lineup ainda favorita sem abrir o sheet.

### ART-7 — gênero / bio / história (pendência, fora do V1)
- **Decisão a registrar — DEC-070:** a fonte TML **não** fornece gênero/bio/descrição (verificado no HAR). O Artist
  Sheet V1 **não** os exibe. Enriquecimento futuro possível via **Spotify** (link de artista já vem na fonte p/ alguns)
  ou **MusicBrainz/Last.fm** — **outra fonte de dados**, fora do "diff" atual e do princípio "lineup nunca hardcoded".
- **Ação:** abrir DEC-070 no `decision-log.md` como *proposto/pendente* (não implementar agora). Registrar o trade-off
  (custo de uma 2ª fonte + rate limits + matching de nomes) para um council/decisão futura.

---

## Status (registro de change sets)

| Gate | Change set | Escopo | Status |
|---|---|---|---|
| ICON | ICON-1 | Lock in `lock` → `playlist_add_check` | ☐ pendente |
| TT | TT-1 | `.set` cápsula color-glass | ☐ pendente |
| TT | TT-2 | `.photo` círculo na cor | ☐ pendente |
| TT | TT-3 | estado live (anel degradê) | ☐ pendente |
| TT | TT-4 | ★ contagem de favoritos por palco | ☐ pendente |
| TT | TT-5 | margem do 1º card (sem deslocar a grade) | ☐ pendente |
| TT | TT-6 | heart branco + fav fino | ☐ pendente |
| LU | LU-1 | grid de cards imersivos | ☐ pendente |
| LU | LU-2 | densidade 2/3/4 col + controle | ☐ pendente |
| DAY | DAY-1 | componente `DayDropdown` | ☐ pendente |
| DAY | DAY-2 | favoritos por dia (helper puro + teste) | ☐ pendente |
| DAY | DAY-3 | header usa dropdown (remove pills) | ☐ pendente |
| SH | SH-1 | `ViewSwitch` → dock flutuante (mesma posição) | ☐ pendente |
| SH | SH-2 | header espelhado (sobrancelha + barra) | ☐ pendente |
| SH | SH-3 | respiro pro dock flutuante | ☐ pendente |
| IMG | IMG-1 | `ArtistPhoto` à prova de corrida (key + reset) | ☑ aplicado e verificado |
| IMG | IMG-2 | fila de pré-carga (helper puro + teste) | ☑ aplicado e verificado |
| IMG | IMG-3 | prefetch no onboarding (5 à frente) | ☑ aplicado e verificado |
| IMG | IMG-4 | SW: cache dedicado de fotos (com teto LRU) | ☑ aplicado e verificado |
| IMG | IMG-5 | favoritos offline (fixar foto ao favoritar) | ☑ aplicado e verificado |
| IMG | IMG-6 | robustez (retry/backoff) + diagnóstico | ☑ aplicado e verificado |
| OBV | OBV-1 | card escala pela altura | ☑ aplicado e verificado |
| OBV | OBV-2 | compactar cabeçalho em telas baixas | ☑ aplicado e verificado |
| OBV | OBV-3 | passo de swipe não rola | ☑ aplicado e verificado |
| OBV | OBV-4 | nome garantido (clamp) + toggle preservado | ☑ aplicado e verificado |
| ART | ART-1 | tipos da fonte ganham socials (servidor) | ☑ aplicado e verificado |
| ART | ART-2 | `normalize` preserva socials + teste | ☑ aplicado e verificado |
| ART | ART-3 | schema D1 (`socials`) + DTO | ☑ aplicado e verificado |
| ART | ART-4 | web types + `Act.socials` + helper puro + teste | ☑ aplicado e verificado |
| ART | ART-5 | componente `ArtistSheet` + CSS | ☑ aplicado e verificado |
| ART | ART-6 | wire dos pontos de clique | ☑ aplicado e verificado |
| ART | ART-7 | gênero/bio: DEC-070 pendente (fora do V1) | ☑ decisão registrada (DEC-070; sem código) |

_Legenda: ☐ pendente · ◐ em progresso · ☑ aplicado e verificado._```text
Você vai implementar o LOTE DE CAMPO 25/06 do FestPilot, orquestrado em
FestPilot/brain/design-sync.md — gates IMG (fotos: buffer + cache + fim da "foto errada"),
OBV (onboarding Safari/iPhone: nome do artista sempre visível) e ART (Artist Detail Sheet + socials).

ANTES DE TOCAR EM CÓDIGO
1. Leia FestPilot/brain/design-sync.md inteiro: o loop, as INVARIANTES (inclui os "Limites do lote 25/06"),
   e as seções GATE IMG, GATE OBV, GATE ART com seus change sets (Arquivo/Delta/Alvo/AC/Verificar).
2. Baseline verde: rode `tsc --noEmit` + `npm run test` no web e no server ANTES de mudar nada.

ORDEM (impacto × risco)
  IMG-1  →  OBV-1..4  →  IMG-2..6  →  ART-1..2..3..4..5..6 (ART-7 é só decisão, não código).
  Um change set por vez. IMG e OBV são independentes; ART faz servidor (ART-1..4) antes da UI (ART-5/6).

LOOP POR CHANGE SET (igual ao do orquestrador)
  a) aplique SÓ aquele change set;
  b) `tsc --noEmit` → `npm run test` (domínio 100% verde) → `npm run build`;
  c) verificação visual quando for UI/CSS (screenshot vs o sintoma descrito; IMG/OBV: testar em viewport curta de
     iPhone/Safari com throttling 3G; foto não pode "trocar" sob o nome errado);
  d) scope-creep check: `git --no-pager diff --stat` = exatamente os arquivos daquele change set;
  e) marque o status na tabela do design-sync.md e siga.

REGRAS NÃO-NEGOCIÁVEIS
- NÃO mude a math de domínio (timetable/lineup: actKey, uniqueActs, imageByActKey, janelas) — 0 mudança.
- ArtistPhoto: corrigir a RACE sem mudar a API pública { src, name, width, className } nem o fallback de iniciais.
- Favoritar é SEMPRE um alvo de clique separado — abrir o ArtistSheet nunca pode favoritar por engano.
- Migração D1 do ART é ADITIVA (coluna socials, default NULL); ingestão idempotente; lineup nunca hardcoded.
- Testes: siga .cursor/rules/test-routing.mdc — funções puras (photoBuffer, artistDetail, pickSocials, normalize)
  testadas com NÚMEROS/HORÁRIOS concretos; nada de assert trivial. Rode os testes você mesmo (sem subagentes).
- Código 100% em inglês (nomes, comentários); este doc/PT é só a comunicação.
- Tudo inline nesta sessão. NÃO use a Task tool / subagentes (inline-council-no-subagents.mdc, tech-lead-delegation.mdc).

FECHO DE CADA GATE (só fecha quando)
  tsc + npm run test (web e server) 0 falhas · npm run build ok · golden path (abrir Timetable → trocar dia →
  favoritar um set → abrir Lineup → buscar/filtrar → abrir o ArtistSheet de um artista que toca em 2 lugares) ·
  screenshot bate com o alvo · git diff --stat = só os arquivos do gate · tabela de Status atualizada.

SINCRONIZAR O BRAIN AO FECHAR
  decision-log.md: DEC-067 (IMG), DEC-068 (OBV), DEC-069 (ART), DEC-070 (gênero/bio — proposto/pendente, NÃO implementar).
  dev-log.md: uma entrada por gate (o que foi feito, contagem de testes, riscos de regressão verificados).

ENTREGÁVEL FINAL
  Os 3 gates fechados (ou os que couberem na sessão, em ordem), tabela de Status do design-sync.md atualizada,
  brain sincronizado, e um resumo do que ficou verde + o que (se algo) ficou pendente e por quê.
```

**Fecho de gate** (todo gate só fecha quando): `tsc --noEmit` + `npm run test` **0 falhas** · `npm run build` ok ·
golden path (abrir Timetable → trocar dia → favoritar um set → abrir Lineup → buscar/filtrar) · screenshot bate com a
fonte · `git diff --stat` = exatamente os arquivos do gate (sem scope creep) · status acima atualizado.

---

## Como estender (adicionar novos lotes de mudança)

Quando um novo wireframe/decisão for aprovado, **não reescreva** nada: adicione um **GATE novo**.

1. **Crie um GATE `XX`** com um prefixo curto (ex.: `MAP`, `PLAN`, `SQUAD`) e registre uma linha no **Índice de gates** (topo) com tema, fonte (wireframe + `DEC-NNN`), risco e dependências.
2. **Quebre em change sets `XX-1`, `XX-2`…**, cada um no formato dos existentes: **Arquivo(s)** · **Delta** (o mínimo) · **Alvo** (CSS/JSX da fonte) · **AC** · **Verificar**. Um change set = um diff pequeno e rastreável.
3. **Liste o que NÃO muda** em INVARIANTES se o gate chega perto de algo sensível (domínio, sticky, navegação, store).
4. **Acrescente as linhas** na tabela de **Status** (☐ pendente).
5. **Aplique pelo loop** (acima), um change set por vez, fechando o gate pelos critérios de **Fecho de gate**.
6. **Sincronize o brain**: `DEC-NNN` no `decision-log.md` para a decisão de produto; `dev-log.md` a cada gate fechado.

> Regra de ouro do orquestrador: **só o que mudou muda.** O que já existe e funciona (provado pelos INVARIANTES e pelos testes verdes) **não se toca**.

---

## Kickoff — lote de campo 25/06 (IMG / OBV / ART)

**Como usar:** abrir uma sessão de implementação e colar o bloco abaixo. Ele aponta o agente para este orquestrador e
trava o loop, a ordem e os invariantes. Tudo inline, sem subagentes (constituição de custo do projeto).



> **Recado honesto de dados (não inflar — regra fact-verification):** a fonte do Tomorrowland entrega **foto + redes
> sociais**, mas **não** entrega **gênero, bio ou país**. O Artist Sheet V1 cobre foto/nome/onde-quando/socials; gênero
> e história dependem de uma 2ª fonte (Spotify/MusicBrainz) — registrado como **DEC-070 pendente**, fora deste lote.
