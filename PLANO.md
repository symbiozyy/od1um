# ODIUM — planejamento do site

Produtora de áudio e som: beats, produção musical, captação e direção vocal,
mix & master, mentoria de lançamento e audiovisual (capas e identidade visual).

## 1. Direção de arte

- **Base:** preto quase puro (`#080908`) com grão de filme por cima. O logo é o herói.
- **Cores tiradas do logo:**
  - verde ácido `#659B14`, com brilho `#B9E064` e sombra `#234B00`
  - cromado: degradê de `#F4F4F2` a `#8A8C8A`, como nas chamas do logo
- **Tipografia:**
  - títulos: Anton (condensada, pesada, cartaz de show)
  - texto: Space Grotesk
  - rótulos, preços e tempos: JetBrains Mono, como num painel de estúdio
- **Linguagem visual:**
  - texto cromado com degradê metálico
  - bordas de "rack" de estúdio
  - formas de onda e marcações de tempo (BPM, 00:00)
  - chamas pontiagudas como divisores

## 2. Personalidade de movimento (skill motion-design)

- **Arquétipo:** *Energetic* nas interações, *Premium* nas revelações grandes.
  É agressivo, mas nunca barato.
- **Easing de assinatura:**
  - `expo.out` nas entradas
  - `power3.in` nas saídas
  - `sine.inOut` no movimento ambiente
- **Durações:**
  - rápida: 0,15 s (hover e clique)
  - padrão: 0,45 s (cards)
  - lenta: 0,9 s (revelações do herói)
- **Entrada padrão:** sobe 40 px e sai de uma máscara (clip), com stagger de 60 ms.
  O total de cada grupo fica abaixo de 500 ms.
- **Três camadas em cada cena:**
  - primária: título ou card
  - secundária: brilho cromado, contadores
  - ambiente: onda de áudio, grão, chamas tremulando
- **Acessibilidade:** com `prefers-reduced-motion`, tudo aparece pronto, sem
  movimento (`gsap.matchMedia`). Sem JavaScript, o conteúdo continua legível.

## 3. Estrutura da página

1. **Preloader:** o logo "aquece" (de cinza para verde), contador de 0 a 100 e
   barras de equalizador; sai com uma cortina.
2. **Navegação fixa:**
   - logo, links e botão "Orçamento"
   - menu em tela cheia no celular
   - esconde ao rolar para baixo e volta ao rolar para cima
3. **Herói:**
   - logo grande com chamas tremulando
   - frase de impacto revelada letra a letra (SplitText)
   - visualizador de áudio em canvas ao fundo, que reage ao mouse e ao player
   - indicador de rolagem
4. **Faixa rolante (marquee):** BEATS · MIX & MASTER · DIREÇÃO VOCAL · CAPAS ·
   IDENTIDADE VISUAL · MENTORIA. A velocidade reage à rolagem.
5. **Serviços:** 6 cards (Beats, Produção musical, Captação & direção vocal,
   Mix & Master, Mentoria de lançamento, Audiovisual), com brilho cromado que
   segue o mouse.
6. **Escultura 3D (Three.js, abordagem da skill img2threejs):**
   - o coração com coroa de chamas do logo, reconstruído em código: coração
     extrudado e chamas cromadas
   - fixado na tela e girando conforme a rolagem
   - carregado só quando a seção se aproxima
7. **Player de beats (funcional):**
   - loops tocáveis com play, pausa, troca de faixa, barra de progresso e
     visualizador
   - os loops de demonstração são sintetizados ao vivo com Web Audio (808,
     kick, caixa, hi-hats)
   - basta preencher `src` com um arquivo de áudio para tocar beats reais
8. **Processo:** 4 etapas (Briefing → Produção → Captação & Mix → Lançamento),
   com rolagem horizontal fixada no desktop e lista vertical no celular.
9. **Orçamentos (área de preços):**
   - Beat: 50 (apenas o beat aberto)
   - Beat Completo: 100 (por referências ou construção própria, com mix e master)
   - Captação: 100 (preparação vocal e direção de vocal)
   - Mix & Master: 150 (projetos prontos, só para finalizar)
   - Pacote Completo: 300 (captação de voz, beat e mix & master), em destaque
   - Capa e identidade visual: a partir de 100
   - Mentoria de lançamento: sob consulta
10. **Monte seu orçamento (calculadora):**
    - escolher serviços e quantidade de faixas, com total animado
    - sugestão automática do Pacote Completo quando a combinação compensa
    - formulário (nome, nome artístico, referência, prazo, mensagem)
    - envio de tudo pelo WhatsApp com a mensagem pronta, mais o botão "Copiar
      pedido"
11. **Chamada final + rodapé:** a chamada final traz o logo de novo; o rodapé
    tem contatos e "voltar ao topo".

## 4. Técnica

- Site estático, sem build, pronto para o GitHub Pages: `index.html` com
  CSS e JS no próprio arquivo.
- Bibliotecas copiadas para `vendor/`, assim o site não depende de CDN:
  - GSAP 3.13 (core, ScrollTrigger, SplitText)
  - Three.js r160
- Configuração editável no topo do script (`CONFIG`):
  - WhatsApp, Instagram, e-mail
  - moeda
  - preços
  - faixas do player
- **Desempenho:**
  - animações só em `transform` e `opacity`
  - canvas pausado fora da tela
  - Three.js carregado sob demanda
  - qualidade reduzida no celular
- **Responsividade:** de 360 px até telas grandes, sem rolagem horizontal da
  página.

## 5. Verificação

- Testes no Chromium (Playwright), em desktop (1440 px) e celular (390 px):
  - sem erros no console
  - player toca
  - calculadora soma certo
  - link do WhatsApp com a mensagem completa
  - reduced-motion ok
- Capturas de tela de cada seção para revisão visual.

## 6. Como editar

- **Contatos e moeda:** objeto `CONFIG` no topo de `app.js`:
  - `whatsapp`: DDI + DDD + número, só dígitos
  - `instagram`
  - `email`
  - `currency`
- **Preços:** atributos `data-price` de cada card em `index.html`. Mude
  também o número que aparece no card (`data-num`). A calculadora lê os valores
  direto dos cards.
- **Beats reais:** em `CONFIG.tracks`, preencha `src` com o caminho do áudio
  (ex.: `beats/toxic.mp3`). Sem `src`, toca o loop sintetizado.
- **Testar localmente:** `npx http-server .` e abrir `http://localhost:8080/`. Para carregar a
  escultura 3D, o site precisa rodar num servidor; abrir o arquivo direto no
  navegador não funciona.
