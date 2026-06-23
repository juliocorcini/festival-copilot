# FestPilot — Descoberta de Direção de UI (questionário + conselho)

> Criado em 2026-06-23. Objetivo: **entender o que você quer na interface** antes de desenhar.
> Não é a UI final — é o mapa das suas preferências, com exemplos e a opinião do conselho.

## Como usar este documento

1. Em cada pergunta, **marque sua escolha** trocando `- [ ]` por `- [x]`. Pode marcar mais de uma onde estiver escrito "(pode marcar várias)".
2. Se nenhuma opção encaixar, escreva na linha `**Outro:`**.
3. Use `**Observação:`** para qualquer comentário, dúvida ou "depende".
4. Não precisa responder tudo — responda o que tiver opinião. O que ficar em branco, eu trato como "tanto faz, decida por mim".
5. Quando terminar, **me devolva o arquivo (ou só cole as respostas numa mensagem)**.

### O que cada marcador significa

- **Diferença:** explica, em uma linha, o que muda na prática entre as opções.
- **Conselho:** veredito sintetizado de 4 perspectivas inline (Estrategista, Arquiteto, Crítico, Advogado-do-usuário) — uma recomendação + a principal ressalva. **É só uma opinião para você reagir**, não uma decisão.

### O plano (3 passos)

1. **Agora:** você responde este questionário.
2. **Depois:** eu sintetizo sua "**UI DNA**" e proponho **2–3 direções nomeadas** (descrição + por que combina com o que você disse).
3. **Por fim:** transformo a direção escolhida em **protótipos visuais** (telas em HTML/Canvas que parecem o app de verdade) e aí abrimos **opções dentro daquela direção**.

### Contexto do produto (para aterrar as escolhas)

App de festival, **mobile-first (PWA → Capacitor)**, usado **ao ar livre, no sol, com uma mão, em multidão, com bateria limitada**. Três pilares: **(1) Favoritos** (escolher quem quer ver), **(2) "Lock in" / My Plan** (resolver conflitos de horário num cronograma sem sobreposição — a função-assinatura, gamificada), **(3) Grupos** (cronograma compartilhado, presença por palco, pontos de encontro). Festival de referência: Tomorrowland.

---

# PARTE 1 — Arquétipos de UI (qual "vibe" te puxa mais?)

> Estes são **caminhos inteiros** possíveis. Não precisa decidir agora nem escolher só um — marque
> o(s) que mais ressoam. Eles podem se **misturar** (ex.: base "Planner limpo" + acento "Neon").
> Servem para eu entender a direção macro; o detalhe vem na Parte 2.

### Arquétipo A — "Planner Limpo" (organizador elegante)

- **Vibe:** calmo, minimalista, utilitário. Tipo Apple Calendar / Things / Citymapper para festival.
- **Visual:** neutro (claro ou escuro), 1 cor de acento, muito espaço, tipografia limpa.
- **Navegação:** barra de abas embaixo; tela inicial = "agora e a seguir".
- **Lock in:** objetivo e rápido, foco em clareza.
- **Forte em:** legibilidade no sol, decisão rápida, sensação "premium discreto".
- **Fraco em:** menos "energia de festival/hype".
- **Referências:** Things, Citymapper, Apple Calendar, Linear.
- **Conselho:** ótima base **default** — segura, legível, escala bem. Risco: pode ficar "sem alma" para um público de festival; combina com um acento forte para ter personalidade.

### Arquétipo B — "Neon / Noite Rave"

- **Vibe:** escuro, neon, energético, vidro (glass), gradientes, tipografia expressiva, fotos grandes de artista. Cara de cultura EDM/Tomorrowland.
- **Navegação:** abas embaixo ou hub; muito imagético.
- **Lock in:** dramático, com animação e celebração.
- **Forte em:** identidade, hype, ótimo à noite, escuro ajuda bateria.
- **Fraco em:** legibilidade ao sol (precisa de modo claro/alto contraste), pode cansar se exagerar.
- **Referências:** app oficial Tomorrowland, Spotify (dark), Boiler Room.
- **Conselho:** **mais "do nicho"** e memorável. Risco do Crítico: neon no sol é ruim — exige um modo claro de verdade e contraste alto, não só "bonito no print".

