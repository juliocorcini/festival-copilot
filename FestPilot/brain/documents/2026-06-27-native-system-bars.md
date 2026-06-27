# Barras do sistema no shell nativo (Capacitor) — nota de planejamento

> Status: **planejamento** (não implementar agora). Origem: leva *Review & Polish* 2026-06-27, item **D11 / DEC-088**.
> Hoje o FestPilot é **PWA** (DEC-035). Este documento registra **como** tratar as barras do sistema
> quando/se o shell nativo (Capacitor) chegar, para não reabrir a decisão depois.

## Como está hoje (PWA)

- `web/index.html`: `viewport-fit=cover`, `apple-mobile-web-app-status-bar-style=black-translucent`,
  `apple-mobile-web-app-capable=yes`.
- `theme-color` agora é **dinâmico via JS** (`web/src/lib/chrome.ts` → `useThemeColor`), seguindo a palette
  day/night (`useAppearance`). Hoje ambas resolvem para o mesmo warm-near-black `#0F0D09`, porque **só a
  arte do mapa** troca day/night — o chrome (header/nav/sheets) é o mesmo nas duas palettes. Isso é o que
  faz as barras **combinarem** com o app em todas as telas.
- Safe-areas: `--safe-top`/`--safe-bottom` = `env(safe-area-inset-*)` no `:root`; headers usam
  `calc(... + var(--safe-top))` e o `.nav` inferior pinta o fundo dentro do `--safe-bottom`. `body`/`#root`
  usam `var(--bg)`, então o letterbox lateral (shell `max-width: 480px`) também combina.
- `manifest.webmanifest`: `theme_color` e `background_color` = `#0F0D09` (consistentes com o index.html).
- **Single switch-point:** se um dia existir um chrome **day** distinto, basta divergir
  `THEME_COLOR.day` em `web/src/lib/chrome.ts` — o resto (re-aplicar na troca de palette) já funciona.

## Quando o shell nativo chegar

### Plugins
- **`@capacitor/status-bar`** — controla cor de fundo, estilo (claro/escuro do texto) e modo overlay da
  barra de status.
- **Navigation bar (Android)** — não há plugin oficial Capacitor; usar um plugin de comunidade
  (ex.: `@capgo/capacitor-navigation-bar` ou equivalente mantido na época) para cor/estilo da barra de
  navegação inferior do Android. iOS não tem barra de navegação do SO (só o home indicator, coberto pelo
  safe-area).

### Configuração recomendada
- **Overlay ligado** (`StatusBar.setOverlaysWebView({ overlay: true })`) para manter o mesmo modelo edge-to-edge
  do PWA — o conteúdo desenha sob a barra e os `env(safe-area-inset-*)` continuam válidos. **Não** desligar o
  overlay (senão perde-se o cover-fit do mapa/telas full-bleed).
- **Estilo do texto:** `Style.Light` (texto/ícones claros) sobre o chrome escuro, nas duas palettes.
- **Cor de fundo:** manter transparente (overlay). Se algum device exigir cor sólida, usar o mesmo token do
  `theme-color` (`#0F0D09`) — reaproveitar `THEME_COLOR[palette]` de `lib/chrome.ts` como fonte única.
- **Android navigation bar:** cor = `#0F0D09` (igual ao fundo do `.nav`), ícones claros; idealmente também
  em modo translúcido para preservar o edge-to-edge.

### Sincronização com a palette
- Reusar `useAppearance().palette`: ao trocar day/night (ou no boot), chamar os setters dos plugins com a
  cor/estilo correspondente — o mesmo gatilho que `useThemeColor` já usa no PWA. Centralizar em
  `lib/chrome.ts` (ramo nativo) para manter **uma** fonte de verdade.

### Checklist de QA (nativo, futuro)
- [ ] Status bar não cobre conteúdo interativo (safe-area respeitado) em notch/Dynamic Island.
- [ ] Navigation bar (Android) combina com o `.nav` e não cria faixa de cor diferente.
- [ ] Cover-fit do mapa continua edge-to-edge sob as barras (overlay on).
- [ ] Troca day/night atualiza as barras sem flicker.
- [ ] Gesture/3-button navigation no Android: o `.nav` continua acima do home indicator.

## Atualização leva 2 (2026-06-27) — G1 / DEC-089 + DEC-107 (v0.42.0)

A auditoria de safe-area da leva 1 (DEC-088) passou em desktop/simulador mas **falhou no iPhone real**: barra
preta gigante embaixo + conteúdo espremido/travado no topo. Causa: o iOS standalone (com `black-translucent`)
**mal-computa `100dvh`/`%` no primeiro paint e após rotação**, deixando o shell mais curto que a tela.

**Entregue no PWA (G1):**
- **`web/src/lib/viewport.ts` (`useAppHeight`/`applyAppHeight`)** — espelha `window.innerHeight` (fonte
  confiável em standalone) em `--app-height`; `.app`/`.ob` e a cadeia `html/body/#root` usam
  `height: var(--app-height, 100dvh|100%)` (fallback pré-JS). Mata a faixa preta + o conteúdo espremido.
- **`black-translucent` mantido** — é a escolha edge-to-edge que faz a barra de status **mostrar o próprio
  chrome do app** (N7), em vez de uma faixa sólida destoante. As safe-areas (header `--safe-top`, `.nav`
  `--safe-bottom`) já estão no lugar e agora atuam sobre um shell de altura correta.
- **Portrait-only (E02):** manifest `orientation:"portrait"` (Android honra) + **guarda CSS layout-side**
  `.rotate-guard` (overlay i18n, só em viewport landscape de telefone: `pointer:coarse` + `max-height:540px`,
  nunca no desktop), pois o iOS PWA ignora a orientação do manifest.
- **N7/E28 — `color-scheme: dark`** no `:root` (+ `<meta name="color-scheme" content="dark">`): informa ao SO
  que a UI é escura, então o chrome nativo (scrollbars, controles de formulário e, em alguns Androids, as
  barras do sistema) renderiza escuro e combina, nunca uma superfície clara genérica.

**Limite do PWA (reafirmado):** controle **total** da barra de navegação do Android (cor garantida em todas as
versões) continua exigindo TWA/Capacitor (DEC-035) — **não** construído agora. O caminho manifest
`theme_color`/`background_color` (= `#0F0D09`) + `theme-color` dinâmico + `color-scheme: dark` cobre a maior
parte do gap com zero nova superfície de build. O plano do shell nativo permanece o das seções acima.

## Decisão
- **DEC-088**: `theme-color` dinâmico + auditoria de safe-area entregues no PWA (G8, v0.39.0); o shell nativo
  fica **documentado aqui** e **não** é construído nesta fase.
- **DEC-089 + DEC-107** (leva 2, G1, v0.42.0): altura real do shell (`--app-height`) + portrait-only (guarda
  CSS) + `color-scheme: dark`; `black-translucent` mantido; nav-bar total do Android segue dependendo do shell nativo.
