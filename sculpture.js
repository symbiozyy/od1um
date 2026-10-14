// Escultura 3D do manifesto: o coração com coroa de chamas do logo, reconstruído
// em código (coração extrudado verde-ácido, chamas e aro cromados, brasas no ar).
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  return s;
}

// Chama pontiaguda com curva em S, como as do logo. Base em y = 0.
function flameShape(h, w, curl) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.bezierCurveTo(-w * 0.8, h * 0.34, -w * 0.15 + curl * w * 0.7, h * 0.6, curl * w * 0.95, h);
  s.bezierCurveTo(w * 0.1 + curl * w * 0.55, h * 0.58, w * 0.85, h * 0.32, w / 2, 0);
  s.quadraticCurveTo(0, h * 0.05, -w / 2, 0);
  return s;
}

export function mount(canvas, { reduced = false, mobile = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
  camera.position.set(0, 0, 92);

  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f0, metalness: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 });
  const candy = new THREE.MeshPhysicalMaterial({
    color: 0x56961a, metalness: 0.45, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.3,
    sheen: 0.8, sheenColor: new THREE.Color(0xd9f59c), emissive: 0x1c3d03, emissiveIntensity: 0.45,
  });

  const root = new THREE.Group();
  const pulse = new THREE.Group();
  root.add(pulse);
  scene.add(root);

  // Coração: frente e verso verdes, laterais cromadas
  const hGeo = new THREE.ExtrudeGeometry(heartShape(), {
    depth: 4.2, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.2, bevelSegments: 10, curveSegments: 64,
  });
  hGeo.center();
  hGeo.rotateZ(Math.PI);
  const heart = new THREE.Mesh(hGeo, [candy, chrome]);
  heart.position.y = -3;
  pulse.add(heart);

  // Aro cromado atrás do coração, aberto embaixo
  const arc = Math.PI * 1.08;
  const R = 13;
  const band = new THREE.Mesh(new THREE.TorusGeometry(R, 0.9, 24, 160, arc), chrome);
  band.rotation.z = (Math.PI - arc) / 2;
  band.position.set(0, -2, -2.4);
  pulse.add(band);

  // Coroa de chamas no topo do aro
  const flames = [];
  const count = 11;
  const fGroup = new THREE.Group();
  fGroup.position.set(0, -2, -2.4);
  pulse.add(fGroup);
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const ang = THREE.MathUtils.lerp(Math.PI * 0.94, Math.PI * 0.06, t);
    const centerness = 1 - Math.abs(t - 0.5) * 2;
    const h = 7 + Math.pow(centerness, 1.3) * 15 + (i % 2 ? -1.8 : 1.2);
    const w = 2.6 + centerness * 1.2;
    const curl = (i % 2 ? 1 : -1) * (0.35 + (1 - centerness) * 0.35);
    const g = new THREE.ExtrudeGeometry(flameShape(h, w, curl), {
      depth: 0.9, bevelEnabled: true, bevelThickness: 0.55, bevelSize: 0.5, bevelSegments: 6, curveSegments: 28,
    });
    g.translate(0, 0, -0.45);
    const m = new THREE.Mesh(g, chrome);
    const r = R - 0.2;
    m.position.set(Math.cos(ang) * r, Math.sin(ang) * r - 0.6, 0);
    const lean = (ang - Math.PI / 2) * 0.62;
    m.rotation.z = lean;
    m.userData = { lean, phase: i * 1.7, base: 1 };
    fGroup.add(m);
    flames.push(m);
  }

  // Brasas subindo
  const N = mobile ? 140 : 320;
  const pos = new Float32Array(N * 3);
  const speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 80;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 70;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 6;
    speed[i] = 2 + Math.random() * 6;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(230,255,180,1)');
    gr.addColorStop(0.3, 'rgba(160,220,70,.6)');
    gr.addColorStop(1, 'rgba(100,160,20,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const embers = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 1.1, map: sprite, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(embers);

  // Luzes de recorte verde e branca por cima do ambiente
  const green = new THREE.PointLight(0x8fd13a, 2600, 0, 2);
  green.position.set(-34, 18, 30);
  scene.add(green);
  const rim = new THREE.DirectionalLight(0xffffff, 2.2);
  rim.position.set(20, 30, -20);
  scene.add(rim);
  const under = new THREE.PointLight(0x659b14, 1400, 0, 2);
  under.position.set(10, -30, 20);
  scene.add(under);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(0, 10, 60);
  scene.add(key);

  // Estado
  let progress = 0, level = 0, levelS = 0;
  const pointer = { x: 0, y: 0 }, pointerS = { x: 0, y: 0 };
  let rotY = 0;
  let running = false, raf = 0, last = performance.now(), time = 0;

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Recua a câmera até caber ~40 unidades de largura e ~56 de altura
    const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = Math.max(56 / k, 40 / (camera.aspect * k));
    camera.updateProjectionMatrix();
  }
  // Centro da peça (coração + chamas) um pouco acima do meio, longe do texto
  const baseY = () => (canvas.clientWidth < 760 ? -2 : -6);
  root.position.y = baseY();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    levelS += (level - levelS) * Math.min(1, dt * 18);
    pointerS.x += (pointer.x - pointerS.x) * Math.min(1, dt * 4);
    pointerS.y += (pointer.y - pointerS.y) * Math.min(1, dt * 4);

    const idle = reduced ? 0 : Math.sin(time * 0.5) * 0.18;
    const target = -0.35 + progress * Math.PI * 1.6 + idle + pointerS.x * 0.35;
    rotY += (target - rotY) * Math.min(1, dt * 5);
    root.rotation.y = rotY;
    root.rotation.x = pointerS.y * 0.18 + (reduced ? 0 : Math.sin(time * 0.7) * 0.04);
    root.position.y += (baseY() + (reduced ? 0 : Math.sin(time * 0.9) * 0.8) - root.position.y) * 0.08;

    const s = 1 + levelS * 0.09;
    pulse.scale.setScalar(s);
    candy.emissiveIntensity = 0.6 + levelS * 2.2;

    if (!reduced) {
      for (const f of flames) {
        const p = f.userData.phase;
        f.rotation.z = f.userData.lean + Math.sin(time * 2.1 + p) * 0.05;
        f.scale.y = 1 + Math.sin(time * 3.2 + p) * 0.05 + levelS * 0.25;
      }
      const a = pGeo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        a[i * 3 + 1] += speed[i] * dt * (1 + levelS * 2);
        a[i * 3] += Math.sin(time + i) * dt * 0.6;
        if (a[i * 3 + 1] > 38) a[i * 3 + 1] = -36;
      }
      pGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '100px' });
  io.observe(canvas);
  renderer.render(scene, camera);

  return {
    setProgress(p) { progress = p; if (!running) frame(performance.now()); },
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    setLevel(l) { level = l; },
    dispose() {
      stop(); ro.disconnect(); io.disconnect();
      renderer.dispose();
    },
  };
}
