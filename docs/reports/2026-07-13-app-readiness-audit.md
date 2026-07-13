# FestPilot — App Readiness Audit

> **Data:** 2026-07-13 · **Versão auditada:** v0.61.0 · **Método:** varredura sistemática do codebase (todas as 51 telas, testes, CSS, i18n, error handling, UX flows)

---

## Resumo executivo

O FestPilot é um app surpreendentemente completo para o estágio de desenvolvimento: 800+ performances ingeridas, squad plan live com WebSocket, presença por stage, meeting points com foto, mapa georeferenciado, i18n EN/PT, PWA installable, offline cache, 829 testes unitários. **Mas parece "não-pronto" por causa de inconsistências que o usuário percebe imediatamente.**

O principal problema não é funcionalidade faltando — é **inconsistência linguística**: ~14 telas (incluindo o onboarding inteiro e o Lock-in inteiro) têm texto hardcoded em inglês, fora do sistema i18n. Um usuário PT-BR vê o app perfeitamente traduzido na home, lineup, timetable, mapa... e de repente o onboarding, o Lock-in, e o sign-in estão em inglês cru. Isso grita "protótipo inacabado".

**Impacto total estimado para corrigir tudo (exceto auth e push):** ~6-8 horas de trabalho direto.

---

## Categoria 1 — BUGS (funcionalidade quebrada)

### BUG-01: `fittingAddsInWindow` não verifica overlap com slots existentes (P0)

**Status:** 1 teste falhando há pelo menos 1 leva  
**Arquivo:** `web/src/domain/planEdit.ts:90-104`  
**Efeito no usuário:** Quando o usuário abre o picker de "inserir set no gap" (entre dois sets já locados), candidatos que **sobrepõem** o próximo set planejado aparecem como opções válidas. Se selecionados, o plano pode ficar com overlap.

**Root cause:** `fittingAdds` usa `setFits(slots, set)` para verificar overlap. `fittingAddsInWindow` foi criada como "like fittingAdds but restricted to a window" (DEC-109/F01) mas **perdeu** a chamada a `setFits`. Só verifica os bounds do window.

**Teste falhando:** `planEdit.test.ts:139-146` — espera `["d"]`, recebe `["d", "f"]` (f sobrepõe slot C).

**Complexidade do fix:** Baixa — adicionar `&& setFits(slots, set)` ao filtro. ~15 minutos.

**Nota:** O comentário no código diz "RELAXED matching (DEC-115)" — **verificar se DEC-115 intencionalmente removeu o overlap check** ou se foi um descuido. Se intencional, o teste está errado; se descuido, a implementação está errada.

---

### BUG-02: SquadPlanScreen — hooks chamados após early return (P0) ✅ CORRIGIDO

**Status:** Corrigido nesta sessão (v0.61.0)  
**Efeito no usuário:** Botão "Build the Squad Plan" → crash → ErrorBoundary "Something went wrong"  
**Root cause:** Dois `useMemo` após conditional returns violavam as Rules of Hooks  
**Fix:** Mover os hooks antes dos early returns  
**Teste de regressão:** 10 testes criados em `SquadPlanScreen.test.tsx`

---

## Categoria 2 — i18n GAPS (a maior causa do "não-pronto")

O app tem um sistema i18n funcional (`useT()` com dicionários EN/PT). **31 telas usam corretamente.** Mas **14 telas têm texto hardcoded em inglês**, incluindo telas críticas.

### Telas sem i18n (ordenadas por impacto no usuário)

| # | Tela | Strings EN | Impacto | Tipo de tela |
|---|------|-----------|---------|-------------|
| **i18n-01** | `OnboardingScreen` | ~30+ | **CRÍTICO** | Primeira experiência do usuário |
| **i18n-02** | `LockInScreen` | ~13 | **ALTO** | Funcionalidade core (Pillar 2) |
| **i18n-03** | `SignInScreen` | ~12 | **ALTO** | Entrada para squads |
| **i18n-04** | `LocationPrivacyScreen` | ~11 | MÉDIO | Configuração de privacidade |
| **i18n-05** | `RouteScreen` | ~9 | MÉDIO | Navegação entre stages |
| **i18n-06** | `CreateSquadScreen` | ~7 | MÉDIO | Criação de squad |
| **i18n-07** | `SquadBoardScreen` | ~7 | MÉDIO | Board do squad |
| **i18n-08** | `ProfileScreen` | ~6 | MÉDIO | Perfil do usuário |
| **i18n-09** | `MeetSpotScreen` | ~5 | MÉDIO | Criação de meeting point |
| **i18n-10** | `VisibilityScreen` | ~5 | MÉDIO | Controle de visibilidade |
| **i18n-11** | `MeetDetailsScreen` | ~4 | BAIXO | Detalhes do meeting point |
| **i18n-12** | `SquadEventsScreen` | ~4 | BAIXO | Eventos do squad |
| **i18n-13** | `PreciseSharingScreen` | ~2 | BAIXO | Compartilhamento preciso |
| **i18n-14** | `InviteScreen` | ~1 | BAIXO | QR de convite |