### Arquétipo C — "Mapa primeiro" (companheiro no local)

- **Vibe:** o **mapa do festival é o hub**. Tudo ancorado no espaço: palcos, amigos, "você está aqui".
- **Navegação:** mapa como tela central; camadas (lineup, amigos, banheiros) por cima.
- **Forte em:** uso no local, achar amigos/palcos, deslocamento.
- **Fraco em:** planejar **antes** do festival (favoritar/lockin) fica secundário.
- **Referências:** Snapchat Map, Citymapper, Google Maps.
- **Conselho:** poderoso no **dia D**, mas os pilares 1–2 (que você valida como PWA antes) ficam escondidos. Melhor como **modo/aba forte**, não como o app inteiro.

### Arquétipo D — "Social / Stories"

- **Vibe:** amigos, presença e pontos de encontro na frente; leve, lúdico. Cara de BeReal/Instagram.
- **Navegação:** feed/avatares dos amigos como coração do app.
- **Forte em:** grupos, "onde está todo mundo", diversão.
- **Fraco em:** o planejamento sério (lineup/lockin) vira coadjuvante; depende de muita gente usando.
- **Referências:** BeReal, Instagram, Snapchat.
- **Conselho:** encaixa no Pilar 3, mas o **valor único** do FestPilot é o planejamento (1–2). Bom como **camada**, arriscado como identidade principal.

### Arquétipo E — "Editorial / Pôster"

- **Vibe:** lineup grande e tipográfico como um **pôster impresso** de festival; rico em imagem, ótimo para descobrir/favoritar.
- **Navegação:** descoberta/lineup como destaque; tipografia display.
- **Forte em:** beleza ao navegar artistas, sensação premium/cultural.
- **Fraco em:** denso para tarefas rápidas no local; precisa de cuidado para não virar "só bonito".
- **Referências:** Resident Advisor, DICE, pôsteres de festival, Apple Music (editorial).
- **Conselho:** lindo para o **momento de explorar o lineup**; combina como "pele" de browse/descoberta sobre uma base de planner.

**Qual(is) arquétipo(s) te puxam? (pode marcar várias)**

- [ ] A — Planner Limpo
- [x] B — Neon / Noite Rave
- [x] C — Mapa primeiro
- [x] D — Social / Stories
- [ ] E — Editorial / Pôster
- [x] Uma **mistura** (descreva abaixo)

Mistura/observação: gostei do mapa mostrando tudo, gostei do social depois pois é uma parte importante, e do neon eu gostei dos elementos em vidro, eu amo elementos em vidro,  vidro, vidro com blur, vidro tipo frosted..

---

# PARTE 2 — Perguntas detalhadas

## §1 — Personalidade e emoção

### Q1 — Personalidade do app

- [ ] A) Minimalista-limpo (sóbrio, espaçado)
- [x] B) Ousado-energético (forte, vibrante)
- [ ] C) Premium-editorial (sofisticado, tipográfico)
- [x] D) Lúdico-amigável (divertido, arredondado)
- [ ] E) Técnico-denso (muita info por tela)
- [ ] Outro: __________

Diferença: define o "tom" geral — quanto contraste, cor, movimento e densidade o app terá.
Conselho: recomenda **A com toques de B** (limpo de base, energia nos momentos certos: lockin, presença). Ressalva do Advogado: festival pede alguma energia — minimalismo puro pode parecer "app de trabalho".
Observação: __________

### Q2 — Tom emocional

- [ ] A) Calmo / utilitário (te ajuda, sai da frente)
- [x] B) Hype / energia (empolga, "vibe de festa")
- [x] C) Premium / exclusivo
- [x] D) Amigável / social
- [ ] Outro: __________

Diferença: afeta cor, movimento e textos (microcopy).
Conselho: recomenda **A no planejamento, B no on-site** (modo "calmo" para montar o plano; "hype" quando o show começa). Ressalva: precisa ser coerente, não dois apps diferentes.
Observação: __________

