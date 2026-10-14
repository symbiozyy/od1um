// Escultura 3D do manifesto: o coração com coroa de chamas do logo ODIUM,
// reconstruído em código. Coração verde metálico com glitter (como as letras
// do logo), contorno e coroa cromados, chamas em tubos orgânicos que ondulam,
// estúdio de luz próprio para o cromo e bloom por cima.
// Capítulos da rolagem: Beat (pulsa), Voz (chamas ondulam), Mix & Master (alinha e brilha).
import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';

const BG = 0x080908;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Coração 3D paramétrico ("estufado"): u ∈ [0, π] dá a espessura, v ∈ [0, 2π] o contorno.
const HS = 0.62, THICK = 0.62;
function heartAt(u, v, out = new THREE.Vector3()) {
  const x = Math.sin(u) * (15 * Math.sin(v) - 4 * Math.sin(3 * v));
  const y = Math.sin(u) * (15 * Math.cos(v) - 5 * Math.cos(2 * v) - 2 * Math.cos(3 * v) - Math.cos(4 * v));
  const z = 8 * Math.cos(u) * THICK;
  return out.set(x * HS, y * HS, z * HS);
}
function heartGeometry(nu = 64, nv = 160) {
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3(), Pu = new THREE.Vector3(), Pv = new THREE.Vector3(), n = new THREE.Vector3();
  const e = 1e-3;
  for (let i = 0; i <= nu; i++) {
    const u = (i / nu) * Math.PI;
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * Math.PI * 2;
      heartAt(u, v, P);
      // Normal analítica pelas derivadas parciais; nos polos, aponta para frente/trás
      if (i === 0 || i === nu) n.set(0, 0, i === 0 ? 1 : -1);
      else {
        heartAt(u + e, v, Pu).sub(heartAt(u - e, v, n));
        heartAt(u, v + e, Pv).sub(heartAt(u, v - e, n));
        n.crossVectors(Pv, Pu).normalize();
        if (n.dot(P) < 0 && Math.abs(P.z) > 0.01) n.negate();
      }
      pos.push(P.x, P.y, P.z); nor.push(n.x, n.y, n.z); uv.push(v / (Math.PI * 2) * 9, i / nu * 4.5);
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Estúdio de luz: caixa escura com faixas de softbox. É o que faz o cromo parecer cromo.
function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x030403);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const strip = (hex, power, [w, h, d], [x, y, z], ry = 0) => {
    const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(power) }));
    m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.y = ry;
    env.add(m);
  };
  strip(0xffffff, 9, [0.9, 16, 0.9], [-7, 1, -5]);
  strip(0xffffff, 6, [0.7, 16, 0.7], [7.5, 1, -4]);
  strip(0xffffff, 5, [22, 0.5, 0.5], [0, 8, 1]);
  strip(0xffffff, 0.5, [10, 7, 0.3], [0, 1, 11]);
  strip(0xffffff, 3, [4, 0.4, 0.4], [-4, -3, 9]);
  strip(0xc6ec80, 5, [0.6, 12, 0.6], [-10, 0, 4], 0.4);
  strip(0x8fc63a, 3.5, [16, 0.5, 0.5], [0, -7, 5]);
  strip(0xb9e064, 2.5, [0.5, 10, 0.5], [10, -2, 6], -0.4);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}

// Normal map de glitter: pontinhos aleatórios que brilham como a pintura flocada do logo
function flakeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const img = x.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 128 + (Math.random() - 0.5) * 150;
    img.data[i + 1] = 128 + (Math.random() - 0.5) * 150;
    img.data[i + 2] = 255;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  return t;
}

// Tubo afinando (raio r(t)) varrido ao longo de uma curva, com normais corrigidas
// pela inclinação e atributos aT (0 na base, 1 na ponta) e aS (semente da chama).
function taperedTube(curve, rFn, seed, segs = 72, radial = 14) {
  const frames = curve.computeFrenetFrames(segs, false);
  const len = curve.getLength();
  const pos = [], nor = [], at = [], as = [], idx = [];
  const P = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    const N = frames.normals[i], B = frames.binormals[i], T = frames.tangents[i];
    const r = rFn(t);
    const k = (rFn(Math.min(1, t + 0.01)) - rFn(Math.max(0, t - 0.01))) / (0.02 * len);
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      n.copy(N).multiplyScalar(Math.cos(v)).addScaledVector(B, Math.sin(v)).normalize();
      pos.push(P.x + n.x * r, P.y + n.y * r, P.z + n.z * r);
      const nn = n.clone().addScaledVector(T, -k).normalize();
      nor.push(nn.x, nn.y, nn.z);
      at.push(t); as.push(seed);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(at, 1));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(as, 1));
  g.setIndex(idx);
  return g;
}