**Total: ~120+ strings hardcoded em 14 telas.**

### Exemplos concretos do impacto

**Onboarding (primeira coisa que o usuário vê):**
- "Welcome to FestPilot" (deveria ser "Bem-vindo ao FestPilot")
- "What should we call you?" (deveria ser traduzido)
- "Which festival are you going to?" / "Which weekend?" / "Which days?"
- "Start picking artists" / "See my plan" / "Let's go"
- "Boom, Belgium · Jul 2026" — copy hardcoded específico de TML

**Lock-in (funcionalidade core):**
- "LOCK IN" / "LOCKED IN!" / "View My Plan" / "Share"
- "All clashes" / "No clashes left — you're all set."
- "Add an artist" / "NEARBY THIS TIME"
- Search: `placeholder="Search any artist…"` (outras telas usam `t("common.searchArtists")`)

**Sign-in:**
- "Continue as guest" / "Setting up…"
- "Continue with Google" / "Email me a link" (com label "Soon")
- "By continuing you accept the Terms & Privacy."

### Estimativa de esforço

~120 strings × 2 idiomas (EN keys + PT translations) = ~240 entries no dicionário i18n.  
**Estimativa:** 3-4 horas de trabalho direto (adicionar keys ao EN dict, traduções PT, substituir hardcoded por `t()`).

---

## Categoria 3 — VISUAL / PROTOTYPE FEEL

### VIS-01: Inline styles excessivos em telas chave

Telas com alta contagem de `style={}` inline (indicador de desenvolvimento rápido/protótipo, não de design system consolidado):

| Tela | `style={}` | Observação |
|------|-----------|------------|
| `LockInScreen` | 19 | A tela mais core do Pillar 2 |
| `OnboardingScreen` | 15 | Primeira experiência |
| `CreateSquadScreen` | 11 | |
| `MeetSpotScreen` | 10 | |
| `RouteScreen` | 10 | |
| `SignInScreen` | 8 | |
| `ProfileScreen` | 8 | |
| `InviteScreen` | 8 | |

**Impacto:** Visualmente pode parecer ok, mas inline styles não respondem a temas (dark mode, contraste) e indicam que o design system CSS não cobre esses componentes. **Extrair para CSS named classes** quando as telas forem tocadas para i18n.

### VIS-02: "Soon" pills no SignInScreen

Botões `Continue with Google` e `Email me a link` estão `disabled` com uma pill "Soon". Isso:
- Promete algo que não existe → cria expectativa → decepciona
- Parece protótipo, não produto
- Em PT-BR, "Soon" fica em inglês (sem i18n)

**Recomendação:** Esconder completamente OU transformar em um bloco informativo ("Contas Google e email chegam em breve — por enquanto, continue como convidado.").

### VIS-03: Copy hardcoded de festival no Onboarding

`"Boom, Belgium · Jul 2026"` é hardcoded no `OnboardingScreen.tsx`. Quando o app suportar outros festivais, isso precisa vir do backend. Mas mesmo agora, deveria estar em i18n para mudar sem rebuild.

---

## Categoria 4 — FEATURES DEFERRED (reconhecidas, mas visíveis)

Estas já estão no decision-log como deferred. O impacto aqui é como elas se apresentam ao usuário:

| Feature | DEC | Visibilidade ao usuário | Risco |
|---------|-----|------------------------|-------|
| **Firebase auth real** | DEC-038 | "Soon" pills no sign-in; dados se perdem se cache limpa | **ALTO** no festival (bateria morre, telefone esquenta) |
| **Server push** | DEC-105 | Sem notificação quando app fechado; "where is everyone?" não funciona em background | **ALTO** no festival (app em background a maior parte do tempo) |
| **POI editor** | DEC-064 | Mapa sem toilets/water/food/medical | MÉDIO |
| **Travel matrix curada** | — | Tempos de caminhada estimados, não reais | BAIXO |