### Q3 — "Se o FestPilot fosse um lugar, seria…"

- [ ] A) Um app organizador elegante (caderno premium)
- [ ] B) Uma balada neon
- [x] C) Um pôster de festival impresso
- [x] D) Um grupo de amigos no chat
- [x] E) Um app de transporte da cidade
- [ ] Outro: __________

Diferença: metáfora que guia toda a estética.
Conselho: A ou C dão a melhor base "premium e legível"; B dá identidade mas exige disciplina de contraste.
Observação: __________

### Q4 — Em **3 palavras**, como o app deve fazer a pessoa se sentir?

Resposta: decidido, conectado, aliviado(que encontrei meus amigos)

### Q5 — O que ele **NÃO** pode parecer? (anti-referências) (pode marcar várias)

- [x] A) Dashboard corporativo / "de trabalho"
- [ ] B) Infantil / brinquedo
- [ ] C) Poluído / cheio de coisa
- [x] D) Template genérico de "feito por IA"
- [x] E) Datado / antigo
- [x] Outro: um coisa muito importante, não quero que o app tenha cara de feito por ia, temos que pensar nos designs  mais diferentes possiveis criatividade pois não quero cores de ia, neon rosa/roxo e verde nem, e nem quero coisas que falem de cara que foi feito por ia, quero coisa diferente, original, fora da caixa de IA.

Conselho: o Crítico destaca D (cara de template) e C (poluição) como os maiores riscos num app de festival.
Observação: __________

---

## §2 — Estilo visual

### Q6 — Modo de tema

- [ ] A) Escuro como padrão (com modo claro disponível)
- [ ] B) Claro como padrão (com modo escuro disponível)
- [x] C) Ambos, automático (segue o sistema/horário)
- [ ] Outro: __________

Diferença: escuro economiza bateria e brilha à noite; claro lê melhor sob sol forte.
Conselho: recomenda **C (auto), com escuro caprichado** — festival é dia E noite; à tarde no sol o claro/alto contraste salva, à noite o escuro é lindo e poupa bateria. Ressalva: dá o dobro de trabalho de design; se tiver que escolher um só, **escuro** vence pela identidade + bateria.
Observação: __________

### Q7 — Direção de cor

- [ ] A) Roxo/magenta (vibe Tomorrowland)
- [ ] B) Azul-ciano elétrico
- [ ] C) Pôr do sol (laranja → rosa)
- [ ] D) Mono (preto/branco) + 1 acento neon
- [ ] E) Verde
- [ ] F) Quero descrever / tenho cores de marca
- [x] Outro: não quero que o app tenha cara de feito por ia, temos que pensar nos designs  mais diferentes possiveis criatividade pois não quero cores de ia, neon rosa/roxo e verde nem, e nem quero coisas que falem de cara que foi feito por ia, quero coisa diferente, original, fora da caixa de IA.

Diferença: a cor dominante define a "cara". Mono+acento é o mais seguro e flexível.
Conselho: recomenda **D (mono + 1 acento)** como base + cores **por palco** (ver Q8) para a identidade. Ressalva do Estrategista: se quiser "cheirar a Tomorrowland", A é mais memorável, mas amarra a marca a um festival só.
Observação (descreva cores se marcou F): __________

### Q8 — Uso de cor

- [x] A) **Cor por palco** (cada palco tem uma cor, usada no lineup e no mapa)
- [ ] B) Uma cor de marca em tudo
- [x] C) Multi-gradientes vibrantes
- [ ] Outro: __________

Diferença: cor-por-palco ajuda MUITO a ler timetable e mapa de relance; gradiente é mais "estético".
Conselho: recomenda **A (cor por palco)** — é funcional E bonito, e reforça os 3 pilares. Ressalva: precisa de paleta acessível (contraste) e fallback quando há muitos palcos.
Observação: __________

### Q9 — Tipografia (vibe)

- [ ] A) Geométrica-limpa (ex.: Satoshi, Manrope)
- [ ] B) Humanista-calorosa (ex.: Source Sans, Nunito)
- [ ] C) Display editorial nos títulos (impacto tipo pôster)
- [x] D) Condensada estilo pôster de festival
- [ ] Outro: __________

