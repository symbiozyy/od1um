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
    // Faixas do player. Com `src` (ex.: "beats/toxic.mp3") toca o arquivo;
    // sem `src` toca o loop de demonstração sintetizado ao vivo.
    tracks: [
      { id: 'toxic', title: 'Toxic', style: 'Trap', bpm: 140, key: 'F#m', src: '' },
      { id: 'chrome', title: 'Chrome Heart', style: 'Drill', bpm: 142, key: 'Cm', src: '' },
      { id: 'veneno', title: 'Veneno', style: 'Boom bap', bpm: 90, key: 'Am', src: '' },
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

  gsap.registerPlugin(ScrollTrigger, SplitText);
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
  // ÁUDIO: motor Web Audio compartilhado pelo player e pelos visualizadores
  // ════════════════════════════════════════════════════════════════════════
  const Engine = (() => {
    let ctx, comp, master, analyser, delay, delayFb, noise, bus;
    let freq, wave;
    let playing = false, track = null, step = 0, nextTime = 0, timer = 0, startedAt = 0;
    let volume = 0.8;
    const media = new Map();

    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function init() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4;
      comp.attack.value = 0.004; comp.release.value = 0.18;
      master = ctx.createGain(); master.gain.value = volume;
      analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.78;
      comp.connect(master); master.connect(analyser); analyser.connect(ctx.destination);
      delay = ctx.createDelay(1); delayFb = ctx.createGain(); delayFb.gain.value = 0.32;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
      delay.connect(dlp); dlp.connect(delayFb); delayFb.connect(delay);
      const dOut = ctx.createGain(); dOut.gain.value = 0.5; dlp.connect(dOut); dOut.connect(comp);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      freq = new Uint8Array(analyser.frequencyBinCount);
      wave = new Uint8Array(analyser.fftSize);
    }

    const shaperCurve = (() => {
      const n = 1024, c = new Float32Array(n), k = 6;
      for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
      return c;
    })();

    function env(g, t, peak, a, dec) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }
    function noiseSrc(t, dur) {
      const s = ctx.createBufferSource(); s.buffer = noise;
      s.start(t, Math.random() * 0.5); s.stop(t + dur);
      return s;
    }

    // Instrumentos
    function kick(t, v = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
      env(g, t, v, 0.003, 0.42);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.5);
      const n = noiseSrc(t, 0.02), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 2500; env(ng, t, 0.25 * v, 0.001, 0.015);
      n.connect(hp); hp.connect(ng); ng.connect(bus);
    }
    function bass(t, note, dur, glideFrom, v = 0.9) {
      const o = ctx.createOscillator(), g = ctx.createGain(), sh = ctx.createWaveShaper(), lp = ctx.createBiquadFilter();
      o.type = 'sine';
      if (glideFrom != null) {
        o.frequency.setValueAtTime(mtof(glideFrom), t);
        o.frequency.exponentialRampToValueAtTime(mtof(note), t + 0.09);
      } else {
        o.frequency.setValueAtTime(mtof(note) * 1.6, t);
        o.frequency.exponentialRampToValueAtTime(mtof(note), t + 0.03);
      }
      sh.curve = shaperCurve; lp.type = 'lowpass'; lp.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.006);
      g.gain.setValueAtTime(v, t + Math.max(0.02, dur - 0.08));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(sh); sh.connect(lp); lp.connect(g); g.connect(bus);
      o.start(t); o.stop(t + dur + 0.02);
    }
    function snare(t, v = 0.7, clap = false) {
      const hits = clap ? [0, 0.011, 0.022] : [0];
      hits.forEach((off, i) => {
        const n = noiseSrc(t + off, 0.3), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = clap ? 'bandpass' : 'highpass'; bp.frequency.value = clap ? 1500 : 1300; bp.Q.value = clap ? 0.9 : 0.7;
        env(g, t + off, v * (i === hits.length - 1 ? 1 : 0.6), 0.001, i === hits.length - 1 ? 0.22 : 0.012);
        n.connect(bp); bp.connect(g); g.connect(bus);
      });
      if (!clap) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
        env(g, t, v * 0.5, 0.001, 0.1); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.15);
      }
    }
    function hat(t, v = 0.22, open = false) {
      const n = noiseSrc(t, open ? 0.3 : 0.06), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 7600;
      env(g, t, v, 0.001, open ? 0.22 : 0.035);
      n.connect(hp); hp.connect(g); g.connect(bus);
    }
    function pluck(t, note, dur, v = 0.16, bright = 3200, send = 0.4) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o1.type = 'triangle'; o2.type = 'sine';
      o1.frequency.value = mtof(note); o2.frequency.value = mtof(note + 12); o2.detune.value = 6;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(bright, t); lp.frequency.exponentialRampToValueAtTime(500, t + dur);
      env(g, t, v, 0.004, dur);
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(bus);
      const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(delay);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    function keys(t, notes, dur, v = 0.07) {
      notes.forEach((n) => pluck(t, n, dur, v, 1800, 0.25));
    }
    function crackle(t) {
      if (Math.random() > 0.35) return;
      const n = noiseSrc(t, 0.01), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 3000; env(g, t, 0.05 + Math.random() * 0.05, 0.0005, 0.006);
      n.connect(hp); hp.connect(g); g.connect(bus);
    }

    // Padrões de 2 compassos (32 semicolcheias)
    const P = {
      toxic: {
        swing: 0,
        kick: 'x......x..x.....x.....x...x..x..',
        snare: '........x...............x.......',
        hat: 'x.x.x.x.x.x.x.x.x.x.x.r.x.x.ttx.',
        open: '..............................o.',
        bass: [{ s: 0, n: 42, d: 7 }, { s: 7, n: 42, d: 3 }, { s: 10, n: 45, d: 6 }, { s: 16, n: 42, d: 6 }, { s: 22, n: 49, d: 4, g: 42 }, { s: 26, n: 47, d: 3 }, { s: 29, n: 45, d: 3 }],
        lead: [[0, 73], [3, 69], [6, 66], [8, 76], [11, 73], [14, 69], [16, 74], [19, 69], [22, 66], [24, 73], [27, 69], [30, 64]],
      },
      chrome: {
        swing: 0,
        kick: 'x.........x.....x.......x.....x.',
        snare: '........x.............x.x.......',
        hat: 'x..x..x.x..x.x..x..x..x.x.tx..x.',
        open: '',
        bass: [{ s: 0, n: 36, d: 6 }, { s: 6, n: 43, d: 4, g: 36 }, { s: 10, n: 39, d: 6, g: 43 }, { s: 16, n: 36, d: 5 }, { s: 21, n: 34, d: 3 }, { s: 24, n: 41, d: 4, g: 34 }, { s: 28, n: 39, d: 4 }],
        lead: [[0, 72], [2, 75], [4, 74], [6, 67], [8, 72], [10, 75], [12, 74], [14, 68], [16, 72], [18, 75], [20, 74], [22, 67], [24, 70], [26, 68], [28, 67], [30, 63]],
      },
      veneno: {
        swing: 0.16,
        kick: 'x.......x.x.....x..x......x.....',
        snare: '....x.......x.......x.......x..x',
        hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.',
        open: '',
        bass: [{ s: 0, n: 45, d: 3 }, { s: 3, n: 45, d: 2 }, { s: 8, n: 48, d: 3 }, { s: 10, n: 47, d: 4 }, { s: 16, n: 45, d: 3 }, { s: 19, n: 52, d: 2 }, { s: 24, n: 50, d: 3 }, { s: 26, n: 48, d: 4 }],
        chords: [[0, [57, 60, 64, 67], 6], [6, [57, 60, 64, 67], 2], [16, [53, 57, 60, 64], 6], [22, [52, 55, 59, 62], 8]],
        crackle: true,
      },
    };

    function schedule(i, t) {
      const p = P[track.id];
      if (!p) return;
      const s16 = 60 / track.bpm / 4;
      if (p.swing && i % 2) t += p.swing * s16;
      if (p.kick[i] === 'x') kick(t, 1);
      if (p.snare[i] === 'x') snare(t, 0.7, track.id !== 'veneno');
      const h = p.hat[i];
      if (h === 'x') hat(t, i % 4 === 0 ? 0.24 : 0.16);
      else if (h === 'r') { hat(t, 0.16); hat(t + s16 / 2, 0.12); }
      else if (h === 't') { for (let k = 0; k < 3; k++) hat(t + (s16 / 3) * k, 0.1 + k * 0.03); }
      if (p.open && p.open[i] === 'o') hat(t, 0.16, true);
      for (const b of p.bass) if (b.s === i) bass(t, b.n, b.d * s16, b.g);
      if (p.lead) for (const [s, n] of p.lead) if (s === i) pluck(t, n, s16 * 3, track.id === 'chrome' ? 0.12 : 0.15, track.id === 'chrome' ? 2400 : 3600);
      if (p.chords) for (const [s, ns, d] of p.chords) if (s === i) keys(t, ns, d * s16);
      if (p.crackle) crackle(t + Math.random() * s16);
    }

    function tick() {
      const s16 = 60 / track.bpm / 4;
      while (nextTime < ctx.currentTime + 0.12) {
        schedule(step, nextTime);
        nextTime += s16;
        step = (step + 1) % 32;
      }
    }

    function stopBus() {
      if (!bus) return;
      const old = bus;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      setTimeout(() => old.disconnect(), 400);
      bus = null;
    }

    function getMedia(t) {
      if (!media.has(t.id)) {
        const el = new Audio(t.src);
        el.crossOrigin = 'anonymous'; el.loop = true; el.preload = 'auto';
        const node = ctx.createMediaElementSource(el);
        media.set(t.id, { el, node });
      }
      return media.get(t.id);
    }

    async function play(t) {
      init();
      if (ctx.state === 'suspended') await ctx.resume();
      stop();
      track = t;
      bus = ctx.createGain(); bus.gain.value = 1; bus.connect(comp);
      if (t.src) {
        const m = getMedia(t);
        m.node.disconnect(); m.node.connect(bus);
        m.el.currentTime = 0;
        try { await m.el.play(); } catch (e) { stopBus(); throw e; }
      } else {
        delay.delayTime.value = (60 / t.bpm) * 0.75;
        step = 0; nextTime = ctx.currentTime + 0.06;
        tick();
        timer = setInterval(tick, 25);
      }
      startedAt = ctx.currentTime;
      playing = true;
    }

    function stop() {
      clearInterval(timer); timer = 0;
      if (track && track.src && media.has(track.id)) media.get(track.id).el.pause();
      stopBus();
      playing = false;
    }

    return {
      play, stop,
      get playing() { return playing; },
      setVolume(v) { volume = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02); },
      elapsed() { return playing ? ctx.currentTime - startedAt : 0; },
      loopProgress() {
        if (!playing || !track) return 0;
        if (track.src) { const el = media.get(track.id).el; return el.duration ? el.currentTime / el.duration : 0; }
        const loop = (60 / track.bpm) * 8;
        return ((ctx.currentTime - startedAt) % loop) / loop;
      },
      // Energia dos graves (0 a 1) para o coração 3D e o fundo do herói pulsarem
      level() {
        if (!playing || !analyser) return 0;
        analyser.getByteFrequencyData(freq);
        let sum = 0; for (let i = 1; i < 12; i++) sum += freq[i];
        return Math.max(0, (sum / 11 / 255 - 0.35) / 0.65);
      },
      spectrum() { if (!analyser) return null; analyser.getByteFrequencyData(freq); return freq; },
      waveform() { if (!analyser) return null; analyser.getByteTimeDomainData(wave); return wave; },
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
    heroTitle.querySelectorAll('.line').forEach((l) => { l.classList.remove('chrome-text', 'acid-text'); });
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('[data-hero-logo]', { scale: 0.86, opacity: 0, filter: 'blur(18px) brightness(2)' },
      { scale: 1, opacity: 1, filter: 'blur(0px) brightness(1)', duration: 1.2 })
      .fromTo(titleSplit.chars, { yPercent: 110, rotate: 6, opacity: 0 },
        { yPercent: 0, rotate: 0, opacity: 1, duration: 0.9, stagger: 0.035 }, 0.35)
      .fromTo('[data-hero]', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, 0.55);
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
    if (open) menuTl.timeScale(1).play(); else menuTl.timeScale(1.6).reverse();
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
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
    let x = 0, boost = 0;
    const setX = gsap.quickSetter(track, 'x', 'px');
    gsap.ticker.add((time, dt) => {
      const gw = group.offsetWidth;
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
    fontsReady.then(() => {
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
    });

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
          trigger: proc, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6,
          invalidateOnRefresh: true, anticipatePin: 1,
        },
      });
      gsap.to('.process-progress b', {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: proc, start: 'top top', end: () => '+=' + dist(), scrub: true, invalidateOnRefresh: true },
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
  let sculpture = null;
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
        if (i < lines.length - 1) tl.to(ln, { yPercent: -40, opacity: 0, filter: 'blur(10px)', ease: 'power3.in', duration: 0.7 }, i * 2 + 1.25);
      });
      tl.to({}, { duration: 0.6 });
    }

    // Three.js só carrega quando a seção se aproxima
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      import('./sculpture.js')
        .then((m) => {
          sculpture = m.mount(canvas, { reduced, mobile: isMobile() });
          if (!sculpture) throw new Error('webgl');
          sculpture.setProgress(lastP);
          gsap.ticker.add(() => {
            sculpture.setPointer(pointer.nx, pointer.ny);
            sculpture.setLevel(audioLevel);
          });
          gsap.from(canvas, { opacity: 0, scale: 0.92, duration: 1.4, ease: 'expo.out' });
        })
        .catch(() => { sec.classList.add('no-webgl'); });
    }, { rootMargin: '600px 0px' });
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
      $('.track-meta', li).textContent = `${t.style} · ${t.bpm} BPM · ${t.key}`;
      list.appendChild(li);
    });
    const btns = $$('.track', list);

    function show(i) {
      cur = (i + CONFIG.tracks.length) % CONFIG.tracks.length;
      const t = CONFIG.tracks[cur];
      btns.forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
      const title = $('[data-title]', root);
      $('[data-meta]', root).textContent = `${t.style} · ${t.key}`;
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

    async function playTrack(i) {
      show(i);
      try {
        await Engine.play(CONFIG.tracks[cur]);
        setPlaying(true);
        gsap.fromTo(playBtn, { scale: 0.9 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
      } catch (e) {
        setPlaying(false);
        toast('Não foi possível tocar esta faixa.');
      }
    }
    function toggle() {
      if (Engine.playing) { Engine.stop(); setPlaying(false); } else playTrack(cur);
    }

    playBtn.addEventListener('click', toggle);
    screen.addEventListener('click', toggle);
    $('[data-next]', root).addEventListener('click', () => (Engine.playing ? playTrack(cur + 1) : show(cur + 1)));
    $('[data-prev]', root).addEventListener('click', () => (Engine.playing ? playTrack(cur - 1) : show(cur - 1)));
    btns.forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.i);
      if (i === cur && Engine.playing) toggle(); else playTrack(i);
    }));
    $('[data-volume]', root).addEventListener('input', (e) => Engine.setVolume(Number(e.target.value)));
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.target.closest('input, textarea, select, button, a')) return;
      const r = root.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) { e.preventDefault(); toggle(); }
    });
    // Para o som ao sair da aba
    document.addEventListener('visibilitychange', () => { if (document.hidden && Engine.playing) { Engine.stop(); setPlaying(false); } });

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
      const el = Engine.elapsed();
      timeEl.textContent = `${String(Math.floor(el / 60)).padStart(2, '0')}:${String(Math.floor(el % 60)).padStart(2, '0')}`;
      progEl.style.transform = `scaleX(${Engine.loopProgress().toFixed(4)})`;
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
    $('#f-nome').addEventListener('input', (e) => { if (e.target.value.trim()) e.target.closest('.field').classList.remove('is-error'); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate()) return;
      const url = waLink(buildMessage());
      const win = window.open(url, '_blank', 'noopener');
      if (!win) location.href = url;
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
      card.dataset.src = `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator&theme=0`;
      sp.appendChild(card);
    });
    const spIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        spIO.unobserve(e.target);
        const f = document.createElement('iframe');
        f.src = e.target.dataset.src;
        f.title = 'Player do Spotify';
        f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        f.loading = 'lazy';
        f.addEventListener('load', () => e.target.classList.add('is-loaded'));
        e.target.appendChild(f);
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
        fig.appendChild(el);
      } else {
        const id = ytId(v.youtube);
        if (!id) return;
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'video-btn';
        btn.setAttribute('aria-label', `Assistir ${v.title || 'clipe'}`);
        btn.dataset.cursor = 'play';
        btn.innerHTML = `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="play"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg></span>`;
        btn.addEventListener('click', () => {
          if (Engine.playing) { Engine.stop(); $('[data-player]').classList.remove('is-playing'); }
          const f = document.createElement('iframe');
          f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
          f.title = v.title || 'Clipe';
          f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
          f.allowFullscreen = true;
          fig.replaceChildren(f);
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
    heroIntro();
    startFlames();
    ScrollTrigger.refresh();
  });
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
