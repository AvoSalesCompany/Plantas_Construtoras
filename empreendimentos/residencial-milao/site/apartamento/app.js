(function () {
  'use strict';
  /* Divide cada parede em trechos sólidos, peitoris e vergas conforme as aberturas. Resultado em px (planta) e metros (altura). */
  window.buildArch = function (P, H) {
    var out = { walls: [], windows: [], doors: [] };
    P.walls.forEach(function (w) {
      var x1 = w.r[0], y1 = w.r[1], x2 = w.r[2], y2 = w.r[3];
      var horiz = (x2 - x1) >= (y2 - y1);
      var A0 = horiz ? x1 : y1, A1 = horiz ? x2 : y2, C0 = horiz ? y1 : x1, C1 = horiz ? y2 : x2;
      var opens = (w.open || []).slice().sort(function (p, q) { return p.a - q.a; });
      function seg(a, b, h0, h1, kind) {
        if (b - a <= 0.01 || h1 - h0 <= 0.001) return;
        out.walls.push({ horiz: horiz, a: a, b: b, c0: C0, c1: C1, h0: h0, h1: h1, kind: kind, wall: w.id });
      }
      var cur = A0;
      opens.forEach(function (o) {
        seg(cur, o.a, 0, H, 'solid');
        if (o.kind === 'win') {
          var sp = P.windows[o.win];
          seg(o.a, o.b, 0, Math.min(sp.sill, H), 'below');
          if (sp.top < H) seg(o.a, o.b, sp.top, H, 'lintel');
          out.windows.push({ id: o.win, horiz: horiz, a: o.a, b: o.b, c0: C0, c1: C1, spec: sp, wall: w.id });
        } else {
          if (P.doorTop < H) seg(o.a, o.b, P.doorTop, H, 'lintel');
          out.doors.push({ id: o.door, horiz: horiz, a: o.a, b: o.b, c0: C0, c1: C1, spec: P.doors[o.door], wall: w.id });
        }
        cur = o.b;
      });
      seg(cur, A1, 0, H, 'solid');
    });
    return out;
  };

  function hashQuery() {
    const q = {};
    try { (location.hash || '').replace(/^#/, '').split('&').forEach(function (kv) { const p = kv.split('='); if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); }); } catch (e) { /* sem parâmetros */ }
    return q;
  }
  /* AptEngine.create(opts) monta a maquete.
     Página avulsa: lê o endereço (#tipo=com-sacada&andar=8&apto=801&torre=A) e desenha sozinha.
     Dentro do site do prédio (opts.integrated): usa o renderizador e o canvas do prédio, fica no lugar do apto no bloco
     (opts.integrated.matrix leva da maquete para o mundo), desenha o prédio junto com a mesma câmera, deixa sair pelo corredor
     e devolve dispose() para sair do apto. */
  function create(opts) {
    opts = opts || {};
    const P = window.PLANS && window.PLANS[opts.tipo === 'com-sacada' ? 'com-sacada' : 'sem-sacada'];
    if (!window.THREE || !window.THREE.OrbitControls || !P) throw new Error('Biblioteca 3D indisponível');
    window.PLAN = P;
    return main(P, opts);
  }
  window.AptEngine = { create: create };

  if (document.getElementById('c') && !window.APT_NO_AUTOSTART) {
    const q = hashQuery();
    const errBox = document.getElementById('err'), loadingEl = document.getElementById('loading');
    const fail = function (e) {
      console.error(e);
      if (loadingEl) loadingEl.hidden = true;
      if (errBox) errBox.hidden = false;
      try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'apt:error' }, '*'); } catch (e2) { /* sem site em volta */ }
    };
    if (window.__aptLibFail) fail(new Error('Biblioteca 3D indisponível'));
    else {
      try {
        window.__apt = create({
          tipo: q.tipo, andar: q.andar, apto: q.apto, torre: q.torre, embed: q.embed === '1',
          onReady: function () {
            if (errBox) errBox.hidden = true;
            if (loadingEl) { loadingEl.classList.add('done'); setTimeout(function () { loadingEl.hidden = true; }, 500); }
          }
        });
      } catch (e) { fail(e); }
    }
  }

  function main(P, opts) {
    const INTEG = opts.integrated || null;
    const S = P.scale, OX = P.origin[0], OY = P.origin[1];
    const mx = (p) => (p - OX) / S;
    const mz = (p) => (p - OY) / S;
    const W = mx(P.extent[0]), D = mz(P.extent[1]), CX = W / 2, CZ = D / 2;
    const wx = (p) => mx(p) - CX, wz = (p) => mz(p) - CZ;
    const H_HIGH = P.H, H_LOW = 0.9, EYE = 1.6, RADIUS = 0.22, DEG = Math.PI / 180;
    const APT_Q = { andar: opts.andar, apto: opts.apto, torre: opts.torre };
    const APT_FLOOR = Math.max(1, Math.min(12, parseInt(APT_Q.andar, 10) || 5));
    const GROUND_Y = INTEG ? -INTEG.floorY : -2.84 * APT_FLOOR;   // piso do apartamento: andar x 2,84 m acima do térreo
    const EMBED = !!opts.embed;                                // aberto num iframe: o site em volta controla a visita por mensagens
    if (!INTEG) (function () {
      const eb = document.querySelector('.title .eyebrow');
      if (eb && APT_Q.apto) eb.textContent = 'Residencial Milão · Apto ' + APT_Q.apto + (APT_Q.torre ? ' · Torre ' + APT_Q.torre : '') + ' · ' + APT_FLOOR + 'º andar';
      const h1 = document.querySelector('.title h1'); if (h1) h1.textContent = P.meta.titulo;
      const area = document.getElementById('factArea'); if (area) area.textContent = P.meta.area + ' m²';
      const tot = document.getElementById('roomsTotal'); if (tot) tot.textContent = P.meta.comodos + ' m²';
      const note = document.querySelector('.rooms .note');
      if (note) note.innerHTML = note.innerHTML.replace('5º andar', APT_FLOOR + 'º andar').replace('camas e sofá', P.id === 'com-sacada' ? 'porta da sacada, camas e sofá' : 'camas e sofá');
      document.title = 'Milão ' + (P.id === 'com-sacada' ? 'Com' : 'Sem') + ' Sacada 3D';
      const cv = document.getElementById('c'); if (cv) cv.setAttribute('aria-label', 'Modelo 3D interativo do ' + P.meta.titulo.toLowerCase() + '. Arraste para girar.');
    })();
    const SUN_EL = 42 * DEG, SUN_AZ = 25 * DEG;               // sol ao norte-nordeste (hemisfério sul): entra pelas janelas do norte
    const SUN_DIR = new THREE.Vector3(Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), -Math.cos(SUN_AZ) * Math.cos(SUN_EL)).normalize();
    // no prédio: matriz da maquete para o mundo (gira 180° nos aptos da frente, espelha dois cantos) e o sol do prédio
    const U = INTEG ? new THREE.Matrix4().fromArray(INTEG.matrix) : null;
    const UINV = U ? U.clone().invert() : null;
    const MX = INTEG && INTEG.mirror ? -1 : 1;                 // apto espelhado: direita na tela é esquerda na maquete
    if (INTEG && INTEG.sunDir) SUN_DIR.fromArray(INTEG.sunDir).transformDirection(UINV);
    const SHUT = { fw: 0.045, pitch: 0.047, up: 2 * 0.047 };  // persiana: moldura, passo das lâminas, lâminas visíveis quando recolhida
    const PLAN_IMG = (opts.base || '') + P.meta.img;                               // planta oficial (sobreposição)
    const dbg = window.__DEBUG ? (window.__debug = { boxes: [], circles: [], doors: [] }) : null;
    const mm = (q) => !!(window.matchMedia && matchMedia(q).matches);
    const coarse = mm('(pointer: coarse)');
    const reduceMotion = mm('(prefers-reduced-motion: reduce)');
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dummies = {};
    const $ = function (id) {                                  // no prédio, o que o painel do site já faz vira elemento solto (não aparece)
      if (opts.dom && opts.dom[id]) return opts.dom[id];
      if (!INTEG) return document.getElementById(id);
      if (!dummies[id]) dummies[id] = document.createElement(id === 'rooms' ? 'details' : id === 'roomList' ? 'ul' : /^[vt][A-Z0-9]/.test(id) ? 'button' : 'div');
      return dummies[id];
    };
    const offs = [];                                            // ouvintes registrados: dispose() solta todos
    function on(t, type, fn, o) { if (!t || !t.addEventListener) return; t.addEventListener(type, fn, o); offs.push(function () { t.removeEventListener(type, fn, o); }); }

    /* ---------------- renderizador, cena, câmera ---------------- */
    const stage = $('stage');
    const canvas = INTEG ? opts.canvas : $('c');
    const renderer = INTEG ? opts.renderer : new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    if (!INTEG) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    renderer.localClippingEnabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    let needsRender = true;
    const markDirty = () => { needsRender = true; };
    const dirtyShadows = () => { renderer.shadowMap.needsUpdate = true; needsRender = true; };
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    on(canvas, 'webglcontextlost', function (e) { e.preventDefault(); }, false);
    on(canvas, 'webglcontextrestored', function () { dirtyShadows(); }, false);

    const scene = new THREE.Scene();
    if (U) { scene.matrixAutoUpdate = false; scene.matrix.copy(U); }   // a maquete inteira vai para o lugar do apto no bloco
    const camera = new THREE.PerspectiveCamera(36, 1, 0.15, 3000);    // câmera da maquete (coordenadas da planta)
    const camW = INTEG ? new THREE.PerspectiveCamera(36, 1, 0.15, 3000) : null;   // a mesma câmera no mundo do prédio
    const root = new THREE.Group();
    root.position.set(-CX, 0, -CZ);
    scene.add(root);

    let interiorEnv = null, skyEnv = null;
    try {
      const env = new THREE.Scene();
      const box = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 14), new THREE.MeshBasicMaterial({ color: 0x8c8f94, side: THREE.BackSide }));
      box.position.y = 3.5; env.add(box);
      const lm = new THREE.MeshBasicMaterial({ color: 0xffffff });
      [[0, 6.9, 0, 7, 0.1, 5], [-6.9, 3.6, 0, 0.1, 2.6, 6], [6.9, 3.8, 2, 0.1, 1.8, 3.4], [0, 3.4, -6.9, 6, 2.4, 0.1]].forEach(function (a) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(a[3], a[4], a[5]), lm); m.position.set(a[0], a[1], a[2]); env.add(m);
      });
      const pm = new THREE.PMREMGenerator(renderer);
      interiorEnv = pm.fromScene(env, 0.04).texture;
      pm.dispose();
    } catch (e) { console.warn('environment', e); }

    const hemi = new THREE.HemisphereLight(0xeaf2ff, 0xb8ab96, 0.46);
    scene.add(hemi);
    if (U) hemi.updateMatrixWorld = function () { this.matrixWorld.makeTranslation(0, 1, 0); };   // o céu continua em cima, onde quer que o apto esteja
    scene.add(new THREE.AmbientLight(0xffffff, 0.1));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.5);
    sun.target.position.set(0, 1.2, 0);
    sun.position.set(SUN_DIR.x * 20, 1.2 + SUN_DIR.y * 20, SUN_DIR.z * 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -4.9; sun.shadow.camera.right = 4.9; sun.shadow.camera.top = 4.9; sun.shadow.camera.bottom = -4.9;
    sun.shadow.camera.near = 4; sun.shadow.camera.far = 36;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);

    /* ---------------- texturas procedurais ---------------- */
    function rng(seed) {
      return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function canvasTex(w, h, draw) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
      return t;
    }
    function plank(g, x, y, len, rh, hue, sat, lig, rr) {
      g.save(); g.beginPath(); g.rect(x, y, len, rh); g.clip();
      g.fillStyle = 'hsl(' + hue + ',' + sat + '%,' + lig + '%)'; g.fillRect(x, y, len, rh);
      for (let i = 0; i < 10; i++) {
        const gy = y + rr() * rh, amp = 0.8 + rr() * 2.2, ph = rr() * 6.28, fr = 0.004 + rr() * 0.012;
        g.strokeStyle = 'hsla(' + (hue - 4) + ',' + (sat + 6) + '%,' + (lig - 12 - rr() * 12) + '%,' + (0.08 + rr() * 0.12) + ')';
        g.lineWidth = 0.6 + rr() * 1.4;
        g.beginPath();
        for (let k = 0; k <= len + 8; k += 8) { const yy = gy + Math.sin(ph + k * fr) * amp; if (k === 0) g.moveTo(x + k, yy); else g.lineTo(x + k, yy); }
        g.stroke();
      }
      g.fillStyle = 'rgba(70,46,28,.36)'; g.fillRect(x, y, len, 1.5); g.fillRect(x, y, 1.6, rh);
      g.fillStyle = 'rgba(255,242,224,.10)'; g.fillRect(x, y + 1.5, len, 1.2);
      g.restore();
    }
    const texLam = canvasTex(1024, 1024, function (g, w, h) {
      const r = rng(11), rows = 16, rh = h / rows;
      g.fillStyle = '#c6a483'; g.fillRect(0, 0, w, h);
      for (let row = 0; row < rows; row++) {
        const y = row * rh;
        let x = r() * w; const end = x + w;
        while (x < end - 1) {
          let len = w * (0.26 + r() * 0.16);
          if (end - (x + len) < w * 0.12) len = end - x;
          const hue = 27 + r() * 6, sat = 33 + r() * 11, lig = 61 + (r() - 0.5) * 9, seed = (r() * 1e9) | 0;
          [0, -w].forEach(function (off) { const px = x + off; if (px + len >= 0 && px <= w) plank(g, px, y, len, rh, hue, sat, lig, rng(seed)); });
          x += len;
        }
      }
    });
    function tilesTex(w, h, nx, ny, base, grout, seed) {
      return canvasTex(w, h, function (g) {
        const r = rng(seed), tw = w / nx, th = h / ny;
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
          const v = Math.round((r() - 0.5) * 5);
          g.fillStyle = 'rgb(' + (base[0] + v) + ',' + (base[1] + v) + ',' + (base[2] + v) + ')';
          g.fillRect(i * tw, j * th, tw, th);
          const grd = g.createLinearGradient(i * tw, j * th, (i + 1) * tw, (j + 1) * th);
          grd.addColorStop(0, 'rgba(255,255,255,.10)'); grd.addColorStop(1, 'rgba(0,0,0,.03)');
          g.fillStyle = grd; g.fillRect(i * tw, j * th, tw, th);
        }
        g.fillStyle = grout;
        for (let i = 0; i <= nx; i++) g.fillRect(i * tw - 1.5, 0, 3, h);
        for (let j = 0; j <= ny; j++) g.fillRect(0, j * th - 1.5, w, 3);
      });
    }
    const texTileK = tilesTex(512, 512, 2, 2, [246, 246, 245], '#d9dbde', 3);
    const texTileB = tilesTex(512, 512, 2, 2, [247, 247, 246], '#d7d9dc', 5);
    const texTileW = tilesTex(512, 512, 2, 4, [245, 246, 246], '#dcdee1', 9);
    const texGranite = canvasTex(256, 256, function (g, w, h) {
      const r = rng(21); g.fillStyle = '#3e3e40'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const c = r(); g.fillStyle = c < 0.45 ? 'rgba(20,20,22,.55)' : c < 0.85 ? 'rgba(92,92,96,.5)' : 'rgba(150,150,154,.45)';
        g.beginPath(); g.arc(r() * w, r() * h, 0.5 + r() * 1.6, 0, 6.283); g.fill();
      }
    });
    texGranite.repeat.set(1.8, 1.8);
    const texFabric = canvasTex(256, 256, function (g, w, h) {
      const r = rng(31); g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.07)'; g.fillRect(r() * w, r() * h, 1.2, 1.2); }
    });
    texFabric.repeat.set(3, 3);
    const texStripes = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#a8aebb'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) { g.fillStyle = '#7f8697'; g.fillRect(x, 0, 6, h); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 10, 0, 2, h); }
    });
    const texShaft = canvasTex(512, 128, function (g, w, h) {
      g.fillStyle = '#d8dadd'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8d929a'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
      g.beginPath(); g.moveTo(10, 10); g.lineTo(w - 10, h - 10); g.moveTo(w - 10, 10); g.lineTo(10, h - 10); g.stroke();
    });
    const texWater = canvasTex(64, 256, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(190,226,246,.32)'; g.fillRect(0, 0, w, h);
      const r = rng(77);
      for (let i = 0; i < 46; i++) {
        const x = r() * w, len = 18 + r() * 70, y = r() * h, a = 0.25 + r() * 0.55, lw = 1.2 + r() * 2.4;
        g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.fillRect(x, y, lw, len);
        if (y + len > h) g.fillRect(x, y - h, lw, len);
      }
    });
    texWater.repeat.set(1, 2.5);
    const texWater2 = texWater.clone(); texWater2.needsUpdate = true; texWater2.repeat.set(9, 1.6);
    function rugTex(kind, w, d) {
      const cw = 512, ch = Math.max(64, Math.round(512 * d / w));
      return canvasTex(cw, ch, function (g, W2, H2) {
        const r = rng(kind.length * 97 + 5);
        g.fillStyle = kind === 'gray' ? '#9b9897' : kind === 'stripe' ? '#e8e8e6' : '#d5d5d4';
        g.fillRect(0, 0, W2, H2);
        for (let i = 0; i < 14000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.07)'; g.fillRect(r() * W2, r() * H2, 1 + r() * 1.6, 1 + r() * 1.6); }
        if (kind === 'stripe') for (let x = 7; x < W2; x += 15) { g.fillStyle = 'rgba(140,140,140,.20)'; g.fillRect(x, 0, 3, H2); }
        g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 8; g.strokeRect(4, 4, W2 - 8, H2 - 8);
      });
    }
    // TV: jogo de futebol desenhado em canvas e animado enquanto a TV está ligada
    const tvCanvas = document.createElement('canvas'); tvCanvas.width = 512; tvCanvas.height = 288;
    const tvCtx = tvCanvas.getContext('2d');
    const tvTex = new THREE.CanvasTexture(tvCanvas); tvTex.encoding = THREE.sRGBEncoding;
    const gameCanvas = document.createElement('canvas'); gameCanvas.width = 512; gameCanvas.height = 288;
    const gameCtx = gameCanvas.getContext('2d');
    const gameTex = new THREE.CanvasTexture(gameCanvas); gameTex.encoding = THREE.sRGBEncoding;
    function drawGame(t) {
      const g = gameCtx, w = 512, h = 288, hz = 118, curve = Math.sin(t * 0.5) * 70;
      const sk = g.createLinearGradient(0, 0, 0, hz); sk.addColorStop(0, '#3b6fd8'); sk.addColorStop(1, '#f2a65a');
      g.fillStyle = sk; g.fillRect(0, 0, w, hz);
      g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(380 - curve * 0.3, hz - 4, 26, Math.PI, 0); g.fill();
      g.fillStyle = '#5b4a7a'; g.beginPath(); g.moveTo(0, hz);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, hz - 16 - 22 * Math.abs(Math.sin((x - curve * 0.3) * 0.013 + 1.3)) - 8 * Math.sin((x - curve * 0.3) * 0.05));
      g.lineTo(w, hz); g.fill();
      for (let y = hz; y < h; y += 2) {
        const p = (y - hz) / (h - hz), z = 1 / (p + 0.03), cx = w / 2 + curve * (1 - p) * (1 - p), half = 10 + p * 240;
        const band = Math.floor(z * 2.2 + t * 16) % 2;
        g.fillStyle = band ? '#3f8f3a' : '#4aa043'; g.fillRect(0, y, w, 2);
        g.fillStyle = band ? '#d23a2e' : '#f4f4f4'; g.fillRect(cx - half * 1.1, y, half * 2.2, 2);
        g.fillStyle = band ? '#5c5f66' : '#63666d'; g.fillRect(cx - half, y, half * 2, 2);
        if (band) { g.fillStyle = '#f2f2f2'; g.fillRect(cx - half * 0.025, y, half * 0.05, 2); }
      }
      const car = function (x, y, s, body) {
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 46 * s, y + 4 * s, 92 * s, 8 * s);
        g.fillStyle = '#16171a'; g.fillRect(x - 44 * s, y - 6 * s, 16 * s, 14 * s); g.fillRect(x + 28 * s, y - 6 * s, 16 * s, 14 * s);
        g.fillStyle = body; g.fillRect(x - 40 * s, y - 26 * s, 80 * s, 26 * s);
        g.fillStyle = '#2b3542'; g.fillRect(x - 26 * s, y - 42 * s, 52 * s, 17 * s);
        g.fillStyle = body; g.fillRect(x - 30 * s, y - 46 * s, 60 * s, 5 * s);
        g.fillStyle = '#ff5a4a'; g.fillRect(x - 38 * s, y - 20 * s, 14 * s, 6 * s); g.fillRect(x + 24 * s, y - 20 * s, 14 * s, 6 * s);
      };
      const pr = 0.32 + 0.08 * Math.sin(t * 0.4), rcx = w / 2 + curve * (1 - pr) * (1 - pr) + Math.sin(t * 0.9) * (10 + pr * 120);
      car(rcx, hz + pr * (h - hz), 0.25 + pr * 0.6, '#2f63c8');
      car(w / 2 + Math.sin(t * 1.3) * 34, h - 22, 1.15, '#d4352b');
      g.fillStyle = 'rgba(10,14,24,.72)'; g.fillRect(12, 12, 74, 40); g.fillRect(w - 128, 12, 116, 30); g.fillRect(w - 150, h - 46, 138, 34);
      g.fillStyle = '#ffffff'; g.font = '700 30px Arial, sans-serif'; g.fillText('1º', 26, 44);
      g.font = '600 17px Arial, sans-serif'; g.fillText('VOLTA 2/3', w - 116, 34);
      g.font = '700 22px Arial, sans-serif'; g.fillText(Math.round(205 + 12 * Math.sin(t * 0.7)) + ' km/h', w - 140, h - 21);
      gameTex.needsUpdate = true;
    }
    function drawTV(t) {
      const g = tvCtx, w = 512, h = 288;
      for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#2f8f3a' : '#37a245'; g.fillRect(i * w / 10, 0, w / 10 + 1, h); }
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
      g.strokeRect(14, 14, w - 28, h - 28);
      g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2, h - 14); g.stroke();
      g.beginPath(); g.arc(w / 2, h / 2, 40, 0, 6.283); g.stroke();
      g.strokeRect(14, h / 2 - 62, 62, 124); g.strokeRect(w - 76, h / 2 - 62, 62, 124);
      const bx = w / 2 + Math.sin(t * 0.9) * 170, by = h / 2 + Math.sin(t * 1.7) * 82;
      for (let i = 0; i < 12; i++) {
        const px = ((i % 6) + 1) * w / 7 + Math.sin(t * 0.8 + i) * 16 + (bx - w / 2) * 0.22;
        const py = (i < 6 ? 0.32 : 0.68) * h + Math.cos(t * 1.1 + i * 1.7) * 24 + (by - h / 2) * 0.28;
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(px + 2, py + 6, 7, 3, 0, 0, 6.283); g.fill();
        g.fillStyle = i % 2 ? '#f2d23c' : '#1d3fa8'; g.beginPath(); g.arc(px, py, 7, 0, 6.283); g.fill();
      }
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(bx, by, 5, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(10,14,24,.8)'; g.fillRect(16, 16, 168, 30);
      g.fillStyle = '#e23b3b'; g.beginPath(); g.arc(30, 31, 5, 0, 6.283); g.fill();
      g.fillStyle = '#ffffff'; g.font = '600 16px Arial, sans-serif'; g.fillText('AO VIVO   2 x 1', 42, 37);
      tvTex.needsUpdate = true;
    }

    /* ---------------- céu, sol e texturas do exterior ---------------- */
    /* TEX:BEGIN */
    function softBlob(g, x, y, rx, ry, a, col) {
      g.save(); g.translate(x, y); g.scale(1, Math.max(0.05, ry / rx));
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, 'rgba(' + col + ',' + a + ')'); gr.addColorStop(0.55, 'rgba(' + col + ',' + (a * 0.6) + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, 6.2832); g.fill(); g.restore();
    }
    function drawSky(g, w, h) {
      const gr = g.createLinearGradient(0, 0, 0, h);
      [[0, '#2a5fae'], [0.18, '#3a78c6'], [0.33, '#5f9bd9'], [0.43, '#94c0e8'], [0.48, '#bcd6ee'], [0.5, '#d3e2ec'], [0.515, '#c8d5d8'], [0.56, '#a9b7a5'], [0.7, '#8a9a83'], [1, '#6f7f69']]
        .forEach(function (s) { gr.addColorStop(s[0], s[1]); });
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = rng(4242);
      for (let i = 0; i < 64; i++) {
        const el = 3 + Math.pow(r(), 1.7) * 38;            // elevação (graus): mais nuvens perto do horizonte
        const cy = (0.5 - el / 180) * h;
        const sz = (0.35 + r() * 0.9) * (14 + el * 2.1);    // nuvens distantes ficam menores
        const flat = 0.22 + el / 90;                         // e mais achatadas
        const cx = r() * w, puffs = 5 + Math.floor(r() * 7);
        for (let k = 0; k < puffs; k++) {
          const px = cx + (r() - 0.5) * sz * 1.6, py = cy + (r() - 0.6) * sz * flat * 0.7, pr = sz * (0.32 + r() * 0.4);
          [0, -w, w].forEach(function (o) {
            if (px + o + pr < 0 || px + o - pr > w) return;
            softBlob(g, px + o, py + pr * flat * 0.35, pr * 1.05, pr * flat * 0.9, 0.18, '150,165,185');
            softBlob(g, px + o, py, pr, pr * flat, 0.62, '255,255,255');
          });
        }
      }
    }
    function drawSun(g, w, h) {
      const c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
      gr.addColorStop(0, 'rgba(255,255,250,1)'); gr.addColorStop(0.055, 'rgba(255,253,240,1)'); gr.addColorStop(0.09, 'rgba(255,240,200,.55)');
      gr.addColorStop(0.25, 'rgba(255,230,180,.16)'); gr.addColorStop(0.6, 'rgba(255,225,170,.04)'); gr.addColorStop(1, 'rgba(255,225,170,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    function drawBeam(g, w, h) {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) {
        const v = y / (h - 1), along = Math.pow(1 - v, 1.25) * 0.85 + 0.15, start = Math.min(1, v / 0.06);
        for (let x = 0; x < w; x++) {
          const u = x / (w - 1), e = Math.min(1, Math.min(u, 1 - u) / 0.22), a = along * start * e * e * (3 - 2 * e);
          const i = (y * w + x) * 4; d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = Math.round(255 * a);
        }
      }
      g.putImageData(img, 0, 0);
    }
    function drawSwirl(g, w, h) {
      const c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
      gr.addColorStop(0, '#5f9bb0'); gr.addColorStop(0.55, '#a9d2de'); gr.addColorStop(1, '#e4f2f5');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        g.lineWidth = 2 + (k % 3); g.beginPath();
        for (let t = 0; t <= 1.001; t += 0.02) {
          const a = k / 7 * 6.2832 + t * 4.2, rr = c * (0.12 + t * 0.8), x = c + Math.cos(a) * rr, y = c + Math.sin(a) * rr;
          if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    function speckle(g, w, h, n, seed, a) {
      const r = rng(seed);
      for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,' + a + ')' : 'rgba(255,255,255,' + (a * 1.4) + ')'; g.fillRect(r() * w, r() * h, 2 + r() * 4, 2 + r() * 4); }
    }
    // fachada de prédio: 2 vãos (6 m) x 3 andares (8,4 m)
    function drawFacade(g, w, h, wallCol, seed) {
      const r = rng(seed), mpx = w / 6, fh = h / 3;
      g.fillStyle = wallCol; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 1800, seed + 1, 0.035);
      for (let f = 0; f < 3; f++) {
        const base = (f + 1) * fh;
        g.fillStyle = 'rgba(0,0,0,.13)'; g.fillRect(0, base - 0.18 * mpx, w, 0.18 * mpx);
        g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, base - 0.2 * mpx, w, 2);
        const win = function (x0, x1, sill, top, pers) {
          const X0 = x0 * mpx, X1 = x1 * mpx, Y0 = base - top * mpx, Y1 = base - sill * mpx;
          g.fillStyle = '#f4f4f1'; g.fillRect(X0 - 5, Y0 - 5, X1 - X0 + 10, Y1 - Y0 + 10);
          const gg = g.createLinearGradient(0, Y0, 0, Y1); gg.addColorStop(0, '#8aa2b4'); gg.addColorStop(0.5, '#43586a'); gg.addColorStop(1, '#2b3a47');
          g.fillStyle = gg; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
          g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(X0, Y0); g.lineTo(X0 + (X1 - X0) * 0.45, Y0); g.lineTo(X0, Y0 + (Y1 - Y0) * 0.6); g.fill();
          g.fillStyle = '#e8e9e7'; g.fillRect((X0 + X1) / 2 - 2, Y0, 4, Y1 - Y0);
          if (pers) {
            const ph = (Y1 - Y0) * pers;
            g.fillStyle = '#d9dcdc'; g.fillRect(X0, Y0, X1 - X0, ph);
            g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = Y0 + 5; y < Y0 + ph; y += 6) g.fillRect(X0, y, X1 - X0, 1.5);
          }
          g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(X0 - 6, Y1 + 5, X1 - X0 + 12, 5);
        };
        win(0.7, 2.3, 0.95, 2.25, r() < 0.4 ? 0.2 + r() * 0.5 : 0);
        win(3.75, 5.0, 1.1, 2.2, 0.05 + r() * 0.9);
        win(5.3, 5.85, 1.6, 2.15, 0);
      }
    }
    // fachada do nosso prédio abaixo do apartamento: parede branca com a borda da laje a cada 2,8 m
    function drawBand(g, w, h) {
      g.fillStyle = '#eceae4'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 260, 77, 0.03);
      const bh = h * 0.16 / 2.84;
      g.fillStyle = '#c4c1b9'; g.fillRect(0, 0, w, bh);
      g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(0, bh, w, 2);
    }
    // casa térrea (1) ou sobrado (2): uma fachada genérica esticada em cada face
    function drawHouse(g, w, h, floors) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 160, 5 + floors, 0.04);
      const fh = h / floors;
      const win = function (x0, x1, y0, y1) {
        g.fillStyle = '#f6f6f3'; g.fillRect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6);
        g.fillStyle = '#4a5661'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x0, y0, (x1 - x0) * 0.35, y1 - y0);
      };
      for (let f = 0; f < floors; f++) {
        const t = f * fh;
        win(w * 0.1, w * 0.3, t + fh * 0.3, t + fh * 0.64);
        win(w * 0.68, w * 0.9, t + fh * 0.3, t + fh * 0.64);
        if (f < floors - 1) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, t + fh - 3, w, 3); }
      }
      g.fillStyle = '#6d4c35'; g.fillRect(w * 0.43, h - fh * 0.62, w * 0.14, fh * 0.62);
      g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, h - 6, w, 6);
    }
    function drawGrass(g, w, h) {
      g.fillStyle = '#6f8b4c'; g.fillRect(0, 0, w, h);
      const r = rng(808);
      for (let i = 0; i < 2600; i++) { const c = r(); g.fillStyle = c < 0.5 ? 'rgba(52,78,34,.16)' : c < 0.85 ? 'rgba(140,165,92,.14)' : 'rgba(170,160,110,.12)'; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
    }
    function drawPool(g, w, h) {
      g.fillStyle = '#3cb2d6'; g.fillRect(0, 0, w, h);
      const r = rng(31);
      g.strokeStyle = 'rgba(235,252,255,.35)'; g.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        g.beginPath(); const y0 = r() * h;
        for (let x = 0; x <= w; x += 8) { const y = y0 + Math.sin(x * 0.05 + i) * 6 + Math.sin(x * 0.13 + i * 2) * 3; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      }
    }
    /* TEX:END */
    const texSky = canvasTex(1024, 512, drawSky); texSky.wrapT = THREE.ClampToEdgeWrapping;
    const texSun = canvasTex(256, 256, drawSun);
    const texBeam = canvasTex(64, 256, drawBeam); texBeam.wrapS = texBeam.wrapT = THREE.ClampToEdgeWrapping;
    const texSwirl = canvasTex(256, 256, drawSwirl); texSwirl.center.set(0.5, 0.5);
    try {
      const envS = new THREE.Scene();
      envS.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: texSky, side: THREE.BackSide })));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.2, 6.8) }));
      ball.position.set(SUN_DIR.x * 40, SUN_DIR.y * 40, SUN_DIR.z * 40); envS.add(ball);
      const pm2 = new THREE.PMREMGenerator(renderer);
      skyEnv = pm2.fromScene(envS, 0.02).texture;
      pm2.dispose();
    } catch (e) { console.warn('sky env', e); }
    scene.environment = skyEnv;

    /* ---------------- iluminação por cômodo (shader) ----------------
       Cada luz (plafons, abajures, luz do dia que entra pela janela) só ilumina o próprio cômodo — não atravessa paredes.
       A luz rebatida (ambiente) de cada cômodo segue o quanto entra de luz: janela/persiana aberta, porta, luz acesa. */
    const APT_U = {
      aptRects: { value: new Float32Array(40) },
      aptToLocal: { value: UINV ? UINV.clone() : new THREE.Matrix4() },
      aptZoneFill: { value: new THREE.Vector4(1, 1, 1, 1) },
      aptPZone: { value: new Float32Array(4) },
      aptSZone: { value: new Float32Array(4) }
    };
    let aptLevel = 2, aptChunk;
    const APT_FRAG = [
      'varying vec3 vAptWorld;',
      'uniform vec4 aptRects[ 10 ];',
      'uniform vec4 aptZoneFill;',
      'float aptIn( vec4 r, vec2 p ) { return step( r.x, p.x ) * step( p.x, r.z ) * step( r.y, p.y ) * step( p.y, r.w ); }',
      'vec4 aptZoneAt( vec3 w ) {',
      '  vec2 p = w.xz;',
      '  float dA = aptIn( aptRects[ 1 ], p ), dB = aptIn( aptRects[ 3 ], p ), dC = aptIn( aptRects[ 5 ], p );',
      '  float z1 = max( aptIn( aptRects[ 0 ], p ), dA );',
      '  float z2 = max( aptIn( aptRects[ 2 ], p ), dB );',
      '  float z3 = max( aptIn( aptRects[ 4 ], p ), dC );',
      '  float z4 = max( max( aptIn( aptRects[ 6 ], p ), aptIn( aptRects[ 7 ], p ) ), max( aptIn( aptRects[ 8 ], p ), aptIn( aptRects[ 9 ], p ) ) );',
      '  return vec4( z1, z2, z3, max( z4, max( dA, max( dB, dC ) ) ) );',
      '}',
      'float aptFillAt( vec4 z ) {',
      '  if ( z.x + z.y + z.z + z.w < 0.5 ) return 1.0;',
      '  return max( max( z.x * aptZoneFill.x, z.y * aptZoneFill.y ), max( z.z * aptZoneFill.z, z.w * aptZoneFill.w ) );',
      '}'
    ].join('\n');
    const APT_FRAG_LIGHTS = [
      '#if NUM_POINT_LIGHTS > 0',
      'uniform vec4 aptPZone[ NUM_POINT_LIGHTS ];',
      '#endif',
      '#if NUM_SPOT_LIGHTS > 0',
      'uniform vec4 aptSZone[ NUM_SPOT_LIGHTS ];',
      '#endif'
    ].join('\n');
    function aptLightsChunk() {
      const src = THREE.ShaderChunk && THREE.ShaderChunk.lights_fragment_begin;
      if (typeof src !== 'string') return null;
      const tail = '([\\s\\S]*?)(RE_Direct\\(\\s*directLight\\s*,\\s*geometry\\s*,\\s*material\\s*,\\s*reflectedLight\\s*\\)\\s*;)';
      const reP = new RegExp('(pointLight\\s*=\\s*pointLights\\[\\s*i\\s*\\]\\s*;)' + tail);
      const reS = new RegExp('(spotLight\\s*=\\s*spotLights\\[\\s*i\\s*\\]\\s*;)' + tail);
      if (!reP.test(src) || !reS.test(src)) return null;
      return src
        .replace(reP, function (m, a, b, c) { return a + '\n\t\tif ( pointLight.color.r + pointLight.color.g + pointLight.color.b > 0.0 && dot( aptZ, aptPZone[ i ] ) > 0.5 ) {' + b + c + '\n\t\t}'; })
        .replace(reS, function (m, a, b, c) { return a + '\n\t\tif ( spotLight.color.r + spotLight.color.g + spotLight.color.b > 0.0 && dot( aptZ, aptSZone[ i ] ) > 0.5 ) {' + b + c + '\n\t\t}'; });
    }
    function aptPatch(shader) {
      if (aptLevel <= 0 || !shader) return;
      const fs = shader.fragmentShader, vs = shader.vertexShader;
      if (typeof fs !== 'string' || typeof vs !== 'string') return;
      if (fs.indexOf('#include <common>') < 0 || fs.indexOf('#include <lights_fragment_begin>') < 0 || fs.indexOf('#include <aomap_fragment>') < 0) return;
      if (vs.indexOf('#include <common>') < 0 || vs.indexOf('#include <worldpos_vertex>') < 0) return;
      if (aptChunk === undefined) { try { aptChunk = aptLightsChunk(); } catch (e) { aptChunk = null; } }
      const zoned = aptLevel >= 2 && !!aptChunk;
      shader.uniforms.aptRects = APT_U.aptRects;
      shader.uniforms.aptZoneFill = APT_U.aptZoneFill;
      shader.uniforms.aptToLocal = APT_U.aptToLocal;
      if (zoned) { shader.uniforms.aptPZone = APT_U.aptPZone; shader.uniforms.aptSZone = APT_U.aptSZone; }
      shader.vertexShader = vs
        .replace('#include <common>', function () { return '#include <common>\nvarying vec3 vAptWorld;\nuniform mat4 aptToLocal;'; })
        .replace('#include <worldpos_vertex>', function () {
          return '#include <worldpos_vertex>\n\tvec4 aptWP = vec4( transformed, 1.0 );\n\t#ifdef USE_INSTANCING\n\taptWP = instanceMatrix * aptWP;\n\t#endif\n\tvAptWorld = ( aptToLocal * modelMatrix * aptWP ).xyz;';
        });
      shader.fragmentShader = fs
        .replace('#include <common>', function () { return '#include <common>\n' + APT_FRAG + (zoned ? '\n' + APT_FRAG_LIGHTS : ''); })
        .replace('#include <lights_fragment_begin>', function () { return 'vec4 aptZ = aptZoneAt( vAptWorld );\n' + (zoned ? aptChunk : '#include <lights_fragment_begin>'); })
        .replace('#include <aomap_fragment>', function () {
          return '#include <aomap_fragment>\n\tfloat aptF = aptFillAt( aptZ );\n\treflectedLight.indirectDiffuse *= aptF;\n\treflectedLight.indirectSpecular *= aptF;';
        });
    }
    function aptKey() { return 'apt4-' + aptLevel; }
    // se a placa de vídeo recusar o shader modificado, cai para um modo mais simples (e por fim para o padrão)
    let progSeen = -1;
    function checkPrograms() {
      const list = renderer.info && renderer.info.programs;
      if (!Array.isArray(list) || list.length === progSeen) return;
      progSeen = list.length;
      if (aptLevel <= 0) return;
      const key = 'apt4-' + aptLevel;
      const bad = list.some(function (p) { return p && p.diagnostics && p.diagnostics.runnable === false && String(p.cacheKey || '').indexOf(key) >= 0; });
      if (!bad) return;
      aptLevel--;
      console.warn('iluminação por cômodo: modo ' + aptLevel);
      aptMats.forEach(function (m) { m.needsUpdate = true; });
      progSeen = -1; markDirty();
    }

    /* ---------------- materiais ---------------- */
    const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    const aptMats = [];
    function std(hex, o) {
      o = Object.assign({}, o || {});
      const env = o.env !== undefined ? o.env : 0.55; delete o.env;
      const m = new THREE.MeshStandardMaterial(Object.assign({ color: lin(hex), roughness: 0.85, metalness: 0 }, o));
      if (interiorEnv) m.envMap = interiorEnv;
      m.envMapIntensity = env;
      m.userData.hex = hex;
      m.onBeforeCompile = aptPatch;
      m.customProgramCacheKey = aptKey;
      aptMats.push(m);
      return m;
    }
    const basic = (o) => new THREE.MeshBasicMaterial(Object.assign({ toneMapped: false }, o));
    function drawAcDisplay(g, w, h) {
      g.fillStyle = '#0b0e12'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#6fe3ff'; g.font = '700 34px Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText('22°', 14, h / 2 + 2);
      g.fillStyle = '#5dff9a'; g.beginPath(); g.arc(w - 16, h / 2, 5, 0, 6.2832); g.fill();
    }
    const M = {
      paint: std('#F2F1ED', { roughness: 0.93 }),
      accentWall: std('#0E1A4A', { roughness: 0.9 }),
      accentYellow: std('#E3B62E', { roughness: 0.9 }),
      cap: std('#1C1E23', { roughness: 0.95, env: 0.15 }),
      slab: std('#B5B4AF', { roughness: 0.9 }),
      lam: std('#ffffff', { map: texLam, roughness: 0.6, env: 0.45 }),
      tileK: std('#ffffff', { map: texTileK, roughness: 0.22, env: 0.75 }),
      tileB: std('#ffffff', { map: texTileB, roughness: 0.22, env: 0.75 }),
      tileW: std('#ffffff', { map: texTileW, roughness: 0.2, env: 0.8 }),
      frameWhite: std('#F4F4F2', { roughness: 0.45, env: 0.6 }),
      alu: std('#E9EBEC', { roughness: 0.35, metalness: 0.2, env: 0.8 }),
      slat: std('#D9DCDF', { roughness: 0.5, metalness: 0.1 }),
      glass: std('#d2e6ee', { transparent: true, opacity: 0.2, roughness: 0.05, env: 1.5, depthWrite: false }),
      sillStone: std('#D7D2CA', { roughness: 0.5, env: 0.6 }),
      door: std('#F3F2EE', { roughness: 0.55, env: 0.5 }),
      // porta de entrada em madeira, igual às dos vizinhos no corredor do prédio
      doorWood: std('#ffffff', { map: canvasTex(128, 512, function (g, w, h) {
        const r = rng(808);
        g.fillStyle = '#A9784B'; g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x++) { const k = Math.sin(x * 0.37) * 0.5 + Math.sin(x * 1.7 + 2) * 0.3 + (r() - 0.5) * 0.6; g.fillStyle = k > 0 ? 'rgba(70,40,18,' + (0.10 * k).toFixed(3) + ')' : 'rgba(255,225,180,' + (-0.08 * k).toFixed(3) + ')'; g.fillRect(x, 0, 1, h); }
        for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(80,46,20,.12)'; g.lineWidth = 1 + r(); const x = r() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 14, h / 3, x + (r() - 0.5) * 14, h * 2 / 3, x + (r() - 0.5) * 10, h); g.stroke(); }
      }), roughness: 0.55, env: 0.4 }),
      chrome: std('#D9DCE0', { roughness: 0.18, metalness: 0.9, env: 1.2 }),
      steel: std('#BCC0C4', { roughness: 0.32, metalness: 0.75, env: 1.0 }),
      steelIn: std('#A9ADB2', { roughness: 0.3, metalness: 0.8, env: 1.0, side: THREE.BackSide }),
      ceramic: std('#F6F6F4', { roughness: 0.18, env: 0.9 }),
      wardrobe: std('#EEEEEC', { roughness: 0.55, env: 0.5 }),
      innerWhite: std('#E3E1DC', { roughness: 0.75 }),
      innerDark: std('#3A3B3E', { roughness: 0.7 }),
      seam: std('#9EA2A8', { roughness: 0.8 }),
      nightstand: std('#D7DDE4', { roughness: 0.6 }),
      navyPanel: std('#171D38', { roughness: 0.85 }),
      navy: std('#0E1A4A', { roughness: 0.95 }),
      navyPillow: std('#1F3388', { roughness: 0.95 }),
      sheet: std('#E3E7EC', { roughness: 0.95 }),
      duvet: std('#E9ECF0', { roughness: 0.95 }),
      bedHead1: std('#868B95', { map: texFabric, roughness: 0.95 }),
      bedHead2: std('#7A7D86', { map: texFabric, roughness: 0.95 }),
      bedBase: std('#9DA2AB', { roughness: 0.9 }),
      pillowGray: std('#64666E', { roughness: 0.95 }),
      stripes: std('#ffffff', { map: texStripes, roughness: 0.95 }),
      mustard: std('#C9A452', { roughness: 0.95 }),
      sofa: std('#8E97A6', { map: texFabric, roughness: 0.98 }),
      sofaDark: std('#848C9B', { map: texFabric, roughness: 0.98 }),
      cushionWhite: std('#DCE1E8', { roughness: 0.95 }),
      throwLight: std('#E6E9EE', { roughness: 0.95 }),
      white: std('#EEF1F3', { roughness: 0.5, env: 0.5 }),
      tableTop: std('#F1F3F4', { roughness: 0.35, env: 0.6 }),
      chair: std('#B6BDC8', { map: texFabric, roughness: 0.95 }),
      legDark: std('#2B2D31', { roughness: 0.5, metalness: 0.3 }),
      pouf: std('#686F7C', { map: texFabric, roughness: 0.98 }),
      tv: std('#121316', { roughness: 0.25, metalness: 0.2, env: 1.0 }),
      tvOff: std('#0A0B0D', { roughness: 0.07, metalness: 0.3, env: 1.4 }),
      tvOn: basic({ map: tvTex }),
      tvGame: basic({ map: gameTex }),
      granite: std('#ffffff', { map: texGranite, roughness: 0.25, env: 0.8 }),
      cabinet: std('#EDEEEF', { roughness: 0.45 }),
      toe: std('#5B5E63', { roughness: 0.8 }),
      darkCab: std('#4A4B4E', { roughness: 0.6 }),
      cooktop: std('#0E0F11', { roughness: 0.12, metalness: 0.1, env: 1.2 }),
      burner: std('#7B7F86', { roughness: 0.5, metalness: 0.6 }),
      washer: std('#E9EAEC', { roughness: 0.35, env: 0.7 }),
      darkGlass: std('#1C232B', { roughness: 0.1, metalness: 0.2, env: 1.2 }),
      drum: std('#2A2D33', { roughness: 0.45, metalness: 0.5 }),
      pot: std('#5F6166', { roughness: 0.75 }),
      leaf1: std('#3E6B26', { roughness: 0.8 }),
      leaf2: std('#4F8131', { roughness: 0.8 }),
      leaf3: std('#2F5520', { roughness: 0.8 }),
      flower: std('#B3121B', { roughness: 0.7 }),
      black: std('#1A1A1C', { roughness: 0.4 }),
      wood: std('#CDA977', { roughness: 0.55 }),
      mirror: std('#C9CED4', { roughness: 0.04, metalness: 1, env: 1.3 }),
      shaftTop: std('#ffffff', { map: texShaft, roughness: 0.9 }),
      ceiling: std('#F5F4F0', { roughness: 0.95 }),
      laptop: std('#8C9097', { roughness: 0.35, metalness: 0.6 }),
      screen: std('#20242B', { roughness: 0.15, env: 1 }),
      paper: std('#F7F5F0', { roughness: 0.9 }),
      liner: std('#F1F3F5', { roughness: 0.5, side: THREE.BackSide }),
      linerFront: std('#F1F3F5', { roughness: 0.5 }),
      shelfGlass: std('#dcebf0', { transparent: true, opacity: 0.45, roughness: 0.1, env: 1, depthWrite: false }),
      crisper: std('#e6f2f5', { transparent: true, opacity: 0.55, roughness: 0.2, depthWrite: false }),
      fridgeLightOff: std('#E9ECEF', { roughness: 0.4 }),
      fridgeLightOn: std('#FFFFFF', { roughness: 0.4, emissive: lin('#F4FBFF'), emissiveIntensity: 1.4 }),
      milk: std('#F4F4F2', { roughness: 0.6 }),
      juice: std('#F0A238', { roughness: 0.6 }),
      cheese: std('#E9C94D', { roughness: 0.7 }),
      apple: std('#C0262D', { roughness: 0.35 }),
      pizza: std('#D6B57A', { roughness: 0.8 }),
      ice: std('#D9EEF6', { roughness: 0.3, transparent: true, opacity: 0.8 }),
      bottleGreen: std('#2F6B3A', { roughness: 0.12, env: 1.2 }),
      bottleClear: std('#D7E6EA', { roughness: 0.1, transparent: true, opacity: 0.7, env: 1.2 }),
      potSteel: std('#B9BDC2', { roughness: 0.3, metalness: 0.8 }),
      potRed: std('#B6322C', { roughness: 0.45 }),
      plates: std('#F5F5F2', { roughness: 0.3 }),
      bucket: std('#3B7BD6', { roughness: 0.5 }),
      detergent: std('#F08A2C', { roughness: 0.5 }),
      towel: std('#C9D6E3', { roughness: 0.95 }),
      water: basic({ map: texWater, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
      shower: basic({ map: texWater2, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
      splash: basic({ color: 0xe8f6ff, transparent: true, opacity: 0.55, depthWrite: false }),
      puddle: basic({ color: 0xbfe3f5, transparent: true, opacity: 0.35, depthWrite: false }),
      flame: basic({ color: 0x3d8bff, transparent: true, opacity: 0.9 }),
      flameCore: basic({ color: 0x9fd0ff, transparent: true, opacity: 0.8 }),
      switchPlate: std('#F5F5F2', { roughness: 0.38, env: 0.6 }),
      switchRocker: std('#EDEDE9', { roughness: 0.3, env: 0.6 }),
      seat: std('#FAFAF8', { roughness: 0.28, env: 0.8 }),
      ceramicIn: std('#F3F4F2', { roughness: 0.12, env: 1.0, side: THREE.BackSide }),
      toiletWater: std('#d4ecf2', { map: texSwirl, transparent: true, opacity: 0.75, roughness: 0.04, env: 1.4, depthWrite: false }),
      shadowOnly: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),   // invisível, mas bloqueia o sol (persiana fechada)
      consoleBody: std('#2a2d32', { roughness: 0.42, metalness: 0.15, env: 0.9 }),
      consoleTop: std('#8b919a', { roughness: 0.32, metalness: 0.3, env: 1.0 }),
      consoleVent: std('#141518', { roughness: 0.7 }),
      consoleLed: std('#eaf4ff', { roughness: 0.3, emissive: lin('#dff0ff'), emissiveIntensity: 0.04 }),
      acBody: std('#F3F4F2', { roughness: 0.38, env: 0.75 }),
      acPanel: std('#F8F9F8', { roughness: 0.22, env: 0.9 }),
      acDark: std('#2a2d32', { roughness: 0.6 }),
      acDispOff: std('#1a1c20', { roughness: 0.15, env: 1.0 }),
      acDispOn: basic({ map: canvasTex(128, 48, drawAcDisplay) }),
      padBody: std('#3a3d43', { roughness: 0.55 }),
      padStick: std('#1c1d20', { roughness: 0.6 })
    };
    if (skyEnv) { M.glass.envMap = skyEnv; M.glass.envMapIntensity = 1.2; }
    const garments = ['#20305F', '#E9E9E7', '#7D848F', '#C9A452', '#59633B', '#4A6A91', '#1E1E20', '#D8C9A8', '#8FBF8A', '#9B2F2F', '#B9C3CE']
      .map(function (c) { return std(c, { map: texFabric, roughness: 0.95 }); });
    const wallMats = [M.paint, M.paint, M.cap, M.paint, M.paint, M.paint];
    const shaftMats = [M.paint, M.paint, M.shaftTop, M.paint, M.paint, M.paint];

    /* ---------------- grupos e registros ---------------- */
    const floorGroup = new THREE.Group(), archGroup = new THREE.Group(), doorGroup = new THREE.Group();
    const furnGroup = new THREE.Group(), ceilGroup = new THREE.Group(), fixGroup = new THREE.Group(), lightRig = new THREE.Group();
    root.add(floorGroup); root.add(archGroup); root.add(doorGroup); root.add(furnGroup); root.add(ceilGroup); root.add(fixGroup); root.add(lightRig);
    const wallMounted = [];
    const staticBoxes = [];          // colisão: retângulos no plano (mundo), k = 'arch' | 'furn'
    const archBlocks = [];           // colisão que muda com o estado (porta de correr da sacada)
    const archHinges = [];           // portas dos cômodos (recriadas ao trocar a altura das paredes)
    const furnHinges = [];           // portas de armários, geladeira, lava-roupas
    const sliders = [];              // box do chuveiro
    let windowRigs = [];
    const faucets = [], tvs = [], cooktops = [];
    const interList = [];
    if (dbg) { dbg.inter = interList; dbg.staticBoxes = staticBoxes; }
    // luzes pontuais (plafons, abajures) e de janela; cada uma pertence a uma zona: 0 dorm. 1, 1 dorm. 2, 2 banho, 3 sala/cozinha/circulação
    const pointZones = [], spotZones = [];
    const ZONE_OF = { d1: 0, d2: 1, banho: 2, estar: 3, coz: 3, circ: 3, sacada: 3 };
    function zoneAtPx(px, pz) {
      const rm = P.rooms.find(function (r) { return r.rects.some(function (q) { return px >= q[0] && px <= q[2] && pz >= q[1] && pz <= q[3]; }); });
      return rm ? ZONE_OF[rm.id] : 3;
    }
    function addPoint(x, y, z, zone, dist, decay, color) {
      const l = new THREE.PointLight(color || 0xffe6c2, 0, dist, decay);
      l.position.set(x, y, z);
      lightRig.add(l); pointZones.push(zone);
      return l;
    }

    function tag(obj, spec) {
      obj.traverse(function (o) { o.userData.inter = spec; });
      interList.push(spec);
      return spec;
    }
    function group(parent) { const g = new THREE.Group(); parent.add(g); return g; }

    /* ---------------- helpers de geometria ---------------- */
    function topHex(mat) { const m = Array.isArray(mat) ? mat[2] : mat; const h = m && m.userData && m.userData.hex; return typeof h === 'string' ? h : '#888888'; }
    function roundedBoxGeo(w, h, d, r) {
      r = Math.max(0, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
      if (r < 0.003) return new THREE.BoxGeometry(w, h, d);
      const iw = w - 2 * r, idp = d - 2 * r, ih = h - 2 * r;
      const rc = Math.min(r * 0.5, iw / 2 - 0.0005, idp / 2 - 0.0005);
      const s = new THREE.Shape();
      const x0 = -iw / 2, x1 = iw / 2, y0 = -idp / 2, y1 = idp / 2;
      if (rc > 0.001) {
        s.moveTo(x0 + rc, y0); s.lineTo(x1 - rc, y0); s.quadraticCurveTo(x1, y0, x1, y0 + rc);
        s.lineTo(x1, y1 - rc); s.quadraticCurveTo(x1, y1, x1 - rc, y1);
        s.lineTo(x0 + rc, y1); s.quadraticCurveTo(x0, y1, x0, y1 - rc);
        s.lineTo(x0, y0 + rc); s.quadraticCurveTo(x0, y0, x0 + rc, y0);
      } else {
        s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0);
      }
      const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(ih, 0.0005), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 3 });
      g.rotateX(-Math.PI / 2); g.center();
      return g;
    }
    function addBox(parent, b, mat, o) {
      o = o || {};
      const w = b.x1 - b.x0, d = b.z1 - b.z0, h = b.h1 - b.h0;
      if (!(w > 0 && d > 0 && h > 0)) return null;
      const geo = o.r ? roundedBoxGeo(w, h, d, o.r) : new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Mesh(geo, mat);
      m.position.set((b.x0 + b.x1) / 2, (b.h0 + b.h1) / 2, (b.z0 + b.z1) / 2);
      if (o.rx || o.ry || o.rz) m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
      m.castShadow = o.cast !== false; m.receiveShadow = true;
      if (o.walk) m.userData.walk = true;
      if (o.noPick) m.userData.noPick = true;
      if (o.wall) wallMounted.push(m);
      if (o.block) staticBoxes.push({ x0: b.x0 - CX, x1: b.x1 - CX, z0: b.z0 - CZ, z1: b.z1 - CZ, k: o.k || 'furn' });
      if (dbg && parent !== archGroup && !o.noDbg) dbg.boxes.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, h0: b.h0, h1: b.h1, hex: topHex(mat), grp: 'f' });
      parent.add(m);
      return m;
    }
    const PB = (r, h0, h1, mat, parent, o) => addBox(parent, { x0: mx(r[0]), x1: mx(r[2]), z0: mz(r[1]), z1: mz(r[3]), h0: h0, h1: h1 }, mat, o);
    function cyl(x, z, rx, rz, h0, h1, mat, parent, o) {
      o = o || {};
      const tp = o.top !== undefined ? o.top : 1, bt = o.bot !== undefined ? o.bot : 1;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(tp, bt, h1 - h0, o.seg || 28), mat);
      m.scale.set(rx, 1, rz); m.position.set(x, (h0 + h1) / 2, z);
      m.castShadow = o.cast !== false; m.receiveShadow = true;
      if (o.wall) wallMounted.push(m);
      if (o.noPick) m.userData.noPick = true;
      if (o.block) staticBoxes.push({ x0: x - rx - CX, x1: x + rx - CX, z0: z - rz - CZ, z1: z + rz - CZ, k: 'furn' });
      if (dbg) dbg.circles.push({ x: x, z: z, rx: rx * Math.max(tp, bt), rz: rz * Math.max(tp, bt), h1: h1, hex: topHex(mat) });
      parent.add(m);
      return m;
    }
    const cylP = (cx, cz, rx, rz, h0, h1, mat, parent, o) => cyl(mx(cx), mz(cz), rx, rz, h0, h1, mat, parent, o);
    function sph(x, y, z, r, mat, parent, sy) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
      m.scale.set(r, r * (sy || 1), r); m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      if (dbg) dbg.circles.push({ x: x, z: z, rx: r, rz: r, h1: y + r, hex: topHex(mat) });
      parent.add(m);
      return m;
    }
    const sphP = (cx, cz, r, y, mat, parent, sy) => sph(mx(cx), y, mz(cz), r, mat, parent, sy);
    function local(parent, geo, mat, x, y, z, rot) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      m.castShadow = true; m.receiveShadow = true; parent.add(m);
      return m;
    }
    function toBox(horiz, a0, a1, c0, c1, h0, h1) {
      return horiz ? { x0: mx(a0), x1: mx(a1), z0: mz(c0), z1: mz(c1), h0: h0, h1: h1 }
                   : { x0: mx(c0), x1: mx(c1), z0: mz(a0), z1: mz(a1), h0: h0, h1: h1 };
    }
    function quadXZ(x0, z0, x1, z1, y, texM) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([x0 / texM, -z0 / texM, x1 / texM, -z0 / texM, x1 / texM, -z1 / texM, x0 / texM, -z1 / texM]), 2));
      g.setIndex([0, 2, 1, 0, 3, 2]);
      return g;
    }
    function clearGroup(g) {
      g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      while (g.children.length) g.remove(g.children[0]);
    }
    const openSign = (dir, nrm) => ((dir[1] * nrm[0] - dir[0] * nrm[1]) > 0 ? 1 : -1);

    /* ---------------- base, pisos, forro, planta sobreposta ---------------- */
    const outlineShape = new THREE.Shape();
    P.outline.forEach(function (p, i) { if (i) outlineShape.lineTo(mx(p[0]), mz(p[1])); else outlineShape.moveTo(mx(p[0]), mz(p[1])); });
    const slabGeo = new THREE.ExtrudeGeometry(outlineShape, { depth: 0.16, bevelEnabled: false });
    slabGeo.rotateX(Math.PI / 2); slabGeo.translate(0, -0.003, 0);
    const slab = new THREE.Mesh(slabGeo, M.slab); slab.castShadow = true; slab.receiveShadow = true; root.add(slab);

    /* ---------------- paisagem: o apartamento fica no andar APT_FLOOR (2,84 m por andar acima do térreo) ---------------- */
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), new THREE.MeshBasicMaterial({ map: texSky, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }));
    sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texSun, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, transparent: true }));
    sunSprite.scale.set(240, 240, 1); sunSprite.renderOrder = -9; sunSprite.frustumCulled = false; scene.add(sunSprite);
    scene.fog = new THREE.Fog(0xd3e2ec, 170, 1350);
    if (INTEG) { sky.visible = false; sunSprite.visible = false; scene.fog = null; }   // no prédio, o céu e o chão são os do prédio
    else renderer.setClearColor(0xd3e2ec, 1);
    const landGroup = new THREE.Group(); scene.add(landGroup);
    const landInfo = { houses: 0, trees: 0, towers: 0, cars: 0 };
    function buildLandscape() {
      const G = GROUND_Y;
      const sh = { x: -SUN_DIR.x / SUN_DIR.y, z: -SUN_DIR.z / SUN_DIR.y };   // sombra no chão: deslocamento por metro de altura
      const R = rng(2026);
      const land = function (hex, o) {
        o = Object.assign({}, o || {});
        const env = o.env !== undefined ? o.env : 0.8; delete o.env;
        const m = new THREE.MeshStandardMaterial(Object.assign({ color: lin(hex), roughness: 0.92, metalness: 0 }, o));
        if (skyEnv) m.envMap = skyEnv;
        m.envMapIntensity = env;
        return m;
      };
      const tex = function (w, h, draw, rx, ry) { const t = canvasTex(w, h, draw); t.repeat.set(rx, ry); return t; };
      const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
      const roofGeo = new THREE.CylinderGeometry(1, 1, 1, 3, 1); roofGeo.rotateZ(Math.PI / 2); roofGeo.rotateX(-Math.PI / 2); roofGeo.translate(0, 0.5, 0);   // prisma: cumeeira em x, base 1,73 em z, altura 1,5
      const flatGeo = new THREE.PlaneGeometry(1, 1); flatGeo.rotateX(-Math.PI / 2);
      const discGeo = new THREE.CircleGeometry(1, 18); discGeo.rotateX(-Math.PI / 2);
      const dummy = new THREE.Object3D();
      function inst(geo, mat, list, parent) {
        if (!list.length) return null;
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach(function (t, i) {
          dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, t.ry || 0, 0); dummy.scale.set(t.sx, t.sy, t.sz);
          dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
        });
        im.instanceMatrix.needsUpdate = true; im.frustumCulled = false;
        (parent || landGroup).add(im);
        return im;
      }
      function mesh(geo, mat, x, y, z, sx, sy, sz, ry, parent) {
        const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (ry) m.rotation.y = ry;
        (parent || landGroup).add(m); return m;
      }
      const rect = (cx, cz, w, d) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];
      function hull(pts) {
        const p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
        const cr = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
        const lo = [], up = [];
        p.forEach(function (q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
        for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
        up.pop(); lo.pop();
        return lo.concat(up);
      }
      const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1d2a1c, transparent: true, opacity: 0.26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
      function groundShadow(pts, h0, h1, parent, oy) {
        const all = [];
        pts.forEach(function (p) { all.push([p[0] + sh.x * h0, p[1] + sh.z * h0]); all.push([p[0] + sh.x * h1, p[1] + sh.z * h1]); });
        const hp = hull(all); if (hp.length < 3) return;
        const s = new THREE.Shape(); hp.forEach(function (p, i) { if (i) s.lineTo(p[0], -p[1]); else s.moveTo(p[0], -p[1]); });
        const geo = new THREE.ShapeGeometry(s); geo.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(geo, shadowMat); m.position.y = G + 0.12 + (oy || 0); m.renderOrder = 1; (parent || landGroup).add(m);
      }
      // paredes de um prisma com UV em metros (u ao longo do perímetro, v = altura) e telhado plano opcional
      function prism(pts, y0, y1, wallMat, roofMat, vRef, parent) {
        const n = pts.length; let area = 0;
        for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
        const pos = [], nor = [], uv = [];
        let acc = 0;
        for (let i = 0; i < n; i++) {
          const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
          if (len < 1e-4) continue;
          let nx = dz / len, nz = -dx / len; if (area < 0) { nx = -nx; nz = -nz; }
          const q = [[a[0], y0, a[1], acc], [b[0], y0, b[1], acc + len], [b[0], y1, b[1], acc + len], [a[0], y1, a[1], acc]];
          const tri = (-dz * nx + dx * nz) < 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
          tri.forEach(function (k) { const v = q[k]; pos.push(v[0], v[1], v[2]); nor.push(nx, 0, nz); uv.push(v[3], v[1] - vRef); });
          acc += len;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        const g = new THREE.Group();
        g.add(new THREE.Mesh(geo, wallMat));
        if (roofMat) {
          const s = new THREE.Shape(); pts.forEach(function (p, i) { if (i) s.lineTo(p[0], -p[1]); else s.moveTo(p[0], -p[1]); });
          const rg = new THREE.ShapeGeometry(s); rg.rotateX(-Math.PI / 2); rg.translate(0, y1, 0);
          g.add(new THREE.Mesh(rg, roofMat));
        }
        (parent || landGroup).add(g);
        return g;
      }

      /* chão: grama distante, cidade (ruas e quadras) e o terreno do condomínio */
      const grass = mesh(new THREE.PlaneGeometry(2600, 2600), land('#ffffff', { map: tex(256, 256, drawGrass, 2600 / 14, 2600 / 14), roughness: 1, env: 0.7 }), 0, G, 0, 1, 1, 1);
      grass.rotation.x = -Math.PI / 2;
      const XS = [], ZS = [];
      for (let x = 85; x <= 360; x += 90) { XS.push(x); XS.push(-x); }
      for (let z = 95; z <= 400; z += 70) ZS.push(z);
      for (let z = -75; z >= -430; z -= 70) ZS.push(z);
      XS.sort(function (a, b) { return a - b; }); ZS.sort(function (a, b) { return a - b; });
      const blocks = [];
      for (let i = 0; i + 1 < XS.length; i++) for (let j = 0; j + 1 < ZS.length; j++) {
        const bk = { x0: XS[i] + 5, x1: XS[i + 1] - 5, z0: ZS[j] + 5, z1: ZS[j + 1] - 5 };
        if (bk.x0 < 0 && bk.x1 > 0 && bk.z0 < 0 && bk.z1 > 0) continue;          // o condomínio
        const cx = (bk.x0 + bk.x1) / 2, cz = (bk.z0 + bk.z1) / 2;
        bk.d = Math.hypot(cx, cz); bk.cx = cx; bk.cz = cz;
        bk.park = cx > 150 && cx < 280 && cz < -100 && cz > -300;                   // praça arborizada a nordeste
        if (bk.d < 430) blocks.push(bk);
      }
      const fade = (d) => clamp((395 - d) / 105, 0, 1);
      const CS = 820, CP = 1536, ck = CP / CS, C2 = (x, z) => [(x + CS / 2) * ck, (z + CS / 2) * ck];
      const texCity = canvasTex(CP, CP, function (g) {
        g.fillStyle = '#708d50'; g.fillRect(0, 0, CP, CP);
        speckle(g, CP, CP, 9000, 99, 0.07);
        const rr = rng(98);
        blocks.forEach(function (bk) {
          const a = fade(bk.d); if (a <= 0) return;
          g.globalAlpha = a;
          const p0 = C2(bk.x0, bk.z0), p1 = C2(bk.x1, bk.z1);
          g.fillStyle = bk.park ? '#6c934b' : '#aaa594'; g.fillRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
          if (bk.park) {
            g.strokeStyle = '#cfc6ae'; g.lineWidth = 2.5 * ck; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.moveTo(p1[0], p0[1]); g.lineTo(p0[0], p1[1]); g.stroke();
          } else {
            for (let k = 0; k < 10; k++) { g.fillStyle = rr() < 0.6 ? 'rgba(104,140,74,.75)' : 'rgba(150,140,120,.5)'; g.fillRect(p0[0] + rr() * (p1[0] - p0[0]) * 0.85, p0[1] + rr() * (p1[1] - p0[1]) * 0.85, (6 + rr() * 12) * ck, (5 + rr() * 9) * ck); }
          }
          g.strokeStyle = '#cdc8bc'; g.lineWidth = 2.6 * ck;
          g.strokeRect(p0[0] + 1.3 * ck, p0[1] + 1.3 * ck, p1[0] - p0[0] - 2.6 * ck, p1[1] - p0[1] - 2.6 * ck);
        });
        const seg = function (x0, z0, x1, z1) {
          const a = fade(Math.hypot((x0 + x1) / 2, (z0 + z1) / 2)); if (a <= 0) return;
          g.globalAlpha = a;
          const p0 = C2(x0, z0), p1 = C2(x1, z1);
          g.fillStyle = '#5e6163'; g.fillRect(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.abs(p1[0] - p0[0]) || 1, Math.abs(p1[1] - p0[1]) || 1);
        };
        const zEdge = [ZS[0] - 5].concat(ZS, [ZS[ZS.length - 1] + 5]), xEdge = [XS[0] - 5].concat(XS, [XS[XS.length - 1] + 5]);
        XS.forEach(function (x) { for (let j = 0; j + 1 < zEdge.length; j++) seg(x - 5, zEdge[j], x + 5, zEdge[j + 1]); });
        ZS.forEach(function (z) { for (let i = 0; i + 1 < xEdge.length; i++) seg(xEdge[i], z - 5, xEdge[i + 1], z + 5); });
        g.fillStyle = 'rgba(236,230,205,.55)';
        XS.forEach(function (x) { for (let z = ZS[0]; z < ZS[ZS.length - 1]; z += 7) { const a = fade(Math.hypot(x, z)); if (a <= 0) continue; g.globalAlpha = a * 0.8; const p = C2(x, z); g.fillRect(p[0] - 0.6, p[1], 1.2, 3.2 * ck); } });
        ZS.forEach(function (z) { for (let x = XS[0]; x < XS[XS.length - 1]; x += 7) { const a = fade(Math.hypot(x, z)); if (a <= 0) continue; g.globalAlpha = a * 0.8; const p = C2(x, z); g.fillRect(p[0], p[1] - 0.6, 3.2 * ck, 1.2); } });
        g.globalAlpha = 1;
      });
      const city = mesh(new THREE.PlaneGeometry(CS, CS), land('#ffffff', { map: texCity, roughness: 0.95, env: 0.7, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), 0, G + 0.04, 0, 1, 1, 1);
      city.rotation.x = -Math.PI / 2;

      /* condomínio (x -80..80, z -70..90; o nosso prédio no centro, o norte é -z) */
      const TOWERS = [[-29, -2, 20, 12], [30, 3, 20, 12], [-6, 33, 26, 12], [36, 35, 14, 20]];
      const POOL = [5.5, -27.5, 13, 7], DECK = [5.5, -27.5, 22, 14], COURT = [40, -28, 14, 24], PLAY = [-22, -22, 12, 10];
      const KIOSKS = [[-14, -40], [22, -40]], SALAO = [-37, -33, 14, 9], RING = { x0: -55, x1: 55, z0: -50, z1: 62, w: 6 };
      const SX0 = -80, SZ0 = -70, SSZ = 160, SP = 1024, sk = SP / SSZ, S2 = (x, z) => [(x - SX0) * sk, (z - SZ0) * sk];
      const texSite = canvasTex(SP, SP, function (g) {
        g.fillStyle = '#7fa257'; g.fillRect(0, 0, SP, SP);
        for (let i = 0; i < SP; i += 26) { g.fillStyle = (i / 26) % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.03)'; g.fillRect(i, 0, 13, SP); }
        speckle(g, SP, SP, 2500, 61, 0.04);
        const box = function (cx, cz, w, d, col) { const p = S2(cx - w / 2, cz - d / 2); g.fillStyle = col; g.fillRect(p[0], p[1], w * sk, d * sk); };
        g.fillStyle = '#cbc6ba'; g.fillRect(0, 0, SP, 2.5 * sk); g.fillRect(0, SP - 2.5 * sk, SP, 2.5 * sk); g.fillRect(0, 0, 2.5 * sk, SP); g.fillRect(SP - 2.5 * sk, 0, 2.5 * sk, SP);
        // anel viário com vagas
        const rp = function (inset) { const a = S2(RING.x0 - inset, RING.z0 - inset), b = S2(RING.x1 + inset, RING.z1 + inset), rad = (9 + inset) * sk;
          g.beginPath(); g.moveTo(a[0] + rad, a[1]); g.arcTo(b[0], a[1], b[0], b[1], rad); g.arcTo(b[0], b[1], a[0], b[1], rad); g.arcTo(a[0], b[1], a[0], a[1], rad); g.arcTo(a[0], a[1], b[0], a[1], rad); g.closePath(); };
        g.strokeStyle = '#6a6d70'; g.lineWidth = RING.w * sk; rp(0); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.setLineDash([3 * sk, 3 * sk]); rp(0); g.stroke(); g.setLineDash([]);
        box(0, 75, 6, 26, '#6a6d70');
        [[RING.z0 - 3 - 2.5, 'n'], [RING.z1 + 3 + 2.5, 's']].forEach(function (row) {
          box(0, row[0], 96, 5, '#8b8d8e');
          g.fillStyle = 'rgba(255,255,255,.75)'; for (let x = -48; x <= 48; x += 2.6) { const p = S2(x, row[0] - 2.5); g.fillRect(p[0], p[1], 1.4, 5 * sk); }
        });
        // pátios das torres, calçadas e caminhos
        TOWERS.forEach(function (t) { box(t[0], t[1], t[2] + 4, t[3] + 4, '#c9c4b8'); });
        box(0, 0, 11, 9.5, '#c9c4b8');
        g.strokeStyle = '#d2cdc1'; g.lineWidth = 2 * sk; g.beginPath();
        [[0, -4, 0, -20.5], [-6, -27.5, -20, -27], [-20, -27, -22, -17], [5.5, -34.5, -14, -37], [5.5, -34.5, 22, -37], [-29, -8, -29, -47], [30, -3, 30, -47], [-6, 27, -6, 59], [36, 25, 36, 59], [-14, -37, -37, -37.5]]
          .forEach(function (s) { const a = S2(s[0], s[1]), b = S2(s[2], s[3]); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); });
        g.stroke();
        // piscina, quadra, playground, quiosques e salão de festas
        box(DECK[0], DECK[1], DECK[2], DECK[3], '#ddd5c5');
        box(POOL[0], POOL[1], POOL[2] + 0.8, POOL[3] + 0.8, '#f0ece2');
        box(POOL[0], POOL[1], POOL[2], POOL[3], '#2f8fb8');
        box(COURT[0], COURT[1], COURT[2] + 2, COURT[3] + 2, '#b9b4a7');
        box(COURT[0], COURT[1], COURT[2], COURT[3], '#4f8455');
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
        const c0 = S2(COURT[0] - COURT[2] / 2 + 0.6, COURT[1] - COURT[3] / 2 + 0.6);
        g.strokeRect(c0[0], c0[1], (COURT[2] - 1.2) * sk, (COURT[3] - 1.2) * sk);
        const cm = S2(COURT[0], COURT[1]); g.beginPath(); g.moveTo(c0[0], cm[1]); g.lineTo(c0[0] + (COURT[2] - 1.2) * sk, cm[1]); g.stroke();
        g.beginPath(); g.arc(cm[0], cm[1], 1.8 * sk, 0, 6.2832); g.stroke();
        box(PLAY[0], PLAY[1], PLAY[2], PLAY[3], '#d8c79b');
        box(PLAY[0] + 2, PLAY[1] + 1, 5, 4, '#c15d46');
        KIOSKS.forEach(function (k) { box(k[0], k[1], 9, 7, '#cbc6ba'); });
        box(SALAO[0], SALAO[1], SALAO[2] + 3, SALAO[3] + 3, '#cbc6ba');
      });
      const site = mesh(new THREE.PlaneGeometry(SSZ, SSZ), land('#ffffff', { map: texSite, roughness: 0.95, env: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), 0, G + 0.08, SZ0 + SSZ / 2, 1, 1, 1);
      site.rotation.x = -Math.PI / 2;
      const pool = mesh(new THREE.PlaneGeometry(POOL[2], POOL[3]), land('#ffffff', { map: tex(256, 128, drawPool, 2, 1), color: lin('#7fd2ea'), roughness: 0.05, env: 1.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }), POOL[0], G + 0.1, POOL[1], 1, 1, 1);
      pool.rotation.x = -Math.PI / 2;

      /* prédios */
      const roofMat = land('#b8b6b0', { roughness: 0.95 }), roofDark = land('#8f908e', { roughness: 0.9 });
      const facade = function (col, seed) { return land('#ffffff', { map: tex(512, 717, function (g, w, h) { drawFacade(g, w, h, col, seed); }, 1 / 6, 1 / 8.4), roughness: 0.85, env: 0.75 }); };
      const facMats = [facade('#e7e1d5', 11), facade('#e9eae7', 23), facade('#d6c7b2', 37)];
      function tower(cx, cz, w, d, h, mat) {
        const pts = rect(cx, cz, w, d);
        prism(pts, G, G + h, mat, roofMat, G);
        mesh(boxGeo, roofDark, cx + w * 0.12, G + h, cz, Math.min(6, w * 0.3), 2.6, Math.min(5, d * 0.4));
        groundShadow(pts, 0, h);
        landInfo.towers++;
      }
      TOWERS.forEach(function (t, i) { tower(t[0], t[1], t[2], t[3], 19.6, facMats[i % 2]); });
      // o nosso prédio: os andares de baixo repetem a planta (fachada branca, janelas nos mesmos lugares)
      const outl = (P.body || P.outline).map(function (p) { return [mx(p[0]), mz(p[1])]; });
      prism(outl, G, -0.165, land('#ffffff', { map: tex(64, 256, drawBand, 1 / 4, 1 / 2.84), roughness: 0.9, env: 0.7 }), null, -0.003, root);
      groundShadow(outl.map(function (p) { return [p[0] - CX, p[1] - CZ]; }), 0, -GROUND_Y);
      const dec = { glass: { p: [], n: [] }, frame: { p: [], n: [] }, pers: { p: [], n: [] } };
      const balcSlab = land('#ecebe7', { roughness: 0.85 }), balcRail = land('#f2f2ef', { roughness: 0.5 });
      const quad = function (arr, cx, cz, nx, nz, half, y0, y1, off) {
        const tx = nz, tz = -nx, ox = cx + nx * off, oz = cz + nz * off;
        const A = [ox - tx * half, y0, oz - tz * half], B = [ox + tx * half, y0, oz + tz * half], Cc = [ox + tx * half, y1, oz + tz * half], D2 = [ox - tx * half, y1, oz - tz * half];
        [A, B, Cc, A, Cc, D2].forEach(function (v) { arr.p.push(v[0], v[1], v[2]); arr.n.push(nx, 0, nz); });
      };
      const WINS = P.facadeWins;
      for (let k = 1; k <= APT_FLOOR; k++) {
        const base = -2.84 * k;
        WINS.forEach(function (wd) {
          const sp = P.windows[wd[0]], horiz = wd[4] === 'N';
          const cx = horiz ? mx((wd[1] + wd[2]) / 2) : mx(wd[3]), cz = horiz ? mz(wd[3]) : mz((wd[1] + wd[2]) / 2);
          const nx = horiz ? 0 : wd[4] === 'W' ? -1 : 1, nz = horiz ? -1 : 0, half = (wd[2] - wd[1]) / S / 2;
          const y0 = base + sp.sill, y1 = base + Math.min(sp.top, H_HIGH);
          quad(dec.frame, cx, cz, nx, nz, half + 0.05, y0 - 0.05, y1 + 0.05, 0.004);
          quad(dec.glass, cx, cz, nx, nz, half, y0, y1, 0.007);
          if (sp.type === 'persiana') { const f = R() < 0.25 ? 1 : 0.1 + R() * 0.8; quad(dec.pers, cx, cz, nx, nz, half, y1 - (y1 - y0) * f, y1, 0.009); }
        });
        if (P.balcony) {                                         // sacada do andar de baixo: laje, guarda-corpo de vidro e corrimão
          const br = P.balcony.r, bx = mx((br[0] + br[2]) / 2), bw = (br[2] - br[0]) / S, bd = (br[3] - br[1]) / S;
          mesh(boxGeo, balcSlab, bx, base - 0.16, mz((br[1] + br[3]) / 2), bw, 0.16, bd, 0, root);
          quad(dec.glass, bx, mz(br[1]) + 0.07, 0, -1, bw / 2, base, base + 1.05, 0.004);
          mesh(boxGeo, balcRail, bx, base + 1.05, mz(br[1]) + 0.07, bw, 0.05, 0.06, 0, root);
        }
      }
      [['glass', land('#1f2b35', { roughness: 0.06, env: 1.25 })], ['frame', land('#f2f2ef', { roughness: 0.5 })], ['pers', land('#d6d9da', { roughness: 0.6 })]].forEach(function (e) {
        const a = dec[e[0]]; if (!a.p.length) return;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(a.n, 3));
        root.add(new THREE.Mesh(geo, e[1]));
      });
      // muro, quiosques com churrasqueira, salão de festas e playground
      const wallMat = land('#d8d4cc', { roughness: 0.95 }), white = land('#f1efea', { roughness: 0.8 }), clay = land('#a85b3b', { roughness: 0.85 });
      const brick = land('#9c5a43', { roughness: 0.9 }), wood = land('#9a7350', { roughness: 0.8 });
      [[-77.5, 10, 0.25, 155], [77.5, 10, 0.25, 155], [0, -67.5, 155, 0.25], [-41.5, 87.5, 72, 0.25], [41.5, 87.5, 72, 0.25]].forEach(function (wl) { mesh(boxGeo, wallMat, wl[0], G, wl[1], wl[2], 2.4, wl[3]); });
      groundShadow(rect(0, -67.5, 155, 0.25), 0, 2.4);
      KIOSKS.forEach(function (k) {
        const W2 = 7, D2 = 5, Hc = 2.6;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) { mesh(boxGeo, white, k[0] + s[0] * (W2 / 2 - 0.15), G, k[1] + s[1] * (D2 / 2 - 0.15), 0.25, Hc, 0.25); });
        mesh(boxGeo, white, k[0], G, k[1] + D2 / 2 - 0.5, W2 - 1, 0.95, 0.6);
        mesh(boxGeo, brick, k[0] + W2 / 2 - 1.2, G, k[1] + D2 / 2 - 0.5, 0.9, Hc + 1.6, 0.7);
        mesh(boxGeo, wood, k[0] - 0.5, G + 0.7, k[1] - 0.6, 2.6, 0.06, 1.0);
        mesh(roofGeo, clay, k[0], G + Hc, k[1], W2 + 0.8, 1.4 / 1.5, (D2 + 0.8) / 1.732);
        groundShadow(rect(k[0], k[1], W2 + 0.8, D2 + 0.8), Hc, Hc + 1.4);
      });
      prism(rect(SALAO[0], SALAO[1], SALAO[2], SALAO[3]), G, G + 3.6, facMats[1], roofMat, G);
      groundShadow(rect(SALAO[0], SALAO[1], SALAO[2], SALAO[3]), 0, 3.6);
      const red = land('#c8463a', { roughness: 0.6 }), yellow = land('#e2b437', { roughness: 0.6 }), blue = land('#3a6fb5', { roughness: 0.6 });
      mesh(boxGeo, red, PLAY[0] - 2, G, PLAY[1] - 1, 1.2, 1.8, 1.2); mesh(boxGeo, yellow, PLAY[0] - 2, G + 1.0, PLAY[1] + 1.2, 0.7, 0.08, 2.6).rotation.x = 0.55;
      [[-1, 0], [1, 0]].forEach(function (s) { mesh(boxGeo, blue, PLAY[0] + 3 + s[0] * 1.6, G, PLAY[1] - 2, 0.12, 2.2, 0.12); });
      mesh(boxGeo, blue, PLAY[0] + 3, G + 2.2, PLAY[1] - 2, 3.4, 0.12, 0.12);

      /* piscina: espreguiçadeiras e guarda-sóis */
      const lounge = [];
      for (let i = 0; i < 6; i++) { lounge.push({ x: POOL[0] - 5.5 + i * 2.2, y: G + 0.1, z: POOL[1] - 5.1, sx: 0.7, sy: 0.32, sz: 1.9 }); lounge.push({ x: POOL[0] - 5.5 + i * 2.2, y: G + 0.1, z: POOL[1] + 5.1, sx: 0.7, sy: 0.32, sz: 1.9 }); }
      inst(boxGeo, white, lounge);
      const umb = [], poles = [];
      [[-3, -5.4], [3.6, -5.4], [9.2, -5.4], [-0.2, 5.4], [6.4, 5.4]].forEach(function (u) { umb.push({ x: POOL[0] + u[0], y: G + 2.25, z: POOL[1] + u[1], sx: 1.4, sy: 0.5, sz: 1.4 }); poles.push({ x: POOL[0] + u[0], y: G, z: POOL[1] + u[1], sx: 0.05, sy: 2.3, sz: 0.05 }); });
      inst(new THREE.ConeGeometry(1, 1, 12), land('#f3f1ea', { roughness: 0.8, side: THREE.DoubleSide }), umb);
      inst(boxGeo, white, poles);

      /* cidade: casas térreas e sobrados, alguns prédios, árvores e carros */
      const tall = [];
      for (let i = 0; i < 16; i++) {
        const a = R() * Math.PI * 2, d = 130 + R() * 240, x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (Math.abs(x) < 95 && z > -85 && z < 105) continue;
        tall.push({ x: x, z: z, w: 14 + R() * 10, d: 12 + R() * 8, h: 18 + Math.floor(R() * 11) * 2.9 });
      }
      for (let i = 0; i < 12; i++) { const a = R() * Math.PI * 2, d = 480 + R() * 380; tall.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, w: 16 + R() * 14, d: 14 + R() * 10, h: 30 + R() * 45, far: true }); }
      tall.forEach(function (t, i) { tower(t.x, t.z, t.w, t.d, t.h, facMats[i % 3]); });
      const nearTall = (x, z) => tall.some(function (t) { return Math.abs(x - t.x) < t.w / 2 + 7 && Math.abs(z - t.z) < t.d / 2 + 7; });
      const tintH = ['#f1e6d2', '#e9edee', '#efd9a7', '#d7e4d0', '#e7cfc4'], tintR = ['#a85b3b', '#8e9397', '#7e3f2d'];
      const H1 = [[], [], [], [], []], H2 = [[], [], [], [], []], RF = [[], [], []], HS = [], TREES = [], CARS = [[], [], [], [], []];
      const addTree = function (x, z, h, r, c, palm) { TREES.push({ x: x, z: z, h: h, r: r, c: c, palm: !!palm }); };
      blocks.forEach(function (bk) {
        const dens = fade(bk.d);
        if (dens <= 0) return;
        if (bk.park) {
          for (let k = 0; k < 85; k++) addTree(bk.x0 + 3 + R() * (bk.x1 - bk.x0 - 6), bk.z0 + 3 + R() * (bk.z1 - bk.z0 - 6), 2.5 + R() * 3, 2.6 + R() * 2.4, R() < 0.08 ? 3 : R() < 0.06 ? 4 : Math.floor(R() * 3));
          return;
        }
        [0, 1].forEach(function (side) {
          let x = bk.x0 + 1 + R() * 3;
          while (x < bk.x1 - 8) {
            const lotW = 9 + R() * 5;
            if (R() < dens * 0.94) {
              const two = R() < 0.32, hw = Math.min(lotW - 2, 6.5 + R() * 3.5), hd = 8 + R() * 6, hh = two ? 5.6 + R() * 0.8 : 3.1 + R() * 0.6;
              const set = 3 + R() * 4, hx = x + lotW / 2, hz = side ? bk.z1 - set - hd / 2 : bk.z0 + set + hd / 2;
              if (!nearTall(hx, hz)) {
                (two ? H2 : H1)[Math.floor(R() * 5)].push({ x: hx, y: G, z: hz, sx: hw, sy: hh, sz: hd });
                RF[R() < 0.6 ? 0 : R() < 0.7 ? 1 : 2].push({ x: hx, y: G + hh, z: hz, sx: hd * 1.08, sy: (1.2 + R() * 0.9) / 1.5, sz: hw * 1.12 / 1.732, ry: Math.PI / 2 });
                HS.push({ x: hx + sh.x * hh / 2, y: G + 0.11, z: hz + sh.z * hh / 2, sx: hw + Math.abs(sh.x) * hh, sy: 1, sz: hd + Math.abs(sh.z) * hh });
                if (R() < 0.5) addTree(hx + (R() - 0.5) * lotW * 0.6, hz + (side ? -1 : 1) * (hd / 2 + 4 + R() * 6), 2 + R() * 2.5, 2 + R() * 2, R() < 0.06 ? 3 : R() < 0.05 ? 4 : Math.floor(R() * 3));
              }
            }
            x += lotW;
          }
        });
        // árvores na calçada e carros estacionados junto ao meio-fio
        for (let x = bk.x0 + 6; x < bk.x1 - 4; x += 13 + R() * 6) {
          if (R() < 0.55 * dens) addTree(x, bk.z0 - 1.2, 2.2 + R() * 1.6, 2 + R() * 1.4, R() < 0.1 ? 3 : Math.floor(R() * 3));
          if (R() < 0.35 * dens) CARS[Math.floor(R() * 5)].push({ x: x + 4, z: bk.z1 + 1.9, ry: Math.PI / 2 });
        }
      });
      // condomínio: árvores junto ao muro, palmeiras na piscina, três árvores grandes perto do prédio
      for (let x = -72; x <= 72; x += 11) { addTree(x, -64.5, 3 + R() * 2, 2.6 + R() * 1.2, Math.floor(R() * 3)); addTree(x, 84.5, 3 + R() * 2, 2.6 + R() * 1.2, Math.floor(R() * 3)); }
      for (let z = -58; z <= 78; z += 12) { addTree(-74.5, z, 3 + R() * 2, 2.6 + R() * 1.2, Math.floor(R() * 3)); addTree(74.5, z, 3 + R() * 2, 2.6 + R() * 1.2, Math.floor(R() * 3)); }
      [[-6.5, -22], [17.5, -22], [-6.5, -33], [17.5, -33], [5.5, -36.5], [5.5, -18.5]].forEach(function (p) { addTree(p[0], p[1], 6.5 + R() * 2, 2.2, 1, true); });
      [[-13, -11, 9.5, 4.2], [15, -12, 8.5, 3.8], [-15, 14, 8, 3.6], [48, -8, 6, 3.4], [-48, 20, 6, 3.2]].forEach(function (p) { addTree(p[0], p[1], p[2], p[3], Math.floor(R() * 3)); });
      // vagas do condomínio
      [RING.z0 - 5.5, RING.z1 + 5.5].forEach(function (z) { for (let x = -46.7; x <= 46.7; x += 2.6) if (R() < 0.62) CARS[Math.floor(R() * 5)].push({ x: x, z: z, ry: 0 }); });

      const houseMats1 = tintH.map(function (c) { return land(c, { map: tex(256, 128, function (g, w, h) { drawHouse(g, w, h, 1); }, 1, 1), roughness: 0.9, env: 0.7 }); });
      const houseMats2 = tintH.map(function (c) { return land(c, { map: tex(256, 256, function (g, w, h) { drawHouse(g, w, h, 2); }, 1, 1), roughness: 0.9, env: 0.7 }); });
      H1.forEach(function (l, i) { inst(boxGeo, houseMats1[i], l); landInfo.houses += l.length; });
      H2.forEach(function (l, i) { inst(boxGeo, houseMats2[i], l); landInfo.houses += l.length; });
      RF.forEach(function (l, i) { inst(roofGeo, land(tintR[i], { roughness: 0.85 }), l); });
      inst(flatGeo, shadowMat, HS);
      // árvores: copa principal + copa menor, tronco e sombra
      const canopyGeo = new THREE.IcosahedronGeometry(1, 1), trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 1, 6); trunkGeo.translate(0, 0.5, 0);
      const leafCols = ['#4d7a34', '#3e6a2c', '#5e8b3d', '#d8b330', '#a7659e'];
      const CAN = leafCols.map(function () { return []; }), TRK = [], TSH = [];
      TREES.forEach(function (t) {
        const cy = G + t.h + t.r * (t.palm ? 0.15 : 0.62);
        if (t.palm) {
          TRK.push({ x: t.x, y: G, z: t.z, sx: 0.36, sy: t.h + 0.2, sz: 0.36 });
          CAN[t.c].push({ x: t.x, y: cy, z: t.z, sx: t.r, sy: t.r * 0.42, sz: t.r });
        } else {
          TRK.push({ x: t.x, y: G, z: t.z, sx: 0.32 + t.r * 0.05, sy: t.h + t.r * 0.4, sz: 0.32 + t.r * 0.05 });
          CAN[t.c].push({ x: t.x, y: cy, z: t.z, sx: t.r, sy: t.r * 0.82, sz: t.r, ry: t.x });
          CAN[t.c].push({ x: t.x + t.r * 0.42, y: cy + t.r * 0.18, z: t.z - t.r * 0.3, sx: t.r * 0.66, sy: t.r * 0.58, sz: t.r * 0.66, ry: t.z });
        }
        const hc = t.h + t.r * 0.6;
        TSH.push({ x: t.x + sh.x * hc, y: G + 0.115, z: t.z + sh.z * hc, sx: t.r * 1.02, sy: 1, sz: t.r * 1.18 });
      });
      CAN.forEach(function (l, i) { inst(canopyGeo, land(leafCols[i], { roughness: 0.95, env: 0.6 }), l); });
      inst(trunkGeo, land('#6b5440', { roughness: 0.95 }), TRK);
      inst(discGeo, shadowMat, TSH);
      landInfo.trees = TREES.length;
      // carros
      const carCols = ['#f2f2f0', '#b7bbbf', '#232528', '#a3262a', '#2d4f86'], cabins = [];
      CARS.forEach(function (l, i) {
        const bodies = l.map(function (c) { cabins.push({ x: c.x + (c.ry ? 0.25 : 0), y: G + 0.9, z: c.z + (c.ry ? 0 : 0.25), sx: c.ry ? 2.2 : 1.6, sy: 0.55, sz: c.ry ? 1.6 : 2.2 }); return { x: c.x, y: G + 0.18, z: c.z, sx: c.ry ? 4.3 : 1.8, sy: 0.72, sz: c.ry ? 1.8 : 4.3 }; });
        inst(boxGeo, land(carCols[i], { roughness: 0.3, env: 1.1 }), bodies);
        landInfo.cars += l.length;
      });
      inst(boxGeo, land('#26303a', { roughness: 0.1, env: 1.2 }), cabins);
      // morros ao longe (a névoa os deixa azulados)
      const hillMat = land('#6b8a66', { roughness: 1, env: 0.55 }), hillGeo = new THREE.SphereGeometry(1, 28, 14);
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * Math.PI * 2 + R() * 0.4, d = 660 + R() * 330, sy = 45 + R() * 75;
        mesh(hillGeo, hillMat, Math.cos(a) * d, G - sy * 0.3, Math.sin(a) * d, 190 + R() * 220, sy, 130 + R() * 150, a);
      }
    }
    if (!INTEG) { try { buildLandscape(); } catch (e) { console.error('paisagem', e); } }


    P.floors.forEach(function (f) {
      const spec = f.m === 'lam' ? [M.lam, 2.0] : f.m === 'tileK' ? [M.tileK, 1.0] : [M.tileB, 0.9];
      const mesh = new THREE.Mesh(quadXZ(mx(f.r[0]), mz(f.r[1]), mx(f.r[2]), mz(f.r[3]), 0, spec[1]), spec[0]);
      mesh.receiveShadow = true; mesh.userData.walk = true; floorGroup.add(mesh);
      if (dbg) dbg.boxes.push({ x0: mx(f.r[0]), x1: mx(f.r[2]), z0: mz(f.r[1]), z1: mz(f.r[3]), h0: 0, h1: 0, hex: f.m === 'lam' ? '#c6a483' : '#f4f4f4', grp: 'floor' });
    });

    const ceilGeo = new THREE.ShapeGeometry(outlineShape);
    ceilGeo.rotateX(Math.PI / 2); ceilGeo.translate(0, H_HIGH - 0.003, 0);
    const ceiling = new THREE.Mesh(ceilGeo, M.ceiling); ceiling.castShadow = true; ceiling.receiveShadow = true; ceilGroup.add(ceiling);
    // luzes dos cômodos: plafon no teto + interruptor ao lado da porta (começam apagadas: é dia)
    const roomLights = {};
    function setRoomLight(id, on) {
      const rl = roomLights[id]; if (!rl) return;
      rl.on = !!on;
      rl.mat.emissiveIntensity = rl.on ? 1.15 : 0.04;
      rl.lights.forEach(function (l) { l.intensity = rl.on ? rl.power : 0; });
      rl.rockers.forEach(function (r) { r.rotation.x = rl.on ? -0.2 : 0.2; });
      markDirty();
    }
    function lightSwitch(fx, fz, facing, rl) {
      const g = new THREE.Group();
      g.position.set(mx(fx), 1.1, mz(fz));
      g.rotation.y = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[facing];
      fixGroup.add(g); wallMounted.push(g);
      const plate = new THREE.Mesh(roundedBoxGeo(0.075, 0.115, 0.012, 0.004), M.switchPlate);
      plate.position.z = 0.006; plate.receiveShadow = true; g.add(plate);
      const piv = new THREE.Group(); piv.position.z = 0.012; piv.rotation.x = 0.2; g.add(piv);
      const rk = new THREE.Mesh(roundedBoxGeo(0.032, 0.058, 0.01, 0.003), M.switchRocker);
      rk.position.z = 0.002; rk.receiveShadow = true; piv.add(rk);
      rl.rockers.push(piv);
      return g;
    }
    const SWITCHES = P.switches;
    P.rooms.forEach(function (rm) {
      const mat = std('#FFFFFF', { roughness: 0.4, emissive: lin('#FFF1D6'), emissiveIntensity: 0.04 });
      const rl = { on: false, mat: mat, lights: [], rockers: [], power: 1.1 / Math.sqrt(Math.max(1, rm.lights.length)) };
      roomLights[rm.id] = rl;
      const g = group(ceilGroup);
      rm.lights.forEach(function (l) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.035, 32), mat);
        m.position.set(mx(l[0]), H_HIGH - 0.02, mz(l[1])); g.add(m);
        rl.lights.push(addPoint(mx(l[0]), H_HIGH - 0.14, mz(l[1]), ZONE_OF[rm.id], 6.2, 1.5));
      });
      const spec = function () { return { label: function () { return rl.on ? 'Apagar a luz' : 'Acender a luz'; }, act: function () { setRoomLight(rm.id, !rl.on); } }; };
      tag(g, spec());
      const sw = SWITCHES[rm.id];
      if (sw) tag(lightSwitch(sw[0], sw[1], sw[2], rl), spec());
    });
    ceilGroup.visible = false;

    const overlayTex = new THREE.TextureLoader().load(PLAN_IMG, markDirty);
    overlayTex.encoding = THREE.sRGBEncoding; overlayTex.anisotropy = maxAniso;
    const IMG = P.meta.imgSize;
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(IMG[0] / S, IMG[1] / S),
      new THREE.MeshBasicMaterial({ map: overlayTex, transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false }));
    overlay.rotation.x = -Math.PI / 2;
    overlay.position.set(mx(IMG[0] / 2), H_HIGH + 0.025, mz(IMG[1] / 2));
    overlay.renderOrder = 10; overlay.visible = false;
    root.add(overlay);

    /* ---------------- estado ---------------- */
    const state = { wallsLow: false, furniture: true, labels: true, doorsOpen: true, overlay: false };
    const doorState = {}; Object.keys(P.doors).forEach(function (k) { doorState[k] = { open: true }; });
    const winState = {}; Object.keys(P.windows).forEach(function (k) { winState[k] = { open: false, s: 0, shut: false, p: 0 }; });

    /* ---------------- arquitetura ---------------- */
    function applySash(rig, s) { if (rig.tilt) rig.sash.rotation.x = rig.tilt * s; else rig.sash.position.x = -rig.slide * s; }
    function shutterBottom(rig, p) { return rig.top - rig.fw - (rig.up + p * (rig.full - rig.up)); }
    function applyShutter(rig, p) {
      const topY = rig.top - rig.fw, bottom = shutterBottom(rig, p);
      rig.slats.forEach(function (m, i) { const y = bottom + i * rig.pitch + rig.slatH / 2; m.position.y = y; m.visible = y + rig.slatH / 2 <= topY + 1e-4; });
      if (rig.curtain) { const hh = Math.max(0.002, topY - bottom); rig.curtain.scale.y = hh; rig.curtain.position.y = bottom + hh / 2; }
    }
    function buildWindow(win, parent, H) {
      const sp = win.spec;
      if (sp.sill >= H - 0.05) return;
      const st = winState[win.id];
      const fullTop = sp.top <= H + 1e-6, top = Math.min(sp.top, H);
      const Wd = (win.b - win.a) / S, T = (win.c1 - win.c0) / S;
      const g = new THREE.Group();
      const ca = (win.a + win.b) / 2, cc = (win.c0 + win.c1) / 2;
      if (win.horiz) g.position.set(mx(ca), 0, mz(cc)); else { g.position.set(mx(cc), 0, mz(ca)); g.rotation.y = Math.PI / 2; }
      const fw = 0.045, fd = 0.075;
      const L = (gr, x0, x1, y0, y1, z0, z1, mat, o) => addBox(gr, { x0: x0, x1: x1, h0: y0, h1: y1, z0: z0, z1: z1 }, mat, Object.assign({ noDbg: true }, o || {}));
      L(g, -Wd / 2, -Wd / 2 + fw, sp.sill, top, -fd / 2, fd / 2, M.alu);
      L(g, Wd / 2 - fw, Wd / 2, sp.sill, top, -fd / 2, fd / 2, M.alu);
      L(g, -Wd / 2, Wd / 2, sp.sill, sp.sill + fw, -fd / 2, fd / 2, M.alu);
      if (fullTop) L(g, -Wd / 2, Wd / 2, top - fw, top, -fd / 2, fd / 2, M.alu);
      const inner = Wd - 2 * fw, sy0 = sp.sill + fw, sy1 = fullTop ? top - fw : top;
      const rig = { id: win.id, sash: null, slide: 0, tilt: 0, slats: [], fw: fw, top: top, up: 0, full: 0, pitch: 0.047, slatH: 0.04 };
      function sash(gr, u0, u1, zo, yOff) {
        const sw = 0.032, sd = 0.022;
        L(gr, u0, u0 + sw, sy0 - yOff, sy1 - yOff, zo - sd / 2, zo + sd / 2, M.alu);
        L(gr, u1 - sw, u1, sy0 - yOff, sy1 - yOff, zo - sd / 2, zo + sd / 2, M.alu);
        L(gr, u0, u1, sy0 - yOff, sy0 + sw - yOff, zo - sd / 2, zo + sd / 2, M.alu);
        if (fullTop) L(gr, u0, u1, sy1 - sw - yOff, sy1 - yOff, zo - sd / 2, zo + sd / 2, M.alu);
        L(gr, u0 + sw, u1 - sw, sy0 + sw - yOff, (fullTop ? sy1 - sw : sy1) - yOff, zo - 0.003, zo + 0.003, M.glass, { cast: false });
      }
      if (sp.type === 'maximar') {
        const sg = new THREE.Group(); sg.position.y = sy1; g.add(sg);
        sash(sg, -inner / 2, inner / 2, 0, sy1);
        rig.sash = sg; rig.tilt = sp.inside * 25 * DEG;
      } else {
        sash(g, -inner / 2, 0.015, -0.016, 0);
        const sg = new THREE.Group(); g.add(sg);
        sash(sg, -0.015, inner / 2, 0.016, 0);
        rig.sash = sg; rig.slide = inner / 2 - 0.05;
      }
      if (sp.type === 'persiana' && fullTop) {
        const zo = -sp.inside * 0.05;
        rig.full = (top - fw) - (sp.sill + fw); rig.up = SHUT.up;
        const n = Math.ceil(rig.full / rig.pitch) + 1;
        for (let i = 0; i < n; i++) rig.slats.push(L(g, -inner / 2, inner / 2, -rig.slatH / 2, rig.slatH / 2, zo - 0.006, zo + 0.006, M.slat));
        rig.curtain = L(g, -inner / 2, inner / 2, -0.5, 0.5, zo - 0.004, zo + 0.004, M.shadowOnly, { noPick: true });
        applyShutter(rig, st.p);
      }
      const zA = 0, zB = sp.inside * (T / 2 + 0.035);
      L(g, -Wd / 2 - 0.03, Wd / 2 + 0.03, sp.sill - 0.025, sp.sill, Math.min(zA, zB), Math.max(zA, zB), M.sillStone);
      applySash(rig, st.s);
      const onShutter = (hit) => rig.slats.length > 0 && !!(hit && hit.point) && hit.point.y > Math.min(shutterBottom(rig, st.p) - 0.01, rig.top - 0.36);
      tag(g, {
        arch: true,
        label: function (hit) { return onShutter(hit) ? (st.shut ? 'Subir persiana' : 'Baixar persiana') : (st.open ? 'Fechar janela' : 'Abrir janela'); },
        act: function (hit) { if (onShutter(hit)) st.shut = !st.shut; else st.open = !st.open; }
      });
      windowRigs.push(rig);
      parent.add(g);
    }
    function buildDoorFrame(dr, parent, H) {
      const fwp = P.frame * S, ext = 0.012 * S, top = P.doorTop, ph = Math.min(top + P.frame, H);
      addBox(parent, toBox(dr.horiz, dr.a, dr.a + fwp, dr.c0 - ext, dr.c1 + ext, 0, ph), M.frameWhite);
      addBox(parent, toBox(dr.horiz, dr.b - fwp, dr.b, dr.c0 - ext, dr.c1 + ext, 0, ph), M.frameWhite);
      if (top + P.frame <= H + 1e-6) addBox(parent, toBox(dr.horiz, dr.a, dr.b, dr.c0 - ext, dr.c1 + ext, top, top + P.frame), M.frameWhite);
    }
    function buildDoorLeaf(dr, parent) {
      const sp = dr.spec, st = doorState[dr.id], off = sp.pivotOff !== undefined ? sp.pivotOff : P.frame * S;
      const along = sp.hinge === 'a' ? dr.a + off : dr.b - off;
      const across = sp.swing < 0 ? dr.c0 + 0.03 * S : dr.c1 - 0.03 * S;
      const pivot = new THREE.Group();
      if (dr.horiz) pivot.position.set(mx(along), 0, mz(across)); else pivot.position.set(mx(across), 0, mz(along));
      const dir = dr.horiz ? [sp.hinge === 'a' ? 1 : -1, 0] : [0, sp.hinge === 'a' ? 1 : -1];
      const nrm = dr.horiz ? [0, sp.swing] : [sp.swing, 0];
      const th = (v) => Math.atan2(-v[1], v[0]);
      const tc = th(dir); let to = th(nrm);
      while (to - tc > Math.PI) to -= 2 * Math.PI;
      while (to - tc < -Math.PI) to += 2 * Math.PI;
      const w = sp.leaf, h = P.doorTop - 0.01, t = 0.035;
      local(pivot, new THREE.BoxGeometry(w, h, t), dr.id === 'entrada' ? M.doorWood : M.door, w / 2, h / 2 + 0.006, 0);
      [1, -1].forEach(function (sd) {
        local(pivot, new THREE.CylinderGeometry(0.026, 0.026, 0.012, 20), M.chrome, w - 0.065, 1.02, sd * (t / 2 + 0.006), [Math.PI / 2, 0, 0]);
        local(pivot, new THREE.CylinderGeometry(0.009, 0.009, 0.04, 12), M.chrome, w - 0.065, 1.02, sd * (t / 2 + 0.02), [Math.PI / 2, 0, 0]);
        local(pivot, new THREE.BoxGeometry(0.12, 0.016, 0.018), M.chrome, w - 0.115, 1.02, sd * (t / 2 + 0.04));
      });
      const cur = st.open ? to : tc;
      pivot.rotation.y = cur;
      archHinges.push({ pivot: pivot, tc: tc, to: to, cur: cur, ref: st, len: w, thick: t, wx: pivot.position.x - CX, wz: pivot.position.z - CZ, speed: 5 });
      const name = dr.id === 'entrada' ? 'porta de entrada' : 'porta';
      tag(pivot, { arch: true, label: function () { return (st.open ? 'Fechar ' : 'Abrir ') + name; }, act: function () { st.open = !st.open; } });
      if (dbg) dbg.doors.push({ x: pivot.position.x, z: pivot.position.z, w: w, tc: tc, to: to, id: dr.id });
      parent.add(pivot);
    }
    function buildFinish(f, H, parent) {
      const h0 = f.h0 || 0, h1 = Math.min(f.h1 === undefined ? H : f.h1, H);
      if (h1 - h0 < 0.01) return;
      if (f.t) {
        const t = f.t, b = f.dir === 'W' ? { x0: mx(f.at) - t, x1: mx(f.at), z0: mz(f.from), z1: mz(f.to) }
          : f.dir === 'E' ? { x0: mx(f.at), x1: mx(f.at) + t, z0: mz(f.from), z1: mz(f.to) }
          : f.dir === 'N' ? { x0: mx(f.from), x1: mx(f.to), z0: mz(f.at) - t, z1: mz(f.at) }
          : { x0: mx(f.from), x1: mx(f.to), z0: mz(f.at), z1: mz(f.at) + t };
        b.h0 = h0; b.h1 = h1;
        addBox(parent, b, M[f.m], { cast: false });
        return;
      }
      const e = 0.002, A = f.dir === 'N' || f.dir === 'S';
      let p;
      if (A) {
        const z = mz(f.at) + (f.dir === 'S' ? e : -e), xa = mx(f.from), xb = mx(f.to);
        const l = f.dir === 'S' ? xa : xb, r = f.dir === 'S' ? xb : xa;
        p = [[l, h0, z], [r, h0, z], [r, h1, z], [l, h1, z]];
      } else {
        const x = mx(f.at) + (f.dir === 'E' ? e : -e), za = mz(f.from), zb = mz(f.to);
        const l = f.dir === 'E' ? zb : za, r = f.dir === 'E' ? za : zb;
        p = [[x, h0, l], [x, h0, r], [x, h1, r], [x, h1, l]];
      }
      const n = { N: [0, 0, -1], S: [0, 0, 1], E: [1, 0, 0], W: [-1, 0, 0] }[f.dir];
      const texM = 1.2;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([].concat(p[0], p[1], p[2], p[3])), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([].concat(n, n, n, n)), 3));
      const uv = [];
      p.forEach(function (pt) { uv.push((A ? pt[0] : pt[2]) / texM, pt[1] / texM); });
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const mesh = new THREE.Mesh(g, M[f.m]); mesh.receiveShadow = true;
      parent.add(mesh);
    }
    // guarda-corpo de vidro da sacada: vidro, corrimão e montantes na borda da laje
    function buildRailing(parent) {
      const br = P.balcony.r, x0 = mx(br[0]), x1 = mx(br[2]), z = mz(br[1]) + 0.07, hR = 1.08;
      addBox(parent, { x0: x0, x1: x1, z0: z - 0.006, z1: z + 0.006, h0: 0.06, h1: hR - 0.04 }, M.glass, { cast: false, noDbg: true });
      addBox(parent, { x0: x0, x1: x1, z0: z - 0.03, z1: z + 0.03, h0: hR - 0.04, h1: hR }, M.alu, { noDbg: true });
      addBox(parent, { x0: x0, x1: x1, z0: z - 0.03, z1: z + 0.03, h0: 0, h1: 0.06 }, M.alu, { noDbg: true });
      const nPost = Math.max(2, Math.round((x1 - x0) / 0.8));
      for (let i = 0; i <= nPost; i++) { const x = x0 + 0.02 + (x1 - x0 - 0.04) * i / nPost; addBox(parent, { x0: x - 0.02, x1: x + 0.02, z0: z - 0.025, z1: z + 0.025, h0: 0, h1: hR }, M.alu, { noDbg: true }); }
    }
    function buildArchitecture(H) {
      clearGroup(archGroup); clearGroup(doorGroup);
      archHinges.length = 0; windowRigs = [];
      for (let i = interList.length - 1; i >= 0; i--) if (interList[i].arch) interList.splice(i, 1);
      const A = window.buildArch(P, H);
      A.walls.forEach(function (w) { addBox(archGroup, toBox(w.horiz, w.a, w.b, w.c0, w.c1, w.h0, w.h1), wallMats); });
      addBox(archGroup, { x0: mx(P.shaft[0]), x1: mx(P.shaft[2]), z0: mz(P.shaft[1]), z1: mz(P.shaft[3]), h0: 0, h1: H }, shaftMats);
      A.windows.forEach(function (w) { buildWindow(w, archGroup, H); });
      A.doors.forEach(function (d) { buildDoorFrame(d, archGroup, H); if (H > P.doorTop) buildDoorLeaf(d, doorGroup); });
      P.finishes.forEach(function (f) { buildFinish(f, H, archGroup); });
      (P.accentWalls || []).forEach(function (f) { buildFinish(Object.assign({ m: 'accentWall' }, f), H, archGroup); });
      if (P.balcony) buildRailing(archGroup);
      overlay.position.y = H + 0.025;
      wallMounted.forEach(function (m) { m.visible = H > 2; });
      dirtyShadows();
      if (dbg) dbg.arch = A;
    }

    /* ---------------- móveis ---------------- */
    function rug(r, kind, g) {
      const w = (r[2] - r[0]) / S, d = (r[3] - r[1]) / S;
      return PB(r, 0.002, 0.014, std('#ffffff', { map: rugTex(kind, w, d), roughness: 1, env: 0.2 }), g, { cast: false, walk: true });
    }
    function pillow(r, y0, h, mat, g, o) { return PB(r, y0, y0 + h, mat, g, Object.assign({ r: h * 0.45 }, o || {})); }
    function cushion(cx, cz, size, th, mat, g, ry, tilt) {
      const m = new THREE.Mesh(roundedBoxGeo(th, size, size, Math.min(0.05, th * 0.45)), mat);
      m.position.set(mx(cx), 0.45 + size / 2 - 0.035, mz(cz));
      m.rotation.set(0, ry || 0, tilt || 0, 'YZX');
      m.castShadow = true; m.receiveShadow = true;
      if (dbg) dbg.boxes.push({ x0: mx(cx) - size / 2, x1: mx(cx) + size / 2, z0: mz(cz) - th, z1: mz(cz) + th, h0: 0.45, h1: 0.45 + size, hex: topHex(mat), grp: 'f' });
      g.add(m); return m;
    }
    const lampState = [];
    function lampToggle(g, mat, nameOn, nameOff, light, zone) {
      const ref = { on: false, zone: zone };
      lampState.push(ref);
      tag(g, { label: function () { return ref.on ? nameOff : nameOn; }, act: function () { ref.on = !ref.on; mat.emissiveIntensity = ref.on ? 1.7 : 0.12; if (light) light.intensity = ref.on ? 0.55 : 0; } });
    }
    function tableLamp(cx, cz, y0, parent) {
      const g = group(parent), x = mx(cx), z = mz(cz);
      const mat = std('#F4F1EA', { roughness: 0.9, emissive: lin('#FFD49A'), emissiveIntensity: 0.12 });
      cyl(x, z, 0.055, 0.055, y0, y0 + 0.02, M.black, g, { seg: 20 });
      cyl(x, z, 0.008, 0.008, y0 + 0.02, y0 + 0.26, M.black, g, { seg: 8 });
      cyl(x, z, 0.085, 0.085, y0 + 0.22, y0 + 0.38, mat, g, { top: 0.72, seg: 24 });
      const zn = zoneAtPx(cx, cz);
      lampToggle(g, mat, 'Acender abajur', 'Apagar abajur', addPoint(x, y0 + 0.3, z, zn, 2.6, 1.7), zn);
    }
    function globeLamp(cx, cz, r, y, parent, label) {
      const g = group(parent);
      const mat = std('#F7F3EA', { roughness: 0.6, emissive: lin('#FFD9A6'), emissiveIntensity: 0.12 });
      sphP(cx, cz, r, y, mat, g);
      const zn = zoneAtPx(cx, cz);
      lampToggle(g, mat, 'Acender ' + label, 'Apagar ' + label, addPoint(mx(cx), y, mz(cz), zn, 2.4, 1.7), zn);
      return g;
    }
    function plant(cx, cz, potR, y0, folR, g) {
      const x = mx(cx), z = mz(cz), potH = potR * 1.7, r = rng(Math.round(cx * 7 + cz * 13));
      cyl(x, z, potR, potR, y0, y0 + potH, M.pot, g, { bot: 0.8, seg: 20 });
      const leaves = [M.leaf1, M.leaf2, M.leaf3];
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + r(), dd = folR * (0.25 + r() * 0.45), rr = folR * (0.42 + r() * 0.3);
        sph(x + Math.cos(a) * dd, y0 + potH + folR * (0.35 + r() * 0.5), z + Math.sin(a) * dd, rr, leaves[i % 3], g);
      }
      sph(x, y0 + potH + folR * 0.85, z, folR * 0.55, M.leaf2, g);
    }
    // Armário genérico com portas que abrem (guarda-roupas, gabinetes): r em px, face = lado da frente
    function unit(r, face, o, parent) {
      const g = group(parent);
      const b = { x0: mx(r[0]), x1: mx(r[2]), z0: mz(r[1]), z1: mz(r[3]) };
      const alongX = face === 'N' || face === 'S';
      const A0 = alongX ? b.x0 : b.z0, A1 = alongX ? b.x1 : b.z1, len = A1 - A0;
      const out = (face === 'E' || face === 'S') ? 1 : -1;
      const front = face === 'E' ? b.x1 : face === 'W' ? b.x0 : face === 'S' ? b.z1 : b.z0;
      const back = face === 'E' ? b.x0 : face === 'W' ? b.x1 : face === 'S' ? b.z0 : b.z1;
      const dT = o.sliding ? 0.06 : 0.02, cd = Math.abs(front - back) - dT, fr = front - out * dT;
      const h0 = o.h0, h1 = o.h1, t = 0.018, mat = o.mat, inner = o.inner || mat;
      const U = (a0, a1, w0, w1, y0, y1, m, oo) => {
        const c0 = fr - out * w0, c1 = fr - out * w1, lo = Math.min(c0, c1), hi = Math.max(c0, c1);
        return addBox(g, alongX ? { x0: a0, x1: a1, z0: lo, z1: hi, h0: y0, h1: y1 } : { x0: lo, x1: hi, z0: a0, z1: a1, h0: y0, h1: y1 }, m, Object.assign({ noDbg: true }, oo || {}));
      };
      const UC = (ac, wc, rad, y0, y1, m) => { const c = fr - out * wc; return alongX ? cyl(ac, c, rad, rad, y0, y1, m, g, { seg: 18 }) : cyl(c, ac, rad, rad, y0, y1, m, g, { seg: 18 }); };
      const plinth = o.plinth || t;
      U(A0, A0 + t, 0, cd, h0, h1, mat);
      U(A1 - t, A1, 0, cd, h0, h1, mat);
      U(A0 + t, A1 - t, cd - 0.012, cd, h0, h1, inner);
      U(A0 + t, A1 - t, 0, cd - 0.012, h0, h0 + plinth, mat);
      if (o.topPanel !== false) U(A0 + t, A1 - t, 0, cd - 0.012, h1 - t, h1, mat);
      staticBoxes.push({ x0: b.x0 - CX, x1: b.x1 - CX, z0: b.z0 - CZ, z1: b.z1 - CZ, k: 'furn' });
      if (dbg) dbg.boxes.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, h0: h0, h1: h1, hex: topHex(mat), grp: 'f' });
      const rr = rng(Math.round(r[0] * 3 + r[1] * 5));
      const inY0 = h0 + plinth, inY1 = o.topPanel !== false ? h1 - t : h1;
      (o.sections || []).forEach(function (sec, si) {
        const s0 = A0 + len * sec.from + (si === 0 ? t : t / 2), s1 = A0 + len * sec.to - (sec.to >= 1 ? t : t / 2);
        if (sec.from > 0) U(A0 + len * sec.from - t / 2, A0 + len * sec.from + t / 2, 0.01, cd - 0.012, inY0, inY1, mat);
        if (sec.kind === 'hang') {
          const rodY = inY1 - 0.34;
          U(s0, s1, 0.01, cd - 0.012, rodY + 0.06, rodY + 0.078, inner);
          U(s0, s1, cd / 2 - 0.009, cd / 2 + 0.009, rodY - 0.009, rodY + 0.009, M.chrome, { cast: false });
          let a = s0 + 0.05;
          while (a < s1 - 0.045) {
            const th = 0.026 + rr() * 0.03, hh = 0.55 + rr() * 0.5, dd = Math.min(cd - 0.07, 0.38 + rr() * 0.06);
            U(a, a + th, (cd - dd) / 2, (cd + dd) / 2, rodY - 0.03 - hh, rodY - 0.03, garments[Math.floor(rr() * garments.length)], { r: 0.008 });
            U(a + th / 2 - 0.003, a + th / 2 + 0.003, cd / 2 - 0.17, cd / 2 + 0.17, rodY - 0.03, rodY - 0.012, M.chrome, { cast: false });
            a += th + 0.014 + rr() * 0.022;
          }
        } else if (sec.kind === 'shelves') {
          for (let y = inY0 + 0.36; y < inY1 - 0.12; y += 0.37) {
            U(s0, s1, 0.01, cd - 0.012, y - 0.018, y, inner);
            let a = s0 + 0.025;
            while (a < s1 - 0.1) {
              const sw = Math.min(0.29, s1 - a - 0.02), hh = 0.06 + rr() * 0.15;
              U(a, a + sw, 0.05, 0.05 + Math.min(0.30, cd - 0.09), y, y + hh, garments[Math.floor(rr() * garments.length)], { r: 0.012 });
              a += sw + 0.035;
            }
          }
        } else if (sec.kind === 'cabinet') {
          const ym = (inY0 + inY1) / 2, span = s1 - s0, wc = cd * 0.5;
          U(s0, s1, 0.01, cd - 0.012, ym - 0.016, ym, inner);
          if (sec.items === 'pots') {
            UC(s0 + span * 0.12, wc, 0.11, inY0, inY0 + 0.13, M.potSteel); UC(s0 + span * 0.3, wc, 0.09, inY0, inY0 + 0.17, M.potRed);
            UC(s0 + span * 0.62, wc, 0.12, ym, ym + 0.06, M.plates); UC(s0 + span * 0.85, wc, 0.1, ym, ym + 0.11, M.potSteel);
          } else if (sec.items === 'cleaning') {
            UC(s0 + span * 0.35, wc, 0.11, inY0, inY0 + 0.24, M.bucket); UC(s0 + span * 0.7, wc, 0.04, ym, ym + 0.22, M.detergent);
          } else if (sec.items === 'bath') {
            UC(s0 + span * 0.2, wc, 0.035, ym, ym + 0.18, M.detergent); UC(s0 + span * 0.35, wc, 0.03, ym, ym + 0.15, M.bottleClear);
            U(s0 + span * 0.55, s0 + span * 0.92, 0.06, cd - 0.06, inY0, inY0 + 0.16, M.towel, { r: 0.02 });
          }
        }
      });
      const n = o.n, dr0 = o.doorFrom || 0, dr1 = o.doorTo === undefined ? 1 : o.doorTo;
      if (dr1 < 1) U(A0 + len * dr1, A1, -dT, 0, h0, h1, mat);
      for (let i = 0; i < n; i++) {
        const a0 = A0 + len * (dr0 + (dr1 - dr0) * i / n) + 0.0015, a1 = A0 + len * (dr0 + (dr1 - dr0) * (i + 1) / n) - 0.0015, dw = a1 - a0;
        const atStart = n === 1 ? !o.hingeEnd : (i % 2 === 0);
        const ha = atStart ? a0 : a1, across = fr + out * dT / 2;
        const pivot = new THREE.Group();
        if (alongX) pivot.position.set(ha, 0, across); else pivot.position.set(across, 0, ha);
        const dir = alongX ? [atStart ? 1 : -1, 0] : [0, atStart ? 1 : -1];
        const nrm = alongX ? [0, out] : [out, 0];
        const tc = Math.atan2(-dir[1], dir[0]);
        const to = tc + openSign(dir, nrm) * (o.openDeg || 100) * DEG;
        const dy0 = o.doorH0 !== undefined ? o.doorH0 : h0 + 0.004, dy1 = o.doorH1 !== undefined ? o.doorH1 : h1 - 0.004;
        local(pivot, new THREE.BoxGeometry(dw, dy1 - dy0, dT), mat, dw / 2, (dy0 + dy1) / 2, 0);
        const zs = Math.sign(Math.sin(tc) * nrm[0] + Math.cos(tc) * nrm[1]) || 1;
        if (o.handle === 'h') local(pivot, new THREE.BoxGeometry(0.13, 0.014, 0.018), M.chrome, dw - 0.1, dy1 - 0.06, zs * (dT / 2 + 0.014));
        else local(pivot, new THREE.BoxGeometry(0.014, Math.min(0.4, (dy1 - dy0) * 0.5), 0.018), M.chrome, dw - 0.04, o.handleY || (dy0 + dy1) / 2, zs * (dT / 2 + 0.014));
        pivot.rotation.y = tc;
        g.add(pivot);
        const ref = { open: false };
        furnHinges.push({ pivot: pivot, tc: tc, to: to, cur: tc, ref: ref, len: dw, thick: dT, wx: pivot.position.x - CX, wz: pivot.position.z - CZ, speed: 6 });
        tag(pivot, { label: function () { return ref.open ? o.close : o.openL; }, act: function () { ref.open = !ref.open; } });
      }
      if (o.sliding) {
        const nD = o.sliding, L2 = len - 2 * t, dW = L2 / nD, ov = 0.014, pT = 0.018;
        const dy0 = h0 + 0.022, dy1 = h1 - 0.022;
        U(A0, A0 + t, -dT, 0, h0, h1, mat);                                    // laterais na frente dos trilhos
        U(A1 - t, A1, -dT, 0, h0, h1, mat);
        U(A0 + t, A1 - t, -dT, 0, h1 - 0.022, h1, M.alu, { cast: false });      // trilho de cima
        U(A0 + t, A1 - t, -dT, 0, h0, h0 + 0.022, M.alu, { cast: false });      // trilho de baixo
        const doorG = [];
        for (let i = 0; i < nD; i++) {
          const backTrack = i % 2 === 0;
          const a0 = A0 + t + i * dW - (backTrack && i > 0 ? ov : 0), a1 = A0 + t + (i + 1) * dW + (backTrack && i < nD - 1 ? ov : 0);
          const w0 = backTrack ? -0.028 : -0.052, w1 = w0 + pT;                // negativo = para fora do móvel
          const dg = new THREE.Group(); g.add(dg); doorG.push(dg);
          const PD = (b0, b1, v0, v1, m) => {
            const c0 = fr - out * v0, c1 = fr - out * v1, lo = Math.min(c0, c1), hi = Math.max(c0, c1);
            return addBox(dg, alongX ? { x0: b0, x1: b1, z0: lo, z1: hi, h0: dy0, h1: dy1 } : { x0: lo, x1: hi, z0: b0, z1: b1, h0: dy0, h1: dy1 }, m, { noDbg: true });
          };
          PD(a0, a1, w0, w1, mat);
          PD(a0, a0 + 0.022, w0 - 0.004, w1, M.alu);                             // perfis de alumínio (puxadores)
          PD(a1 - 0.022, a1, w0 - 0.004, w1, M.alu);
          const ref = { open: false };
          sliders.push({ ref: ref, cur: 0, dist: (backTrack ? 1 : -1) * dW, grp: dg, axis: alongX ? 'x' : 'z', wardrobe: true });
          tag(dg, { label: function () { return ref.open ? o.close : o.openL; }, act: function () { ref.open = !ref.open; } });
        }
        g.userData.slidingDoors = doorG;
      }
      return g;
    }
    function singleBed(r, g) {
      const x0 = r[0], y0 = r[1], x1 = r[2], y1 = r[3];
      PB([x0, y0, x1, y0 + 6], 0, 0.95, M.bedHead2, g, { r: 0.015, block: true });
      PB([x0 + 1, y0 + 6, x1 - 1, y1 - 3], 0.05, 0.28, M.bedBase, g, { r: 0.01, block: true });
      PB([x0 + 1, y0 + 6, x1 - 1, y1 - 3], 0.28, 0.48, M.sheet, g, { r: 0.045 });
      pillow([x0 + 6, y0 + 7, x1 - 6, y0 + 27], 0.48, 0.14, M.pillowGray, g, { rx: -0.35 });
      pillow([x0 + 10, y0 + 18, x1 - 8, y0 + 44], 0.49, 0.12, M.navyPillow, g, { rx: -0.25 });
      PB([x0 - 1, y0 + 58, x1 + 1, y1], 0.47, 0.515, M.stripes, g, { r: 0.02 });
      PB([x0 - 2, y0 + 89, x1 + 2, y0 + 160], 0.515, 0.54, M.mustard, g, { r: 0.01 });
    }
    function chair(r, back, g, mat) {
      const x0 = mx(r[0]), x1 = mx(r[2]), z0 = mz(r[1]), z1 = mz(r[3]), bw = 0.055, cm = mat || M.chair;
      const ns = back === 'N' || back === 'S';
      const seat = ns ? (back === 'N' ? { x0: x0 + 0.01, x1: x1 - 0.01, z0: z0 + 0.02, z1: z1 } : { x0: x0 + 0.01, x1: x1 - 0.01, z0: z0, z1: z1 - 0.02 })
        : back === 'W' ? { x0: x0 + 0.02, x1: x1, z0: z0 + 0.01, z1: z1 - 0.01 } : { x0: x0, x1: x1 - 0.02, z0: z0 + 0.01, z1: z1 - 0.01 };
      addBox(g, Object.assign({ h0: 0.40, h1: 0.47 }, seat), cm, { r: 0.025, block: true });
      if (ns) { const bz = back === 'N' ? [z0, z0 + bw] : [z1 - bw, z1]; addBox(g, { x0: x0 + 0.015, x1: x1 - 0.015, z0: bz[0], z1: bz[1], h0: 0.42, h1: 0.86 }, cm, { r: 0.025 }); }
      else { const bx = back === 'W' ? [x0, x0 + bw] : [x1 - bw, x1]; addBox(g, { x0: bx[0], x1: bx[1], z0: z0 + 0.015, z1: z1 - 0.015, h0: 0.42, h1: 0.86 }, cm, { r: 0.025 }); }
      [[seat.x0 + 0.03, seat.z0 + 0.03], [seat.x1 - 0.03, seat.z0 + 0.03], [seat.x0 + 0.03, seat.z1 - 0.03], [seat.x1 - 0.03, seat.z1 - 0.03]]
        .forEach(function (l) { cyl(l[0], l[1], 0.012, 0.012, 0, 0.40, M.legDark, g, { seg: 10 }); });
    }
    function slabWithHoles(r, holes, h0, h1, mat, g) {
      const s = new THREE.Shape();
      s.moveTo(mx(r[0]), mz(r[1])); s.lineTo(mx(r[2]), mz(r[1])); s.lineTo(mx(r[2]), mz(r[3])); s.lineTo(mx(r[0]), mz(r[3])); s.lineTo(mx(r[0]), mz(r[1]));
      holes.forEach(function (hr) {
        const p = new THREE.Path();
        p.moveTo(mx(hr[0]), mz(hr[1])); p.lineTo(mx(hr[0]), mz(hr[3])); p.lineTo(mx(hr[2]), mz(hr[3])); p.lineTo(mx(hr[2]), mz(hr[1])); p.lineTo(mx(hr[0]), mz(hr[1]));
        s.holes.push(p);
      });
      const geo = new THREE.ExtrudeGeometry(s, { depth: h1 - h0, bevelEnabled: false });
      geo.rotateX(Math.PI / 2); geo.translate(0, h1, 0);
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
      if (dbg) dbg.boxes.push({ x0: mx(r[0]), x1: mx(r[2]), z0: mz(r[1]), z1: mz(r[3]), h0: h0, h1: h1, hex: '#3e3e40', grp: 'f' });
      return m;
    }
    function basin(r, depth, topY, g) {
      return addBox(g, { x0: mx(r[0]), x1: mx(r[2]), z0: mz(r[1]), z1: mz(r[3]), h0: topY - depth, h1: topY - 0.002 }, M.steelIn, { cast: false });
    }
    function burner(cx, cz, r, g) {
      local(g, new THREE.TorusGeometry(r, 0.0055, 8, 28), M.burner, mx(cx), 0.909, mz(cz), [Math.PI / 2, 0, 0]);
      cyl(mx(cx), mz(cz), r * 0.42, r * 0.42, 0.906, 0.914, M.burner, g, { cast: false, seg: 18 });
    }
    function flameRing(cx, cz, r, parent) {
      const g = new THREE.Group(); g.position.set(mx(cx), 0.912, mz(cz)); g.visible = false; parent.add(g);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.0065, 0.03, 6), M.flame);
        f.position.set(Math.cos(a) * r, 0.015, Math.sin(a) * r); f.userData.noPick = true; g.add(f);
      }
      const glow = new THREE.Mesh(new THREE.TorusGeometry(r, 0.004, 6, 28), M.flameCore);
      glow.rotation.x = Math.PI / 2; glow.position.y = 0.003; glow.userData.noPick = true; g.add(glow);
      return g;
    }
    function waterStream(x, z, yTop, yBot, r, parent) {
      const g = new THREE.Group(); g.visible = false; parent.add(g);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.25, yTop - yBot, 10, 1, true), M.water);
      s.position.set(x, (yTop + yBot) / 2, z); s.userData.noPick = true; g.add(s);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(r * 4, r * 5.5, 0.006, 16), M.splash);
      sp.position.set(x, yBot + 0.004, z); sp.userData.noPick = true; g.add(sp);
      return { g: g, splash: sp };
    }
    function addFaucet(g, water, labels) {
      const ref = { on: false }, f = { ref: ref, water: water, phase: faucets.length * 1.7, shower: false, pos: null };
      const sp = water.splash && water.splash.position;
      f.pos = new THREE.Vector3(sp ? sp.x - CX : 0, 1.0, sp ? sp.z - CZ : 0);
      faucets.push(f);
      tag(g, { label: function () { return ref.on ? labels[1] : labels[0]; }, act: function () { ref.on = !ref.on; water.g.visible = ref.on; if (ref.on) audioUnlock(); } });
      return f;
    }
    function faucet(cx, cz, y0, dir, h, reach, bottomY, parent) {
      const g = group(parent), x = mx(cx), z = mz(cz), s = dir === 'S' ? 1 : -1;
      cyl(x, z, 0.014, 0.014, y0, y0 + h, M.chrome, g, { seg: 14 });
      local(g, new THREE.CylinderGeometry(0.011, 0.011, reach, 12), M.chrome, x, y0 + h - 0.012, z + s * reach / 2, [Math.PI / 2, 0, 0]);
      cyl(x, z + s * reach, 0.012, 0.012, y0 + h - 0.07, y0 + h, M.chrome, g, { seg: 12 });
      cyl(x + 0.05, z, 0.012, 0.012, y0 + h * 0.55, y0 + h * 0.55 + 0.05, M.chrome, g, { seg: 10 });
      addFaucet(g, waterStream(x, z + s * reach, y0 + h - 0.07, bottomY, 0.0075, g), ['Abrir torneira', 'Fechar torneira']);
    }
    function wallTap(cx, wallPy, y, bottomY, parent) {
      const g = group(parent), x = mx(cx), z = mz(wallPy);
      const sp = local(g, new THREE.CylinderGeometry(0.012, 0.012, 0.13, 12), M.chrome, x, y, z - 0.065, [Math.PI / 2, 0, 0]); wallMounted.push(sp);
      wallMounted.push(cyl(x, z - 0.125, 0.012, 0.012, y - 0.06, y, M.chrome, g, { seg: 12 }));
      wallMounted.push(cyl(x, z - 0.03, 0.022, 0.022, y + 0.01, y + 0.05, M.chrome, g, { seg: 14 }));
      addFaucet(g, waterStream(x, z - 0.125, y - 0.06, bottomY, 0.009, g), ['Abrir torneira do tanque', 'Fechar torneira do tanque']);
    }
    function tvUnit(r, h0, h1, screen, parent, game) {
      const g = group(parent);
      PB(r, h0, h1, M.tv, g, { r: 0.006, wall: true });
      const sw = mz(screen[2]) - mz(screen[1]), sh = screen[4] - screen[3];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), M.tvOff);
      m.rotation.y = -Math.PI / 2;
      m.position.set(mx(screen[0]) - 0.002, (screen[3] + screen[4]) / 2, (mz(screen[1]) + mz(screen[2])) / 2);
      g.add(m); wallMounted.push(m);
      const ref = { on: false };
      const tv = { ref: ref, screen: m, game: !!game, size: { w: sw, h: sh, inches: Math.hypot(sw, sh) / 0.0254 } };
      tv.matOn = function () { return tv.game && consoleState.on ? M.tvGame : M.tvOn; };
      tvs.push(tv);
      tag(g, { label: function () { return ref.on ? 'Desligar TV' : 'Ligar TV'; }, act: function () { ref.on = !ref.on; m.material = ref.on ? tv.matOn() : M.tvOff; if (ref.on) { drawTV(tvClock); drawGame(tvClock); } } });
      return tv;
    }
    // videogame genérico deitado na estante: liga e a TV da sala mostra o jogo
    const consoleState = { on: false };
    let estarTv = null;
    function setConsole(on) {
      consoleState.on = !!on;
      M.consoleLed.emissiveIntensity = consoleState.on ? 1.6 : 0.04;
      if (estarTv) {
        if (consoleState.on) estarTv.ref.on = true;
        estarTv.screen.material = estarTv.ref.on ? estarTv.matOn() : M.tvOff;
        if (estarTv.ref.on) { drawTV(tvClock); drawGame(tvClock); }
      }
      markDirty();
    }
    // Ar-condicionado split de parede, logo abaixo do teto, centralizado sobre a TV (wallXp = face da parede em px, voltada para oeste)
    const acs = [];
    function airConditioner(wallXp, cyp, L, parent) {
      const g = new THREE.Group(); g.position.set(mx(wallXp), 0, mz(cyp)); g.rotation.y = -Math.PI / 2; parent.add(g); wallMounted.push(g);
      const top = H_HIGH - 0.06, H = 0.29, D = 0.21, y0 = top - H;              // ~6 cm do teto
      const ac = { on: false, flap: null, cur: 0, display: null, pos: new THREE.Vector3(mx(wallXp) - CX - D / 2, y0 + H / 2, mz(cyp) - CZ), top: top, bottom: y0, len: L, wallX: mx(wallXp), cz: mz(cyp) };
      local(g, roundedBoxGeo(L, H, D, 0.03), M.acBody, 0, y0 + H / 2, D / 2);
      local(g, roundedBoxGeo(L - 0.02, H * 0.62, 0.012, 0.005), M.acPanel, 0, y0 + H * 0.62, D + 0.002);     // frente lisa
      local(g, new THREE.BoxGeometry(L - 0.12, 0.046, 0.01), M.acDark, 0, y0 + 0.05, D - 0.002);            // saída de ar
      for (let k = 0; k < 6; k++) local(g, new THREE.BoxGeometry(L - 0.16, 0.004, 0.03), M.acDark, 0, top + 0.001, 0.035 + k * 0.026);   // grade de entrada em cima
      const piv = new THREE.Group(); piv.position.set(0, y0 + 0.078, D + 0.006); g.add(piv);
      local(piv, new THREE.BoxGeometry(L - 0.1, 0.064, 0.008), M.acPanel, 0, -0.032, 0);                     // aba motorizada
      ac.flap = piv;
      const disp = local(g, new THREE.PlaneGeometry(0.075, 0.028), M.acDispOff, L / 2 - 0.1, y0 + H * 0.5, D + 0.0095);
      disp.castShadow = false; ac.display = disp;
      acs.push(ac);
      tag(g, { label: function () { return ac.on ? 'Desligar o ar-condicionado' : 'Ligar o ar-condicionado'; },
        act: function () { ac.on = !ac.on; disp.material = ac.on ? M.acDispOn : M.acDispOff; if (ac.on) audioUnlock(); } });
      return ac;
    }
    function stepACs(dt) {
      let moving = false;
      acs.forEach(function (a) {
        const t = a.on ? 1 : 0;
        if (a.cur !== t) { a.cur += Math.sign(t - a.cur) * Math.min(Math.abs(t - a.cur), dt * 0.8); if (Math.abs(t - a.cur) < 1e-4) a.cur = t; a.flap.rotation.x = -a.cur * 58 * DEG; moving = true; }
      });
      return moving;
    }
    function gameConsole(cyp, parent) {
      const g = group(parent);
      const xf = mx(P.console.xf) + 0.008, xb = mx(P.console.xb), cz = mz(cyp), L = 0.34, top = 0.53;
      addBox(g, { x0: xf, x1: xb, z0: cz - L / 2, z1: cz + L / 2, h0: top + 0.006, h1: top + 0.062 }, M.consoleBody, { r: 0.012 });
      addBox(g, { x0: xf + 0.03, x1: xb - 0.02, z0: cz - L / 2 + 0.025, z1: cz + L / 2 - 0.025, h0: top + 0.058, h1: top + 0.068 }, M.consoleTop, { r: 0.005 });
      for (let k = 0; k < 7; k++) addBox(g, { x0: xf + 0.05, x1: xb - 0.04, z0: cz - 0.075 + k * 0.025 - 0.003, z1: cz - 0.075 + k * 0.025 + 0.003, h0: top + 0.067, h1: top + 0.0695 }, M.consoleVent, { cast: false, noDbg: true });
      [[0.02, -1], [0.02, 1], [-0.02, -1], [-0.02, 1]].forEach(function (f) {
        cyl(f[0] > 0 ? xf + 0.03 : xb - 0.03, cz + f[1] * (L / 2 - 0.03), 0.012, 0.012, top, top + 0.007, M.consoleVent, g, { seg: 10, cast: false });
      });
      addBox(g, { x0: xf - 0.002, x1: xf + 0.001, z0: cz - L / 2 + 0.04, z1: cz + L / 2 - 0.1, h0: top + 0.031, h1: top + 0.036 }, M.consoleLed, { cast: false, noDbg: true });
      [0, 0.03].forEach(function (dz) { local(g, new THREE.CylinderGeometry(0.007, 0.007, 0.004, 16), M.consoleTop, xf - 0.001, top + 0.034, cz + L / 2 - 0.07 + dz, [0, 0, Math.PI / 2]); });
      tag(g, { label: function () { return consoleState.on ? 'Desligar o videogame' : 'Ligar o videogame'; }, act: function () { setConsole(!consoleState.on); } });
      // controle ao lado
      const pad = new THREE.Group(); pad.position.set(mx(P.console.padX), top, mz(cyp + 42)); pad.rotation.y = 0.35; g.add(pad);
      local(pad, roundedBoxGeo(0.06, 0.026, 0.1, 0.01), M.padBody, 0, 0.016, 0);
      [-1, 1].forEach(function (s) {
        const grip = local(pad, new THREE.SphereGeometry(1, 16, 12), M.padBody, 0.018, 0.018, s * 0.056); grip.scale.set(0.032, 0.017, 0.028);
        local(pad, new THREE.CylinderGeometry(0.008, 0.008, 0.012, 14), M.padStick, -0.006, 0.032, s * 0.026);
      });
      [[-0.016, 0.032], [0.0, 0.032], [-0.008, 0.024], [-0.008, 0.04]].forEach(function (b) { local(pad, new THREE.CylinderGeometry(0.004, 0.004, 0.006, 10), M.padStick, b[0] + 0.012, 0.03, -b[1] + 0.05); });
    }
    function fridge(r, parent) {
      const g = group(parent);
      const x0 = mx(r[0]), x1 = mx(r[2]), z0 = mz(r[1]), z1 = mz(r[3]);
      const dT = 0.05, zf = z0 + dT, wT = 0.03, H0 = 0.02, H1 = 1.76, sp = 1.24, w = x1 - x0;
      const B = (xa, xb, za, zb, ya, yb, m, o) => addBox(g, { x0: xa, x1: xb, z0: za, z1: zb, h0: ya, h1: yb }, m, Object.assign({ noDbg: true }, o || {}));
      B(x0, x0 + wT, zf, z1, H0, H1, M.steel); B(x1 - wT, x1, zf, z1, H0, H1, M.steel);
      B(x0 + wT, x1 - wT, zf, z1, H1 - wT, H1, M.steel); B(x0 + wT, x1 - wT, zf, z1, H0, H0 + 0.05, M.steel);
      B(x0 + wT, x1 - wT, z1 - wT, z1, H0 + 0.05, H1 - wT, M.steel);
      B(x0 + wT, x1 - wT, zf, z1 - wT, sp - 0.02, sp + 0.02, M.steel);
      B(x0 + wT, x1 - wT, zf, z1 - wT, H0 + 0.05, sp - 0.02, M.liner, { cast: false });
      B(x0 + wT, x1 - wT, zf, z1 - wT, sp + 0.02, H1 - wT, M.liner, { cast: false });
      [0.46, 0.76, 1.0, 1.47].forEach(function (y) { B(x0 + wT, x1 - wT, zf + 0.03, z1 - wT - 0.01, y, y + 0.008, M.shelfGlass, { cast: false }); });
      const cz = (zf + z1) / 2;
      B(x0 + 0.06, x0 + 0.13, cz - 0.04, cz + 0.04, 0.468, 0.70, M.milk);
      B(x0 + 0.16, x0 + 0.24, cz - 0.05, cz + 0.03, 0.468, 0.66, M.juice);
      cyl(x1 - 0.1, cz, 0.035, 0.035, 0.468, 0.74, M.bottleGreen, g, { seg: 14 });
      cyl(x1 - 0.18, cz + 0.06, 0.03, 0.03, 0.468, 0.70, M.bottleClear, g, { seg: 14 });
      B(x0 + 0.08, x0 + 0.28, cz - 0.08, cz + 0.06, 0.768, 0.83, M.cheese, { r: 0.01 });
      [[0.02, 0], [0.09, 0.03], [0.05, -0.05]].forEach(function (p) { sph((x0 + x1) / 2 + p[0], 1.044, cz + p[1], 0.035, M.apple, g); });
      B(x0 + 0.05, x1 - 0.05, zf + 0.04, z1 - 0.05, 0.075, 0.30, M.crisper, { r: 0.01, cast: false });
      B(x0 + 0.06, x0 + 0.34, cz - 0.15, cz + 0.12, sp + 0.02, sp + 0.07, M.pizza);
      B(x0 + 0.08, x1 - 0.08, cz - 0.1, cz + 0.1, 1.478, 1.54, M.ice, { r: 0.008 });
      const light = B((x0 + x1) / 2 - 0.12, (x0 + x1) / 2 + 0.12, zf + 0.06, zf + 0.2, sp - 0.045, sp - 0.022, M.fridgeLightOff, { cast: false });
      staticBoxes.push({ x0: x0 - CX, x1: x1 - CX, z0: z0 - CZ, z1: z1 - CZ, k: 'furn' });
      if (dbg) dbg.boxes.push({ x0: x0, x1: x1, z0: z0, z1: z1, h0: H0, h1: H1, hex: '#BCC0C4', grp: 'f' });
      [[H0 + 0.004, sp - 0.004, 'geladeira', true], [sp + 0.004, H1 - 0.004, 'freezer', false]].forEach(function (d) {
        const pivot = new THREE.Group(); pivot.position.set(x0, 0, z0 + dT / 2); g.add(pivot);
        local(pivot, roundedBoxGeo(w, d[1] - d[0], dT, 0.012), M.steel, w / 2, (d[0] + d[1]) / 2, 0);
        local(pivot, new THREE.BoxGeometry(w - 0.07, d[1] - d[0] - 0.07, 0.01), M.linerFront, w / 2, (d[0] + d[1]) / 2, dT / 2 + 0.005);
        local(pivot, new THREE.BoxGeometry(0.024, Math.min(0.42, (d[1] - d[0]) * 0.55), 0.03), M.chrome, w - 0.05, d[3] ? 0.95 : sp + 0.26, -(dT / 2 + 0.02));
        const shelves = d[3] ? [0.32, 0.66, 1.0] : [sp + 0.2];
        shelves.forEach(function (y, k) {
          local(pivot, new THREE.BoxGeometry(w - 0.1, 0.035, 0.09), M.shelfGlass, w / 2, y, dT / 2 + 0.055);
          for (let i = 0; i < 3; i++) {
            local(pivot, new THREE.CylinderGeometry(0.03, 0.03, 0.22 - k * 0.04, 12), [M.bottleClear, M.juice, M.bottleGreen][(i + k) % 3], 0.12 + i * 0.16, y + 0.12 - k * 0.02, dT / 2 + 0.055);
          }
        });
        const ref = { open: false };
        furnHinges.push({ pivot: pivot, tc: 0, to: 110 * DEG, cur: 0, ref: ref, len: w, thick: dT, wx: x0 - CX, wz: z0 + dT / 2 - CZ, speed: 5 });
        tag(pivot, {
          label: function () { return (ref.open ? 'Fechar ' : 'Abrir ') + d[2]; },
          act: function () { ref.open = !ref.open; if (d[3]) light.material = ref.open ? M.fridgeLightOn : M.fridgeLightOff; }
        });
      });
    }
    function washer(r, parent) {
      const g = group(parent);
      const b = { x0: mx(r[0]), x1: mx(r[2]), z0: mz(r[1]), z1: mz(r[3]), h0: 0.01, h1: 0.84 };
      addBox(g, b, M.washer, { r: 0.02, block: true });
      const cx = (b.x0 + b.x1) / 2;
      local(g, new THREE.CylinderGeometry(0.15, 0.15, 0.004, 32), M.drum, cx, 0.42, b.z0 - 0.002, [Math.PI / 2, 0, 0]);
      addBox(g, { x0: b.x0 + 0.03, x1: b.x1 - 0.03, z0: b.z0 - 0.004, z1: b.z0 + 0.002, h0: 0.72, h1: 0.80 }, M.screen, { cast: false, noDbg: true });
      const pivot = new THREE.Group(); pivot.position.set(cx - 0.18, 0, b.z0 - 0.016); g.add(pivot);
      local(pivot, new THREE.CylinderGeometry(0.16, 0.16, 0.03, 36), M.darkGlass, 0.18, 0.42, 0, [Math.PI / 2, 0, 0]);
      local(pivot, new THREE.TorusGeometry(0.175, 0.016, 10, 36), M.alu, 0.18, 0.42, -0.004);
      const ref = { open: false };
      furnHinges.push({ pivot: pivot, tc: 0, to: 100 * DEG, cur: 0, ref: ref, len: 0.36, thick: 0.04, wx: cx - 0.18 - CX, wz: b.z0 - 0.016 - CZ, speed: 5 });
      tag(pivot, { label: function () { return ref.open ? 'Fechar lava-roupas' : 'Abrir lava-roupas'; }, act: function () { ref.open = !ref.open; } });
    }

    // Poses: deitar e sentar (posição do olho, direção e onde se levanta), em px da planta
    const POSES = {};
    Object.keys(P.poses).forEach(function (k) { POSES[k] = Object.assign({}, P.poses[k], { yaw: P.poses[k].yaw * DEG }); });
    function poseTag(g, key) { const ps = POSES[key]; tag(g, { label: function () { return player.pose === ps ? 'Levantar' : ps.label; }, act: function () { if (player.pose === ps) standUp(); else sitOrLie(ps); } }); }

    // Vaso sanitário: louça com bacia e água, assento, tampa articulada e caixa acoplada com botão de descarga
    const toiletState = { open: false, lid: 0, flushT: -1, spin: 0, pivot: null, water: null, waterMesh: null, button: null, btnY: 0 };
    const TOILET_WATER_Y = 0.255;
    const bowlR = (y) => Math.sqrt(Math.max(0, 1 - Math.pow((0.385 - y) / 0.17, 2)));
    function toilet(parent) {
      const g = group(parent), bowlG = group(g), tankG = group(g);
      const TT = P.toilet, cx = mx(TT.c[0]), cz = mz(TT.c[1]), rx = 0.215, rz = 0.245;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.74, 0.385, 40, 1, true), M.ceramic);
      shell.scale.set(rx, 1, rz); shell.position.set(cx, 0.1925, cz); shell.castShadow = true; shell.receiveShadow = true; bowlG.add(shell);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.ceramicIn);
      bowl.scale.set(0.185, 0.17, 0.212); bowl.position.set(cx, 0.385, cz); bowl.receiveShadow = true; bowlG.add(bowl);
      const rimGeo = new THREE.RingGeometry(0.86, 1, 40, 1); rimGeo.rotateX(-Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, M.ceramic); rim.scale.set(rx, 1, rz); rim.position.set(cx, 0.385, cz); rim.receiveShadow = true; bowlG.add(rim);
      const waterG = new THREE.Group(); waterG.position.set(cx, TOILET_WATER_Y, cz); bowlG.add(waterG);
      const wGeo = new THREE.CircleGeometry(1, 40); wGeo.rotateX(-Math.PI / 2);
      const wm = new THREE.Mesh(wGeo, M.toiletWater); wm.userData.noPick = true; waterG.add(wm);
      const f0 = bowlR(TOILET_WATER_Y) * 0.98; wm.scale.set(0.185 * f0, 1, 0.212 * f0);
      const seatShape = new THREE.Shape(); seatShape.absellipse(0, 0, 0.198, 0.232, 0, Math.PI * 2, false, 0);
      const hole = new THREE.Path(); hole.absellipse(0, 0.012, 0.135, 0.165, 0, Math.PI * 2, true, 0); seatShape.holes.push(hole);
      const seatGeo = new THREE.ExtrudeGeometry(seatShape, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.005, bevelSegments: 2, curveSegments: 36 });
      seatGeo.rotateX(-Math.PI / 2);
      const seat = new THREE.Mesh(seatGeo, M.seat); seat.position.set(cx, 0.389, cz); seat.castShadow = true; seat.receiveShadow = true; bowlG.add(seat);
      const lidShape = new THREE.Shape(); lidShape.absellipse(0, 0, 0.2, 0.234, 0, Math.PI * 2, false, 0);
      const lidGeo = new THREE.ExtrudeGeometry(lidShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.006, bevelSegments: 2, curveSegments: 36 });
      lidGeo.rotateX(-Math.PI / 2); lidGeo.translate(0, 0.005, -0.205);
      const pivot = new THREE.Group(); pivot.position.set(cx, 0.407, cz + 0.205); bowlG.add(pivot);
      const lid = new THREE.Mesh(lidGeo, M.seat); lid.castShadow = true; lid.receiveShadow = true; pivot.add(lid);
      [-0.06, 0.06].forEach(function (dx) { addBox(bowlG, { x0: cx + dx - 0.015, x1: cx + dx + 0.015, z0: cz + 0.198, z1: cz + 0.226, h0: 0.392, h1: 0.41 }, M.chrome, { noDbg: true }); });
      staticBoxes.push({ x0: cx - rx - CX, x1: cx + rx - CX, z0: cz - rz - CZ, z1: cz + rz - CZ, k: 'furn' });
      if (dbg) dbg.circles.push({ x: cx, z: cz, rx: rx, rz: rz, h1: 0.41, hex: '#F6F6F4' });
      PB(TT.tank, 0.36, 0.80, M.ceramic, tankG, { r: 0.03, block: true });
      PB([TT.tank[0] + 1.5, TT.tank[1] + 0.5, TT.tank[2] - 1.5, TT.tank[3]], 0.80, 0.815, M.ceramic, tankG, { r: 0.006 });
      const btn = cylP(TT.btn[0], TT.btn[1], 0.024, 0.024, 0.815, 0.823, M.chrome, tankG, { seg: 24 });
      Object.assign(toiletState, { pivot: pivot, water: waterG, waterMesh: wm, button: btn, btnY: btn.position.y });
      tag(bowlG, { label: function () { return toiletState.open ? 'Fechar a tampa' : 'Abrir a tampa'; }, act: function () { toiletState.open = !toiletState.open; } });
      tag(tankG, { label: function () { return toiletState.flushT >= 0 ? 'Descarga em andamento…' : 'Dar descarga'; }, act: function () { flush(); } });
    }
    function flush() {
      if (toiletState.flushT >= 0) return;
      toiletState.flushT = 0;
      playFlush();
      markDirty();
    }
    function stepToilet(dt) {
      const ts = toiletState; let moving = false;
      if (!ts.pivot) return false;
      const target = ts.open ? 1 : 0;
      if (Math.abs(target - ts.lid) > 0.001) {
        ts.lid += (target - ts.lid) * Math.min(1, dt * 6);
        if (Math.abs(target - ts.lid) <= 0.001) ts.lid = target;
        ts.pivot.rotation.x = ts.lid * 90 * DEG; moving = true;
      }
      if (ts.flushT >= 0) {
        ts.flushT += dt;
        const t = ts.flushT, u = Math.min(1, t / 3.3);
        ts.button.position.y = ts.btnY - (t < 0.45 ? 0.005 : 0);
        const y = TOILET_WATER_Y - 0.05 * Math.sin(Math.PI * Math.min(1, t / 2.6));
        ts.water.position.y = y;
        const f = bowlR(y) * 0.98; ts.waterMesh.scale.set(0.185 * f, 1, 0.212 * f);
        ts.spin += dt * 15 * Math.sin(Math.PI * u);
        texSwirl.rotation = ts.spin;
        if (t >= 3.3) {
          ts.flushT = -1; ts.button.position.y = ts.btnY; ts.water.position.y = TOILET_WATER_Y;
          const f1 = bowlR(TOILET_WATER_Y) * 0.98; ts.waterMesh.scale.set(0.185 * f1, 1, 0.212 * f1);
        }
        moving = true;
      }
      return moving;
    }

    // Árvore de Natal no canto da sala (onde ficava a mesa): ponta da estrela a ~2,44 m, o teto fica a 2,50 m
    const XMAS_CORNER = [836, 491];                 // faces das duas paredes do canto (x, y), em px
    const xmas = { on: true, zone: 3, mats: [], star: null, light: null, last: 0, pos: null, group: null, starTop: 0, center: null };
    function setXmas(on) {
      xmas.on = !!on;
      xmas.mats.forEach(function (m) { m.emissiveIntensity = xmas.on ? 1.4 : 0.03; });
      xmas.star.emissiveIntensity = xmas.on ? 0.7 : 0.06;
      xmas.light.intensity = xmas.on && state.furniture ? 0.32 : 0;
      markDirty();
    }
    function christmasTree(cxp, czp, parent) {
      const g = group(parent), cx = mx(cxp), cz = mz(czp);
      const dxW = mx(XMAS_CORNER[0]) - cx, dzW = mz(XMAS_CORNER[1]) - cz;     // distância até as duas paredes do canto
      const room = function (ox, oz, m) { return ox < dxW - m && oz < dzW - m; };
      xmas.group = g; xmas.center = [cx, cz]; xmas.pos = new THREE.Vector3(cx - CX, 1.2, cz - CZ);
      const dm = new THREE.Object3D();
      const instanced = function (geo, mat, list, size) {
        if (!list.length) return null;
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach(function (b, k) { dm.position.set(b.x, b.y, b.z); dm.rotation.set(0, 0, 0); dm.scale.set(b.s || size, b.s || size, b.s || size); dm.updateMatrix(); im.setMatrixAt(k, dm.matrix); });
        im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
        g.add(im); return im;
      };
      // folhagem com textura de agulhas de pinheiro
      const texNeedle = canvasTex(256, 256, function (gg, w, h) {
        gg.fillStyle = '#1f4a28'; gg.fillRect(0, 0, w, h);
        const r = rng(1225);
        for (let i = 0; i < 2600; i++) {
          const x = r() * w, y = r() * h, len = 6 + r() * 12, a = Math.PI / 2 + (r() - 0.5) * 1.3, c = r();
          gg.strokeStyle = c < 0.45 ? 'rgba(66,120,64,.85)' : c < 0.8 ? 'rgba(38,86,44,.9)' : 'rgba(110,160,96,.7)';
          gg.lineWidth = 1 + r() * 1.2; gg.beginPath(); gg.moveTo(x, y); gg.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); gg.stroke();
        }
      });
      texNeedle.repeat.set(5, 2);
      const pine = std('#ffffff', { map: texNeedle, roughness: 0.92, env: 0.35, side: THREE.DoubleSide });
      // saia vermelha com barra branca e tronco
      cyl(cx, cz, 0.47, 0.47, 0.002, 0.018, std('#a3141f', { roughness: 0.95 }), g, { seg: 40, cast: false });
      const fluff = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.022, 8, 48), std('#f4f2ee', { roughness: 1 }));
      fluff.rotation.x = Math.PI / 2; fluff.position.set(cx, 0.024, cz); fluff.receiveShadow = true; g.add(fluff);
      cyl(cx, cz, 0.05, 0.05, 0.018, 0.4, std('#5a3d26', { roughness: 0.9 }), g, { seg: 12 });
      // copa: 5 andares de galhos (cones) com a borda irregular e as pontas caídas
      const TIERS = [[0.30, 0.50, 0.70], [0.68, 0.43, 0.64], [1.05, 0.35, 0.58], [1.42, 0.27, 0.52], [1.77, 0.18, 0.50]];   // base y, raio, altura (m)
      TIERS.forEach(function (t, i) {
        const geo = new THREE.ConeGeometry(t[1], t[2], 28, 4, true);
        const pa = geo.attributes.position;
        for (let k = 0; k < pa.count; k++) {
          const x = pa.getX(k), y = pa.getY(k), z = pa.getZ(k);
          if (Math.hypot(x, z) < 1e-5) continue;
          const a = Math.atan2(z, x), down = (t[2] / 2 - y) / t[2];
          const f = 1 + (0.07 * Math.sin(a * 9 + i * 1.7) + 0.035 * Math.sin(a * 23 + i)) * down;
          pa.setX(k, x * f); pa.setZ(k, z * f);
          if (down > 0.99) pa.setY(k, y - 0.035 * (0.5 + 0.5 * Math.sin(a * 14 + i * 2.3)));
        }
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, pine); m.position.set(cx, t[0] + t[2] / 2, cz); m.rotation.y = i * 0.7;
        m.castShadow = true; m.receiveShadow = true; g.add(m);
      });
      const env = function (y) { let r = 0; TIERS.forEach(function (t) { if (y >= t[0] && y <= t[0] + t[2]) r = Math.max(r, t[1] * (1 - (y - t[0]) / t[2])); }); return r; };
      // bolas: vermelhas, douradas, prateadas e azuis
      const R = rng(2512);
      const BALLS = [['#b3121e', 0.35, 0.3], ['#d4a531', 0.85, 0.22], ['#c9ced6', 0.9, 0.18], ['#1f4fa8', 0.4, 0.25]];
      const balls = BALLS.map(function () { return []; });
      for (let i = 0; i < 80; i++) {
        const y = 0.42 + R() * 1.62, rad = 0.028 + R() * 0.022, a = R() * Math.PI * 2, rr = env(y) * 0.96 + rad * 0.4;
        const ox = Math.cos(a) * rr, oz = Math.sin(a) * rr;
        if (!room(ox, oz, rad + 0.012)) continue;
        balls[Math.floor(R() * 4)].push({ x: cx + ox, y: y - rad, z: cz + oz, s: rad });
      }
      const ballGeo = new THREE.SphereGeometry(1, 16, 12);
      BALLS.forEach(function (c, i) { instanced(ballGeo, std(c[0], { metalness: c[1], roughness: c[2], env: 1.2 }), balls[i]); });
      // pisca-pisca em espiral (5 cores, piscam devagar)
      const BULBS = ['#fff3c4', '#ff4b4b', '#4cff7a', '#4f8bff', '#ffd23a'];
      const bulbs = BULBS.map(function () { return []; });
      const NB = 130;
      for (let i = 0; i < NB; i++) {
        const t = i / (NB - 1), y = 0.38 + t * 1.82, a = t * Math.PI * 2 * 6.5 + 0.4, rr = env(y) * 0.99 + 0.012;
        const ox = Math.cos(a) * rr, oz = Math.sin(a) * rr;
        if (!room(ox, oz, 0.02)) continue;
        bulbs[i % 5].push({ x: cx + ox, y: y, z: cz + oz });
      }
      const bulbGeo = new THREE.SphereGeometry(1, 10, 8);
      BULBS.forEach(function (c, i) {
        const mat = std(c, { roughness: 0.3, emissive: lin(c), emissiveIntensity: 1.4, env: 0.6 });
        xmas.mats.push(mat);
        instanced(bulbGeo, mat, bulbs[i], 0.013);
      });
      // festão dourado caindo em arcos
      const pts = [];
      for (let i = 0; i <= 260; i++) {
        const t = i / 260, y = 0.45 + t * 1.7, a = t * Math.PI * 2 * 4.5 + 2.2, rr = env(y) * 0.98 + 0.018;
        pts.push(new THREE.Vector3(cx + Math.min(Math.cos(a) * rr, dxW - 0.03), y - 0.04 * Math.abs(Math.sin(a * 2)), cz + Math.min(Math.sin(a) * rr, dzW - 0.03)));
      }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 520, 0.011, 6, false), std('#e0b443', { metalness: 0.9, roughness: 0.28, env: 1.3 }));
      tube.castShadow = true; tube.receiveShadow = true; g.add(tube);
      // estrela dourada na ponta, virada para a sala
      const ss = new THREE.Shape();
      for (let k = 0; k < 10; k++) { const ang = Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? 0.046 : 0.112; if (k) ss.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad); else ss.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad); }
      ss.closePath();
      const sg = new THREE.ExtrudeGeometry(ss, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.006, bevelSegments: 2 });
      sg.translate(0, 0, -0.009);
      xmas.star = std('#e9c14a', { metalness: 0.8, roughness: 0.25, emissive: lin('#ffd45c'), emissiveIntensity: 0.7, env: 1.3 });
      const star = new THREE.Mesh(sg, xmas.star); star.position.set(cx, 2.322, cz); star.rotation.y = -Math.PI * 0.75; star.castShadow = true; g.add(star);
      xmas.starTop = 2.322 + 0.112 + 0.006;
      // presentes embaixo da árvore, do lado da sala
      const GIFTS = [[-46, 6, 0.28, 0.22, 0.28, '#b3121e', '#e2b544', 0.35], [-30, -34, 0.34, 0.17, 0.26, '#1f4fa8', '#d9dde3', -0.25], [2, -48, 0.26, 0.30, 0.26, '#f3f1ec', '#c0182a', 0.1],
        [-8, -22, 0.2, 0.14, 0.2, '#d4a531', '#b3121e', 0.6], [24, -36, 0.22, 0.2, 0.3, '#2f7a3d', '#e2b544', -0.5]];
      GIFTS.forEach(function (gf) {
        const gg = new THREE.Group(); gg.position.set(cx + gf[0] / S, 0, cz + gf[1] / S); gg.rotation.y = gf[7]; g.add(gg);
        const w = gf[2], h = gf[3], d = gf[4], boxM = std(gf[5], { roughness: 0.55 }), ribM = std(gf[6], { roughness: 0.35, metalness: 0.3 });
        local(gg, roundedBoxGeo(w, h, d, 0.01), boxM, 0, h / 2, 0);
        local(gg, new THREE.BoxGeometry(w + 0.004, h + 0.004, 0.026), ribM, 0, h / 2, 0);
        local(gg, new THREE.BoxGeometry(0.026, h + 0.004, d + 0.004), ribM, 0, h / 2, 0);
        [-1, 1].forEach(function (s) { local(gg, new THREE.TorusGeometry(0.028, 0.008, 6, 16), ribM, s * 0.022, h + 0.018, 0, [0, s * 0.6, s * 0.5]); });
      });
      // brilho quente do pisca-pisca no canto (só ilumina a sala)
      xmas.light = addPoint(cx - 0.25, 1.15, cz - 0.25, 3, 3.2, 1.6, 0xffc98a);
      xmas.light.intensity = 0.32;
      lampState.push(xmas);
      staticBoxes.push({ x0: wx(712), x1: wx(XMAS_CORNER[0]), z0: wz(368), z1: wz(XMAS_CORNER[1]), k: 'furn' });
      if (dbg) dbg.boxes.push({ x0: mx(712), x1: mx(836), z0: mz(368), z1: mz(491), h0: 0, h1: xmas.starTop, hex: '#2f5a2e', grp: 'f' });
      tag(g, { label: function () { return xmas.on ? 'Apagar o pisca-pisca' : 'Acender o pisca-pisca'; }, act: function () { setXmas(!xmas.on); } });
    }
    // pisca-pisca: cada cor pulsa no seu ritmo; só anima perto da árvore (longe fica aceso parado)
    function stepXmas(now) {
      if (!xmas.group) return false;
      const lit = xmas.on && state.furniture;
      if (!lit) { if (xmas.light.intensity !== 0) { xmas.light.intensity = 0; return true; } return false; }
      if (camera.position.distanceTo(xmas.pos) > 9 || now - xmas.last < 110) {
        if (xmas.light.intensity === 0) { xmas.light.intensity = 0.32; return true; }
        return false;
      }
      xmas.last = now;
      const t = now / 1000;
      xmas.mats.forEach(function (m, k) { m.emissiveIntensity = 0.5 + 1.8 * Math.pow(0.5 + 0.5 * Math.sin(t * (1.3 + k * 0.37) + k * 1.9), 2); });
      xmas.light.intensity = 0.32 * (0.92 + 0.08 * Math.sin(t * 2.3));
      return true;
    }

    // Espelhos que refletem a cena de verdade (THREE.Reflector). Se o componente não carregar, usa o material metálico.
    const mirrors = [];
    function realMirror(parent, cx, cy, cz, w, h, ry, scale) {
      let m = null;
      if (THREE.Reflector && !window.__noReflector) {
        try {
          m = new THREE.Reflector(new THREE.PlaneGeometry(w, h), { clipBias: 0.003, textureWidth: 512, textureHeight: 512, color: 0x7b7e7e });
          m.userData.scale = scale || 1; mirrors.push(m);
        } catch (e) { console.warn('espelho', e); m = null; }
      }
      if (!m) { m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.mirror); m.receiveShadow = true; }
      m.position.set(cx, cy, cz); m.rotation.y = ry || 0;
      m.userData.size = { w: w, h: h };
      parent.add(m); wallMounted.push(m);
      return m;
    }
    // a imagem refletida acompanha a resolução da tela (o espelho pequeno do banheiro usa menos)
    function sizeMirrors() {
      if (!mirrors.length) return;
      const pr = (renderer.getPixelRatio && renderer.getPixelRatio()) || 1;
      const bw = (stage.clientWidth || window.innerWidth) * pr, bh = (stage.clientHeight || window.innerHeight) * pr;
      mirrors.forEach(function (m) {
        const s = 0.8 * (m.userData.scale || 1);
        try { m.getRenderTarget().setSize(Math.max(256, Math.min(2048, Math.round(bw * s))), Math.max(256, Math.min(2048, Math.round(bh * s)))); } catch (e) { /* fica no tamanho padrão */ }
      });
    }
    // espelho do piso ao teto na parede da circulação (lado de fora do dormitório 2), do batente da porta até a quina
    function buildWallMirror() {
      if (!P.mirrorWall) return null;
      const x0 = mx(P.mirrorWall.x0), x1 = mx(P.mirrorWall.x1), y0 = 0.015, y1 = 2.485, z = mz(P.mirrorWall.at);
      addBox(fixGroup, { x0: x0, x1: x1, z0: z, z1: z + 0.0075, h0: y0, h1: y1 }, M.mirror, { wall: true, cast: false, noDbg: true });
      return realMirror(fixGroup, (x0 + x1) / 2, (y0 + y1) / 2, z + 0.008, x1 - x0 - 0.004, y1 - y0 - 0.004, 0, 1);
    }

    let tvClock = 0;
    const showerSlide = { ref: { open: false }, cur: 0, dist: 0.6, grp: null };
    // Móveis da planta COM SACADA, como na planta decorada da Baliza (coordenadas em px da imagem de 825 x 768)
    function buildFurnitureCS(root) {
      const robe = { h0: 0, h1: 2.20, mat: M.wardrobe, inner: M.innerWhite, plinth: 0.07, handle: 'v', handleY: 1.05, openL: 'Abrir guarda-roupa', close: 'Fechar guarda-roupa' };
      const yellow = std('#E2B12F', { roughness: 0.6 }), blueChair = std('#1D3EA8', { map: texFabric, roughness: 0.92 });
      const kidTable = std('#7B808A', { roughness: 0.5 }), stoolSeat = std('#45494F', { roughness: 0.6 }), dried = std('#CDB48C', { roughness: 0.95 });

      /* Dormitório 1: cama de casal na parede da esquerda, TV e ar-condicionado na parede da porta, roupeiro em L */
      const d1 = group(root);
      rug([75, 42, 267, 287], 'gray', d1);
      PB([35, 40, 47, 296], 0, 1.10, M.navyPanel, d1, { r: 0.012, block: true });
      PB([48, 42, 86, 94], 0, 0.50, M.nightstand, d1, { r: 0.012, block: true });
      PB([48, 246, 86, 296], 0, 0.50, M.nightstand, d1, { r: 0.012, block: true });
      tableLamp(66, 62, 0.50, d1);
      plant(58, 284, 0.032, 0.50, 0.07, d1);
      globeLamp(74, 270, 0.055, 0.555, d1, 'luminária');
      const bed1 = group(d1);
      PB([48, 96, 56, 260], 0, 1.00, M.bedHead1, bed1, { r: 0.02, block: true });
      PB([56, 99, 232, 257], 0.05, 0.30, M.bedBase, bed1, { r: 0.01, block: true });
      PB([56, 98, 233, 258], 0.30, 0.52, M.sheet, bed1, { r: 0.05 });
      pillow([60, 102, 112, 170], 0.52, 0.15, M.mustard, bed1, { rz: 0.28 });
      pillow([60, 186, 112, 254], 0.52, 0.15, M.mustard, bed1, { rz: 0.28 });
      pillow([92, 118, 124, 168], 0.53, 0.13, M.navyPillow, bed1, { rz: 0.18 });
      pillow([92, 188, 124, 238], 0.53, 0.13, M.navyPillow, bed1, { rz: 0.18 });
      pillow([118, 150, 140, 206], 0.54, 0.11, M.navy, bed1, { rz: 0.12 });
      PB([132, 93, 240, 263], 0.50, 0.58, M.duvet, bed1, { r: 0.04 });
      PB([176, 92, 226, 264], 0.58, 0.603, M.navy, bed1, { r: 0.006 });
      PB([176, 88, 226, 92], 0.36, 0.603, M.navy, bed1, { r: 0.004 });
      PB([176, 264, 226, 268], 0.36, 0.603, M.navy, bed1, { r: 0.004 });
      poseTag(bed1, 'cama1');
      tvUnit([272, 104, 278, 236], 1.00, 1.72, [272, 107, 233, 1.035, 1.685], d1);
      unit([35, 297, 87, 476], 'E', Object.assign({ n: 3, doorTo: (425 - 297) / (476 - 297), sections: [{ from: 0, to: 0.44, kind: 'hang' }, { from: 0.44, to: 1, kind: 'shelves' }] }, robe), d1);
      unit([87, 425, 188, 476], 'N', Object.assign({ n: 2, sections: [{ from: 0, to: 0.65, kind: 'hang' }, { from: 0.65, to: 1, kind: 'shelves' }] }, robe), d1);

      /* Dormitório 2: cama de solteiro na parede da direita, cantinho infantil e roupeiro ao lado da porta */
      const d2 = group(root);
      rug([297, 46, 446, 262], 'gray', d2);
      const bed2 = group(d2);
      singleBed([441, 40, 531, 232], bed2);
      poseTag(bed2, 'cama2');
      cylP(354, 108, 0.24, 0.24, 0.44, 0.47, kidTable, d2, { seg: 32 });
      cylP(354, 108, 0.03, 0.03, 0.0, 0.44, M.legDark, d2, { seg: 10, block: true });
      PB([336, 44, 362, 70], 0.26, 0.30, yellow, d2, { r: 0.01, block: true });
      PB([336, 44, 362, 48], 0.30, 0.52, yellow, d2, { r: 0.008 });
      cylP(313, 103, 0.13, 0.13, 0, 0.32, M.navy, d2, { seg: 24, block: true });
      cylP(357, 186, 0.17, 0.17, 0, 0.28, M.cushionWhite, d2, { seg: 28, block: true });
      cylP(357, 186, 0.175, 0.175, 0.28, 0.30, M.navyPillow, d2, { seg: 28 });
      PB([291, 128, 313, 200], 0, 0.42, yellow, d2, { r: 0.01, block: true });
      sphP(302, 150, 0.07, 0.5, M.pillowGray, d2);
      PB([376, 39, 438, 82], 0, 0.75, M.white, d2, { r: 0.008, block: true });
      tableLamp(424, 58, 0.75, d2);
      [[396, 140, yellow], [410, 160, M.navyPillow], [384, 170, M.cushionWhite]].forEach(function (t) { PB([t[0], t[1], t[0] + 9, t[1] + 9], 0.014, 0.08, t[2], d2, { r: 0.008 }); });
      unit([400, 302, 533, 356], 'N', Object.assign({ n: 3, sections: [{ from: 0, to: 0.5, kind: 'hang' }, { from: 0.5, to: 1, kind: 'shelves' }] }, robe), d2);

      /* Estar / Jantar: sofá na parede da esquerda, mesa de centro oval, rack com TV de 65", videogame e ar; mesa de 4 lugares */
      const es = group(root);
      rug([643, 152, 746, 368], 'light', es);
      const sofaG = group(es);
      PB([549, 150, 642, 372], 0.06, 0.30, M.sofaDark, sofaG, { r: 0.03, block: true });
      PB([549, 150, 642, 171], 0.06, 0.62, M.sofaDark, sofaG, { r: 0.045 });
      PB([549, 351, 642, 372], 0.06, 0.62, M.sofaDark, sofaG, { r: 0.045 });
      PB([549, 171, 572, 351], 0.30, 0.84, M.sofaDark, sofaG, { r: 0.04 });
      PB([572, 172, 642, 260], 0.30, 0.45, M.sofa, sofaG, { r: 0.045 });
      PB([572, 262, 642, 350], 0.30, 0.45, M.sofa, sofaG, { r: 0.045 });
      PB([567, 173, 592, 259], 0.43, 0.80, M.sofa, sofaG, { r: 0.05, rz: 0.16 });
      PB([567, 263, 592, 349], 0.43, 0.80, M.sofa, sofaG, { r: 0.05, rz: 0.16 });
      cushion(589, 236, 0.44, 0.13, M.navy, sofaG, -0.5, 0.32);
      cushion(597, 276, 0.42, 0.13, M.navy, sofaG, 0.3, 0.3);
      cushion(598, 314, 0.40, 0.12, M.mustard, sofaG, -0.35, 0.22);
      cushion(593, 343, 0.38, 0.12, M.mustard, sofaG, 0.25, 0.2);
      poseTag(sofaG, 'sofa');
      cylP(702, 250, 0.21, 0.60, 0.39, 0.42, M.black, es, { seg: 40 });
      cylP(702, 250, 0.10, 0.30, 0.0, 0.39, M.black, es, { seg: 32, block: true });
      cylP(700, 246, 0.045, 0.045, 0.42, 0.60, M.ceramic, es, { seg: 20 });
      sphP(700, 246, 0.11, 0.70, dried, es, 0.8);
      PB([757, 152, 788, 358], 0.36, 0.53, M.white, es, { r: 0.008, block: true });
      estarTv = tvUnit([782, 189, 789, 321], 0.89, 1.63, [782, 190, 320, 0.897, 1.623], es);   // ~58 polegadas, como na planta
      PB([762, 160, 782, 180], 0.53, 0.72, M.black, es, { r: 0.006 });
      PB([762, 336, 782, 356], 0.53, 0.72, M.black, es, { r: 0.006 });
      plant(772, 208, 0.045, 0.53, 0.11, es);
      PB([652, 405, 787, 492], 0.72, 0.75, M.tableTop, es, { r: 0.006, block: true });
      [[658, 411], [781, 411], [658, 486], [781, 486]].forEach(function (l) { cylP(l[0], l[1], 0.02, 0.02, 0, 0.72, M.legDark, es, { seg: 10 }); });
      [[667, 414], [729, 414], [667, 455], [729, 455]].forEach(function (pm) {
        PB([pm[0], pm[1], pm[0] + 46, pm[1] + 32], 0.75, 0.754, M.pouf, es, { r: 0.002, cast: false });
        cylP(pm[0] + 23, pm[1] + 16, 0.12, 0.12, 0.754, 0.77, M.ceramic, es, { seg: 28 });
      });
      chair([665, 376, 711, 404], 'N', es, blueChair); chair([728, 376, 774, 404], 'N', es, blueChair);
      chair([668, 493, 712, 521], 'S', es, blueChair); chair([729, 493, 773, 521], 'S', es, blueChair);

      /* Sacada: dois vasos de plantas */
      const sc = group(root);
      plant(578, 82, 0.09, 0, 0.26, sc);
      plant(758, 64, 0.07, 0, 0.2, sc);

      /* Cozinha americana: bancada com cooktop e cuba, balcão alto com 3 banquetas; área de serviço com tanque, lava-roupas e geladeira */
      const kz = group(root);
      unit([413, 530, 605, 585], 'S', { h0: 0.10, h1: 0.87, n: 4, mat: M.cabinet, inner: M.innerWhite, topPanel: false, handle: 'h', openDeg: 95, sections: [{ from: 0, to: 1, kind: 'cabinet', items: 'pots' }], openL: 'Abrir armário', close: 'Fechar armário' }, kz);
      PB([415, 532, 605, 581], 0, 0.10, M.toe, kz, { cast: false });
      PB([411, 518, 607, 530], 0, 0.90, M.cabinet, kz, { block: true });
      slabWithHoles([411, 527, 607, 588], [[520, 536, 564, 578]], 0.87, 0.90, M.granite, kz);
      basin([520, 536, 564, 578], 0.18, 0.90, kz);
      PB([411, 477, 607, 527], 1.02, 1.05, M.granite, kz, { r: 0.004, block: true });
      PB([411, 518, 607, 527], 0.90, 1.02, M.granite, kz);
      const cookG = group(kz);
      PB([418, 534, 477, 580], 0.90, 0.906, M.cooktop, cookG, { r: 0.004, cast: false });
      const cook = { ref: { on: false }, flames: [] };
      [[433, 545, 0.034], [462, 545, 0.03], [433, 569, 0.03], [462, 569, 0.042]].forEach(function (b) { burner(b[0], b[1], b[2], cookG); cook.flames.push(flameRing(b[0], b[1], b[2], cookG)); });
      cooktops.push(cook);
      tag(cookG, { label: function () { return cook.ref.on ? 'Apagar o fogão' : 'Acender o fogão'; }, act: function () { cook.ref.on = !cook.ref.on; cook.flames.forEach(function (f) { f.visible = cook.ref.on; }); } });
      faucet(542, 534, 0.90, 'S', 0.28, 0.17, 0.725, kz);
      plant(596, 560, 0.05, 0.90, 0.11, kz);
      [448, 512, 578].forEach(function (x) {
        cylP(x, 459, 0.17, 0.17, 0.72, 0.76, stoolSeat, kz, { seg: 24, block: true });
        cylP(x, 459, 0.025, 0.025, 0.02, 0.72, M.chrome, kz, { seg: 10 });
        cylP(x, 459, 0.19, 0.19, 0, 0.02, M.chrome, kz, { seg: 24 });
      });
      unit([413, 684, 500, 740], 'N', { h0: 0.10, h1: 0.87, n: 1, mat: M.darkCab, inner: M.innerDark, topPanel: false, handle: 'h', sections: [{ from: 0, to: 1, kind: 'cabinet', items: 'cleaning' }], openL: 'Abrir gabinete', close: 'Fechar gabinete' }, kz);
      PB([415, 687, 500, 738], 0, 0.10, M.toe, kz, { cast: false });
      washer([502, 684, 584, 740], kz);
      slabWithHoles([411, 682, 586, 740], [[418, 688, 470, 734]], 0.87, 0.90, M.granite, kz);
      basin([418, 688, 470, 734], 0.26, 0.90, kz);
      wallTap(444, 740, 1.08, 0.645, kz);
      fridge([589, 682, 653, 740], kz);
      plant(566, 714, 0.06, 0.90, 0.13, kz);

      /* Banho: box com vidro fixo e porta de correr, chuveiro na parede do shaft, vaso com caixa acoplada, bancada com cuba e espelho */
      const bh = group(root);
      const box = group(bh);
      addBox(box, { x0: mx(243.5), x1: mx(246.5), z0: mz(552), z1: mz(611), h0: 0.02, h1: 1.92 }, M.glass, { cast: false });
      staticBoxes.push({ x0: mx(243.5) - CX, x1: mx(246.5) - CX, z0: mz(552) - CZ, z1: mz(611) - CZ, k: 'furn' });
      const slide = group(box);
      addBox(slide, { x0: mx(247.5), x1: mx(250.5), z0: mz(492), z1: mz(560), h0: 0.02, h1: 1.92 }, M.glass, { cast: false });
      addBox(slide, { x0: mx(250.5), x1: mx(252.5), z0: mz(498), z1: mz(504), h0: 0.95, h1: 1.15 }, M.chrome, { noDbg: true });
      showerSlide.grp = slide; showerSlide.dist = 0.5;
      showerSlide.box = function () { const o = showerSlide.dist * showerSlide.cur; return { x0: mx(247.5) - CX, x1: mx(250.5) - CX, z0: mz(492) + o - CZ, z1: mz(560) + o - CZ }; };
      sliders.push(showerSlide);
      tag(box, { label: function () { return showerSlide.ref.open ? 'Fechar o box' : 'Abrir o box'; }, act: function () { showerSlide.ref.open = !showerSlide.ref.open; } });
      addBox(bh, { x0: mx(242.5), x1: mx(251.5), z0: mz(491), z1: mz(612), h0: 1.92, h1: 1.95 }, M.alu);
      addBox(bh, { x0: mx(242.5), x1: mx(251.5), z0: mz(491), z1: mz(612), h0: 0, h1: 0.02 }, M.alu, { cast: false });
      const sh = group(bh);
      const armM = local(sh, new THREE.CylinderGeometry(0.011, 0.011, 0.32, 12), M.chrome, mx(198), 2.05, mz(612) - 0.16, [Math.PI / 2, 0, 0]); wallMounted.push(armM);
      cylP(198, 580, 0.095, 0.095, 2.00, 2.03, M.chrome, sh, { wall: true, seg: 28 });
      const mixer = local(sh, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 20), M.chrome, mx(198), 1.15, mz(612) - 0.015, [Math.PI / 2, 0, 0]); wallMounted.push(mixer);
      const showerWater = { g: group(sh), splash: null };
      showerWater.g.visible = false;
      const cone = local(showerWater.g, new THREE.CylinderGeometry(0.08, 0.24, 1.95, 28, 1, true), M.shower, mx(198), 1.02, mz(580)); cone.castShadow = false; cone.userData.noPick = true;
      const puddle = local(showerWater.g, new THREE.CircleGeometry(0.33, 28), M.puddle, mx(198), 0.005, mz(574), [-Math.PI / 2, 0, 0]); puddle.castShadow = false; puddle.userData.noPick = true;
      showerWater.splash = puddle;
      addFaucet(sh, showerWater, ['Ligar o chuveiro', 'Desligar o chuveiro']).shower = true;
      PB([191, 545, 205, 559], 0, 0.004, M.steel, bh, { cast: false });
      toilet(bh);
      PB([244, 626, 312, 641], 0, 0.95, M.paint, bh, { block: true });
      PB([244, 624, 312, 641], 0.95, 0.98, M.wood, bh, { r: 0.004 });
      unit([314, 590, 397, 641], 'N', { h0: 0.16, h1: 0.80, n: 2, mat: M.cabinet, inner: M.innerWhite, topPanel: false, handle: 'h', sections: [{ from: 0, to: 1, kind: 'cabinet', items: 'bath' }], openL: 'Abrir gabinete', close: 'Fechar gabinete' }, bh);
      PB([312, 588, 397, 641], 0.80, 0.83, M.wood, bh, { r: 0.004 });
      const vb = { x0: mx(333), x1: mx(377), z0: mz(593), z1: mz(633) }, vt = 0.012;
      addBox(bh, Object.assign({ h0: 0.83, h1: 0.845 }, vb), M.ceramic);
      addBox(bh, { x0: vb.x0, x1: vb.x0 + vt, z0: vb.z0, z1: vb.z1, h0: 0.83, h1: 0.96 }, M.ceramic, { noDbg: true });
      addBox(bh, { x0: vb.x1 - vt, x1: vb.x1, z0: vb.z0, z1: vb.z1, h0: 0.83, h1: 0.96 }, M.ceramic, { noDbg: true });
      addBox(bh, { x0: vb.x0, x1: vb.x1, z0: vb.z0, z1: vb.z0 + vt, h0: 0.83, h1: 0.96 }, M.ceramic, { noDbg: true });
      addBox(bh, { x0: vb.x0, x1: vb.x1, z0: vb.z1 - vt, z1: vb.z1, h0: 0.83, h1: 0.96 }, M.ceramic, { noDbg: true });
      faucet(355, 637, 0.83, 'N', 0.24, 0.12, 0.848, bh);
      addBox(bh, { x0: mx(318), x1: mx(392), z0: mz(641) - 0.012, z1: mz(641) - 0.002, h0: 1.06, h1: 1.78 }, M.mirror, { wall: true, cast: false });
      realMirror(bh, mx(355), 1.42, mz(641) - 0.0125, mx(392) - mx(318) - 0.004, 0.716, Math.PI, 0.6);
    }

    function buildFurniture(root) {
      /* Dormitório 1 */
      const d1 = group(root);
      rug([97, 76, 290, 320], 'gray', d1);
      PB([48, 68, 61, 328], 0, 1.10, M.navyPanel, d1, { r: 0.012, block: true });
      sphP(55, 126, 0.035, 1.135, M.leaf2, d1);
      sphP(55, 137, 0.045, 1.145, M.leaf1, d1);
      sphP(55, 157, 0.048, 1.15, M.black, d1);
      sphP(55, 266, 0.058, 1.16, M.black, d1);
      PB([62, 68, 100, 115], 0, 0.50, M.nightstand, d1, { r: 0.012, block: true });
      PB([62, 292, 100, 330], 0, 0.50, M.nightstand, d1, { r: 0.012, block: true });
      tableLamp(84, 92, 0.50, d1);
      plant(72, 312, 0.032, 0.50, 0.07, d1);
      globeLamp(89, 318, 0.055, 0.555, d1, 'luminária');
      const bed1 = group(d1);
      PB([62, 125, 70, 288], 0, 1.00, M.bedHead1, bed1, { r: 0.02, block: true });
      PB([70, 128, 245, 285], 0.05, 0.30, M.bedBase, bed1, { r: 0.01, block: true });
      PB([70, 127, 246, 286], 0.30, 0.52, M.sheet, bed1, { r: 0.05 });
      pillow([74, 131, 128, 197], 0.52, 0.15, M.sheet, bed1, { rz: 0.28 });
      pillow([74, 201, 128, 271], 0.52, 0.15, M.sheet, bed1, { rz: 0.28 });
      pillow([108, 168, 136, 230], 0.53, 0.13, M.navy, bed1, { rz: 0.16 });
      PB([140, 121, 252, 292], 0.50, 0.58, M.duvet, bed1, { r: 0.04 });
      PB([188, 103, 240, 297], 0.58, 0.603, M.navy, bed1, { r: 0.006 });
      PB([188, 99, 240, 103], 0.36, 0.603, M.navy, bed1, { r: 0.004 });
      PB([188, 297, 240, 301], 0.36, 0.603, M.navy, bed1, { r: 0.004 });
      poseTag(bed1, 'cama1');
      tvUnit([290, 135, 297, 268], 1.00, 1.72, [290, 139, 264, 1.035, 1.685], d1);
      const robe = { h0: 0, h1: 2.20, mat: M.wardrobe, inner: M.innerWhite, plinth: 0.07, handle: 'v', handleY: 1.05, openL: 'Abrir guarda-roupa', close: 'Fechar guarda-roupa' };
      unit([48, 343, 100, 522], 'E', Object.assign({ n: 3, doorTo: (470 - 343) / (522 - 343), sections: [{ from: 0, to: 0.44, kind: 'hang' }, { from: 0.44, to: 1, kind: 'shelves' }] }, robe), d1);
      unit([100, 470, 203, 522], 'N', Object.assign({ n: 2, sections: [{ from: 0, to: 0.65, kind: 'hang' }, { from: 0.65, to: 1, kind: 'shelves' }] }, robe), d1);

      /* Dormitório 2: duas camas de solteiro com a cabeceira na janela, criado-mudo no meio, tapete listrado e roupeiro na parede da porta */
      const d2 = group(root);
      rug([332, 92, 560, 297], 'stripe', d2);
      const bedA = group(d2), bedB = group(d2);
      singleBed([318, 68, 405, 240], bedA);
      singleBed([481, 68, 566, 240], bedB);
      poseTag(bedA, 'cama2'); poseTag(bedB, 'cama3');
      PB([406, 67, 480, 104], 0, 0.55, M.white, d2, { r: 0.008, block: true });
      tableLamp(439, 86, 0.55, d2);
      PB([450, 74, 477, 95], 0.55, 0.565, M.laptop, d2, { r: 0.004 });
      PB([451, 75, 476, 94], 0.565, 0.568, M.screen, d2, { cast: false, noDbg: true });
      PB([408, 82, 417, 94], 0.55, 0.56, M.black, d2, { r: 0.003 });
      unit([429, 343, 567, 397], 'N', Object.assign({ n: 3, sections: [{ from: 0, to: 0.5, kind: 'hang' }, { from: 0.5, to: 1, kind: 'shelves' }] }, robe), d2);

      /* Estar / Jantar */
      const es = group(root);
      rug([603, 100, 800, 345], 'light', es);
      const sofaG = group(es);
      PB([588, 101, 699, 322], 0.06, 0.30, M.sofaDark, sofaG, { r: 0.03, block: true });
      PB([588, 101, 699, 123], 0.06, 0.62, M.sofaDark, sofaG, { r: 0.045 });
      PB([588, 300, 699, 322], 0.06, 0.62, M.sofaDark, sofaG, { r: 0.045 });
      PB([588, 123, 612, 300], 0.30, 0.84, M.sofaDark, sofaG, { r: 0.04 });
      PB([612, 124, 699, 211], 0.30, 0.45, M.sofa, sofaG, { r: 0.045 });
      PB([612, 212, 699, 299], 0.30, 0.45, M.sofa, sofaG, { r: 0.045 });
      PB([607, 125, 633, 210], 0.43, 0.80, M.sofa, sofaG, { r: 0.05, rz: 0.16 });
      PB([607, 213, 633, 298], 0.43, 0.80, M.sofa, sofaG, { r: 0.05, rz: 0.16 });
      cushion(630, 132, 0.44, 0.13, M.navy, sofaG, -0.55, 0.32);
      cushion(624, 200, 0.42, 0.13, M.cushionWhite, sofaG, 0, 0.3);
      cushion(651, 222, 0.38, 0.12, M.navy, sofaG, 0.35, 0.2);
      cushion(625, 281, 0.42, 0.13, M.cushionWhite, sofaG, 0, 0.3);
      cushion(652, 262, 0.36, 0.12, M.cushionWhite, sofaG, -0.3, 0.15);
      PB([640, 296, 712, 326], 0.62, 0.645, M.throwLight, sofaG, { r: 0.01 });
      PB([645, 326, 708, 331], 0.25, 0.645, M.throwLight, sofaG, { r: 0.005 });
      poseTag(sofaG, 'sofa');
      PB([806, 108, 833, 282], 0.36, 0.53, M.white, es, { r: 0.008 });
      PB([785, 156, 826, 214], 0, 0.34, M.pouf, es, { r: 0.05, block: true });
      PB([785, 219, 826, 276], 0, 0.34, M.pouf, es, { r: 0.05, block: true });
      estarTv = tvUnit([829, 132, 835, 271], 0.89, 1.63, [829, 132.7, 270.3, 0.897, 1.623], es);   // ~60 polegadas, como na planta
      PB([809, 115, 826, 138], 0.53, 0.57, M.paper, es, { r: 0.004 });
      plant(816, 273, 0.055, 0.53, 0.13, es);
      // mesa de jantar de 4 lugares em frente à parede amarela, com vaso de flores vermelhas
      PB([697, 367, 787, 490], 0.72, 0.75, M.tableTop, es, { r: 0.006, block: true });
      [[702, 372], [782, 372], [702, 485], [782, 485]].forEach(function (l) { cylP(l[0], l[1], 0.02, 0.02, 0, 0.72, M.legDark, es, { seg: 10 }); });
      chair([655, 373, 700, 419], 'W', es); chair([655, 433, 700, 479], 'W', es);
      chair([784, 373, 829, 419], 'E', es); chair([784, 433, 829, 479], 'E', es);
      cylP(742, 428, 0.05, 0.05, 0.75, 0.86, M.black, es, { seg: 18 });
      [[0, 0], [9, -6], [-8, 5], [6, 8], [-6, -8], [11, 4]].forEach(function (f, i) { sphP(742 + f[0], 428 + f[1], 0.035 + (i % 2) * 0.01, 0.90 + (i % 3) * 0.025, i % 3 ? M.flower : M.leaf2, es); });

      /* Cozinha / Área de serviço */
      const kz = group(root);
      unit([542, 494, 741, 547], 'S', { h0: 0.10, h1: 0.87, n: 4, mat: M.cabinet, inner: M.innerWhite, topPanel: false, handle: 'h', openDeg: 95, sections: [{ from: 0, to: 1, kind: 'cabinet', items: 'pots' }], openL: 'Abrir armário', close: 'Fechar armário' }, kz);
      PB([545, 497, 741, 543], 0, 0.10, M.toe, kz, { cast: false });
      slabWithHoles([540, 491, 741, 550], [[590, 496, 634, 540]], 0.87, 0.90, M.granite, kz);
      basin([590, 496, 634, 540], 0.18, 0.90, kz);
      const cookG = group(kz);
      PB([693, 496, 740, 546], 0.90, 0.906, M.cooktop, cookG, { r: 0.004, cast: false });
      const cook = { ref: { on: false }, flames: [] };
      [[704, 509, 0.034], [729, 509, 0.03], [704, 532, 0.03], [728, 532, 0.042]].forEach(function (b) { burner(b[0], b[1], b[2], cookG); cook.flames.push(flameRing(b[0], b[1], b[2], cookG)); });
      cooktops.push(cook);
      tag(cookG, { label: function () { return cook.ref.on ? 'Apagar o fogão' : 'Acender o fogão'; }, act: function () { cook.ref.on = !cook.ref.on; cook.flames.forEach(function (f) { f.visible = cook.ref.on; }); } });
      faucet(612, 497, 0.90, 'S', 0.28, 0.17, 0.725, kz);
      fridge([538, 638, 603, 712], kz);
      washer([606, 654, 686, 712], kz);
      unit([688, 652, 741, 712], 'N', { h0: 0.10, h1: 0.87, n: 1, mat: M.darkCab, inner: M.innerDark, topPanel: false, handle: 'h', sections: [{ from: 0, to: 1, kind: 'cabinet', items: 'cleaning' }], openL: 'Abrir gabinete', close: 'Fechar gabinete' }, kz);
      PB([690, 655, 741, 709], 0, 0.10, M.toe, kz, { cast: false });
      slabWithHoles([603, 650, 741, 712], [[692, 658, 737, 706]], 0.87, 0.90, M.granite, kz);
      basin([692, 658, 737, 706], 0.26, 0.90, kz);
      wallTap(714, 712, 1.08, 0.645, kz);
      plant(630, 683, 0.085, 0.90, 0.17, kz);

      /* Banho */
      const bh = group(root);
      const box = group(bh);
      addBox(box, { x0: mx(142.5), x1: mx(145.5), z0: mz(604), z1: mz(677), h0: 0.02, h1: 1.92 }, M.glass, { cast: false });
      staticBoxes.push({ x0: mx(142.5) - CX, x1: mx(145.5) - CX, z0: mz(604) - CZ, z1: mz(677) - CZ, k: 'furn' });
      const slide = group(box);
      addBox(slide, { x0: mx(146.5), x1: mx(149.5), z0: mz(540), z1: mz(612), h0: 0.02, h1: 1.92 }, M.glass, { cast: false });
      addBox(slide, { x0: mx(149.5), x1: mx(151.5), z0: mz(546), z1: mz(552), h0: 0.95, h1: 1.15 }, M.chrome, { noDbg: true });
      showerSlide.grp = slide;
      showerSlide.box = function () { const o = showerSlide.dist * showerSlide.cur; return { x0: mx(146.5) - CX, x1: mx(149.5) - CX, z0: mz(540) + o - CZ, z1: mz(612) + o - CZ }; };
      sliders.push(showerSlide);
      tag(box, { label: function () { return showerSlide.ref.open ? 'Fechar o box' : 'Abrir o box'; }, act: function () { showerSlide.ref.open = !showerSlide.ref.open; } });
      addBox(bh, { x0: mx(141.5), x1: mx(150.5), z0: mz(539), z1: mz(678), h0: 1.92, h1: 1.95 }, M.alu);
      addBox(bh, { x0: mx(141.5), x1: mx(150.5), z0: mz(539), z1: mz(678), h0: 0, h1: 0.02 }, M.alu, { cast: false });
      const sh = group(bh);
      const armM = local(sh, new THREE.CylinderGeometry(0.011, 0.011, 0.32, 12), M.chrome, mx(90), 2.05, mz(678) - 0.16, [Math.PI / 2, 0, 0]); wallMounted.push(armM);
      cylP(90, 646, 0.095, 0.095, 2.00, 2.03, M.chrome, sh, { wall: true, seg: 28 });
      const mixer = local(sh, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 20), M.chrome, mx(90), 1.15, mz(678) - 0.015, [Math.PI / 2, 0, 0]); wallMounted.push(mixer);
      const showerWater = { g: group(sh), splash: null };
      showerWater.g.visible = false;
      const cone = local(showerWater.g, new THREE.CylinderGeometry(0.08, 0.24, 1.95, 28, 1, true), M.shower, mx(90), 1.02, mz(646)); cone.castShadow = false; cone.userData.noPick = true;
      const puddle = local(showerWater.g, new THREE.CircleGeometry(0.33, 28), M.puddle, mx(90), 0.005, mz(640), [-Math.PI / 2, 0, 0]); puddle.castShadow = false; puddle.userData.noPick = true;
      showerWater.splash = puddle;
      addFaucet(sh, showerWater, ['Ligar o chuveiro', 'Desligar o chuveiro']).shower = true;
      PB([88, 600, 102, 614], 0, 0.004, M.steel, bh, { cast: false });
      toilet(bh);
      unit([231, 657, 299, 712], 'N', { h0: 0.16, h1: 0.80, n: 2, mat: M.cabinet, inner: M.innerWhite, topPanel: false, handle: 'h', sections: [{ from: 0, to: 1, kind: 'cabinet', items: 'bath' }], openL: 'Abrir gabinete', close: 'Fechar gabinete' }, bh);
      PB([229, 655, 299, 712], 0.80, 0.83, M.wood, bh, { r: 0.004 });
      const vb = { x0: mx(243), x1: mx(283), z0: mz(660), z1: mz(705) }, vt = 0.012;
      addBox(bh, Object.assign({ h0: 0.83, h1: 0.845 }, vb), M.ceramic);
      addBox(bh, { x0: vb.x0, x1: vb.x0 + vt, z0: vb.z0, z1: vb.z1, h0: 0.83, h1: 0.96 }, M.ceramic, { noDbg: true });
      addBox(bh, { x0: vb.x1 - vt, x1: vb.x1, z0: vb.z0, z1: vb.z1, h0: 0.83, h1: 0.96 }, M.ceramic, { noDbg: true });
      addBox(bh, { x0: vb.x0, x1: vb.x1, z0: vb.z0, z1: vb.z0 + vt, h0: 0.83, h1: 0.96 }, M.ceramic, { noDbg: true });
      addBox(bh, { x0: vb.x0, x1: vb.x1, z0: vb.z1 - vt, z1: vb.z1, h0: 0.83, h1: 0.96 }, M.ceramic, { noDbg: true });
      faucet(262, 708, 0.83, 'N', 0.24, 0.12, 0.848, bh);
      addBox(bh, { x0: mx(237), x1: mx(292), z0: mz(712) - 0.012, z1: mz(712) - 0.002, h0: 1.06, h1: 1.78 }, M.mirror, { wall: true, cast: false });
      realMirror(bh, mx(264.5), 1.42, mz(712) - 0.0125, mx(292) - mx(237) - 0.004, 0.716, Math.PI, 0.6);
    }

    if (P.id === 'com-sacada') buildFurnitureCS(furnGroup); else buildFurniture(furnGroup);
    buildWallMirror();
    buildArchitecture(H_HIGH);
    (function () {
      const A = window.buildArch(P, H_HIGH);
      A.walls.forEach(function (w) {
        if (w.kind === 'lintel') return;
        const b = toBox(w.horiz, w.a, w.b, w.c0, w.c1, 0, 1);
        staticBoxes.push({ x0: b.x0 - CX, x1: b.x1 - CX, z0: b.z0 - CZ, z1: b.z1 - CZ, k: 'arch' });
      });
      staticBoxes.push({ x0: mx(P.shaft[0]) - CX, x1: mx(P.shaft[2]) - CX, z0: mz(P.shaft[1]) - CZ, z1: mz(P.shaft[3]) - CZ, k: 'arch' });
      if (P.balcony) { const br = P.balcony.r; staticBoxes.push({ x0: mx(br[0]) - CX, x1: mx(br[2]) - CX, z0: mz(br[1]) - CZ - 0.2, z1: mz(br[1]) + 0.1 - CZ, k: 'arch' }); }
      // porta de correr para a sacada: fechada, bloqueia o vão inteiro; aberta, só a folha fixa
      A.windows.forEach(function (w) {
        if (!w.spec.walk) return;
        const a = mx(w.a), b = mx(w.b), mid = (a + b) / 2, z0 = mz(w.c0), z1 = mz(w.c1);
        archBlocks.push(function () {
          const open = winState[w.id].s > 0.6;
          return { x0: a - CX, x1: (open ? mid + 0.02 : b) - CX, z0: z0 - CZ, z1: z1 - CZ };
        });
      });
    })();

    /* ---------------- corredor do andar (no prédio) ----------------
       As paredes do corredor viram colisão e o visitante pode andar por ele; o corredor conta como um cômodo a mais. */
    const WALK = [[-CX, -CZ, CX, CZ]];
    let CORR_ROOM = null;
    if (INTEG) {
      const rectL = function (r) {
        const a = new THREE.Vector3(r[0], 0, r[1]).applyMatrix4(UINV), b = new THREE.Vector3(r[2], 0, r[3]).applyMatrix4(UINV);
        return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)];
      };
      (INTEG.walls || []).forEach(function (r) { const q = rectL(r); staticBoxes.push({ x0: q[0], x1: q[2], z0: q[1], z1: q[3], k: 'arch' }); });
      if (INTEG.walk) (Array.isArray(INTEG.walk[0]) ? INTEG.walk : [INTEG.walk]).forEach(function (r) { WALK.push(rectL(r)); });
      if (INTEG.corridor) {
        CORR_ROOM = { id: 'corredor', name: INTEG.corridor.name || 'Corredor', area: '', dims: '', rects: [], walk: WALK.slice(1),
          viewL: { at: new THREE.Vector3().fromArray(INTEG.corridor.at).applyMatrix4(UINV), to: new THREE.Vector3().fromArray(INTEG.corridor.to).applyMatrix4(UINV) } };
      }
    }
    /* ---------------- elevador e térreo do condomínio ----------------
       O elevador do hall leva ao térreo: o visitante sai pela portaria da torre e anda pelo condomínio (piscina, salão,
       quiosques, pracinha, espaço pet, portaria), com a colisão do térreo; pela entrada da torre, volta ao andar. */
    // nível do visitante: 'apt' (apto e corredor do andar dele), 'floor' (corredor de outro andar), 'ground' (térreo do condomínio),
    // 'lift' (dentro da cabine, com as portas fechadas, andando)
    let level = 'apt', visitFloor = APT_FLOOR;
    const rectL = function (r) {
      const a = new THREE.Vector3(r[0], 0, r[1]).applyMatrix4(UINV), b = new THREE.Vector3(r[2], 0, r[3]).applyMatrix4(UINV);
      return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)];
    };
    const boxL = function (r) { const q = rectL(r); return { x0: q[0], x1: q[2], z0: q[1], z1: q[3], k: 'arch' }; };
    const vL = function (v) { return new THREE.Vector3().fromArray(v).applyMatrix4(UINV); };
    const GROUND = INTEG && INTEG.ground ? (function () {
      const G = INTEG.ground;
      return {
        boxes: (G.walls || []).map(boxL),
        walk: (G.walk || []).map(rectL),
        zones: (G.zones || []).map(function (z) { return { id: z.id, name: z.name, area: '', dims: '', q: rectL(z.r) }; }),
        yard: { id: 'terreo', name: G.name || 'Térreo do condomínio', area: '', dims: '' },
        spawn: { at: vL(G.spawn.at), to: vL(G.spawn.to) },
        spots: (G.spots || []).map(function (s) { return { id: s.id, name: s.name, at: vL(s.at), to: vL(s.to) }; }),
        props: G.props || null
      };
    })() : null;
    // elevador: cabine, paredes, portas (a da frente abre nos andares, a de trás no térreo), halls onde se chama, corredor dos outros andares
    const ELV = INTEG && INTEG.elevator && GROUND ? (function () {
      const E = INTEG.elevator;
      return {
        E: E, cab: rectL(E.cab), walls: E.walls.map(boxL), front: boxL(E.front), rear: boxL(E.rear),
        hall: rectL(E.hall), lobby: rectL(E.lobby), doorFront: rectL(E.doorFront), doorRear: rectL(E.doorRear),
        floorBoxes: E.floorWalls.map(boxL), hallSpot: { at: vL(E.hallSpot.at), to: vL(E.hallSpot.to) },
        localY: function (n) { return E.stopY[n] - INTEG.floorY; },
        room: { id: 'elevador', name: 'Elevador · Torre ' + E.tower, area: '', dims: '' },
        floorRoom: { id: 'andar', name: '', area: '', dims: '' }
      };
    })() : null;
    const inQ = function (q, x, z) { return x >= q[0] && x <= q[2] && z >= q[1] && z <= q[3]; };
    const lift = ELV ? { at: 0, y: ELV.localY(0), phase: 'idle', door: 0, target: null, call: false, from: 0, to: 0, t: 0, dur: 1, y0: 0, y1: 0, hold: 0, dir: 0, shown: 0, rider: false, turn: null, sig: '', hud: '' } : null;
    const LIFT_BOXES = [];
    const CAB_WALK = ELV ? [ELV.cab] : [];
    const FLOOR_WALK = ELV ? WALK.slice(1).concat([ELV.cab, ELV.doorFront]) : [];
    if (ELV) { WALK.push(ELV.cab, ELV.doorFront); setTimeout(function () { refreshLiftBoxes(); }, 0); }
    function playerFloor() { return level === 'ground' ? 0 : level === 'floor' ? visitFloor : level === 'apt' ? APT_FLOOR : null; }
    // paredes da cabine e as portas fechadas (a porta só deixa passar aberta, com a cabine parada no andar do visitante)
    function refreshLiftBoxes() {
      if (!ELV) return;
      LIFT_BOXES.length = 0;
      ELV.walls.forEach(function (b) { LIFT_BOXES.push(b); });
      const pf = playerFloor(), open = lift.door > 0.8 && lift.at !== null && lift.at === pf && level !== 'lift';
      if (!(open && pf > 0)) LIFT_BOXES.push(ELV.front);
      if (!(open && pf === 0)) LIFT_BOXES.push(ELV.rear);
    }
    function baseY() {
      if (level === 'ground') return GROUND_Y;
      if (level === 'floor' && ELV) return ELV.localY(visitFloor) + 0.012;
      if (level === 'lift' && lift) return lift.y;
      return 0;
    }
    // rede de segurança: o centro do visitante fica dentro do apto ou do corredor (as paredes já seguram o corpo dele)
    function clampWalk(p, r) {
      const list = level === 'ground' && GROUND ? GROUND.walk : level === 'floor' ? FLOOR_WALK : level === 'lift' ? CAB_WALK : WALK;
      if (list === WALK && WALK.length === 1) { p.x = clamp(p.x, -CX + r, CX - r); p.z = clamp(p.z, -CZ + r, CZ - r); return; }
      let bx = p.x, bz = p.z, bd = Infinity;
      for (let i = 0; i < list.length; i++) {
        const q = list[i], x = clamp(p.x, q[0], q[2]), z = clamp(p.z, q[1], q[3]), d = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
        if (d < bd) { bd = d; bx = x; bz = z; }
      }
      p.x = bx; p.z = bz;
    }

    /* ---------------- luz do dia: claridade que entra por cada janela e feixes de sol nas janelas ao norte ---------------- */
    const RAY = new THREE.Vector3(-SUN_DIR.x, -SUN_DIR.y, -SUN_DIR.z);
    const SHAFT_ROOM = P.shaftRooms;
    const DAY_SPOT = 0.85;
    let dayK = 1;                    // 1 de dia; 0 à noite (site no tema escuro): a janela não traz luz e as luzes ficam acesas
    const shaftGroup = new THREE.Group(); root.add(shaftGroup);
    const daylight = [];
    function shutterBottomOf(id, p) {
      const sp = P.windows[id], top = Math.min(sp.top, H_HIGH), full = (top - SHUT.fw) - (sp.sill + SHUT.fw);
      return top - SHUT.fw - (SHUT.up + p * (full - SHUT.up));
    }
    // 0 = fechada/escura, 1 = toda aberta. Persiana: fração do vão descoberta; vidro fechado deixa passar ~88%
    function windowOpenness(id) {
      const sp = P.windows[id], st = winState[id];
      if (!sp || !st) return 0;
      let cover = 1;
      if (sp.type === 'persiana') {
        const lo = sp.sill + SHUT.fw, full = (Math.min(sp.top, H_HIGH) - SHUT.fw) - lo;
        cover = clamp((shutterBottomOf(id, st.p) - lo) / full, 0, 1);
      }
      return cover * (0.88 + 0.12 * st.s);
    }
    window.buildArch(P, H_HIGH).windows.forEach(function (w) {
      const sp = w.spec, horiz = w.horiz, n = horiz ? [0, sp.inside] : [sp.inside, 0];
      const face = horiz ? mz(sp.inside > 0 ? w.c1 : w.c0) : mx(sp.inside > 0 ? w.c1 : w.c0);
      const a0 = (horiz ? mx(w.a) : mz(w.a)) + SHUT.fw, a1 = (horiz ? mx(w.b) : mz(w.b)) - SHUT.fw;
      const top = Math.min(sp.top, H_HIGH);
      const pt = function (al, y, off) { return horiz ? [al, y, face + n[1] * off] : [face + n[0] * off, y, al]; };
      const am = (a0 + a1) / 2, sPos = pt(am, (sp.sill + top) / 2, 0.22), sTo = pt(am, 0, 2.2);
      const spot = new THREE.SpotLight(0xeaf1ff, 0, 7.5, 1.0, 1, 1.25);
      spot.position.set(sPos[0], sPos[1], sPos[2]); spot.target.position.set(sTo[0], sTo[1], sTo[2]);
      lightRig.add(spot); lightRig.add(spot.target);
      spotZones.push(ZONE_OF[w.id] !== undefined ? ZONE_OF[w.id] : 3);
      const d = { id: w.id, spot: spot, shaft: null };
      const into = RAY.x * n[0] + RAY.z * n[1], rr = SHAFT_ROOM[w.id];
      if (rr && into > 0.3) {
        const pos = new Float32Array(48), uv = new Float32Array(32), idx = [];
        for (let f = 0; f < 4; f++) { const b = f * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); uv.set([0, 0, 1, 0, 1, 1, 0, 1], b * 2); }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.setIndex(idx);
        const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -wx(rr[0])), new THREE.Plane(new THREE.Vector3(-1, 0, 0), wx(rr[2])),
          new THREE.Plane(new THREE.Vector3(0, 0, 1), -wz(rr[1]) + 0.02), new THREE.Plane(new THREE.Vector3(0, 0, -1), wz(rr[3]))];
        if (U) planes.forEach(function (pl) { pl.applyMatrix4(U); });
        const mat = new THREE.MeshBasicMaterial({ map: texBeam, color: 0xfff0d2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, clippingPlanes: planes });
        const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.userData.noPick = true; mesh.visible = false;
        shaftGroup.add(mesh);
        Object.assign(d, { shaft: mesh, pos: pos, geo: geo, pt: pt, a0: a0, a1: a1, top: top, T: (w.c1 - w.c0) / S, into: into, sill: sp.sill });
      }
      daylight.push(d);
    });
    // feixe = o vão da janela (já descontando a espessura da parede) projetado no chão ao longo dos raios de sol
    function updateShaft(d) {
      const sp = P.windows[d.id];
      let topY = d.top - SHUT.fw;
      if (sp.type === 'persiana') topY = Math.min(topY, shutterBottomOf(d.id, winState[d.id].p));
      const y0 = d.sill + SHUT.fw + 0.004, y1 = topY - d.T * (-RAY.y) / d.into;
      if (y1 - y0 < 0.03) return false;
      const k0 = y0 / -RAY.y, k1 = y1 / -RAY.y;
      const P00 = d.pt(d.a0, y0, 0), P10 = d.pt(d.a1, y0, 0), P01 = d.pt(d.a0, y1, 0), P11 = d.pt(d.a1, y1, 0);
      const fl = function (q, k) { return [q[0] + RAY.x * k, 0, q[2] + RAY.z * k]; };
      const F00 = fl(P00, k0), F10 = fl(P10, k0), F01 = fl(P01, k1), F11 = fl(P11, k1);
      let o = 0;
      [[P00, P10, F10, F00], [P01, P11, F11, F01], [P00, P01, F01, F00], [P10, P11, F11, F10]].forEach(function (q) {
        q.forEach(function (v) { d.pos[o++] = v[0]; d.pos[o++] = v[1]; d.pos[o++] = v[2]; });
      });
      d.geo.attributes.position.needsUpdate = true;
      return true;
    }
    function updateDaylight() {
      const inside = ceilGroup.visible;
      daylight.forEach(function (d) {
        const o = windowOpenness(d.id);
        d.spot.intensity = inside ? DAY_SPOT * dayK * o : 0;
        if (d.shaft) {
          const vis = inside && dayK > 0 && o > 0.02 && updateShaft(d);
          d.shaft.visible = !!vis;
          d.shaft.material.opacity = 0.13 * o;
        }
      });
      markDirty();
    }
    // zonas de luz (em px da planta, com folga): 0 dorm. 1, 1 dorm. 2, 2 banho, 3 sala+cozinha+circulação (vãos de porta contam nas duas)
    function zoneArray(list) { const a = new Float32Array(Math.max(1, list.length) * 4); list.forEach(function (z, i) { a[i * 4 + z] = 1; }); return a; }
    APT_U.aptPZone.value = zoneArray(pointZones);
    APT_U.aptSZone.value = zoneArray(spotZones);
    const ZONE_RECTS = P.zoneRects;
    ZONE_RECTS.forEach(function (r, i) { APT_U.aptRects.value.set([wx(r[0]), wz(r[1]), wx(r[2]), wz(r[3])], i * 4); });
    // luz rebatida de cada zona: segue janela/persiana, portas abertas e luzes acesas (fora do apartamento = 1)
    const fillC = [1, 1, 1, 1], fillT = [1, 1, 1, 1];
    function doorFrac(id) {
      const st = doorState[id];
      for (let i = 0; i < archHinges.length; i++) { const h = archHinges[i]; if (h.ref === st) return clamp(Math.abs(h.cur - h.tc) / Math.max(1e-3, Math.abs(h.to - h.tc)), 0, 1); }
      return st && st.open ? 1 : 0;
    }
    function lampBoost(z) { let b = 0; lampState.forEach(function (l) { if (l.on && l.zone === z) b += 0.05; }); return b; }
    function fillTargets() {
      if (!ceilGroup.visible) { fillT[0] = fillT[1] = fillT[2] = fillT[3] = 1; return; }
      const o = function (id) { return windowOpenness(id) * (0.2 + 0.8 * dayK); }, dr = doorFrac, L = function (id) { return roomLights[id] && roomLights[id].on ? 1 : 0; };
      fillT[0] = 0.17 + 0.83 * o('d1') + 0.06 * dr('d1') + 0.28 * L('d1') + lampBoost(0);
      fillT[1] = 0.17 + 0.83 * o('d2') + 0.06 * dr('d2') + 0.28 * L('d2') + lampBoost(1);
      fillT[2] = 0.13 + 0.2 * dr('banho') + 0.4 * L('banho') + (P.windows.banho ? 0.4 * o('banho') : 0);
      fillT[3] = 0.3 + 0.48 * o('estar') + 0.12 * o('coz') + 0.05 * o('d1') * dr('d1') + 0.05 * o('d2') * dr('d2') + 0.05 * dr('entrada') + 0.12 * L('estar') + 0.08 * L('coz') + 0.08 * L('circ') + lampBoost(3);
      for (let i = 0; i < 4; i++) fillT[i] = clamp(fillT[i], 0.1, 1.15);
    }
    function stepFill(dt) {
      fillTargets();
      let ch = false;
      for (let i = 0; i < 4; i++) {
        const dd = fillT[i] - fillC[i];
        if (Math.abs(dd) > 1e-4) { fillC[i] += dd * Math.min(1, dt * 3.2); if (Math.abs(fillT[i] - fillC[i]) <= 1e-4) fillC[i] = fillT[i]; ch = true; }
      }
      if (ch) { APT_U.aptZoneFill.value.set(fillC[0], fillC[1], fillC[2], fillC[3]); markDirty(); }
      return ch;
    }

    /* ---------------- sons (só depois de um clique: torneiras, chuveiro, descarga) ---------------- */
    let actx = null, waterSnd = null, waterLvl = 0, lastWaterT = 0;
    const noiseBufs = {};
    function audioUnlock() {
      if (!actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { actx = new AC(); } catch (e) { actx = null; return null; }
      }
      try { if (actx.state === 'suspended') actx.resume(); } catch (e) { /* sem som */ }
      return actx;
    }
    function noiseBuf(kind) {
      if (noiseBufs[kind]) return noiseBufs[kind];
      const len = Math.floor(actx.sampleRate * 2), b = actx.createBuffer(1, len, actx.sampleRate), d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w * 0.5; }
      noiseBufs[kind] = b; return b;
    }
    function playFlush() {
      if (!audioUnlock()) return;
      try {
        const t = actx.currentTime;
        const s1 = actx.createBufferSource(); s1.buffer = noiseBuf('brown'); s1.loop = true;
        const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1700, t); lp.frequency.exponentialRampToValueAtTime(360, t + 3.0);
        const g1 = actx.createGain(); g1.gain.setValueAtTime(0.0001, t); g1.gain.exponentialRampToValueAtTime(0.6, t + 0.15); g1.gain.setValueAtTime(0.6, t + 1.0); g1.gain.exponentialRampToValueAtTime(0.0001, t + 3.3);
        s1.connect(lp); lp.connect(g1); g1.connect(actx.destination); s1.start(t); s1.stop(t + 3.4);
        const s2 = actx.createBufferSource(); s2.buffer = noiseBuf('white'); s2.loop = true;
        const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.9;
        const g2 = actx.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.setValueAtTime(0.0001, t + 1.2); g2.gain.exponentialRampToValueAtTime(0.05, t + 1.9); g2.gain.exponentialRampToValueAtTime(0.0001, t + 6);
        s2.connect(bp); bp.connect(g2); g2.connect(actx.destination); s2.start(t); s2.stop(t + 6.1);
      } catch (e) { /* sem som */ }
    }
    function setWaterSound(level) {
      if (!actx) return;
      try {
        if (!waterSnd) {
          if (level <= 0) return;
          const s = actx.createBufferSource(); s.buffer = noiseBuf('white'); s.loop = true;
          const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
          const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
          const g = actx.createGain(); g.gain.value = 0;
          s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(actx.destination); s.start();
          waterSnd = { s: s, g: g };
        }
        waterSnd.g.gain.setTargetAtTime(level, actx.currentTime, 0.12);
      } catch (e) { /* sem som */ }
    }
    function updateWaterSound(now) {
      if (!actx || now - lastWaterT < 120) return;
      lastWaterT = now;
      let lvl = 0;
      faucets.forEach(function (f) { if (!f.ref.on) return; const d = camera.position.distanceTo(f.pos); lvl += (f.shower ? 0.14 : 0.08) / (1 + d * d * 0.4); });
      lvl = Math.min(0.25, lvl);
      if (Math.abs(lvl - waterLvl) > 0.003 || (lvl === 0 && waterLvl !== 0)) { waterLvl = lvl; setWaterSound(lvl); }
      let al = 0;
      acs.forEach(function (a) { if (!a.on) return; const d = camera.position.distanceTo(a.pos); al += 0.05 / (1 + d * d * 0.35); });
      al = Math.min(0.08, al);
      if (Math.abs(al - acLvl) > 0.002 || (al === 0 && acLvl !== 0)) { acLvl = al; setAcSound(al); }
    }
    let acSnd = null, acLvl = 0;
    function setAcSound(level) {
      if (!actx) return;
      try {
        if (!acSnd) {
          if (level <= 0) return;
          const s = actx.createBufferSource(); s.buffer = noiseBuf('brown'); s.loop = true;
          const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
          const g = actx.createGain(); g.gain.value = 0;
          s.connect(lp); lp.connect(g); g.connect(actx.destination); s.start();
          acSnd = { s: s, g: g };
        }
        acSnd.g.gain.setTargetAtTime(level, actx.currentTime, 0.4);
      } catch (e) { /* sem som */ }
    }

    /* ---------------- física: colisão do visitante (círculo) com paredes, móveis e portas ---------------- */
    function pushBox(p, r, b) {
      const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) return false;
      if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; return true; }
      const dl = p.x - b.x0, dr = b.x1 - p.x, dtp = p.z - b.z0, db = b.z1 - p.z, m = Math.min(dl, dr, dtp, db);
      if (m === dl) p.x = b.x0 - r; else if (m === dr) p.x = b.x1 + r; else if (m === dtp) p.z = b.z0 - r; else p.z = b.z1 + r;
      return true;
    }
    function pushSeg(p, r, h) {
      const ax = h.wx, az = h.wz, vx = Math.cos(h.cur) * h.len, vz = -Math.sin(h.cur) * h.len, L2 = vx * vx + vz * vz;
      const t = L2 > 0 ? clamp(((p.x - ax) * vx + (p.z - az) * vz) / L2, 0, 1) : 0;
      const qx = ax + vx * t, qz = az + vz * t, dx = p.x - qx, dz = p.z - qz, rr = r + h.thick / 2, d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) return false;
      const d = Math.sqrt(d2);
      if (d < 1e-6) { const l = Math.hypot(vx, vz) || 1; p.x += (-vz / l) * rr; p.z += (vx / l) * rr; return true; }
      const k = (rr - d) / d; p.x += dx * k; p.z += dz * k;
      return true;
    }
    function outerBoxes() { return level === 'ground' && GROUND ? GROUND.boxes : level === 'floor' && ELV ? ELV.floorBoxes : null; }
    function collide(p, r) {
      const furn = state.furniture;
      if (level !== 'apt') {
        const list = outerBoxes();
        for (let it = 0; it < 6; it++) {
          let hit = false;
          if (list) for (let i = 0; i < list.length; i++) if (pushBox(p, r, list[i])) hit = true;
          for (let i = 0; i < LIFT_BOXES.length; i++) if (pushBox(p, r, LIFT_BOXES[i])) hit = true;
          if (!hit) break;
        }
        clampWalk(p, r); return;
      }
      for (let it = 0; it < 6; it++) {
        let hit = false;
        for (let i = 0; i < LIFT_BOXES.length; i++) if (pushBox(p, r, LIFT_BOXES[i])) hit = true;
        for (let i = 0; i < staticBoxes.length; i++) { const b = staticBoxes[i]; if (b.k === 'furn' && !furn) continue; if (pushBox(p, r, b)) hit = true; }
        if (furn) for (let i = 0; i < sliders.length; i++) if (sliders[i].box && pushBox(p, r, sliders[i].box())) hit = true;
        for (let i = 0; i < archBlocks.length; i++) if (pushBox(p, r, archBlocks[i]())) hit = true;
        for (let i = 0; i < archHinges.length; i++) if (pushSeg(p, r, archHinges[i])) hit = true;
        if (furn) for (let i = 0; i < furnHinges.length; i++) if (pushSeg(p, r, furnHinges[i])) hit = true;
        if (!hit) break;
      }
      clampWalk(p, r);
    }
    function maxPen(p, r) {
      let worst = 0;
      const furn = state.furniture;
      const chk = function (b) {
        const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
        const pen = (p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1) ? r + 0.1 : r - Math.hypot(p.x - cx, p.z - cz);
        if (pen > worst) worst = pen;
      };
      LIFT_BOXES.forEach(chk);
      if (level !== 'apt') { const list = outerBoxes(); if (list) list.forEach(chk); return worst; }
      for (let i = 0; i < staticBoxes.length; i++) { const b = staticBoxes[i]; if (b.k === 'furn' && !furn) continue; chk(b); }
      if (furn) sliders.forEach(function (sl) { if (sl.box) chk(sl.box()); });
      archBlocks.forEach(function (f) { chk(f()); });
      return worst;
    }
    function isBlocked(x, z) { const p = { x: x, z: z }; collide(p, RADIUS); return Math.hypot(p.x - x, p.z - z) > 0.02; }
    if (dbg) { dbg.collide = collide; dbg.isBlocked = isBlocked; }

    /* ---------------- câmera orbital e vistas ---------------- */
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.085;
    controls.minDistance = 2.2; controls.maxDistance = 140;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.screenSpacePanning = true;
    controls.enableRotate = false;
    controls.autoRotateSpeed = 0.9;
    controls.enablePan = MX > 0;
    controls.autoRotate = !reduceMotion;

    let view = '3d', tween = null, currentRoom = null, prevWallsLow = false;
    const immersive = () => view === 'walk' || view === 'free';
    const player = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, vel: new THREE.Vector3(), pose: null, target: null, stuck: 0 };
    if (dbg) dbg.player = player;
    let ptween = null;

    function fovSizes(fov) { const vt = Math.tan(THREE.MathUtils.degToRad(fov / 2)); return { vt: vt, ht: vt * camera.aspect }; }
    let OV_AZ = THREE.MathUtils.degToRad(24);
    function overviewPose() {
      const fov = 36, s = fovSizes(fov), R = 5.25;
      const dist = R / Math.min(s.vt, s.ht) * (camera.aspect >= 1 ? 1.0 : 0.95);
      const pol = THREE.MathUtils.degToRad(53), az = OV_AZ;
      const target = new THREE.Vector3(0, 0.5, 0.2);
      const pos = new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az)).multiplyScalar(dist).add(target);
      return { pos: pos, target: target, fov: fov };
    }
    function topPose() {
      const fov = 20, s = fovSizes(fov), halfW = W / 2 + 0.35, halfD = D / 2 + 0.35;
      const dist = Math.max(halfD / s.vt, halfW / s.ht) * (camera.aspect >= 1 ? 1.35 : 1.12);
      return { pos: new THREE.Vector3(0, dist, 0.0001), target: new THREE.Vector3(0, 0, 0), fov: fov };
    }
    function lookDir() { const cp = Math.cos(player.pitch); return new THREE.Vector3(Math.sin(player.yaw) * cp, Math.sin(player.pitch), Math.cos(player.yaw) * cp); }
    function currentTarget() {
      const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
      const d = immersive() ? 1.2 : Math.max(0.5, camera.position.distanceTo(controls.target));
      return camera.position.clone().add(fwd.multiplyScalar(d));
    }
    function flyTo(pos, target, fov, ms, done) {
      controls.enabled = false;
      if (reduceMotion || !ms) {
        camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(target);
        if (done) done();
        markDirty();
        return;
      }
      tween = { start: performance.now(), ms: ms, p0: camera.position.clone(), p1: pos.clone(), t0: currentTarget(), t1: target.clone(), f0: camera.fov, f1: fov, done: done };
    }
    const tmpV = new THREE.Vector3();
    function stepTween(now) {
      const k = Math.min(1, (now - tween.start) / tween.ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      tmpV.lerpVectors(tween.t0, tween.t1, e);
      camera.fov = tween.f0 + (tween.f1 - tween.f0) * e; camera.updateProjectionMatrix();
      camera.lookAt(tmpV);
      if (k >= 1) { const done = tween.done; tween = null; if (done) done(); }
    }
    function settleOutside(target) {
      controls.target.copy(target);
      controls.enabled = true;
      controls.enableDamping = false; controls.update(); controls.enableDamping = true;
    }
    function leaveImmersive() {
      if (locked && document.exitPointerLock) { try { document.exitPointerLock(); } catch (e) { /* já solto */ } }
      if (lift) lift.rider = false;
      setLevel('apt');
      ceilGroup.visible = false; keys.clear(); upHeld = 0; downHeld = 0; joy.x = 0; joy.y = 0; joy.id = null;
      endPose(player.pose); player.pose = null; player.target = null; ptween = null; currentRoom = null; hideTip();
      overlay.visible = state.overlay;
      if (prevWallsLow && !state.wallsLow) setWallsLow(true);
    }
    function goOverview(ms) {
      if (immersive()) leaveImmersive();
      view = '3d'; camera.near = 0.15; syncUI();
      const p = overviewPose();
      flyTo(p.pos, p.target, p.fov, typeof ms === 'number' ? ms : 1000, function () { settleOutside(p.target); });
    }
    function goTop() {
      if (immersive()) leaveImmersive();
      view = 'top'; camera.near = 0.15; setRotate(false); syncUI();
      const p = topPose();
      flyTo(p.pos, p.target, p.fov, 1000, function () { settleOutside(p.target); });
    }
    function roomAt(x, z) {
      if (ELV && (level === 'lift' || inQ(ELV.cab, x, z))) return ELV.room;
      if (level === 'floor' && ELV) { ELV.floorRoom.name = 'Corredor do ' + visitFloor + 'º andar'; return ELV.floorRoom; }
      if (level === 'ground' && GROUND) {
        const zn = GROUND.zones.find(function (q) { return inQ(q.q, x, z); });
        return zn || GROUND.yard;
      }
      const px = (x + CX) * S + OX, pz = (z + CZ) * S + OY;
      const rm = P.rooms.find(function (q) { return q.rects.some(function (r) { return px >= r[0] && px <= r[2] && pz >= r[1] && pz <= r[3]; }); });
      if (rm) return rm;
      const ws = CORR_ROOM ? CORR_ROOM.walk : [];
      return ws.some(function (w) { return x >= w[0] && x <= w[2] && z >= w[1] && z <= w[3]; }) ? CORR_ROOM : null;
    }
    function focusCanvas() {
      try { if (document.activeElement && document.activeElement !== canvas && document.activeElement.blur) document.activeElement.blur(); canvas.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
    }
    function beginImmersive() {
      if (!immersive()) prevWallsLow = state.wallsLow;
      if (state.wallsLow) setWallsLow(false);
      setRotate(false); controls.enabled = false;
      endPose(player.pose); player.pose = null; player.target = null; player.vel.set(0, 0, 0); ptween = null;
      overlay.visible = false; hideTip();
    }
    function enterWalk(id) {
      const rm = P.rooms.find(function (r) { return r.id === id; }) || (id === 'corredor' ? CORR_ROOM : null);
      if (!rm) return;
      beginImmersive();
      setLevel('apt');
      view = 'walk'; camera.near = 0.04; camera.updateProjectionMatrix(); currentRoom = rm;
      ceilGroup.visible = true;
      const at = rm.viewL ? rm.viewL.at.clone().setY(EYE) : new THREE.Vector3(wx(rm.view.at[0]), EYE, wz(rm.view.at[1]));
      const to = rm.viewL ? rm.viewL.to.clone().setY(EYE - 0.3) : new THREE.Vector3(wx(rm.view.to[0]), EYE - 0.3, wz(rm.view.to[1]));
      const dir = to.sub(at).normalize();
      player.yaw = Math.atan2(dir.x, dir.z); player.pitch = Math.asin(clamp(dir.y, -1, 1));
      player.pos.copy(at);
      syncUI(); focusCanvas(); autoLock();
      flyTo(at, at.clone().add(lookDir()), 70, 1150, null);
    }
    function walkFromFree() {
      const x = player.pos.x, z = player.pos.z;
      if (GROUND && player.pos.y < GROUND_Y + 6) {                   // voando perto do chão: pousa no térreo
        const prev = level; setLevel('ground');
        if (!isBlocked(x, z) && GROUND.walk.some(function (q) { return inQ(q, x, z); })) {
          view = 'walk'; player.vel.set(0, 0, 0); currentRoom = roomAt(x, z);
          tweenPlayer(new THREE.Vector3(x, GROUND_Y + EYE, z), player.yaw, clamp(player.pitch, -0.5, 0.5), 650, null);
          syncUI(); focusCanvas(); return;
        }
        setLevel(prev);
      }
      if (level === 'ground') { teleport('terreo'); return; }
      if (level === 'floor' || level === 'lift') { teleport('hall'); return; }
      if (!roomAt(x, z) || isBlocked(x, z)) { enterWalk(currentRoom ? currentRoom.id : 'circ'); return; }
      view = 'walk'; player.vel.set(0, 0, 0); currentRoom = roomAt(x, z);
      tweenPlayer(new THREE.Vector3(x, EYE, z), player.yaw, clamp(player.pitch, -0.5, 0.5), 650, null);
      syncUI(); focusCanvas();
    }
    function enterFree() {
      if (view === 'free' || level === 'lift') return;
      const fromOutside = !immersive();
      beginImmersive();
      view = 'free'; camera.near = 0.04; camera.updateProjectionMatrix();
      if (fromOutside) {
        const at = new THREE.Vector3(wx(440), 3.0, wz(800)), to = new THREE.Vector3(wx(440), 1.0, wz(470));
        const dir = to.clone().sub(at).normalize();
        player.yaw = Math.atan2(dir.x, dir.z); player.pitch = Math.asin(clamp(dir.y, -1, 1)); player.pos.copy(at);
        flyTo(at, at.clone().add(lookDir()), 70, 1100, null);
      }
      currentRoom = roomAt(player.pos.x, player.pos.z);
      syncUI(); focusCanvas(); autoLock();
    }
    function setRotate(on) { controls.autoRotate = !!on; syncUI(); }
    // troca de nível: fora do andar do apto a maquete some (o prédio inteiro aparece no lugar do andar aberto)
    function setLevel(lv, floor) {
      if (lv === 'floor') visitFloor = floor || visitFloor;
      const changed = lv !== level;
      level = lv;
      root.visible = lv === 'apt';
      refreshLiftBoxes();
      if (changed) { dirtyShadows(); notifyView(); } else if (lv === 'floor') notifyView();
    }
    // onde o visitante está em relação ao elevador: 'hall' (em frente às portas no andar), 'lobby' (hall de entrada no térreo), 'cab' (dentro)
    function liftSpot() {
      if (!ELV || view !== 'walk' || player.pose) return null;
      const x = player.pos.x, z = player.pos.z;
      if (level === 'lift' || inQ(ELV.cab, x, z)) return 'cab';
      if (level === 'ground') return inQ(ELV.lobby, x, z) ? 'lobby' : null;
      return inQ(ELV.hall, x, z) ? 'hall' : null;
    }
    // atalhos da lista: 'terreo' (sai na frente da torre, no térreo) e 'hall' (hall dos elevadores do andar do apto, de frente para as portas)
    // atalhos: 'terreo' (na frente da torre), 'terreo:<área>' (salão, piscina, pracinha, pet, quiosques, portaria) e 'hall'
    function teleport(dest) {
      const spot = GROUND && typeof dest === 'string' && dest.indexOf('terreo:') === 0 ? GROUND.spots.find(function (s) { return 'terreo:' + s.id === dest; }) : null;
      const toGround = dest === 'terreo' || !!spot;
      if (toGround ? !GROUND : !ELV) return;
      if (!immersive()) beginImmersive();
      endPose(player.pose);
      tween = null; ptween = null; player.target = null; player.pose = null; player.vel.set(0, 0, 0);
      if (lift) lift.rider = false;
      setLevel(toGround ? 'ground' : 'apt');
      view = 'walk'; camera.near = 0.04; camera.fov = 70; camera.updateProjectionMatrix();
      const from = spot || (toGround ? GROUND.spawn : ELV.hallSpot), at = from.at.clone(), to = from.to.clone();
      at.y = baseY() + EYE; to.y = baseY() + EYE - 0.25;
      const dir = to.sub(at).normalize();
      player.yaw = Math.atan2(dir.x, dir.z); player.pitch = Math.asin(clamp(dir.y, -1, 1));
      player.pos.copy(at);
      ceilGroup.visible = !toGround;
      currentRoom = roomAt(at.x, at.z);
      camera.position.copy(player.pos); camera.lookAt(tmpV.copy(player.pos).add(lookDir()));
      syncUI(); focusCanvas(); markDirty();
    }

    /* ---------------- elevador: chamar no hall, porta abre, entrar, escolher o andar no painel (T, 1 a 12) ----------------
       A cabine anda de verdade (o visitante vai junto, de pé), o mostrador conta os andares e a porta abre no destino:
       no andar do apto, no corredor de outro andar (portas dos vizinhos fechadas) ou no hall de entrada do térreo. */
    const DOOR_S = 1.15;
    const easeIO = function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    function cabCenter() { return new THREE.Vector3((ELV.cab[0] + ELV.cab[2]) / 2, 0, (ELV.cab[1] + ELV.cab[3]) / 2); }
    function inCabDeep() { const m = 0.18, c = ELV.cab; return player.pos.x > c[0] + m && player.pos.x < c[2] - m && player.pos.z > c[1] + m && player.pos.z < c[3] - m; }
    function inCab() { return inQ(ELV.cab, player.pos.x, player.pos.z); }
    // alguém parado na porta (o sensor reabre): na faixa entre o hall e o fundo da cabine junto à porta que está abrindo
    function doorBlocked() {
      const pf = playerFloor(); if (pf === null || pf !== lift.at || view !== 'walk') return false;
      const q = pf === 0 ? ELV.doorRear : ELV.doorFront;
      return inQ(q, player.pos.x, player.pos.z) && !inCabDeep();
    }
    // direção (no mundo) para a qual a porta da parada abre: térreo +z (hall de entrada), andares -z (corredor)
    function yawToward(worldZ) { const d = new THREE.Vector3(0, 0, worldZ).transformDirection(UINV); return Math.atan2(d.x, d.z); }
    function liftCmd(cmd) {
      if (!lift) return;
      const now = performance.now(), pf = playerFloor();
      if (cmd === 'call') {
        if (pf === null) return;
        if (lift.at === pf && lift.phase !== 'moving') { if (lift.phase === 'open') lift.hold = now + 7000; else if (lift.phase !== 'opening') lift.phase = 'opening'; }
        else if (lift.phase === 'idle' || lift.phase === 'open' || lift.phase === 'closing') {
          lift.call = true; lift.phase = 'coming'; lift.door = 0;
          lift.from = lift.at === null ? lift.shown : lift.at; lift.to = pf; lift.t = 0;
          lift.dur = reduceMotion ? 0.4 : Math.min(5, 1.2 + 0.32 * Math.abs(lift.to - lift.from));
          lift.y0 = ELV.localY(lift.from); lift.y1 = ELV.localY(lift.to); lift.dir = lift.to > lift.from ? 1 : -1; lift.at = null;
        } else lift.call = true;
      } else if (cmd === 'open') {
        if (lift.at !== null && lift.at === pf && lift.phase !== 'moving') { if (lift.phase === 'open') lift.hold = now + 7000; else lift.phase = 'opening'; }
      } else if (cmd === 'close') {
        if (lift.phase === 'open') lift.hold = 0;
      } else if (typeof cmd === 'number' && cmd >= 0 && cmd <= ELV.E.floors) {
        if (!inCab() || lift.phase === 'moving' || lift.phase === 'coming') return;
        if (cmd === lift.at) { if (lift.phase !== 'open') lift.phase = 'opening'; else lift.hold = now + 7000; lift.target = null; return; }
        lift.target = cmd;
        // o visitante dá um passo para o meio da cabine, virado para a porta, e a porta fecha
        const c = cabCenter(), yaw = yawToward(lift.at === 0 ? 1 : -1);
        if (view === 'walk' && !player.pose) tweenPlayer(new THREE.Vector3(c.x, player.pos.y, c.z), yaw, -0.05, 450, null);
        if (lift.phase === 'open') lift.hold = 0;
        else if (lift.phase === 'idle') startRide();
      }
      pushLift(true);
    }
    function startRide() {
      lift.phase = 'moving'; lift.from = lift.at; lift.to = lift.target; lift.t = 0; lift.door = 0;
      lift.dur = reduceMotion ? 0.6 : 1.8 + 0.42 * Math.abs(lift.to - lift.from);
      lift.y0 = ELV.localY(lift.from); lift.y1 = ELV.localY(lift.to); lift.y = lift.y0;
      lift.dir = lift.to > lift.from ? 1 : -1; lift.at = null; lift.rider = view === 'walk';
      if (lift.rider) setLevel('lift');
      try { ELV.E.prepare(lift.to); } catch (e) { console.error(e); }
      // vira para a porta que vai abrir (a de trás, no térreo), se estiver de costas para ela
      const want = yawToward(lift.to === 0 ? 1 : -1);
      lift.turn = Math.abs(angDiff(player.yaw, want)) > 1.3 ? want : null;
    }
    function arrive() {
      lift.at = lift.to; lift.target = null; lift.dir = 0; lift.y = lift.y1; lift.shown = lift.at; lift.turn = null;
      if (lift.rider) {
        const n = lift.at;
        if (n === 0) setLevel('ground'); else if (n === APT_FLOOR) setLevel('apt'); else setLevel('floor', n);
        player.pos.y = baseY() + EYE; ceilGroup.visible = level === 'apt';
        currentRoom = roomAt(player.pos.x, player.pos.z);
        lift.rider = false;
      }
      lift.phase = 'opening';
    }
    function stepLift(dt, now) {
      if (!lift) return false;
      let moving = false;
      const ph = lift.phase;
      if (ph === 'coming' || ph === 'moving') {
        lift.t += dt;
        const k = Math.min(1, lift.t / lift.dur), e = easeIO(k);
        lift.y = lift.y0 + (lift.y1 - lift.y0) * e;
        lift.shown = Math.round(lift.from + (lift.to - lift.from) * e);
        if (ph === 'moving' && lift.rider) {
          if (lift.turn !== null && k > 0.25) player.yaw += angDiff(player.yaw, lift.turn) * Math.min(1, dt * 2.2);
          if (!player.pose && !ptween) player.pos.y = lift.y + EYE;
        }
        if (k >= 1) { if (ph === 'coming') { lift.at = lift.to; lift.shown = lift.at; lift.call = false; lift.dir = 0; lift.phase = 'opening'; } else arrive(); }
        moving = true;
      } else if (ph === 'opening') {
        lift.door = Math.min(1, lift.door + dt / DOOR_S); moving = true;
        if (lift.door >= 1) { lift.phase = 'open'; lift.hold = now + 7000; }
      } else if (ph === 'open') {
        if ((lift.target !== null && lift.target !== lift.at) || now > lift.hold) { if (!doorBlocked()) lift.phase = 'closing'; else lift.hold = now + 1500; }
      } else if (ph === 'closing') {
        if (doorBlocked()) lift.phase = 'opening';
        else {
          lift.door = Math.max(0, lift.door - dt / DOOR_S); moving = true;
          if (lift.door <= 0) {
            if (lift.target !== null && lift.target !== lift.at && inCab()) startRide();
            else { lift.phase = 'idle'; lift.target = null; }
          }
        }
      }
      pushLift(false);
      return moving;
    }
    // manda o estado para o prédio desenhar (portas, cabine, mostradores, botões) e para o painel do site
    function pushLift(force) {
      const pf = playerFloor(), shownTxt = lift.shown ? String(lift.shown) : 'T';
      const sig = [lift.at, lift.y.toFixed(3), lift.door.toFixed(3), shownTxt, lift.dir, lift.target, lift.call, level, pf].join('|');
      if (force || sig !== lift.sig) {
        lift.sig = sig;
        refreshLiftBoxes();
        try { ELV.E.update({ at: lift.at, y: lift.y + INTEG.floorY, door: easeIO(lift.door), shown: shownTxt, dir: lift.dir, sel: lift.target, call: lift.call, level: level, floor: pf }); } catch (e) { console.error(e); }
        markDirty();
      }
      const spot = liftSpot();
      const hud = [spot, lift.phase, shownTxt, lift.dir, lift.target, lift.call, lift.at === pf].join('|');
      if (hud !== lift.hud) {
        lift.hud = hud;
        postParent({ type: 'apt:lift', spot: spot, phase: lift.phase, shown: shownTxt, dir: lift.dir, sel: lift.target, call: lift.call, here: lift.at !== null && lift.at === pf,
          floor: pf, apt: APT_FLOOR, floors: ELV.E.floors, tower: ELV.E.tower });
      }
    }
    // botões do elevador na mira (o prédio diz qual): vira um objeto clicável como os do apto
    const LIFT_LABEL = { call: 'Chamar o elevador', open: 'Abrir a porta', close: 'Fechar a porta', panel: 'Painel do elevador' };
    function liftInter(w) {
      return { label: function () { return w.id === 'floor' ? (w.n ? 'Ir para o ' + w.n + 'º andar' : 'Ir para o térreo') : LIFT_LABEL[w.id]; },
        act: function () { if (w.id === 'floor') liftCmd(w.n); else if (w.id !== 'panel') liftCmd(w.id); } };
    }
    // coisa do térreo na mira: o clique faz o que o prédio mandar (e às vezes vira uma pose: sentar, deitar, brinquedo, nadar)
    function propInter(g) {
      const riding = function () { return !!(player.pose && player.pose.owner === g.id); };
      return { label: function () { return GROUND.props.label(g.id, g.point, riding()); },
        act: function () {
          const r = GROUND.props.act(g.id, g.point, riding());
          markDirty();
          if (!r) return;
          if (r.stand) { if (player.pose) standUp(); return; }
          if (r.pose) sitOrLie(worldPose(r.pose, g.id));
        } };
    }
    function setWallsLow(low) { state.wallsLow = low; buildArchitecture(low ? H_LOW : H_HIGH); syncUI(); }

    /* ---------------- visitante: andar, voar, deitar, sentar ---------------- */
    const keys = new Set();
    const joy = { x: 0, y: 0, id: null };
    let upHeld = 0, downHeld = 0;
    function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
    function tweenPlayer(pos, yaw, pitch, ms, done) {
      ptween = { start: performance.now(), ms: reduceMotion ? 1 : ms, p0: player.pos.clone(), p1: pos, y0: player.yaw, dy: angDiff(player.yaw, yaw), q0: player.pitch, q1: pitch, done: done };
    }
    function stepPTween(now) {
      const k = Math.min(1, (now - ptween.start) / ptween.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      player.pos.lerpVectors(ptween.p0, ptween.p1, e);
      player.yaw = ptween.y0 + ptween.dy * e;
      player.pitch = ptween.q0 + (ptween.q1 - ptween.q0) * e;
      if (k >= 1) { const d = ptween.done; ptween = null; if (d) d(); }
    }
    function sitOrLie(ps) {
      if (!immersive()) return;
      if (view === 'free') { view = 'walk'; ceilGroup.visible = level === 'apt'; }
      if (player.pose && player.pose !== ps) endPose(player.pose);
      player.target = null; player.vel.set(0, 0, 0); player.pose = ps;
      if (ps.world) { ps.ready = false; tweenPlayer(ps.at3.clone(), ps.yaw, ps.pitch, ps.swim ? 1100 : 900, function () { ps.ready = true; }); }
      else tweenPlayer(new THREE.Vector3(wx(ps.at[0]), ps.y, wz(ps.at[1])), ps.yaw, ps.pitch, 950, null);
      syncUI();
    }
    function standUp() {
      const ps = player.pose; if (!ps) return;
      player.pose = null;
      endPose(ps);
      if (ps.world) {
        let st = ps.stand3;
        if (ps.swim) st = swimExit(ps);
        else if (ps.standAt) { try { const a = ps.standAt(); st = vL([a[0], 0, a[1]]); } catch (e) { /* fica o de antes */ } }
        tweenPlayer(new THREE.Vector3(st.x, baseY() + EYE, st.z), player.yaw, -0.05, ps.swim ? 900 : 750, null);
      } else tweenPlayer(new THREE.Vector3(wx(ps.stand[0]), EYE, wz(ps.stand[1])), player.yaw, -0.05, 750, null);
      syncUI();
    }
    // a pose acabou (levantou, desceu do brinquedo, saiu da visita): o prédio para a animação daquela coisa
    function endPose(ps) { if (ps && ps.onEnd) { const f = ps.onEnd; ps.onEnd = null; try { f(); } catch (e) { console.error(e); } } }
    // pose no mundo (térreo do condomínio): o prédio manda em metros do mundo; aqui vira coordenada da maquete
    const ROT_SIGN = U ? (Math.sign(U.elements[0] * U.elements[10]) || 1) : 1;
    function worldPose(sp, owner) {
      const at = vL(sp.eye), d = vL(sp.look).sub(at).normalize();
      return { world: true, kind: sp.kind || 'sit', hud: sp.hud || null, standLabel: sp.standLabel || null, at3: at, yaw: Math.atan2(d.x, d.z), pitch: Math.asin(clamp(d.y, -1, 1)),
        stand3: vL([sp.stand[0], 0, sp.stand[1]]), standAt: sp.standAt || null, follow: sp.follow || null,
        swim: sp.swim ? { q: rectL(sp.swim.area), y: vL([0, sp.swim.y, 0]).y } : null, onEnd: sp.onEnd || null, ready: false, owner: owner };
    }
    // saindo da piscina: pela borda mais perto, um passo para fora (se ali estiver livre)
    function swimExit(ps) {
      const q = ps.swim.q, x = player.pos.x, z = player.pos.z;
      const opts = [[x - q[0], q[0] - 0.8, z], [q[2] - x, q[2] + 0.8, z], [z - q[1], x, q[1] - 0.8], [q[3] - z, x, q[3] + 0.8]].sort(function (a, b) { return a[0] - b[0]; });
      for (let i = 0; i < opts.length; i++) if (!isBlocked(opts[i][1], opts[i][2])) return new THREE.Vector3(opts[i][1], 0, opts[i][2]);
      return ps.stand3;
    }
    function swimStep(ps, f, s, run, dt, now) {
      const q = ps.swim.q;
      let dx = 0, dz = 0;
      if (Math.abs(f) > 0.05 || Math.abs(s) > 0.05) {
        const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
        dx = sy * f - cy * s; dz = cy * f + sy * s;
        const l = Math.hypot(dx, dz); if (l > 1) { dx /= l; dz /= l; }
      }
      const sp = run ? 1.3 : 0.75, a = Math.min(1, dt * 2.6);
      player.vel.x += (dx * sp - player.vel.x) * a; player.vel.z += (dz * sp - player.vel.z) * a;
      player.pos.x = clamp(player.pos.x + player.vel.x * dt, q[0] + 0.32, q[2] - 0.32);
      player.pos.z = clamp(player.pos.z + player.vel.z * dt, q[1] + 0.32, q[3] - 0.32);
      player.pos.y = ps.swim.y + Math.sin(now * 0.0021) * 0.025;
      return true;
    }
    function stepPlayer(dt, now) {
      if (ptween) { stepPTween(now); return true; }
      let f = 0, s = 0, v = 0, turn = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
      if (keys.has('KeyD')) s += 1;
      if (keys.has('KeyA')) s -= 1;
      if (keys.has('ArrowLeft')) turn += 1;
      if (keys.has('ArrowRight')) turn -= 1;
      if (keys.has('KeyE') || keys.has('Space')) v += 1;
      if (keys.has('KeyQ') || keys.has('KeyC')) v -= 1;
      f -= joy.y; s += joy.x; v += upHeld - downHeld;
      s *= MX; turn *= MX;
      const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (turn) player.yaw += turn * 1.9 * dt;
      const hasMove = Math.abs(f) > 0.05 || Math.abs(s) > 0.05 || (view === 'free' && Math.abs(v) > 0.05);
      if (player.pose) {
        const ps = player.pose;
        if (ps.swim && ps.ready) return swimStep(ps, f, s, run, dt, now) || !!turn;
        if (hasMove) { standUp(); return !!turn; }
        if (ps.follow && ps.ready) {
          let w = null;
          try { w = ps.follow(now); } catch (e) { console.error(e); }
          if (!w) { standUp(); return true; }
          player.pos.copy(vL(w.p));
          if (w.dyaw) player.yaw += ROT_SIGN * w.dyaw;
          return true;
        }
        return !!turn;
      }
      if (view === 'walk') {
        let dx = 0, dz = 0;
        if (hasMove) {
          player.target = null;
          const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
          dx = sy * f - cy * s; dz = cy * f + sy * s;
          const l = Math.hypot(dx, dz); if (l > 1) { dx /= l; dz /= l; }
        } else if (player.target) {
          const tx = player.target.x - player.pos.x, tz = player.target.z - player.pos.z, d = Math.hypot(tx, tz);
          if (d < 0.06) { player.target = null; player.stuck = 0; }
          else { const k = Math.min(1, d / 0.45); dx = tx / d * k; dz = tz / d * k; }
        }
        const speed = run ? 2.7 : 1.4, a = Math.min(1, dt * 9);
        player.vel.x += (dx * speed - player.vel.x) * a;
        player.vel.z += (dz * speed - player.vel.z) * a;
        player.vel.y = 0;
        if (!dx && !dz && Math.hypot(player.vel.x, player.vel.z) < 0.003) { player.vel.x = 0; player.vel.z = 0; return !!turn; }
        const bx = player.pos.x, bz = player.pos.z;
        const p = { x: bx + player.vel.x * dt, z: bz + player.vel.z * dt };
        collide(p, RADIUS);
        const penNew = maxPen(p, RADIUS);
        if (penNew > 0.004 && penNew >= maxPen({ x: bx, z: bz }, RADIUS)) { p.x = bx; p.z = bz; player.vel.x *= 0.3; player.vel.z *= 0.3; }
        player.pos.x = p.x; player.pos.z = p.z; player.pos.y = baseY() + EYE;
        if (player.target) {
          if (Math.hypot(p.x - bx, p.z - bz) < speed * dt * 0.15) { player.stuck += dt; if (player.stuck > 0.4) { player.target = null; player.stuck = 0; } } else player.stuck = 0;
        }
        return true;
      }
      if (hasMove) {
        const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch), sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
        let vx = sy * cp * f - cy * s, vy = sp * f + v, vz = cy * cp * f + sy * s;
        const l = Math.hypot(vx, vy, vz); if (l > 1) { vx /= l; vy /= l; vz /= l; }
        const far = Math.max(0, Math.hypot(player.pos.x, player.pos.z) - 10) + Math.max(0, -player.pos.y - 1);
        const speed = (run ? 6.5 : 2.8) * (1 + Math.min(5, far / 12)), a = Math.min(1, dt * 7);
        player.vel.x += (vx * speed - player.vel.x) * a; player.vel.y += (vy * speed - player.vel.y) * a; player.vel.z += (vz * speed - player.vel.z) * a;
      } else {
        player.vel.multiplyScalar(Math.max(0, 1 - dt * 7));
        if (player.vel.lengthSq() < 1e-5) { player.vel.set(0, 0, 0); return !!turn; }
      }
      player.pos.x = clamp(player.pos.x + player.vel.x * dt, -170, 170);
      player.pos.y = clamp(player.pos.y + player.vel.y * dt, GROUND_Y + 0.4, 70);
      player.pos.z = clamp(player.pos.z + player.vel.z * dt, -170, 170);
      return true;
    }

    /* ---------------- interface ---------------- */
    const app = $('app'), hint = $('hint'), visitBar = $('visitBar'), visitName = $('visitName'), hudMode = $('hudMode'), standBtn = $('standBtn');
    const touchEl = $('touch'), updownEl = $('updown'), tip = $('tip'), dock = $('dock'), crosshair = $('crosshair');
    const btn = { v3d: $('v3d'), vTop: $('vTop'), vVisit: $('vVisit'), vFree: $('vFree'), tRotate: $('tRotate'), tWalls: $('tWalls'), tFurn: $('tFurn'), tLabels: $('tLabels'), tDoors: $('tDoors'), tOverlay: $('tOverlay') };
    const roomsEl = $('rooms'), roomList = $('roomList');
    if (EMBED) app.classList.add('is-embed');
    const roomButtons = {};
    P.rooms.forEach(function (rm) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'room-btn';
      b.innerHTML = '<span class="n">' + rm.name + '</span><span class="a">' + rm.area + ' m²</span>' + (rm.dims ? '<span class="d">' + rm.dims + ' m</span>' : '');
      on(b, 'click', function () { enterWalk(rm.id); });
      li.appendChild(b); roomList.appendChild(li); roomButtons[rm.id] = b;
    });
    if (mm('(min-width: 760px)')) roomsEl.open = true;

    const labelsEl = $('labels');
    const pills = P.rooms.map(function (rm) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pill';
      b.innerHTML = '<b>' + rm.name + '</b><span>' + rm.area + ' m²' + (rm.dims ? '<i> · ' + rm.dims + '</i>' : '') + '</span>';
      b.setAttribute('aria-label', 'Entrar em ' + rm.name + ', ' + rm.area + ' metros quadrados');
      on(b, 'click', function () { enterWalk(rm.id); });
      b.hidden = true;
      labelsEl.appendChild(b);
      return { el: b, pos: new THREE.Vector3(wx(rm.label[0]), 1.35, wz(rm.label[1])), shown: false };
    });

    function placeTouch() {
      if (INTEG || touchEl.hidden) return;
      const a = app.getBoundingClientRect(), d = dock.getBoundingClientRect();
      touchEl.style.bottom = Math.max(16, a.bottom - d.top + 12) + 'px';
    }
    function syncUI() {
      markDirty();
      const imm = immersive();
      app.classList.toggle('is-immersive', imm);
      btn.v3d.setAttribute('aria-pressed', String(view === '3d'));
      btn.vTop.setAttribute('aria-pressed', String(view === 'top'));
      btn.vVisit.setAttribute('aria-pressed', String(view === 'walk'));
      btn.vFree.setAttribute('aria-pressed', String(view === 'free'));
      btn.tRotate.setAttribute('aria-pressed', String(!!controls.autoRotate));
      btn.tWalls.setAttribute('aria-pressed', String(state.wallsLow));
      btn.tFurn.setAttribute('aria-pressed', String(state.furniture));
      btn.tLabels.setAttribute('aria-pressed', String(state.labels));
      btn.tDoors.setAttribute('aria-pressed', String(state.doorsOpen));
      btn.tOverlay.setAttribute('aria-pressed', String(state.overlay));
      visitBar.hidden = !imm;
      hudMode.textContent = view === 'free' ? 'Câmera livre' : player.pose ? (player.pose.hud || (player.pose.kind === 'lie' ? 'Deitado' : 'Sentado')) : 'Visitando';
      visitName.textContent = currentRoom ? currentRoom.name : 'Fora do apartamento';
      standBtn.hidden = !player.pose;
      standBtn.textContent = player.pose && player.pose.standLabel ? player.pose.standLabel : 'Levantar';
      Object.keys(roomButtons).forEach(function (id) { roomButtons[id].setAttribute('aria-current', String(imm && !!currentRoom && currentRoom.id === id)); });
      touchEl.hidden = !(coarse && imm);
      crosshair.hidden = !mouseAim();
      app.classList.toggle('is-locked', imm && locked);
      updownEl.hidden = view !== 'free';
      placeTouch();
      let h;
      const kb = !coarse;
      const mouseHow = locked ? 'Mova o mouse para olhar' : lockFailed ? 'Mova o mouse para olhar (encoste na borda para girar)' : 'Clique na tela para olhar com o mouse, sem segurar';
      if (player.pose && player.pose.swim) h = kb ? mouseHow + ' · WASD nada · Shift nada mais rápido · ' + (player.pose.standLabel || 'Sair') + ' para sair' : 'Joystick nada · arraste para olhar · ' + (player.pose.standLabel || 'Sair') + ' para sair';
      else if (player.pose) h = kb ? mouseHow + ' · aperte W para levantar' : 'Arraste para olhar em volta · use o joystick ou Levantar para sair';
      else if (view === 'walk') h = kb ? mouseHow + ' · WASD anda · clique para usar o que está na mira · Shift corre · Esc ' + (locked ? 'solta o mouse' : 'sai') : 'Joystick anda · arraste para olhar · toque nos objetos para usar ou no chão para ir até lá';
      else if (view === 'free') h = kb ? mouseHow + ' · WASD voa · E ou Espaço sobe · Q desce · Shift acelera · Esc ' + (locked ? 'solta o mouse' : 'sai') : 'Joystick voa · botões sobem e descem · arraste para olhar · toque nos objetos para usar';
      else h = coarse ? 'Um dedo gira 360° · pinça aproxima · dois dedos movem · toque num nome para entrar' : 'Arraste para girar 360° · role para aproximar · botão direito move a maquete · clique num nome para entrar';
      if (imm && hintSeen()) h = '';                           // depois do primeiro clique (ou toque) na visita, a dica some de vez
      hint.textContent = h;
      notifyView();
      if (EMBED || opts.onMessage) postParent({ type: 'apt:state', view: view, imm: imm, pose: !!player.pose, room: currentRoom ? currentRoom.id : null,
        roomName: currentRoom ? currentRoom.name : '', level: level, lift: liftSpot(),
        rotate: !!controls.autoRotate, wallsLow: state.wallsLow, furniture: state.furniture, labels: state.labels, doorsOpen: state.doorsOpen, overlay: state.overlay, hint: h });
    }
    // dica da visita (clique na tela para olhar…): aparece só até o primeiro clique ou toque dentro da visita
    function hintSeen() {
      if (window.__aptDicaVista) return true;
      try { if (localStorage.getItem('milao.dicaVisita') === '1') window.__aptDicaVista = true; } catch (e) { /* sem armazenamento */ }
      return !!window.__aptDicaVista;
    }
    function markHintSeen() {
      if (hintSeen()) return;
      window.__aptDicaVista = true;
      try { localStorage.setItem('milao.dicaVisita', '1'); } catch (e) { /* sem armazenamento */ }
      syncUI();
    }
    function postParent(msg) {
      if (opts.onMessage) { try { opts.onMessage(msg); } catch (e) { console.error(e); } return; }
      try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*'); } catch (e) { /* sem site em volta */ }
    }
    function notifyView() { if (INTEG && INTEG.onView) { try { INTEG.onView(view, ceilGroup.visible, level, visitFloor); } catch (e) { console.error(e); } } }
    // comandos vindos do painel do site: os mesmos botões da maquete, entrar num cômodo ou voltar à vista 3D
    on(window, 'message', function (e) {
      if (!EMBED || e.source !== window.parent) return;
      const d = e.data || {};
      if (d.type === 'apt:cmd' && btn[d.id]) btn[d.id].click();
      else if (d.type === 'apt:room' && P.rooms.some(function (r) { return r.id === d.id; })) enterWalk(d.id);
      else if (d.type === 'apt:hello') syncUI();
    });

    on(btn.v3d, 'click', goOverview);
    on(btn.vTop, 'click', goTop);
    on(btn.vVisit, 'click', function () { if (view === 'free') walkFromFree(); else enterWalk(view === 'walk' && currentRoom ? currentRoom.id : 'circ'); });
    on(btn.vFree, 'click', enterFree);
    on($('exitVisit'), 'click', goOverview);
    on(standBtn, 'click', function () { standUp(); focusCanvas(); });
    on(btn.tRotate, 'click', function () { if (!immersive()) setRotate(!controls.autoRotate); });
    on(btn.tWalls, 'click', function () { if (!immersive()) setWallsLow(!state.wallsLow); });
    on(btn.tFurn, 'click', function () { state.furniture = !state.furniture; furnGroup.visible = state.furniture; dirtyShadows(); syncUI(); });
    on(btn.tLabels, 'click', function () { state.labels = !state.labels; syncUI(); });
    on(btn.tDoors, 'click', function () { state.doorsOpen = !state.doorsOpen; Object.keys(doorState).forEach(function (k) { doorState[k].open = state.doorsOpen; }); syncUI(); });
    on(btn.tOverlay, 'click', function () {
      state.overlay = !state.overlay;
      overlay.visible = state.overlay && !immersive();
      syncUI();
      if (state.overlay && view === '3d') goTop();
    });
    controls.addEventListener('start', function () { if (controls.autoRotate) setRotate(false); });

    /* ---------------- toque, mouse e teclado na visita ---------------- */
    const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const pickRoots = [floorGroup, archGroup, doorGroup, furnGroup, ceilGroup, fixGroup];
    function visibleChain(o) { while (o) { if (o.visible === false) return false; o = o.parent; } return true; }
    function pick(cx, cy) {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camW || camera);
      const hits = root.visible ? raycaster.intersectObjects(pickRoots, true) : [];
      // botões do elevador (no prédio): valem se estiverem mais perto que o que o apto tem na frente
      const w0 = ELV && immersive() ? ELV.E.pick(raycaster) : null;
      // no térreo: salão, churrasqueiras, brinquedos, piscina, pet, bancos, portões (o prédio diz o que está na mira)
      const g = GROUND && GROUND.props && level === 'ground' && immersive() ? GROUND.props.pick(raycaster) : null;
      const w = w0 && g ? (w0.distance <= g.distance ? w0 : g) : (w0 || g);
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i], o = h.object;
        if (o.userData.noPick || !visibleChain(o)) continue;
        if (w && w.distance < h.distance) break;
        if (UINV) h.point.applyMatrix4(UINV);                     // ponto de volta para as coordenadas da planta
        let q = o; while (q && !q.userData.inter) q = q.parent;
        return { hit: h, inter: q ? q.userData.inter : null };
      }
      if (w) return { hit: { distance: w.distance, point: new THREE.Vector3(), object: { userData: {} } }, inter: w === g ? propInter(g) : liftInter(w) };
      return null;
    }
    function showTip(text, x, y) {
      const r = app.getBoundingClientRect();
      tip.textContent = text; tip.hidden = false;
      tip.style.transform = 'translate3d(' + Math.round(x - r.left + 16) + 'px,' + Math.round(y - r.top + 18) + 'px,0)';
    }
    function hideTip() { if (!tip.hidden) tip.hidden = true; canvas.style.cursor = ''; }
    function clickAt(x, y) {
      const res = pick(x, y);
      if (res && res.inter) {
        res.inter.act(res.hit); dirtyShadows(); syncUI();
        if (!coarse) showTip(res.inter.label(res.hit), x, y);
        return;
      }
      if (view === 'walk' && !player.pose && res && res.hit.object.userData.walk) { player.target = { x: res.hit.point.x, z: res.hit.point.z }; player.stuck = 0; }
    }
    /* visão sem inversão: direita olha para a direita, cima olha para cima */
    function look(dx, dy, k) { player.yaw -= MX * dx * k; player.pitch = clamp(player.pitch - dy * k, -1.35, 1.35); markDirty(); }
    /* computador: o mouse é capturado e controla a visão sem segurar o clique; a mira no centro usa os objetos */
    const canLock = !coarse && typeof canvas.requestPointerLock === 'function';
    let locked = false, lockFailed = !canLock, lockReleasedAt = -1e9, hoverLast = null, edgeX = 0, centerT = 0;
    const mouseAim = () => immersive() && !coarse && (locked || lockFailed);
    function requestLock() {
      if (locked || lockFailed) return;
      try {
        const r = canvas.requestPointerLock();
        if (r && typeof r.catch === 'function') r.catch(function () { lockFailed = true; syncUI(); });
      } catch (err) { lockFailed = true; syncUI(); }
    }
    function autoLock() { if (!coarse) requestLock(); }
    on(document, 'pointerlockchange', function () {
      const was = locked; locked = document.pointerLockElement === canvas;
      if (was && !locked) lockReleasedAt = performance.now();
      hoverLast = null; hideTip(); syncUI();
    });
    on(document, 'pointerlockerror', function () { lockFailed = true; syncUI(); });
    on(document, 'mousemove', function (e) {
      if (!locked || !immersive() || tween) return;
      look(e.movementX || 0, e.movementY || 0, 0.0022 * camera.fov / 70);
    });
    function centerXY() { const r = canvas.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    let drag = null;
    on(canvas, 'pointerdown', function (e) {
      if (!immersive() || tween) return;
      markHintSeen();
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return;
        if (!locked && !lockFailed) { requestLock(); return; }
        const c = centerXY(); clickAt(c.x, c.y);
        return;
      }
      if (drag) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
      hideTip();
    });
    on(canvas, 'pointermove', function (e) {
      if (drag && e.pointerId === drag.id) {
        look(e.clientX - drag.x, e.clientY - drag.y, 0.0042 * camera.fov / 70);
        drag.x = e.clientX; drag.y = e.clientY;
        return;
      }
      if (e.pointerType === 'mouse' && immersive() && lockFailed && !locked && !tween) {
        if (hoverLast) look(e.clientX - hoverLast.x, e.clientY - hoverLast.y, 0.0035 * camera.fov / 70);
        hoverLast = { x: e.clientX, y: e.clientY };
        const r = canvas.getBoundingClientRect(), fx = (e.clientX - r.left) / Math.max(1, r.width);
        edgeX = fx < 0.08 ? -(0.08 - fx) / 0.08 : fx > 0.92 ? (fx - 0.92) / 0.08 : 0;
      }
    });
    on(canvas, 'pointerup', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy), dt = performance.now() - drag.t;
      drag = null;
      if (moved < 8 && dt < 600) clickAt(e.clientX, e.clientY);
    });
    on(canvas, 'pointercancel', function () { drag = null; });
    on(canvas, 'pointerleave', function () { hoverLast = null; edgeX = 0; });

    /* maquete 3D: arrastar para a direita leva a câmera para a direita; para cima, a câmera olha para cima */
    const orbit = { id: null, x: 0, y: 0, t: 0, vth: 0, vph: 0 };
    const activeTouches = new Set();
    const sphTmp = new THREE.Spherical(), offTmp = new THREE.Vector3();
    function orbitBy(dth, dph) {
      offTmp.copy(camera.position).sub(controls.target);
      sphTmp.setFromVector3(offTmp);
      sphTmp.theta += dth;
      sphTmp.phi = clamp(sphTmp.phi + dph, 0.0005, controls.maxPolarAngle);
      offTmp.setFromSpherical(sphTmp);
      camera.position.copy(controls.target).add(offTmp);
      camera.lookAt(controls.target);
      markDirty();
    }
    on(canvas, 'pointerdown', function (e) {
      if (e.pointerType === 'touch') activeTouches.add(e.pointerId);
      if (immersive() || tween) return;
      if (activeTouches.size > 1) { orbit.id = null; orbit.vth = 0; orbit.vph = 0; return; }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      orbit.id = e.pointerId; orbit.x = e.clientX; orbit.y = e.clientY; orbit.t = performance.now(); orbit.vth = 0; orbit.vph = 0;
      if (controls.autoRotate) setRotate(false);
    });
    on(window, 'pointermove', function (e) {
      if (orbit.id === null || e.pointerId !== orbit.id || immersive()) return;
      const k = 2 * Math.PI / Math.max(200, canvas.clientHeight || 800) * 0.85;
      const dth = MX * (e.clientX - orbit.x) * k, dph = -(e.clientY - orbit.y) * k;
      orbitBy(dth, dph);
      orbit.vth = dth; orbit.vph = dph; orbit.t = performance.now();
      orbit.x = e.clientX; orbit.y = e.clientY;
    });
    function endPointer(e) {
      activeTouches.delete(e.pointerId);
      if (orbit.id === e.pointerId) { orbit.id = null; if (performance.now() - orbit.t > 70) { orbit.vth = 0; orbit.vph = 0; } }
    }
    on(window, 'pointerup', endPointer);
    on(window, 'pointercancel', endPointer);
    on(canvas, 'wheel', function (e) {
      if (!immersive()) return;
      e.preventDefault();
      camera.fov = clamp(camera.fov + Math.sign(e.deltaY) * 4, 38, 84); camera.updateProjectionMatrix(); markDirty();
    }, { passive: false });

    const joyEl = $('joy'), knob = $('knob');
    function moveJoy(e) {
      const r = joyEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = Math.max(10, r.width / 2 - 14);
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      joy.x = dx / R; joy.y = dy / R;
      knob.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
    }
    on(joyEl, 'pointerdown', function (e) { joy.id = e.pointerId; try { joyEl.setPointerCapture(e.pointerId); } catch (er) { /* sem captura */ } moveJoy(e); e.preventDefault(); });
    on(joyEl, 'pointermove', function (e) { if (e.pointerId === joy.id) moveJoy(e); });
    function endJoy(e) { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = 0; joy.y = 0; knob.style.transform = 'translate(0px,0px)'; }
    on(joyEl, 'pointerup', endJoy); on(joyEl, 'pointercancel', endJoy);
    [['btnUp', 1], ['btnDown', -1]].forEach(function (p) {
      const el = $(p[0]);
      const press = function (e) { e.preventDefault(); if (p[1] > 0) upHeld = 1; else downHeld = 1; };
      const release = function () { if (p[1] > 0) upHeld = 0; else downHeld = 0; };
      on(el, 'pointerdown', press); on(el, 'pointerup', release); on(el, 'pointercancel', release); on(el, 'pointerleave', release);
    });
    const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'KeyC', 'Space', 'ShiftLeft', 'ShiftRight'];
    on(window, 'keydown', function (e) {
      if (!immersive()) return;
      if (e.key === 'Escape') {
        if (locked) { try { document.exitPointerLock(); } catch (er) { /* já solto */ } return; }
        if (performance.now() - lockReleasedAt < 400) return;
        goOverview(); return;
      }
      if (MOVE.indexOf(e.code) >= 0) { keys.add(e.code); if (e.code.indexOf('Arrow') === 0 || e.code === 'Space') e.preventDefault(); }
    });
    on(window, 'keyup', function (e) { keys.delete(e.code); });
    on(window, 'blur', function () { keys.clear(); upHeld = 0; downHeld = 0; });

    /* ---------------- tema, tamanho ---------------- */
    function applyTheme() { markDirty(); }   // o fundo é o céu da paisagem, igual nos dois temas
    if (!INTEG && window.matchMedia) {
      const mq = matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) on(mq, 'change', applyTheme); else if (mq.addListener) mq.addListener(applyTheme);
    }
    if (!INTEG && window.MutationObserver) new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    function resize() {
      const w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight;
      if (!INTEG) renderer.setSize(w, h, false);                // no prédio, quem dimensiona o canvas é o prédio
      camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
      sizeMirrors();
      placeTouch(); markDirty();
    }
    const resizeObs = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (resizeObs) { resizeObs.observe(stage); offs.push(function () { resizeObs.disconnect(); }); } else on(window, 'resize', resize);
    resize(); applyTheme();

    let entryFly = false;
    if (INTEG && INTEG.camera) {
      const cp = new THREE.Vector3().fromArray(INTEG.camera.pos).applyMatrix4(UINV), ct = new THREE.Vector3().fromArray(INTEG.camera.target).applyMatrix4(UINV);
      OV_AZ = Math.atan2(cp.x, cp.z - 0.2);                     // chega pelo mesmo lado de onde a câmera do prédio estava
      camera.position.copy(cp); camera.fov = INTEG.camera.fov || 30; camera.updateProjectionMatrix(); camera.lookAt(ct);
      controls.target.copy(ct); controls.enabled = false; controls.autoRotate = false;
      controls.maxDistance = Math.max(140, cp.distanceTo(ct) + 1);
      entryFly = true;
    } else {
      const start = overviewPose();
      camera.position.copy(start.pos); camera.fov = start.fov; camera.updateProjectionMatrix();
      controls.target.copy(start.target); controls.update();
    }
    syncUI();

    const pv = new THREE.Vector3();
    function updatePills() {
      const show = state.labels && !immersive() && !state.overlay;
      const w = stage.clientWidth, h = stage.clientHeight;
      pills.forEach(function (p) {
        let vis = show;
        if (vis) {
          pv.copy(p.pos); if (U) pv.applyMatrix4(U); pv.project(camW || camera);
          vis = pv.z > -1 && pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1;
          if (vis) p.el.style.transform = 'translate3d(' + ((pv.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - pv.y) / 2 * h).toFixed(1) + 'px,0) translate(-50%,-50%)';
        }
        if (vis !== p.shown) { p.el.hidden = !vis; p.shown = vis; }
      });
    }

    /* ---------------- animações ---------------- */
    function stepHinges(list, dt) {
      let moving = false;
      for (let i = 0; i < list.length; i++) {
        const h = list[i], target = h.ref.open ? h.to : h.tc;
        if (Math.abs(target - h.cur) > 0.0008) {
          h.cur += (target - h.cur) * Math.min(1, dt * h.speed);
          if (Math.abs(target - h.cur) <= 0.0008) h.cur = target;
          h.pivot.rotation.y = h.cur; moving = true;
        }
      }
      return moving;
    }
    function stepWindows(dt) {
      let moving = false;
      windowRigs.forEach(function (rig) {
        const st = winState[rig.id], ts = st.open ? 1 : 0;
        if (Math.abs(ts - st.s) > 0.001) { st.s += (ts - st.s) * Math.min(1, dt * 4.5); if (Math.abs(ts - st.s) <= 0.001) st.s = ts; applySash(rig, st.s); moving = true; }
        if (rig.slats.length) {
          const tp = st.shut ? 1 : 0;
          if (Math.abs(tp - st.p) > 0.0005) { st.p += Math.sign(tp - st.p) * Math.min(Math.abs(tp - st.p), dt * 0.9); applyShutter(rig, st.p); moving = true; }
        }
      });
      return moving;
    }
    function stepSliders(dt) {
      let moving = false;
      sliders.forEach(function (s) {
        const ts = s.ref.open ? 1 : 0;
        if (Math.abs(ts - s.cur) > 0.001) { s.cur += (ts - s.cur) * Math.min(1, dt * 5); if (Math.abs(ts - s.cur) <= 0.001) s.cur = ts; s.grp.position[s.axis || 'z'] = s.dist * s.cur; moving = true; }
      });
      return moving;
    }
    let lastTvDraw = 0;
    function stepEffects(dt, now) {
      let active = false;
      if (faucets.some(function (f) { return f.ref.on; })) {
        texWater.offset.y -= dt * 2.6; texWater2.offset.y -= dt * 2.2;
        faucets.forEach(function (f) { if (f.ref.on && f.water.splash) { const k = 1 + Math.sin(now * 0.02 + f.phase) * 0.1; f.water.splash.scale.setScalar(k); } });
        active = true;
      }
      if (tvs.some(function (t) { return t.ref.on; })) {
        tvClock += dt;
        if (now - lastTvDraw > 70) {
          if (tvs.some(function (t) { return t.ref.on && t.screen.material === M.tvOn; })) drawTV(tvClock);
          if (consoleState.on && estarTv && estarTv.ref.on) drawGame(tvClock);
          lastTvDraw = now;
        }
        active = true;
      }
      cooktops.forEach(function (c) { if (c.ref.on) { c.flames.forEach(function (f) { f.scale.y = 0.8 + Math.random() * 0.4; }); active = true; } });
      if (stepXmas(now)) active = true;
      updateWaterSound(now);
      return active;
    }

    /* ---------------- desenho: no prédio, a mesma câmera no mundo desenha o prédio e depois a maquete ---------------- */
    const _wp = new THREE.Vector3(), _wf = new THREE.Vector3(), _wu = new THREE.Vector3();
    function syncWorldCam() {
      _wp.copy(camera.position).applyMatrix4(U);
      _wf.set(0, 0, -1).applyQuaternion(camera.quaternion).transformDirection(U);
      _wu.set(0, 1, 0).applyQuaternion(camera.quaternion).transformDirection(U);
      camW.position.copy(_wp); camW.up.copy(_wu); camW.lookAt(_wp.add(_wf));     // câmera sem espelho, mesmo nos aptos espelhados
      camW.fov = camera.fov; camW.aspect = camera.aspect; camW.near = camera.near; camW.far = camera.far;
      camW.updateProjectionMatrix(); camW.updateMatrixWorld();
    }
    // devolve true quando o mundo pede outro quadro (porta de vidro abrindo, água da piscina)
    function renderAll(moving) {
      if (!INTEG) { renderer.render(scene, camera); return false; }
      syncWorldCam();
      const aptShadows = renderer.shadowMap.needsUpdate;
      let busy = false;
      if (INTEG.renderWorld) busy = !!INTEG.renderWorld(camW, moving);
      if (root.visible) {                                      // fora do andar do apto a maquete nem é desenhada
        renderer.autoClear = false;
        renderer.toneMappingExposure = 1.0;
        renderer.shadowMap.needsUpdate = aptShadows;
        renderer.render(scene, camW);
        renderer.autoClear = true;
      }
      return busy;
    }
    if (U) scene.updateMatrixWorld(true);

    /* ---------------- apto reservado: as luzes dos cômodos piscam em âmbar (como as janelas dele na fachada) ---------------- */
    const RESERVED = !!(INTEG && INTEG.reservado);
    let resT = 0;
    if (RESERVED) Object.keys(roomLights).forEach(function (id) {
      const rl = roomLights[id];
      rl.mat.emissive.copy(lin('#FFB21F')); rl.lights.forEach(function (l) { l.color.copy(lin('#FFC35A')); });
    });
    function stepReserved(now) {
      if (!RESERVED || level !== 'apt' || now - resT < 50) return false;
      resT = now;
      const s = 0.5 + 0.5 * Math.sin(now / 1000 * Math.PI * 2 / 1.4), k = s * s * (3 - 2 * s);
      Object.keys(roomLights).forEach(function (id) {
        const rl = roomLights[id];
        rl.mat.emissiveIntensity = 0.08 + 1.7 * k;
        rl.lights.forEach(function (l) { l.intensity = rl.power * (0.1 + 1.2 * k); });
      });
      return true;
    }

    /* ---------------- laço de render (só desenha quando algo muda) ---------------- */
    const lastCam = { p: new THREE.Vector3(Infinity, 0, 0), q: new THREE.Quaternion(), fov: 0 };
    let last = performance.now(), ready = false, frameErr = false, lastCeilVis = null, lastLift = null;
    function frame(now) {
      if (disposed) return;
      rafId = requestAnimationFrame(frame);
      try {
        now = now || performance.now();
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)) * (dbg && dbg.timeScale || 1); last = now;
        if (tween) stepTween(now);
        else if (immersive()) {
          if (stepPlayer(dt, now)) markDirty();
          camera.position.copy(player.pos);
          camera.lookAt(tmpV.copy(player.pos).add(lookDir()));
          const ceilOn = level === 'apt' && (view === 'walk' || player.pos.y < H_HIGH - 0.03);
          if (ceilGroup.visible !== ceilOn) { ceilGroup.visible = ceilOn; markDirty(); }
          const ls = liftSpot();
          if (ls !== lastLift) { lastLift = ls; syncUI(); }
          const rm = roomAt(player.pos.x, player.pos.z);
          if (view === 'walk' ? (rm && rm !== currentRoom) : rm !== currentRoom) { currentRoom = rm; syncUI(); }
          if (edgeX && lockFailed && !locked) { player.yaw -= MX * edgeX * 1.7 * dt; markDirty(); }
          if (mouseAim() && now - centerT > 90) {
            centerT = now;
            const c = centerXY(), res = pick(c.x, c.y);
            if (res && res.inter) showTip(res.inter.label(res.hit), c.x, c.y); else hideTip();
          }
        } else {
          if (orbit.id === null && (Math.abs(orbit.vth) > 1e-5 || Math.abs(orbit.vph) > 1e-5)) {
            orbitBy(orbit.vth, orbit.vph);
            const decay = Math.pow(0.88, dt * 60); orbit.vth *= decay; orbit.vph *= decay;
          }
          controls.update();
        }
        sky.position.copy(camera.position);
        sunSprite.position.set(camera.position.x + SUN_DIR.x * 1000, camera.position.y + SUN_DIR.y * 1000, camera.position.z + SUN_DIR.z * 1000);
        if (ceilGroup.visible !== lastCeilVis) { lastCeilVis = ceilGroup.visible; dirtyShadows(); updateDaylight(); notifyView(); }
        let anim = stepHinges(archHinges, dt);
        anim = stepHinges(furnHinges, dt) || anim;
        const winMoving = stepWindows(dt);
        if (winMoving) updateDaylight();
        anim = winMoving || anim;
        anim = stepSliders(dt) || anim;
        anim = stepToilet(dt) || anim;
        anim = stepACs(dt) || anim;
        if (anim) renderer.shadowMap.needsUpdate = true;
        const fx = stepEffects(dt, now);
        const fl = stepFill(dt) || stepReserved(now);
        const lf = stepLift(dt, now);
        doorGroup.visible = !state.wallsLow || immersive();
        const camMoved = !camera.position.equals(lastCam.p) || !camera.quaternion.equals(lastCam.q) || camera.fov !== lastCam.fov;
        if (needsRender || camMoved || anim || fx || fl || lf) {
          needsRender = false;
          if (renderAll(camMoved || !!tween || lf)) needsRender = true;
          lastCam.p.copy(camera.position); lastCam.q.copy(camera.quaternion); lastCam.fov = camera.fov;
          updatePills();
          checkPrograms();
        }
        if (ready && entryFly) { entryFly = false; goOverview(reduceMotion ? 0 : 1500); }
        if (!ready) {
          ready = true; window.__aptReady = true;
          if (EMBED || opts.onMessage) { postParent({ type: 'apt:ready', tipo: P.id, titulo: P.meta.titulo, area: P.meta.area, comodos: P.meta.comodos,
            rooms: P.rooms.map(function (r) { return { id: r.id, name: r.name, area: r.area, dims: r.dims }; })
              .concat(CORR_ROOM ? [{ id: 'corredor', name: CORR_ROOM.name, area: '', dims: '' }] : []) }); syncUI(); }
          if (opts.onReady) opts.onReady();
        }
      } catch (e) {
        if (!frameErr) { frameErr = true; console.error(e); }
      }
    }
    if (dbg) Object.assign(dbg, { doorState: doorState, winState: winState, enterWalk: enterWalk, enterFree: enterFree, walkFromFree: walkFromFree, standUp: standUp, sitOrLie: sitOrLie, POSES: POSES, keys: keys, state: state, getView: function () { return view; }, roomAt: roomAt, furnHinges: furnHinges, archHinges: archHinges, faucets: faucets, tvs: tvs, cooktops: cooktops, showerSlide: showerSlide, camera: camera, controls: controls, isLocked: function () { return locked; }, isLockFailed: function () { return lockFailed; },
      roomLights: roomLights, setRoomLight: setRoomLight, fillC: fillC, fillT: fillT, toiletState: toiletState, flush: flush, daylight: daylight, windowOpenness: windowOpenness,
      lightRig: lightRig, pointZones: pointZones, spotZones: spotZones, APT_U: APT_U, aptPatch: aptPatch, getAptLevel: function () { return aptLevel; }, landInfo: landInfo, xmas: xmas, setXmas: setXmas, XMAS_CORNER: XMAS_CORNER, M: M, sliders: sliders, acs: acs, mirrors: mirrors, consoleState: consoleState, setConsole: setConsole, getEstarTv: function () { return estarTv; },
      landGroup: landGroup, sky: sky, sunSprite: sunSprite, lampState: lampState, ceilGroup: ceilGroup, SUN_DIR: SUN_DIR, GROUND_Y: GROUND_Y, ZONE_RECTS: ZONE_RECTS, shutterBottomOf: shutterBottomOf,
      U: U, UINV: UINV, scene: scene, camera: camera, teleport: teleport, clickCenter: function () { const c = centerXY(); clickAt(c.x, c.y); }, pickCenter: function () { const c = centerXY(), r = pick(c.x, c.y); return r && r.inter ? r.inter.label(r.hit) : null; }, getPose: function () { return player.pose ? { hud: player.pose.hud, kind: player.pose.kind, ready: player.pose.ready } : null; }, liftSpot: liftSpot, liftCmd: liftCmd, lift: lift, ELV: ELV, getLevel: function () { return level; }, getFloor: function () { return visitFloor; }, GROUND: GROUND });
    /* ---------------- noite (tema escuro do site): sem sol, luzes dos cômodos acesas ---------------- */
    function setNight(on) {
      dayK = on ? 0 : 1;
      sun.intensity = on ? 0.06 : 1.5;
      hemi.intensity = on ? 0.12 : 0.46;
      Object.keys(roomLights).forEach(function (id) { setRoomLight(id, !!on); });
      updateDaylight(); dirtyShadows();
    }
    if (INTEG && INTEG.night) setNight(true);

    /* ---------------- sair: solta ouvintes, para o laço e libera a memória da placa de vídeo ---------------- */
    let disposed = false, rafId = 0;
    function dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      try { if (locked && document.exitPointerLock) document.exitPointerLock(); } catch (e) { /* já solto */ }
      offs.splice(0).forEach(function (f) { try { f(); } catch (e) { /* já solto */ } });
      try { controls.dispose(); } catch (e) { /* sem controles */ }
      try { if (actx) actx.close(); } catch (e) { /* sem som */ }
      labelsEl.textContent = ''; tip.hidden = true; crosshair.hidden = true; visitBar.hidden = true; touchEl.hidden = true;
      app.classList.remove('is-immersive', 'is-locked');
      canvas.style.cursor = '';
      const mats = new Set(aptMats), geos = new Set(), texs = new Set();
      scene.traverse(function (o) {
        if (o.geometry) geos.add(o.geometry);
        const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(function (x) { mats.add(x); });
        if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose();
      });
      mats.forEach(function (m) {
        ['map', 'emissiveMap', 'envMap', 'normalMap', 'roughnessMap', 'alphaMap'].forEach(function (k) { if (m[k] && m[k].isTexture) texs.add(m[k]); });
        m.dispose();
      });
      geos.forEach(function (g) { g.dispose(); });
      texs.forEach(function (t) { t.dispose(); });
      mirrors.forEach(function (m) { try { m.getRenderTarget().dispose(); } catch (e) { /* sem espelho */ } });
      if (interiorEnv) interiorEnv.dispose();
      if (skyEnv) skyEnv.dispose();
    }

    rafId = requestAnimationFrame(frame);
    return {
      dispose: dispose,
      setNight: function (on) { setNight(on); markDirty(); },
      cmd: function (id) { if (btn[id]) btn[id].click(); },
      room: function (id) { enterWalk(id); },
      // elevador: 'call' chama, 'open'/'close' a porta, um número (0 = térreo, 1 a 12) é o botão do painel da cabine
      lift: function (cmd) { liftCmd(cmd); },
      // atalhos: 'terreo' (sai na frente da torre) ou 'hall' (hall dos elevadores do andar do apto)
      teleport: function (dest) { teleport(dest); },
      level: function () { return level; },
      // onde a câmera está, no mundo do prédio (para o prédio continuar dali ao sair)
      worldCamera: function () {
        const p = camera.position.clone(), t = currentTarget();
        if (U) { p.applyMatrix4(U); t.applyMatrix4(U); }
        return { pos: p.toArray(), target: t.toArray(), fov: camera.fov };
      },
      view: function () { return view; }
    };
  }
})();