Diferença: títulos display/condensados dão "cara de festival"; geométrica é neutra e versátil.
Conselho: recomenda **A no corpo + C/D nos títulos** (legível no dia a dia, com personalidade nos cabeçalhos). Ressalva: evitar fontes "clichê de IA" (Inter etc.).
Observação: __________

### Q10 — Forma dos elementos (cantos)

- [ ] A) Retos / quadrados (sério, técnico)
- [x] B) Suavemente arredondados (moderno, amigável)
- [ ] C) Bem arredondados / pílula (lúdico, macio)
- [ ] Outro: __________

Conselho: recomenda **B** — moderno e amigável sem ser infantil.
Observação: __________

### Q11 — Densidade visual

- [ ] A) Espaçado / arejado (poucos itens, grandes)
- [x] B) Equilibrado
- [ ] C) Denso (muita info por tela, tipo Clashfinder)
- [ ] Outro: __________

Diferença: no meio da multidão, telas arejadas e toques grandes acertam mais; denso é melhor para "ver tudo de uma vez".
Conselho: recomenda **B, puxando para A** no on-site (uso de relance, uma mão). O timetable completo pode ter um **modo denso opcional** para quem ama ver a grade inteira.
Observação: __________

### Q12 — Efeitos especiais (pode marcar várias)

- [x] A) Glassmorphism (vidro fosco translúcido)
- [x] B) Gradientes
- [x] C) Camadas tonais (profundidade por tons)
- [x] D) Transições/animações suaves
- [x] E) Movimento ousado/celebratório (em momentos-chave)
- [ ] F) Manter chapado/flat
- [x] Outro: quero muito vidro, gosto de vidro, transparente, ccom blur, frosted, todos, gosto muito.

Conselho: recomenda **C + D**, com **E só em momentos especiais** (ex.: ao "lockar" o plano). Ressalva do Arquiteto: glass/gradiente pesado pode prejudicar performance e bateria — usar com parcimônia.
Observação: __________

### Q13 — Nível de movimento/animação

- [ ] A) Mínimo (quase estático)
- [x] B) Moderado (transições sutis)
- [x] C) Animado / gamificado (vivo, com celebração)
- [ ] Outro: __________

Conselho: recomenda **B no geral, C pontual** no Lock in (é a função-assinatura — merece um "momento"). Ressalva: respeitar "reduzir movimento" (acessibilidade/bateria).
Observação: __________

### Q14 — Imagem

- [x] A) Fotos de artista em destaque (visual rico)
- [ ] B) Ícones + tipografia (leve, rápido)
- [x] C) Mapa/ilustração no centro
- [x] D) Misto
- [ ] Outro: __________

Diferença: fotos engajam mas pesam (dados/bateria/offline); ícones são rápidos e funcionam offline.
Conselho: recomenda **D (misto): fotos na descoberta/favoritar, ícones+tipografia nas telas operacionais** (Now&Next, mapa). Ressalva: cachear imagens para o modo offline.
Observação: __________

---

## §3 — Navegação e tela inicial

### Q15 — Navegação principal

- [x] A) Barra de abas embaixo (padrão mobile)
- [ ] B) Hub inicial com cards (você entra e escolhe)
- [x] C) Deslizar entre seções (swipe)
- [x] D) Mapa como hub central
- [ ] Outro: __________

Conselho: recomenda **A (abas embaixo)** — padrão, alcançável com uma mão, previsível. Ressalva do Visionário: D (mapa-hub) é diferenciado no on-site — dá para ter o mapa como uma aba forte.
Observação: __________

### Q16 — Quais abas/seções? (pode marcar várias)

- [x] Início / "Agora"
- [x] Lineup
- [x] My Plan (meu cronograma)
- [x] Mapa
- [x] Grupo
- [ ] Buscar / Descobrir
- [ ] Perfil / Ajustes
- [ ] Outro: __________

