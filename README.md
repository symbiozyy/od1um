# ODIUM

Site da ODIUM, produtora de áudio e som: beats, produção musical, captação e
direção vocal, mix & master, mentoria de lançamento, capas e identidade visual.

- `index.html`: página (HTML e CSS)
- `app.js`: animações, player, calculadora de orçamento e envio pelo WhatsApp
- `sculpture.js`: escultura 3D do logo (Three.js)
- `404.html`: página de erro personalizada, mostrada pelo GitHub Pages em endereços inexistentes
- `vendor/`: GSAP e Three.js
- `assets/`: logo, ícones, imagem de prévia e `capas/` (galeria de produções)
- `PLANO.md`: planejamento e como editar

Contatos, moeda, faixas do player, links do Spotify e clipes ficam no objeto
`CONFIG`, no topo de `app.js`.

Para testar localmente: `npx http-server .` e abrir `http://localhost:8080/`.
