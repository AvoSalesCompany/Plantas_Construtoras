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
  // profundidade: apto de canto (7,15 m com o hall de entrada) + corredor + apto de canto; os de meio (6,45 m) deixam o corredor mais largo
  const L = 53.2, D = 15.6, HL = L / 2, HD = D / 2;
  const CORR = 1.35;               // meia largura do corredor na frente dos aptos de meio (fachada a 7,8 m, apto de 6,45 m)
  const FLOOR_UP = 0.3;            // piso acabado dos apartamentos acima da laje do andar
  const CEIL = 2.5;                // forro dos apartamentos e do corredor (pé-direito da maquete)
  const TOP = LEVELS * FH;         // laje de cobertura
  const CROWN = 1.3, CORE_UP = 3.8, CORE_W = 3.6, CORE_D = 6;
  const PXM = 38;                  // pixels por metro nas texturas de fachada
  const ROW = Math.round(FH * PXM);

  // trechos da fachada comprida, da esquerda (-x) para a direita (+x); larguras tiradas das plantas oficiais:
  // apto de canto (com sacada) 7,7 m, apto de meio (sem sacada) 7,8 m, poço de ventilação 1,5 m, núcleo de elevadores e escada 3,6 m
  const BAYS = [
    ['canto', -26.6, -18.9, 'L'], ['faixa', -18.9, -17.4], ['meio', -17.4, -9.6, 'L'], ['meio', -9.6, -1.8, 'L'],
    ['nucleo', -1.8, 1.8], ['meio', 1.8, 9.6, 'L'], ['meio', 9.6, 17.4, 'L'], ['faixa', 17.4, 18.9], ['canto', 18.9, 26.6, 'R']
  ];
  const UNIT_X = { 1: [-26.6, -18.9], 2: [-17.4, -9.6], 3: [-9.6, -1.8], 4: [1.8, 9.6], 5: [9.6, 17.4], 6: [18.9, 26.6] };
  const LOGGIA = 2.4, LOGGIA_IN = 0.1;   // sacada do apto de canto (2,36 m na planta), a 10 cm da ponta

  // posição no andar (1–12) -> retângulo em planta, no sistema da torre
  function unitRect(pos) {
    const front = pos <= 6;
    const k = front ? pos : 13 - pos;            // o 7 fica atrás do 6, o 12 atrás do 1
    const x = UNIT_X[k];
    return { x0: x[0], x1: x[1], z0: front ? CORR : -HD, z1: front ? HD : -CORR, front: front, canto: k === 1 || k === 6, k: k };
  }

  // medidas reais da planta (m) e onde ela fica na torre: centrada na largura do apto e encostada na fachada
  function planDims(tipo) {
    const P = window.PLANS && window.PLANS[tipo];
    if (!P) return null;
    return { w: (P.extent[0] - P.origin[0]) / P.scale, d: (P.extent[1] - P.origin[1]) / P.scale, P: P };
  }
  // da maquete (x, z em metros, centro da planta, fachada para -z) para a torre: gira 180° na frente e espelha dois cantos
  function unitPlace(pos, tipo) {
    const r = unitRect(pos), pose = planPose(pos), dm = planDims(tipo) || { w: r.x1 - r.x0, d: r.z1 - r.z0 };
    const sx = (pose.front ? -1 : 1) * (pose.mirror ? -1 : 1), sz = pose.front ? -1 : 1;
    return { cx: (r.x0 + r.x1) / 2, cz: pose.front ? HD - dm.d / 2 : -HD + dm.d / 2, w: dm.w, d: dm.d, sx: sx, sz: sz, front: pose.front, mirror: pose.mirror };
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
    const z = bay[2];
    if (t === 'meio') return [[a + 1.35, 1.5], [a + 3.89, 1.2], [a + 6.44, 1.2]];                       // sala, dorm. 2, dorm. 1
    if (t === 'canto' && bay[3] === 'L') return [[a + 3.8, 1.24], [a + 6.3, 1.25]];                     // dorm. 2, dorm. 1 (a sacada fica na ponta)
    if (t === 'canto') return [[z - 3.8, 1.24], [z - 6.3, 1.25]];
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
          const lx0 = b[3] === 'L' ? b[1] + LOGGIA_IN : b[2] - LOGGIA_IN - LOGGIA, lx1 = lx0 + LOGGIA;
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

  /* ---------------- plantas oficiais recortadas pelo contorno do apartamento ---------------- */
  // usa os dados das plantas da maquete (apartamento/planta-*.js): imagem, contorno e origem em px
  const planCache = {};
  function planCanvas(tipo, cb) {
    const P = window.PLANS && window.PLANS[tipo];
    if (!P || typeof Image === 'undefined') { cb(null); return; }
    const ent = planCache[tipo];
    if (ent) { if (ent.c || ent.fail) cb(ent.c); else ent.wait.push(cb); return; }
    const e = planCache[tipo] = { c: null, fail: false, wait: [cb] };
    const img = new Image();
    img.onload = function () {
      const ox = P.origin[0], oy = P.origin[1], w = P.extent[0] - ox, h = P.extent[1] - oy;
      const c = canvas(w, h), g = c.getContext('2d');
      g.beginPath();
      P.outline.forEach(function (p, i) { if (i) g.lineTo(p[0] - ox, p[1] - oy); else g.moveTo(p[0] - ox, p[1] - oy); });
      g.closePath(); g.clip();
      g.drawImage(img, -ox, -oy);
      e.c = c; e.wait.splice(0).forEach(function (f) { f(c); });
    };
    img.onerror = function () { e.fail = true; e.wait.splice(0).forEach(function (f) { f(null); }); };
    img.src = 'apartamento/' + P.meta.img;
  }
  // paredes da planta para a maquete do andar aberto: corte a 1,25 m, vãos de porta abertos, janelas na altura do peitoril
  const WALL_CUT = 1.25, wallCache = {};
  function planWalls(tipo) {
    if (wallCache[tipo]) return wallCache[tipo];
    const P = window.PLANS && window.PLANS[tipo], out = [];
    if (!P) return out;
    const ox = P.origin[0], oy = P.origin[1], W = P.extent[0] - ox, H = P.extent[1] - oy;
    const push = function (x0, y0, x1, y1, h) { if (x1 - x0 > 0.5 && y1 - y0 > 0.5 && h > 0.01) out.push({ u0: (x0 - ox) / W, v0: (y0 - oy) / H, u1: (x1 - ox) / W, v1: (y1 - oy) / H, h: h }); };
    P.walls.forEach(function (w) {
      const x1 = w.r[0], y1 = w.r[1], x2 = w.r[2], y2 = w.r[3], horiz = (x2 - x1) >= (y2 - y1);
      const seg = function (a, b, h) { if (horiz) push(a, y1, b, y2, h); else push(x1, a, x2, b, h); };
      let cur = horiz ? x1 : y1;
      (w.open || []).slice().sort(function (p, q) { return p.a - q.a; }).forEach(function (o) {
        seg(cur, o.a, WALL_CUT);
        if (o.kind === 'win') seg(o.a, o.b, Math.min(P.windows[o.win].sill, WALL_CUT));
        cur = o.b;
      });
      seg(cur, horiz ? x2 : y2, WALL_CUT);
    });
    if (P.shaft) push(P.shaft[0], P.shaft[1], P.shaft[2], P.shaft[3], WALL_CUT);
    wallCache[tipo] = out;
    return out;
  }

  // como a planta é vista de cima em cada posição: a fachada (topo da imagem) fica para fora e, nos aptos de canto,
  // a sacada fica na ponta do prédio (dois dos quatro cantos são o espelho da planta); os de meio só giram, sem espelhar
  function planPose(pos) {
    const r = unitRect(pos), cx = (r.x0 + r.x1) / 2;
    return { front: r.front, mirror: r.canto && (r.front ? cx > 0 : cx < 0) };
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
    let dirty = true;                // algo mudou: desenhar de novo (declarado antes de tudo: a planta em cache chama de volta na hora)

    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;          // a sombra é refeita quando a cena é desenhada (e a maquete do apto controla a dela)
    renderer.localClippingEnabled = true;
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
        const bxL = -HL + LOGGIA_IN + LOGGIA / 2, bxR = HL - LOGGIA_IN - LOGGIA / 2;
        [[bxL, 1], [bxR, 1], [bxL, -1], [bxR, -1]].forEach(function (b) {
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
    const PLAN_TINT = { livre: 0xFFFFFF, reservado: 0x272C37, vendido: 0x272C37 };
    // maquete de cada apartamento no andar aberto: paredes e móveis em 3D (instanciados: poucas chamadas de desenho por apto)
    const miniMats = {
      on: std({ color: 0xFFFFFF, roughness: 0.82, emissive: new THREE.Color(0xFFDDB0), emissiveIntensity: 0.12 }),
      off: std({ color: 0xFFFFFF, roughness: 0.92 }),
      onDim: std({ color: 0xFFFFFF, roughness: 0.82, transparent: true, opacity: 0.25, depthWrite: false }),
      offDim: std({ color: 0xFFFFFF, roughness: 0.92, transparent: true, opacity: 0.25, depthWrite: false })
    };
    const miniBox = new THREE.BoxGeometry(1, 1, 1), miniCyl = new THREE.CylinderGeometry(1, 1, 1, 18);
    const OFF_COLOR = new THREE.Color(0x1C2029), WALL_COLOR = '#F3F1EC';
    function miniColor(hex, lit) { const c = new THREE.Color(hex); if (!lit) c.lerp(OFF_COLOR, 0.8); return c.convertSRGBToLinear(); }
    function miniModel(parent, tipo, w, d, lit, dim) {
      const P = window.PLANS && window.PLANS[tipo]; if (!P) return;
      const ox = P.origin[0], oy = P.origin[1], W = P.extent[0] - ox, H = P.extent[1] - oy;
      const X = function (px) { return ((px - ox) / W - 0.5) * w; }, Z = function (py) { return ((py - oy) / H - 0.5) * d; };
      const items = [], rounds = [];
      planWalls(tipo).forEach(function (q) {
        items.push([((q.u0 + q.u1) / 2 - 0.5) * w, ((q.v0 + q.v1) / 2 - 0.5) * d, Math.max(0.02, (q.u1 - q.u0) * w), Math.max(0.02, (q.v1 - q.v0) * d), 0, q.h, WALL_COLOR]);
      });
      ((P.mini && P.mini.box) || []).forEach(function (b) {
        const h0 = b[4], h1 = Math.min(b[5], WALL_CUT);
        if (h1 - h0 > 0.004) items.push([(X(b[0]) + X(b[2])) / 2, (Z(b[1]) + Z(b[3])) / 2, Math.abs(X(b[2]) - X(b[0])), Math.abs(Z(b[3]) - Z(b[1])), h0, h1, b[6]]);
      });
      ((P.mini && P.mini.cyl) || []).forEach(function (c) {
        const h0 = c[4], h1 = Math.min(c[5], WALL_CUT);
        if (h1 - h0 > 0.004) rounds.push([X(c[0]), Z(c[1]), c[2] / W * w, c[3] / H * d, h0, h1, c[6]]);
      });
      const mat = miniMats[(lit ? 'on' : 'off') + (dim ? 'Dim' : '')];
      [[items, miniBox], [rounds, miniCyl]].forEach(function (set) {
        const list = set[0]; if (!list.length) return;
        const im = new THREE.InstancedMesh(set[1], mat, list.length);
        list.forEach(function (it, i) {
          dm.rotation.set(0, 0, 0);
          dm.position.set(it[0], 0.016 + (it[4] + it[5]) / 2, it[1]);
          dm.scale.set(it[2], it[5] - it[4], it[3]);
          dm.updateMatrix(); im.setMatrixAt(i, dm.matrix);
          im.setColorAt(i, miniColor(it[6], lit));
        });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = lit && !dim; im.receiveShadow = true;
        parent.add(im);
      });
    }
    const planTex = {}, planMats = {};
    ['sem-sacada', 'com-sacada'].forEach(function (tipo) {
      planCanvas(tipo, function (c) {
        if (!c) return;
        const t = tex(c); planTex[tipo] = t;
        Object.keys(planMats).forEach(function (k) { if (k.indexOf(tipo) === 0) { planMats[k].map = t; planMats[k].needsUpdate = true; } });
        dirty = true;
      });
    });
    function planMat(tipo, st, dim) {
      const key = tipo + '|' + st + (dim ? '|dim' : '');
      if (!planMats[key]) {
        planMats[key] = new THREE.MeshBasicMaterial({ map: planTex[tipo] || null, color: lin(PLAN_TINT[st]), transparent: true, alphaTest: 0.02,
          opacity: dim ? 0.25 : 1, depthWrite: !dim, side: THREE.DoubleSide, toneMapped: false });
      }
      return planMats[key];
    }
    let sel = null;            // { torre, andar }
    let apt = null;            // visita a um apartamento: { pos, view, ceil, door } (a maquete desenha a cena)
    let shadowDirty = true;
    let filterType = 'todos';
    let hoverUnit = null, selUnit = null;
    const labelEls = [];

    function clearPlate(tw) {
      if (!tw.plate) return;
      tw.root.remove(tw.plate);
      tw.plate.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      tw.plate = null; tw.corr = null;
    }

    function buildPlate(tw, andar) {
      clearPlate(tw);
      const g = new THREE.Group(), y = andar * FH; tw.plate = g; tw.root.add(g);
      const b = function (mat, w, h, d, x, yy, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, yy, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
      b(plateMats.slab, L, 0.24, D, 0, y + 0.12, 0);
      b(plateMats.corridor, L - 0.4, 0.04, 2 * CORR + 0.3, 0, y + 0.26, 0);
      const coreD = HD - 0.5 - CORR, faixaD = HD - 0.3 - CORR;
      [-1, 1].forEach(function (s) {
        b(plateMats.shaft, CORE_W, FH * 0.55, coreD, 0, y + FH * 0.275, s * (CORR + coreD / 2));       // elevadores (frente) e escada (fundos)
        b(plateMats.shaft, 1.5, FH * 0.45, faixaD, -18.15, y + FH * 0.225, s * (CORR + faixaD / 2));   // poços de ventilação
        b(plateMats.shaft, 1.5, FH * 0.45, faixaD, 18.15, y + FH * 0.225, s * (CORR + faixaD / 2));
      });
      tw.units = [];
      for (let pos = 1; pos <= 12; pos++) {
        const st = statusOf(tw.T.id, andar, pos), tp = typeOf(pos), pl = unitPlace(pos, tp);
        const dim = filterType !== 'todos' && tp !== filterType;
        // a maquete fica no tamanho real da planta, no mesmo lugar onde a visita 3D abre o apartamento
        const w = pl.w, d = pl.d;
        const ug = new THREE.Group(); ug.position.set(pl.cx, y + FLOOR_UP, pl.cz); g.add(ug);
        const wrap = new THREE.Group(); if (pl.front) wrap.rotation.y = Math.PI; ug.add(wrap);
        const inner = new THREE.Group(); if (pl.mirror) inner.scale.x = -1; wrap.add(inner);
        // piso na cor da disponibilidade, no contorno da planta (o hall do apto de canto não invade o corredor)
        const base = new THREE.Mesh(outlineGeo(tp, w, d), unitMat(st, dim)); base.position.y = 0.01; base.receiveShadow = true; inner.add(base);
        const plan = new THREE.Mesh(new THREE.PlaneGeometry(w, d), planMat(tp, st, dim));
        plan.rotation.x = -Math.PI / 2; plan.position.y = 0.016; plan.renderOrder = 2;
        inner.add(plan);
        // maquete do apartamento: paredes e móveis da planta em 3D (acesos se disponível, apagados se reservado ou vendido)
        miniModel(inner, tp, w, d, st === 'livre', dim);
        const info = { unit: pos, torre: tw.T.id, andar: andar, status: st, tipo: tp, dim: dim, baseY: ug.position.y, base: base, plan: plan,
          front: pl.front, half: d / 2 };
        base.userData = info; plan.userData = info; ug.userData = info;
        tw.units.push(ug);
      }
      if (apt && sel && sel.torre === tw.T.id) buildCorridor(tw, andar, apt.pos);
    }

    function outlineGeo(tipo, w, d) {
      const P = window.PLANS && window.PLANS[tipo];
      if (!P || !P.outline) return new THREE.BoxGeometry(w, 0.12, d).translate(0, -0.06, 0);
      const S = P.scale, ox = P.origin[0], oy = P.origin[1], sh = new THREE.Shape();
      P.outline.forEach(function (p, i) { const x = (p[0] - ox) / S - w / 2, z = (p[1] - oy) / S - d / 2; if (i) sh.lineTo(x, z); else sh.moveTo(x, z); });
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);                      // deitado: o contorno no plano do chão, 12 cm de espessura para baixo
      return geo;
    }

    /* ---------------- corredor do andar (aparece quando se visita um apartamento) ----------------
       Paredes do corredor pelo contorno de cada apto (o apto de canto tem um hall que avança), portas dos vizinhos com o número,
       portas dos elevadores e da escada, forro e luzes. Tudo em metros, no sistema da torre. */
    // texturas do corredor, desenhadas em canvas: mesma linguagem das áreas comuns da Baliza (render "Acesso" e salão de festas do Milão):
    // porcelanato claro, parede creme, porta de madeira, azul-marinho e dourado da marca, sinalização de incêndio
    const CT = (function () {
      const rep = function (t, rx, ry) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
      const R = rng(808);
      const parede = canvas(4, 256), gp = parede.getContext('2d'), gr = gp.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#DCD8D0'); gr.addColorStop(0.05, '#FFFFFF'); gr.addColorStop(0.82, '#FFFFFF'); gr.addColorStop(1, '#D6D1C8');
      gp.fillStyle = gr; gp.fillRect(0, 0, 4, 256);
      const piso = canvas(256, 256), pp = piso.getContext('2d');
      pp.fillStyle = '#DAD6CE'; pp.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) { pp.fillStyle = R() < 0.5 ? 'rgba(120,110,95,.06)' : 'rgba(255,255,255,.10)'; pp.fillRect(R() * 256, R() * 256, 2 + R() * 9, 1 + R() * 5); }
      pp.fillStyle = '#B5AEA2'; pp.fillRect(0, 253, 256, 3); pp.fillRect(253, 0, 3, 256);
      const madeira = canvas(128, 512), mp = madeira.getContext('2d');
      mp.fillStyle = '#A9784B'; mp.fillRect(0, 0, 128, 512);
      for (let x = 0; x < 128; x += 1) { const k = Math.sin(x * 0.37) * 0.5 + Math.sin(x * 1.7 + 2) * 0.3 + (R() - 0.5) * 0.6; mp.fillStyle = k > 0 ? 'rgba(70,40,18,' + (0.10 * k).toFixed(3) + ')' : 'rgba(255,225,180,' + (-0.08 * k).toFixed(3) + ')'; mp.fillRect(x, 0, 1, 512); }
      for (let i = 0; i < 40; i++) { mp.strokeStyle = 'rgba(80,46,20,.12)'; mp.lineWidth = 1 + R(); const x = R() * 128; mp.beginPath(); mp.moveTo(x, 0); mp.bezierCurveTo(x + (R() - 0.5) * 14, 170, x + (R() - 0.5) * 14, 340, x + (R() - 0.5) * 10, 512); mp.stroke(); }
      const inox = canvas(64, 256), ip = inox.getContext('2d');
      ip.fillStyle = '#B7BCC2'; ip.fillRect(0, 0, 64, 256);
      for (let x = 0; x < 64; x++) { ip.fillStyle = 'rgba(' + (R() < 0.5 ? '255,255,255' : '40,46,54') + ',' + (0.05 + R() * 0.08).toFixed(3) + ')'; ip.fillRect(x, 0, 1, 256); }
      const veneziana = canvas(128, 256), vp = veneziana.getContext('2d');
      vp.fillStyle = '#F2F1EE'; vp.fillRect(0, 0, 128, 256);
      for (let y = 18; y < 230; y += 9) { vp.fillStyle = 'rgba(60,64,72,.22)'; vp.fillRect(10, y, 108, 3); vp.fillStyle = 'rgba(255,255,255,.8)'; vp.fillRect(10, y + 3, 108, 1); }
      vp.fillStyle = '#3A3F49'; vp.font = '600 15px Archivo, Arial, sans-serif'; vp.textAlign = 'center'; vp.fillText('MEDIDORES', 64, 248);
      const capacho = canvas(128, 96), cp = capacho.getContext('2d');
      cp.fillStyle = '#34363B'; cp.fillRect(0, 0, 128, 96);
      for (let i = 0; i < 700; i++) { cp.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.06)'; cp.fillRect(R() * 128, R() * 96, 1.5, 1.5); }
      cp.strokeStyle = 'rgba(255,255,255,.12)'; cp.lineWidth = 4; cp.strokeRect(8, 8, 112, 80);
      const luz = canvas(128, 128), lp = luz.getContext('2d'), lg = lp.createRadialGradient(64, 64, 0, 64, 64, 64);
      lg.addColorStop(0, 'rgba(255,236,200,1)'); lg.addColorStop(0.45, 'rgba(255,236,200,.35)'); lg.addColorStop(1, 'rgba(255,236,200,0)');
      lp.fillStyle = lg; lp.fillRect(0, 0, 128, 128);
      const placa = function (w, h, draw) { const c = canvas(w, h), g = c.getContext('2d'); draw(g, w, h); return tex(c); };
      return {
        parede: tex(parede), piso: rep(tex(piso), (L - 0.4) / 0.6, 3.24 / 0.6), madeira: tex(madeira), inox: tex(inox), veneziana: tex(veneziana),
        capacho: tex(capacho), luz: tex(luz, false), placa: placa
      };
    })();
    const corrMats = {
      wall: std({ color: 0xF3EEE5, map: CT.parede, roughness: 0.92 }),
      navy: std({ color: 0x22318A, roughness: 0.85 }),
      ceil: std({ color: 0xF4F3EF, roughness: 0.95, emissive: 0xE9E6DF, emissiveIntensity: 0.32 }),
      floor: std({ map: CT.piso, roughness: 0.36, metalness: 0.02 }),
      hall: std({ color: 0x4A4E55, roughness: 0.32 }),
      skirting: std({ color: 0x77726A, roughness: 0.5 }),
      door: std({ map: CT.madeira, roughness: 0.55 }),
      frame: std({ color: 0xF2F0EB, roughness: 0.6 }),
      fireDoor: std({ color: 0x5A5F67, roughness: 0.55 }),
      steel: std({ map: CT.inox, roughness: 0.38, metalness: 0.25 }), dark: std({ color: 0x2B2F36, roughness: 0.6 }),
      handle: std({ color: 0xC9CDD2, roughness: 0.35, metalness: 0.3 }),
      white: std({ color: 0xF5F5F2, roughness: 0.5 }),
      red: std({ color: 0xC0262D, roughness: 0.4 }),
      louver: std({ map: CT.veneziana, roughness: 0.6 }),
      mat: std({ map: CT.capacho, roughness: 0.98 }),
      lamp: new THREE.MeshBasicMaterial({ color: lin(0xFFF3DE) }),
      amber: new THREE.MeshBasicMaterial({ color: lin(0xFFB547) }),
      pool: new THREE.MeshBasicMaterial({ map: CT.luz, color: lin(0xFFE9C7), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
      sky: new THREE.MeshBasicMaterial({ color: lin(0xDCE9F4) })
    };
    // placas: número do apto, número do andar, direção, saída, extintor, hidrante, escada, indicador do elevador
    const signMats = {};
    function sign(key, w, h, draw, basic) {
      if (!signMats[key]) {
        const t = CT.placa(w, h, draw);
        signMats[key] = basic ? new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.05 }) : std({ map: t, roughness: 0.5, transparent: true, alphaTest: 0.05 });
      }
      return signMats[key];
    }
    const FONT = 'Archivo, Arial, sans-serif', MONO = '"IBM Plex Mono", Menlo, monospace';
    function numberTex(n) {
      return sign('n' + n, 128, 64, function (g) {
        g.fillStyle = '#22318A'; g.fillRect(0, 0, 128, 64);
        g.fillStyle = '#E2B444'; g.font = '600 38px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 34);
      });
    }
    const corrLights = [0, 1, 2].map(function () { const l = new THREE.PointLight(0xFFEBD0, 0, 10, 2); scene.add(l); return l; });
    // retângulo da maquete (x0, z0, x1, z1 em metros da planta) -> retângulo na torre
    function toTower(pl, x0, z0, x1, z1) {
      const ax = pl.cx + pl.sx * x0, bx = pl.cx + pl.sx * x1, az = pl.cz + pl.sz * z0, bz = pl.cz + pl.sz * z1;
      return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)];
    }
    // Z: a face do corredor fica 12 mm para fora da parede da planta, para não brigar com as paredes da miniatura do vizinho
    function corridorPlan(pos) {
      const tp = typeOf(pos), dm = planDims(tp); if (!dm) return null;
      const P = dm.P, S = P.scale, ox = P.origin[0], oy = P.origin[1];
      return { tp: tp, P: P, pl: unitPlace(pos, tp), X: function (px) { return (px - ox) / S - dm.w / 2; }, Z: function (py) { return (py - oy) / S - dm.d / 2 + 0.012; } };
    }
    function buildCorridor(tw, andar, own) {
      const y0 = andar * FH + 0.28, hgt = FLOOR_UP - 0.28 + CEIL, T = 0.12;
      const grp = new THREE.Group(); grp.visible = false; tw.plate.add(grp);
      const ceilG = new THREE.Group(); ceilG.visible = false; grp.add(ceilG);
      const solids = [];                     // retângulos de colisão (na torre)
      const rodape = [];                     // rodapés (instanciados no fim)
      const box = function (mat, r, h0, h1, parent, solid, shadow) {
        if (solid !== false) r = [r[0] - 0.012, r[1], r[2] + 0.012, r[3]];
        const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.005, r[2] - r[0]), h1 - h0, Math.max(0.005, r[3] - r[1])), mat);
        m.position.set((r[0] + r[2]) / 2, y0 + (h0 + h1) / 2, (r[1] + r[3]) / 2);
        m.castShadow = shadow !== undefined ? shadow : solid !== false; m.receiveShadow = true;
        (parent || grp).add(m);
        if (solid !== false) solids.push(r);
        return m;
      };
      // placa plana encostada numa parede: n = normal para o corredor ('+z', '-z', '+x', '-x'), centro (x, z), altura y0..y1
      const panel = function (mat, x, z, w, h0, h1, n, parent) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h1 - h0), mat);
        m.rotation.y = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[n];
        m.position.set(x, y0 + (h0 + h1) / 2, z); (parent || grp).add(m);
        return m;
      };
      // ---------- paredes dos aptos voltadas para o corredor, portas dos vizinhos ----------
      for (let pos = 1; pos <= 12; pos++) {
        const cp = corridorPlan(pos); if (!cp || !cp.P.corredor) continue;
        const segs = pos === own ? (cp.P.corredor.fecha || []) : cp.P.corredor.linha;
        segs.forEach(function (sg, i) {
          const zf = cp.Z(sg[2]);
          box(corrMats.wall, toTower(cp.pl, cp.X(sg[0]), zf - T, cp.X(sg[1]), zf), 0, hgt);
          const nx = segs[i + 1];
          if (pos !== own && nx && Math.abs(nx[2] - sg[2]) > 1) {       // degrau entre dois trechos (lateral do hall)
            const zn = cp.Z(nx[2]), xj = cp.X(nx[0]);
            box(corrMats.wall, toTower(cp.pl, xj - T / 2, Math.min(zf, zn) - T, xj + T / 2, Math.max(zf, zn)), 0, hgt);
          }
        });
        if (pos === own) continue;
        const w = cp.P.walls.find(function (q) { return (q.open || []).some(function (o) { return o.door === 'entrada'; }); });
        if (!w) continue;
        const o = w.open.find(function (q) { return q.door === 'entrada'; }), zf = cp.Z(Math.max(w.r[1], w.r[3]));
        const A = cp.X(o.a), B = cp.X(o.b), mid = (A + B) / 2, hingeA = cp.P.doors.entrada.hinge === 'a';
        // porta de madeira, batente branco, maçaneta de alavanca, olho mágico, número do apto em cima
        box(corrMats.door, toTower(cp.pl, A + 0.04, zf - 0.01, B - 0.04, zf + 0.035), 0, 2.08, grp, false, false);
        box(corrMats.frame, toTower(cp.pl, A - 0.03, zf - 0.005, A + 0.04, zf + 0.045), 0, 2.15, grp, false, false);
        box(corrMats.frame, toTower(cp.pl, B - 0.04, zf - 0.005, B + 0.03, zf + 0.045), 0, 2.15, grp, false, false);
        box(corrMats.frame, toTower(cp.pl, A - 0.03, zf - 0.005, B + 0.03, zf + 0.045), 2.08, 2.15, grp, false, false);
        const hx = hingeA ? B - 0.12 : A + 0.12, hs = hingeA ? -1 : 1;
        box(corrMats.handle, toTower(cp.pl, hx - 0.025, zf + 0.035, hx + 0.025, zf + 0.05), 0.97, 1.07, grp, false, false);
        box(corrMats.handle, toTower(cp.pl, Math.min(hx, hx + hs * 0.13), zf + 0.05, Math.max(hx, hx + hs * 0.13), zf + 0.07), 1.01, 1.03, grp, false, false);
        box(corrMats.dark, toTower(cp.pl, mid - 0.012, zf + 0.035, mid + 0.012, zf + 0.045), 1.5, 1.524, grp, false, false);
        box(numberTex(andar * 100 + pos), toTower(cp.pl, mid - 0.11, zf, mid + 0.11, zf + 0.012), 2.22, 2.33, grp, false, false);
        // interruptor de minuteria (luz do corredor) do lado da fechadura
        const sx = cp.X(o.b + 16);
        box(corrMats.white, toTower(cp.pl, sx - 0.04, zf, sx + 0.04, zf + 0.012), 1.16, 1.27, grp, false, false);
        box(corrMats.amber, toTower(cp.pl, sx - 0.006, zf + 0.012, sx + 0.006, zf + 0.016), 1.235, 1.247, grp, false, false);
        // capacho na frente de algumas portas
        if (((pos * 37 + andar * 11) % 5) < 3) box(corrMats.mat, toTower(cp.pl, mid - 0.32, zf + 0.06, mid + 0.32, zf + 0.46), 0.012, 0.024, grp, false, false);
      }
      // ---------- poços de ventilação (com o armário dos medidores) e núcleo ----------
      [[-18.9, -17.4], [-1.8, 1.8], [17.4, 18.9]].forEach(function (xr) {
        [-1, 1].forEach(function (s) {
          const nucleoFrente = s > 0 && xr[0] === -1.8;
          box(nucleoFrente ? corrMats.navy : corrMats.wall, s > 0 ? [xr[0], CORR - 0.012, xr[1], CORR + T] : [xr[0], -CORR - T, xr[1], -CORR + 0.012], 0, hgt);
          if (xr[0] !== -1.8) {                                         // porta veneziana dos medidores de água e gás
            const xc = (xr[0] + xr[1]) / 2, zf = s > 0 ? CORR - 0.012 : -CORR + 0.012;
            box(corrMats.louver, [xc - 0.4, Math.min(zf, zf - s * 0.025), xc + 0.4, Math.max(zf, zf - s * 0.025)], 0.3, 1.9, grp, false, false);
          }
        });
      });
      // ---------- hall dos elevadores: parede azul-marinho, portas de inox, indicador de andar, botoeira ----------
      const ind = sign('ind' + andar, 128, 48, function (g) {
        g.fillStyle = '#0B0D10'; g.fillRect(0, 0, 128, 48);
        g.fillStyle = '#FF4436'; g.font = '700 30px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(andar), 64, 25);
        g.beginPath(); g.moveTo(22, 30); g.lineTo(30, 18); g.lineTo(38, 30); g.fill();
      }, true);
      [-0.85, 0.85].forEach(function (x) {
        box(corrMats.dark, [x - 0.52, CORR - 0.032, x + 0.52, CORR], 0, 2.2, grp, false, false);
        box(corrMats.steel, [x - 0.45, CORR - 0.042, x - 0.004, CORR - 0.005], 0, 2.12, grp, false, false);
        box(corrMats.steel, [x + 0.004, CORR - 0.042, x + 0.45, CORR - 0.005], 0, 2.12, grp, false, false);
        box(ind, [x - 0.15, CORR - 0.04, x + 0.15, CORR - 0.012], 2.27, 2.38, grp, false, false);
      });
      box(corrMats.steel, [-0.06, CORR - 0.03, 0.06, CORR - 0.012], 1.0, 1.32, grp, false, false);   // botoeira
      box(corrMats.amber, [-0.022, CORR - 0.04, 0.022, CORR - 0.03], 1.2, 1.235, grp, false, false);
      box(corrMats.handle, [-0.022, CORR - 0.04, 0.022, CORR - 0.03], 1.09, 1.125, grp, false, false);
      box(corrMats.hall, [-1.8, 0.2, 1.8, CORR - 0.012], 0, 0.014, grp, false, false);           // faixa de porcelanato grafite em frente aos elevadores
      // ---------- escada: porta corta-fogo com barra antipânico, placa SAÍDA iluminada e luz de emergência ----------
      const zb = -CORR + 0.012;
      box(corrMats.frame, [-0.52, zb, 0.52, zb + 0.045], 0, 2.15, grp, false, false);
      box(corrMats.fireDoor, [-0.46, zb, 0.46, zb + 0.05], 0, 2.1, grp, false, false);
      box(corrMats.handle, [-0.36, zb + 0.08, 0.36, zb + 0.11], 0.98, 1.03, grp, false, false);
      [-0.33, 0.33].forEach(function (x) { box(corrMats.handle, [x - 0.02, zb + 0.05, x + 0.02, zb + 0.08], 0.97, 1.04, grp, false, false); });
      panel(sign('escada', 128, 48, function (g) {
        g.fillStyle = '#F5F5F2'; g.fillRect(0, 0, 128, 48); g.fillStyle = '#C0262D'; g.font = '700 22px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ESCADA', 64, 25);
      }), 0, zb + 0.052, 0.3, 1.5, 1.61, '+z');
      box(sign('saida', 160, 64, function (g) {
        g.fillStyle = '#0B8A43'; g.fillRect(0, 0, 160, 64); g.fillStyle = '#FFFFFF'; g.font = '800 28px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SAÍDA', 92, 34);
        g.beginPath(); g.arc(24, 18, 5, 0, 6.3); g.fill(); g.lineWidth = 5; g.strokeStyle = '#FFFFFF'; g.lineCap = 'round';
        g.beginPath(); g.moveTo(22, 25); g.lineTo(18, 40); g.lineTo(28, 52); g.moveTo(18, 40); g.lineTo(10, 52); g.moveTo(21, 30); g.lineTo(32, 34); g.moveTo(21, 30); g.lineTo(11, 33); g.stroke();
      }, true), [-0.2, zb, 0.2, zb + 0.04], 2.2, 2.36, grp, false, false);
      box(corrMats.white, [-0.17, zb, 0.17, zb + 0.07], 2.38, 2.46, grp, false, false);              // luz de emergência
      [-0.09, 0.09].forEach(function (x) { box(corrMats.lamp, [x - 0.03, zb + 0.07, x + 0.03, zb + 0.075], 2.39, 2.43, grp, false, false); });
      // número do andar em dourado (como o "A" gigante da entrada da torre) e placa de direção dos aptos
      panel(sign('andar' + andar, 256, 256, function (g) {
        g.fillStyle = '#E2B444'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        const nw = (g.font = '800 190px ' + FONT, g.measureText(String(andar)).width);
        g.fillText(String(andar), 120, 196);
        g.textAlign = 'left'; g.font = '800 64px ' + FONT; g.fillText('º', 120 + nw / 2 + 4, 104); g.textAlign = 'center';
        g.font = '700 30px ' + FONT; g.fillStyle = '#22318A'; g.fillText('ANDAR', 128, 242);
      }), -1.17, zb + 0.004, 0.95, 1.0, 1.95, '+z');
      const esq = [1, 2, 3, 12, 11, 10].map(function (p) { return andar * 100 + p; }), dir = [4, 5, 6, 9, 8, 7].map(function (p) { return andar * 100 + p; });
      panel(sign('dir' + andar, 320, 140, function (g) {
        g.fillStyle = '#22318A'; g.fillRect(0, 0, 320, 140);
        g.fillStyle = '#FFFFFF'; g.font = '600 22px ' + MONO; g.textBaseline = 'middle';
        g.textAlign = 'left'; g.fillText('← ' + esq.slice(0, 3).join(' '), 18, 36); g.fillText('  ' + esq.slice(3).sort().join(' '), 18, 64);
        g.textAlign = 'right'; g.fillText(dir.slice(0, 3).join(' ') + ' →', 302, 100); g.fillText(dir.slice(3).sort().join(' ') + '  ', 302, 128);
        g.fillStyle = '#E2B444'; g.fillRect(18, 82, 284, 2);
      }), 1.17, zb + 0.006, 1.05, 1.42, 1.88, '+z');
      // extintor com placa e marcação no piso; abrigo de hidrante
      const xe = -2.6, ze = -CORR + 0.012;
      const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 20), corrMats.red);
      ext.position.set(xe, y0 + 1.2, ze + 0.09); grp.add(ext);
      box(corrMats.dark, [xe - 0.03, ze + 0.06, xe + 0.03, ze + 0.12], 1.45, 1.53, grp, false, false);
      box(corrMats.dark, [xe - 0.05, ze, xe + 0.05, ze + 0.02], 1.4, 1.5, grp, false, false);
      panel(sign('ext', 128, 128, function (g) {
        g.fillStyle = '#C0262D'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#FFFFFF'; g.font = '800 22px ' + FONT; g.textAlign = 'center'; g.fillText('EXTINTOR', 64, 112);
        g.beginPath(); g.moveTo(64, 14); g.bezierCurveTo(92, 44, 86, 78, 64, 86); g.bezierCurveTo(42, 78, 38, 50, 58, 38); g.bezierCurveTo(58, 52, 66, 56, 70, 50); g.bezierCurveTo(72, 36, 66, 24, 64, 14); g.fill();
      }), xe, ze + 0.004, 0.22, 1.65, 1.87, '+z');
      const marca = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), sign('marca', 64, 64, function (g) {
        g.fillStyle = '#E2B444'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#C0262D'; g.fillRect(6, 6, 52, 52);
      }));
      marca.rotation.x = -Math.PI / 2; marca.position.set(xe, y0 + 0.0135, ze + 0.38); grp.add(marca);
      box(sign('hidrante', 160, 200, function (g) {
        g.fillStyle = '#B5202A'; g.fillRect(0, 0, 160, 200); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(16, 16, 128, 100);
        g.fillStyle = '#B5202A'; g.font = '800 22px ' + FONT; g.textAlign = 'center'; g.fillText('INCÊNDIO', 80, 74);
        g.fillStyle = '#FFFFFF'; g.font = '700 16px ' + FONT; g.fillText('HIDRANTE', 80, 160); g.fillRect(132, 140, 10, 26);
      }), [2.25, ze, 2.95, ze + 0.03], 0.75, 1.65, grp, false, false);
      // ---------- pontas do corredor, com a janelinha basculante da fachada lateral ----------
      [-1, 1].forEach(function (s) {
        const xi = s < 0 ? -HL + 0.2 : HL - 0.2;
        box(corrMats.wall, s < 0 ? [-HL, -1.7, -HL + 0.2, 1.7] : [HL - 0.2, -1.7, HL, 1.7], 0, hgt);
        box(corrMats.frame, [Math.min(xi, xi - s * 0.04), -0.36, Math.max(xi, xi - s * 0.04), 0.36], 1.06, 1.83, grp, false, false);
        panel(corrMats.sky, xi - s * 0.045, 0, 0.6, 1.12, 1.77, s < 0 ? '+x' : '-x');
      });
      // ---------- piso de porcelanato, rodapés, forro com plafons e a luz deles no chão ----------
      box(corrMats.floor, [-HL + 0.2, -1.62, HL - 0.2, 1.62], 0, 0.012, grp, false, false);
      solids.forEach(function (r) {
        const lx = r[2] - r[0], lz = r[3] - r[1];
        if (lx >= lz) rodape.push((r[1] + r[3]) / 2 > 0 ? [r[0], r[1] - 0.012, r[2], r[1]] : [r[0], r[3], r[2], r[3] + 0.012]);
        else if (Math.abs((r[0] + r[2]) / 2) > HL - 1) rodape.push((r[0] + r[2]) / 2 < 0 ? [r[2], r[1], r[2] + 0.012, r[3]] : [r[0] - 0.012, r[1], r[0], r[3]]);
      });
      const inst = function (geo, mat, list, place, parent) {
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach(function (it, i) { place(it); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); });
        im.instanceMatrix.needsUpdate = true; (parent || grp).add(im);
        dm.position.set(0, 0, 0); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1);
        return im;
      };
      const unit = new THREE.BoxGeometry(1, 1, 1);
      inst(unit, corrMats.skirting, rodape, function (r) { dm.rotation.set(0, 0, 0); dm.position.set((r[0] + r[2]) / 2, y0 + 0.012 + 0.04, (r[1] + r[3]) / 2); dm.scale.set(r[2] - r[0], 0.08, r[3] - r[1]); }).receiveShadow = true;
      box(corrMats.ceil, [-HL + 0.05, -1.62, HL - 0.05, 1.62], hgt, hgt + 0.08, ceilG, false, true);
      const xs = []; for (let x = -HL + 1.9; x <= HL - 1.8; x += 3.05) xs.push(x);
      inst(new THREE.CylinderGeometry(0.17, 0.15, 0.04, 28), corrMats.lamp, xs, function (x) { dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); dm.position.set(x, y0 + hgt - 0.02, 0); }, ceilG);
      inst(new THREE.PlaneGeometry(2.6, 2.6), corrMats.pool, xs, function (x) { dm.rotation.set(-Math.PI / 2, 0, 0); dm.scale.set(1, 1, 1); dm.position.set(x, y0 + 0.016, 0); }, ceilG).renderOrder = 3;
      tw.corr = { grp: grp, ceil: ceilG, solids: solids, y0: y0 };
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
        el.addEventListener('dblclick', function () { if (opts.onEnterUnit) opts.onEnterUnit(it.pos); });
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
        tw.ghost.children.slice().forEach(function (o) { tw.ghost.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        if (open) {
          const h = TOP + CROWN - (open + 1) * FH;
          const gm = new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, h, D + 0.2), new THREE.MeshBasicMaterial({ color: lin(colors.navy), transparent: true, opacity: 0.06, depthWrite: false }));
          gm.position.y = (open + 1) * FH + h / 2; tw.ghost.add(gm);
          const ge = new THREE.LineSegments(new THREE.EdgesGeometry(gm.geometry), new THREE.LineBasicMaterial({ color: lin(colors.navy), transparent: true, opacity: 0.45 }));
          ge.position.copy(gm.position); tw.ghost.add(ge);
          buildPlate(tw, open);
        } else {
          clearPlate(tw); tw.units = null;
        }
      });
      applyVisibility();
      removeUnitPickables();
      if (sel && apt) {
        setLabels([]);
      } else if (sel) {
        const tw = towers[sel.torre];
        tw.units.forEach(function (ug) { if (!ug.userData.dim) { pickables.push(ug.userData.base); pickables.push(ug.userData.plan); } });
        setLabels(tw.units.map(function (ug) {
          const u = ug.userData, edge = u.front ? u.half - 0.7 : -u.half + 0.7;      // número perto da fachada, para não cobrir a planta
          return { pos: u.unit, num: String(sel.andar * 100 + u.unit), status: u.status, dim: u.dim, p: new THREE.Vector3(tw.T.x + ug.position.x, ug.position.y + WALL_CUT + 0.25, tw.T.z + ug.position.z + edge) };
        }));
        refreshUnitLook();
      } else {
        towerLabels();
      }
      dirty = true;
    }

    // o que aparece de cada torre: andar aberto (de cima para baixo até ele) ou, na visita a pé, o prédio inteiro menos o andar do apto
    function applyVisibility() {
      TOWERS.forEach(function (T) {
        const tw = towers[T.id], open = sel && sel.torre === T.id ? sel.andar : 0;
        const inApt = !!(apt && open), full = inApt && apt.view === 'walk';
        tw.slices.forEach(function (m, lv) { m.visible = !open || lv < open || (full && lv > open); });
        tw.top.visible = !open || full;
        tw.balc.forEach(function (im) {
          if (!im.userData.all) im.userData.all = im.instanceMatrix.array.slice();
          im.instanceMatrix.array.set(im.userData.all);
          if (full) im.instanceMatrix.array.fill(0, (open - 1) * 4 * 16, open * 4 * 16);   // a sacada do próprio andar vem da maquete
          im.instanceMatrix.needsUpdate = true;
          im.count = open && !full ? 4 * (open - 1) : 4 * FLOORS;
        });
        tw.ghost.visible = !!open && !inApt;
        if (tw.units) tw.units.forEach(function (ug) { ug.visible = !(inApt && ug.userData.unit === apt.pos); });
        if (tw.corr) {
          const walking = inApt && (apt.view === 'walk' || apt.view === 'free');
          tw.corr.grp.visible = walking; tw.corr.ceil.visible = walking && apt.ceil;
        }
      });
      const lit = !!(apt && sel && apt.door && (apt.view === 'walk' || apt.view === 'free'));
      corrLights.forEach(function (l, i) {
        l.intensity = lit ? (i === 2 ? 0.9 : 1.1) : 0;
        if (lit) {
          const T = towers[sel.torre].T, dx = apt.door.x > 0 ? -1 : 1, x = i === 2 ? 0 : apt.door.x + dx * (i ? -2.6 : 1.2);
          l.position.set(T.x + Math.max(-HL + 1, Math.min(HL - 1, x)), sel.andar * FH + 0.28 + CEIL - 0.3, T.z);
        }
      });
      shadowDirty = true; dirty = true;
    }

    function refreshUnitLook() {
      if (!sel || apt) return;
      towers[sel.torre].units.forEach(function (ug) {
        const on = ug.userData.unit === selUnit, hv = ug.userData.unit === hoverUnit;
        ug.position.y = ug.userData.baseY + (on ? 0.7 : hv ? 0.32 : 0);
        ug.userData.base.scale.y = on ? 2.2 : 1;
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
    const FOV = 30;
    function flyTo(target, pos, ms) {
      if (reduceMotion || ms === 0) { controls.target.copy(target); camera.position.copy(pos); camera.fov = FOV; camera.updateProjectionMatrix(); controls.update(); dirty = true; return; }
      tween = { t0: performance.now(), ms: ms || 1000, fromT: controls.target.clone(), toT: target.clone(), fromP: camera.position.clone(), toP: pos.clone(), fromF: camera.fov };
    }
    function currentTheta() { const v = camera.position.clone().sub(controls.target); return Math.atan2(v.x, v.z); }
    function goHome(ms) { flyTo(HOME.target, spherical(HOME.target, fitR(HOME.r), HOME.phi, HOME.theta), ms); }
    function goFloor(torre, andar, ms) {
      const T = towers[torre].T, tgt = new THREE.Vector3(T.x, andar * FH + 0.8, T.z);
      flyTo(tgt, spherical(tgt, fitR(70), 0.55, currentTheta()), ms);
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
      miniMats.on.emissiveIntensity = night ? 0.32 : 0.12;
      corrMats.sky.color.copy(lin(night ? 0x1B2A52 : 0xDCE9F4));
      if (sel) applySelection();
      lamps.forEach(function (l) { l.intensity = night ? 1.6 : 0; });
      renderer.toneMappingExposure = night ? 1.12 : 1.02;
      dirty = true;
    }

    /* ---------------- interação ---------------- */
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let hoverFloor = null, down = null, interacted = false;
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
      if (apt || ev.pointerType === 'touch' || down && down.moved) return;
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
    cv.addEventListener('pointerleave', function () { if (apt) return; setHoverFloor(null); if (hoverUnit) { hoverUnit = null; refreshUnitLook(); } if (opts.onHover) opts.onHover(null); });
    let lastTap = null;
    cv.addEventListener('pointerdown', function (ev) { if (apt) { down = null; return; } down = { x: ev.clientX, y: ev.clientY, t: performance.now(), moved: false }; });
    cv.addEventListener('pointerup', function (ev) {
      if (!down) return;
      const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 7, quick = performance.now() - down.t < 600;
      down = null;
      if (moved || !quick) return;
      const u = pick(ev.clientX, ev.clientY);
      if (!u) return;
      if (u.unit) {
        const t = performance.now();
        if (lastTap && lastTap.unit === u.unit && t - lastTap.t < 480) { lastTap = null; if (opts.onEnterUnit) opts.onEnterUnit(u.unit); return; }
        lastTap = { unit: u.unit, t: t };
        if (opts.onPickUnit) opts.onPickUnit(u.unit);
      } else if (opts.onPickFloor) opts.onPickFloor(u.torre, u.andar);
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
        if (tween.fromF !== FOV) { camera.fov = tween.fromF + (FOV - tween.fromF) * e; camera.updateProjectionMatrix(); }
        if (k >= 1) tween = null;
        dirty = true;
      }
      const moving = controls.update();
      if (controls.autoRotate) dirty = true;
      if (!dirty && !moving) return;
      dirty = false;
      renderer.autoClear = true;
      renderer.toneMappingExposure = night ? 1.12 : 1.02;
      renderer.shadowMap.needsUpdate = true;
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

      /* ---------- visita ao apartamento no lugar dele ----------
         enterUnit: a maquete completa passa a ocupar o lugar da miniatura e desenha a cena (prédio + apto) com a câmera dela;
         o prédio para o próprio laço e devolve onde o apto fica (matriz da maquete para o mundo), o sol, o corredor e a câmera atual. */
      enterUnit: function (pos) {
        if (!sel || apt) return null;
        const tw = towers[sel.torre], cp = corridorPlan(pos);
        apt = { pos: pos, view: '3d', ceil: false, door: null };
        if (cp) {
          const w = cp.P.walls.find(function (q) { return (q.open || []).some(function (o) { return o.door === 'entrada'; }); });
          if (w) {
            const o = w.open.find(function (q) { return q.door === 'entrada'; }), zf = cp.Z(Math.max(w.r[1], w.r[3])), x = cp.X((o.a + o.b) / 2);
            apt.door = { x: cp.pl.cx + cp.pl.sx * x, z: cp.pl.cz + cp.pl.sz * zf };
          }
        }
        selUnit = pos; hoverUnit = null; lastTap = null; setHoverFloor(null);
        controls.autoRotate = false; controls.enabled = false; tween = null; paused = true;
        applySelection();
        const T = tw.T, tp = typeOf(pos), pl = unitPlace(pos, tp), fy = sel.andar * FH + FLOOR_UP;
        const m = new THREE.Matrix4().makeScale(pl.sx, 1, pl.sz).setPosition(T.x + pl.cx, fy, T.z + pl.cz);
        const sunDir = sun.position.clone().sub(sun.target.position).normalize();
        const solids = tw.corr ? tw.corr.solids : [];
        const out = {
          tipo: tp, torre: T.id, andar: sel.andar, pos: pos, mirror: pl.mirror, night: night,
          matrix: m.toArray(), floorY: fy, sunDir: sunDir.toArray(),
          walls: solids.map(function (r) { return [r[0] + T.x, r[1] + T.z, r[2] + T.x, r[3] + T.z]; }),
          walk: [T.x - HL + 0.2, T.z - 1.62, T.x + HL - 0.2, T.z + 1.62],
          camera: { pos: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov }
        };
        if (apt.door) {                                            // vista do corredor: no corredor, olhando de lado para a porta do apto
          const dx = apt.door.x > 0 ? -1 : 1, sg = apt.door.z > 0 ? 1 : -1, eye = sel.andar * FH + 0.28 + 1.6;
          const alvo = { x: apt.door.x, z: apt.door.z - sg * 0.1 };
          // segmento livre até a porta? (os halls dos aptos de canto podem tapar a vista; as paredes do próprio apto também contam)
          const vistos = solids.slice();
          if (cp && cp.P.corredor) cp.P.corredor.linha.forEach(function (q, i, all) {
            const zf = cp.Z(q[2]); vistos.push(toTower(cp.pl, cp.X(q[0]), zf - 0.12, cp.X(q[1]), zf));
            const nx = all[i + 1];
            if (nx && Math.abs(nx[2] - q[2]) > 1) { const xj = cp.X(nx[0]), zn = cp.Z(nx[2]); vistos.push(toTower(cp.pl, xj - 0.06, Math.min(zf, zn) - 0.12, xj + 0.06, Math.max(zf, zn))); }
          });
          const livre = function (ax, az) {
            return !vistos.some(function (r) {
              if (ax > r[0] - 0.3 && ax < r[2] + 0.3 && az > r[1] - 0.3 && az < r[3] + 0.3) return true;
              let t0 = 0, t1 = 1; const ddx = alvo.x - ax, ddz = alvo.z - az;
              const clip = function (p, q) { if (Math.abs(p) < 1e-9) return q >= 0; const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
              return clip(-ddx, ax - r[0]) && clip(ddx, r[2] - ax) && clip(-ddz, az - r[1]) && clip(ddz, r[3] - az) && t0 < t1;
            });
          };
          let at = null;
          [1.7, 1.3, 2.3, 3].some(function (d) {
            return [0, -sg * 0.3].some(function (zc) { const x = apt.door.x + dx * d; if (Math.abs(x) < HL - 0.5 && livre(x, zc)) { at = [x, zc]; return true; } return false; });
          });
          let to = [T.x + apt.door.x, eye - 0.35, T.z + apt.door.z];
          if (!at) {                                               // porta no fundo do corredor (apto de canto): na frente dela, olhando o corredor
            at = [apt.door.x, apt.door.z - sg * 0.95];
            to = [T.x + apt.door.x + dx * 8, eye - 0.15, T.z];
          }
          out.corridor = { name: 'Corredor do ' + sel.andar + 'º andar', at: [T.x + at[0], eye, T.z + at[1]], to: to };
        }
        return out;
      },
      // vista atual da maquete: 3d, top, walk ou free; ceil = forro da maquete visível (o do corredor acompanha)
      setAptView: function (view, ceil) {
        if (!apt) return;
        if (apt.view === view && apt.ceil === !!ceil) return;
        apt.view = view; apt.ceil = !!ceil;
        applyVisibility();
      },
      // desenha o prédio com a câmera da maquete (a maquete desenha o apto por cima, no mesmo quadro)
      renderWith: function (cam) {
        renderer.autoClear = true;
        renderer.toneMappingExposure = night ? 1.12 : 1.02;
        renderer.shadowMap.needsUpdate = shadowDirty; shadowDirty = false;
        renderer.render(scene, cam);
      },
      // sai da visita: a câmera do prédio começa onde a da maquete estava e volta voando para o andar
      exitUnit: function (cam) {
        if (!apt) return;
        apt = null;
        if (cam) {
          camera.position.fromArray(cam.pos); controls.target.fromArray(cam.target);
          camera.fov = cam.fov || FOV; camera.updateProjectionMatrix(); camera.lookAt(controls.target);
        }
        controls.enabled = true; paused = false;
        applySelection(); refreshUnitLook();
        if (sel) goFloor(sel.torre, sel.andar, reduceMotion ? 0 : 1300);
        dirty = true;
      },
      renderer: renderer, canvas: cv,
      FH: FH, unitRect: unitRect, L: L, D: D
    };
  }

  window.Predio3D = { create: create, unitRect: unitRect, unitPlace: unitPlace, planCanvas: planCanvas, planPose: planPose, BAYS: BAYS, FH: FH, L: L, D: D, HD: HD, CORR: CORR };
})();