Quantas abas no total? - [ ] 3  - [ ] 4  - [ ] 5
Conselho: recomenda **5: Início · Lineup · My Plan · Mapa · Grupo** (cobre os 3 pilares + on-site). Busca entra dentro de Lineup; Perfil no canto do Início.
Observação: __________

### Q17 — Conceito da tela inicial

- [x] A) "Agora & A seguir" (o que rola agora + seu próximo show + quando sair)
- [ ] B) Lineup primeiro (entra direto explorando)
- [ ] C) Feed personalizado (mistura de tudo)
- [ ] D) Foco único: "o que faço agora?"
- [ ] E) Mapa primeiro
- [x] Outro: eu gosto muito de manter o mapa também, talvez pode ter uma configuração que o user é perguntado se ele prefere o mapa na frente ou não quando o festival inicicar, pois acho que com o festival rolando talvez o mapa se torne a ferramenta mais usada? n sei ver com o conselho.

Diferença: muda o que o app prioriza no segundo em que você abre.
Conselho: recomenda **A (Agora & A seguir)** — é o maior valor no local e mostra o trabalho do "Lock in" rendendo. Antes do festival, essa tela vira "faltam X dias / monte seu plano". Ressalva: precisa de um bom estado "ainda não começou".
Observação: __________

### Q18 — Primeiro uso / onboarding

- [x] A) Deslizar para favoritar (estilo Tinder) já de cara
- [ ] B) Navegar o lineup e ir favoritando
- [x] C) "Escolha seus imperdíveis" (top artistas rápido)
- [x] D) Importar/pular e explorar depois
- [ ] Outro: __________

Conselho: recomenda **A ou C** para criar valor em segundos (favoritos viram o motor do Lock in e do grupo). Ressalva do Advogado: ofereça "pular" sempre; nem todo mundo quer onboarding longo. Observação: tem que deixar claro que é para escolher todos que ele veria no festival que depois vamos escolher realmente todos os que vão ficar fechados para o lone, mas para escoler no incio, se ele veria ou não veria o set do DJ...  ah e tem Djs que tocam em varios dias, tem que aparecer só uma vez no veria ou não varia, mesmo tocando só um dia..

---

## §4 — Pilar 1: Favoritos / explorar lineup

### Q19 — Layout para explorar o lineup

- [ ] A) Grade de timetable (palcos × horas, tipo Clashfinder)
- [ ] B) Lista por palco
- [ ] C) Lista por horário
- [ ] D) Cards de descoberta de artista (um por vez)
- [ ] E) Busca primeiro
- [ ] Outro: __________

Diferença: grade mostra conflitos visualmente; listas/cards são mais leves no celular.
Conselho: recomenda **B/C como padrão no mobile + A como "modo grade" opcional** (a grade completa é incrível, mas aperta numa tela pequena). Cards (D) ótimos no onboarding. Observação: fazer como no app do tomorrowland, é uma grade com o horario continuo do festival as linhas são os palcos e o user vai rolando para os lados e para baixo e para cima para navegar, para ver o timetable com varios palcos tem que ser assim, agora, quandoe srtivermos falando do timetable fechado que vai ter só uma linha, ai n precisa ser assim, pode ser mais simples pois só vai ter uma linha que é a linha unica que estamos decidindo..

### Q20 — Como favoritar

- [x] A) Tocar no coração/estrela
- [x] B) Deslizar cards (swipe)
- [ ] C) Pressionar e segurar
- [x] D) Pela página do artista
- [ ] Outro: __________

Conselho: recomenda **A (toque) em todo lugar + B (swipe) no onboarding**. Simples e descobrível.
Observação: __________

### Q21 — Ajuda para descobrir artistas (pode marcar várias)

- [x] A) Filtros por gênero
- [ ] B) "Artistas parecidos" pode pegar por genero
- [ ] C) Populares / em alta
- [ ] D) Nada — só o lineup puro
- [ ] Outro: __________

Conselho: recomenda **A (gênero)** como base barata e útil; B/C são ótimos mas podem ficar para V1.x. Ressalva: "em alta" exige dados de uso que ainda não temos.
Observação: __________

---

## §5 — Pilar 2: "Lock in" (a função-assinatura)

