/* ODIUM: animações (GSAP + ScrollTrigger + SplitText), player Web Audio,
   calculadora de orçamento e envio pelo WhatsApp. */
(() => {
  'use strict';

  // ── Configuração: edite aqui ─────────────────────────────────────────────
  const CONFIG = {
    // WhatsApp com DDI + DDD + número, só dígitos (ex.: "5511999999999").
    // Vazio: o link abre o WhatsApp para escolher o contato.
    whatsapp: '5511977528934',
    instagram: '',   // usuário sem @ (ex.: "odium")
    email: '',
    currency: 'R$',  // ex.: "R$" ou "US$"
    // Beats do player (arquivos na pasta beats/). `dur` é a duração mostrada na lista.
    tracks: [
      { id: 'tezzus', title: 'TEZZUS', bpm: 140, dur: '2:31', src: 'beats/tezzus.mp3' },
      { id: 'young-nudy', title: 'YOUNG NUDY', bpm: 140, dur: '2:31', src: 'beats/young-nudy.mp3' },
      { id: 'drill-uk-medieval', title: 'DRILL UK MEDIEVAL', bpm: 141, dur: '2:37', src: 'beats/drill-uk-medieval.mp3' },
      { id: 'blend', title: 'BLEND', bpm: 145, dur: '2:12', src: 'beats/blend.mp3' },
      { id: 'jerk-drill-ny', title: 'JERK DRILL NY', bpm: 146, dur: '2:38', src: 'beats/jerk-drill-ny.mp3' },
      { id: 'diamond', title: 'DIAMOND', bpm: 157, dur: '2:02', src: 'beats/diamond.mp3' },
      { id: 'yeh-yeh', title: 'YEH YEH', bpm: 192, dur: '2:00', src: 'beats/yeh-yeh.mp3' },
    ],
    // Músicas produzidas pela ODIUM: cole o link de compartilhamento do Spotify.
    spotify: [
      'https://open.spotify.com/track/0Y0h17YOwW9qK306XMAsrw',
      'https://open.spotify.com/track/5Yy1DZPDTJQ545WnuKH9jS',
      'https://open.spotify.com/track/1qH0oACa3x9k0WxfPADuD9',
      'https://open.spotify.com/track/2UoK7FpvVBzXr2E26MGPAd',
      'https://open.spotify.com/track/5TSiqeBeOznRSgiCAsDWho',
    ],
    // Clipes: link do YouTube ou arquivo de vídeo próprio. Vazio esconde a seção.
    // Ex.: { title: 'Nome do clipe', youtube: 'https://youtu.be/XXXXXXXXXXX' }
    //      { title: 'Nome do clipe', src: 'videos/clipe.mp4', poster: 'videos/capa.jpg' }
    videos: [
      { title: '', youtube: 'https://www.youtube.com/watch?v=OK1iIq3l8oU' },
      { title: '', youtube: 'https://www.youtube.com/watch?v=7Ql6cK3SWOc' },
      { title: '', youtube: 'https://www.youtube.com/watch?v=lLHIQOyoLhE' },
      { title: '', youtube: 'https://www.youtube.com/watch?v=3HmsW286xEw' },
      { title: '', youtube: 'https://www.youtube.com/watch?v=CWYTnLPrp5A' },
    ],
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isMobile = () => innerWidth < 760;

  gsap.registerPlugin(ScrollTrigger, SplitText, ScrollToPlugin);
  // Personalidade de movimento: energética nas interações, premium nas revelações
  gsap.defaults({ ease: 'expo.out', duration: 0.45 });

  const money = (n) => CONFIG.currency + (CONFIG.currency.length > 1 ? ' ' : '') + n.toLocaleString('pt-BR');
  $$('[data-money]').forEach((el) => { el.textContent = CONFIG.currency; });
  $('[data-year]').textContent = new Date().getFullYear();

  // ── Contatos ─────────────────────────────────────────────────────────────
  const waLink = (text) => {
    const q = text ? '?text=' + encodeURIComponent(text) : '';
    return CONFIG.whatsapp ? `https://wa.me/${CONFIG.whatsapp}${q}` : `https://wa.me/${q}`;
  };
  $('[data-wa-direct]').href = waLink('Olá, ODIUM! Quero fazer um som com vocês.');
  const contacts = $('[data-contacts]');
  const addContact = (label, href) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = href; a.textContent = label;
    if (href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; }
    li.appendChild(a); contacts.appendChild(li);
  };
  addContact('WhatsApp', waLink('Olá, ODIUM!'));
  if (CONFIG.instagram) addContact('@' + CONFIG.instagram, 'https://instagram.com/' + CONFIG.instagram);
  if (CONFIG.email) addContact(CONFIG.email, 'mailto:' + CONFIG.email);

  // ── Toast ────────────────────────────────────────────────────────────────
  const toastEl = $('[data-toast]');
  let toastTl;
  function toast(msg) {
    $('[data-toast-text]').textContent = msg;
    toastTl && toastTl.kill();
    toastTl = gsap.timeline()
      .fromTo(toastEl, { yPercent: 140 }, { yPercent: 0, duration: 0.5, ease: 'back.out(1.6)' })
      .fromTo($('path', toastEl), { strokeDashoffset: 24 }, { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' }, '-=0.2')
      .to(toastEl, { yPercent: 140, duration: 0.3, ease: 'power3.in', delay: 2.2 });
  }
  gsap.set(toastEl, { xPercent: -50, yPercent: 140 });

  // ════════════════════════════════════════════════════════════════════════
  // ÁUDIO: toca os beats e alimenta o analisador dos visualizadores
  // ════════════════════════════════════════════════════════════════════════
  const Engine = (() => {
    let ctx, master, analyser, freq, wave;
    let playing = false, pending = false, req = 0, track = null, volume = 0.8, endedCb = null;
    const media = new Map();

    function init() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = volume;
      analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.78;
      master.connect(analyser); analyser.connect(ctx.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
      wave = new Uint8Array(analyser.fftSize);
    }

    function getMedia(t) {
      if (!media.has(t.id)) {
        const el = new Audio();
        el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.src = t.src;
        const node = ctx.createMediaElementSource(el);
        node.connect(master);
        el.addEventListener('ended', () => {
          if (track && track.id === t.id) { playing = false; endedCb && endedCb(); }
        });
        media.set(t.id, { el, node });
      }
      return media.get(t.id);
    }
    const el = () => (track && media.has(track.id) ? media.get(track.id).el : null);
    // Vários visualizadores pedem o espectro a cada quadro: lê o analisador uma vez só
    let sampledFrame = -1;
    function sampleFreq() {
      if (sampledFrame === gsap.ticker.frame) return;
      sampledFrame = gsap.ticker.frame;
      analyser.getByteFrequencyData(freq);
    }

    function pauseCurrent() {
      const e = el();
      if (e) e.pause();
      playing = false;
    }

    // Mesma faixa: continua de onde parou. Outra faixa: começa do início.
    // Cada chamada recebe um número; se outra chamada (ou um stop) vier antes de
    // o áudio carregar, esta desiste em silêncio e retorna false.
    async function play(t) {
      const my = ++req;
      pending = true;
      init();
      if (ctx.state === 'suspended') await ctx.resume();
      if (my !== req) return false;
      const same = track && track.id === t.id;
      pauseCurrent();
      track = t;
      const m = getMedia(t);
      if (!same || m.el.ended) m.el.currentTime = 0;
      try {
        await m.el.play();
      } catch (e) {
        if (my !== req || e.name === 'AbortError') return false;
        pending = false;
        throw e;
      }
      if (my !== req) return false;
      pending = false;
      playing = true;
      return true;
    }

    function stop() {
      req++;
      pending = false;
      pauseCurrent();
    }

    return {
      play, stop,
      get playing() { return playing; },
      // Tocando ou carregando para tocar: para a interface, conta como "tocando"
      get busy() { return playing || pending; },
      get trackId() { return track ? track.id : null; },
      set onEnded(fn) { endedCb = fn; },
      setVolume(v) { volume = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02); },
      seek(ratio) { const e = el(); if (e && e.duration) e.currentTime = Math.min(e.duration - 0.05, Math.max(0, ratio * e.duration)); },
      nudge(sec) { const e = el(); if (e && e.duration) e.currentTime = Math.min(e.duration - 0.05, Math.max(0, e.currentTime + sec)); },
      elapsed() { const e = el(); return e ? e.currentTime : 0; },
      progress() { const e = el(); return e && e.duration ? e.currentTime / e.duration : 0; },
      // Energia dos graves (0 a 1) para o coração 3D e o fundo do herói pulsarem
      level() {
        if (!playing || !analyser) return 0;
        sampleFreq();
        let sum = 0; for (let i = 1; i < 12; i++) sum += freq[i];
        return Math.max(0, (sum / 11 / 255 - 0.35) / 0.65);
      },
      spectrum() { if (!analyser) return null; sampleFreq(); return freq; },
      waveform() { if (!analyser) return null; analyser.getByteTimeDomainData(wave); return wave; },
    };
  })();

  // Coordenador de reprodução: só um áudio toca por vez (beat, Spotify, YouTube ou MP4)
  const Playback = (() => {
    const pausers = new Map();
    const active = new Set();
    return {
      register(key, pause) { pausers.set(key, pause); },
      // Quem começa a tocar chama claim: tudo o que estava tocando é pausado
      claim(key) {
        [...active].forEach((k) => {
          if (k === key) return;
          active.delete(k);
          try { pausers.get(k)?.(); } catch (e) { /* player já destruído */ }
        });
        active.add(key);
      },
      release(key) { active.delete(key); },
    };
  })();

  let audioLevel = 0;
  gsap.ticker.add(() => { audioLevel = Engine.level(); });

  // ════════════════════════════════════════════════════════════════════════
  // PRELOADER + INTRO DO HERÓI
  // ════════════════════════════════════════════════════════════════════════
  function heroIntro() {
    if (reduced) {
      // Movimento reduzido: só fades, sem deslocamento nem escala
      return gsap.timeline({ defaults: { ease: 'power1.out', duration: 0.5 } })
        .fromTo('[data-hero-logo]', { opacity: 0 }, { opacity: 1 })
        .fromTo('[data-hero-title]', { opacity: 0 }, { opacity: 1 }, 0.15)
        .fromTo('[data-hero]', { opacity: 0 }, { opacity: 1, stagger: 0.08 }, 0.3);
    }
    // Divide o título só depois das fontes carregarem; o degradê vai para cada letra
    const heroTitle = $('[data-hero-title]');
    const titleSplit = SplitText.create(heroTitle.querySelectorAll('.line'), { type: 'chars', charsClass: 'ch' });
    titleSplit.chars.forEach((c) => {
      c.classList.add(c.closest('.line').classList.contains('acid-text') ? 'acid-text' : 'chrome-text');
      c.style.display = 'inline-block';
    });
    const lines = [...heroTitle.querySelectorAll('.line')];
    lines.forEach((l) => {
      l.dataset.grad = l.classList.contains('acid-text') ? 'acid-text' : 'chrome-text';
      l.classList.remove('chrome-text', 'acid-text');
    });
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('[data-hero-logo]', { scale: 0.86, opacity: 0, filter: 'blur(18px) brightness(2)' },
      { scale: 1, opacity: 1, filter: 'blur(0px) brightness(1)', duration: 1.2 })
      .fromTo(titleSplit.chars, { yPercent: 110, rotate: 6, opacity: 0 },
        { yPercent: 0, rotate: 0, opacity: 1, duration: 0.9, stagger: 0.035 }, 0.35)
      .fromTo('[data-hero]', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, 0.55)
      .add(() => { titleSplit.revert(); lines.forEach((l) => l.classList.add(l.dataset.grad)); });
    return tl;
  }

  function startFlames() {
    if (reduced) return;
    // Chamas do logo respiram a partir da base da coroa; o brilho pulsa com o grave
    gsap.to('.logo-flames', { scaleY: 1.035, skewX: 0.8, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.to('.logo-flames', { scaleX: 0.992, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    const glow = $('.logo-glow');
    gsap.ticker.add(() => { glow.style.opacity = (0.36 + audioLevel * 0.5).toFixed(3); });
    gsap.to('.logo-glow', { scale: 1.04, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  function runLoader() {
    const loader = $('.loader');
    if (reduced) {
      $('[data-count]', loader).textContent = '100';
      return new Promise((resolve) => {
        gsap.to(loader, { opacity: 0, duration: 0.4, delay: 0.35, ease: 'power1.out', onStart: resolve, onComplete: () => loader.remove() });
      });
    }
    const bars = $$('.loader-meter i', loader);
    const count = $('[data-count]', loader);
    const meter = gsap.to(bars, {
      scaleY: () => 0.3 + Math.random() * 0.7, duration: 0.18, ease: 'sine.inOut',
      stagger: { each: 0.04, repeat: -1, yoyo: true }, repeatRefresh: true,
    });
    const ready = Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      $('.logo-base').decode ? $('.logo-base').decode().catch(() => {}) : Promise.resolve(),
      new Promise((r) => setTimeout(r, 1300)),
    ]);
    const prog = { v: 0 };
    return new Promise((resolve) => {
      gsap.timeline()
        .to(prog, { v: 82, duration: 1.1, ease: 'power2.out', onUpdate: () => { count.textContent = String(Math.round(prog.v)).padStart(3, '0'); } })
        .to('.loader-logo', { filter: 'grayscale(0) brightness(1)', duration: 1.1, ease: 'power2.out' }, 0)
        .add(() => {
          ready.then(() => {
            gsap.timeline({ onComplete: () => { meter.kill(); loader.remove(); } })
              .to(prog, { v: 100, duration: 0.35, ease: 'power2.out', onUpdate: () => { count.textContent = String(Math.round(prog.v)).padStart(3, '0'); } })
              .to('.loader-inner', { scale: 1.08, opacity: 0, duration: 0.35, ease: 'power3.in' })
              .add(resolve)
              .to('.loader-half.top', { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, '<0.1')
              .to('.loader-half.bottom', { yPercent: 100, duration: 0.9, ease: 'expo.inOut' }, '<');
          });
        });
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // NAV, MENU, CURSOR, BOTÕES MAGNÉTICOS
  // ════════════════════════════════════════════════════════════════════════
  const nav = $('[data-nav]');
  let menuOpen = false;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > 40);
      if (menuOpen) return;
      nav.classList.toggle('is-hidden', self.direction === 1 && y > 400);
    },
  });
  // Link ativo conforme a seção na tela
  $$('.nav-links a').forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', toggleClass: { targets: a, className: 'is-active' } });
  });

  const burger = $('.nav-burger');
  const menu = $('#menu');
  const menuTl = gsap.timeline({ paused: true })
    .set(menu, { visibility: 'visible' })
    .fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.6, ease: 'expo.inOut' })
    .fromTo($$('a span', menu), { yPercent: 110 }, { yPercent: 0, duration: 0.6, stagger: 0.05 }, '-=0.25')
    .fromTo('.menu-foot', { opacity: 0 }, { opacity: 1, duration: 0.3 }, '-=0.3');
  function setMenu(open) {
    menuOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    menu.setAttribute('aria-hidden', String(!open));
    nav.classList.remove('is-hidden');
    document.body.style.overflow = open ? 'hidden' : '';
    // Com o menu aberto, o resto da página fica fora do alcance do Tab e dos leitores de tela
    ['#conteudo', '.footer'].forEach((sel) => { const el = $(sel); if (el) el.inert = open; });
    if (open) { menuTl.timeScale(1).play(); setTimeout(() => $('a', menu).focus(), 300); }
    else { menuTl.timeScale(1.6).reverse(); burger.focus({ preventScroll: true }); }
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));

  // Links internos (#beats, #orcamentos…): rolagem suave pelo GSAP. A rolagem suave
  // do CSS (scroll-behavior) atrapalha as medições do ScrollTrigger e fazia a seção
  // fixada do Processo aparecer por cima de outras seções.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip') || e.defaultPrevented) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const pin = id === '#processo' && ScrollTrigger.getAll().find((t) => t.pin === target);
    const y = id === '#inicio' ? 0 : pin ? pin.start : target;
    gsap.to(window, {
      scrollTo: { y, offsetY: id === '#inicio' || pin ? 0 : 72, autoKill: false },
      duration: reduced ? 0 : 1.1, ease: 'power3.inOut', overwrite: true,
    });
    history.pushState(null, '', id);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });
  addEventListener('resize', () => { if (menuOpen && innerWidth >= 960) setMenu(false); });

  const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.nx = (e.clientX / innerWidth) * 2 - 1; pointer.ny = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  if (finePointer && !reduced) {
    const dot = $('.cursor'), ring = $('.cursor-ring');
    const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.4, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.4, ease: 'power3' });
    addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const lab = e.target.closest('[data-cursor]');
      const hov = e.target.closest('a, button, input, select, textarea, label, .track');
      ring.classList.toggle('is-label', !!lab);
      ring.classList.toggle('is-hover', !lab && !!hov);
      if (lab) $('span', ring).textContent = lab.dataset.cursor === 'play' && lab.closest('[data-player]') ? (Engine.playing ? 'PAUSE' : 'PLAY') : lab.dataset.cursor.toUpperCase();
    });
    document.documentElement.addEventListener('mouseleave', () => gsap.to([dot, ring], { opacity: 0, duration: 0.2 }));
    document.documentElement.addEventListener('mouseenter', () => gsap.to([dot, ring], { opacity: 1, duration: 0.2 }));

    $$('.magnetic').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.28);
        yTo((e.clientY - r.top - r.height / 2) * 0.38);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  // Brilho que segue o mouse nos cards de serviço
  $$('.svc').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // VISUALIZADOR DO HERÓI (canvas 2D)
  // ════════════════════════════════════════════════════════════════════════
  (function heroViz() {
    const cv = $('.hero-viz');
    const cx = cv.getContext('2d');
    let w = 0, h = 0, dpr = 1, visible = true, t = 0;
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size(); addEventListener('resize', size);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cv);
    let lvl = 0;
    function draw() {
      if (!visible) return;
      t += reduced ? 0 : 0.012;
      lvl += (audioLevel - lvl) * 0.2;
      cx.clearRect(0, 0, w, h);
      const spec = Engine.playing ? Engine.spectrum() : null;
      const mid = h * 0.58;
      const mx = pointer.x, my = pointer.y;
      // Linhas de onda: verde (primária) e cromadas (secundárias)
      const layers = [
        { a: 46, f: 1.6, sp: 1.0, col: 'rgba(143,198,58,0.85)', lw: 2 },
        { a: 32, f: 2.3, sp: -0.7, col: 'rgba(199,201,197,0.35)', lw: 1.2 },
        { a: 22, f: 3.4, sp: 1.4, col: 'rgba(198,236,128,0.25)', lw: 1 },
      ];
      for (const L of layers) {
        cx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const u = x / w;
          const env = Math.sin(u * Math.PI);
          const near = Math.max(0, 1 - Math.hypot(x - mx, mid - my) / 380);
          let s = 0;
          if (spec) s = spec[Math.floor(4 + u * 120)] / 255;
          const amp = L.a * (0.45 + near * 1.3 + lvl * 1.8 + s * 1.2) * env;
          const y = mid + Math.sin(u * Math.PI * 2 * L.f + t * 3 * L.sp) * amp * Math.cos(u * 7 + t * L.sp);
          x ? cx.lineTo(x, y) : cx.moveTo(x, y);
        }
        cx.strokeStyle = L.col; cx.lineWidth = L.lw; cx.stroke();
      }
      // Espectro discreto no rodapé do herói
      const bars = Math.floor(w / 9);
      cx.fillStyle = 'rgba(143,198,58,0.16)';
      for (let i = 0; i < bars; i++) {
        const u = i / bars;
        const v = spec ? spec[Math.floor(2 + u * 180)] / 255 : (Math.sin(u * 22 + t * 4) * 0.5 + 0.5) * 0.25 * Math.sin(u * Math.PI);
        const bh = v * h * 0.22;
        cx.fillRect(i * 9, h - bh, 5, bh);
      }
    }
    if (reduced) { draw(); addEventListener('resize', draw); } else gsap.ticker.add(draw);
  })();

  // ════════════════════════════════════════════════════════════════════════
  // MARQUEE com velocidade ligada à rolagem
  // ════════════════════════════════════════════════════════════════════════
  $$('[data-marquee]').forEach((mq) => {
    const track = $('.marquee-track', mq);
    const group = $('.marquee-group', track);
    // Repete o grupo até cobrir duas larguras de tela
    while (track.scrollWidth < innerWidth * 2.2) track.appendChild(group.cloneNode(true));
    if (reduced) return;
    const dir = Number(mq.dataset.marquee);
    let x = 0, boost = 0, gw = group.offsetWidth, onScreen = true;
    addEventListener('resize', () => { gw = group.offsetWidth; });
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(mq);
    const setX = gsap.quickSetter(track, 'x', 'px');
    gsap.ticker.add((time, dt) => {
      if (!onScreen) return;
      x -= (0.06 + boost) * dt * dir;
      x = gsap.utils.wrap(-gw, 0, x);
      setX(x);
      boost *= 0.92;
    });
    ScrollTrigger.create({ trigger: mq, start: 'top bottom', end: 'bottom top', onUpdate: (s) => { boost = Math.min(0.9, Math.abs(s.getVelocity()) / 4000) * Math.sign(s.getVelocity() || 1); } });
  });

  // ════════════════════════════════════════════════════════════════════════
  // REVELAÇÕES NA ROLAGEM
  // ════════════════════════════════════════════════════════════════════════
  const mm = gsap.matchMedia();
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 960px)' }, (ctx) => {
    const { motion, desktop } = ctx.conditions;
    if (!motion) {
      // Movimento reduzido: conteúdo entra só com fade, sem deslocamento
      const fadeEls = '[data-split], [data-reveal], [data-card], .m-line, .step';
      const els = $$(fadeEls);
      gsap.set(els, { opacity: 0 });
      const io = new IntersectionObserver((entries) => {
        const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target);
        shown.forEach((el) => io.unobserve(el));
        if (shown.length) gsap.to(shown, { opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power1.out', overwrite: true });
      }, { rootMargin: '0px 0px -6% 0px' });
      els.forEach((el) => io.observe(el));
      return () => { io.disconnect(); gsap.set(els, { opacity: 1 }); };
    }

    // Títulos: linhas sobem de dentro da máscara. Divididos depois das fontes;
    // ao terminar, o HTML original volta (acentos e quebras de linha intactos).
    gsap.set('[data-split]', { opacity: 0 });
    fontsReady.then(() => ctx.add(() => {
      $$('[data-split]').forEach((el) => {
        const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'ln' });
        gsap.set(el, { opacity: 1 });
        gsap.from(split.lines, {
          yPercent: 115, duration: 0.9, stagger: 0.08, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          onComplete: () => split.revert(),
        });
      });
      ScrollTrigger.refresh();
    }));

    gsap.set('[data-reveal]', { y: 40, opacity: 0 });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%', once: true,
      onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, overwrite: true }),
    });

    gsap.set('[data-card]', { y: 60, opacity: 0, rotateX: -8, transformPerspective: 900, transformOrigin: '50% 100%' });
    ScrollTrigger.batch('[data-card]', {
      start: 'top 90%', once: true, interval: 0.1,
      onEnter: (els) => gsap.to(els, {
        y: 0, opacity: 1, rotateX: 0, duration: 0.9, stagger: 0.07, overwrite: true,
        clearProps: 'transform,transformPerspective',
      }),
    });

    // Contadores dos preços
    $$('[data-num]').forEach((el) => {
      const end = Number(el.dataset.num);
      const o = { v: 0 };
      el.textContent = '0';
      gsap.to(o, {
        v: end, duration: 1.2, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: () => { el.textContent = Math.round(o.v); },
      });
    });

    // Processo: rolagem horizontal fixada no desktop
    const proc = $('#processo');
    if (desktop) {
      proc.classList.add('is-horizontal');
      const trackEl = $('.process-track', proc);
      const dist = () => Math.max(0, trackEl.scrollWidth - innerWidth);
      const tween = gsap.to(trackEl, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: proc, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6, refreshPriority: 1,
          invalidateOnRefresh: true, anticipatePin: 1,
        },
      });
      gsap.to('.process-progress b', {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: proc, start: 'top top', end: () => '+=' + dist(), scrub: true, invalidateOnRefresh: true, refreshPriority: 1 },
      });
      $$('.step', proc).forEach((st) => {
        gsap.fromTo($('.step-bar', st), { scaleX: 0 }, {
          scaleX: 1, ease: 'none',
          scrollTrigger: { trigger: st, containerAnimation: tween, start: 'left 85%', end: 'right 60%', scrub: true },
        });
        gsap.from($('.step-num', st), {
          xPercent: 40, opacity: 0, duration: 0.8,
          scrollTrigger: { trigger: st, containerAnimation: tween, start: 'left 80%', toggleActions: 'play none none reverse' },
        });
      });
      return () => { proc.classList.remove('is-horizontal'); };
    }
    $$('.step', proc).forEach((st) => {
      gsap.fromTo($('.step-bar', st), { scaleX: 0 }, {
        scaleX: 1, ease: 'none', scrollTrigger: { trigger: st, start: 'top 85%', end: 'bottom 60%', scrub: true },
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // MANIFESTO + ESCULTURA 3D
  // ════════════════════════════════════════════════════════════════════════
  let sculpture = null, loadSculpture = () => {};
  (function manifesto() {
    const sec = $('#manifesto');
    const lines = $$('.m-line', sec);
    const bars = $$('.manifesto-progress b', sec);
    const canvas = $('.sculpture', sec);
    let lastP = 0;

    if (reduced) {
      // Sem movimento: as três frases ficam empilhadas e visíveis
      sec.querySelector('.manifesto-lines').classList.add('no-js-lines');
      bars.forEach((b) => gsap.set(b, { scaleX: 1 }));
    } else {
      gsap.set(lines, { yPercent: 40, opacity: 0, filter: 'blur(10px)' });
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut', duration: 1 },
        scrollTrigger: {
          trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.6,
          onUpdate: (s) => { lastP = s.progress; sculpture && sculpture.setProgress(s.progress); },
        },
      });
      lines.forEach((ln, i) => {
        tl.to(ln, { yPercent: 0, opacity: 1, filter: 'blur(0px)', ease: 'expo.out' }, i * 2)
          .to(bars[i], { scaleX: 1, ease: 'none', duration: 2 }, i * 2);
        if (i < lines.length - 1) tl.to(ln, { yPercent: -40, opacity: 0, filter: 'blur(10px)', ease: 'power3.in', duration: 0.5 }, i * 2 + 1.6);
      });
      tl.to({}, { duration: 0.6 });
    }

    // Three.js carrega quando o navegador fica ocioso depois da abertura,
    // ou antes disso se a seção se aproximar
    let started = false;
    loadSculpture = () => {
      if (started) return;
      started = true;
      io.disconnect();
      import('./sculpture.js')
        .then((m) => m.mount(canvas, { reduced, mobile: isMobile() }))
        .then((s) => {
          if (!s) throw new Error('webgl');
          sculpture = s;
          sculpture.setProgress(lastP);
          gsap.ticker.add(() => {
            sculpture.setPointer(pointer.nx, pointer.ny);
            sculpture.setLevel(audioLevel);
          });
          gsap.from(canvas, { opacity: 0, scale: 0.92, duration: 1.4, ease: 'expo.out' });
        })
        .catch(() => { sec.classList.add('no-webgl'); });
    };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) loadSculpture(); }, { rootMargin: '1200px 0px' });
    io.observe(sec);
  })();

  // ════════════════════════════════════════════════════════════════════════
  // PLAYER
  // ════════════════════════════════════════════════════════════════════════
  (function player() {
    const root = $('[data-player]');
    const list = $('[data-tracks]', root);
    const playBtn = $('[data-play]', root);
    const screen = $('.deck-screen', root);
    const scope = $('[data-scope]', root);
    const sx = scope.getContext('2d');
    let cur = 0;

    if (CONFIG.tracks.every((t) => t.src)) $('[data-note]', root).hidden = true;

    CONFIG.tracks.forEach((t, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<button class="track" type="button" data-i="${i}">
        <span class="track-idx">${String(i + 1).padStart(2, '0')}</span>
        <span><span class="track-name"></span><span class="track-meta"></span></span>
        <span class="track-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>`;
      $('.track-name', li).textContent = t.title;
      $('.track-meta', li).textContent = `${t.bpm} BPM · ${t.dur}`;
      list.appendChild(li);
    });
    const btns = $$('.track', list);

    function show(i) {
      cur = (i + CONFIG.tracks.length) % CONFIG.tracks.length;
      const t = CONFIG.tracks[cur];
      btns.forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
      const title = $('[data-title]', root);
      $('[data-meta]', root).textContent = `Beat ODIUM · ${t.dur}`;
      $('[data-bpm]', root).textContent = `${t.bpm} BPM`;
      if (title.textContent !== t.title) {
        gsap.timeline()
          .to(title, { yPercent: -30, opacity: 0, duration: 0.15, ease: 'power3.in', onComplete: () => { title.textContent = t.title; } })
          .fromTo(title, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.4 });
      }
    }

    function setPlaying(on) {
      root.classList.toggle('is-playing', on);
      playBtn.setAttribute('aria-label', on ? 'Pausar' : 'Tocar');
      const lab = $('.cursor-ring span');
      if (lab) lab.textContent = on ? 'PAUSE' : 'PLAY';
    }

    Playback.register('beats', () => { Engine.stop(); setPlaying(false); });

    async function playTrack(i) {
      show(i);
      Playback.claim('beats');
      setPlaying(true);
      try {
        if (await Engine.play(CONFIG.tracks[cur])) gsap.fromTo(playBtn, { scale: 0.9 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
      } catch (e) {
        setPlaying(false);
        Playback.release('beats');
        toast('Não foi possível tocar esta faixa.');
      }
    }
    function toggle() {
      if (Engine.busy) { Engine.stop(); setPlaying(false); Playback.release('beats'); } else playTrack(cur);
    }

    playBtn.addEventListener('click', toggle);
    screen.addEventListener('click', toggle);
    $('[data-next]', root).addEventListener('click', () => (Engine.busy ? playTrack(cur + 1) : show(cur + 1)));
    $('[data-prev]', root).addEventListener('click', () => (Engine.busy ? playTrack(cur - 1) : show(cur - 1)));
    btns.forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.i);
      if (i === cur && Engine.busy) toggle(); else playTrack(i);
    }));
    $('[data-volume]', root).addEventListener('input', (e) => Engine.setVolume(Number(e.target.value)));
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.target.closest('input, textarea, select, button, a')) return;
      const r = root.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) { e.preventDefault(); toggle(); }
    });
    // Para o som ao sair da aba
    document.addEventListener('visibilitychange', () => { if (document.hidden && Engine.busy) { Engine.stop(); setPlaying(false); Playback.release('beats'); } });

    // Fim da faixa: segue para a próxima
    Engine.onEnded = () => {
      setPlaying(false);
      Playback.release('beats');
      playTrack(CONFIG.tracks.findIndex((t) => t.id === Engine.trackId) + 1);
    };

    // Barra de progresso: clicar ou arrastar muda a posição; setas avançam 5 s
    const seekBar = $('[data-seek]', root);
    const isLoaded = () => Engine.trackId === CONFIG.tracks[cur].id;
    const ratioAt = (e) => { const r = seekBar.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
    let dragging = false;
    seekBar.addEventListener('pointerdown', async (e) => {
      const ratio = ratioAt(e);
      dragging = true;
      seekBar.setPointerCapture(e.pointerId);
      if (!isLoaded() || !Engine.busy) await playTrack(cur);
      Engine.seek(ratio);
    });
    seekBar.addEventListener('pointermove', (e) => { if (dragging && isLoaded()) Engine.seek(ratioAt(e)); });
    seekBar.addEventListener('pointerup', () => { dragging = false; });
    seekBar.addEventListener('keydown', (e) => {
      if (!isLoaded()) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); Engine.nudge(5); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); Engine.nudge(-5); }
      if (e.key === 'Home') { e.preventDefault(); Engine.seek(0); }
      if (e.key === 'End') { e.preventDefault(); Engine.seek(0.99); }
    });
    let lastSec = -1;

    show(0);

    // Osciloscópio + barras
    let w = 0, h = 0, visible = false, idleT = 0;
    function size() {
      const d = Math.min(devicePixelRatio || 1, 2);
      w = scope.clientWidth; h = scope.clientHeight;
      scope.width = w * d; scope.height = h * d; sx.setTransform(d, 0, 0, d, 0, 0);
    }
    size(); addEventListener('resize', size);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(scope);
    const timeEl = $('[data-time]', root), progEl = $('[data-progress]', root);
    function draw() {
      if (!visible) return;
      sx.clearRect(0, 0, w, h);
      // grade de estúdio
      sx.strokeStyle = 'rgba(255,255,255,0.05)'; sx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) { sx.beginPath(); sx.moveTo(x + 0.5, 0); sx.lineTo(x + 0.5, h); sx.stroke(); }
      for (let y = 0; y < h; y += 40) { sx.beginPath(); sx.moveTo(0, y + 0.5); sx.lineTo(w, y + 0.5); sx.stroke(); }
      const spec = Engine.playing ? Engine.spectrum() : null;
      const bars = 48, bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = spec ? spec[Math.floor(Math.pow(i / bars, 1.7) * 380) + 2] / 255 : 0.04 + 0.03 * Math.sin(i * 0.6 + idleT * 2);
        const bh = v * h * 0.8;
        const g = sx.createLinearGradient(0, h, 0, h - bh);
        g.addColorStop(0, 'rgba(101,155,20,0.55)'); g.addColorStop(1, 'rgba(198,236,128,0.9)');
        sx.fillStyle = g;
        sx.fillRect(i * bw + 2, h - bh, bw - 4, bh);
      }
      const wave = Engine.playing ? Engine.waveform() : null;
      sx.beginPath();
      for (let i = 0; i <= w; i += 2) {
        const y = wave ? (wave[Math.floor((i / w) * (wave.length - 1))] / 255) * h : h / 2 + Math.sin(i * 0.03 + idleT * 3) * 4;
        i ? sx.lineTo(i, y) : sx.moveTo(i, y);
      }
      sx.strokeStyle = 'rgba(244,244,242,0.85)'; sx.lineWidth = 1.6; sx.stroke();
      idleT += reduced ? 0 : 0.016;
      const loaded = isLoaded();
      const el = loaded ? Engine.elapsed() : 0, p = loaded ? Engine.progress() : 0;
      timeEl.textContent = `${Math.floor(el / 60)}:${String(Math.floor(el % 60)).padStart(2, '0')} / ${CONFIG.tracks[cur].dur}`;
      progEl.style.transform = `scaleX(${p.toFixed(4)})`;
      seekBar.style.setProperty('--p', p.toFixed(4));
      if (Math.floor(el) !== lastSec) {
        lastSec = Math.floor(el);
        seekBar.setAttribute('aria-valuenow', Math.round(p * 100));
        seekBar.setAttribute('aria-valuetext', `${timeEl.textContent.replace(' / ', ' de ')}`);
      }
    }
    gsap.ticker.add(draw);
  })();

  // ════════════════════════════════════════════════════════════════════════
  // ORÇAMENTO: cards de preço + calculadora + formulário
  // ════════════════════════════════════════════════════════════════════════
  (function quote() {
    const services = $$('[data-prices] .price').map((el) => ({
      id: el.dataset.id,
      name: $('.price-name span', el).textContent.trim(),
      price: Number(el.dataset.price),
      from: !!el.dataset.from,
      quote: !!el.dataset.quote,
      unit: el.dataset.unit, units: el.dataset.units,
      desc: $('.price-desc', el).textContent.trim(),
    }));
    // Ordem da calculadora: do básico ao completo
    const order = ['beat', 'beat-completo', 'captacao', 'mix', 'pacote', 'capa', 'mentoria'];
    services.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    const state = Object.fromEntries(services.map((s) => [s.id, 0]));
    const byId = Object.fromEntries(services.map((s) => [s.id, s]));

    const opts = $('[data-opts]');
    services.forEach((s) => {
      const row = document.createElement('div');
      row.className = 'opt';
      row.dataset.id = s.id;
      const priceLabel = s.quote ? 'Consultar' : (s.from ? 'a partir de ' : '') + money(s.price);
      row.innerHTML = `
        <input type="checkbox" id="o-${s.id}">
        <label class="opt-name" for="o-${s.id}"></label>
        <div class="opt-right">
          ${s.quote ? '<span></span>' : `<div class="stepper" role="group">
            <button type="button" data-dec aria-label="Menos">−</button>
            <output aria-live="polite">1</output>
            <button type="button" data-inc aria-label="Mais">+</button></div>`}
          <span class="opt-price"></span>
        </div>`;
      const lab = $('.opt-name', row);
      lab.textContent = s.name;
      const sub = document.createElement('span');
      sub.className = 'opt-sub'; sub.textContent = s.desc;
      lab.appendChild(sub);
      $('.opt-price', row).textContent = priceLabel;
      const grp = $('.stepper', row);
      if (grp) grp.setAttribute('aria-label', `Quantidade de ${s.name}`);
      opts.appendChild(row);

      const cb = $('input', row);
      cb.addEventListener('change', () => { set(s.id, cb.checked ? Math.max(1, state[s.id]) : 0); });
      if (!s.quote) {
        $('[data-inc]', row).addEventListener('click', () => set(s.id, Math.min(20, state[s.id] + 1)));
        $('[data-dec]', row).addEventListener('click', () => set(s.id, Math.max(0, state[s.id] - 1)));
      }
    });

    const totalEl = $('[data-total]');
    const shownTotal = { v: 0 };

    function set(id, n, quiet) {
      state[id] = n;
      render(quiet);
    }

    function lines() {
      return services.filter((s) => state[s.id] > 0).map((s) => {
        const n = state[s.id];
        const label = s.quote ? s.name : `${s.name}${n > 1 ? ` × ${n}` : ''}`;
        const value = s.quote ? 'sob consulta' : (s.from ? 'a partir de ' : '') + money(s.price * n);
        return { s, n, label, value };
      });
    }

    function render(quiet) {
      // Linhas da calculadora
      $$('.opt', opts).forEach((row) => {
        const n = state[row.dataset.id];
        row.classList.toggle('is-on', n > 0);
        $('input', row).checked = n > 0;
        const out = $('output', row);
        if (out) out.textContent = Math.max(1, n);
        $$('.stepper button', row).forEach((b) => { b.disabled = n === 0; });
      });
      // Botões dos cards de preço
      $$('[data-add]').forEach((b) => {
        const on = state[b.dataset.add] > 0;
        b.classList.toggle('is-added', on);
        b.textContent = on ? `No orçamento${state[b.dataset.add] > 1 ? ` (${state[b.dataset.add]})` : ''} ✓` : 'Adicionar';
      });

      const L = lines();
      const ul = $('[data-lines]');
      ul.innerHTML = '';
      if (!L.length) {
        const li = document.createElement('li'); li.className = 'sum-empty'; li.textContent = 'Nenhum serviço escolhido ainda.'; ul.appendChild(li);
      } else {
        L.forEach((l) => {
          const li = document.createElement('li');
          const a = document.createElement('span'); a.textContent = l.label;
          const b = document.createElement('span'); b.textContent = l.value;
          li.append(a, b); ul.appendChild(li);
        });
        if (!quiet && !reduced) gsap.from(ul.lastElementChild, { x: -8, opacity: 0, duration: 0.3 });
      }
      const items = L.reduce((a, l) => a + (l.s.quote ? 1 : l.n), 0);
      $('[data-count-items]').textContent = `${items} ${items === 1 ? 'item' : 'itens'}`;

      const total = L.reduce((a, l) => a + (l.s.quote ? 0 : l.s.price * l.n), 0);
      const hasFrom = state.capa > 0;
      $('[data-total-label]').textContent = hasFrom ? 'Total a partir de' : 'Total estimado';
      const extra = $('[data-extra]');
      const notes = [];
      if (hasFrom) notes.push('Capa e identidade visual têm valor a partir de; o final depende do escopo.');
      if (state.mentoria) notes.push('A mentoria de lançamento é orçada à parte.');
      extra.hidden = !notes.length; extra.textContent = notes.join(' ');
      gsap.to(shownTotal, {
        v: total, duration: reduced ? 0 : 0.6, ease: 'power3.out', overwrite: true,
        onUpdate: () => { totalEl.textContent = Math.round(shownTotal.v).toLocaleString('pt-BR'); },
      });
      if (!quiet && !reduced && total) gsap.fromTo('.sum-value', { scale: 1.06 }, { scale: 1, duration: 0.4, ease: 'back.out(2)', overwrite: true });

      // Sugestão do Pacote Completo (captação + beat + mix & master)
      const beatsForPkg = state['beat-completo'] + Math.min(state.beat, state.mix);
      const n = Math.min(state.captacao, beatsForPkg);
      const sug = $('[data-suggest]');
      if (n > 0) {
        const fromBC = Math.min(n, state['beat-completo']);
        const fromB = n - fromBC;
        const before = fromBC * (byId['beat-completo'].price + byId.captacao.price) + fromB * (byId.beat.price + byId.mix.price + byId.captacao.price);
        const after = n * byId.pacote.price;
        const save = before - after;
        $('[data-suggest-text]').textContent = save > 0
          ? `Captação + beat + mix & master cabem no Pacote Completo: economize ${money(save)}.`
          : 'Captação + beat + mix & master é exatamente o Pacote Completo. Feche tudo em um fluxo só.';
        sug.dataset.n = n; sug.dataset.bc = fromBC; sug.dataset.b = fromB;
        if (sug.hidden) { sug.hidden = false; if (!reduced) gsap.from(sug, { y: 12, opacity: 0, duration: 0.45 }); }
      } else sug.hidden = true;
      $('[data-note-mix]').hidden = !(state['beat-completo'] > 0 && state.mix > 0);
    }

    $('[data-suggest-apply]').addEventListener('click', () => {
      const sug = $('[data-suggest]');
      const n = Number(sug.dataset.n), bc = Number(sug.dataset.bc), b = Number(sug.dataset.b);
      state.captacao -= n; state['beat-completo'] -= bc; state.beat -= b; state.mix -= b;
      state.pacote += n;
      render();
      toast('Trocado pelo Pacote Completo.');
    });

    // Botões "Adicionar" dos cards
    $$('[data-add]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.add;
      const was = state[id] > 0;
      set(id, was ? 0 : 1);
      if (!was) {
        toast(`${byId[id].name} adicionado ao orçamento.`);
        if (!reduced) gsap.fromTo(b, { scale: 0.94 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
      }
    }));

    // Mensagem do pedido
    const form = $('[data-form]');
    function buildMessage() {
      const f = new FormData(form);
      const L = lines();
      const total = L.reduce((a, l) => a + (l.s.quote ? 0 : l.s.price * l.n), 0);
      const out = ['*Pedido de orçamento: ODIUM*', ''];
      out.push(`Nome: ${f.get('nome').trim()}`);
      if (f.get('artista').trim()) out.push(`Nome artístico: ${f.get('artista').trim()}`);
      out.push('', '*Serviços*');
      L.forEach((l) => out.push(`• ${l.label}: ${l.value}`));
      out.push('', `*Total ${state.capa > 0 ? 'a partir de' : 'estimado'}: ${money(total)}*${state.mentoria ? ' + mentoria sob consulta' : ''}`);
      out.push('', `Prazo: ${f.get('prazo')}`);
      if (f.get('referencia').trim()) out.push(`Referência: ${f.get('referencia').trim()}`);
      if (f.get('mensagem').trim()) out.push('', f.get('mensagem').trim());
      return out.join('\n');
    }
    function validate() {
      const msg = $('[data-form-msg]');
      msg.textContent = '';
      const nome = $('#f-nome');
      const field = nome.closest('.field');
      field.classList.toggle('is-error', !nome.value.trim());
      nome.setAttribute('aria-invalid', String(!nome.value.trim()));
      if (!lines().length) {
        msg.textContent = 'Escolha pelo menos um serviço acima.';
        if (!reduced) gsap.fromTo('.opts', { x: -10 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
        return false;
      }
      if (!nome.value.trim()) {
        if (!reduced) gsap.fromTo(field, { x: -10 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
        nome.focus();
        return false;
      }
      return true;
    }
    $('#f-nome').addEventListener('input', (e) => {
      if (!e.target.value.trim()) return;
      e.target.closest('.field').classList.remove('is-error');
      e.target.setAttribute('aria-invalid', 'false');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate()) return;
      const url = waLink(buildMessage());
      // Com 'noopener', window.open sempre retorna null; por isso o opener é zerado à mão
      const win = window.open(url, '_blank');
      if (win) win.opener = null; else location.href = url;
      $('[data-form-msg]').textContent = 'Pedido pronto! Finalize o envio no WhatsApp.';
      toast('Abrindo o WhatsApp com o seu pedido…');
    });
    $('[data-copy]').addEventListener('click', async () => {
      if (!validate()) return;
      const text = buildMessage();
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      toast('Pedido copiado.');
    });

    render(true);
  })();

  // ════════════════════════════════════════════════════════════════════════
  // PRODUÇÕES: Spotify, capas (com zoom) e clipes
  // ════════════════════════════════════════════════════════════════════════
  (function works() {
    // Spotify: os players só carregam quando a seção se aproxima
    const sp = $('[data-spotify]');
    const ids = CONFIG.spotify
      .map((u) => (/(track|album|playlist)\/([A-Za-z0-9]+)/.exec(u) || []).slice(1))
      .filter((m) => m.length === 2);
    ids.forEach(([kind, id]) => {
      const card = document.createElement('div');
      card.className = 'sp-card';
      card.dataset.kind = kind;
      card.dataset.id = id;
      sp.appendChild(card);
    });

    // A API oficial do Spotify permite pausar o player e saber quando ele toca.
    // Se ela não carregar, cai para o iframe simples (que só é pausado recarregando).
    let spApi;
    const loadSpotifyApi = () => spApi || (spApi = new Promise((resolve) => {
      window.onSpotifyIframeApiReady = (api) => resolve(api);
      const sc = document.createElement('script');
      sc.src = 'https://open.spotify.com/embed/iframe-api/v1';
      sc.async = true;
      sc.onerror = () => resolve(null);
      document.head.appendChild(sc);
      setTimeout(() => resolve(null), 6000);
    }));
    const markLoaded = (card) => {
      const f = $('iframe', card);
      if (!f) return;
      f.title = 'Player do Spotify';
      f.addEventListener('load', () => card.classList.add('is-loaded'));
    };
    // Sem as APIs, a única pista de que alguém deu play num iframe é o foco ir para
    // ele. Quando isso acontece, ele assume o áudio e pausa o resto.
    const frameKeys = new Map();
    let focusedKey = null;
    setInterval(() => {
      const k = frameKeys.get(document.activeElement) || null;
      if (k && k !== focusedKey) Playback.claim(k);
      focusedKey = k;
    }, 400);

    function plainSpotify(card, key) {
      if ($('iframe', card)) return;
      const f = document.createElement('iframe');
      f.src = `https://open.spotify.com/embed/${card.dataset.kind}/${card.dataset.id}?utm_source=generator&theme=0`;
      f.title = 'Player do Spotify';
      f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      f.addEventListener('load', () => card.classList.add('is-loaded'));
      card.appendChild(f);
      // Sem API não dá para pausar: recarregar o iframe interrompe o áudio
      Playback.register(key, () => { f.src = f.src; });
      frameKeys.set(f, key);
    }
    async function mountSpotify(card, i) {
      const key = `sp:${i}`;
      const api = await loadSpotifyApi();
      if (!api) return plainSpotify(card, key);
      const holder = document.createElement('div');
      card.appendChild(holder);
      api.createController(holder, {
        uri: `spotify:${card.dataset.kind}:${card.dataset.id}`, width: '100%', height: 152, theme: 'dark',
      }, (ctrl) => {
        markLoaded(card);
        Playback.register(key, () => ctrl.pause());
        ctrl.addListener('playback_update', (e) => {
          if (e.data && e.data.isPaused === false) Playback.claim(key);
          else Playback.release(key);
        });
      });
    }
    const spIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        spIO.unobserve(e.target);
        mountSpotify(e.target, $$('.sp-card', sp).indexOf(e.target));
      });
    }, { rootMargin: '400px 0px' });
    $$('.sp-card', sp).forEach((c) => spIO.observe(c));
    if (!reduced) {
      ScrollTrigger.batch($$('.sp-card', sp), {
        start: 'top 92%', once: true,
        onEnter: (els) => gsap.fromTo(els, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.07 }),
      });
    }

    // Capas: inclinação 3D seguindo o mouse e zoom em tela cheia
    if (finePointer && !reduced) {
      $$('.cover').forEach((c) => {
        const rx = gsap.quickTo(c, 'rotationX', { duration: 0.5, ease: 'power3' });
        const ry = gsap.quickTo(c, 'rotationY', { duration: 0.5, ease: 'power3' });
        gsap.set(c, { transformPerspective: 900 });
        c.addEventListener('pointermove', (e) => {
          const r = c.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 12);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 12);
        });
        c.addEventListener('pointerleave', () => { rx(0); ry(0); });
      });
    }
    const lb = $('[data-lightbox]');
    const lbImg = $('img', lb);
    $$('[data-cover]').forEach((b) => b.addEventListener('click', () => {
      lbImg.src = b.dataset.cover;
      lbImg.alt = $('img', b).alt;
      lb.showModal();
      document.body.style.overflow = 'hidden';
      if (!reduced) gsap.fromTo(lbImg, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45 });
    }));
    const closeLb = () => lb.close();
    $('[data-lightbox-close]').addEventListener('click', closeLb);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
    lb.addEventListener('close', () => { document.body.style.overflow = ''; });

    // Clipes: miniatura leve; o player do YouTube só carrega ao clicar
    const vids = CONFIG.videos.filter((v) => v.youtube || v.src);
    if (!vids.length) return;
    // API do YouTube: carregada quando a seção se aproxima, para o clique ser imediato
    let ytApi;
    const loadYoutubeApi = () => ytApi || (ytApi = new Promise((resolve) => {
      if (window.YT && window.YT.Player) return resolve(window.YT);
      window.onYouTubeIframeAPIReady = () => resolve(window.YT);
      const sc = document.createElement('script');
      sc.src = 'https://www.youtube.com/iframe_api';
      sc.async = true;
      sc.onerror = () => resolve(null);
      document.head.appendChild(sc);
      setTimeout(() => resolve(window.YT && window.YT.Player ? window.YT : null), 6000);
    }));
    new IntersectionObserver((entries, io) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); loadYoutubeApi(); }
    }, { rootMargin: '600px 0px' }).observe($('[data-videos-wrap]'));
    $('[data-videos-wrap]').hidden = false;
    const box = $('[data-videos]');
    const ytId = (u) => (/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(u) || [])[1] || (/^[A-Za-z0-9_-]{11}$/.test(u) ? u : '');
    vids.forEach((v) => {
      const fig = document.createElement('figure');
      fig.className = 'video';
      fig.setAttribute('data-card', '');
      if (v.src) {
        const el = document.createElement('video');
        el.src = v.src; el.controls = true; el.preload = 'metadata'; el.playsInline = true;
        if (v.poster) el.poster = v.poster;
        const key = `mp4:${box.children.length}`;
        Playback.register(key, () => el.pause());
        el.addEventListener('play', () => Playback.claim(key));
        el.addEventListener('pause', () => Playback.release(key));
        el.addEventListener('ended', () => Playback.release(key));
        fig.appendChild(el);
      } else {
        const id = ytId(v.youtube);
        if (!id) return;
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'video-btn';
        btn.setAttribute('aria-label', `Assistir ${v.title || 'clipe'}`);
        btn.dataset.cursor = 'play';
        btn.innerHTML = `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="play"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg></span>`;
        const key = `yt:${box.children.length}`;
        // Plano B sem API: voltar à miniatura derruba o iframe e interrompe o áudio
        const plainYoutube = () => {
          const f = document.createElement('iframe');
          f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
          f.title = v.title || 'Clipe';
          f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
          f.allowFullscreen = true;
          fig.replaceChildren(f);
          Playback.register(key, () => fig.replaceChildren(btn));
          frameKeys.set(f, key);
        };
        const apiPlayer = (YT) => {
          const holder = document.createElement('div');
          fig.replaceChildren(holder);
          const player = new YT.Player(holder, {
            host: 'https://www.youtube-nocookie.com', videoId: id,
            playerVars: { autoplay: 1, rel: 0, playsinline: 1 },
            events: {
              onReady: (ev) => { ev.target.playVideo(); const f = ev.target.getIframe(); if (f && v.title) f.title = v.title; },
              onStateChange: (ev) => {
                if (ev.data === 1) Playback.claim(key);
                else if (ev.data === 2 || ev.data === 0) Playback.release(key);
              },
            },
          });
          Playback.register(key, () => player.pauseVideo());
        };
        btn.addEventListener('click', async () => {
          Playback.claim(key);
          const ready = window.YT && window.YT.Player;
          const YT = ready ? window.YT : await loadYoutubeApi();
          if (YT) apiPlayer(YT); else plainYoutube();
        });
        fig.appendChild(btn);
      }
      if (v.title) {
        const cap = document.createElement('figcaption');
        cap.textContent = v.title;
        fig.appendChild(cap);
      }
      box.appendChild(fig);
    });
  })();

  // ── Início ───────────────────────────────────────────────────────────────
  runLoader().then(() => {
    // A escultura 3D é pré-carregada com o navegador ocioso depois da abertura, para
    // não travar a navegação mais tarde. Em economia de dados ou aparelhos com pouca
    // memória, ela só carrega quando a seção se aproxima.
    const preload = () => {
      const c = navigator.connection;
      if ((c && c.saveData) || (navigator.deviceMemory && navigator.deviceMemory <= 2)) return;
      (window.requestIdleCallback || ((fn) => setTimeout(fn, 1500)))(() => loadSculpture(), { timeout: 6000 });
    };
    const intro = heroIntro();
    if (intro) intro.eventCallback('onComplete', () => setTimeout(preload, 1200)); else setTimeout(preload, 2500);
    startFlames();
    ScrollTrigger.refresh();
  });
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
  // Recalcula as posições da rolagem sempre que a altura da página muda (fontes,
  // players do Spotify, imagens que carregam depois). Sem isso, a seção fixada do
  // Processo pode começar antes da hora e cobrir a seção Produções.
  let lastH = 0, refreshTimer = 0;
  new ResizeObserver(() => {
    const h = document.body.scrollHeight;
    if (Math.abs(h - lastH) < 2) return;
    lastH = h;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 200);
  }).observe(document.body);
})();
