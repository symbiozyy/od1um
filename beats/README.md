# Beats

Coloque aqui os beats que vão aparecer no player do site.

**Como subir:** no GitHub, abra esta pasta, clique em **Add file → Upload files**,
arraste os arquivos e clique em **Commit changes**.

- **Formato:** prefira **MP3** (carrega rápido no site). WAV costuma ser grande demais.
- **Tamanho:** até 25 MB por arquivo pelo navegador.
- **Depois de subir:** a faixa só aparece no player quando ganha uma linha em
  `CONFIG.tracks`, no topo de `app.js`, com título, BPM, duração e caminho
  (ex.: `{ id: 'fresh-lemon', title: 'FRESH LEMON', bpm: 140, dur: '2:30', src: 'beats/fresh-lemon.mp3' }`).
  Prefira nomes de arquivo sem espaços nem acentos.
