# FestPilot — UI DNA + Direções Propostas

> Sintetizado em 2026-06-23 a partir do questionário preenchido.

---

## UI DNA — O que as respostas dizem sobre você

### Resumo em 1 frase
> Um app que **parece uma noite de festival** — **vidro** em tudo, **energia** sem ser "IA", **mapa** como estrela, **amigos** como coração — mas que **funciona como um relógio suíço** no sol, com uma mão, com pouca bateria.

### Parâmetros extraídos

| Dimensão | Valor |
|----------|-------|
| **Personalidade** | Ousado + Lúdico (B+D) — forte e divertido, nunca corporativo |
| **Tom emocional** | Hype + Premium + Social — empolga, se sente exclusivo, conecta com amigos |
| **Sentimento-alvo** | "Decidido, conectado, aliviado" |
| **Tema** | Auto (escuro de noite, claro alto-contraste de dia) |
| **Cor** | NÃO roxo/rosa/verde neon "IA". Quer cor-por-palco + gradientes vibrantes. Identidade = algo ORIGINAL |
| **Tipografia** | Condensada/pôster nos títulos (impacto de cartaz). Corpo legível. Sem fontes-clichê-IA (Inter, DM Sans, etc.) |
| **Cantos** | Suavemente arredondados (12-16px) |
| **Densidade** | Equilibrado (4-6/10), com toque arejado no on-site |
| **Efeito #1** | **VIDRO (glassmorphism/frosted)** — obsessão declarada. É a assinatura visual. |
| **Efeitos 2-5** | Gradientes, camadas tonais, transições suaves, celebração nos momentos-chave |
| **Movimento** | Moderado de base + animado/gamificado no Lock in e celebrações |
| **Imagem** | Misto: fotos de artista na descoberta, mapa/ícones nas telas operacionais |
| **Navegação** | 5 abas embaixo + swipe entre seções + mapa como aba muito forte (opção de home no festival) |
| **Tela inicial** | "Agora & A seguir" (contagem regressiva) — com opção de trocar para mapa quando o festival começa |
| **Onboarding** | Swipe (Tinder) + "escolha imperdíveis" + skip. Artista aparece 1 vez mesmo se tocar em vários dias |
| **Lineup browse** | Grade scrollável estilo app Tomorrowland (palcos × tempo). My Plan = timeline vertical simples (1 linha) |
| **Lock in** | Duelo 1v1 tela cheia (estilo stories/torneio), gamificado com celebração |
| **Mapa** | Ilustrado/estilizado (SVG gerado IA a partir do real), avatares + lista por palco + radar preciso opt-in |
| **Ponto encontro** | Pin + foto + nota (card) + seta/bússola em tela cheia |
| **My Plan visual** | Timeline vertical incluindo deslocamentos e pausas (comer, banheiro) |
| **Microcopy** | Hype + amigável, bilíngue PT/EN |
| **Restrições HARD** | Sol forte (crítico) · Uma mão (crítico) · Bateria (muito — loc. inteligente) · WCAG AA · Marca própria |
| **Inspirações** | Spotify (dark funcional), App TML (identidade festival), Snapchat Map (espacial), Citymapper (utilidade) |
| **Anti-referências** | NADA de "cara de IA" · Nada datado · Nada corporativo |

### A "regra de ouro" do design FestPilot
> **Vidro + cor-por-palco + tipografia de cartaz + animações naturais** = identidade.
> Mas tudo deve funcionar **sem piscar, sem drenar bateria, sem esconder a informação** no pior cenário: sol das 15h, uma mão, 15% de bateria.

---

## 3 Direções Propostas

Cada direção respeita 100% da sua UI DNA. A diferença está na **identidade cromática** e no **tom emocional dominante** — qual "sensação" lidera.

---

### Direção 1 — "Amber Glass" (Vidro Dourado)

**Identidade:** Escuro quente + acento âmbar/dourado + muito vidro fosco.