### Q22 — Como apresentar a resolução de conflito

- [x] A) Tela cheia 1-contra-1 (duelo de cards: A ou B?)
- [ ] B) Lista com "selos de conflito" para resolver um a um
- [ ] C) Calendário: arrastar para escolher
- [x] D) Estilo "stories": deslizar decisões
- [x] E) Chave de torneio (vai eliminando)
- [ ] Outro: __________

Diferença: é o coração gamificado — 1v1 cria foco e "jogo"; lista é mais utilitária; stories é fluido.
Conselho: recomenda **A (duelo 1v1 em tela cheia)** — foco total numa decisão por vez, casa com a ideia de "passar conflito por conflito" e rende uma celebração no fim. Ressalva do Crítico: ofereça um atalho "ver lista / pular" para quem tem muitos conflitos e quer agilidade.
Observação: __________

### Q23 — Quão "gamificado"?

- [ ] A) Sério e rápido (sem firula)
- [x] B) Levemente lúdico (microanimações, um "feito!")
- [x] C) Jogo completo (progresso, comemoração, talvez streak)
- [ ] Outro: __________

Conselho: recomenda **B, com um momento C no final** ("Seu plano está fechado!"). Ressalva: gamificação demais pode irritar o usuário apressado no local.
Observação: __________

### Q24 — Que info mostrar na hora de decidir (pode marcar várias)

- [x] A) Gênero + horário (o básico)
- [ ] B) + Popularidade do artista
- [x] C) + "Quem do seu grupo vai nesse"
- [x] D) + Uma frase/contexto sobre o artista/set
- [ ] Outro: __________

Conselho: recomenda **A + D** no V1 (decisão informada sem depender de dados que não temos). C é poderosíssimo mas depende do grupo já montado (Fase 4).  Observação: sim, fazer o c só se tiver grupo já, bom para usar em outras partes do app no futuro

### Q25 — Editor de "set parcial / sair mais cedo"

- [x] A) Arrastar alças numa linha do tempo
- [ ] B) Seletor de horário (digitar/escolher hora)
- [x] C) Sugestões em chips ("sair 19:30 → ir pro palco B")
- [ ] D) Avançado — esconder por padrão
- [ ] Outro: __________

Diferença: arrastar é intuitivo e visual; chips guiam; "avançado escondido" mantém a tela simples.
Conselho: recomenda **C (chips sugeridos) + A (arrastar) para ajuste fino**, escondido atrás de "dividir set". Ressalva: precisa do tempo de caminhada (Fase 3) para validar; até lá, fica como estimativa.
Observação: __________

### Q26 — Visual do "My Plan" (cronograma fechado)

- [x] A) Linha do tempo vertical (rolar o dia)
- [ ] B) Grade de agenda do dia
- [ ] C) Pilha de cards (um slot por vez)
- [ ] D) Ligado ao mapa (mostra a rota)
- [ ] Outro: __________

Conselho: recomenda **A (timeline vertical)** — natural no celular, fácil de bater o olho. D é um ótimo "modo extra". Observação: fazer a linha do tempo colocando os horarios bonitinho, inccluindo oss tempso de deslocamento e tudo mais, pensar também se o user n quero colocar tempo para comer, para banheiro, pegar bebida...

---

## §6 — Pilar 3: Mapa, presença e pontos de encontro

### Q27 — Estilo do mapa

- [ ] A) Mapa real (tiles de mapa, ruas)
- [x] B) Mapa ilustrado/estilizado do festival
- [ ] C) Esquemático/abstrato (bolhas de palco + caminhos)
- [ ] Outro: __________

Diferença: mapa real é preciso mas "frio" e pode poluir; ilustrado/esquemático é mais claro para "onde fica o palco X".
Conselho: recomenda **B (ilustrado/estilizado)** com posições reais por baixo — clareza > realismo num campo aberto. Ressalva do Arquiteto: ilustração custa mais; começar com C (esquemático) é mais barato e já resolve. Observação: podemos usar a Ia, pegamos o local e o mapa real do festival, e com a Ia trabalhamos e criamoos algo SVG com as caracteristicas do mapa real do festival mas feito para conseguirmos utilizar bem dar zoom, ver tudo que precisa, no tema do festival ai entra a Ia e o que ja temos em uso do groq para fazer o que precisamos..