**Nota sobre auth:** No contexto de um festival (sol forte → tela invisível, bateria drena rápido, multidão → distração), perder o plano porque o cache do browser limpou é devastador. Firebase auth deveria ser uma prioridade antes do festival.

---

## Categoria 5 — TECHNICAL DEBT

### DEBT-01: 1 teste falhando ignorado

`planEdit.test.ts` tem 1 teste vermelho (`fittingAddsInWindow`). Testes vermelhos ignorados:
- Mascaram novos bugs (não dá para saber se algo novo quebrou)
- Sinalizam que a suite de testes não é confiável
- **Suite deveria estar 100% verde.**

### DEBT-02: CSS monolítico (2829 linhas)

Todo o CSS em `src/styles.css`. Funciona, mas:
- Difícil de manter conforme o app cresce
- Nomes de classe não são scoped (risco de colisão)
- Não é blocker agora, mas complica contribuições futuras

### DEBT-03: Cobertura de testes de componentes fina

De 51 componentes de tela, apenas 4 têm testes de componente:
- `Sheet.test.tsx`
- `MapView.test.tsx`
- `PullToRefresh.test.tsx`
- `SquadPlanScreen.test.tsx` (criado hoje)

Os testes de domínio são excelentes (66 arquivos, 829 testes). Mas erros de renderização (como o hooks violation do BUG-02) só são pegos por testes de componente ou uso manual.

---

## Categoria 6 — UX OBSERVATIONS

### UX-01: Inconsistência de idioma é o "uncanny valley" do app

O app está ~75% localizado para PT-BR. Mas os 25% restantes criam um efeito "uncanny valley" — o usuário não percebe a tradução quando funciona (parece natural), mas **nota imediatamente** quando uma tela aparece em inglês. O resultado é pior que se o app fosse 100% em inglês — parece bugado/incompleto em vez de "internacional".

### UX-02: Onboarding → primeiro minuto é todo em inglês

O onboarding é literalmente a PRIMEIRA interação do usuário. Se o celular está em PT-BR e o app mostra "Welcome to FestPilot" / "What should we call you?", o usuário vai pensar que o app é em inglês. Quando depois descobre que a home, lineup, e timetable estão em português, a experiência é confusa.

### UX-03: Lock-in flow (core do Pillar 2) sem localização

A resolução de clashes é a funcionalidade mais inovadora do app. Toda a UI de swipe, escolha entre artistas, "LOCKED IN!", "View My Plan" — tudo em inglês. Para um público brasileiro, isso é um desserviço ao produto.

---

## Plano de ação recomendado

### Sprint 1: "Zero inglês cru" (~6-8h)

| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 1 | Fix `fittingAddsInWindow` (BUG-01) | 15 min | Bug lógico eliminado |
| 2 | i18n OnboardingScreen (i18n-01) | 60-90 min | Primeira impressão corrigida |
| 3 | i18n LockInScreen (i18n-02) | 45-60 min | Core feature localizada |
| 4 | i18n SignInScreen + remover/redesenhar "Soon" (i18n-03, VIS-02) | 30-45 min | Squad entry limpa |
| 5 | i18n restantes 11 telas (i18n-04 a i18n-14) | 2-3h | Consistência total |
| 6 | Extrair inline styles críticos para CSS | 1h | Elimina feel de protótipo |

**Resultado:** App 100% localizado EN/PT, zero testes falhando, zero strings hardcoded.

### Sprint 2: "Pronto para o festival" (~16-24h, projeto separado)

| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 1 | Firebase auth real (DEC-038) | 8-16h | Dados não se perdem |
| 2 | Server push notifications (DEC-105) | 8-12h | "Where is everyone?" funciona em background |

### Sprint 3: "Polimento profissional" (nice-to-have)

| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 1 | Testes de componente para telas críticas | 4-6h | Segurança contra regressões visuais |
| 2 | CSS split por módulo | 4-6h | Manutenibilidade |
| 3 | POI data para o mapa | 2-4h (data entry) | Experiência no local |

---

## Apêndice: Arquivos verificados

**Telas auditadas (51):** todas em `web/src/routes/` + `web/src/admin/`  
**Testes verificados:** 66 arquivos em `web/src/`, 28 em `server/test/`  
**CSS:** `web/src/styles.css` (2829 linhas)  
**i18n:** `web/src/i18n/index.ts` (~1600 linhas, ~580 keys EN, ~580 keys PT)  
**Domínio:** todos os `web/src/domain/*.ts`  
**Data layer:** todos os `web/src/data/*.ts`