**Paleta base:**
- Fundo: preto quente (#0F0D09 → #1A1610)
- Superfície: vidro fosco com tint dourado (rgba(255,190,60, .06))
- Acento primário: âmbar dourado (#F5A623 → #FFD060)
- Sobre-acento: preto
- Neutros: marrom-acinzentado quente
- Palcos: cada um com sua cor vibrante (laranja, turquesa, coral, lima, violeta-quente…)

**Sensação:** "Golden hour" — o pôr do sol no festival, hora mágica antes dos headliners. Premium mas quente, não frio.

**Tipografia:** Títulos em fonte condensada bold (ex.: Bebas Neue ou Oswald — clássicas de cartaz, não AI). Corpo: Hanken Grotesk ou Albert Sans.

**Vidro:** backdrop-filter: blur(16px) em quase todo card/sheet. Base escura faz o vidro brilhar.

**Modo claro:** Inverte para off-white quente (#FAF7F0) + âmbar escuro (#8B5E00) para alto contraste no sol.

**Tom:** premium-exclusivo + hype contido. "Seu acesso VIP ao festival."

**Referências visuais:** Spotify dark + Luma (premium) + vidro do iOS — tudo banhado em dourado em vez de verde.

**Conselho inline:**
- **Estrategista:** Dourado = premium, lembra champagne/VIP/sunset. Diferencia bem de qualquer "app IA" e de qualquer concorrente de festival (que são todos roxo/neon). ✓
- **Arquiteto:** Vidro pesado com escuro quente funciona bem (alto contraste). O modo claro precisa de cuidado para o âmbar não ficar "fraquinho" no sol — usar o âmbar como borda/ícone, não como fundo.
- **Crítico:** Risco: se o dourado for mal dosado pode parecer "app de crypto" ou "casino". Manter sofisticado, nunca brilhante demais. Usar dourado como acento (10%), não como cor dominante.
- **Advogado:** Ótimo para a sensação "decidi, estou no controle" (Q4). O quente traz conforto, o dourado traz exclusividade. Vidro + escuro = bateria amigável. ✓
- **Veredito: FORTE.** Original, premium, amigável à bateria, zero "cara de IA". Principal cuidado: dosagem do dourado.

---

### Direção 2 — "Reef Glass" (Vidro Tropical)

**Identidade:** Azul-petróleo profundo + coral vivo + vidro com tint oceânico.

**Paleta base:**
- Fundo: petróleo profundo (#091B22 → #0D2832)
- Superfície: vidro fosco com tint ciano sutil (rgba(0,210,200, .05))
- Acento primário: coral quente (#FF6B4A)
- Acento secundário: turquesa (#00D4C8)
- Neutros: azul-acinzentado frio
- Palcos: paleta vibrante e contrastante (coral, limão, turquesa, rosa-quente, roxo-quente…)

**Sensação:** "Noite na praia" — tropical, elétrico mas natural. Oceano + coral = vivo sem ser artificial.

**Tipografia:** Mesma base condensada (pôster). Corpo: Figtree ou General Sans (geométricas sem ser clichê).

**Vidro:** Tint oceânico no blur, dando um "underwater glass" feeling. Muito bonito com as cores de palco por cima.

**Modo claro:** Off-white azulado (#F5F9FA) + petróleo escuro para texto. Coral continua vibrante no sol.

**Tom:** energético + amigável + um pouco "natureza/tropical". "O festival é um ecossistema vivo."

**Referências visuais:** Citymapper (utilidade colorida) + vidro iOS + paleta de aquário/vida marinha (zero AI).

**Conselho inline:**
- **Estrategista:** Tropical/oceânico é raro em apps de festival (que são quase todos escuros roxos). Diferencia fortemente. O coral é quente o suficiente para dar energia sem ser "neon rosa IA".
- **Arquiteto:** Petróleo profundo + vidro = tecnicamente seguro (bom contraste). A dualidade coral/turquesa dá 2 acentos sem poluir se usados em contextos separados (coral = ação, turquesa = info).
- **Crítico:** Risco: pode parecer "app de mergulho" se o tema oceânico for demais na UI (não colocar peixes, óbvio). Manter sutil — é só a paleta, não a metáfora.
- **Advogado:** O coral é ÓTIMO para CTAs e alertas (urgência natural: "saia agora!"). Turquesa para info calmante ("seus amigos estão no Mainstage"). Dual-acento funcional e emocional.
- **Veredito: FORTE.** Original, distinto de IA, boa funcionalidade dual de cor. Principal cuidado: não exagerar na "temática marinha" — é só cor, não tema.

---

### Direção 3 — "Magma Glass" (Vidro Vulcânico)

**Identidade:** Preto com tint quente avermelhado + acento laranja-vivo/vermelho-festival + vidro com glow quente.

**Paleta base:**
- Fundo: preto avermelhado (#110B0B → #1A0E0E)
- Superfície: vidro fosco com tint vermelho (rgba(255,80,40, .04))
- Acento primário: laranja-vivo (#FF5D2E)
- Acento secundário: vermelho-festival (#E53E3E)
- Neutros: cinza rosado quente
- Palcos: paleta quente-fria equilibrada (laranja, azul-elétrico, lima, rosa-quente, roxo, turquesa…)

**Sensação:** "Fogo do palco" — energia bruta, calor humano, show ao vivo. A fumaça da máquina de fog.

**Tipografia:** Condensada extra-bold nos títulos (máximo impacto pôster). Corpo: Albert Sans ou Switzer.

**Vidro:** Tint quente nos blurs, com um glow suave (como luz de palco atravessando fumaça).

**Modo claro:** Off-white quente (#FFF8F5) + preto. Laranja se mantém vibrante.

**Tom:** pura energia/hype + "estou no meio da ação". Mais intenso que as outras duas.

**Referências visuais:** Boiler Room (cru, ao vivo) + Spotify (dark) + efeito de fumaça/fog sutil nos vidros.

**Conselho inline:**
- **Estrategista:** Laranja-vivo é POUCO usado em apps (não é IA, não é corporate, não é gaming). É memorável e tem associação forte com energia/urgência/festival.
- **Arquiteto:** Preto avermelhado + laranja = alto contraste natural. Funciona bem com o modo claro. O vidro com tint quente é visualmente distinto de tudo no mercado.
- **Crítico:** Risco: laranja/vermelho pode transmitir "perigo/alerta" se mal dosado. O vermelho deve ser secundário (celebração/urgência), não dominante. Laranja lidera.
- **Advogado:** A intensidade casa com "decidido" (Q4) e com o hype (Q2). Pode ser DEMAIS para o uso prolongado — precisa de respiros (cards em vidro neutro entre os acentos).
- **Veredito: OUSADO.** O mais diferenciado e enérgico. Zero IA. Mas exige mão firme na dosagem — laranja como acento pontual, não como wallpaper.

---

## Comparação rápida

| | Amber Glass | Reef Glass | Magma Glass |
|---|---|---|---|
| **Cor líder** | Dourado/âmbar | Coral + turquesa | Laranja-vivo |
| **Fundo escuro** | Preto quente | Petróleo profundo | Preto avermelhado |
| **Vidro tint** | Dourado | Oceânico/ciano | Quente/fumacento |
| **Tom** | Premium/exclusivo | Tropical/energético | Intenso/ao-vivo |
| **"Cara de IA"?** | Zero | Zero | Zero |
| **Risco principal** | Parecer "crypto" se exagerar ouro | Parecer "app de mergulho" se temático | Parecer "alerta/perigo" se vermelho dominar |
| **Melhor para** | Sensação VIP, sofisticação | Frescor, dualidade funcional | Energia bruta, impacto |
| **Bateria** | ✓ escuro | ✓ escuro | ✓ escuro |
| **Sol (modo claro)** | ✓ off-white quente | ✓ off-white frio | ✓ off-white quente |

---

## Observação sobre cor-por-palco

Independente da direção, os **15 palcos** do Tomorrowland terão cores próprias usadas no timetable e no mapa. A paleta de palcos é construída para funcionar tanto no modo escuro quanto no claro, e é independente do acento principal do app. Ex.:
- MAINSTAGE: laranja-fogo
- FREEDOM: azul-elétrico
- CAGE: amarelo
- CORE: verde-lima
- ELIXIR: roxo-quente
- (etc.)

Essas cores "vivem dentro" de qualquer direção.

---

## Elementos compartilhados (todas as direções)

Estes não mudam entre direções — são decisões fixas da sua DNA:

- **Glassmorphism pesado** — assinatura visual #1
- **5 abas embaixo** (Início · Lineup · My Plan · Mapa · Grupo)
- **Swipe entre seções** (gestual + tabs)
- **Mapa como aba protagonista** (opção de trocar para home durante festival)
- **Tipografia condensada** nos títulos (cartaz)
- **Lock in = duelo 1v1 tela cheia** com celebração
- **Timeline vertical** no My Plan (com deslocamentos/pausas)
- **Onboarding swipe** (artista aparece 1x)
- **Animações naturais** (spring physics, não linear)
- **Grid scrollável** no lineup (palcos × tempo)
- **Bússola/seta** para ponto de encontro
- **Bilíngue PT/EN**
- **Marca própria** (mesma cara iOS/Android)

---

## Próximo passo

Escolha **1 direção** (ou diga "misturar X de uma com Y de outra") → eu gero **protótipos visuais reais** (HTML interativo) das telas-chave nessa identidade:
1. Tela Início ("Agora & A seguir")
2. Lock in (duelo 1v1)
3. Mapa (com presença)
4. My Plan (timeline)

E aí abrimos opções **dentro** da direção escolhida (layout, posição de elementos, variações).