### Q28 — Como mostrar a presença do grupo

- [x] A) Avatares no mapa
- [x] B) Lista agrupada por palco ("MAINSTAGE: Thales, Andy…")
- [x] C) "Radar"/proximidade
- [ ] D) Cards por pessoa
- [ ] Outro: __________

Diferença: lembrando que a presença é **grosseira/honesta** (por palco, com confiança), não GPS exato.
Conselho: recomenda **B (lista por palco) como base + A (avatares no mapa) como visão complementar**. Casa com o modelo "coarse" e é honesto. Ressalva: deixar claro o nível de certeza ("perto de", "entre A e B"). Observação: radar também quando a propria pessoa liberar a função de precisão de localização para ser encontrada ou coisas do tipo..

### Q29 — "Onde está todo mundo?"

- [ ] A) Botão que dispara um push e cada um responde com 1 toque
- [ ] B) Quadro de presença sempre visível
- [x] C) Os dois
- [ ] Outro: __________

Conselho: recomenda **C** — quadro passivo para olhar quando quiser + botão ativo para "chamar todo mundo agora". Ressalva: o push interativo é o diferencial; priorizar A se tiver que escolher.
Observação: __________

### Q30 — Ponto de encontro ("estou aqui, vem")

- [x] A) Pin no mapa + foto + nota (card)
- [x] B) Seta/bússola em tela cheia (distância + direção)
- [ ] C) Lista simples
- [ ] Outro: __________

Conselho: recomenda **A + B juntos** — cria o ponto com foto (A), e para chegar usa a seta+distância (B), que funciona melhor que mapa no meio da multidão. Ressalva: coordenada exata só sai com intenção explícita (privacidade).
Observação: __________

### Q31 — Quadro do grupo (avisos/recados fixados)

- [x] A) Lista de notas fixadas (pinned)
- [ ] B) Feed (cronológico)
- [ ] C) Faixa fixa no topo (1 aviso por vez)
- [ ] D) Mínimo / quase escondido
- [ ] Outro: __________

Conselho: recomenda **A (notas fixadas)** — é o que foi decidido (DEC-013): leve, sem virar chat. Ressalva: limitar tamanho/quantidade para não virar mural bagunçado. Observação: mas n sei pra que vai usar então, n sei sobre essa função, precisa? faz sentido?

### Q32 — "Agora & A seguir" + tempo de caminhada

- [x] A) Um card grande único (só o mais importante agora)
- [ ] B) Dois: "agora" + "a seguir"
- [x] C) Contagem regressiva em destaque ("saia em 8 min")
- [ ] D) Faixa fixa no topo de todas as telas
- [ ] Outro: __________

Conselho: recomenda **B + C** — mostra "agora" e "próximo", com a contagem de "quando sair" em evidência (usa o tempo de caminhada da Fase 3). Ressalva: não poluir; a contagem só aparece quando for relevante.
Observação: __________

---

## §7 — Voz e textos (microcopy)

### Q33 — Tom dos textos

- [x] A) Hype / gíria de festival ("Bora!", "Seu set tá on")
- [x] B) Amigável e caloroso
- [ ] C) Neutro e claro
- [ ] D) Mínimo (quase sem texto)
- [ ] Outro: __________

Conselho: recomenda **B com pitadas de A** — caloroso e claro, com energia nos momentos certos. Ressalva: gíria demais envelhece rápido e atrapalha tradução.
Observação: __________

### Q34 — Idioma

- [ ] A) Português primeiro
- [ ] B) Inglês primeiro
- [x] C) Bilíngue (PT/EN), troca fácil
- [ ] Outro: __________

Conselho: para Tomorrowland (público internacional), **C** é o ideal; se o foco inicial é Brasil, comece em **A** com arquitetura pronta para i18n.
Observação: __________

---

## §8 — Contexto e restrições

### Q35 — Legibilidade sob sol forte

