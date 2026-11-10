/*
 * Predio3D — as duas torres do Residencial Milão em WebGL (three.js r128).
 * Medidas em metros. Cada torre é uma pilha de fatias (térreo + 12 andares de 2,84 m) para que um andar
 * possa ser destacado, aberto (mostrando os 12 apartamentos) e os andares de cima escondidos.
 * Fachada desenhada em canvas a partir das fotos da construtora: cinza claro, faixas grafite,
 * painéis azul-marinho, coroamento azul e sacadas nos aptos de canto.
 */
(function () {
  'use strict';

  const FH = 2.84;                 // piso a piso
  const FLOORS = 12;               // andares acima do térreo
  const LEVELS = FLOORS + 1;       // térreo + andares
  const L = 54, D = 15, HL = L / 2, HD = D / 2;
  const TOP = LEVELS * FH;         // laje de cobertura
  const CROWN = 1.3, CORE_UP = 3.8, CORE_W = 3.6, CORE_D = 6;
  const PXM = 38;                  // pixels por metro nas texturas de fachada
  const ROW = Math.round(FH * PXM);

  // trechos da fachada comprida, da esquerda (-x) para a direita (+x)
  const BAYS = [
    ['canto', -27, -18, 'L'], ['faixa', -18, -15.8], ['meio', -15.8, -8.8], ['meio', -8.8, -1.8],
    ['nucleo', -1.8, 1.8], ['meio', 1.8, 8.8], ['meio', 8.8, 15.8], ['faixa', 15.8, 18], ['canto', 18, 27, 'R']
  ];
  const UNIT_X = { 1: [-27, -18], 2: [-15.8, -8.8], 3: [-8.8, -1.8], 4: [1.8, 8.8], 5: [8.8, 15.8], 6: [18, 27] };
  const LOGGIA = 2.6;              // largura da sacada nos aptos de canto

  // posição no andar (1–12) -> retângulo em planta, no sistema da torre
  function unitRect(pos) {
    const front = pos <= 6;
    const k = front ? pos : 13 - pos;            // o 7 fica atrás do 6, o 12 atrás do 1
    const x = UNIT_X[k];
    return { x0: x[0], x1: x[1], z0: front ? 0.8 : -HD, z1: front ? HD : -0.8, front: front, canto: k === 1 || k === 6, k: k };
  }

  // as duas torres ficam em linha, uma ao lado da outra, de frente para a rua (a B um pouco recuada), como nas fotos aéreas
  const TOWERS = [
    { id: 'A', x: -30, z: 0 },
    { id: 'B', x: 31, z: -3 }
  ];

  const C = {
    light: '#DADDE3', light2: '#D2D6DD', graphite: '#3A3F49', graphite2: '#323640', navy: '#22318A',
    frame: '#F3F4F6', glassTop: '#5C7186', glassBot: '#A3B8CA', loggia: '#4C525D', slab: '#C2C6CE', roof: '#9EA2A8'
  };

  function rng(seed) {
    let s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------------- texturas de fachada ---------------- */

  function windowsOf(bay) {
    const t = bay[0], a = bay[1];
    if (t === 'meio') return [[a + 1.5, 1.2], [a + 3.7, 1.2], [a + 5.6, 1.6]];
    if (t === 'canto' && bay[3] === 'L') return [[a + 3.5, 1.6], [a + 5.9, 1.2], [a + 7.9, 1.2]];
    if (t === 'canto') return [[a + 5.5, 1.6], [a + 3.1, 1.2], [a + 1.1, 1.2]];
    return [];
  }

  // desenha uma janela (moldura e vidro com reflexo do céu) e guarda onde ela está, para acender depois conforme o apartamento
  function drawWindow(g, wins, x, y, w, h, info) {
    g.fillStyle = C.frame; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, C.glassTop); gr.addColorStop(1, C.glassBot);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + w / 2 - 1, y, 2, h);           // caixilho
    if (wins) wins.push(Object.assign({ x: x, y: y, w: w, h: h }, info));
  }

  function facadeLong(seed, isFront) {
    const W = Math.round(L * PXM), H = ROW * LEVELS;
    const cm = canvas(W, H), g = cm.getContext('2d'), wins = [];
    const rx = function (m) { return (m + HL) * PXM; };
    for (let lv = 0; lv < LEVELS; lv++) {
      const y0 = H - (lv + 1) * ROW;
      const ry = function (m) { return y0 + ROW - m * PXM; };
      g.fillStyle = (lv % 2) ? C.light : C.light2; g.fillRect(0, y0, W, ROW);
      BAYS.forEach(function (b) {
        if (b[0] === 'faixa' || b[0] === 'nucleo') { g.fillStyle = b[0] === 'nucleo' ? C.graphite2 : C.graphite; g.fillRect(rx(b[1]), y0, rx(b[2]) - rx(b[1]), ROW); }
      });
      if (lv === 0) {                                     // térreo: embasamento grafite e portaria envidraçada no núcleo
        g.fillStyle = C.graphite; g.fillRect(0, ry(0.55), W, 0.55 * PXM);
        if (isFront) {
          const x0 = rx(-1.6), w = 3.2 * PXM;
          g.fillStyle = '#20242B'; g.fillRect(x0 - 3, ry(2.5) - 3, w + 6, 2.5 * PXM + 3);
          const gr = g.createLinearGradient(0, ry(2.5), 0, ry(0)); gr.addColorStop(0, '#6E8296'); gr.addColorStop(1, '#2C3440');
          g.fillStyle = gr; g.fillRect(x0, ry(2.5), w, 2.5 * PXM);
          wins.push({ x: x0, y: ry(2.5), w: w, h: 2.5 * PXM, lv: 0, kind: 'lobby' });
        }
      }
      BAYS.forEach(function (b, bi) {
        if (b[0] === 'faixa' || b[0] === 'nucleo') {         // janelinhas de serviço e da escada
          const cx = (b[1] + b[2]) / 2, w = 0.55 * PXM, h = 0.65 * PXM;
          if (lv === 0 && b[0] === 'nucleo' && isFront) return;
          drawWindow(g, wins, rx(cx) - w / 2, ry(2.05), w, h, { lv: lv, b: b, kind: b[0] === 'nucleo' ? 'core' : 'service' });
          return;
        }
        if (b[0] === 'canto' && lv > 0) {                    // sacada recuada com guarda-corpo de vidro
          const lx0 = b[3] === 'L' ? b[1] : b[2] - LOGGIA, lx1 = lx0 + LOGGIA;
          g.fillStyle = C.loggia; g.fillRect(rx(lx0) + 2, ry(2.55), (lx1 - lx0) * PXM - 4, 2.4 * PXM);
          const door = rx(lx0) + 0.35 * PXM, dw = (LOGGIA - 0.7) * PXM;
          drawWindow(g, wins, door, ry(2.2), dw, 2.0 * PXM, { lv: lv, b: b, kind: 'unit' });
          g.fillStyle = 'rgba(214,226,236,.55)'; g.fillRect(rx(lx0), ry(1.1), LOGGIA * PXM, 0.95 * PXM);
          g.fillStyle = '#EDEFF2'; g.fillRect(rx(lx0), ry(1.1) - 2, LOGGIA * PXM, 3);
        }
        windowsOf(b).forEach(function (wd, wi) {
          const w = wd[1] * PXM, h = 1.15 * PXM, x = rx(wd[0]) - w / 2, y = ry(2.2);
          if (((bi * 7 + wi * 5 + lv * 3) % 5) < 2) {        // painel azul-marinho ao lado da janela, como na fachada real
            const side = (wi + lv) % 2 ? 1 : -1, pw = 0.85 * PXM;
            g.fillStyle = C.navy; g.fillRect(side > 0 ? x + w + 2 : x - 2 - pw, y - 0.15 * PXM, pw, h + 0.3 * PXM);
          }
          drawWindow(g, wins, x, y, w, h, { lv: lv, b: b, kind: lv > 0 ? 'unit' : 'ground' });
        });
      });
      g.fillStyle = C.slab; g.fillRect(0, y0 + ROW - 3, W, 3);
    }
    return { map: cm, wins: wins, W: W, H: H };
  }

  // a qual apartamento (1–6 na frente, 7–12 nos fundos) pertence um trecho da fachada; a face dos fundos é vista espelhada
  function unitOfBay(b, back) {
    if (!b || b[0] === 'nucleo') return 0;
    const a = back ? -b[2] : b[1], z = back ? -b[1] : b[2];
    let k = 0;
    if (b[0] === 'faixa') k = a < 0 ? 1 : 6;                 // janelinha de serviço do poço: do apto de canto ao lado
    else Object.keys(UNIT_X).forEach(function (kk) { if (Math.abs(UNIT_X[kk][0] - a) < 0.01 && Math.abs(UNIT_X[kk][1] - z) < 0.01) k = +kk; });
    return k ? (back ? 13 - k : k) : 0;
  }
  // luzes da fachada de uma torre: apartamento disponível = janelas acesas; reservado ou vendido = tudo apagado
  const LIT = 'rgb(255,196,118)';
  function facadeLights(f, torre, back, statusOf) {
    const sc = 0.5, c = canvas(Math.round(f.W * sc), Math.round(f.H * sc)), e = c.getContext('2d');
    e.fillStyle = '#000'; e.fillRect(0, 0, c.width, c.height);
    f.wins.forEach(function (w) {
      let lit = false;
      if (w.kind === 'lobby') lit = true;
      else if ((w.kind === 'unit' || w.kind === 'service') && w.lv > 0) { const pos = unitOfBay(w.b, back); lit = !!pos && statusOf(torre, w.lv, pos) === 'livre'; }
      if (!lit) return;
      e.fillStyle = LIT; e.fillRect(w.x * sc, w.y * sc, w.w * sc, w.h * sc);
      e.fillStyle = 'rgba(0,0,0,.4)'; e.fillRect((w.x + w.w / 2) * sc - 1, w.y * sc, 2, w.h * sc);
    });
    return c;
  }

  function facadeShort(seed) {
    const W = Math.round(D * PXM), H = ROW * LEVELS;
    const cm = canvas(W, H), g = cm.getContext('2d');
    const rx = function (m) { return m * PXM; };
    for (let lv = 0; lv < LEVELS; lv++) {
      const y0 = H - (lv + 1) * ROW;
      const ry = function (m) { return y0 + ROW - m * PXM; };
      g.fillStyle = (lv % 2) ? C.light : C.light2; g.fillRect(0, y0, W, ROW);
      g.fillStyle = C.graphite; g.fillRect(rx(6.7), y0, rx(1.6), ROW);
      if (lv === 0) { g.fillStyle = C.graphite; g.fillRect(0, ry(0.55), W, 0.55 * PXM); }
      // ponta do prédio: a parede da sala do apto de canto é cega (sem janelas, como na planta); só os painéis azuis da fachada
      [3.6, 11.4].forEach(function (cx, wi) {
        if (((wi + lv) % 3) === 0) { g.fillStyle = C.navy; g.fillRect(rx(cx) - 0.45 * PXM, ry(2.35), 0.9 * PXM, 1.45 * PXM); }
      });
      drawWindow(g, null, rx(7.5) - 0.3 * PXM, ry(2.05), 0.6 * PXM, 0.65 * PXM);
      g.fillStyle = C.slab; g.fillRect(0, y0 + ROW - 3, W, 3);
    }
    return { map: cm };
  }

  function crownLong() {
    const W = Math.round((L + 0.2) * PXM), H = Math.round(CROWN * PXM);
    const c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = C.navy; g.fillRect(0, 0, W, H);
    BAYS.forEach(function (b) { if (b[0] === 'faixa' || b[0] === 'nucleo') { g.fillStyle = C.graphite; g.fillRect((b[1] + HL + 0.1) * PXM, 0, (b[2] - b[1]) * PXM, H); } });
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, W, 3);
    return c;
  }
  function crownShort() {
    const W = Math.round((D + 0.2) * PXM), H = Math.round(CROWN * PXM);
    const c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = C.navy; g.fillRect(0, 0, W, H);
    g.fillStyle = C.graphite; g.fillRect(6.8 * PXM, 0, 1.6 * PXM, H);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, W, 3);
    return c;
  }

  /* ---------------- terreno do condomínio ---------------- */

  const SITE = { x0: -72, x1: 72, z0: -60, z1: 44 };
  const SITE_PX = 16;
  const AREAS = {
    lawn: '#8EAA6C', paving: '#CFCBC2', asphalt: '#5D6067', deck: '#DCCFB8', rubber: '#C46F52', walk: '#E2DED6'
  };
  const PARKING = [                                  // [x0, z0, x1, z1, direção das vagas]: estacionamento descoberto na frente das torres
    [-68, 18, 10, 40, 'z'], [30, 18, 68, 40, 'z'], [-68, -58, 4, -53, 'z']
  ];
  const POOL = { deck: [-56, -48, -22, -18], adult: [-51, -40, -39, -33], kids: [-34, -38, -30, -34] };

  function siteCanvas() {
    const W = (SITE.x1 - SITE.x0) * SITE_PX, H = (SITE.z1 - SITE.z0) * SITE_PX;
    const c = canvas(W, H), g = c.getContext('2d');
    const X = function (m) { return (m - SITE.x0) * SITE_PX; }, Z = function (m) { return (m - SITE.z0) * SITE_PX; };
    const rect = function (col, x0, z0, x1, z1) { g.fillStyle = col; g.fillRect(X(x0), Z(z0), (x1 - x0) * SITE_PX, (z1 - z0) * SITE_PX); };
    rect(AREAS.lawn, SITE.x0, SITE.z0, SITE.x1, SITE.z1);
    const R = rng(77);
    for (let i = 0; i < 2600; i++) { g.fillStyle = R() < 0.5 ? 'rgba(60,90,40,.10)' : 'rgba(200,220,150,.10)'; g.fillRect(R() * W, R() * H, 3 + R() * 8, 2 + R() * 5); }
    // vias internas: rua na frente das torres, acesso pela portaria e contorno pela ponta da torre A até o fundo
    rect(AREAS.asphalt, -70, 12, 70, 18);
    rect(AREAS.asphalt, 12, 18, 28, 44);
    rect(AREAS.asphalt, -72, -53, -64, 18);
    rect(AREAS.asphalt, -72, -53, 4, -48);
    // estacionamentos com vagas de 2,5 m
    PARKING.forEach(function (p) {
      rect(AREAS.asphalt, p[0], p[1], p[2], p[3]);
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
      if (p[4] === 'z') {
        [[p[1], p[1] + 5], [p[3] - 5, p[3]]].forEach(function (row) {
          for (let x = p[0]; x <= p[2] + 0.01; x += 2.5) { g.beginPath(); g.moveTo(X(x), Z(row[0])); g.lineTo(X(x), Z(row[1])); g.stroke(); }
        });
      } else {
        [[p[0], p[0] + 5], [p[2] - 5, p[2]]].forEach(function (col) {
          for (let z = p[1]; z <= p[3] + 0.01; z += 2.5) { g.beginPath(); g.moveTo(X(col[0]), Z(z)); g.lineTo(X(col[1]), Z(z)); g.stroke(); }
        });
      }
    });
    // calçadas em volta das torres
    TOWERS.forEach(function (t) { rect(AREAS.walk, t.x - HL - 2.2, t.z - HD - 2.2, t.x + HL + 2.2, t.z + HD + 2.2); });
    // lazer
    rect(AREAS.deck, POOL.deck[0], POOL.deck[1], POOL.deck[2], POOL.deck[3]);
    rect(AREAS.paving, -16, -36, 6, -20);
    rect(AREAS.paving, 10, -50, 26, -36);
    rect(AREAS.rubber, 32, -48, 44, -34);
    rect(AREAS.walk, 2, 38, 34, 44);
    // muro do condomínio
    g.strokeStyle = 'rgba(40,44,52,.75)'; g.lineWidth = 4; g.strokeRect(X(SITE.x0) + 2, Z(SITE.z0) + 2, W - 4, H - 4);
    return c;
  }

  /* ---------------- cena ---------------- */

  function create(opts) {
    const THREE = window.THREE;
    const cv = opts.canvas, host = opts.host, labelsEl = opts.labels;
    const statusOf = opts.statusOf, typeOf = opts.typeOf;
    const colors = opts.colors();
    const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 1600);
    const controls = new THREE.OrbitControls(camera, cv);
    controls.enableDamping = true; controls.dampingFactor = 0.085;
    controls.screenSpacePanning = true;
    controls.minDistance = 22; controls.maxDistance = 330;
    controls.maxPolarAngle = 1.47; controls.minPolarAngle = 0.15;
    controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 0.45;
    controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.9;

    const tex = function (c, srgb) {
      const t = new THREE.CanvasTexture(c);
      if (srgb !== false) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = ANISO; return t;
    };
    const lin = function (c) { return (c && c.isColor ? c.clone() : new THREE.Color(c)).convertSRGBToLinear(); };
    const std = function (o) {
      o = Object.assign({ roughness: 0.85, metalness: 0 }, o);
      if (o.color !== undefined) o.color = lin(o.color);
      if (o.emissive !== undefined) o.emissive = lin(o.emissive);
      return new THREE.MeshStandardMaterial(o);
    };

    /* céu: gradiente de dia e de noite */
    function skyTex(top, mid, bottom) {
      const c = canvas(4, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, top); gr.addColorStop(0.62, mid); gr.addColorStop(1, bottom);
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return tex(c);
    }
    const SKY = {
      day: { tex: skyTex('#6E9FD1', '#BFD5E9', '#E4ECF2'), fog: 0xDCE6EE },
      night: { tex: skyTex('#060B1E', '#16224A', '#2C3A63'), fog: 0x1C2747 }
    };
    scene.fog = new THREE.Fog(lin(SKY.day.fog), 230, 760);

    /* luzes */
    const hemi = new THREE.HemisphereLight(0xE4EEF8, 0x5E6B4E, 0.72); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xFFF2DE, 1.25);
    sun.position.set(70, 120, 85); sun.target.position.set(-2, 0, -6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 380 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    const amb = new THREE.AmbientLight(0x8090C0, 0); scene.add(amb);
    const lamps = [];
    [[8, 40], [30, 40], [20, 20], [-30, 16], [31, 16], [-5, -24], [-40, -16], [18, -34]].forEach(function (p) {
      const l = new THREE.PointLight(0xFFC98A, 0, 26, 2); l.position.set(p[0], 4.2, p[1]); scene.add(l); lamps.push(l);
    });

    /* chão */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), std({ color: 0x96A47F }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; ground.receiveShadow = true; scene.add(ground);
    const siteW = SITE.x1 - SITE.x0, siteD = SITE.z1 - SITE.z0;
    const site = new THREE.Mesh(new THREE.PlaneGeometry(siteW, siteD), std({ map: tex(siteCanvas()), roughness: 0.95 }));
    site.rotation.x = -Math.PI / 2; site.position.set((SITE.x0 + SITE.x1) / 2, 0, (SITE.z0 + SITE.z1) / 2); site.receiveShadow = true; scene.add(site);
    // rua em frente e calçadas
    const street = new THREE.Mesh(new THREE.PlaneGeometry(1600, 9), std({ color: 0x4A4D54, roughness: 0.9 }));
    street.rotation.x = -Math.PI / 2; street.position.set(0, -0.02, 53.5); street.receiveShadow = true; scene.add(street);
    [47.5, 59.5].forEach(function (z) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1600, 3), std({ color: 0xC9C5BD })); s.rotation.x = -Math.PI / 2; s.position.set(0, -0.01, z); s.receiveShadow = true; scene.add(s);
    });
    const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(3, 0.18), new THREE.MeshBasicMaterial({ color: lin(0xE8E2CF) }), 120);
    const dm = new THREE.Object3D();
    for (let i = 0; i < 120; i++) { dm.position.set(-600 + i * 10, 0.005, 53.5); dm.rotation.set(-Math.PI / 2, 0, 0); dm.updateMatrix(); dash.setMatrixAt(i, dm.matrix); }
    scene.add(dash);

    /* torres */
    const facFront = facadeLong(11, true), facBack = facadeLong(29, false), facEndA = facadeShort(41), facEndB = facadeShort(53);
    const mapFront = tex(facFront.map), mapBack = tex(facBack.map);
    const LIGHTS = {};
    TOWERS.forEach(function (T) { LIGHTS[T.id] = { front: tex(facadeLights(facFront, T.id, false, statusOf)), back: tex(facadeLights(facBack, T.id, true, statusOf)) }; });
    const facadeMats = [];
    const facadeMat = function (map, emi) {
      const m = std(emi ? { map: map, emissiveMap: emi, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0, roughness: 0.78 } : { map: map, roughness: 0.78 });
      if (emi) facadeMats.push(m);
      return m;
    };
    const M = {
      endA: facadeMat(tex(facEndA.map)), endB: facadeMat(tex(facEndB.map)),
      roof: std({ color: 0x9FA3A9, roughness: 0.95 }),
      crownL: std({ map: tex(crownLong()) }), crownS: std({ map: tex(crownShort()) }),
      graphite: std({ color: 0x3A3F49, roughness: 0.8 }),
      gold: std({ color: 0xD3A02B, roughness: 0.45, metalness: 0.2, emissive: new THREE.Color(0xD3A02B), emissiveIntensity: 0 }),
      glass: new THREE.MeshStandardMaterial({ color: lin(0xCFE0EC), roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false }),
      rail: std({ color: 0xF2F3F5, roughness: 0.5 }),
      slabEdge: std({ color: 0xE6E8EB, roughness: 0.8 })
    };

    function sliceGeo(level) {
      const g = new THREE.BoxGeometry(L, FH, D);
      const uv = g.attributes.uv, v0 = level / LEVELS, dv = 1 / LEVELS;
      [0, 1, 4, 5].forEach(function (face) {
        for (let i = 0; i < 4; i++) { const k = face * 4 + i; uv.setY(k, v0 + uv.getY(k) * dv); }
      });
      uv.needsUpdate = true;
      return g;
    }
    const SLICE_GEOS = []; for (let lv = 0; lv < LEVELS; lv++) SLICE_GEOS.push(sliceGeo(lv));

    const towers = {};
    const pickables = [];
    TOWERS.forEach(function (T, ti) {
      const root = new THREE.Group(); root.position.set(T.x, 0, T.z); scene.add(root);
      const mats = [ti === 0 ? M.endA : M.endB, ti === 0 ? M.endB : M.endA, M.roof, M.roof, facadeMat(mapFront, LIGHTS[T.id].front), facadeMat(mapBack, LIGHTS[T.id].back)];
      const slices = [];
      for (let lv = 0; lv < LEVELS; lv++) {
        const m = new THREE.Mesh(SLICE_GEOS[lv], mats);
        m.position.y = lv * FH + FH / 2; m.castShadow = true; m.receiveShadow = true;
        m.userData = { torre: T.id, andar: lv };
        root.add(m); slices.push(m);
        if (lv > 0) pickables.push(m);
      }
      // coroamento, laje de cobertura e núcleo que sobe acima do telhado com o quadro dourado
      const top = new THREE.Group(); root.add(top);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, CROWN, D + 0.2), [M.crownS, M.crownS, M.roof, M.roof, M.crownL, M.crownL]);
      crown.position.y = TOP + CROWN / 2; crown.castShadow = true; top.add(crown);
      const core = new THREE.Mesh(new THREE.BoxGeometry(CORE_W, CORE_UP, CORE_D), M.graphite);
      core.position.y = TOP + CORE_UP / 2; core.castShadow = true; top.add(core);
      [1, -1].forEach(function (s) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), M.gold);
        p.position.set(0, TOP + CORE_UP - 1.35, s * (CORE_D / 2 + 0.02)); if (s < 0) p.rotation.y = Math.PI; top.add(p);
      });
      const roofCap = new THREE.Mesh(new THREE.BoxGeometry(L - 0.4, 0.1, D - 0.4), M.roof); roofCap.position.y = TOP + 0.35; top.add(roofCap);
      // sacadas: piso saliente, guarda-corpo de vidro e corrimão (instanciados, em ordem de andar)
      const nb = FLOORS * 4;
      const balcSlab = new THREE.InstancedMesh(new THREE.BoxGeometry(LOGGIA, 0.14, 0.32), M.slabEdge, nb);
      const balcGlass = new THREE.InstancedMesh(new THREE.PlaneGeometry(LOGGIA, 0.95), M.glass, nb);
      const balcRail = new THREE.InstancedMesh(new THREE.BoxGeometry(LOGGIA, 0.05, 0.06), M.rail, nb);
      let k = 0;
      for (let f = 1; f <= FLOORS; f++) {
        [[-HL + LOGGIA / 2, 1], [HL - LOGGIA / 2, 1], [-HL + LOGGIA / 2, -1], [HL - LOGGIA / 2, -1]].forEach(function (b) {
          const y = f * FH, zs = b[1] * (HD + 0.12);
          dm.rotation.set(0, b[1] > 0 ? 0 : Math.PI, 0);
          dm.position.set(b[0], y + 0.02, zs); dm.updateMatrix(); balcSlab.setMatrixAt(k, dm.matrix);
          dm.position.set(b[0], y + 0.6, b[1] * (HD + 0.26)); dm.updateMatrix(); balcGlass.setMatrixAt(k, dm.matrix);
          dm.position.set(b[0], y + 1.1, b[1] * (HD + 0.26)); dm.updateMatrix(); balcRail.setMatrixAt(k, dm.matrix);
          k++;
        });
      }
      [balcSlab, balcGlass, balcRail].forEach(function (im) { im.instanceMatrix.needsUpdate = true; im.castShadow = im !== balcGlass; root.add(im); });
      // destaque do andar sob o mouse
      const hl = new THREE.Group(); hl.visible = false; root.add(hl);
      const hlBox = new THREE.Mesh(new THREE.BoxGeometry(L + 0.7, FH - 0.06, D + 0.7), new THREE.MeshBasicMaterial({ color: lin(colors.gold), transparent: true, opacity: 0.32, depthWrite: false }));
      const hlEdge = new THREE.LineSegments(new THREE.EdgesGeometry(hlBox.geometry), new THREE.LineBasicMaterial({ color: lin(colors.gold) }));
      hl.add(hlBox); hl.add(hlEdge);
      // volume fantasma dos andares acima do andar aberto
      const ghost = new THREE.Group(); ghost.visible = false; root.add(ghost);
      towers[T.id] = { T: T, root: root, slices: slices, top: top, balc: [balcSlab, balcGlass, balcRail], hl: hl, hlBox: hlBox, hlEdge: hlEdge, ghost: ghost, plate: null };
    });

    /* portaria, pórtico com o nome, lazer */
    (function buildSite() {
      const box = function (mat, w, h, d, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
      const concrete = std({ color: 0x9C9A95, roughness: 0.95 });
      const white = std({ color: 0xEDEEEF });
      const dark = std({ color: 0x3B3F46 });
      // pilar com o nome do condomínio
      const nameC = canvas(256, 512), ng = nameC.getContext('2d');
      ng.fillStyle = '#9C9A95'; ng.fillRect(0, 0, 256, 512);
      const NR = rng(5); for (let i = 0; i < 900; i++) { ng.fillStyle = NR() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)'; ng.fillRect(NR() * 256, NR() * 512, 2 + NR() * 4, 2 + NR() * 4); }
      ng.fillStyle = '#3A3A3A'; ng.font = '600 50px Archivo, Arial, sans-serif'; ng.textAlign = 'center'; ng.textBaseline = 'middle';
      ng.fillText('MILÃO', 128, 300);
      const pillarFront = std({ map: tex(nameC), roughness: 0.95 });
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 6.2, 1.3), [concrete, concrete, concrete, concrete, pillarFront, concrete]);
      pillar.position.set(8.6, 3.1, 44.4); pillar.castShadow = true; scene.add(pillar);
      box(dark, 18, 0.35, 5.4, 20, 4.5, 41.6);                  // pórtico sobre a entrada
      box(dark, 0.35, 4.5, 0.35, 28.8, 2.25, 43.9);
      box(dark, 6, 3.2, 5, 33.2, 1.6, 41);                      // guarita
      box(M.glass, 5.2, 1.6, 0.05, 33.2, 1.9, 43.52);
      box(dark, 7, 0.25, 6, 33.2, 3.32, 41);
      // salão de festas
      box(white, 14, 4, 12, 18, 2, -43);
      box(dark, 15, 0.3, 13, 18, 4.15, -43);
      box(M.glass, 13, 2.6, 0.05, 18, 1.6, -36.95);
      // quiosques com churrasqueira
      [[-10, -28], [0, -28]].forEach(function (p) {
        box(dark, 5, 0.25, 4.4, p[0], 3.1, p[1]);
        [[-2.2, -1.9], [2.2, -1.9], [-2.2, 1.9], [2.2, 1.9]].forEach(function (c) { box(white, 0.22, 3, 0.22, p[0] + c[0], 1.5, p[1] + c[1]); });
        box(std({ color: 0x9A5A45 }), 1.4, 1.1, 0.7, p[0], 0.55, p[1] - 1.6);
      });
      // piscinas
      const water = std({ color: 0x3FA7C9, roughness: 0.12, metalness: 0.05, emissive: new THREE.Color(0x0D5A78), emissiveIntensity: 0.25 });
      [POOL.adult, POOL.kids].forEach(function (p) {
        const w = p[2] - p[0], d = p[3] - p[1];
        box(white, w + 0.6, 0.12, d + 0.6, (p[0] + p[2]) / 2, 0.03, (p[1] + p[3]) / 2);
        const wm = new THREE.Mesh(new THREE.PlaneGeometry(w, d), water); wm.rotation.x = -Math.PI / 2; wm.position.set((p[0] + p[2]) / 2, 0.1, (p[1] + p[3]) / 2); scene.add(wm);
      });
      // playground
      const red = std({ color: 0xD24B3E }), yellow = std({ color: 0xE5B53A }), blue = std({ color: 0x2F62B5 });
      box(red, 2.2, 2.2, 2.2, 35, 1.1, -44); box(blue, 0.8, 0.12, 3.6, 35, 1.2, -40.6).rotation.x = 0.55;
      box(yellow, 4, 0.15, 0.15, 40.5, 2.4, -42); box(yellow, 0.15, 2.4, 0.15, 38.5, 1.2, -42); box(yellow, 0.15, 2.4, 0.15, 42.5, 1.2, -42);
      // espaço pet: cerca baixa
      const fence = std({ color: 0x4A4F57 });
      box(fence, 16, 0.9, 0.08, 58, 0.45, -54); box(fence, 16, 0.9, 0.08, 58, 0.45, -40); box(fence, 0.08, 0.9, 14, 50, 0.45, -47);
      // muro do condomínio (baixo, com gradil)
      const wallMat = std({ color: 0x5A5E66, roughness: 0.9 });
      [[0, SITE.z0, SITE.x1 - SITE.x0, 0.2], [SITE.x0, (SITE.z0 + SITE.z1) / 2, 0.2, SITE.z1 - SITE.z0], [SITE.x1, (SITE.z0 + SITE.z1) / 2, 0.2, SITE.z1 - SITE.z0], [-30, SITE.z1, 84, 0.2], [50, SITE.z1, 44, 0.2]].forEach(function (w) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w[2], 1.8, w[3]), wallMat); m.position.set(w[0], 0.9, w[1]); m.castShadow = true; scene.add(m);
      });
    })();

    /* árvores e casas da vizinhança (instanciadas) */
    (function buildContext() {
      const R = rng(2026);
      const trees = [];
      for (let x = -68; x <= 68; x += 7.5) { trees.push([x + R() * 2, -62.5 - R()]); }
      for (let z = -52; z <= 40; z += 8) { trees.push([-74.5 - R(), z + R() * 2]); trees.push([74.5 + R(), z + R() * 2]); }
      for (let x = -90; x <= 90; x += 11) { if (Math.abs(x - 20) > 12) trees.push([x + R() * 3, 45 + R()]); }
      [[-60, -26], [-14, -14], [6, -16], [26, -22], [46, -26], [64, -26], [-6, 30], [48, 44], [-64, 44], [2, -44], [-4, -56]].forEach(function (p) { trees.push(p); });
      for (let i = 0; i < 160; i++) {
        const x = (R() - 0.5) * 560, z = (R() - 0.5) * 460 - 20;
        if (x > -82 && x < 82 && z > -70 && z < 64) continue;
        if (z > 45 && z < 63) continue;
        trees.push([x, z]);
      }
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 2.4, 6), std({ color: 0x6B5240 }), trees.length);
      const crownG = new THREE.IcosahedronGeometry(1, 1);
      const crowns = new THREE.InstancedMesh(crownG, std({ color: 0xffffff, roughness: 0.9, flatShading: true }), trees.length);
      const col = new THREE.Color();
      trees.forEach(function (p, i) {
        const s = 1.6 + R() * 1.6;
        dm.rotation.set(0, R() * 6.28, 0);
        dm.position.set(p[0], 1.2, p[1]); dm.scale.set(1, 1, 1); dm.updateMatrix(); trunk.setMatrixAt(i, dm.matrix);
        dm.position.set(p[0], 2.2 + s * 0.85, p[1]); dm.scale.set(s, s * 0.92, s); dm.updateMatrix(); crowns.setMatrixAt(i, dm.matrix);
        col.setHSL(0.24 + R() * 0.07, 0.38 + R() * 0.15, 0.27 + R() * 0.1); crowns.setColorAt(i, col.convertSRGBToLinear());
      });
      trunk.castShadow = true; crowns.castShadow = true; crowns.receiveShadow = true;
      scene.add(trunk); scene.add(crowns);

      const houses = [];
      for (let i = 0; i < 420 && houses.length < 150; i++) {
        const x = (R() - 0.5) * 600, z = (R() - 0.5) * 520 - 10;
        if (x > -86 && x < 86 && z > -74 && z < 66) continue;
        if (z > 44 && z < 64) continue;
        if (houses.some(function (h) { return Math.abs(h[0] - x) < 13 && Math.abs(h[1] - z) < 13; })) continue;
        houses.push([x, z, 7 + R() * 6, 8 + R() * 6, 3 + R() * 3.2, R() * 0.4 - 0.2]);
      }
      const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std({ color: 0xffffff }), houses.length);
      const roofG = new THREE.ConeGeometry(0.75, 1, 4); roofG.rotateY(Math.PI / 4);
      const roofs = new THREE.InstancedMesh(roofG, std({ color: 0xffffff, roughness: 0.8 }), houses.length);
      const wallCols = ['#E9E2D3', '#D9D2C2', '#C9D3D8', '#E6D6C2', '#D7DDD0', '#EFE9DE'], roofCols = ['#A0573F', '#8A4E3B', '#6E7378', '#B26A4A'];
      houses.forEach(function (h, i) {
        dm.rotation.set(0, h[5], 0);
        dm.position.set(h[0], h[4] / 2, h[1]); dm.scale.set(h[2], h[4], h[3]); dm.updateMatrix(); walls.setMatrixAt(i, dm.matrix);
        dm.position.set(h[0], h[4] + 1.0, h[1]); dm.scale.set(h[2] * 1.12, 2.0, h[3] * 1.12); dm.updateMatrix(); roofs.setMatrixAt(i, dm.matrix);
        walls.setColorAt(i, col.set(wallCols[i % wallCols.length]).convertSRGBToLinear()); roofs.setColorAt(i, col.set(roofCols[(i * 7) % roofCols.length]).convertSRGBToLinear());
      });
      walls.castShadow = roofs.castShadow = true; walls.receiveShadow = true;
      scene.add(walls); scene.add(roofs);
    })();

    /* ---------------- andar aberto: laje com os 12 apartamentos ---------------- */
    const unitMats = {};
    function unitMat(st, dim) {
      const key = st + (dim ? '-dim' : '');
      if (!unitMats[key]) {
        unitMats[key] = std({ color: colors[st], roughness: 0.6, transparent: !!dim, opacity: dim ? 0.28 : 1, depthWrite: !dim });
      }
      return unitMats[key];
    }
    const plateMats = { slab: std({ color: 0xE9EAEC }), corridor: std({ color: 0xF7F7F5 }), shaft: std({ color: 0x41464F }) };
    let sel = null;            // { torre, andar }
    let filterType = 'todos';
    let hoverUnit = null, selUnit = null;
    const labelEls = [];

    function clearPlate(tw) {
      if (!tw.plate) return;
      tw.root.remove(tw.plate);
      tw.plate.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      tw.plate = null;
    }

    function buildPlate(tw, andar) {
      clearPlate(tw);
      const g = new THREE.Group(), y = andar * FH; tw.plate = g; tw.root.add(g);
      const b = function (mat, w, h, d, x, yy, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, yy, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
      b(plateMats.slab, L, 0.24, D, 0, y + 0.12, 0);
      b(plateMats.corridor, L - 0.4, 0.04, 1.6, 0, y + 0.26, 0);
      [-1, 1].forEach(function (s) {
        b(plateMats.shaft, CORE_W, FH, 5.9, 0, y + FH / 2, s * 4.05);              // elevadores (frente) e escada (fundos)
        b(plateMats.shaft, 2.2, FH * 0.9, 6.4, -16.9, y + FH * 0.45, s * 4.1);     // prumadas de serviço
        b(plateMats.shaft, 2.2, FH * 0.9, 6.4, 16.9, y + FH * 0.45, s * 4.1);
      });
      tw.units = [];
      for (let pos = 1; pos <= 12; pos++) {
        const r = unitRect(pos), st = statusOf(tw.T.id, andar, pos), tp = typeOf(pos);
        const dim = filterType !== 'todos' && tp !== filterType;
        const w = r.x1 - r.x0 - 0.24, d = r.z1 - r.z0 - 0.24;
        const m = b(unitMat(st, dim), w, 1.25, d, (r.x0 + r.x1) / 2, y + 0.24 + 0.625, (r.z0 + r.z1) / 2);
        m.userData = { unit: pos, torre: tw.T.id, andar: andar, status: st, tipo: tp, baseY: m.position.y };
        if (r.canto) {                                       // sacada do apto de canto
          const bx = r.k === 1 ? -HL + LOGGIA / 2 : HL - LOGGIA / 2, bz = r.front ? HD + 0.45 : -HD - 0.45;
          b(unitMat(st, dim), LOGGIA - 0.2, 0.5, 0.7, bx, y + 0.24 + 0.25, bz);
        }
        tw.units.push(m);
      }
    }

    function removeUnitPickables() {
      for (let i = pickables.length - 1; i >= 0; i--) if (pickables[i].userData.unit) pickables.splice(i, 1);
    }

    function setLabels(list) {
      labelsEl.textContent = '';
      labelEls.length = 0;
      list.forEach(function (it) {
        const el = document.createElement('button');
        el.type = 'button'; el.className = 'u-pill is-' + it.status + (it.dim ? ' is-dim' : '');
        el.textContent = it.num; el.setAttribute('aria-label', 'Apartamento ' + it.num);
        el.addEventListener('click', function () { if (opts.onPickUnit) opts.onPickUnit(it.pos); });
        labelsEl.appendChild(el);
        labelEls.push({ el: el, p: it.p });
      });
    }

    function towerLabels() {
      setLabels([]);
      TOWERS.forEach(function (T) {
        const el = document.createElement('button');
        el.type = 'button'; el.className = 't-pill'; el.textContent = 'Torre ' + T.id;
        el.addEventListener('click', function () { if (opts.onPickTower) opts.onPickTower(T.id); });
        labelsEl.appendChild(el);
        labelEls.push({ el: el, p: new THREE.Vector3(T.x, TOP + CORE_UP + 3, T.z) });
      });
    }

    function applySelection() {
      TOWERS.forEach(function (T) {
        const tw = towers[T.id], open = sel && sel.torre === T.id ? sel.andar : 0;
        tw.slices.forEach(function (m, lv) { m.visible = !open || lv < open; });
        tw.top.visible = !open;
        tw.balc.forEach(function (im) { im.count = open ? 4 * (open - 1) : 4 * FLOORS; });
        tw.ghost.children.slice().forEach(function (o) { tw.ghost.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        if (open) {
          const h = TOP + CROWN - (open + 1) * FH;
          const gm = new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, h, D + 0.2), new THREE.MeshBasicMaterial({ color: lin(colors.navy), transparent: true, opacity: 0.06, depthWrite: false }));
          gm.position.y = (open + 1) * FH + h / 2; tw.ghost.add(gm);
          const ge = new THREE.LineSegments(new THREE.EdgesGeometry(gm.geometry), new THREE.LineBasicMaterial({ color: lin(colors.navy), transparent: true, opacity: 0.45 }));
          ge.position.copy(gm.position); tw.ghost.add(ge);
          tw.ghost.visible = true;
          buildPlate(tw, open);
        } else {
          tw.ghost.visible = false;
          clearPlate(tw); tw.units = null;
        }
      });
      removeUnitPickables();
      if (sel) {
        const tw = towers[sel.torre];
        tw.units.forEach(function (m) { if (m.material.opacity === 1) pickables.push(m); });
        setLabels(tw.units.map(function (m) {
          const u = m.userData;
          return { pos: u.unit, num: String(sel.andar * 100 + u.unit), status: u.status, dim: m.material.opacity < 1, p: new THREE.Vector3(tw.T.x + m.position.x, m.position.y + 1.3, tw.T.z + m.position.z) };
        }));
        refreshUnitLook();
      } else {
        towerLabels();
      }
      dirty = true;
    }

    function refreshUnitLook() {
      if (!sel) return;
      towers[sel.torre].units.forEach(function (m) {
        const on = m.userData.unit === selUnit, hv = m.userData.unit === hoverUnit;
        m.position.y = m.userData.baseY + (on ? 0.55 : hv ? 0.28 : 0);
        m.scale.y = on ? 1.35 : 1;
      });
      labelEls.forEach(function (l, i) { l.el.classList.toggle('is-on', !!sel && (i + 1) === selUnit); });
      dirty = true;
    }

    /* ---------------- câmera ---------------- */
    const HOME = { target: new THREE.Vector3(0, 11, -6), r: 182, phi: 1.12, theta: 0.42 };
    let tween = null;
    function spherical(target, r, phi, theta) {
      return new THREE.Vector3(target.x + r * Math.sin(phi) * Math.sin(theta), target.y + r * Math.cos(phi), target.z + r * Math.sin(phi) * Math.cos(theta));
    }
    function fitR(r) { const a = camera.aspect; return a < 1.15 ? r * Math.min(2.1, 1.25 / Math.max(a, 0.45)) : r; }
    function flyTo(target, pos, ms) {
      if (reduceMotion || ms === 0) { controls.target.copy(target); camera.position.copy(pos); controls.update(); dirty = true; return; }
      tween = { t0: performance.now(), ms: ms || 1000, fromT: controls.target.clone(), toT: target.clone(), fromP: camera.position.clone(), toP: pos.clone() };
    }
    function currentTheta() { const v = camera.position.clone().sub(controls.target); return Math.atan2(v.x, v.z); }
    function goHome(ms) { flyTo(HOME.target, spherical(HOME.target, fitR(HOME.r), HOME.phi, HOME.theta), ms); }
    function goFloor(torre, andar, ms) {
      const T = towers[torre].T, tgt = new THREE.Vector3(T.x, andar * FH + 0.8, T.z);
      flyTo(tgt, spherical(tgt, fitR(80), 0.86, currentTheta()), ms);
    }

    /* ---------------- tema: dia (claro) e noite (escuro) ---------------- */
    let night = false;
    function setNight(on) {
      night = !!on;
      scene.background = night ? SKY.night.tex : SKY.day.tex;
      scene.fog.color.copy(lin(night ? SKY.night.fog : SKY.day.fog));
      hemi.intensity = night ? 0.16 : 0.72;
      hemi.color.setHex(night ? 0x7C8CC4 : 0xE4EEF8);
      sun.intensity = night ? 0.22 : 1.25;
      sun.color.setHex(night ? 0x9FB2FF : 0xFFF2DE);
      amb.intensity = night ? 0.22 : 0;
      facadeMats.forEach(function (m) { m.emissiveIntensity = night ? 1.35 : 0.62; });
      M.gold.emissiveIntensity = night ? 0.55 : 0;
      lamps.forEach(function (l) { l.intensity = night ? 1.6 : 0; });
      renderer.toneMappingExposure = night ? 1.12 : 1.02;
      dirty = true;
    }

    /* ---------------- interação ---------------- */
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let hoverFloor = null, down = null, dirty = true, interacted = false;
    function pick(cx, cy) {
      const r = cv.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickables, false).filter(function (h) { return h.object.visible; })[0];
      return hit ? hit.object.userData : null;
    }
    function setHoverFloor(info) {
      const key = info ? info.torre + info.andar : null, prev = hoverFloor ? hoverFloor.torre + hoverFloor.andar : null;
      if (key === prev) return;
      hoverFloor = info;
      TOWERS.forEach(function (T) { towers[T.id].hl.visible = false; });
      if (info) { const tw = towers[info.torre]; tw.hl.position.y = info.andar * FH + FH / 2; tw.hl.visible = true; }
      dirty = true;
    }
    cv.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'touch' || down && down.moved) return;
      const u = pick(ev.clientX, ev.clientY);
      if (u && u.unit) {
        setHoverFloor(null);
        if (hoverUnit !== u.unit) { hoverUnit = u.unit; refreshUnitLook(); }
        cv.style.cursor = 'pointer';
        if (opts.onHover) opts.onHover({ unit: u.unit, torre: u.torre, andar: u.andar, status: u.status, tipo: u.tipo }, ev.clientX, ev.clientY);
      } else {
        if (hoverUnit) { hoverUnit = null; refreshUnitLook(); }
        setHoverFloor(u && !(sel && sel.torre === u.torre && u.andar >= sel.andar) ? u : null);
        cv.style.cursor = hoverFloor ? 'pointer' : '';
        if (opts.onHover) opts.onHover(hoverFloor, ev.clientX, ev.clientY);
      }
    });
    cv.addEventListener('pointerleave', function () { setHoverFloor(null); if (hoverUnit) { hoverUnit = null; refreshUnitLook(); } if (opts.onHover) opts.onHover(null); });
    cv.addEventListener('pointerdown', function (ev) { down = { x: ev.clientX, y: ev.clientY, t: performance.now(), moved: false }; });
    cv.addEventListener('pointerup', function (ev) {
      if (!down) return;
      const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 7, quick = performance.now() - down.t < 600;
      down = null;
      if (moved || !quick) return;
      const u = pick(ev.clientX, ev.clientY);
      if (!u) return;
      if (u.unit) { if (opts.onPickUnit) opts.onPickUnit(u.unit); }
      else if (opts.onPickFloor) opts.onPickFloor(u.torre, u.andar);
    });
    cv.addEventListener('pointermove', function (ev) { if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 7) down.moved = true; });
    controls.addEventListener('start', function () { interacted = true; controls.autoRotate = false; tween = null; });
    controls.addEventListener('change', function () { dirty = true; });

    /* ---------------- laço ---------------- */
    let visible = true, raf = 0, paused = false;
    const tmp = new THREE.Vector3();
    function placeLabels() {
      const r = cv.getBoundingClientRect(), w = r.width, h = r.height;
      labelEls.forEach(function (l) {
        tmp.copy(l.p).project(camera);
        const off = tmp.z > 1 || tmp.x < -1.1 || tmp.x > 1.1 || tmp.y < -1.1 || tmp.y > 1.1;
        l.el.style.visibility = off ? 'hidden' : 'visible';
        if (!off) l.el.style.transform = 'translate(-50%,-50%) translate(' + ((tmp.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - tmp.y) / 2 * h).toFixed(1) + 'px)';
      });
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!visible || paused) return;
      if (tween) {
        const k = Math.min(1, (now - tween.t0) / tween.ms), e = easeInOut(k);
        controls.target.lerpVectors(tween.fromT, tween.toT, e);
        camera.position.lerpVectors(tween.fromP, tween.toP, e);
        if (k >= 1) tween = null;
        dirty = true;
      }
      const moving = controls.update();
      if (controls.autoRotate) dirty = true;
      if (!dirty && !moving) return;
      dirty = false;
      renderer.render(scene, camera);
      placeLabels();
    }
    function resize() {
      const r = host.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      dirty = true;
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting && !document.hidden; dirty = true; }).observe(host);
    document.addEventListener('visibilitychange', function () { visible = !document.hidden; dirty = true; });

    resize();
    goHome(0);
    setNight(!!opts.night);
    towerLabels();
    raf = requestAnimationFrame(frame);

    return {
      selectFloor: function (torre, andar, fly) {
        sel = { torre: torre, andar: andar }; selUnit = null; hoverUnit = null;
        setHoverFloor(null); controls.autoRotate = false;
        applySelection();
        if (fly !== false) goFloor(torre, andar, 1100);
      },
      clearFloor: function () {
        sel = null; selUnit = null; hoverUnit = null;
        applySelection();
        goHome(1100);
      },
      selectUnit: function (pos) { selUnit = pos; refreshUnitLook(); },
      setFilter: function (t) { filterType = t; if (sel) { const keep = selUnit; applySelection(); selUnit = keep; refreshUnitLook(); } },
      setNight: setNight,
      setColors: function (c) {
        Object.assign(colors, c);
        Object.keys(unitMats).forEach(function (k) { const st = k.replace('-dim', ''); if (colors[st]) unitMats[k].color.copy(lin(colors[st])); });
        TOWERS.forEach(function (T) { towers[T.id].hlBox.material.color.copy(lin(colors.gold)); towers[T.id].hlEdge.material.color.copy(lin(colors.gold)); });
        if (sel) applySelection();
        dirty = true;
      },
      home: function () { goHome(900); },
      focusUnit: function (pos, ms) {
        if (!sel) return;
        const T = towers[sel.torre].T, r = unitRect(pos);
        const tgt = new THREE.Vector3(T.x + (r.x0 + r.x1) / 2, sel.andar * FH + 1.0, T.z + (r.z0 + r.z1) / 2);
        flyTo(tgt, spherical(tgt, fitR(19), 1.02, r.front ? 0.18 : Math.PI + 0.18), ms === undefined ? 900 : ms);
      },
      setPaused: function (p) { paused = !!p; dirty = true; },
      interacted: function () { return interacted; },
      FH: FH, unitRect: unitRect, L: L, D: D, LOGGIA: LOGGIA
    };
  }

  window.Predio3D = { create: create, unitRect: unitRect, FH: FH, L: L, D: D, LOGGIA: LOGGIA };
})();