export function mount(canvas, { reduced = false, mobile = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.environment = studioEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500);

  // ── Materiais ────────────────────────────────────────────────────────────
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.07, envMapIntensity: 1.15 });
  const flameUniforms = { uTime: { value: 0 }, uAmp: { value: 0.6 } };
  const flameMat = chrome.clone();
  flameMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, flameUniforms);
    shader.vertexShader = 'attribute float aT;\nattribute float aS;\nuniform float uTime;\nuniform float uAmp;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float w = aT * aT;
        transformed.x += sin(uTime * 2.6 + aT * 5.0 + aS) * w * uAmp;
        transformed.z += cos(uTime * 2.1 + aT * 4.0 + aS * 1.7) * w * uAmp * 0.6;`);
  };
  const candy = new THREE.MeshPhysicalMaterial({
    color: 0x5cad18, metalness: 0.88, roughness: 0.24,
    clearcoat: 1, clearcoatRoughness: 0.03,
    normalMap: flakeTexture(), normalScale: new THREE.Vector2(0.3, 0.3),
    emissive: 0x123300, emissiveIntensity: 0.35, envMapIntensity: 1.3,
    side: THREE.DoubleSide,
  });

  // ── Peça ────────────────────────────────────────────────────────────────
  const root = new THREE.Group();     // posição na tela + mouse
  const spin = new THREE.Group();     // giro da rolagem
  const piece = new THREE.Group();    // centraliza a peça na origem
  root.add(spin); spin.add(piece); scene.add(root);

  // Coração estufado, centralizado na origem
  const hGeo = heartGeometry();
  hGeo.computeBoundingBox();
  const hMid = hGeo.boundingBox.getCenter(new THREE.Vector3());
  hGeo.translate(-hMid.x, -hMid.y, -hMid.z);
  const heartGroup = new THREE.Group();
  const heart = new THREE.Mesh(hGeo, candy);
  heartGroup.add(heart);

  // Aura: casca levemente maior com brilho de borda (fresnel) verde
  const auraMat = new THREE.ShaderMaterial({
    uniforms: { uPower: { value: 0.7 }, uColor: { value: new THREE.Color(0x9be04a) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uPower; uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6); gl_FragColor = vec4(uColor * f * uPower * 2.2, f * uPower); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const aura = new THREE.Mesh(hGeo, auraMat);
  aura.scale.setScalar(1.07);
  heartGroup.add(aura);

  // Contorno cromado do coração (como o traço do logo), na "cintura" do coração
  const outlineCurve = new THREE.CatmullRomCurve3(Array.from({ length: 140 }, (_, j) => {
    const p = heartAt(Math.PI / 2, (j / 140) * Math.PI * 2).sub(hMid);
    return new THREE.Vector3(p.x * 1.1, p.y * 1.1 + 0.25, 0);
  }), true, 'centripetal');
  const outline = new THREE.Mesh(new THREE.TubeGeometry(outlineCurve, 360, 0.48, 16, true), chrome);
  heartGroup.add(outline);
  piece.add(heartGroup);

  // Coroa: arco cromado sobre o coração
  // Coroa: arco cromado achatado (elipse) assentado sobre os lóbulos
  const waist = heartAt(Math.PI / 2, Math.PI / 2).sub(hMid);
  const R = Math.abs(waist.x) * 1.1 + 0.6, SQ = 0.66, CY = waist.y * 1.1 + 0.25;
  const arcSpan = Math.PI * 1.04;
  const band = new THREE.Mesh(new THREE.TorusGeometry(R, 0.8, 24, 220, arcSpan), chrome);
  band.rotation.z = (Math.PI - arcSpan) / 2;
  band.scale.y = SQ;
  band.position.set(0, CY, -0.6);
  piece.add(band);

  // Chamas: tubos em S que afinam até a ponta e ondulam no shader
  const flames = new THREE.Group();
  flames.position.set(0, CY, -0.6);
  piece.add(flames);
  const COUNT = 13;
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < COUNT; i++) {
    const t = i / (COUNT - 1);
    const ang = THREE.MathUtils.lerp(Math.PI * 0.93, Math.PI * 0.07, t);
    const center = 1 - Math.abs(t - 0.5) * 2;
    const h = 6 + Math.pow(center, 1.35) * 17 + (i % 2 ? -1.6 : 1.2);
    const rb = 0.95 + center * 0.55;
    const s = i % 2 ? 1 : -1;
    const c = s * (0.9 + (1 - center) * 0.8);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -1.2, 0),
      new THREE.Vector3(c * 0.5, h * 0.25, 0.2),
      new THREE.Vector3(-c * 0.9, h * 0.52, -0.3),
      new THREE.Vector3(c * 1.1, h * 0.8, 0.2),
      new THREE.Vector3(c * 1.6, h, 0),
    ], false, 'centripetal');
    const geo = taperedTube(curve, (u) => rb * Math.pow(1 - u, 0.85) * (1 + 0.3 * Math.sin(Math.PI * Math.min(1, u * 1.8))) + 0.02, i * 1.37);
    const m = new THREE.Mesh(geo, flameMat);
    const base = new THREE.Vector3(Math.cos(ang) * R, Math.sin(ang) * R * SQ, 0);
    const outward = new THREE.Vector3(Math.cos(ang) / R, Math.sin(ang) / (R * SQ), 0).normalize();
    const dir = outward.lerp(up, 0.62).normalize();
    m.position.copy(base);
    m.quaternion.setFromUnitVectors(up, dir);
    flames.add(m);
  }

  // Centraliza a peça inteira
  const bb = new THREE.Box3().setFromObject(piece);
  const mid = bb.getCenter(new THREE.Vector3());
  piece.position.sub(mid);
  const size = bb.getSize(new THREE.Vector3());

  // Brasas subindo ao redor
  const N = mobile ? 160 : 360;
  const pPos = new Float32Array(N * 3), pSpd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 90;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 80;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 50 - 8;
    pSpd[i] = 1.5 + Math.random() * 5;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const dot = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(235,255,190,1)'); g.addColorStop(0.35, 'rgba(160,220,70,.55)'); g.addColorStop(1, 'rgba(100,160,20,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const embers = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.9, map: dot, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(embers);

  // Halo verde no fundo, atrás da peça
  const halo = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(101,155,20,.3)'); g.addColorStop(0.45, 'rgba(60,110,10,.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    m.position.z = -22;
    return m;
  })();
  root.add(halo);

  // ── Pós-processamento: bloom nos reflexos e na aura ─────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.55, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ── Estado ──────────────────────────────────────────────────────────────
  let progress = 0, level = 0, levelS = 0;
  const pointer = { x: 0, y: 0 }, pointerS = { x: 0, y: 0 };
  let rotY = -0.45, time = 0, last = performance.now(), running = false, raf = 0;
  const S = { pulse: 1, amp: 0.6, glow: 0.7, bloom: 0.36 };
  let layout = { x: 0, y: 0, wide: true };

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w * (mobile ? 0.35 : 0.5), h * (mobile ? 0.35 : 0.5));
    camera.aspect = w / h;
    const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const wide = camera.aspect > 1.15;
    // Desktop: peça à direita, texto à esquerda. Celular: peça no alto, centralizada.
    const needH = size.y * (wide ? 1.32 : 1.6);
    const needW = size.x * (wide ? 2.4 : 1.25);
    camera.position.set(0, 0, Math.max(needH / k, needW / (camera.aspect * k)));
    camera.updateProjectionMatrix();
    const visH = camera.position.z * k, visW = visH * camera.aspect;
    layout = wide ? { x: visW * 0.25, y: visH * 0.03, wide } : { x: 0, y: visH * 0.17, wide };
    halo.scale.setScalar(Math.max(visW, visH) * 0.8);
    render();
  }

  // Só desenha depois que os shaders estiverem compilados (sem travar a página)
  let ready = false;
  function render() {
    if (ready) composer.render();
  }

  // Batida "tum-tum" do coração
  const heartbeat = (t) => {
    const ph = t % 1.05;
    return Math.exp(-Math.pow(ph / 0.055, 2)) + 0.6 * Math.exp(-Math.pow((ph - 0.24) / 0.065, 2));
  };

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += reduced ? 0 : dt;
    levelS += (level - levelS) * Math.min(1, dt * 16);
    pointerS.x += (pointer.x - pointerS.x) * Math.min(1, dt * 3.5);
    pointerS.y += (pointer.y - pointerS.y) * Math.min(1, dt * 3.5);

    // Capítulos: 0 Beat, 1 Voz, 2 Mix & Master
    const c1 = smooth(0.26, 0.4, progress), c2 = smooth(0.6, 0.74, progress);
    const target = {
      pulse: 1 - c1 * 0.55 + c2 * 0.15,
      amp: 0.55 + c1 * 1.1 - c2 * 1.3,
      glow: 0.7 + c2 * 0.4,
      bloom: 0.36 + c2 * 0.2,
    };
    for (const key in S) S[key] += (target[key] - S[key]) * Math.min(1, dt * 4);

    const beat = reduced ? 0 : heartbeat(time) * S.pulse;
    heartGroup.scale.setScalar(1 + beat * 0.055 + levelS * 0.1);
    candy.emissiveIntensity = 0.35 + beat * 0.9 + levelS * 1.5;
    auraMat.uniforms.uPower.value = S.glow * (0.75 + beat * 0.6 + levelS);
    flameUniforms.uTime.value = time;
    flameUniforms.uAmp.value = reduced ? 0 : Math.max(0.12, S.amp) * (1 + levelS * 0.8);
    bloom.strength = S.bloom + beat * 0.12 + levelS * 0.3;

    // Giro limitado (no máximo ~35°), para a peça nunca ficar de perfil:
    // Beat vira à esquerda, Voz à direita, Mix & Master termina de frente
    const idle = reduced ? 0 : Math.sin(time * 0.45) * 0.1;
    const sweep = progress < 0.5
      ? THREE.MathUtils.lerp(-0.45, 0.6, smooth(0.05, 0.5, progress))
      : THREE.MathUtils.lerp(0.6, 0, smooth(0.5, 0.92, progress));
    const tgt = sweep + idle + pointerS.x * 0.3;
    rotY += (tgt - rotY) * Math.min(1, dt * 4.5);
    spin.rotation.y = rotY;
    spin.rotation.x = pointerS.y * 0.12 + (reduced ? 0 : Math.sin(time * 0.6) * 0.035);
    spin.rotation.z = (1 - c2) * Math.sin(time * 0.3) * 0.03;
    root.position.x += (layout.x - root.position.x) * 0.1;
    root.position.y += (layout.y + (reduced ? 0 : Math.sin(time * 0.8) * 0.5) - root.position.y) * 0.1;
    halo.position.x = -root.position.x * 0.2;

    if (!reduced) {
      const a = pGeo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        a[i * 3 + 1] += pSpd[i] * dt * (1 + levelS * 2 + beat * 0.6);
        a[i * 3] += Math.sin(time + i) * dt * 0.5;
        if (a[i * 3 + 1] > 40) a[i * 3 + 1] = -40;
      }
      pGeo.attributes.position.needsUpdate = true;
    }

    render();
    if (running) raf = requestAnimationFrame(frame);
  }

  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  root.position.set(layout.x, layout.y, 0);
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '100px' });
  io.observe(canvas);
  const parallel = renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile');
  (parallel ? renderer.compileAsync(scene, camera) : Promise.resolve())
    .catch(() => {})
    .then(() => { ready = true; frame(performance.now()); });

  return {
    setProgress(p) { progress = p; if (!running) frame(performance.now()); },
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    setLevel(l) { level = l; },
    dispose() { stop(); ro.disconnect(); io.disconnect(); composer.dispose(); renderer.dispose(); },
  };
}