- [x] A) Crítico (alto contraste obrigatório)
- [ ] B) Importante
- [ ] C) Bom ter
- [ ] Outro: __________

Conselho: recomenda **A** — é um app de campo aberto; isso influencia cor, contraste e a decisão de modo claro.
Observação: __________

### Q36 — Uso com uma mão

- [x] A) Crítico (tudo alcançável com o polegar)
- [ ] B) Importante
- [ ] C) Bom ter
- [ ] Outro: __________

Conselho: recomenda **A** — ações principais na metade de baixo da tela; reforça "abas embaixo".
Observação: __________

### Q37 — Sensibilidade à bateria

- [x] A) Muito (preferir escuro, pouco movimento, pouca imagem)
- [ ] B) Alguma
- [ ] C) Pouca
- [ ] Outro: __________

Conselho: recomenda assumir **A/B** — festival = dia longe da tomada; pesa a favor de escuro + movimento contido + cache offline. Observação: muito importante, até para localização, precisa ser algo muito otimizado para não usar bateria, n tem que ficar o tempo todo atualizzando, tem que ser inteligente, quando abrir o app ok, atualizar, e n precisa ser o tempo todo, atualiza por outros pontos, n sei, tenta puxar uma localização mais barata que gps, e se estiver muito fora de onde estava ai sim atualiza com o gps, tem que ser inteligente, background tambem atualizar as vezes, mas de alguma forma se perceber que está andando ai sim atualizar mais.. focar muito nessa economia de bateria, é primordial..

### Q38 — Acessibilidade

- [x] A) Seguir WCAG AA (contraste, toques grandes, leitor de tela)
- [ ] B) Melhor esforço
- [ ] Outro: __________

Conselho: recomenda **A** — além de inclusivo, alto contraste e toques grandes ajudam TODO MUNDO no sol e na multidão.
Observação: __________

### Q39 — "Cara" da plataforma

- [ ] A) Nativo (parece app de iOS/Android)
- [x] B) Marca própria em tudo (mesma cara nos dois)
- [ ] C) Cara de web app
- [ ] Outro: __________

Conselho: recomenda **B (marca própria) respeitando gestos/padrões nativos** — identidade forte, mas familiar. Como é PWA→Capacitor, B é coerente.
Observação: __________

---

## §9 — Inspirações

### Q40 — Apps cuja "vibe" você curte (pode marcar várias)

- [x] Spotify
- [ ] Apple Music
- [x] App oficial Tomorrowland
- [ ] Clashfinder
- [ ] DICE
- [ ] Resident Advisor (RA)
- [ ] Instagram
- [ ] BeReal
- [x] Snapchat (Map)
- [x] Citymapper
- [ ] Strava
- [ ] Things / Linear (organizadores)
- [ ] Outro: __________

Para cada uma marcada, **o que você gosta nela?** __________________________________________

### Q41 — Apps cuja "vibe" você quer EVITAR

Resposta: nada de apps, datados, nada de apps com cara de IA.

### Q42 — Qualquer outra coisa: padrões de UI que você ama, ideias soltas, "tem que ter"

Resposta: tem que ter animações suaves quando mexe no app, naturais, transições.. gosto muito de vidro, tem que ser um app com cara de alegria, festa, festival, mas sem ser IA..

---

---

---

# Depois que você responder

1. Eu leio tudo e escrevo sua **"UI DNA"** (um resumo do seu gosto em parâmetros concretos: cor, tipografia, densidade, navegação, tom).
2. Proponho **2–3 direções nomeadas** (ex.: "Planner Neon", "Pôster Claro", "Mapa-Companheiro") — cada uma fiel ao que você marcou, com prós/contras e o veredito do conselho.
3. Você escolhe uma; eu gero **protótipos visuais** (telas em HTML que parecem o app real) e abrimos **opções dentro daquela direção** (variações de layout das telas-chave: Início, Lineup, Lock in, Mapa, Grupo).

> Fonte da verdade: este estudo alimenta o futuro `design-system.md` (skill `app-design`). Decisões de produto continuam no `decision-log.md`.

