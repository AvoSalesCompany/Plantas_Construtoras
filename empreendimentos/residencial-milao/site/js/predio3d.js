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

  // cada torre é uma barra reta: as duas alas de apartamentos ficam na mesma linha e só o núcleo do meio (elevadores e escada)
  // é recuado da fachada, na frente e nos fundos, como no site da Baliza. WING_DZ fica 0 (alas alinhadas).
  const WING_DZ = 0;
  const CORE_IN = 1.5;                       // recuo do núcleo em relação às alas
  const PARTS = [
    { id: 'W', x0: -HL, x1: -1.8, z0: -HD, z1: HD },
    { id: 'C', x0: -1.8, x1: 1.8, z0: -HD + CORE_IN, z1: HD - CORE_IN },
    { id: 'E', x0: 1.8, x1: HL, z0: -HD, z1: HD }
  ];
  function dzAt(x) { return x > 1.8 - 1e-6 ? WING_DZ : x < -1.8 + 1e-6 ? 0 : WING_DZ / 2; }   // eixo do corredor em cada ala
  function partAt(x) { return x < -1.8 ? PARTS[0] : x > 1.8 ? PARTS[2] : PARTS[1]; }
  const Z_MIN = -HD, Z_MAX = HD + WING_DZ;
  // elevadores: dois poços no núcleo, portas para o hall dos andares (z = ZE); o da direita (x = +0,85) funciona na visita.
  // A cabine tem duas portas: a da frente abre nos andares, a de trás no térreo, para o hall de entrada da torre.
  const ZE = WING_DZ + CORR;                 // face do hall dos elevadores (parede azul-marinho)
  const LIFT = { x: 0.85, x2: -0.85, half: 0.45, in0: ZE + 0.17, in1: ZE + 1.53, w: 0.76, h: 2.32, rear: ZE + 1.72 };
  const ENTRY_Z = HD - CORE_IN;              // frente do núcleo (recuada): porta de vidro da torre
  // hall de entrada no térreo, entre a parede de trás dos elevadores e a porta de vidro: caixas de correio, banco e vaso
  const LOBBY = { mail: [LIFT.rear + 0.38, LIFT.rear + 2.18], bench: [LIFT.rear + 0.5, LIFT.rear + 1.8], plant: ENTRY_Z - 0.5 };
  // piso da cabine em cada parada (sistema da torre): térreo no piso do hall de entrada, andares no piso do corredor
  function stopY(n) { return n === 0 ? 0.06 : n * FH + 0.292; }
  // poços (núcleo e ventilação) no sistema da torre, para a laje do andar aberto e a planta do painel
  const SHAFTS = [
    [-1.8, CORR, 1.8, HD - CORE_IN - 0.4, 'elev'], [-1.8, -HD + CORE_IN + 0.4, 1.8, -CORR, 'escada'],
    [-18.9, CORR, -17.4, HD - 0.3, 'poco'], [-18.9, -HD + 0.3, -17.4, -CORR, 'poco'],
    [17.4, WING_DZ + CORR, 18.9, WING_DZ + HD - 0.3, 'poco'], [17.4, WING_DZ - HD + 0.3, 18.9, WING_DZ - CORR, 'poco']
  ];

  // posição no andar (1–12) -> retângulo em planta, no sistema da torre
  function unitRect(pos) {
    const front = pos <= 6;
    const k = front ? pos : 13 - pos;            // o 7 fica atrás do 6, o 12 atrás do 1
    const x = UNIT_X[k], dz = dzAt((x[0] + x[1]) / 2);
    return { x0: x[0], x1: x[1], z0: (front ? CORR : -HD) + dz, z1: (front ? HD : -CORR) + dz, front: front, canto: k === 1 || k === 6, k: k, dz: dz };
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
    return { cx: (r.x0 + r.x1) / 2, cz: (pose.front ? HD - dm.d / 2 : -HD + dm.d / 2) + r.dz, w: dm.w, d: dm.d, sx: sx, sz: sz, front: pose.front, mirror: pose.mirror };
  }

  // as duas torres ficam lado a lado ao longo do muro do fundo do terreno, alinhadas numa reta, de frente para o estacionamento e o lazer
  const TOWERS = [
    { id: 'A', x: -29.5, z: 0 },
    { id: 'B', x: 29.5, z: 0 }
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
        // vão da porta de vidro da torre: fica vazado na textura (o hall de entrada de verdade aparece atrás do vidro)
        if (isFront) g.clearRect(rx(-1.62), ry(2.52), 3.24 * PXM, 2.52 * PXM + 2);
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
      if ((w.kind === 'unit' || w.kind === 'service') && w.lv > 0) { const pos = unitOfBay(w.b, back); lit = !!pos && statusOf(torre, w.lv, pos) === 'livre'; }
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

  /* ---------------- terreno do condomínio ----------------
     Montado a partir da imagem de satélite (obra na Rua Marieta Fialho Blessmann, Feitoria) e das imagens da Baliza:
     as duas torres lado a lado junto ao muro do fundo (casas da Rua Gastão atrás), estacionamento descoberto e rua interna
     na frente, mais vagas atrás das torres (entra-se nelas só pela ponta oeste, do lado da Torre A), portaria com o pilar
     MILÃO de frente para a Torre A e, na ponta leste, ao lado da Torre B, o lazer: pracinha junto ao prédio, espaço pet
     com pet care ao lado dela, piscina adulto e infantil e salão de festas atrás dos dois (junto ao muro do fundo) e os
     quiosques com pérgola no fim do estacionamento. Reservatórios azuis na ponta oeste; mata nativa ao sul e a leste.
     Metros; x para leste, z para o sul (a frente das torres). */
  const LOT = { x0: -85, x1: 104, z0: -28, z1: 62 };
  const ROAD = { x0: -80, x1: 64, z0: 21, z1: 27 };               // rua interna, entre as duas fileiras de vagas
  // fundos: mais estacionamento atrás das torres, ligado à rua interna só pela ponta oeste (a leste fica o lazer)
  const BACK = { aisle: [-64.5, -21, 56, -15], rows: [[-58.5, -26, 56, -21], [-56, -15, 56, -10]], links: [[-64.5, -21, -58.5, 21]] };
  const nearLink = function (x, m) { return BACK.links.some(function (l) { return x > l[0] - (m || 0) && x < l[2] + (m || 0); }); };
  // faixas de pedestre: em frente às entradas das torres (de calçada a calçada)
  const CROSS = TOWERS.map(function (t) { return t.x; });
  const PARK = [[-80, 15.5, 61, 21], [-80, 27, 61, 32.5]];       // vagas de 2,5 m x 5 m (90°)
  const ACCESS = { x0: -33, x1: -26, z0: 27, z1: 62 };           // acesso de carros: do portão (de frente para a Torre A) até a rua interna
  const GATE = { x0: -33, x1: -26, z: 62 };
  const HALL = [59, -26, 73, -12];                                 // salão de festas (por dentro); a porta de vidro dá para o estacionamento dos fundos
  const TERR = [73, -26, 77, -12];                                 // varanda coberta do salão, guarda-corpo branco, de frente para a piscina
  const POOLA = { fence: [77, -27.8, 103.8, -8], adult: [86, -24.5, 99.5, -18], kids: [79.5, -24, 83.5, -20.4] };
  const PLAY = [59, -5, 74, 11], PET = [77, -5, 98, 11], KIOSK = [66, 15.5, 102, 32.5], RES = [-81, -9, -66, 7];
  const KIOSKS = [71.5, 90];                                       // centro (x) de cada quiosque
  const PLAZA = [56.5, -12, 77, -5];                               // praça entre o salão, a pracinha e a entrada da piscina
  const GUARD = [-25.6, 56, -19.6, 62];                            // guarita (a frente é o alinhamento do muro), à direita de quem chega
  const PILLAR = [-40.2, 62, -37.6, 63.3];                         // pilar de concreto com MILÃO, à esquerda de quem chega
  const TRASH = [-52, 57, -46, 61];                                // abrigo de lixo
  // áreas com nome (para o visitante saber onde está quando desce do elevador); a primeira que contém o ponto vale
  const ZONES = [
    { id: 'salao', name: 'Salão de festas', r: HALL },
    { id: 'varanda', name: 'Varanda do salão de festas', r: TERR },
    { id: 'piscina', name: 'Piscina adulto e infantil', r: POOLA.fence },
    { id: 'quiosques', name: 'Quiosques com churrasqueira', r: KIOSK },
    { id: 'pracinha', name: 'Pracinha', r: PLAY },
    { id: 'pet', name: 'Espaço pet e pet care', r: PET },
    { id: 'praca', name: 'Praça do lazer', r: PLAZA },
    { id: 'portaria', name: 'Portaria', r: [-41, 50, -16, 62] },
    { id: 'reservatorios', name: 'Reservatórios', r: RES },
    { id: 'estacionamento', name: 'Estacionamento', r: [-80, 15.5, 64, 32.5] },
    { id: 'estacionamento-fundos', name: 'Estacionamento dos fundos', r: [-64.5, -26, 56, -10] },
    { id: 'acesso', name: 'Acesso de carros', r: [ACCESS.x0, ACCESS.z0, ACCESS.x1, ACCESS.z1] },
    { id: 'jardim', name: 'Jardim', r: [LOT.x0, 35, LOT.x1, LOT.z1] }
  ];
  const SITE = { x0: -112, x1: 130, z0: -66, z1: 98 };           // chão desenhado (o lote e a vizinhança em volta)
  const SITE_PX = 12;
  const SURF = {
    lawn: '#86A766', lawn2: '#7C9E5C', paving: '#D6D1C6', asphalt: '#575A61', asphalt2: '#4C4F56', deck: '#E2D8C6', rubber: '#B85A44', rubber2: '#3E8E6A',
    walk: '#DEDAD2', brick: '#B5654D', navy: '#25336F', sand: '#D9C79C', forest: '#4E6B3A', yard: '#93A77A', gravel: '#B9B4A8'
  };
  // retângulos (x0, z0, x1, z1) que o visitante não atravessa no térreo, além das torres (sistema do mundo)
  const GROUND_SOLIDS = [];

  function siteCanvas() {
    const W = (SITE.x1 - SITE.x0) * SITE_PX, H = (SITE.z1 - SITE.z0) * SITE_PX;
    const c = canvas(W, H), g = c.getContext('2d');
    const X = function (m) { return (m - SITE.x0) * SITE_PX; }, Z = function (m) { return (m - SITE.z0) * SITE_PX; };
    const rect = function (col, x0, z0, x1, z1) { g.fillStyle = col; g.fillRect(X(x0), Z(z0), (x1 - x0) * SITE_PX, (z1 - z0) * SITE_PX); };
    const R = rng(77);
    const speckle = function (x0, z0, x1, z1, n, a, b) {
      for (let i = 0; i < n; i++) { g.fillStyle = R() < 0.5 ? a : b; g.fillRect(X(x0 + R() * (x1 - x0)), Z(z0 + R() * (z1 - z0)), 1 + R() * 4, 1 + R() * 3); }
    };
    // fora do lote: mata (sul e leste), quintais (norte), ruas
    rect(SURF.forest, SITE.x0, SITE.z0, SITE.x1, SITE.z1);
    speckle(SITE.x0, SITE.z0, SITE.x1, SITE.z1, 26000, 'rgba(30,50,20,.25)', 'rgba(140,170,90,.18)');
    rect(SURF.yard, SITE.x0, SITE.z0, SITE.x1, LOT.z0);
    rect(SURF.yard, SITE.x0, LOT.z0, LOT.x0, 78);
    speckle(SITE.x0, SITE.z0, SITE.x1, LOT.z0, 6000, 'rgba(60,80,40,.18)', 'rgba(220,230,180,.15)');
    rect(SURF.asphalt, SITE.x0, -59, SITE.x1, -52);                 // Rua Gastão (atrás das casas do fundo)
    rect(SURF.asphalt, -101, SITE.z0, -94, SITE.z1);                 // Rua Gustavo Veter
    rect(SURF.asphalt, SITE.x0, 78, -24, 85);                        // Rua Marieta Fialho Blessmann
    rect(SURF.asphalt, ACCESS.x0, LOT.z1, ACCESS.x1, 85);            // chegada ao portão
    g.strokeStyle = 'rgba(240,232,200,.8)'; g.lineWidth = 2; g.setLineDash([3 * SITE_PX, 3 * SITE_PX]);
    [[SITE.x0, -55.5, SITE.x1, -55.5], [-97.5, SITE.z0, -97.5, SITE.z1], [SITE.x0, 81.5, -24, 81.5]].forEach(function (l) { g.beginPath(); g.moveTo(X(l[0]), Z(l[1])); g.lineTo(X(l[2]), Z(l[3])); g.stroke(); });
    g.setLineDash([]);
    rect(SURF.walk, SITE.x0, -52, SITE.x1, -50.5); rect(SURF.walk, SITE.x0, 76.5, -33, 78); rect(SURF.walk, -94, SITE.z0, -92.5, SITE.z1);
    // dentro do lote: grama
    rect(SURF.lawn, LOT.x0, LOT.z0, LOT.x1, LOT.z1);
    speckle(LOT.x0, LOT.z0, LOT.x1, LOT.z1, 16000, 'rgba(60,90,40,.14)', 'rgba(200,220,150,.14)');
    // calçada em volta das torres e passeio de tijolinho com a faixa azul-marinho na frente (render "Rua Interna")
    TOWERS.forEach(function (t) {
      rect(SURF.gravel, t.x - HL - 1.5, t.z - HD - 1.5, t.x + HL + 1.5, t.z + HD + WING_DZ + 1.5);
      rect(SURF.walk, t.x - HL - 1.2, t.z - HD - 1.2, t.x + HL + 1.2, t.z + HD + WING_DZ + 1.2);
    });
    rect(SURF.brick, -80, 9.5, 61, 15.5);
    for (let x = -80; x < 61; x += 0.25) { g.fillStyle = 'rgba(80,30,20,.18)'; g.fillRect(X(x), Z(9.5), 1, 6 * SITE_PX); }
    for (let z = 9.5; z < 15.5; z += 0.12) { g.fillStyle = 'rgba(255,230,210,.10)'; g.fillRect(X(-80), Z(z), 141 * SITE_PX, 1); }
    rect(SURF.navy, -80, 14.6, 61, 15.5);
    TOWERS.forEach(function (t) {                                   // a calçada da torre volta a ser lisa junto à fachada
      rect(SURF.walk, t.x - HL - 1.2, t.z - HD - 1.2, t.x + HL + 1.2, t.z + HD + 1.2);
      rect(SURF.paving, t.x - 3.2, t.z + ENTRY_Z, t.x + 3.2, 9.5);       // chegada à entrada da torre: do recuo do núcleo até a calçada
    });
    // rua interna, acesso e vagas (faixas amarelas)
    BACK.links.forEach(function (l) { rect(SURF.asphalt, l[0], l[1], l[2], l[3]); });
    rect(SURF.asphalt, ROAD.x0, ROAD.z0, ROAD.x1, ROAD.z1);
    rect(SURF.asphalt, ACCESS.x0, ACCESS.z0, ACCESS.x1, ACCESS.z1);
    PARK.forEach(function (p) { rect(SURF.asphalt2, p[0], p[1], p[2], p[3]); });
    speckle(ROAD.x0, 15.5, ROAD.x1, 32.5, 9000, 'rgba(0,0,0,.12)', 'rgba(255,255,255,.06)');
    g.strokeStyle = '#E3B53A'; g.lineWidth = 2;
    PARK.forEach(function (p, i) {
      for (let x = p[0]; x <= p[2] + 0.01; x += 2.5) {
        if (Math.abs(x - ACCESS.x0 - 3.5) < 4.5 && i === 1) continue;
        if (CROSS.some(function (c) { return Math.abs(x - c) < 2.6; }) || nearLink(x, 0.3)) continue;
        g.beginPath(); g.moveTo(X(x), Z(i ? p[1] : p[1] + 0.6)); g.lineTo(X(x), Z(i ? p[3] - 0.6 : p[3])); g.stroke();
      }
    });
    rect(SURF.asphalt, ACCESS.x0, 27, ACCESS.x1, 32.5);
    // estacionamento dos fundos: corredor e duas fileiras de vagas (uma junto ao muro, outra atrás das torres)
    rect(SURF.asphalt, BACK.aisle[0], BACK.aisle[1], BACK.aisle[2], BACK.aisle[3]);
    BACK.rows.forEach(function (p) { rect(SURF.asphalt2, p[0], p[1], p[2], p[3]); });
    speckle(BACK.aisle[0], BACK.rows[0][1], BACK.rows[0][2], BACK.rows[1][3], 7000, 'rgba(0,0,0,.12)', 'rgba(255,255,255,.06)');
    BACK.links.forEach(function (l) { speckle(l[0], l[1], l[2], l[3], 1200, 'rgba(0,0,0,.12)', 'rgba(255,255,255,.06)'); });
    BACK.rows.forEach(function (p, i) {
      for (let x = p[0]; x <= p[2] + 0.01; x += 2.5) {
        if (nearLink(x, 0.3)) continue;
        g.beginPath(); g.moveTo(X(x), Z(i ? p[1] + 0.6 : p[1])); g.lineTo(X(x), Z(i ? p[3] : p[3] - 0.6)); g.stroke();
      }
    });
    // faixas de pedestre de calçada a calçada: listras compridas no sentido da rua (dos carros), uma atrás da outra na travessia
    CROSS.forEach(function (x) {
      for (let z = 15.8; z < 32.3; z += 0.9) rect('rgba(246,246,242,.93)', x - 2.0, z, x + 2.0, z + 0.45);
    });
    // passeio de tijolinho do lado sul do estacionamento, calçadas do acesso e a pista de caminhada no jardim da frente
    rect(SURF.brick, -80, 32.5, 64, 35);
    rect(SURF.walk, ACCESS.x1, 35, ACCESS.x1 + 1.6, 62);              // calçada do acesso, do portão para dentro
    rect(SURF.walk, ACCESS.x0 - 1.6, 35, ACCESS.x0, 62);
    rect(SURF.walk, -80, 46, ACCESS.x0 - 1.6, 47.6); rect(SURF.walk, ACCESS.x1 + 1.6, 46, 101, 47.6);
    [-62, -10, 30, 62.4].forEach(function (x) { rect(SURF.walk, x, 35, x + 1.6, 46); });
    rect(SURF.walk, 99.4, 32.5, 101, 46);
    // lazer da ponta leste: calçada entre a pracinha/pet e os quiosques, caminho até a piscina, praça e a entrada do salão
    rect(SURF.walk, 56.5, 11.4, 101, 15.3);
    rect(SURF.walk, 74.2, PLAZA[3], 76.8, 11.4);
    rect(SURF.paving, PLAZA[0], PLAZA[1], PLAZA[2], PLAZA[3]);
    rect(SURF.paving, 56, -21, HALL[0], PLAZA[1]);
    rect(SURF.paving, HALL[0], HALL[1], TERR[2], HALL[3]);
    // pracinha: piso emborrachado colorido; espaço pet: grama com areia; pet care no piso
    rect(SURF.rubber, PLAY[0], PLAY[1], PLAY[2], PLAY[3]);
    g.fillStyle = SURF.rubber2; g.beginPath(); g.arc(X(PLAY[0] + 4.5), Z(PLAY[1] + 12.5), 3.0 * SITE_PX, 0, 6.3); g.fill();
    g.fillStyle = '#3F6FB0'; g.beginPath(); g.arc(X(PLAY[2] - 3.8), Z(PLAY[1] + 4), 2.6 * SITE_PX, 0, 6.3); g.fill();
    rect(SURF.sand, PLAY[2] - 6.5, PLAY[3] - 5.5, PLAY[2] - 1.5, PLAY[3] - 1.2);
    rect(SURF.lawn2, PET[0], PET[1], PET[2], PET[3]);
    speckle(PET[0], PET[1], PET[2], PET[3], 2500, 'rgba(40,70,30,.18)', 'rgba(200,220,150,.14)');
    rect(SURF.sand, PET[0] + 9, PET[1] + 2, PET[0] + 15, PET[1] + 7);
    rect(SURF.paving, PET[2] - 5, PET[1] + 0.2, PET[2] - 0.2, PET[1] + 3.6);
    // quiosques: piso de pedra sob a cobertura e a pérgola; piscina: porcelanato claro; reservatórios: concreto
    KIOSKS.forEach(function (cx) { rect(SURF.paving, cx - 4.2, 16.6, cx + 4.2, 31.8); });
    rect('#DCD5C8', POOLA.fence[0], POOLA.fence[1], POOLA.fence[2], POOLA.fence[3]);
    rect(SURF.gravel, RES[0], RES[1], RES[2], RES[3]);
    // portaria: piso intertravado dentro e fora do portão; abrigo de lixo
    rect(SURF.paving, -41, 52, -16, LOT.z1);
    rect(SURF.paving, -36.4, LOT.z1, -14, 66);
    rect(SURF.paving, TRASH[0] - 0.5, TRASH[1] - 0.5, TRASH[2] + 0.5, LOT.z1);
    // muro do condomínio
    g.strokeStyle = 'rgba(40,44,52,.7)'; g.lineWidth = 3; g.strokeRect(X(LOT.x0), Z(LOT.z0), (LOT.x1 - LOT.x0) * SITE_PX, (LOT.z1 - LOT.z0) * SITE_PX);
    // piscinas vazadas no chão: o tanque de verdade (fundo, paredes e água) fica embaixo
    [POOLA.adult, POOLA.kids].forEach(function (p) { g.clearRect(X(p[0]), Z(p[1]), (p[2] - p[0]) * SITE_PX, (p[3] - p[1]) * SITE_PX); });
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
    // resolução adaptável: começa na nitidez máxima do aparelho (no celular, 1,5x) e só baixa se os quadros ficarem lentos;
    // volta a subir quando sobra folga, sem passar do último nível que ficou lento
    const MOBILE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) && Math.min(screen.width || 0, screen.height || 0) < 900;
    const perf = { max: Math.min(window.devicePixelRatio || 1, 2), min: 0.75, dpr: 1, last: 0, s: [], changed: 0 };
    perf.dpr = MOBILE ? Math.min(perf.max, 1.5) : perf.max;
    renderer.setPixelRatio(perf.dpr);
    function perfTick(now) {
      const dt = now - perf.last; perf.last = now;
      if (dt <= 0 || dt > 150) { perf.s.length = 0; return; }      // não é animação contínua
      perf.s.push(dt); if (perf.s.length < 30) return;
      const med = perf.s.sort(function (a, b) { return a - b; })[15]; perf.s.length = 0;
      if (now - perf.changed < 1200) return;
      if (med > 30 && perf.dpr > perf.min) { perf.max = perf.dpr - 0.25; setDpr(perf.dpr - 0.25); }
      else if (med < 18.5 && perf.dpr < perf.max) setDpr(perf.dpr + 0.25);
    }
    function setDpr(v) {
      perf.dpr = Math.max(perf.min, Math.min(perf.max, v)); perf.changed = performance.now();
      renderer.setPixelRatio(perf.dpr); dirty = true;
    }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
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
      o = Object.assign({ roughness: 0.85, metalness: 0, envMapIntensity: 0.75 }, o);
      if (o.color !== undefined) o.color = lin(o.color);
      if (o.emissive !== undefined) o.emissive = lin(o.emissive);
      return new THREE.MeshStandardMaterial(o);
    };
    // geometrias com matriz [geo, matriz] numa geometria só (sem índice): peças de móveis, carros, postes
    function mergeGeos(list) {
      let n = 0;
      const parts = list.map(function (it) {
        const g0 = it.isBufferGeometry ? it : it[0], g = g0.index ? g0.toNonIndexed() : g0.clone();
        if (!it.isBufferGeometry && it[1]) g.applyMatrix4(it[1]);
        n += g.attributes.position.count; return g;
      });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let o = 0;
      parts.forEach(function (g) {
        if (!g.attributes.normal) g.computeVertexNormals();
        pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
        o += g.attributes.position.count; g.dispose();
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      return geo;
    }
    const _o3 = new THREE.Object3D();
    function mat4(x, y, z, rx, ry, rz, sx, sy, sz) {
      _o3.position.set(x || 0, y || 0, z || 0); _o3.rotation.set(rx || 0, ry || 0, rz || 0); _o3.scale.set(sx || 1, sy || 1, sz || 1);
      _o3.updateMatrix(); return _o3.matrix.clone();
    }
    // junta as peças paradas de um grupo por material: uma chamada de desenho por material em vez de uma por peça
    // (o que se mexe ou se clica fica de fora: userData.keep)
    function mergeStatic(group) {
      group.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), mtx = new THREE.Matrix4(), buckets = new Map();
      group.children.slice().forEach(function (m) {
        if (!m.isMesh || m.isInstancedMesh || Array.isArray(m.material) || m.userData.keep || m.userData.porta || m.children.length || !m.geometry.attributes.normal) return;
        const key = m.material.uuid + '|' + (m.castShadow ? 1 : 0) + (m.receiveShadow ? 1 : 0) + '|' + m.renderOrder + '|' + m.visible;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(m);
      });
      buckets.forEach(function (list) {
        if (list.length < 2) return;
        let n = 0; const parts = [];
        list.forEach(function (m) {
          const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
          mtx.multiplyMatrices(inv, m.matrixWorld); g.applyMatrix4(mtx);
          parts.push(g); n += g.attributes.position.count;
        });
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
        let o = 0;
        parts.forEach(function (g) {
          pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
          if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
          o += g.attributes.position.count; g.dispose();
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.computeBoundingSphere();
        const mm = new THREE.Mesh(geo, list[0].material);
        mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow; mm.renderOrder = list[0].renderOrder; mm.visible = list[0].visible;
        list.forEach(function (m) { group.remove(m); });
        group.add(mm);
      });
    }

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
    // reflexos do céu (vidro, água, carros, inox) e luz ambiente: um céu em gradiente com o sol, pré-filtrado uma vez
    function envFrom(top, mid, low, ground, sunCol, sunK) {
      try {
        const s = new THREE.Scene(), geo = new THREE.SphereGeometry(50, 48, 24), pos = geo.attributes.position, cols = [];
        const cT = lin(top), cM = lin(mid), cL = lin(low), cG = lin(ground), c = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i) / 50;
          if (y >= 0) c.copy(cL).lerp(cM, Math.min(1, y * 3)).lerp(cT, Math.max(0, (y - 0.33) / 0.67)); else c.copy(cL).lerp(cG, Math.min(1, -y * 6));
          cols.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
        if (sunK) {
          const sm = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 8), new THREE.MeshBasicMaterial({ color: lin(sunCol).multiplyScalar(sunK) }));
          sm.position.set(62, 120, 95).normalize().multiplyScalar(44); s.add(sm);
        }
        const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(s, 0.03).texture;
        pm.dispose(); geo.dispose();
        return t;
      } catch (e) { return null; }
    }
    const ENV = { day: envFrom('#5E93CC', '#A9C6E2', '#E3EBF1', '#7F8C72', '#FFF3DC', 9), night: envFrom('#03060F', '#0C1430', '#25325A', '#141812', '#000000', 0) };
    scene.environment = ENV.day;

    /* luzes */
    const hemi = new THREE.HemisphereLight(0xE4EEF8, 0x5E6B4E, 0.72); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xFFF2DE, 1.25);
    // recorte da sombra do sol para o lote inteiro (na visita a pé ele encolhe e acompanha o visitante)
    const SUN_FULL = { pos: [80, 120, 94], tgt: [10, 0, 17], lr: 112, tb: 96 };
    sun.position.fromArray(SUN_FULL.pos); sun.target.position.fromArray(SUN_FULL.tgt);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -SUN_FULL.lr, right: SUN_FULL.lr, top: SUN_FULL.tb, bottom: -SUN_FULL.tb, near: 10, far: 400 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
    scene.add(sun); scene.add(sun.target);
    const amb = new THREE.AmbientLight(0x8090C0, 0); scene.add(amb);
    const lamps = [];
    [[TOWERS[0].x, 14], [TOWERS[1].x, 15], [-29.5, 57], [92, -13], [66, -19], [66, 3], [81, 24], [-10, 46]].forEach(function (p) {
      const l = new THREE.PointLight(0xFFC98A, 0, 24, 2); l.position.set(p[0], 4.2, p[1]); scene.add(l); lamps.push(l);
    });

    /* chão: vizinhança, ruas e o lote desenhados numa textura só */
    // o chão distante é um anel em volta do terreno desenhado (sem sobrepor: nada briga com o lote, e o tanque da piscina
    // pode ser fundo de verdade); textura de detalhe em metros (grão de grama, asfalto e piso) por cima do desenho do lote
    const detailTex = (function () {
      const c = canvas(256, 256), g = c.getContext('2d'), R = rng(404), img = g.createImageData(256, 256);
      const v = new Float32Array(256 * 256);
      for (let o = 0; o < 4; o++) {                               // ruído de valor em 4 oitavas, repetível nas bordas
        const n = 4 << o, gr = []; for (let i = 0; i < n * n; i++) gr.push(R());
        for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
          const fx = x / 256 * n, fy = y / 256 * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
          const a = gr[iy % n * n + ix % n], b = gr[iy % n * n + (ix + 1) % n], c2 = gr[(iy + 1) % n * n + ix % n], d = gr[(iy + 1) % n * n + (ix + 1) % n];
          const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
          v[y * 256 + x] += ((a * (1 - sx) + b * sx) * (1 - sy) + (c2 * (1 - sx) + d * sx) * sy) * (o === 3 ? 0.4 : 0.2);
        }
      }
      for (let i = 0; i < v.length; i++) { const k = Math.max(0, Math.min(255, Math.round((v[i] - 0.5 + 0.5) * 255 + (R() - 0.5) * 40))); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = k; img.data[i * 4 + 3] = 255; }
      g.putImageData(img, 0, 0);
      const t = tex(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    })();
    function withDetail(mat, rep, amt) {
      mat.onBeforeCompile = function (sh) {
        sh.uniforms.detailMap = { value: detailTex }; sh.uniforms.detailRep = { value: rep };
        sh.fragmentShader = 'uniform sampler2D detailMap;\nuniform vec2 detailRep;\n' + sh.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\n  float dtl = texture2D(detailMap, vUv * detailRep).r * 0.6 + texture2D(detailMap, vUv * detailRep * 0.21 + 0.37).r * 0.4;\n  diffuseColor.rgb *= ' + (1 - amt).toFixed(2) + ' + ' + (2 * amt).toFixed(2) + ' * dtl;');
      };
      mat.customProgramCacheKey = function () { return 'detail' + amt; };
      return mat;
    }
    const siteW = SITE.x1 - SITE.x0, siteD = SITE.z1 - SITE.z0;
    const ringShape = new THREE.Shape([new THREE.Vector2(-800, -800), new THREE.Vector2(800, -800), new THREE.Vector2(800, 800), new THREE.Vector2(-800, 800)]);
    ringShape.holes.push(new THREE.Path([new THREE.Vector2(SITE.x0 + 0.5, -(SITE.z0 + 0.5)), new THREE.Vector2(SITE.x0 + 0.5, -(SITE.z1 - 0.5)), new THREE.Vector2(SITE.x1 - 0.5, -(SITE.z1 - 0.5)), new THREE.Vector2(SITE.x1 - 0.5, -(SITE.z0 + 0.5))]));
    const ground = new THREE.Mesh(new THREE.ShapeGeometry(ringShape), std({ color: 0x6F8A57, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; scene.add(ground);
    const siteMat = withDetail(std({ map: tex(siteCanvas()), roughness: 0.95, alphaTest: 0.5 }), new THREE.Vector2(siteW / 1.7, siteD / 1.7), 0.16);
    const site = new THREE.Mesh(new THREE.PlaneGeometry(siteW, siteD, 34, 25), siteMat);
    site.rotation.x = -Math.PI / 2; site.position.set((SITE.x0 + SITE.x1) / 2, 0, (SITE.z0 + SITE.z1) / 2); site.receiveShadow = true; scene.add(site);
    const dm = new THREE.Object3D();
    const lampHeads = std({ color: 0xF4F1E8, emissive: new THREE.Color(0xFFD7A0), emissiveIntensity: 0 });

    /* torres */
    const facFront = facadeLong(11, true), facBack = facadeLong(29, false), facEndA = facadeShort(41), facEndB = facadeShort(53);
    const mapFront = tex(facFront.map), mapBack = tex(facBack.map);
    const LIGHTS = {};
    TOWERS.forEach(function (T) { LIGHTS[T.id] = { front: tex(facadeLights(facFront, T.id, false, statusOf)), back: tex(facadeLights(facBack, T.id, true, statusOf)) }; });
    const facadeMats = [];
    const facadeMat = function (map, emi) {
      const m = std(emi ? { map: map, emissiveMap: emi, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0, roughness: 0.78, alphaTest: 0.5 } : { map: map, roughness: 0.78 });
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
      slabEdge: std({ color: 0xE6E8EB, roughness: 0.8 }),
      // vidro das janelas por cima da fachada desenhada: reflete o céu (a luz acesa dos aptos aparece através dele)
      winGlass: new THREE.MeshStandardMaterial({ color: lin(0x7C93AA), roughness: 0.05, metalness: 0.8, transparent: true, opacity: 0.4, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: 1.25 }),
      sill: std({ color: 0xEDEEF0, roughness: 0.6 })
    };

    M.plain = std({ color: 0xD7DAE0, roughness: 0.85 });
    // uma caixa por parte da torre (ala oeste, núcleo, ala leste): as faces compridas usam o trecho certo da textura da fachada
    // (a dos fundos é vista espelhada: o ponto m da textura fica em x = -m) e v recorta a fatia do andar
    function partGeo(pt, h, v0, dv, uL) {
      const w = pt.x1 - pt.x0, g = new THREE.BoxGeometry(w, h, pt.z1 - pt.z0);
      const uv = g.attributes.uv, span = uL || L, half = span / 2;
      const fu = (pt.x0 + half) / span, bu = (half - pt.x1) / span, du = w / span;
      for (let face = 0; face < 6; face++) {
        for (let i = 0; i < 4; i++) {
          const k = face * 4 + i;
          if (face === 4) uv.setX(k, fu + uv.getX(k) * du);
          else if (face === 5) uv.setX(k, bu + uv.getX(k) * du);
          if (dv !== null && face !== 2 && face !== 3) uv.setY(k, v0 + uv.getY(k) * dv);
        }
      }
      uv.needsUpdate = true;
      g.translate((pt.x0 + pt.x1) / 2, 0, (pt.z0 + pt.z1) / 2);
      return g;
    }
    const SLICE_GEOS = PARTS.map(function (pt) { const out = []; for (let lv = 0; lv < LEVELS; lv++) out.push(partGeo(pt, FH, lv / LEVELS, 1 / LEVELS)); return out; });

    /* reservados: as janelas do apto reservado piscam em amarelo, nas duas fachadas compridas (vidro por cima do vidro, a 3 cm) */
    const RES_COLOR = 0xFFB21F;
    const resMat = new THREE.MeshBasicMaterial({ color: lin(RES_COLOR), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
    const resMini = std({ color: 0xFFFFFF, roughness: 0.85, emissive: new THREE.Color(RES_COLOR), emissiveIntensity: 0.5 });
    const resMiniDim = std({ color: 0xFFFFFF, roughness: 0.85, emissive: new THREE.Color(RES_COLOR), emissiveIntensity: 0.5, transparent: true, opacity: 0.25, depthWrite: false });
    let anyReserved = false;
    function reservedGeo(torre, lv) {
      const pos = [];
      [[facFront, false], [facBack, true]].forEach(function (fb) {
        const f = fb[0], back = fb[1];
        f.wins.forEach(function (w) {
          if (w.kind !== 'unit' || w.lv !== lv || lv === 0) return;
          const u = unitOfBay(w.b, back);
          if (!u || statusOf(torre, lv, u) !== 'reservado') return;
          const m0 = w.x / PXM - HL, m1 = (w.x + w.w) / PXM - HL;
          const x0 = back ? -m1 : m0, x1 = back ? -m0 : m1;
          const yt = (1 - w.y / f.H) * TOP - (lv * FH + FH / 2), yb = (1 - (w.y + w.h) / f.H) * TOP - (lv * FH + FH / 2);
          const pt = partAt((x0 + x1) / 2), z = back ? pt.z0 - 0.03 : pt.z1 + 0.03;
          if (!back) pos.push(x0, yb, z, x1, yb, z, x1, yt, z, x0, yb, z, x1, yt, z, x0, yt, z);
          else pos.push(x1, yb, z, x0, yb, z, x0, yt, z, x1, yb, z, x0, yt, z, x1, yt, z);
        });
      });
      if (!pos.length) return null;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      return g;
    }
    // pisca devagar (1,4 s), com o aceso mais longo que o apagado
    function pulseAt(now) { const s = 0.5 + 0.5 * Math.sin(now / 1000 * Math.PI * 2 / 1.4); return s * s * (3 - 2 * s); }
    function setPulse(now) {
      const k = pulseAt(now);
      resMat.opacity = 0.1 + 0.85 * k;
      resMini.emissiveIntensity = resMiniDim.emissiveIntensity = (night ? 0.25 : 0.12) + (night ? 1.0 : 0.75) * k;
      Object.keys(unitMats).forEach(function (key) { if (key.indexOf('reservado') === 0) unitMats[key].emissiveIntensity = 0.15 + 0.85 * k; });
      Object.keys(planMats).forEach(function (key) { if (key.indexOf('|reservado') > 0) planMats[key].color.copy(lin(0x272C37)).lerp(lin(0xFFC452), 0.15 + 0.6 * k); });
      return k;
    }

    const towers = {};
    const pickables = [];
    const hlMat = new THREE.MeshBasicMaterial({ color: lin(colors.gold), transparent: true, opacity: 0.32, depthWrite: false });
    const hlEdgeMat = new THREE.LineBasicMaterial({ color: lin(colors.gold) });
    TOWERS.forEach(function (T, ti) {
      const root = new THREE.Group(); root.position.set(T.x, 0, T.z); scene.add(root);
      const fMat = facadeMat(mapFront, LIGHTS[T.id].front), bMat = facadeMat(mapBack, LIGHTS[T.id].back);
      // faces: +x, -x, cima, baixo, frente (+z), fundos (-z); as pontas do prédio têm a fachada lateral, as faces internas são lisas
      const partMats = [
        [M.plain, ti === 0 ? M.endA : M.endB, M.roof, M.roof, fMat, bMat],
        [M.plain, M.plain, M.roof, M.roof, fMat, bMat],
        [ti === 0 ? M.endB : M.endA, M.plain, M.roof, M.roof, fMat, bMat]
      ];
      const slices = [], resv = [], resG = new THREE.Group(); root.add(resG);
      for (let lv = 0; lv < LEVELS; lv++) {
        const sg = new THREE.Group(); sg.position.y = lv * FH + FH / 2; sg.visible = false; root.add(sg);
        PARTS.forEach(function (pt, pi) {
          const m = new THREE.Mesh(SLICE_GEOS[pi][lv], partMats[pi]);
          m.castShadow = true; m.receiveShadow = true;
          m.userData = { torre: T.id, andar: lv };
          sg.add(m);
          if (lv > 0) pickables.push(m);
        });
        const rg = reservedGeo(T.id, lv);
        if (rg) { const rm = new THREE.Mesh(rg, resMat); rm.renderOrder = 2; rm.position.y = sg.position.y; resG.add(rm); resv[lv] = rm; anyReserved = true; }
        slices.push(sg);
      }
      // a torre inteira numa malha por material (as 39 fatias viram ~5 chamadas de desenho, também na sombra);
      // as fatias continuam existindo para abrir um andar e para o mouse saber em que andar está
      const whole = new THREE.Group(); root.add(whole);
      (function () {
        const buckets = new Map();
        for (let lv = 0; lv < LEVELS; lv++) PARTS.forEach(function (pt, pi) {
          const g = SLICE_GEOS[pi][lv].index ? SLICE_GEOS[pi][lv].toNonIndexed() : SLICE_GEOS[pi][lv].clone();
          g.translate(0, lv * FH + FH / 2, 0);
          g.groups.forEach(function (gr) {
            if ((gr.materialIndex === 2 && lv < LEVELS - 1) || (gr.materialIndex === 3 && lv > 0)) return;   // lajes internas não aparecem
            const mat = partMats[pi][gr.materialIndex];
            if (!buckets.has(mat)) buckets.set(mat, []);
            buckets.get(mat).push([g, gr.start, gr.count]);
          });
        });
        buckets.forEach(function (list, mat) {
          let n = 0; list.forEach(function (it) { n += it[2]; });
          const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
          let o = 0;
          list.forEach(function (it) {
            const a = it[0].attributes;
            pos.set(a.position.array.subarray(it[1] * 3, (it[1] + it[2]) * 3), o * 3); nor.set(a.normal.array.subarray(it[1] * 3, (it[1] + it[2]) * 3), o * 3);
            uv.set(a.uv.array.subarray(it[1] * 2, (it[1] + it[2]) * 2), o * 2); o += it[2];
          });
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
          geo.computeBoundingSphere();
          const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; whole.add(m);
        });
      })();
      // coroamento, laje de cobertura e núcleo que sobe acima do telhado com o quadro dourado
      const top = new THREE.Group(); root.add(top);
      PARTS.forEach(function (pt) {
        const cp = { x0: pt.x0 - 0.1, x1: pt.x1 + 0.1, z0: pt.z0 - 0.1, z1: pt.z1 + 0.1 };
        const crown = new THREE.Mesh(partGeo(cp, CROWN, 0, null, L + 0.2), [M.crownS, M.crownS, M.roof, M.roof, M.crownL, M.crownL]);
        crown.position.y = TOP + CROWN / 2; crown.castShadow = true; top.add(crown);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(pt.x1 - pt.x0 - 0.4, 0.1, pt.z1 - pt.z0 - 0.4), M.roof);
        cap.position.set((pt.x0 + pt.x1) / 2, TOP + 0.35, (pt.z0 + pt.z1) / 2); top.add(cap);
      });
      const coreZ = WING_DZ / 2;
      const core = new THREE.Mesh(new THREE.BoxGeometry(CORE_W, CORE_UP, CORE_D), M.graphite);
      core.position.set(0, TOP + CORE_UP / 2, coreZ); core.castShadow = true; top.add(core);
      [1, -1].forEach(function (s) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), M.gold);
        p.position.set(0, TOP + CORE_UP - 1.35, coreZ + s * (CORE_D / 2 + 0.02)); if (s < 0) p.rotation.y = Math.PI; top.add(p);
      });
      // sacadas: piso saliente, guarda-corpo de vidro e corrimão (instanciados, em ordem de andar)
      const nb = FLOORS * 4;
      const balcSlab = new THREE.InstancedMesh(new THREE.BoxGeometry(LOGGIA, 0.14, 0.32), M.slabEdge, nb);
      const balcGlass = new THREE.InstancedMesh(new THREE.PlaneGeometry(LOGGIA, 0.95), M.glass, nb);
      const balcRail = new THREE.InstancedMesh(new THREE.BoxGeometry(LOGGIA, 0.05, 0.06), M.rail, nb);
      let k = 0;
      for (let f = 1; f <= FLOORS; f++) {
        const bxL = -HL + LOGGIA_IN + LOGGIA / 2, bxR = HL - LOGGIA_IN - LOGGIA / 2;
        [[bxL, 1], [bxR, 1], [bxL, -1], [bxR, -1]].forEach(function (b) {
          const y = f * FH, dz = dzAt(b[0]);
          dm.rotation.set(0, b[1] > 0 ? 0 : Math.PI, 0);
          dm.position.set(b[0], y + 0.02, dz + b[1] * (HD + 0.12)); dm.updateMatrix(); balcSlab.setMatrixAt(k, dm.matrix);
          dm.position.set(b[0], y + 0.6, dz + b[1] * (HD + 0.26)); dm.updateMatrix(); balcGlass.setMatrixAt(k, dm.matrix);
          dm.position.set(b[0], y + 1.1, dz + b[1] * (HD + 0.26)); dm.updateMatrix(); balcRail.setMatrixAt(k, dm.matrix);
          k++;
        });
      }
      const lsB = []; for (let lv = 0; lv <= LEVELS; lv++) lsB.push(Math.max(0, (lv - 1) * 4));
      [balcSlab, balcGlass, balcRail].forEach(function (im) { im.instanceMatrix.needsUpdate = true; im.castShadow = im !== balcGlass; im.userData.ls = lsB; root.add(im); });
      // vidro das janelas (reflexo do céu) e peitoris, instanciados em ordem de andar (para esconder o andar aberto)
      const wl = [];
      [[facFront, false], [facBack, true]].forEach(function (fb) {
        fb[0].wins.forEach(function (w) {
          const m0 = w.x / PXM - HL, m1 = (w.x + w.w) / PXM - HL, back = fb[1];
          const x0 = back ? -m1 : m0, x1 = back ? -m0 : m1, pt = partAt((x0 + x1) / 2);
          const yt = (1 - w.y / fb[0].H) * TOP, yb = (1 - (w.y + w.h) / fb[0].H) * TOP;
          wl.push({ lv: w.lv, x0: x0, x1: x1, yt: yt, yb: yb, back: back, z: back ? pt.z0 : pt.z1, sill: (w.kind === 'unit' || w.kind === 'ground') && yt - yb < 1.5 });
        });
      });
      wl.sort(function (a, b) { return a.lv - b.lv || a.x0 - b.x0; });
      const nS = wl.filter(function (w) { return w.sill; }).length;
      const wGlass = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), M.winGlass, wl.length), wSill = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.05, 0.1), M.sill, nS);
      const lsG = [], lsS = []; let ks = 0;
      wl.forEach(function (w, i) {
        while (lsG.length <= w.lv) lsG.push(i);
        while (lsS.length <= w.lv) lsS.push(ks);
        dm.rotation.set(0, w.back ? Math.PI : 0, 0); dm.scale.set(w.x1 - w.x0, w.yt - w.yb, 1);
        dm.position.set((w.x0 + w.x1) / 2, (w.yt + w.yb) / 2, w.z + (w.back ? -0.012 : 0.012)); dm.updateMatrix(); wGlass.setMatrixAt(i, dm.matrix);
        if (w.sill) { dm.scale.set(w.x1 - w.x0 + 0.12, 1, 1); dm.position.set((w.x0 + w.x1) / 2, w.yb - 0.06, w.z + (w.back ? -0.05 : 0.05)); dm.updateMatrix(); wSill.setMatrixAt(ks++, dm.matrix); }
      });
      while (lsG.length <= LEVELS) lsG.push(wl.length);
      while (lsS.length <= LEVELS) lsS.push(ks);
      dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1);
      wGlass.userData.ls = lsG; wSill.userData.ls = lsS; wSill.receiveShadow = true;
      [wGlass, wSill].forEach(function (im) { im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; root.add(im); });
      wGlass.renderOrder = 1;
      // destaque do andar sob o mouse
      const hl = new THREE.Group(); hl.visible = false; root.add(hl);
      PARTS.forEach(function (pt) {
        const hb = new THREE.Mesh(new THREE.BoxGeometry(pt.x1 - pt.x0 + 0.7, FH - 0.06, pt.z1 - pt.z0 + 0.7), hlMat);
        hb.position.set((pt.x0 + pt.x1) / 2, 0, (pt.z0 + pt.z1) / 2); hl.add(hb);
        const he = new THREE.LineSegments(new THREE.EdgesGeometry(hb.geometry), hlEdgeMat); he.position.copy(hb.position); hl.add(he);
      });
      // volume fantasma dos andares acima do andar aberto
      const ghost = new THREE.Group(); ghost.visible = false; root.add(ghost);
      towers[T.id] = { T: T, root: root, slices: slices, whole: whole, resv: resv, top: top, balc: [balcSlab, balcGlass, balcRail, wGlass, wSill], hl: hl, ghost: ghost, plate: null };
    });

    /* ---------------- condomínio: muro, portaria, entradas das torres, lazer ---------------- */
    const S_ = { };                                              // materiais do térreo
    const siteG = new THREE.Group(); scene.add(siteG);           // peças paradas do condomínio (juntadas por material no fim)
    // o salão por dentro só aparece para quem anda (ou voa) no térreo: de longe o telhado cobre tudo, e são muitas peças
    const hallInt = new THREE.Group(); hallInt.visible = false; scene.add(hallInt);
    let GRP = siteG;                                             // onde box/rbox/inst põem as peças (siteG ou hallInt)
    const hostG = function () { return GRP === siteG ? scene : GRP; };   // peças que se mexem: na cena (ou no salão)
    const DOOR_SOLIDS = {};                                      // porta de vidro de cada torre: fechada para quem não visita aquela torre

    /* ---------------- o que o visitante usa no térreo ----------------
       Salão de festas (luzes, TV, geladeira, churrasqueira, torneira, sofá e cadeiras), churrasqueiras e pias dos quiosques,
       balanço, escorregador, gangorra, gira-gira e cavalinho da pracinha, espreguiçadeiras, guarda-sóis, ducha e a água das
       piscinas, pet care, bancos e os portões da portaria. Cada coisa tem caixas de clique invisíveis (fora da cena), o texto
       da mira, o que o clique faz (às vezes devolve uma pose para a visita: sentar, deitar, andar de balanço, nadar) e a
       animação dela. Paredes e vidros do salão entram como anteparo: não se clica através deles. */
    const PROPS = [], propHits = [], LIGHT_SRC = [], AUTO_DOORS = [], NIGHT_HOOKS = [];
    const HIT_GEO = new THREE.BoxGeometry(1, 1, 1), HIT_MAT = new THREE.MeshBasicMaterial();
    function hitBox(x0, y0, z0, x1, y1, z1, owner) {
      const m = new THREE.Mesh(HIT_GEO, HIT_MAT);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      m.scale.set(Math.max(0.02, Math.abs(x1 - x0)), Math.max(0.02, Math.abs(y1 - y0)), Math.max(0.02, Math.abs(z1 - z0)));
      m.updateMatrixWorld(true); m.userData.prop = owner || null; propHits.push(m);
      return m;
    }
    // b: caixas [x0, y0, z0, x1, y1, z1] em metros do mundo
    function prop(o, boxes) {
      o.id = PROPS.length; PROPS.push(o);
      (boxes || []).forEach(function (b) { hitBox(b[0], b[1], b[2], b[3], b[4], b[5], o); });
      return o;
    }
    const occluder = function (r, y0, y1) { hitBox(r[0], y0, r[1], r[2], y1, r[3], null); };
    function propPick(ray) {
      const hits = ray.intersectObjects(propHits, false);
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i], p = h.object.userData.prop;
        if (!p) return null;                                       // parede ou vidro na frente
        if (h.distance > (p.reach || 3.3)) return null;
        return { id: p.id, distance: h.distance, point: [h.point.x, h.point.y, h.point.z] };
      }
      return null;
    }
    let propBusy = 0;                                             // até quando algo do térreo ainda se mexe sozinho
    const propApi = {
      pick: propPick,
      label: function (id, pt, riding) { const p = PROPS[id]; return p ? p.label(pt, riding) : ''; },
      act: function (id, pt, riding) {
        const p = PROPS[id]; if (!p) return null;
        const r = p.act(pt, riding) || null;
        dirty = true; propBusy = performance.now() + 2500; placeCorrLights();
        return r;
      }
    };
    // pose para a visita a partir de um assento: olho em (x, h, z), virado para yaw (0 = +z), levanta a d metros para a frente
    function seatAt(x, z, yaw, h, d, kind, hud) {
      const sx = Math.sin(yaw), cz = Math.cos(yaw);
      return { kind: kind || 'sit', hud: hud, eye: [x, h, z], look: [x + sx * 3, h - (kind === 'lie' ? -0.4 : 0.32), z + cz * 3], stand: [x + sx * (d || 0.75), z + cz * (d || 0.75)] };
    }
    // grupo de assentos: o clique senta no mais perto do ponto mirado
    function seats(name, list, boxes, reach) {
      return prop({
        reach: reach || 3.3,
        label: function (pt, riding) { return riding ? (list[0].kind === 'lie' ? 'Levantar da espreguiçadeira' : 'Levantar') : name; },
        act: function (pt, riding) {
          if (riding) return { stand: true };
          let best = list[0], bd = Infinity;
          list.forEach(function (s) { const d = Math.hypot(s.eye[0] - pt[0], s.eye[2] - pt[2]); if (d < bd) { bd = d; best = s; } });
          return { pose: best };
        }
      }, boxes);
    }
    function stepProps(dt, now, cam) {
      let busy = false;
      for (let i = 0; i < PROPS.length; i++) { const p = PROPS[i]; if (p.step && p.step(dt, now, cam)) busy = true; }
      AUTO_DOORS.forEach(function (d) {
        const want = Math.hypot(cam.position.x - d.c[0], cam.position.z - d.c[1]) < d.r ? 1 : 0;
        if (Math.abs(want - d.k) > 0.001) {
          d.k += Math.sign(want - d.k) * Math.min(Math.abs(want - d.k), dt * 1.9);
          const e = d.k * d.k * (3 - 2 * d.k);
          d.leaves.forEach(function (l, i) { l.position[d.axis] = l.userData.p0 + (i ? 1 : -1) * d.w * e; });
          busy = true;
        }
      });
      return busy;
    }
    function resetProps() {
      PROPS.forEach(function (p) { if (p.reset) p.reset(); });
      AUTO_DOORS.forEach(function (d) { d.k = 0; d.leaves.forEach(function (l) { l.position[d.axis] = l.userData.p0; }); });
    }

    (function buildSite() {
      const solid = function (x0, z0, x1, z1) { GROUND_SOLIDS.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]); };
      // UV em metros: as texturas de concreto, muro e piso não esticam nas peças compridas
      const worldUV = function (geo, k) {
        const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
          uv.setXY(i, (ax > 0.5 ? p.getZ(i) : p.getX(i)) / k, (ay > 0.5 ? p.getZ(i) : p.getY(i)) / k);
        }
        uv.needsUpdate = true; return geo;
      };
      const box = function (mat, w, h, d, x, y, z, block, shadow) {
        const geo = new THREE.BoxGeometry(w, h, d);
        if (mat.map && mat.map.wrapS === THREE.RepeatWrapping && mat.userData.metric) worldUV(geo, mat.userData.metric);
        const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
        m.castShadow = shadow !== false; m.receiveShadow = true; GRP.add(m);
        if (block) solid(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
        return m;
      };
      const rbox = function (mat, r, y0, y1, block, shadow) { return box(mat, r[2] - r[0], y1 - y0, r[3] - r[1], (r[0] + r[2]) / 2, (y0 + y1) / 2, (r[1] + r[3]) / 2, block, shadow); };
      const inst = function (geo, mat, list, place, shadow) {
        if (!list.length) return null;
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach(function (it, i) { dm.position.set(0, 0, 0); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); place(it, i); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); });
        im.instanceMatrix.needsUpdate = true; im.castShadow = shadow !== false; im.receiveShadow = true; GRP.add(im);
        return im;
      };
      const noiseTex = function (base, n, seed, w, h) {
        const c = canvas(w || 128, h || 128), g = c.getContext('2d'), R = rng(seed);
        g.fillStyle = base; g.fillRect(0, 0, c.width, c.height);
        for (let i = 0; i < n; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.07)'; g.fillRect(R() * c.width, R() * c.height, 1 + R() * 3, 1 + R() * 3); }
        const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
      };
      function tilesTex(base, grout, n, seed) {
        const c = canvas(256, 256), g = c.getContext('2d'), R = rng(seed), s = 256 / n, bc = new THREE.Color(base);
        g.fillStyle = grout; g.fillRect(0, 0, 256, 256);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = '#' + bc.clone().offsetHSL(0, 0, (R() - 0.5) * 0.05).getHexString(); g.fillRect(i * s + 1.3, j * s + 1.3, s - 2.6, s - 2.6); }
        const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
      }
      // ondinhas da água: soma de ondas que fecham na borda (a textura repete sem emenda), normal analítica
      function waterNormal() {
        const N = 256, c = canvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N), R = rng(99);
        const W = [[3, 1, 1], [-2, 5, 0.7], [4, -3, 0.6], [7, 2, 0.35], [1, -6, 0.4], [9, -5, 0.2], [-11, 4, 0.15]].map(function (w) { return [w[0], w[1], w[2], R() * 6.283]; });
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          let dx = 0, dy = 0;
          for (let k = 0; k < W.length; k++) { const w = W[k], q = Math.cos(6.283 * (w[0] * x + w[1] * y) / N + w[3]) * w[2]; dx += q * w[0]; dy += q * w[1]; }
          const nx = -dx * 0.05, ny = -dy * 0.05, l = Math.hypot(nx, ny, 1), i = (y * N + x) * 4;
          img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        const t = tex(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
      }
      Object.assign(S_, {
        concrete: std({ color: 0xFFFFFF, map: noiseTex('#A9A7A1', 900, 3), roughness: 0.95 }),
        wall: std({ color: 0xFFFFFF, map: noiseTex('#C9C6BE', 700, 4), roughness: 0.95 }),
        white: std({ color: 0xEEEFEF, roughness: 0.7 }),
        dark: std({ color: 0x353940, roughness: 0.6 }),
        navy: std({ color: 0x22318A, roughness: 0.7 }),
        yellow: std({ color: 0xF0B323, roughness: 0.45, emissive: new THREE.Color(0xF0B323), emissiveIntensity: 0 }),
        wood: std({ color: 0x9A6B43, roughness: 0.7 }),
        brick: std({ color: 0xA4553F, roughness: 0.9 }),
        steel: std({ color: 0xB9BEC4, roughness: 0.4, metalness: 0.3 }),
        stone: std({ color: 0xF1EEE8, roughness: 0.8 }),
        red: std({ color: 0xD24B3E, roughness: 0.6 }), blue: std({ color: 0x2F62B5, roughness: 0.6 }), green: std({ color: 0x2E8A5A, roughness: 0.6 }),
        tank: std({ color: 0x2E79C9, roughness: 0.5 }),
        floorIn: std({ color: 0xFFFFFF, map: tilesTex('#E9E5DD', '#CFC9BE', 4, 9), roughness: 0.32 }),
        poolTile: std({ color: 0xFFFFFF, map: tilesTex('#9FD9EC', '#7DBFD6', 10, 6), roughness: 0.3 }),
        poolBand: std({ color: 0x1F4E8C, roughness: 0.3 }),
        poolLight: std({ color: 0xDDEFFF, roughness: 0.2, emissive: new THREE.Color(0x9FE6FF), emissiveIntensity: 0 }),
        cushion: std({ color: 0xE6DECB, roughness: 0.9 }),
        cloth: std({ color: 0xF7F6F2, roughness: 0.85 }),
        fabric: std({ color: 0x3D4A72, roughness: 0.9 }),
        glassDark: new THREE.MeshStandardMaterial({ color: lin(0x10161D), roughness: 0.12, metalness: 0.25, envMapIntensity: 0.8 }),
        rubber: std({ color: 0x1C1E22, roughness: 0.85 }),
        grey: std({ color: 0x4A4F57, roughness: 0.78 }),                 // guarita e pet care
        canopy: std({ color: 0x2A2E35, roughness: 0.9, envMapIntensity: 0.4 }),
        granite: std({ color: 0x1E2023, roughness: 0.26, envMapIntensity: 0.9 }),
        gloss: std({ color: 0xF3F3F1, roughness: 0.3 }),
        orange: std({ color: 0xE8862E, roughness: 0.6 }),
        purple: std({ color: 0x7B4FA8, roughness: 0.6 }),
        petGreen: std({ color: 0x3B7D3A, roughness: 0.6 }),
        oak: std({ color: 0xB98A5A, roughness: 0.6 }),                  // ripado e móveis claros do salão
        leather: std({ color: 0x6E4B33, roughness: 0.55 }),
        sofa: std({ color: 0x8C8F94, roughness: 0.95 }),
        black: std({ color: 0x15171A, roughness: 0.4 }),
        // água da piscina: transparente (o fundo de pastilha aparece), reflete o céu, ondinhas no normal map
        water: new THREE.MeshStandardMaterial({ color: lin(0x1B97BC), roughness: 0.03, metalness: 0, normalMap: waterNormal(), normalScale: new THREE.Vector2(0.32, 0.32),
          transparent: true, opacity: 0.66, depthWrite: false, envMapIntensity: 1.5, emissive: lin(0x0A5C78), emissiveIntensity: 0.12 })
      });
      S_.concrete.userData.metric = 1.6; S_.wall.userData.metric = 1.6; S_.floorIn.userData.metric = 2.4; S_.poolTile.userData.metric = 1.0;
      // pisos com textura em metros por cima do desenho do lote (o desenho vale de longe; de perto aparecem as tábuas e as peças)
      const floorTex = function (w, h, draw, rx, ry) { const c = canvas(w, h); draw(c.getContext('2d'), w, h); const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
      const paverTex = floorTex(256, 256, function (g, w, h) {                    // 2 m x 2 m de placas de 50 cm em junta corrida
        const RR = rng(43), s = w / 4;
        g.fillStyle = '#A8A397'; g.fillRect(0, 0, w, h);
        for (let j = 0; j < 4; j++) for (let i = -1; i < 4; i++) {
          const x = i * s + (j % 2) * s / 2, v = (RR() - 0.5) * 16;
          g.fillStyle = 'rgb(' + Math.round(206 + v) + ',' + Math.round(201 + v) + ',' + Math.round(191 + v) + ')'; g.fillRect(x + 1.5, j * s + 1.5, s - 3, s - 3);
          for (let k = 0; k < 40; k++) { g.fillStyle = RR() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)'; g.fillRect(x + RR() * s, j * s + RR() * s, 2, 2); }
        }
      }, 0.5, 0.5);
      const brickTex = floorTex(256, 256, function (g, w, h) {                    // 1 m x 1 m de tijolinho 20 x 10 cm, espinha de peixe simples (junta trançada)
        const RR = rng(47), u = w / 10;
        g.fillStyle = '#7A3C2C'; g.fillRect(0, 0, w, h);
        for (let j = 0; j < 10; j++) for (let i = 0; i < 5; i++) {
          const v = (RR() - 0.5) * 26, c = 'rgb(' + Math.round(181 + v) + ',' + Math.round(101 + v * 0.6) + ',' + Math.round(77 + v * 0.5) + ')';
          g.fillStyle = c;
          if ((i + j) % 2) g.fillRect(i * 2 * u + 1, j * u + 1, 2 * u - 2, u - 2); else { g.fillRect(i * 2 * u + 1, j * u + 1, u - 2, u - 2); g.fillRect(i * 2 * u + u + 1, j * u + 1, u - 2, u - 2); }
        }
      }, 1, 1);
      const groundPlanes = function (rects, map, y, holes) {
        const geos = rects.map(function (r) {
          const sh = new THREE.Shape([new THREE.Vector2(r[0], -r[1]), new THREE.Vector2(r[0], -r[3]), new THREE.Vector2(r[2], -r[3]), new THREE.Vector2(r[2], -r[1])]);
          (holes || []).forEach(function (q) { if (q[0] > r[0] && q[2] < r[2] && q[1] > r[1] && q[3] < r[3]) sh.holes.push(new THREE.Path([new THREE.Vector2(q[0], -q[1]), new THREE.Vector2(q[2], -q[1]), new THREE.Vector2(q[2], -q[3]), new THREE.Vector2(q[0], -q[3])])); });
          const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g;
        });
        const mat = withDetail(std({ map: map, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), new THREE.Vector2(0.37, 0.37), 0.1);
        const m = new THREE.Mesh(mergeGeos(geos), mat); m.position.y = y; m.receiveShadow = true; m.userData.keep = true; siteG.add(m); return m;
      };
      // porcelanato claro (placas de 60 cm) no deque da piscina e na varanda do salão
      const porcTex = floorTex(256, 256, function (g, w, h) {
        const RR = rng(53), s = w / 4;
        g.fillStyle = '#B4AEA2'; g.fillRect(0, 0, w, h);
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
          const v = (RR() - 0.5) * 9;
          g.fillStyle = 'rgb(' + Math.round(222 + v) + ',' + Math.round(215 + v) + ',' + Math.round(203 + v) + ')'; g.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
          for (let k = 0; k < 70; k++) { g.fillStyle = RR() < 0.5 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.05)'; g.fillRect(i * s + RR() * s, j * s + RR() * s, 2, 2); }
        }
      }, 1 / 2.4, 1 / 2.4);
      groundPlanes([POOLA.fence, [TERR[0], TERR[1], TERR[2] + 0.2, TERR[3]]], porcTex, 0.006, [POOLA.adult, POOLA.kids].map(function (p) { return [p[0] - 0.02, p[1] - 0.02, p[2] + 0.02, p[3] + 0.02]; }));
      groundPlanes(KIOSKS.map(function (cx) { return [cx - 4.2, 16.6, cx + 4.2, 31.8]; }).concat([PLAZA, [56, -21, HALL[0], PLAZA[1]], [PET[2] - 5, PET[1] + 0.2, PET[2] - 0.2, PET[1] + 3.6],
        [-41, 52, -16, LOT.z1], [-36.4, LOT.z1, -14, 66], [TRASH[0] - 0.5, TRASH[1] - 0.5, TRASH[2] + 0.5, LOT.z1]])
        .concat(TOWERS.map(function (t) { return [t.x - 3.2, t.z + ENTRY_Z, t.x + 3.2, 9.5]; })), paverTex, 0.01);
      groundPlanes([[-80, 9.5, BACK.links[0][0], 14.6], [BACK.links[0][2], 9.5, 61, 14.6], [-80, 32.5, 64, 35]], brickTex, 0.006);
      // gradil (grade de barras verticais) desenhado com transparência; UV em metros para todas as grades usarem o mesmo material
      // (alpha to coverage: as barras finas ficam lisas, sem serrilhado nem moiré)
      const gradilMat = (function () {
        const c = canvas(64, 128), g = c.getContext('2d');
        g.fillStyle = '#2E3238';
        for (let x = 2; x < 64; x += 8) g.fillRect(x, 0, 2.6, 128);
        g.fillRect(0, 2, 64, 5); g.fillRect(0, 121, 64, 5);
        const t = tex(c); t.wrapS = THREE.RepeatWrapping;
        return new THREE.MeshStandardMaterial({ map: t, color: 0xFFFFFF, roughness: 0.55, metalness: 0.3, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide });
      })();
      const gradilGeo = function (len, h) {
        const geo = new THREE.PlaneGeometry(len, h), uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 0.55);
        return geo;
      };
      const gradil = function (x0, z0, x1, z1, y0, h) {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const m = new THREE.Mesh(gradilGeo(len, h), gradilMat);
        m.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); m.castShadow = true; siteG.add(m);
        solid(Math.min(x0, x1) - 0.06, Math.min(z0, z1) - 0.06, Math.max(x0, x1) + 0.06, Math.max(z0, z1) + 0.06);
        return m;
      };

      // ---------- muro: alto no fundo e nas laterais, mureta com gradil na frente (sul), aberta só na portaria ----------
      rbox(S_.wall, [LOT.x0, LOT.z0 - 0.2, LOT.x1, LOT.z0], 0, 2.4, true);
      rbox(S_.wall, [LOT.x0 - 0.2, LOT.z0, LOT.x0, LOT.z1], 0, 2.4, true);
      rbox(S_.wall, [LOT.x1, LOT.z0, LOT.x1 + 0.2, LOT.z1], 0, 2.4, true);
      [[LOT.x0, PILLAR[0]], [PILLAR[2], -35.15], [GUARD[2], LOT.x1]].forEach(function (s) {
        rbox(S_.wall, [s[0], LOT.z1, s[1], LOT.z1 + 0.25], 0, 0.6, true);
        gradil(s[0], LOT.z1 + 0.12, s[1], LOT.z1 + 0.12, 0.6, 1.6);
      });
      for (let x = LOT.x0; x <= LOT.x1; x += 3) if (x < PILLAR[0] - 0.4 || x > GUARD[2] + 0.4) box(S_.wall, 0.35, 2.3, 0.35, x, 1.15, LOT.z1 + 0.12);

      // ---------- portaria, como na foto da Baliza: pilar de concreto com MILÃO à esquerda de quem chega, gradil preto com o
      // portão de pedestres, portão de carros de correr, marquise escura em balanço sobre a entrada, guarita cinza-escura à
      // direita com rampa e corrimão, canteiro de flores roxas e piso intertravado ----------
      const nameC = canvas(256, 640), ng = nameC.getContext('2d');
      ng.fillStyle = '#A29F99'; ng.fillRect(0, 0, 256, 640);
      const NR = rng(5);
      for (let i = 0; i < 1800; i++) { ng.fillStyle = NR() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)'; ng.fillRect(NR() * 256, NR() * 640, 2 + NR() * 5, 2 + NR() * 5); }
      ng.strokeStyle = 'rgba(60,60,60,.22)'; ng.lineWidth = 2;
      [128, 256, 384, 512].forEach(function (y) { ng.beginPath(); ng.moveTo(0, y); ng.lineTo(256, y); ng.stroke(); });   // juntas das fôrmas
      ng.fillStyle = 'rgba(55,55,55,.32)';
      [64, 192, 320, 448, 576].forEach(function (y) { [34, 222].forEach(function (x) { ng.beginPath(); ng.arc(x, y, 4.5, 0, 6.3); ng.fill(); }); });   // furos dos tirantes
      ng.textAlign = 'center'; ng.textBaseline = 'middle';
      ng.font = '600 15px Archivo, Arial, sans-serif'; ng.fillStyle = 'rgba(255,255,255,.35)'; ng.fillText('R E S I D E N C I A L', 129, 349);
      ng.fillStyle = '#2E2F31'; ng.fillText('R E S I D E N C I A L', 128, 348);
      ng.font = '700 58px Archivo, Arial, sans-serif'; ng.fillStyle = 'rgba(255,255,255,.4)'; ng.fillText('MILÃO', 130, 398);   // letra em relevo: luz em baixo
      ng.fillStyle = '#242526'; ng.fillText('MILÃO', 128, 396);
      const pillarFront = std({ map: tex(nameC), roughness: 0.92 });
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(PILLAR[2] - PILLAR[0], 6.4, 1.3), [S_.concrete, S_.concrete, S_.concrete, S_.concrete, pillarFront, pillarFront]);
      pillar.position.set((PILLAR[0] + PILLAR[2]) / 2, 3.2, (PILLAR[1] + PILLAR[3]) / 2); pillar.castShadow = true; pillar.receiveShadow = true; siteG.add(pillar);
      solid(PILLAR[0], PILLAR[1] - 0.05, PILLAR[2], PILLAR[3]);
      rbox(S_.concrete, [-44.2, PILLAR[3] + 0.05, -36.6, LOT.z1 + 3.0], 0, 0.18, false, false);   // canteiro das flores roxas, na frente do pilar
      rbox(std({ color: 0x4A3626, roughness: 1 }), [-44.05, PILLAR[3] + 0.2, -36.75, LOT.z1 + 2.85], 0.18, 0.2, false, false);
      // guarita: alvenaria cinza-escura, janelas escuras para a rua e para o portão de carros, porta para dentro
      const G0 = GUARD[0], G1 = GUARD[2], GZ0 = GUARD[1], GZ1 = GUARD[3];
      rbox(S_.grey, [G0, GZ0, G1, GZ1], 0, 1.0, true);
      rbox(S_.grey, [G1 - 0.25, GZ0, G1, GZ1], 1.0, 3.25, false);
      rbox(S_.grey, [G0, GZ0, G0 + 1.4, GZ0 + 0.25], 1.0, 3.25, false); rbox(S_.grey, [G0 + 2.4, GZ0, G1, GZ0 + 0.25], 1.0, 3.25, false);
      rbox(S_.grey, [G0 + 1.4, GZ0, G0 + 2.4, GZ0 + 0.25], 2.3, 3.25, false);
      rbox(S_.wood, [G0 + 1.45, GZ0 - 0.02, G0 + 2.35, GZ0 + 0.06], 0.02, 2.28, false);              // porta
      rbox(S_.glassDark, [G0, GZ0 + 0.25, G0 + 0.08, GZ1 - 0.25], 1.0, 2.5, false, false);              // janela para o portão
      rbox(S_.glassDark, [G0 + 0.25, GZ1 - 0.08, G1 - 0.25, GZ1], 1.0, 2.5, false, false);              // janela para a rua
      rbox(S_.grey, [G0, GZ0, G0 + 0.25, GZ0 + 0.25], 1.0, 3.25, false); rbox(S_.grey, [G0, GZ1 - 0.25, G0 + 0.25, GZ1], 1.0, 3.25, false);
      rbox(S_.grey, [G0 + 0.25, GZ1 - 0.25, G1, GZ1], 2.5, 3.25, false); rbox(S_.grey, [G0, GZ0 + 0.25, G0 + 0.25, GZ1 - 0.25], 2.5, 3.25, false);
      rbox(S_.white, [G0 + 0.3, GZ0 + 0.3, G1 - 0.3, GZ0 + 0.9], 0.75, 0.8, false, false);              // bancada do porteiro por dentro
      // marquise em balanço: laje escura que sai da guarita por cima dos portões, com luzes embutidas; dois pilares finos do lado do pilar MILÃO
      const MQ = [-37.4, 55, G1 + 0.2, 66.4];
      rbox(S_.canopy, MQ, 3.25, 3.62, false);
      rbox(S_.canopy, [MQ[0], MQ[3] - 0.08, MQ[2], MQ[3]], 2.95, 3.25, false);                         // testeira
      [[-36.8, 56.2], [-36.8, 65.6]].forEach(function (p) { box(S_.canopy, 0.22, 3.25, 0.22, p[0], 1.62, p[1], true); });
      const dl = []; for (let x = -35.5; x < G1 - 0.5; x += 2.6) [57.5, 60.5, 63.6].forEach(function (z) { if (!(x > G0 - 0.4 && z < GZ1 + 0.3)) dl.push([x, z]); });
      inst(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 14), lampHeads, dl, function (p) { dm.position.set(p[0], 3.24, p[1]); }, false);
      // rampa com corrimão à direita da guarita (de quem chega pela rua)
      const ramp0 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 4.0), S_.concrete); ramp0.position.set(G1 + 1.6, 0.12, LOT.z1 + 2.0); ramp0.rotation.x = 0.075; ramp0.receiveShadow = true; siteG.add(ramp0);
      [G1 + 0.4, G1 + 2.8].forEach(function (x) {
        const rl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.0, 8), S_.dark); rl.rotation.x = Math.PI / 2 + 0.075; rl.position.set(x, 1.0, LOT.z1 + 2.0); siteG.add(rl);
        for (let k = 0; k < 4; k++) box(S_.dark, 0.05, 0.95, 0.05, x, 0.6 - k * 0.05, LOT.z1 + 0.4 + k * 1.1, false, false);
      });
      solid(G1 + 0.35, LOT.z1, G1 + 2.85, LOT.z1 + 4.1);
      // portões: pedestres (gradil de abrir, ao lado do pilar) e carros (gradil de correr); o porteiro abre os dois
      [-35.15, -33.3, -25.85].forEach(function (x) { box(S_.dark, 0.2, 2.45, 0.2, x, 1.22, LOT.z1 + 0.12, true); });
      const pedPivot = new THREE.Group(); pedPivot.position.set(-35.05, 0, LOT.z1 + 0.12); scene.add(pedPivot);
      const pedLeaf = new THREE.Mesh(gradilGeo(1.6, 2.1), gradilMat); pedLeaf.position.set(0.82, 1.1, 0); pedLeaf.castShadow = true; pedPivot.add(pedLeaf);
      const carGate = new THREE.Mesh(gradilGeo(7.4, 2.1), gradilMat); carGate.position.set((ACCESS.x0 + ACCESS.x1) / 2, 1.1, LOT.z1 - 0.12); carGate.castShadow = true; scene.add(carGate);
      box(S_.steel, 7.6, 0.05, 0.08, (ACCESS.x0 + ACCESS.x1) / 2 - 3.6, 0.025, LOT.z1 - 0.12, false, false);   // trilho
      const gates = { car: 0, carOn: false, ped: 0, pedOn: false };
      const carGateX = carGate.position.x;
      const gateAnim = function (dt) {
        let busy = false;
        const tc = gates.carOn ? 1 : 0, tp = gates.pedOn ? 1 : 0;
        if (Math.abs(tc - gates.car) > 0.001) { gates.car += Math.sign(tc - gates.car) * Math.min(Math.abs(tc - gates.car), dt / 5.5); carGate.position.x = carGateX - 7.0 * gates.car; busy = true; }
        if (Math.abs(tp - gates.ped) > 0.001) { gates.ped += Math.sign(tp - gates.ped) * Math.min(Math.abs(tp - gates.ped), dt / 1.4); const e = gates.ped * gates.ped * (3 - 2 * gates.ped); pedPivot.rotation.y = 1.45 * e; busy = true; }
        if (!busy && gates.moved) { gates.moved = false; shadowDirty = true; }
        if (busy) gates.moved = true;
        return busy;
      };
      prop({ reach: 4.5, label: function () { return gates.carOn ? 'Fechar o portão de carros' : 'Abrir o portão de carros'; },
        act: function () { gates.carOn = !gates.carOn; }, step: gateAnim, reset: function () { gates.carOn = gates.pedOn = false; gates.car = gates.ped = 0; carGate.position.x = carGateX; pedPivot.rotation.y = 0; } },
      [[ACCESS.x0, 0, LOT.z1 - 0.4, ACCESS.x1, 2.2, LOT.z1 + 0.3], [-26.12, 1.1, LOT.z1 - 0.2, -25.95, 1.6, LOT.z1 + 0.3]]);
      box(S_.steel, 0.06, 0.3, 0.16, -26.0, 1.35, LOT.z1 + 0.05, false, false);                    // botoeira do portão, no pilarete ao lado da guarita
      prop({ reach: 3.5, label: function () { return gates.pedOn ? 'Fechar o portão de pedestres' : 'Abrir o portão de pedestres'; }, act: function () { gates.pedOn = !gates.pedOn; } },
        [[-35.0, 0, LOT.z1 - 0.3, -33.4, 2.2, LOT.z1 + 0.4]]);
      // abrigo de lixo
      rbox(S_.wall, TRASH, 0, 2.1, true);
      rbox(S_.dark, [TRASH[0] - 0.2, TRASH[1] - 0.2, TRASH[2] + 0.2, TRASH[3] + 0.2], 2.1, 2.25, false);
      rbox(S_.steel, [TRASH[0] + 0.4, TRASH[1] - 0.03, TRASH[2] - 0.4, TRASH[1]], 0.1, 1.9, false);

      // ---------- entradas das torres: pórtico azul-marinho, letra gigante amarela, bicicletário ----------
      function letterShape(ch) {
        const s = new THREE.Shape();
        if (ch === 'A') {
          [[-1, 0], [-0.32, 2.4], [0.32, 2.4], [1, 0], [0.56, 0], [0.4, 0.58], [-0.4, 0.58], [-0.56, 0]].forEach(function (p, i) { if (i) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); });
          const h = new THREE.Path(); h.moveTo(-0.26, 0.98); h.lineTo(0.26, 0.98); h.lineTo(0, 1.82); h.lineTo(-0.26, 0.98); s.holes.push(h);
        } else {
          s.moveTo(-0.8, 0); s.lineTo(-0.8, 2.4); s.lineTo(0.05, 2.4); s.absarc(0.05, 1.82, 0.58, Math.PI / 2, -Math.PI / 2, true);
          s.lineTo(0.15, 1.24); s.absarc(0.15, 0.62, 0.62, Math.PI / 2, -Math.PI / 2, true); s.lineTo(-0.8, 0);
          const h1 = new THREE.Path(); h1.moveTo(-0.38, 1.5); h1.lineTo(0.02, 1.5); h1.absarc(0.02, 1.79, 0.29, -Math.PI / 2, Math.PI / 2, false); h1.lineTo(-0.38, 2.08); h1.lineTo(-0.38, 1.5); s.holes.push(h1);
          const h2 = new THREE.Path(); h2.moveTo(-0.38, 0.36); h2.lineTo(0.12, 0.36); h2.absarc(0.12, 0.645, 0.285, -Math.PI / 2, Math.PI / 2, false); h2.lineTo(-0.38, 0.93); h2.lineTo(-0.38, 0.36); s.holes.push(h2);
        }
        return s;
      }
      const bikes = [];
      TOWERS.forEach(function (T) {
        // torres no térreo: colisão das alas e do núcleo; o hall de entrada (porta de vidro, caixas de correio, portas de trás
        // dos elevadores) fica aberto e a cabine é tratada pela visita (porta aberta ou fechada)
        solid(T.x + PARTS[0].x0 - 0.1, T.z + PARTS[0].z0 - 0.1, T.x + PARTS[0].x1 + 0.1, T.z + PARTS[0].z1 + 0.1);
        solid(T.x + PARTS[2].x0 - 0.1, T.z + PARTS[2].z0 - 0.1, T.x + PARTS[2].x1 + 0.1, T.z + PARTS[2].z1 + 0.1);
        const X = function (x) { return T.x + x; }, Z = function (z) { return T.z + z; };
        solid(X(-1.9), Z(PARTS[1].z0 - 0.1), X(1.9), Z(ZE + 0.15));
        solid(X(-1.9), Z(ZE + 0.13), X(LIFT.x - LIFT.w - 0.04), Z(LIFT.rear));
        solid(X(LIFT.x + LIFT.w + 0.04), Z(ZE + 0.13), X(1.9), Z(LIFT.rear));
        solid(X(-1.9), Z(LIFT.rear - 0.14), X(LIFT.x - LIFT.half), Z(LIFT.rear));
        solid(X(LIFT.x + LIFT.half), Z(LIFT.rear - 0.14), X(1.9), Z(LIFT.rear));
        solid(X(-1.9), Z(LIFT.rear), X(-1.68), Z(ENTRY_Z + 0.1)); solid(X(1.68), Z(LIFT.rear), X(1.9), Z(ENTRY_Z + 0.1));
        solid(X(-1.68), Z(LOBBY.mail[0] - 0.03), X(-1.38), Z(LOBBY.mail[1] + 0.03)); solid(X(1.18), Z(LOBBY.plant - 0.3), X(1.68), Z(LOBBY.plant + 0.3));
        solid(X(1.3), Z(LOBBY.bench[0] - 0.05), X(1.68), Z(LOBBY.bench[1] + 0.05));
        solid(X(-1.9), Z(ENTRY_Z - 0.07), X(-0.8), Z(ENTRY_Z + 0.1)); solid(X(0.8), Z(ENTRY_Z - 0.07), X(1.9), Z(ENTRY_Z + 0.1));
        DOOR_SOLIDS[T.id] = [X(-0.8), Z(ENTRY_Z - 0.07), X(0.8), Z(ENTRY_Z + 0.1)];
        const zf = T.z + ENTRY_Z;                                  // frente do núcleo (porta de vidro do hall de entrada)
        box(S_.navy, 0.45, 3.5, 0.45, T.x - 2.3, 1.75, zf + 2.6, true);
        box(S_.navy, 0.45, 3.5, 0.45, T.x + 2.3, 1.75, zf + 2.6, true);
        rbox(S_.navy, [T.x - 2.55, zf, T.x + 2.55, zf + 2.85], 3.5, 3.95, false);
        rbox(S_.dark, [T.x - 1.75, zf + 0.01, T.x + 1.75, zf + 0.06], 2.52, 3.5, false, false);
        rbox(S_.floorIn, [T.x - 2.55, zf, T.x + 2.55, zf + 2.85], 0, 0.06, false, false);
        [[-1.7, 0.0], [0, 1.7]].forEach(function (s) { rbox(lampHeads, [T.x + s[0] + 0.5, zf + 1.2, T.x + s[1] - 0.5, zf + 1.6], 3.47, 3.5, false, false); });   // luz embaixo do pórtico
        // letra gigante amarela sobre o canteiro, à esquerda de quem chega
        const lg = new THREE.ExtrudeGeometry(letterShape(T.id), { depth: 0.32, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 10 });
        const zl = T.z + HD;                                         // linha da fachada das alas
        const letter = new THREE.Mesh(lg, S_.yellow); letter.scale.set(1.15, 1.15, 1); letter.position.set(T.x - 5.6, 0.55, zl + 0.45); letter.castShadow = true; siteG.add(letter);
        rbox(S_.navy, [T.x - 7.2, zl + 0.2, T.x - 4.0, zl + 1.15], 0, 0.55, true);
        for (let i = 0; i < 5; i++) bikes.push([T.x - 12 + i * 0.75, zl + 0.75]);
      });
      // bicicletários: arcos de inox
      inst(new THREE.TorusGeometry(0.42, 0.03, 6, 16, Math.PI), S_.steel, bikes, function (p) { dm.position.set(p[0], 0, p[1]); });
      bikes.forEach(function (p) { solid(p[0] - 0.1, p[1] - 0.45, p[0] + 0.1, p[1] + 0.45); });

      // ---------- efeitos das coisas que se usam: fogo e fumaça das churrasqueiras, água das torneiras e duchas, TV ----------
      const FX = rng(808);
      const FIRE_COL = new THREE.Color(0xFF7A2E);
      const flameTex = (function () {
        const c = canvas(64, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 128, 0, 0);
        gr.addColorStop(0, 'rgba(255,246,214,1)'); gr.addColorStop(0.22, 'rgba(255,212,104,.95)'); gr.addColorStop(0.55, 'rgba(255,124,34,.72)'); gr.addColorStop(1, 'rgba(210,48,10,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(32, 0); g.bezierCurveTo(46, 34, 62, 70, 56, 102); g.bezierCurveTo(50, 128, 14, 128, 8, 102); g.bezierCurveTo(2, 70, 18, 34, 32, 0); g.fill();
        return tex(c);
      })();
      const flameMat = new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
      const flameGeo = new THREE.PlaneGeometry(0.2, 0.42); flameGeo.translate(0, 0.21, 0);
      const smokeTex = (function () {
        const c = canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
        gr.addColorStop(0, 'rgba(236,236,236,.8)'); gr.addColorStop(0.5, 'rgba(214,214,214,.36)'); gr.addColorStop(1, 'rgba(205,205,205,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return tex(c);
      })();
      // fogo: brasas que acendem, chamas em cruz que tremem e fumaça que sobe pela chaminé, abrindo e sumindo
      function makeFire(cx, cy, cz, w, d, top) {
        const f = { on: false, k: 0, flames: [], smoke: [], smokeLeft: false };
        const em = std({ color: 0x2A2420, roughness: 0.95, emissive: new THREE.Color(0xFF4A12), emissiveIntensity: 0 });
        const lumps = []; for (let i = 0; i < 16; i++) lumps.push([new THREE.BoxGeometry(0.09 + FX() * 0.07, 0.05 + FX() * 0.04, 0.08 + FX() * 0.06), mat4((FX() - 0.5) * w * 0.9, 0.03, (FX() - 0.5) * d * 0.8, FX(), FX() * 3, FX())]);
        const coals = new THREE.Mesh(mergeGeos(lumps), em); coals.position.set(cx, cy, cz); coals.receiveShadow = true; coals.userData.keep = true; hostG().add(coals);
        const fg = new THREE.Group(); fg.position.set(cx, cy + 0.04, cz); fg.visible = false; hostG().add(fg);
        const n = Math.max(3, Math.round(w / 0.28));
        for (let i = 0; i < n; i++) [0, Math.PI / 2].forEach(function (ry) {
          const m = new THREE.Mesh(flameGeo, flameMat); m.position.set(((i + 0.5) / n - 0.5) * w * 0.9, 0, (FX() - 0.5) * d * 0.5);
          m.rotation.y = ry + (FX() - 0.5) * 0.5; m.renderOrder = 4; m.frustumCulled = false; fg.add(m); f.flames.push({ m: m, ph: FX() * 6.3, s: 0.7 + FX() * 0.6 });
        });
        const sg = new THREE.Group(); sg.position.fromArray(top); sg.visible = false; scene.add(sg);
        for (let i = 0; i < 9; i++) {
          const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
          sm.renderOrder = 5; sg.add(sm); f.smoke.push({ s: sm, t: i / 9, dx: (FX() - 0.5) * 0.5, on: false });
        }
        f.step = function (dt, now) {
          if (!f.on && f.k === 0 && !f.smokeLeft) return false;
          f.k += ((f.on ? 1 : 0) - f.k) * Math.min(1, dt * (f.on ? 1.4 : 0.8)); if (!f.on && f.k < 0.01) f.k = 0;
          em.emissiveIntensity = 1.9 * f.k * (0.85 + 0.15 * Math.sin(now * 0.006));
          fg.visible = f.k > 0.03;
          f.flames.forEach(function (q) { const r = 0.72 + 0.26 * Math.sin(now * 0.021 + q.ph) + 0.14 * Math.sin(now * 0.057 + q.ph * 2); q.m.scale.set(0.8 + 0.35 * r, Math.max(0.01, q.s * r * f.k), 1); });
          let left = false;
          f.smoke.forEach(function (q) {
            q.t += dt / 3.6; if (q.t > 1) { q.t -= 1; q.on = f.on; }
            q.s.material.opacity = q.on ? Math.sin(Math.PI * q.t) * 0.42 * Math.max(0.35, f.k) : 0;
            if (q.on) left = true;
            q.s.position.set(q.dx * q.t + Math.sin(now * 0.0011 + q.t * 4) * 0.14, q.t * 2.6, q.dx * 0.6 * q.t);
            const sc = 0.32 + q.t * 1.6; q.s.scale.set(sc, sc, 1);
          });
          sg.visible = left; f.smokeLeft = left;
          return true;
        };
        LIGHT_SRC.push(function (now) { return f.k > 0.03 ? { x: cx, y: cy + 0.5, z: cz, k: (1.2 + 0.24 * Math.sin(now * 0.017) + 0.13 * Math.sin(now * 0.043)) * f.k, d: 8, col: FIRE_COL } : null; });
        f.reset = function () { f.on = false; f.k = 0; em.emissiveIntensity = 0; fg.visible = sg.visible = false; f.smokeLeft = false; f.smoke.forEach(function (q) { q.on = false; q.s.material.opacity = 0; }); };
        return f;
      }
      function fireProp(f, name, boxes) {
        return prop({ reach: 3.4, label: function () { return (f.on ? 'Apagar ' : 'Acender ') + name; }, act: function () { f.on = !f.on; }, step: f.step, reset: f.reset }, boxes);
      }
      // água: um tubo transparente com listras que descem e um respingo embaixo
      const streamTex = (function () {
        const c = canvas(16, 128), g = c.getContext('2d'), RR = rng(61);
        for (let y = 0; y < 128; y += 3) { g.fillStyle = 'rgba(255,255,255,' + (0.25 + RR() * 0.7).toFixed(2) + ')'; g.fillRect(0, y, 16, 1 + RR() * 2); }
        const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
      })();
      const streamMat = new THREE.MeshBasicMaterial({ map: streamTex, color: lin(0xDDF3FF), transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
      const STREAMS = [];
      function makeStream(x, y0, y1, z, r0, r1) {
        const s = { on: false, parts: [] };
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, y0 - y1, 12, 1, true), streamMat); c.position.set(x, (y0 + y1) / 2, z);
        const sp = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.05, r1 * 1.7), 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), streamMat); sp.position.set(x, y1, z); sp.scale.y = 0.35;
        [c, sp].forEach(function (m) { m.visible = false; m.renderOrder = 3; m.userData.keep = true; hostG().add(m); s.parts.push(m); });
        s.set = function (v) { s.on = v; s.parts.forEach(function (m) { m.visible = v; }); };
        STREAMS.push(s); return s;
      }
      prop({ label: function () { return ''; }, act: function () {}, step: function (dt, now) {
        if (!STREAMS.some(function (s) { return s.on; })) return false;
        streamTex.offset.y += dt * 2.6;
        STREAMS.forEach(function (s) { if (s.on) s.parts[1].scale.set(1 + Math.sin(now * 0.031) * 0.1, 0.35, 1 + Math.cos(now * 0.027) * 0.1); });
        return true;
      } });
      function tapProp(s, verbs, boxes) {
        return prop({ reach: 2.8, label: function () { return s.on ? verbs[1] : verbs[0]; }, act: function () { s.set(!s.on); }, reset: function () { s.set(false); } }, boxes);
      }
      // torneira gourmet (bica em arco) sobre a bancada; dir = +1 bico para +z, -1 para -z; devolve a boca da bica
      function faucet(x, y, z, dir) {
        const fm = new THREE.Mesh(mergeGeos([[new THREE.CylinderGeometry(0.02, 0.03, 0.3, 10), mat4(0, 0.15, 0)], [new THREE.TorusGeometry(0.1, 0.015, 8, 16, Math.PI), mat4(0, 0.3, 0.1, 0, -Math.PI / 2, 0)],
          [new THREE.CylinderGeometry(0.017, 0.017, 0.06, 8), mat4(0, 0.27, 0.2)], [new THREE.BoxGeometry(0.018, 0.018, 0.12), mat4(0.045, 0.2, -0.03, 0.45)]]), S_.steel);
        fm.position.set(x, y, z); if (dir < 0) fm.rotation.y = Math.PI; GRP.add(fm);
        return [x, y + 0.24, z + 0.2 * dir];
      }
      // bancos de madeira (passeio, praça, pracinha, pet, jardim): juntados no fim, todos dão para sentar
      const BENCH = [];
      const bench = function (x, z, yaw) { BENCH.push([x, z, yaw]); };
      // luzes de dentro (salão): painel do forro e as pendentes acendem juntos
      const hall = { on: false };
      const hallPanel = std({ color: 0xF4F3EF, roughness: 0.5, emissive: new THREE.Color(0xFFF1DC), emissiveIntensity: 0 });
      const hallBulb = std({ color: 0xFFF6E8, roughness: 0.3, emissive: new THREE.Color(0xFFD9A0), emissiveIntensity: 0 });
      const cladTex = (function () {                               // filetes de pedra (parede do fundo dos quiosques), 1,2 m x 1,2 m
        const c = canvas(256, 256), g = c.getContext('2d'), RR = rng(71);
        g.fillStyle = '#6E6A63'; g.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 256; y += 12) { let x = -RR() * 60; while (x < 256) { const l = 30 + RR() * 70, v = (RR() - 0.5) * 40; g.fillStyle = 'rgb(' + Math.round(176 + v) + ',' + Math.round(166 + v) + ',' + Math.round(150 + v) + ')'; g.fillRect(x + 1, y + 1, l - 2, 10); x += l; } }
        const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
      })();
      S_.clad = std({ color: 0xFFFFFF, map: cladTex, roughness: 0.92 }); S_.clad.userData.metric = 1.2;
      // folhagem das trepadeiras da pérgola (alpha to coverage)
      const vineMat = (function () {
        const c = canvas(128, 128), g = c.getContext('2d'), RR = rng(73);
        for (let i = 0; i < 520; i++) {
          const v = RR(); g.fillStyle = v < 0.08 ? '#B85FA0' : 'rgb(' + Math.round(50 + v * 40) + ',' + Math.round(100 + v * 50) + ',' + Math.round(38 + v * 26) + ')';
          g.beginPath(); g.ellipse(6 + RR() * 116, 6 + RR() * 116, 2.5 + RR() * 3.5, 1.6 + RR() * 2, RR() * 3.14, 0, 6.3); g.fill();
        }
        const m = std({ map: tex(c), roughness: 0.85, alphaTest: 0.5, side: THREE.DoubleSide }); m.alphaToCoverage = true; return m;
      })();

      // ---------- salão de festas: branco com a faixa azul-marinho no alto, porta de vidro de frente para o estacionamento dos fundos,
      // frente de vidro e varanda coberta com guarda-corpo branco para a piscina; dentro, copa com geladeira, churrasqueira, bancada
      // com banquetas, mesas redondas, sofá e TV no painel ripado, luminárias pendentes ----------
      const H0 = HALL[0], H1 = HALL[2], Z0 = HALL[1], Z1 = HALL[3], HH = 3.6, WT = 0.2, IN0 = H0 + WT, IN1 = H1 - WT, CZ = Z0 + WT;
      const wallB = function (r, y0, y1) { rbox(S_.white, r, y0, y1, y0 < 0.5); if (y0 < 0.5) occluder(r, y0, y1); };
      // vidro com caixilho preto: x0..x1 ou z0..z1 numa linha (r é o retângulo da faixa da parede)
      const glazing = function (r, y0, y1, alongZ) {
        const g = alongZ ? [r[0] + 0.08, r[1], r[0] + 0.12, r[3]] : [r[0], r[1] + 0.08, r[2], r[1] + 0.12];
        rbox(M.glass, g, y0, y1, true, false); occluder(g, y0, y1);
        const a0 = alongZ ? r[1] : r[0], a1 = alongZ ? r[3] : r[2], n = Math.max(1, Math.round((a1 - a0) / 1.25));
        for (let i = 0; i <= n; i++) {
          const a = a0 + (a1 - a0) * i / n;
          rbox(S_.black, alongZ ? [r[0] + 0.06, a - 0.025, r[0] + 0.14, a + 0.025] : [a - 0.025, r[1] + 0.06, a + 0.025, r[1] + 0.14], y0, y1, false, false);
        }
        [y0, y1 - 0.05].forEach(function (y) { rbox(S_.black, alongZ ? [r[0] + 0.06, r[1], r[0] + 0.14, r[3]] : [r[0], r[1] + 0.06, r[2], r[1] + 0.14], y, y + 0.05, false, false); });
      };
      // porta de correr automática de vidro (duas folhas): abre quando o visitante chega perto
      const autoDoor = function (cx, cz, alongZ, width) {
        const leaves = [-1, 1].map(function (s) {
          const lg = new THREE.Group(); scene.add(lg);
          const w = width / 2;
          const gm = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.03 : w, 2.5, alongZ ? w : 0.03), M.glass); gm.position.y = 1.27; lg.add(gm);
          lg.add(new THREE.Mesh(mergeGeos([[w, 0.05, 0, 0.03], [w, 0.05, 0, 2.5], [0.05, 2.5, -(w / 2 - 0.025), 1.27], [0.05, 2.5, w / 2 - 0.025, 1.27]].map(function (f) {
            return [new THREE.BoxGeometry(alongZ ? 0.05 : f[0], f[1], alongZ ? f[0] : 0.05), alongZ ? mat4(0, f[3], f[2]) : mat4(f[2], f[3], 0)];
          })), S_.black));
          const p0 = (alongZ ? cz : cx) + s * w / 2;
          lg.position.set(alongZ ? cx : p0, 0, alongZ ? p0 : cz); lg.userData.p0 = p0; return lg;
        });
        AUTO_DOORS.push({ c: [cx, cz], r: 2.4, axis: alongZ ? 'z' : 'x', w: width / 2 - 0.05, k: 0, leaves: leaves });
      };
      // oeste, para o estacionamento dos fundos: parede, vidro, pilarete do interruptor, porta automática, pilarete, vidro, parede
      wallB([H0, Z0, IN0, -23.6], 0, HH);
      glazing([H0, -23.6, IN0, -21.6], 0, 2.6, true); wallB([H0, -23.6, IN0, -21.6], 2.6, HH);
      wallB([H0, -21.6, IN0, -21.2], 0, HH);
      wallB([H0, -21.2, IN0, -18.8], 2.6, HH);
      wallB([H0, -18.8, IN0, -18.4], 0, HH);
      glazing([H0, -18.4, IN0, -16.4], 0, 2.6, true); wallB([H0, -18.4, IN0, -16.4], 2.6, HH);
      wallB([H0, -16.4, IN0, Z1], 0, HH);
      autoDoor(H0 + 0.24, -20.0, true, 2.4);
      // leste, para a varanda e a piscina: canto de parede, vidro do chão a 3 m, porta automática, vidro até o canto
      wallB([IN1, Z0, H1, -24.2], 0, HH);
      glazing([IN1, -24.2, H1, -21.2], 0, 3.0, true); wallB([IN1, -24.2, H1, -21.2], 3.0, HH);
      wallB([IN1, -21.2, H1, -18.8], 2.6, HH);
      glazing([IN1, -18.8, H1, Z1 - WT], 0, 3.0, true); wallB([IN1, -18.8, H1, Z1 - WT], 3.0, HH);
      autoDoor(H1 - 0.24, -20.0, true, 2.4);
      // norte (copa) e sul (para a praça, com uma janela comprida)
      wallB([H0, Z0, H1, CZ], 0, HH);
      wallB([H0, Z1 - WT, 61.6, Z1], 0, HH);
      wallB([61.6, Z1 - WT, 69.6, Z1], 0, 0.95); glazing([61.6, Z1 - WT, 69.6, Z1], 0.95, 2.6, false); wallB([61.6, Z1 - WT, 69.6, Z1], 2.6, HH);
      wallB([69.6, Z1 - WT, H1, Z1], 0, HH);
      // piso, forro (com os painéis de luz), laje, faixa azul-marinho e o letreiro
      rbox(S_.floorIn, [IN0, CZ, IN1, Z1 - WT], 0, 0.02, false, false);
      const ceilMat = std({ color: 0xC4C2BC, roughness: 0.9, envMapIntensity: 0.12, emissive: new THREE.Color(0xF2EFE8), emissiveIntensity: 0.5 });   // forro: claro mesmo virado para o chão (sem o verde da grama)
      rbox(ceilMat, [IN0, CZ, IN1, Z1 - WT], HH - 0.03, HH, false, false);
      rbox(ceilMat, [H1, Z0 + 0.05, TERR[2] + 0.2, Z1 - 0.05], HH - 0.03, HH, false, false);
      rbox(M.roof, [H0 - 0.15, Z0 - 0.15, TERR[2] + 0.35, Z1 + 0.15], HH, HH + 0.32, false);
      const FB = [H0 - 0.17, Z0 - 0.17, TERR[2] + 0.37, Z1 + 0.17];
      [[FB[0], FB[1], FB[2], FB[1] + 0.14], [FB[0], FB[3] - 0.14, FB[2], FB[3]], [FB[0], FB[1], FB[0] + 0.14, FB[3]], [FB[2] - 0.14, FB[1], FB[2], FB[3]]].forEach(function (r) { rbox(S_.navy, r, HH - 0.4, HH + 0.62, false); });
      const signC = canvas(1024, 96), sgc = signC.getContext('2d');
      sgc.fillStyle = '#FFFFFF'; sgc.font = '600 58px Archivo, Arial, sans-serif'; sgc.textAlign = 'center'; sgc.textBaseline = 'middle'; sgc.fillText('S A L Ã O   D E   F E S T A S', 512, 50);
      const signMat = std({ map: tex(signC), roughness: 0.6, transparent: true, alphaTest: 0.3, emissive: new THREE.Color(0xFFFFFF), emissiveIntensity: 0, emissiveMap: null });
      [[FB[2] + 0.012, (Z0 + Z1) / 2, Math.PI / 2], [(H0 + TERR[2]) / 2, FB[3] + 0.012, 0]].forEach(function (s) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.52), signMat); m.position.set(s[0], HH + 0.12, s[1]); m.rotation.y = s[2]; siteG.add(m);
      });
      GRP = hallInt;
      [[64.0, -20.0], [68.0, -20.0], [64.6, -24.3], [68.6, -24.3], [71.9, -15.7], [61.0, -14.3]].forEach(function (p) { rbox(hallPanel, [p[0] - 0.31, p[1] - 0.31, p[0] + 0.31, p[1] + 0.31], HH - 0.045, HH - 0.03, false, false); });
      // copa: armários claros com tampo de granito, pia com torneira gourmet, cooktop, armários de cima de madeira
      rbox(S_.gloss, [60.4, CZ, 68.9, CZ + 0.62], 0.1, 0.88, true); rbox(S_.black, [60.45, CZ, 68.85, CZ + 0.56], 0, 0.1, false, false);
      rbox(S_.granite, [60.35, CZ, 68.95, CZ + 0.66], 0.88, 0.92, false);
      rbox(S_.stone, [60.4, CZ, 68.9, CZ + 0.015], 0.92, 1.5, false, false);
      rbox(S_.oak, [60.4, CZ, 68.9, CZ + 0.36], 1.5, 2.3, false);
      for (let x = 60.82; x < 68.9; x += 0.85) { box(S_.steel, 0.3, 0.014, 0.016, x, 0.8, CZ + 0.63, false, false); box(S_.steel, 0.014, 0.25, 0.016, x + 0.3, 1.66, CZ + 0.37, false, false); }
      rbox(S_.steel, [63.1, CZ + 0.12, 64.1, CZ + 0.54], 0.921, 0.926, false, false); rbox(S_.dark, [63.18, CZ + 0.18, 64.02, CZ + 0.48], 0.927, 0.929, false, false);
      rbox(S_.black, [66.0, CZ + 0.1, 66.9, CZ + 0.6], 0.92, 0.935, false, false);
      [[66.22, CZ + 0.24], [66.68, CZ + 0.24], [66.22, CZ + 0.46], [66.68, CZ + 0.46]].forEach(function (p) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.008, 4, 20), S_.dark); r.rotation.x = Math.PI / 2; r.position.set(p[0], 0.937, p[1]); GRP.add(r); });
      const kTap = faucet(63.6, 0.92, CZ + 0.06, 1), kStream = makeStream(kTap[0], kTap[1], 0.93, kTap[2], 0.008, 0.012);
      tapProp(kStream, ['Abrir a torneira da copa', 'Fechar a torneira da copa'], [[63.45, 0.92, CZ, 63.75, 1.25, CZ + 0.32]]);
      // geladeira de inox: abre a porta (luz por dentro, prateleiras com bebidas)
      const FR = [69.1, CZ, 69.95, CZ + 0.68];
      rbox(S_.steel, [FR[0], FR[1], FR[2], FR[1] + 0.05], 0, 1.85, true); rbox(S_.steel, [FR[0], FR[1], FR[0] + 0.05, FR[3]], 0, 1.85, true); rbox(S_.steel, [FR[2] - 0.05, FR[1], FR[2], FR[3]], 0, 1.85, true);
      rbox(S_.steel, [FR[0], FR[1], FR[2], FR[3]], 1.8, 1.85, false); rbox(S_.steel, [FR[0], FR[1], FR[2], FR[3]], 0, 0.08, false);
      solid(FR[0], FR[1], FR[2], FR[3] + 0.06);
      const frLight = std({ color: 0xF4F7FA, roughness: 0.4, emissive: new THREE.Color(0xE8F2FF), emissiveIntensity: 0 });
      rbox(frLight, [FR[0] + 0.05, FR[1] + 0.05, FR[2] - 0.05, FR[1] + 0.07], 0.08, 1.8, false, false);
      rbox(S_.gloss, [FR[0] + 0.05, FR[1] + 0.05, FR[0] + 0.07, FR[3]], 0.08, 1.8, false, false); rbox(S_.gloss, [FR[2] - 0.07, FR[1] + 0.05, FR[2] - 0.05, FR[3]], 0.08, 1.8, false, false);
      [0.5, 0.95, 1.38].forEach(function (y) { rbox(M.glass, [FR[0] + 0.07, FR[1] + 0.07, FR[2] - 0.07, FR[3] - 0.04], y, y + 0.012, false, false); });
      const bottles = []; [[0.5, 6], [0.95, 5], [1.38, 4]].forEach(function (s) { for (let i = 0; i < s[1]; i++) bottles.push([FR[0] + 0.14 + i * (0.6 / s[1]), s[0] + 0.012, FR[1] + 0.25 + (i % 2) * 0.18, i]); });
      const bCols = [0x2E7D32, 0xC62828, 0xF9A825, 0x1565C0, 0x6D4C41, 0xE0E0E0];
      const bottleIM = inst(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 10).translate(0, 0.14, 0), std({ color: 0xFFFFFF, roughness: 0.25 }), bottles, function (p) { dm.position.set(p[0], p[1], p[2]); }, false);
      bottles.forEach(function (p, i) { bottleIM.setColorAt(i, new THREE.Color(bCols[p[3] % bCols.length]).convertSRGBToLinear()); }); bottleIM.instanceColor.needsUpdate = true;
      const frDoor = new THREE.Group(); frDoor.position.set(FR[0], 0, FR[3] + 0.005); GRP.add(frDoor);
      const fdm = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.77, 0.055), S_.steel); fdm.position.set(0.425, 0.93, 0.028); fdm.castShadow = true; frDoor.add(fdm);
      const fdh = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.7, 0.03), S_.black); fdh.position.set(0.78, 1.15, 0.075); frDoor.add(fdh);
      const fridge = { open: false, k: 0 };
      prop({ reach: 3.0, label: function () { return fridge.open ? 'Fechar a geladeira' : 'Abrir a geladeira'; }, act: function () { fridge.open = !fridge.open; },
        step: function (dt) {
          const t = fridge.open ? 1 : 0; if (Math.abs(t - fridge.k) < 0.001) return false;
          fridge.k += Math.sign(t - fridge.k) * Math.min(Math.abs(t - fridge.k), dt * 1.8);
          const e = fridge.k * fridge.k * (3 - 2 * fridge.k); frDoor.rotation.y = -1.85 * e; frLight.emissiveIntensity = fridge.k > 0.05 ? 0.9 : 0; return true;
        }, reset: function () { fridge.open = false; fridge.k = 0; frDoor.rotation.y = 0; frLight.emissiveIntensity = 0; } },
      [[FR[0], 0.1, FR[3] - 0.05, FR[2], 1.85, FR[3] + 0.1]]);
      // churrasqueira de tijolinho no canto, com tampo de granito, grelha de inox, coifa e chaminé até acima do telhado
      const B0 = 70.3, B1 = IN1;
      rbox(S_.brick, [B0, CZ, B1, CZ + 1.0], 0, 0.9, true);
      rbox(S_.granite, [B0 - 0.04, CZ, B1, CZ + 1.06], 0.9, 0.95, false);
      rbox(S_.brick, [B0, CZ, B0 + 0.22, CZ + 0.98], 0.95, 1.75, false); rbox(S_.brick, [B1 - 0.22, CZ, B1, CZ + 0.98], 0.95, 1.75, false);
      rbox(S_.black, [B0 + 0.22, CZ, B1 - 0.22, CZ + 0.08], 0.95, 1.75, false, false);
      rbox(S_.white, [B0 - 0.05, CZ, B1, CZ + 1.02], 1.75, 2.45, false);
      rbox(S_.white, [B0 + 0.5, CZ, B1 - 0.5, CZ + 0.7], 2.45, HH, false);
      GRP = siteG; rbox(S_.concrete, [B0 + 0.5, CZ, B1 - 0.5, CZ + 0.7], HH + 0.32, HH + 1.25, false); GRP = hallInt;   // chaminé: aparece de fora
      for (let x = B0 + 0.3; x < B1 - 0.27; x += 0.07) box(S_.steel, 0.012, 0.012, 0.8, x, 1.3, CZ + 0.5, false, false);
      rbox(S_.steel, [B0 + 0.24, CZ + 0.08, B1 - 0.24, CZ + 0.12], 1.28, 1.32, false, false);
      fireProp(makeFire((B0 + B1) / 2, 0.97, CZ + 0.5, B1 - B0 - 0.6, 0.62, [(B0 + B1) / 2, HH + 1.3, CZ + 0.35]), 'a churrasqueira do salão', [[B0, 0.9, CZ + 0.1, B1, 1.8, CZ + 1.06]]);
      // bancada (bar) com banquetas, de frente para a copa
      rbox(S_.oak, [61.4, -23.4, 67.4, -22.8], 0, 1.0, true);
      rbox(S_.granite, [61.35, -23.45, 67.45, -22.55], 1.0, 1.05, false);
      const stools = []; for (let i = 0; i < 5; i++) stools.push([61.9 + i * 1.35, -22.05]);
      inst(mergeGeos([[new THREE.CylinderGeometry(0.19, 0.17, 0.06, 18), mat4(0, 0.76, 0)], [new THREE.CylinderGeometry(0.022, 0.022, 0.74, 8), mat4(0, 0.38, 0)], [new THREE.TorusGeometry(0.15, 0.012, 6, 18), mat4(0, 0.3, 0, Math.PI / 2)], [new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16), mat4(0, 0.01, 0)]]),
        S_.black, stools, function (p) { dm.position.set(p[0], 0, p[1]); });
      inst(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 18), S_.leather, stools, function (p) { dm.position.set(p[0], 0.81, p[1]); });
      seats('Sentar na banqueta', stools.map(function (p) { return seatAt(p[0], p[1], Math.PI, 1.45, -0.7); }), stools.map(function (p) { return [p[0] - 0.2, 0, p[1] - 0.2, p[0] + 0.2, 0.85, p[1] + 0.2]; }));
      // mesas redondas com toalha e arranjo, seis cadeiras em cada
      const tables = [[63.0, -17.4], [68.2, -17.4], [63.0, -14.3], [68.2, -14.3]];
      inst(mergeGeos([[new THREE.CylinderGeometry(0.62, 0.62, 0.03, 28), mat4(0, 0.77, 0)], [new THREE.CylinderGeometry(0.63, 0.7, 0.62, 28, 1, true), mat4(0, 0.45, 0)]]), S_.cloth, tables, function (p) { dm.position.set(p[0], 0, p[1]); });
      inst(mergeGeos([[new THREE.CylinderGeometry(0.06, 0.05, 0.16, 12), mat4(0, 0.86, 0)]]), M.glass, tables, function (p) { dm.position.set(p[0], 0, p[1]); }, false);
      const blooms = []; tables.forEach(function (t, i) { for (let k = 0; k < 5; k++) blooms.push([t[0] + Math.cos(k * 1.26) * 0.06, 0.98 + (k % 2) * 0.04, t[1] + Math.sin(k * 1.26) * 0.06, (i + k) % 3]); });
      const bloomIM = inst(new THREE.IcosahedronGeometry(0.055, 0), std({ color: 0xFFFFFF, roughness: 0.7 }), blooms, function (p) { dm.position.set(p[0], p[1], p[2]); }, false);
      blooms.forEach(function (p, i) { bloomIM.setColorAt(i, new THREE.Color([0x8E5DB8, 0xF2EEE6, 0xD9567A][p[3]]).convertSRGBToLinear()); }); bloomIM.instanceColor.needsUpdate = true;
      const chairGeo = mergeGeos([[new THREE.BoxGeometry(0.42, 0.05, 0.42), mat4(0, 0.46, 0)], [new THREE.BoxGeometry(0.42, 0.44, 0.04), mat4(0, 0.71, -0.19, -0.08)],
        [new THREE.BoxGeometry(0.03, 0.46, 0.03), mat4(-0.18, 0.23, 0.18)], [new THREE.BoxGeometry(0.03, 0.46, 0.03), mat4(0.18, 0.23, 0.18)],
        [new THREE.BoxGeometry(0.03, 0.46, 0.03), mat4(-0.18, 0.23, -0.18)], [new THREE.BoxGeometry(0.03, 0.46, 0.03), mat4(0.18, 0.23, -0.18)]]);
      const chairs = []; tables.forEach(function (t) { for (let a = 0; a < 6; a++) { const an = a * 1.047 + 0.3; chairs.push([t[0] + Math.cos(an) * 0.98, t[1] + Math.sin(an) * 0.98, Math.atan2(-Math.cos(an), -Math.sin(an))]); } });
      inst(chairGeo, S_.oak, chairs, function (p) { dm.position.set(p[0], 0, p[1]); dm.rotation.y = p[2]; });
      inst(new THREE.BoxGeometry(0.4, 0.04, 0.4), S_.sofa, chairs, function (p) { dm.position.set(p[0], 0.505, p[1]); dm.rotation.y = p[2]; });
      tables.forEach(function (t) { solid(t[0] - 0.72, t[1] - 0.72, t[0] + 0.72, t[1] + 0.72); });
      seats('Sentar à mesa', chairs.map(function (c) { return seatAt(c[0], c[1], c[2], 1.18, -0.62); }), tables.map(function (t) { return [t[0] - 1.25, 0, t[1] - 1.25, t[0] + 1.25, 1.0, t[1] + 1.25]; }), 3.0);
      // pendentes sobre as mesas e a bancada
      const pend = tables.map(function (t) { return [t[0], 2.55, t[1]]; }).concat([[62.6, 2.4, -23.0], [64.4, 2.4, -23.0], [66.2, 2.4, -23.0]]);
      inst(new THREE.CylinderGeometry(0.1, 0.26, 0.28, 20, 1, true), S_.black, pend, function (p) { dm.position.set(p[0], p[1] + 0.06, p[2]); }, false);
      inst(new THREE.SphereGeometry(0.075, 12, 8), hallBulb, pend, function (p) { dm.position.set(p[0], p[1] - 0.02, p[2]); }, false);
      inst(new THREE.CylinderGeometry(0.004, 0.004, 1, 4), S_.dark, pend, function (p) { dm.position.set(p[0], (p[1] + 0.2 + HH) / 2, p[2]); dm.scale.set(1, HH - p[1] - 0.2, 1); }, false);
      // painel ripado de madeira com a TV, aparador embaixo
      for (let z = -16.25; z < -12.45; z += 0.08) box(S_.oak, 0.035, HH - 0.05, 0.04, IN0 + 0.02, (HH - 0.05) / 2, z, false, false);
      rbox(S_.black, [IN0, -16.3, IN0 + 0.005, -12.4], 0, HH - 0.05, false, false);
      rbox(S_.oak, [IN0 + 0.04, -15.7, IN0 + 0.5, -12.9], 0.12, 0.6, true);
      rbox(S_.granite, [IN0 + 0.03, -15.72, IN0 + 0.52, -12.88], 0.6, 0.63, false);
      rbox(S_.black, [IN0 + 0.04, -15.26, IN0 + 0.1, -13.34], 1.05, 2.15, false);
      const tvC = canvas(512, 288), tvG = tvC.getContext('2d'), tvTex = tex(tvC);
      const tvOn = new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false }), tvOff = std({ color: 0x07080A, roughness: 0.1, metalness: 0.4, envMapIntensity: 1.2 });
      const tvScr = new THREE.Mesh(new THREE.PlaneGeometry(1.84, 1.04), tvOff); tvScr.rotation.y = Math.PI / 2; tvScr.position.set(IN0 + 0.103, 1.6, -14.3); tvScr.userData.keep = true; GRP.add(tvScr);
      const tv = { on: false, t: 0, last: 0 };
      function drawTV(t) {
        const g = tvG, W = 512, H = 288, hue = (t * 12) % 360;
        const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'hsl(' + hue + ',70%,20%)'); gr.addColorStop(1, 'hsl(' + ((hue + 80) % 360) + ',75%,38%)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 6; i++) {
          const x = (Math.sin(t * 0.6 + i * 1.7) * 0.5 + 0.5) * W, y = (Math.cos(t * 0.5 + i * 2.3) * 0.5 + 0.5) * H, rg = g.createRadialGradient(x, y, 0, x, y, 90);
          rg.addColorStop(0, 'hsla(' + ((hue + i * 50) % 360) + ',90%,70%,.42)'); rg.addColorStop(1, 'hsla(0,0%,0%,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
        }
        for (let i = 0; i < 24; i++) { const h = 16 + Math.abs(Math.sin(t * 3.1 + i * 0.7) * Math.sin(t * 1.3 + i * 0.31)) * 112; g.fillStyle = 'hsla(' + ((hue + i * 9) % 360) + ',90%,66%,.9)'; g.fillRect(36 + i * 18.5, H - 40 - h, 12, h); }
        g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.96)'; g.font = '700 30px Archivo, Arial, sans-serif'; g.fillText('Residencial Milão', 34, 54);
        g.font = '500 17px Archivo, Arial, sans-serif'; g.fillStyle = 'rgba(255,255,255,.82)'; g.fillText('Salão de festas · trilha da festa', 34, 80);
        const d = new Date(); g.textAlign = 'right'; g.font = '600 20px Archivo, Arial, sans-serif'; g.fillText(('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2), W - 26, 50);
        g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(0, H - 30, W, 30);
        const msg = 'Bem-vindos ao salão de festas do Residencial Milão  •  churrasqueira, copa completa e varanda para a piscina  •  ';
        g.fillStyle = '#fff'; g.font = '500 15px Archivo, Arial, sans-serif'; g.textAlign = 'left';
        const wd = g.measureText(msg).width, off = (t * 60) % wd; g.fillText(msg + msg, 12 - off, H - 10);
        tvTex.needsUpdate = true;
      }
      prop({ reach: 7, label: function () { return tv.on ? 'Desligar a TV' : 'Ligar a TV'; },
        act: function () { tv.on = !tv.on; tvScr.material = tv.on ? tvOn : tvOff; if (tv.on) drawTV(tv.t); },
        step: function (dt, now, cam) {
          if (!tv.on) return false;
          tv.t += dt;
          if (now - tv.last > 80 && Math.hypot(cam.position.x - IN0, cam.position.z + 14.3) < 22) { tv.last = now; drawTV(tv.t); }
          return true;
        }, reset: function () { tv.on = false; tvScr.material = tvOff; } },
      [[IN0, 1.0, -15.3, IN0 + 0.2, 2.2, -13.3]]);
      // sofá de frente para a TV (de costas para o vidro da varanda), mesa de centro e tapete
      rbox(S_.sofa, [71.95, -17.0, 72.78, -14.4], 0.12, 0.44, true); rbox(S_.sofa, [72.5, -17.0, 72.78, -14.4], 0.44, 0.92, false);
      rbox(S_.sofa, [71.95, -17.0, 72.5, -16.8], 0.44, 0.66, false); rbox(S_.sofa, [71.95, -14.6, 72.5, -14.4], 0.44, 0.66, false);
      rbox(S_.cushion, [71.98, -16.78, 72.48, -15.72], 0.44, 0.55, false); rbox(S_.cushion, [71.98, -15.68, 72.48, -14.62], 0.44, 0.55, false);
      rbox(S_.black, [71.95, -17.0, 72.78, -14.4], 0, 0.12, false, false);
      rbox(S_.oak, [70.55, -16.2, 71.35, -15.2], 0.38, 0.42, true); rbox(S_.black, [70.62, -16.12, 71.28, -15.28], 0, 0.38, false, false);
      rbox(S_.fabric, [70.2, -16.9, 71.7, -14.5], 0.02, 0.028, false, false);
      seats('Sentar no sofá', [seatAt(72.2, -16.25, -Math.PI / 2, 1.08, 0.8), seatAt(72.2, -15.15, -Math.PI / 2, 1.08, 0.8)], [[71.95, 0.1, -17.0, 72.8, 0.95, -14.4]]);
      // vasos com plantas nos cantos
      const vasos = [[IN0 + 0.4, CZ + 0.4 + 1.8], [IN1 - 0.35, Z1 - WT - 0.35], [IN0 + 0.4, Z1 - WT - 0.4]];
      inst(new THREE.CylinderGeometry(0.24, 0.18, 0.55, 16), S_.black, vasos, function (p) { dm.position.set(p[0], 0.275, p[1]); });
      inst(new THREE.IcosahedronGeometry(0.42, 1), S_.petGreen, vasos, function (p) { dm.position.set(p[0], 0.95, p[1]); dm.scale.set(1, 1.3, 1); });
      vasos.forEach(function (p) { solid(p[0] - 0.25, p[1] - 0.25, p[0] + 0.25, p[1] + 0.25); });
      // interruptor no pilarete ao lado da porta: acende o forro e as pendentes (e a luz do salão de verdade); à noite já começa aceso
      const hallLights = function (on) { hall.on = on; hallPanel.emissiveIntensity = on ? 1.35 : 0; hallBulb.emissiveIntensity = on ? 2.2 : 0; ceilMat.emissiveIntensity = on ? 0.78 : 0.5; signMat.emissiveIntensity = night ? 0.5 : 0; };
      NIGHT_HOOKS.push(hallLights);
      rbox(S_.gloss, [IN0, -21.47, IN0 + 0.015, -21.33], 1.12, 1.24, false, false);
      LIGHT_SRC.push(function () { return hall.on ? { x: 66.2, y: HH - 0.5, z: -18.8, k: 1.45, d: 16 } : null; });
      prop({ reach: 2.8, label: function () { return hall.on ? 'Apagar as luzes do salão' : 'Acender as luzes do salão'; },
        act: function () { hallLights(!hall.on); }, reset: function () { hallLights(night); } },
      [[IN0, 1.0, -21.6, IN0 + 0.12, 1.36, -21.2]]);
      GRP = siteG;
      // varanda coberta: pilares brancos, guarda-corpo branco (aberto em frente à porta) e duas mesinhas
      [[-25.7], [-22.6], [-15.4], [-12.3]].forEach(function (z) { box(S_.white, 0.24, HH, 0.24, TERR[2] - 0.12, HH / 2, z[0], true); });
      const railX = TERR[2] - 0.1;
      const railRun = function (a0, a1, alongZ, fixed) {
        const len = a1 - a0, n = Math.max(1, Math.round(len / 1.15));
        [1.0, 0.55, 0.12].forEach(function (y, i) { const t = i ? 0.035 : 0.06; rbox(S_.white, alongZ ? [fixed - t / 2, a0, fixed + t / 2, a1] : [a0, fixed - t / 2, a1, fixed + t / 2], y - t / 2, y + t / 2, false); });
        for (let i = 0; i <= n; i++) { const a = a0 + len * i / n; rbox(S_.white, alongZ ? [fixed - 0.025, a - 0.025, fixed + 0.025, a + 0.025] : [a - 0.025, fixed - 0.025, a + 0.025, fixed + 0.025], 0, 1.0, false); }
        solid(alongZ ? fixed - 0.06 : a0, alongZ ? a0 : fixed - 0.06, alongZ ? fixed + 0.06 : a1, alongZ ? a1 : fixed + 0.06);
      };
      railRun(Z0, -21.2, true, railX); railRun(-18.8, Z1, true, railX);
      railRun(H1, railX, false, Z0 + 0.06); railRun(H1, railX, false, Z1 - 0.06);
      const bistro = [[75.0, -24.0], [75.0, -14.2]];
      inst(mergeGeos([[new THREE.CylinderGeometry(0.36, 0.36, 0.03, 22), mat4(0, 0.74, 0)], [new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), mat4(0, 0.37, 0)], [new THREE.CylinderGeometry(0.24, 0.24, 0.02, 16), mat4(0, 0.01, 0)]]), S_.white, bistro, function (p) { dm.position.set(p[0], 0, p[1]); });
      const bChairs = []; bistro.forEach(function (b) { bChairs.push([b[0], b[1] - 0.62, 0], [b[0], b[1] + 0.62, Math.PI]); });
      inst(chairGeo, S_.white, bChairs, function (p) { dm.position.set(p[0], 0, p[1]); dm.rotation.y = p[2]; });
      bistro.forEach(function (b) { solid(b[0] - 0.4, b[1] - 0.4, b[0] + 0.4, b[1] + 0.4); });
      seats('Sentar na varanda', bChairs.map(function (c) { return seatAt(c[0], c[1], c[2], 1.18, -0.6); }), bistro.map(function (b) { return [b[0] - 0.8, 0, b[1] - 1.0, b[0] + 0.8, 1.0, b[1] + 1.0]; }));

      // ---------- piscinas adulto e infantil no deque de porcelanato: tanque fundo de verdade (o chão do lote é vazado ali), pastilha
      // azul, faixa escura na linha d'água, luzes, borda de pedra, água transparente 10 cm abaixo do deque e escadinha de inox ----------
      [POOLA.adult, POOLA.kids].forEach(function (p, i) {
        const w = p[2] - p[0], d = p[3] - p[1], cx = (p[0] + p[2]) / 2, cz = (p[1] + p[3]) / 2, dep = i ? 0.45 : 1.4;
        [[p[0] - 0.38, p[1] - 0.38, p[2] + 0.38, p[1] + 0.03], [p[0] - 0.38, p[3] - 0.03, p[2] + 0.38, p[3] + 0.38], [p[0] - 0.38, p[1] + 0.03, p[0] + 0.03, p[3] - 0.03], [p[2] - 0.03, p[1] + 0.03, p[2] + 0.38, p[3] - 0.03]]
          .forEach(function (r) { rbox(S_.stone, r, -0.02, 0.05, false, false); });
        rbox(S_.poolTile, p, -dep - 0.06, -dep, false, false);
        [[p[0] - 0.06, p[1] - 0.06, p[0], p[3] + 0.06], [p[2], p[1] - 0.06, p[2] + 0.06, p[3] + 0.06], [p[0], p[1] - 0.06, p[2], p[1]], [p[0], p[3], p[2], p[3] + 0.06]].forEach(function (r) {
          rbox(S_.poolTile, r, -dep, -0.22, false, false); rbox(S_.poolBand, r, -0.22, -0.02, false, false);
        });
        const nl = i ? 1 : 3;
        for (let k = 0; k < nl; k++) [p[1] + 0.004, p[3] - 0.004].forEach(function (z) { rbox(S_.poolLight, [p[0] + w * (k + 1) / (nl + 1) - 0.11, z - 0.004, p[0] + w * (k + 1) / (nl + 1) + 0.11, z + 0.004], -dep * 0.55 - 0.06, -dep * 0.55 + 0.06, false, false); });
        const wg = new THREE.PlaneGeometry(w, d), wuv = wg.attributes.uv;
        for (let k = 0; k < wuv.count; k++) wuv.setXY(k, wuv.getX(k) * w / 3.2, wuv.getY(k) * d / 3.2);
        const wm = new THREE.Mesh(wg, S_.water); wm.rotation.x = -Math.PI / 2; wm.position.set(cx, -0.1, cz); wm.renderOrder = 1; wm.receiveShadow = true; wm.userData.keep = true; siteG.add(wm);
        solid(p[0] - 0.1, p[1] - 0.1, p[2] + 0.1, p[3] + 0.1);
        if (!i) {                                                        // escadinha do lado das espreguiçadeiras
          [-0.3, 0.3].forEach(function (dx) {
            const x = p[0] + 1.2 + dx, r = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 8, 14, Math.PI), S_.steel);
            r.rotation.y = Math.PI / 2; r.position.set(x, 0.42, p[3] + 0.02); siteG.add(r);
            box(S_.steel, 0.044, 0.42, 0.044, x, 0.21, p[3] + 0.24, false, false);
            box(S_.steel, 0.044, 1.3, 0.044, x, -0.23, p[3] - 0.2, false, false);
          });
          [-0.35, -0.65, -0.95].forEach(function (y) { box(S_.steel, 0.6, 0.03, 0.09, p[0] + 1.2, y, p[3] - 0.16, false, false); });
        }
        // entrar na água: o visitante fica com a cabeça um pouco acima da água e nada pela piscina toda
        const area = [p[0], p[1], p[2], p[3]], eyeY = i ? 0.42 : 0.16;
        prop({ reach: 5.5, label: function (pt, riding) { return riding ? 'Sair da piscina' : i ? 'Entrar na piscina infantil' : 'Entrar na piscina'; },
          act: function (pt, riding) {
            if (riding) return { stand: true };
            const ex = Math.min(p[2] - 0.5, Math.max(p[0] + 0.5, pt[0])), ez = Math.min(p[3] - 0.5, Math.max(p[1] + 0.5, pt[2]));
            const far = ex < cx ? p[2] : p[0];
            return { pose: { kind: 'swim', hud: i ? 'Na piscina infantil' : 'Nadando', standLabel: 'Sair da piscina', eye: [ex, eyeY, ez], look: [far, eyeY - 0.15, ez],
              stand: i ? [p[2] + 0.75, cz] : [p[0] + 1.2, p[3] + 0.9], swim: { area: area, y: eyeY } } };
          } },
        [[p[0] + 0.02, -0.13, p[1] + 0.02, p[2] - 0.02, -0.07, p[3] - 0.02]]);
      });
      // espreguiçadeiras: estrutura branca com encosto inclinado e almofadas, viradas para a piscina (e para o sol, ao norte)
      const loungers = [];
      for (let x = 87.0; x <= 98.4; x += 1.6) loungers.push([x, -14.7, Math.PI]);
      loungers.push([80.4, -15.4, Math.PI], [82.2, -15.4, Math.PI]);
      const lFrame = mergeGeos([[new THREE.BoxGeometry(0.64, 0.05, 1.95), mat4(0, 0.3, 0.05)],
        [new THREE.BoxGeometry(0.04, 0.3, 0.04), mat4(-0.29, 0.15, 0.9)], [new THREE.BoxGeometry(0.04, 0.3, 0.04), mat4(0.29, 0.15, 0.9)],
        [new THREE.BoxGeometry(0.04, 0.3, 0.04), mat4(-0.29, 0.15, -0.8)], [new THREE.BoxGeometry(0.04, 0.3, 0.04), mat4(0.29, 0.15, -0.8)],
        [new THREE.BoxGeometry(0.64, 0.04, 0.82), mat4(0, 0.58, -0.62, 0.72)]]);
      const lCush = mergeGeos([[new THREE.BoxGeometry(0.58, 0.07, 1.18), mat4(0, 0.36, 0.36)], [new THREE.BoxGeometry(0.58, 0.07, 0.76), mat4(0, 0.63, -0.6, 0.72)]]);
      inst(lFrame, S_.white, loungers, function (p) { dm.position.set(p[0], 0, p[1]); dm.rotation.y = p[2]; });
      inst(lCush, S_.cushion, loungers, function (p) { dm.position.set(p[0], 0, p[1]); dm.rotation.y = p[2]; });
      loungers.forEach(function (p) { solid(p[0] - 0.35, p[1] - 0.95, p[0] + 0.35, p[1] + 0.95); });
      seats('Deitar na espreguiçadeira', loungers.map(function (p) {
        return { kind: 'lie', hud: 'Na espreguiçadeira', standLabel: 'Levantar', eye: [p[0], 0.9, p[1] + 0.55], look: [p[0], 1.55, p[1] - 3], stand: [p[0] + 0.8, p[1] + 0.2] };
      }), loungers.map(function (p) { return [p[0] - 0.34, 0.2, p[1] - 0.98, p[0] + 0.34, 0.95, p[1] + 0.98]; }), 3.0);
      // guarda-sóis: abrem e fecham (a lona desce e fecha em volta do mastro)
      const canopyMat = std({ color: 0xF1EBDD, roughness: 0.85, side: THREE.DoubleSide });
      const canopyGeo = new THREE.ConeGeometry(1.5, 0.5, 12, 1, true);
      [[87.8, -12.9], [91.0, -12.9], [94.2, -12.9], [97.4, -12.9], [81.3, -13.4]].forEach(function (p) {
        box(S_.white, 0.05, 2.55, 0.05, p[0], 1.27, p[1], true);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.07, 18), S_.dark); base.position.set(p[0], 0.035, p[1]); siteG.add(base);
        const u = new THREE.Mesh(canopyGeo, canopyMat); u.position.set(p[0], 2.42, p[1]); u.castShadow = true; scene.add(u);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6), S_.white); tip.position.set(p[0], 2.7, p[1]); scene.add(tip);
        const st = { open: true, k: 1 };
        const put = function () { const k = st.k * st.k * (3 - 2 * st.k); u.scale.set(0.12 + 0.88 * k, 2.3 - 1.3 * k, 0.12 + 0.88 * k); u.position.y = 1.9 + 0.52 * k; tip.position.y = u.position.y + 0.25 * u.scale.y + 0.03; };
        prop({ reach: 3.6, label: function () { return st.open ? 'Fechar o guarda-sol' : 'Abrir o guarda-sol'; }, act: function () { st.open = !st.open; },
          step: function (dt) {
            const t = st.open ? 1 : 0; if (Math.abs(t - st.k) < 0.001) { if (st.moved) { st.moved = false; shadowDirty = true; } return false; }
            st.k += Math.sign(t - st.k) * Math.min(Math.abs(t - st.k), dt * 0.9); put(); st.moved = true; return true;
          }, reset: function () { st.open = true; st.k = 1; put(); } },
        [[p[0] - 0.15, 0.3, p[1] - 0.15, p[0] + 0.15, 2.0, p[1] + 0.15], [p[0] - 1.35, 2.15, p[1] - 1.35, p[0] + 1.35, 2.68, p[1] + 1.35]]);
      });
      // cerca de vidro com corrimão de inox; a entrada fica do lado da praça
      const pf = POOLA.fence;
      [[pf[0], pf[3], pf[2], pf[3]], [pf[0], -12, pf[0], -10.9], [pf[0], -9.3, pf[0], pf[3]], [pf[0], pf[1], pf[0], Z0]].forEach(function (s) {
        const horiz = Math.abs(s[3] - s[1]) < 0.01;
        rbox(M.glass, horiz ? [s[0], s[1] - 0.02, s[2], s[1] + 0.02] : [s[0] - 0.02, s[1], s[0] + 0.02, s[3]], 0, 1.2, true, false);
        rbox(S_.steel, horiz ? [s[0], s[1] - 0.03, s[2], s[1] + 0.03] : [s[0] - 0.03, s[1], s[0] + 0.03, s[3]], 1.2, 1.25, false);
        const len = horiz ? s[2] - s[0] : s[3] - s[1], n = Math.max(1, Math.round(len / 1.5));
        for (let k = 0; k <= n; k++) { const a = (horiz ? s[0] : s[1]) + len * k / n; box(S_.steel, 0.05, 1.22, 0.05, horiz ? a : s[0], 0.61, horiz ? s[1] : a, false, false); }
      });
      // ducha de inox junto à entrada: liga e desliga
      const DX = 77.5, DZ = -8.5;
      box(S_.steel, 0.08, 2.3, 0.08, DX, 1.15, DZ, true);
      box(S_.steel, 0.5, 0.05, 0.06, DX + 0.22, 2.3, DZ, false, false);
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.06, 18), S_.steel); sh.position.set(DX + 0.44, 2.25, DZ); siteG.add(sh);
      rbox(S_.dark, [DX - 0.1, DZ - 0.45, DX + 0.95, DZ + 0.42], 0.005, 0.012, false, false);
      tapProp(makeStream(DX + 0.44, 2.21, 0.02, DZ, 0.07, 0.22), ['Ligar a ducha', 'Desligar a ducha'], [[DX - 0.1, 0.6, DZ - 0.15, DX + 0.56, 2.4, DZ + 0.15]]);

      // ---------- quiosques com churrasqueira (foto): parte coberta com laje escura, forro de madeira e parede de filetes de pedra,
      // churrasqueira, bancada com pia e frigobar, mesa comprida; na frente, pérgola de madeira com trepadeira e mesas ----------
      KIOSKS.forEach(function (cx, ki) {
        const k0 = cx - 3.6, k1 = cx + 3.6, kz0 = 26.4, kz1 = 31.6;
        rbox(S_.clad, [k0, kz1 - 0.25, k1, kz1], 0, 2.95, true); occluder([k0, kz1 - 0.25, k1, kz1], 0, 2.95);
        rbox(S_.canopy, [k0 - 0.15, kz0 - 0.15, k1 + 0.15, kz1 + 0.05], 2.95, 3.22, false);
        rbox(S_.oak, [k0, kz0, k1, kz1 - 0.25], 2.92, 2.95, false, false);
        [k0 + 0.12, k1 - 0.12].forEach(function (x) { box(S_.white, 0.24, 2.92, 0.24, x, 1.46, kz0 + 0.12, true); });
        // churrasqueira
        const c0 = cx - 3.3, c1 = cx - 1.1, cz0 = kz1 - 1.0, cz1 = kz1 - 0.25;
        rbox(S_.brick, [c0, cz0, c1, cz1], 0, 0.9, true);
        rbox(S_.granite, [c0 - 0.04, cz0 - 0.06, c1 + 0.04, cz1], 0.9, 0.95, false);
        rbox(S_.brick, [c0, cz0, c0 + 0.2, cz1], 0.95, 1.7, false); rbox(S_.brick, [c1 - 0.2, cz0, c1, cz1], 0.95, 1.7, false);
        rbox(S_.black, [c0 + 0.2, cz1 - 0.06, c1 - 0.2, cz1], 0.95, 1.7, false, false);
        rbox(S_.concrete, [c0 - 0.04, cz0 - 0.05, c1 + 0.04, cz1], 1.7, 2.35, false);
        rbox(S_.concrete, [cx - 2.6, cz1 - 0.55, cx - 1.8, cz1], 2.35, 3.95, false);
        for (let x = c0 + 0.28; x < c1 - 0.26; x += 0.07) box(S_.steel, 0.012, 0.012, 0.64, x, 1.28, (cz0 + cz1) / 2, false, false);
        fireProp(makeFire((c0 + c1) / 2, 0.97, (cz0 + cz1) / 2, c1 - c0 - 0.55, 0.5, [cx - 2.2, 4.0, cz1 - 0.3]), 'a churrasqueira do quiosque ' + (ki + 1), [[c0, 0.9, cz0 - 0.06, c1, 1.75, cz1]]);
        // bancada com pia, torneira e frigobar
        rbox(S_.gloss, [cx - 0.6, kz1 - 0.88, cx + 3.3, kz1 - 0.25], 0.1, 0.88, true); rbox(S_.black, [cx - 0.55, kz1 - 0.82, cx + 3.25, kz1 - 0.25], 0, 0.1, false, false);
        rbox(S_.granite, [cx - 0.64, kz1 - 0.92, cx + 3.34, kz1 - 0.25], 0.88, 0.92, false);
        rbox(S_.steel, [cx + 0.8, kz1 - 0.78, cx + 1.8, kz1 - 0.38], 0.921, 0.926, false, false); rbox(S_.dark, [cx + 0.88, kz1 - 0.72, cx + 1.72, kz1 - 0.44], 0.927, 0.929, false, false);
        rbox(S_.steel, [cx + 2.1, kz1 - 0.9, cx + 3.1, kz1 - 0.885], 0.12, 0.84, false, false);
        const tp = faucet(cx + 1.3, 0.92, kz1 - 0.32, -1);
        tapProp(makeStream(tp[0], tp[1], 0.93, tp[2], 0.008, 0.012), ['Abrir a torneira do quiosque', 'Fechar a torneira do quiosque'], [[cx + 1.15, 0.92, kz1 - 0.6, cx + 1.45, 1.25, kz1 - 0.25]]);
        // pendentes
        [[cx - 0.9, 28.2], [cx + 0.9, 28.2]].forEach(function (p) {
          const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.24, 0.22, 18, 1, true), S_.black); sh.position.set(p[0], 2.5, p[1]); siteG.add(sh);
          rbox(lampHeads, [p[0] - 0.1, p[1] - 0.1, p[0] + 0.1, p[1] + 0.1], 2.39, 2.41, false, false);
          box(S_.dark, 0.008, 0.31, 0.008, p[0], 2.76, p[1], false, false);
        });
        // pérgola de madeira com trepadeira
        const pz0 = 17.2, pz1 = kz0;
        [pz0 + 0.1, (pz0 + pz1) / 2].forEach(function (z) { [k0 + 0.1, k1 - 0.1].forEach(function (x) { box(S_.wood, 0.16, 2.62, 0.16, x, 1.31, z, true); }); });
        [k0 + 0.1, k1 - 0.1].forEach(function (x) { box(S_.wood, 0.1, 0.22, pz1 - pz0 + 0.2, x, 2.72, (pz0 + pz1) / 2, false); });
        for (let z = pz0 + 0.2; z < pz1; z += 0.45) box(S_.wood, k1 - k0 + 0.4, 0.12, 0.06, cx, 2.89, z, false);
        const vines = siteG;                                        // as folhas de todas as pérgolas viram uma malha só
        for (let i = 0; i < 7; i++) {
          const w = 1.6 + FX() * 1.4, d = 1.2 + FX() * 1.4, m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), vineMat);
          m.rotation.x = -Math.PI / 2; m.rotation.z = FX() * 0.6; m.position.set(cx + (FX() - 0.5) * 5.2, 2.97 + FX() * 0.05, pz0 + 0.8 + FX() * (pz1 - pz0 - 1.6)); m.castShadow = true; vines.add(m);
        }
        for (let i = 0; i < 14; i++) {
          const side = i % 2 ? k1 - 0.06 : k0 + 0.06, h = 0.5 + FX() * 1.1, m = new THREE.Mesh(new THREE.PlaneGeometry(0.35, h), vineMat);
          m.position.set(side, 2.8 - h / 2, pz0 + 0.4 + FX() * (pz1 - pz0 - 0.8)); m.rotation.y = Math.PI / 2 + (FX() - 0.5) * 0.4; vines.add(m);
        }
        [[k0 + 0.1, pz0 + 0.1], [k1 - 0.1, pz0 + 0.1]].forEach(function (p) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 2.6), vineMat); m.position.set(p[0], 1.35, p[1] - 0.1); vines.add(m);
          const m2 = m.clone(); m2.rotation.y = Math.PI / 2; m2.position.set(p[0] + (p[0] < cx ? -0.1 : 0.1), 1.35, p[1]); vines.add(m2);
        });
        // mesas: a comprida embaixo da cobertura e duas de piquenique na pérgola
        const kt = [[cx, 28.2, 1.6], [cx, 19.6, 1.2], [cx, 23.6, 1.2]], kSeats = [], kBoxes = [];
        kt.forEach(function (t) {
          rbox(S_.oak, [t[0] - t[2], t[1] - 0.45, t[0] + t[2], t[1] + 0.45], 0.73, 0.78, true);
          [-1, 1].forEach(function (s) {
            rbox(S_.black, [t[0] + s * (t[2] - 0.25) - 0.04, t[1] - 0.35, t[0] + s * (t[2] - 0.25) + 0.04, t[1] + 0.35], 0, 0.73, false, false);
            rbox(S_.oak, [t[0] - t[2], t[1] + s * 0.85 - 0.15, t[0] + t[2], t[1] + s * 0.85 + 0.15], 0.42, 0.47, false);
            rbox(S_.black, [t[0] - t[2] + 0.2, t[1] + s * 0.85 - 0.08, t[0] + t[2] - 0.2, t[1] + s * 0.85 + 0.08], 0, 0.42, false, false);
            for (let x = -t[2] + 0.45; x < t[2] - 0.2; x += 0.9) kSeats.push(seatAt(t[0] + x, t[1] + s * 0.85, s > 0 ? Math.PI : 0, 1.12, -0.65));
          });
          solid(t[0] - t[2], t[1] - 1.0, t[0] + t[2], t[1] + 1.0);
          kBoxes.push([t[0] - t[2], 0, t[1] - 1.05, t[0] + t[2], 0.95, t[1] + 1.05]);
        });
        seats('Sentar à mesa do quiosque', kSeats, kBoxes);
      });

      // ---------- pracinha ao lado da Torre B (foto): torre com escorregador, balanço duplo, gangorra, gira-gira, cavalinho de mola,
      // caixa de areia e bancos; tudo dá para usar ----------
      [[PLAY[0], PLAY[1] - 0.12, PLAY[2], PLAY[1]], [PLAY[0], PLAY[3], PLAY[2], PLAY[3] + 0.12], [PLAY[0] - 0.12, PLAY[1], PLAY[0], PLAY[3]], [PLAY[2], PLAY[1], PLAY[2] + 0.12, PLAY[3]]]
        .forEach(function (r) { rbox(S_.white, r, 0, 0.1, false, false); });
      const TX = 63, TZ = -1.5, TY = 1.3;
      [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(function (c) { box(S_.yellow, 0.14, 2.8, 0.14, TX + c[0], 1.4, TZ + c[1], false); });
      solid(TX - 1.2, TZ - 1.2, TX + 1.2, TZ + 1.2);
      rbox(S_.oak, [TX - 1.1, TZ - 1.1, TX + 1.1, TZ + 1.1], TY - 0.08, TY, false);
      rbox(S_.blue, [TX - 1.04, TZ - 1.1, TX + 1.04, TZ - 1.05], TY + 0.1, TY + 0.85, false);
      rbox(S_.red, [TX + 1.05, TZ - 1.04, TX + 1.1, TZ + 1.04], TY + 0.1, TY + 0.85, false);
      rbox(S_.yellow, [TX - 1.1, TZ - 1.04, TX - 1.05, TZ - 0.42], TY + 0.1, TY + 0.85, false); rbox(S_.yellow, [TX - 1.1, TZ + 0.42, TX - 1.05, TZ + 1.04], TY + 0.1, TY + 0.85, false);
      rbox(S_.green, [TX + 0.42, TZ + 1.05, TX + 1.04, TZ + 1.1], TY + 0.1, TY + 0.85, false); rbox(S_.green, [TX - 1.04, TZ + 1.05, TX - 0.42, TZ + 1.1], TY + 0.1, TY + 0.85, false);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 20), S_.red); wheel.position.set(TX, TY + 0.7, TZ - 1.0); siteG.add(wheel);
      const roofT = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.0, 4), S_.red); roofT.rotation.y = Math.PI / 4; roofT.position.set(TX, 3.3, TZ); roofT.castShadow = true; siteG.add(roofT);
      // escorregador (sul): rampa azul com abas amarelas e saída reta
      const SL = { z0: TZ + 1.1, z1: TZ + 4.3, y0: TY, y1: 0.32 }, sAng = Math.atan2(SL.y0 - SL.y1, SL.z1 - SL.z0), sLen = Math.hypot(SL.y0 - SL.y1, SL.z1 - SL.z0);
      const sBed = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, sLen), S_.blue); sBed.rotation.x = sAng; sBed.position.set(TX, (SL.y0 + SL.y1) / 2 + 0.02, (SL.z0 + SL.z1) / 2); sBed.castShadow = true; siteG.add(sBed);
      [-0.33, 0.33].forEach(function (dx) { const sw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, sLen), S_.yellow); sw.rotation.x = sAng; sw.position.set(TX + dx, (SL.y0 + SL.y1) / 2 + 0.12, (SL.z0 + SL.z1) / 2); sw.castShadow = true; siteG.add(sw); });
      rbox(S_.blue, [TX - 0.31, SL.z1 - 0.05, TX + 0.31, SL.z1 + 0.6], 0.27, 0.32, false); rbox(S_.yellow, [TX - 0.36, SL.z1 - 0.05, TX - 0.31, SL.z1 + 0.6], 0.27, 0.45, false); rbox(S_.yellow, [TX + 0.31, SL.z1 - 0.05, TX + 0.36, SL.z1 + 0.6], 0.27, 0.45, false);
      rbox(S_.dark, [TX - 0.3, SL.z1 + 0.4, TX + 0.3, SL.z1 + 0.6], 0, 0.27, false, false);
      solid(TX - 0.4, SL.z0, TX + 0.4, SL.z1 + 0.6);
      // escada de subir (oeste)
      const lad = new THREE.Group(); lad.position.set(TX - 1.78, 0, TZ); lad.rotation.z = -0.5; siteG.add(lad);
      [-0.28, 0.28].forEach(function (dz) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.06), S_.green); r.position.set(0, 0.75, dz); r.castShadow = true; lad.add(r); });
      for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.56), S_.green); d.position.set(0, 0.2 + i * 0.27, 0); lad.add(d); }
      solid(TX - 1.95, TZ - 0.34, TX - 1.15, TZ + 0.34);
      // descer: sobe a escada, anda até a boca do escorregador, senta, escorrega e sai na frente
      const SLK = [[0, [TX - 2.3, 1.6, TZ]], [1.7, [TX - 0.55, TY + 1.12, TZ]], [2.5, [TX, TY + 0.74, TZ + 1.05]], [2.85, [TX, TY + 0.74, TZ + 1.1]], [4.0, [TX, SL.y1 + 0.74, SL.z1]], [4.45, [TX, SL.y1 + 0.72, SL.z1 + 0.55]]];
      const slide = { t: 0, last: 0 };
      prop({ reach: 3.6, label: function (pt, riding) { return riding ? 'Sair do escorregador' : 'Descer no escorregador'; },
        act: function (pt, riding) {
          if (riding) return { stand: true };
          slide.t = 0; slide.last = 0;
          return { pose: { kind: 'ride', hud: 'No escorregador', standLabel: 'Sair', eye: SLK[0][1], look: [TX - 0.5, 2.2, TZ + 0.6], stand: [TX, SL.z1 + 1.4],
            follow: function (now) {
              slide.t += slide.last ? Math.min(0.1, (now - slide.last) / 1000) : 0; slide.last = now;   // tempo de animação: um engasgo não pula a descida
              const t = slide.t;
              if (t >= SLK[SLK.length - 1][0]) return null;
              let i = 0; while (t > SLK[i + 1][0]) i++;
              const a = SLK[i], b = SLK[i + 1], u = (t - a[0]) / (b[0] - a[0]), e = i === 3 ? u * u : i === 4 ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u);
              return { p: [a[1][0] + (b[1][0] - a[1][0]) * e, a[1][1] + (b[1][1] - a[1][1]) * e, a[1][2] + (b[1][2] - a[1][2]) * e] };
            } } };
        } },
      [[TX - 0.36, 0.25, SL.z0, TX + 0.36, TY + 0.3, SL.z1 + 0.6], [TX - 1.95, 0, TZ - 0.34, TX - 1.15, 1.5, TZ + 0.34]]);
      // balanço duplo: os assentos balançam de verdade (o visitante vai junto, cada vez mais alto)
      const SWX = 69.6, SWZ = -2.2, SWY = 2.5;
      [[-1.9, -0.5], [-1.9, 0.5], [1.9, -0.5], [1.9, 0.5]].forEach(function (c) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.75, 8), S_.blue); leg.position.set(SWX + c[0], 1.32, SWZ + c[1] * 0.8); leg.rotation.x = c[1] * 0.36; leg.castShadow = true; siteG.add(leg); });
      box(S_.blue, 3.95, 0.12, 0.12, SWX, SWY + 0.06, SWZ, false);
      solid(SWX - 2.0, SWZ - 0.95, SWX - 1.8, SWZ + 0.95); solid(SWX + 1.8, SWZ - 0.95, SWX + 2.0, SWZ + 0.95);
      const swings = [-0.8, 0.8].map(function (dx) {
        const piv = new THREE.Group(); piv.position.set(SWX + dx, SWY, SWZ); scene.add(piv);
        [-0.21, 0.21].forEach(function (cx) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.92, 4), S_.dark); ch.position.set(cx, -0.96, 0); piv.add(ch); });
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.24), S_.red); st.position.y = -1.95; st.castShadow = true; piv.add(st);
        return { dx: dx, piv: piv, A: 0, t: 0, th: 0, on: false, go: false };
      });
      prop({ reach: 3.4, label: function (pt, riding) { return riding ? 'Descer do balanço' : 'Andar de balanço'; },
        act: function (pt, riding) {
          if (riding) return { stand: true };
          const s = Math.abs(pt[0] - (SWX - 0.8)) < Math.abs(pt[0] - (SWX + 0.8)) ? swings[0] : swings[1], x = SWX + s.dx;
          s.on = true; s.go = false;
          return { pose: { kind: 'ride', hud: 'No balanço', standLabel: 'Descer do balanço', eye: [x, SWY - 1.25, SWZ], look: [x, SWY - 1.4, SWZ + 3], stand: [x, SWZ + 1.45],
            follow: function () { s.go = true; return { p: [x, SWY - 1.25 * Math.cos(s.th), SWZ - 1.25 * Math.sin(s.th)] }; },
            onEnd: function () { s.on = false; s.go = false; } } };
        },
        step: function (dt) {
          let busy = false;
          swings.forEach(function (s) {
            if (s.on && s.go) s.A += (0.62 - s.A) * Math.min(1, dt * 0.38); else { s.A *= Math.exp(-dt * 0.45); if (s.A < 0.003) s.A = 0; }
            if (!s.A && !s.th) return;
            s.t += dt; s.th = s.A ? s.A * Math.sin(2.21 * s.t) : 0; s.piv.rotation.x = s.th; busy = true;
          });
          return busy;
        }, reset: function () { swings.forEach(function (s) { s.on = s.go = false; s.A = s.th = s.t = 0; s.piv.rotation.x = 0; }); } },
      [[SWX - 1.25, 0.3, SWZ - 0.4, SWX + 1.25, 2.4, SWZ + 0.4]]);
      // gangorra: o visitante senta numa ponta e sobe e desce
      const GX = 69.6, GZ = 4.6, GY = 0.48, G_REST = 0.27;
      box(S_.dark, 0.32, GY, 0.32, GX, GY / 2, GZ, false);
      const gPiv = new THREE.Group(); gPiv.position.set(GX, GY, GZ); gPiv.rotation.z = G_REST; scene.add(gPiv);
      const gp = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.07, 0.3), S_.red); gp.castShadow = true; gPiv.add(gp);
      gPiv.add(new THREE.Mesh(mergeGeos([-1.35, 1.35].map(function (x) { return [new THREE.BoxGeometry(0.34, 0.05, 0.32), mat4(x, 0.06, 0)]; })), S_.black));
      gPiv.add(new THREE.Mesh(mergeGeos([-1.35, 1.35].map(function (x) { return [new THREE.TorusGeometry(0.12, 0.018, 6, 14, Math.PI), mat4(x * 0.8, 0.04, 0, 0, Math.PI / 2, 0)]; })), S_.yellow));
      solid(GX - 1.55, GZ - 0.24, GX + 1.55, GZ + 0.24);
      const gang = { on: false, t: 0, th: G_REST };
      const gEye = function () { const x = -1.3, y = 0.74, c = Math.cos(gang.th), s = Math.sin(gang.th); return [GX + x * c - y * s, GY + x * s + y * c, GZ]; };
      prop({ reach: 3.4, label: function (pt, riding) { return riding ? 'Descer da gangorra' : 'Brincar na gangorra'; },
        act: function (pt, riding) {
          if (riding) return { stand: true };
          gang.on = true; gang.t = 0;
          return { pose: { kind: 'ride', hud: 'Na gangorra', standLabel: 'Descer da gangorra', eye: gEye(), look: [GX + 3, 1.0, GZ], stand: [GX - 1.5, GZ + 0.95],
            follow: function () { return { p: gEye() }; }, onEnd: function () { gang.on = false; } } };
        },
        step: function (dt) {
          if (gang.on) { gang.t += dt; gang.th = G_REST * Math.cos(2.0 * gang.t); gPiv.rotation.z = gang.th; return true; }
          if (Math.abs(gang.th - G_REST) < 0.001) return false;
          gang.th += (G_REST - gang.th) * Math.min(1, dt * 3); gPiv.rotation.z = gang.th; return true;
        }, reset: function () { gang.on = false; gang.th = G_REST; gPiv.rotation.z = G_REST; } },
      [[GX - 1.55, 0, GZ - 0.24, GX + 1.55, 1.0, GZ + 0.24]]);
      // gira-gira: senta na beirada e gira, cada vez mais rápido
      const CGX = 63.2, CGZ = 6.8;
      const gira = new THREE.Group(); gira.position.set(CGX, 0, CGZ); scene.add(gira);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 32), S_.green); disc.position.y = 0.32; disc.castShadow = true; gira.add(disc);
      const gy = [[new THREE.CylinderGeometry(0.06, 0.06, 0.62, 10), mat4(0, 0.68, 0)]];
      for (let a = 0; a < 4; a++) {
        const c = Math.cos(a * Math.PI / 2), sn = Math.sin(a * Math.PI / 2);
        gy.push([new THREE.CylinderGeometry(0.022, 0.022, 0.78, 8), mat4(c * 0.42, 0.97, -sn * 0.42, 0, a * Math.PI / 2, Math.PI / 2)]);
        gy.push([new THREE.CylinderGeometry(0.022, 0.022, 0.6, 8), mat4(c * 0.8, 0.67, -sn * 0.8)]);
      }
      gira.add(new THREE.Mesh(mergeGeos(gy), S_.yellow));
      box(S_.dark, 0.3, 0.27, 0.3, CGX, 0.135, CGZ, false, false);
      solid(CGX - 1.0, CGZ - 1.0, CGX + 1.0, CGZ + 1.0);
      const gg = { on: false, w: 0, ang: 0, last: 0, phi0: 0, a0: 0 };
      const ggEye = function () { const ph = gg.phi0 + gg.ang - gg.a0; return [CGX + 0.74 * Math.cos(ph), 1.12, CGZ - 0.74 * Math.sin(ph)]; };
      prop({ reach: 3.2, label: function (pt, riding) { return riding ? 'Descer do gira-gira' : 'Girar no gira-gira'; },
        act: function (pt, riding) {
          if (riding) return { stand: true };
          gg.phi0 = Math.atan2(-(pt[2] - CGZ), pt[0] - CGX); gg.a0 = gg.ang; gg.last = gg.ang; gg.on = true;
          const e = ggEye();
          return { pose: { kind: 'ride', hud: 'No gira-gira', standLabel: 'Descer do gira-gira', eye: e, look: [e[0] + 3 * Math.cos(gg.phi0), 0.9, e[2] - 3 * Math.sin(gg.phi0)],
            stand: [CGX + 1.7 * Math.cos(gg.phi0), CGZ - 1.7 * Math.sin(gg.phi0)],
            standAt: function () { const ph = gg.phi0 + gg.ang - gg.a0; return [CGX + 1.7 * Math.cos(ph), CGZ - 1.7 * Math.sin(ph)]; },
            follow: function () { const d = gg.ang - gg.last; gg.last = gg.ang; return { p: ggEye(), dyaw: d }; }, onEnd: function () { gg.on = false; } } };
        },
        step: function (dt) {
          if (gg.on) gg.w += (1.5 - gg.w) * Math.min(1, dt * 0.5); else { gg.w *= Math.exp(-dt * 0.6); if (gg.w < 0.01) gg.w = 0; }
          if (!gg.w) return false;
          gg.ang += gg.w * dt; gira.rotation.y = gg.ang; return true;
        }, reset: function () { gg.on = false; gg.w = 0; } },
      [[CGX - 1.0, 0.2, CGZ - 1.0, CGX + 1.0, 1.05, CGZ + 1.0]]);
      // cavalinho de mola (um patinho amarelo) que balança
      const SPX = 66.3, SPZ = 9.5;
      const spr = new THREE.Group(); spr.position.set(SPX, 0.02, SPZ); scene.add(spr);
      rbox(S_.dark, [SPX - 0.3, SPZ - 0.3, SPX + 0.3, SPZ + 0.3], 0, 0.03, false, false);
      const coil = []; for (let i = 0; i < 6; i++) coil.push([new THREE.TorusGeometry(0.1, 0.022, 6, 14), mat4(0, 0.05 + i * 0.06, 0, Math.PI / 2)]);
      spr.add(new THREE.Mesh(mergeGeos(coil), S_.dark));
      const duck = new THREE.Group(); duck.position.y = 0.38; spr.add(duck);
      const db = new THREE.Mesh(mergeGeos([[new THREE.SphereGeometry(0.3, 18, 12), mat4(0, 0.15, 0, 0, 0, 0, 0.8, 0.62, 1.15)], [new THREE.SphereGeometry(0.17, 16, 10), mat4(0, 0.5, 0.26)]]), S_.yellow); db.castShadow = true; duck.add(db);
      const dk = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 10), S_.orange); dk.rotation.x = Math.PI / 2; dk.position.set(0, 0.48, 0.45); duck.add(dk);
      const dhb = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), S_.red); dhb.rotation.z = Math.PI / 2; dhb.position.set(0, 0.42, 0.16); duck.add(dhb);
      solid(SPX - 0.32, SPZ - 0.4, SPX + 0.32, SPZ + 0.45);
      const sp = { on: false, t: 0, th: 0 };
      const spEye = function () { const c = Math.cos(sp.th), s = Math.sin(sp.th), y = 0.95, z = -0.12; return [SPX, 0.4 + y * c - z * s, SPZ + y * s + z * c]; };
      prop({ reach: 3.0, label: function (pt, riding) { return riding ? 'Descer do cavalinho' : 'Andar no cavalinho de mola'; },
        act: function (pt, riding) {
          if (riding) return { stand: true };
          sp.on = true; sp.t = 0;
          return { pose: { kind: 'ride', hud: 'No cavalinho', standLabel: 'Descer do cavalinho', eye: spEye(), look: [SPX, 1.0, SPZ + 3], stand: [SPX + 0.9, SPZ],
            follow: function () { return { p: spEye() }; }, onEnd: function () { sp.on = false; } } };
        },
        step: function (dt) {
          if (sp.on) { sp.t += dt; sp.th = 0.17 * Math.sin(4.6 * sp.t) + 0.04 * Math.sin(10.3 * sp.t); }
          else { if (Math.abs(sp.th) < 0.001) { if (sp.th) { sp.th = 0; duck.rotation.x = 0; } return false; } sp.th *= Math.exp(-dt * 4); }
          duck.rotation.x = sp.th; return true;
        }, reset: function () { sp.on = false; sp.th = 0; duck.rotation.x = 0; } },
      [[SPX - 0.32, 0.2, SPZ - 0.4, SPX + 0.32, 1.0, SPZ + 0.5]]);
      // caixa de areia com moldura de madeira, baldinho e pá
      const SB = [PLAY[2] - 6.5, PLAY[3] - 5.5, PLAY[2] - 1.5, PLAY[3] - 1.2];
      [[SB[0], SB[1], SB[2], SB[1] + 0.12], [SB[0], SB[3] - 0.12, SB[2], SB[3]], [SB[0], SB[1], SB[0] + 0.12, SB[3]], [SB[2] - 0.12, SB[1], SB[2], SB[3]]].forEach(function (r) { rbox(S_.wood, r, 0, 0.2, false); });
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.18, 14), S_.red); bucket.position.set(SB[0] + 1.5, 0.1, SB[1] + 1.4); siteG.add(bucket);
      box(S_.blue, 0.08, 0.02, 0.32, SB[0] + 1.8, 0.03, SB[1] + 1.2, false, false);
      bench(59.9, 3.6, Math.PI / 2); bench(59.9, 8.2, Math.PI / 2); bench(73.0, 0.6, -Math.PI / 2); bench(67.0, 10.45, Math.PI);

      // ---------- espaço pet (foto): tela verde em volta, cerca viva florida roxa por fora, pet care com banheira de inox, torneira e
      // ducha de mão, rampa em A, slalom, obstáculos, túnel, pneu, bebedouro, lixeira com saquinhos e bancos ----------
      const telaMat = (function () {
        const c = canvas(64, 64), g = c.getContext('2d'); g.strokeStyle = '#2F6B3A'; g.lineWidth = 3;
        for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
        const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
        return new THREE.MeshStandardMaterial({ map: t, color: 0xFFFFFF, roughness: 0.6, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide });
      })();
      const tela = function (x0, z0, x1, z1, h) {
        const len = Math.hypot(x1 - x0, z1 - z0), geo = new THREE.PlaneGeometry(len, h), uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.4, uv.getY(i) * h / 0.4);
        const m = new THREE.Mesh(geo, telaMat); m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); siteG.add(m);
        const n = Math.max(1, Math.round(len / 2.4));
        for (let i = 0; i <= n; i++) box(S_.petGreen, 0.05, h + 0.05, 0.05, x0 + (x1 - x0) * i / n, (h + 0.05) / 2, z0 + (z1 - z0) * i / n, false, false);
        rbox(S_.petGreen, x0 === x1 ? [x0 - 0.02, Math.min(z0, z1), x0 + 0.02, Math.max(z0, z1)] : [Math.min(x0, x1), z0 - 0.02, Math.max(x0, x1), z0 + 0.02], h - 0.03, h + 0.02, false, false);
        solid(Math.min(x0, x1) - 0.05, Math.min(z0, z1) - 0.05, Math.max(x0, x1) + 0.05, Math.max(z0, z1) + 0.05);
      };
      [[PET[0], PET[1], PET[2], PET[1]], [PET[2], PET[1], PET[2], PET[3]], [PET[0], PET[1], PET[0], PET[3]], [PET[0], PET[3], 85.4, PET[3]], [87.0, PET[3], PET[2], PET[3]]].forEach(function (s) { tela(s[0], s[1], s[2], s[3], 1.2); });
      const pGate = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.15), telaMat); pGate.position.set(85.45, 0.6, PET[3] - 0.78); pGate.rotation.y = Math.PI / 2; siteG.add(pGate);
      // pet care: painel azul-marinho com a placa, cobertura, bancada com banheira de inox, torneira, ducha de mão, toalheiro e banquinho
      const PCX0 = PET[2] - 4.8, PCX1 = PET[2] - 0.4, PCZ = PET[1] + 0.25;
      rbox(S_.navy, [PCX0, PCZ, PCX1, PCZ + 0.14], 0, 2.5, true);
      rbox(S_.canopy, [PCX0 - 0.2, PCZ - 0.05, PCX1 + 0.2, PCZ + 1.7], 2.5, 2.62, false);
      [[PCX0 - 0.1, PCZ + 1.55], [PCX1 + 0.1, PCZ + 1.55]].forEach(function (p) { box(S_.grey, 0.1, 2.5, 0.1, p[0], 1.25, p[1], true); });
      const pcC = canvas(512, 128), pcg = pcC.getContext('2d');
      pcg.fillStyle = '#1F2D6B'; pcg.fillRect(0, 0, 512, 128); pcg.fillStyle = '#FFFFFF'; pcg.font = '700 64px Archivo, Arial, sans-serif'; pcg.textAlign = 'center'; pcg.textBaseline = 'middle'; pcg.fillText('PET CARE', 286, 66);
      [[70, 64, 1], [110, 40, 0.7]].forEach(function (q) { pcg.save(); pcg.translate(q[0], q[1]); pcg.scale(q[2], q[2]); pcg.beginPath(); pcg.ellipse(0, 10, 16, 13, 0, 0, 6.3); pcg.fill(); [[-16, -10], [-6, -20], [6, -20], [16, -10]].forEach(function (t) { pcg.beginPath(); pcg.ellipse(t[0], t[1], 5.5, 7, 0, 0, 6.3); pcg.fill(); }); pcg.restore(); });
      const pcSign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), std({ map: tex(pcC), roughness: 0.6 })); pcSign.position.set((PCX0 + PCX1) / 2, 2.05, PCZ + 0.145); siteG.add(pcSign);
      rbox(S_.gloss, [PCX0 + 0.3, PCZ + 0.14, PCX1 - 0.3, PCZ + 0.8], 0.1, 0.85, true); rbox(S_.black, [PCX0 + 0.35, PCZ + 0.14, PCX1 - 0.35, PCZ + 0.74], 0, 0.1, false, false);
      rbox(S_.granite, [PCX0 + 0.26, PCZ + 0.14, PCX1 - 0.26, PCZ + 0.84], 0.85, 0.89, false);
      const TB = [PCX0 + 1.0, PCZ + 0.2, PCX0 + 2.6, PCZ + 0.78];
      [[TB[0], TB[1], TB[2], TB[1] + 0.03], [TB[0], TB[3] - 0.03, TB[2], TB[3]], [TB[0], TB[1], TB[0] + 0.03, TB[3]], [TB[2] - 0.03, TB[1], TB[2], TB[3]]].forEach(function (r) { rbox(S_.steel, r, 0.89, 1.28, false); });
      rbox(S_.steel, TB, 0.89, 0.92, false, false);
      const tapX = (TB[0] + TB[2]) / 2;
      box(S_.steel, 0.05, 0.05, 0.36, tapX, 1.62, PCZ + 0.32, false, false); box(S_.steel, 0.04, 0.12, 0.04, tapX, 1.55, PCZ + 0.48, false, false);
      box(S_.steel, 0.1, 0.1, 0.04, tapX - 0.3, 1.45, PCZ + 0.16, false, false);
      tapProp(makeStream(tapX, 1.5, 0.93, PCZ + 0.48, 0.012, 0.03), ['Abrir a torneira do pet care', 'Fechar a torneira do pet care'], [[tapX - 0.4, 1.3, PCZ + 0.14, tapX + 0.2, 1.75, PCZ + 0.56], [TB[0], 0.88, TB[1], TB[2], 1.3, TB[3]]]);
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 6, 20, Math.PI * 1.3), S_.dark); hose.position.set(PCX0 + 3.3, 1.3, PCZ + 0.17); siteG.add(hose);
      box(S_.steel, 0.07, 0.2, 0.07, PCX0 + 3.3, 1.55, PCZ + 0.2, false, false);
      box(S_.steel, 0.7, 0.025, 0.025, PCX0 + 3.6, 1.2, PCZ + 0.2, false, false);
      rbox(S_.cloth, [PCX0 + 3.3, PCZ + 0.17, PCX0 + 3.9, PCZ + 0.21], 0.75, 1.2, false, false);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.08, 18), S_.steel); bowl.position.set(PCX1 - 0.6, 0.04, PCZ + 1.3); siteG.add(bowl);
      // agility: rampa em A, slalom, obstáculos, túnel e pneu
      [-1, 1].forEach(function (s) { const pl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.0), s < 0 ? S_.yellow : S_.blue); pl.position.set(81.5 + s * 0.6, 0.62, 1.5); pl.rotation.z = -s * 0.72; pl.castShadow = true; siteG.add(pl); });
      solid(80.4, 1.0, 82.6, 2.0);
      for (let i = 0; i < 8; i++) box(i % 2 ? S_.white : S_.red, 0.05, 1.0, 0.05, 85.0 + i * 0.8, 0.5, -1.0, false, false);
      [91.5, 93.5, 95.5].forEach(function (x) { box(S_.blue, 0.06, 0.62, 0.06, x, 0.31, 4.0, false, false); box(S_.blue, 0.06, 0.62, 0.06, x, 0.31, 5.2, false, false); box(S_.red, 0.04, 0.04, 1.2, x, 0.48, 4.6, false, false); });
      const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.8, 18, 1, true), std({ color: 0x2E8A5A, roughness: 0.7, side: THREE.DoubleSide }));
      tunnel.rotation.z = Math.PI / 2; tunnel.position.set(82.5, 0.45, 7.2); tunnel.castShadow = true; siteG.add(tunnel); solid(81.1, 6.75, 83.9, 7.65);
      [88.0, 89.6].forEach(function (x) { box(S_.blue, 0.07, 1.5, 0.07, x, 0.75, 7.5, false, false); }); box(S_.blue, 1.67, 0.07, 0.07, 88.8, 1.5, 7.5, false, false);
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.09, 10, 22), S_.rubber); tire.position.set(88.8, 0.85, 7.5); siteG.add(tire);
      box(S_.steel, 0.06, 1.1, 0.06, 78.2, 0.55, 10.2, false, false);
      const lix = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.62, 14), S_.petGreen); lix.position.set(78.7, 0.31, 10.2); siteG.add(lix);
      rbox(S_.gloss, [78.05, 10.12, 78.35, 10.28], 0.9, 1.1, false, false);
      bench(83.0, 10.3, Math.PI); bench(91.0, 10.3, Math.PI);

      // ---------- praça do lazer e jardim da frente: bancos, floreiras ----------
      bench(60.8, -10.85, 0); bench(70.6, -10.85, 0); bench(57.6, 13.1, Math.PI / 2);
      [[63.7, -9.8], [67.8, -9.8]].forEach(function (p) { rbox(S_.concrete, [p[0] - 0.7, p[1] - 0.7, p[0] + 0.7, p[1] + 0.7], 0, 0.45, true); });
      [-70, -50, -40, -14, 6, 20, 44, 56, 76, 90].forEach(function (x) { bench(x, 45.35, Math.PI); });

      // floreiras da praça: folhagem com flores roxas
      const fl = []; [[63.7, -9.8], [67.8, -9.8]].forEach(function (p) { for (let k = 0; k < 5; k++) fl.push([p[0] + Math.cos(k * 1.26) * 0.36, 0.62 + (k % 2) * 0.08, p[1] + Math.sin(k * 1.26) * 0.36, k]); });
      inst(new THREE.IcosahedronGeometry(0.3, 1), S_.petGreen, fl, function (p) { dm.position.set(p[0], p[1], p[2]); dm.scale.set(1, 0.7, 1); });
      inst(new THREE.IcosahedronGeometry(0.16, 0), S_.purple, fl, function (p) { dm.position.set(p[0] + 0.08, p[1] + 0.2, p[2] - 0.05); }, false);
      // bancos de madeira com encosto: todos juntos numa malha por peça; sentar no mais perto de onde se clicou
      inst(new THREE.BoxGeometry(1.8, 0.08, 0.45), S_.wood, BENCH, function (p) { dm.position.set(p[0], 0.45, p[1]); dm.rotation.y = p[2]; });
      inst(new THREE.BoxGeometry(1.8, 0.4, 0.06), S_.wood, BENCH, function (p) { dm.position.set(p[0] - Math.sin(p[2]) * 0.22, 0.75, p[1] - Math.cos(p[2]) * 0.22); dm.rotation.y = p[2]; });
      inst(new THREE.BoxGeometry(1.7, 0.42, 0.1), S_.dark, BENCH, function (p) { dm.position.set(p[0], 0.21, p[1]); dm.rotation.y = p[2]; });
      const benchSeats = [], benchBoxes = [];
      BENCH.forEach(function (p) {
        const a = Math.abs(Math.sin(p[2])) > 0.5, ax = Math.cos(p[2]), az = -Math.sin(p[2]);
        solid(p[0] - (a ? 0.3 : 0.95), p[1] - (a ? 0.95 : 0.3), p[0] + (a ? 0.3 : 0.95), p[1] + (a ? 0.95 : 0.3));
        benchBoxes.push([p[0] - (a ? 0.32 : 0.95), 0, p[1] - (a ? 0.95 : 0.32), p[0] + (a ? 0.32 : 0.95), 1.0, p[1] + (a ? 0.95 : 0.32)]);
        [-0.45, 0.45].forEach(function (o) { benchSeats.push(seatAt(p[0] + ax * o + Math.sin(p[2]) * 0.04, p[1] + az * o + Math.cos(p[2]) * 0.04, p[2], 1.12, 0.8)); });
      });
      seats('Sentar no banco', benchSeats, benchBoxes);

      // ---------- postes de luz (passeios, rua interna, fundos, jardim, portaria) e postes de LED duplo no lazer ----------
      const posts = [];
      for (let x = -76; x <= 58; x += 12) {
        if (!TOWERS.some(function (t) { return Math.abs(x - t.x) < 4; }) && !nearLink(x, 0.8)) posts.push([x, 15.1]);
        if (Math.abs(x + 6 - (ACCESS.x0 + ACCESS.x1) / 2) > 5) posts.push([x + 6, 33.0]);
      }
      for (let x = -54; x <= 54; x += 12) if (Math.abs(x) > 3.5) posts.push([x, -9.65, 1]);      // fundos, entre a torre e as vagas
      [[-67, -18], [-67, 10]].forEach(function (p) { posts.push([p[0], p[1], 2]); });
      [-74, -46, -20, 0, 24, 50, 70, 96].forEach(function (x) { posts.push([x, 48.2, 3]); });   // pista de caminhada do jardim
      [[-34.9, 50.5], [-24.4, 52], [-24.4, 40], [-34.9, 40]].forEach(function (p) { posts.push(p); });
      // poste: coluna cônica, braço e luminária de LED achatada, virada para a rua (ou para o caminho)
      const postYaw = function (p) { return p[2] === 1 ? Math.PI : p[2] === 2 ? Math.PI / 2 : p[2] === 3 ? Math.PI : p[1] < 20 ? 0 : p[1] > 30 && p[1] < 34 ? Math.PI : Math.PI / 2; };
      inst(mergeGeos([[new THREE.CylinderGeometry(0.045, 0.075, 4.3, 10), mat4(0, 2.15, 0)], [new THREE.BoxGeometry(0.05, 0.05, 0.62), mat4(0, 4.22, 0.28)], [new THREE.CylinderGeometry(0.1, 0.12, 0.25, 10), mat4(0, 0.12, 0)]]),
        S_.dark, posts, function (p) { dm.position.set(p[0], 0, p[1]); dm.rotation.y = postYaw(p); });
      inst(mergeGeos([[new THREE.BoxGeometry(0.24, 0.07, 0.5), mat4(0, 4.17, 0.62)]]), lampHeads, posts, function (p) { dm.position.set(p[0], 0, p[1]); dm.rotation.y = postYaw(p); }, false);
      posts.forEach(function (p) { solid(p[0] - 0.12, p[1] - 0.12, p[0] + 0.12, p[1] + 0.12); });
      // LED duplo (como na foto da piscina): mastro alto com duas luminárias, uma para cada lado
      const post2 = [[61.0, -8.6, 0], [72.6, -8.6, 0], [84.5, -9.0, 0], [100.6, -9.0, 0], [101.8, -26.6, Math.PI / 2], [76.0, 13.3, 0], [99.8, 13.3, 0], [58.6, 13.3, 0], [80.8, 24.0, Math.PI / 2], [99.6, 24.0, Math.PI / 2]];
      inst(mergeGeos([[new THREE.CylinderGeometry(0.05, 0.08, 4.6, 10), mat4(0, 2.3, 0)], [new THREE.BoxGeometry(1.0, 0.05, 0.05), mat4(0, 4.55, 0)], [new THREE.CylinderGeometry(0.11, 0.13, 0.25, 10), mat4(0, 0.12, 0)]]),
        S_.dark, post2, function (p) { dm.position.set(p[0], 0, p[1]); dm.rotation.y = p[2]; });
      inst(mergeGeos([[new THREE.BoxGeometry(0.42, 0.07, 0.2), mat4(-0.62, 4.52, 0)], [new THREE.BoxGeometry(0.42, 0.07, 0.2), mat4(0.62, 4.52, 0)]]), lampHeads, post2, function (p) { dm.position.set(p[0], 0, p[1]); dm.rotation.y = p[2]; }, false);
      post2.forEach(function (p) { solid(p[0] - 0.13, p[1] - 0.13, p[0] + 0.13, p[1] + 0.13); });

      // ---------- carros estacionados (mais ou menos metade das vagas) ----------
      const cars = [], CR = rng(31), carCols = ['#E9EAEC', '#1F2328', '#8D939B', '#B9BEC4', '#6B1F24', '#2B3E66', '#D7D2C6', '#3C4A3A'];
      PARK.forEach(function (p, i) {
        for (let x = p[0] + 1.25; x < p[2]; x += 2.5) {
          if (i === 1 && Math.abs(x - (ACCESS.x0 + ACCESS.x1) / 2) < 4.5) continue;
          if (CROSS.some(function (c) { return Math.abs(x - c) < 3.2; }) || nearLink(x, 1.3)) continue;
          if (CR() < 0.48) cars.push([x, i ? p[1] + 2.6 : p[3] - 2.6, i ? 0 : Math.PI, carCols[Math.floor(CR() * carCols.length)]]);
        }
      });
      // fundos: vagas junto ao muro (carro de frente para o corredor) e atrás das torres
      BACK.rows.forEach(function (p, i) {
        for (let x = p[0] + 1.25; x < p[2]; x += 2.5) {
          if (nearLink(x, 1.3)) continue;
          if (CR() < 0.42) cars.push([x, i ? p[1] + 2.5 : p[3] - 2.5, i ? 0 : Math.PI, carCols[Math.floor(CR() * carCols.length)]]);
        }
      });
      // carro: carroceria com capô, porta-malas e teto (perfil extrudado, cantos arredondados), vidros escuros com reflexo e rodas
      const prof = function (pts) { const s = new THREE.Shape(); pts.forEach(function (p, i) { if (i) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); }); return s; };
      const carG = function (shape, depth, bevel) {
        const g = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: !!bevel, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
        g.translate(0, 0, -depth / 2); g.rotateY(-Math.PI / 2); return g;
      };
      const bodyGeo = mergeGeos([carG(prof([[-2.08, 0.3], [-2.1, 0.74], [-1.93, 0.86], [1.9, 0.84], [2.1, 0.66], [2.08, 0.3]]), 1.66, 0.05),
        [new THREE.BoxGeometry(1.6, 0.05, 1.3), mat4(0, 1.445, -0.22)]]);
      const glassGeo = carG(prof([[-1.32, 0.86], [-0.86, 1.4], [0.42, 1.41], [1.0, 0.86]]), 1.56, 0.03);
      const carBody = inst(bodyGeo, std({ color: 0xFFFFFF, roughness: 0.3, metalness: 0.45, envMapIntensity: 1.1 }), cars, function (c) { dm.position.set(c[0], 0, c[1]); dm.rotation.y = c[2]; });
      inst(glassGeo, S_.glassDark, cars, function (c) { dm.position.set(c[0], 0, c[1]); dm.rotation.y = c[2]; });
      const wheels = []; cars.forEach(function (c) { [[-0.8, 1.32], [0.8, 1.32], [-0.8, -1.3], [0.8, -1.3]].forEach(function (o) { wheels.push([c[0], c[1], c[2], o[0], o[1]]); }); });
      const wheelGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.21, 14); wheelGeo.rotateZ(Math.PI / 2);
      inst(wheelGeo, S_.rubber, wheels, function (w) { const s = Math.sin(w[2]), co = Math.cos(w[2]); dm.position.set(w[0] + w[3] * co + w[4] * s, 0.31, w[1] - w[3] * s + w[4] * co); dm.rotation.y = w[2]; });
      const col = new THREE.Color();
      cars.forEach(function (c, i) {
        if (carBody) carBody.setColorAt(i, col.set(c[3]).convertSRGBToLinear());
        solid(c[0] - 1.0, c[1] - 2.25, c[0] + 1.0, c[1] + 2.25);
      });
      if (carBody && carBody.instanceColor) carBody.instanceColor.needsUpdate = true;
      siteG.children.forEach(function (o) { if (o.isInstancedMesh) o.frustumCulled = false; });
      mergeStatic(siteG);
      mergeStatic(hallInt);
      hallInt.traverse(function (o) { if (o.isMesh) { o.castShadow = false; if (o.isInstancedMesh) o.frustumCulled = false; } });
    })();

    /* árvores (no lote e a mata em volta) e casas da vizinhança (instanciadas) */
    (function buildContext() {
      const R = rng(2026), col = new THREE.Color();
      // casas primeiro: as árvores não podem nascer dentro delas
      // casas: atrás do muro do fundo (Rua Gastão), a oeste (Rua Gustavo Veter) e na Rua Marieta Fialho Blessmann
      const houses = [];
      const row = function (x0, x1, z, depth, face) {
        for (let x = x0; x < x1; x += 11 + R() * 4) houses.push([x + R() * 2, z + (R() - 0.5) * 2, 7 + R() * 4, depth * (0.8 + R() * 0.3), 3 + R() * 3.2, face + (R() - 0.5) * 0.08]);
      };
      row(-108, 126, -41, 9, 0); row(-108, 126, -69, 9, 0); row(-108, 126, -82, 9, 0);
      for (let z = -44; z < 76; z += 12 + R() * 3) { houses.push([-110 + R() * 2, z, 9 + R() * 3, 8 + R() * 4, 3 + R() * 3, Math.PI / 2]); }
      for (let z = -44; z < 76; z += 13 + R() * 3) { houses.push([-124 + R() * 2, z, 9 + R() * 3, 8 + R() * 4, 3 + R() * 3, Math.PI / 2]); }
      row(-90, -50, 70.5, 8, Math.PI); row(-200, -26, 91, 8, Math.PI);
      for (let i = 0; i < 420 && houses.length < 190; i++) {
        const x = (R() - 0.5) * 600, z = (R() - 0.5) * 520 - 20;
        if (x > -132 && x < 160 && z > -94 && z < 165) continue;
        if (houses.some(function (h) { return Math.abs(h[0] - x) < 13 && Math.abs(h[1] - z) < 13; })) continue;
        houses.push([x, z, 7 + R() * 6, 8 + R() * 6, 3 + R() * 3.2, R() * 0.4 - 0.2]);
      }
      const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std({ color: 0xffffff }), houses.length);
      const roofG = new THREE.ConeGeometry(0.75, 1, 4); roofG.rotateY(Math.PI / 4);
      const roofs = new THREE.InstancedMesh(roofG, std({ color: 0xffffff, roughness: 0.8 }), houses.length);
      const wallCols = ['#E9E2D3', '#D9D2C2', '#C9D3D8', '#E6D6C2', '#D7DDD0', '#EFE9DE', '#E4CFAE', '#C7D1C2'], roofCols = ['#A0573F', '#8A4E3B', '#6E7378', '#B26A4A', '#7D8288'];
      houses.forEach(function (h, i) {
        dm.rotation.set(0, h[5], 0);
        dm.position.set(h[0], h[4] / 2, h[1]); dm.scale.set(h[2], h[4], h[3]); dm.updateMatrix(); walls.setMatrixAt(i, dm.matrix);
        dm.position.set(h[0], h[4] + 1.0, h[1]); dm.scale.set(h[2] * 1.12, 2.0, h[3] * 1.12); dm.updateMatrix(); roofs.setMatrixAt(i, dm.matrix);
        walls.setColorAt(i, col.set(wallCols[i % wallCols.length]).convertSRGBToLinear()); roofs.setColorAt(i, col.set(roofCols[(i * 7) % roofCols.length]).convertSRGBToLinear());
      });
      dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1);
      walls.castShadow = roofs.castShadow = true; walls.receiveShadow = true;
      walls.frustumCulled = roofs.frustumCulled = false;
      scene.add(walls); scene.add(roofs);

      /* árvores: tronco fora de qualquer coisa construída ou pavimentada; copa sem entrar em telhado, prédio, casa ou muro alto */
      const roofs_ = [[HALL[0] - 1.2, HALL[1] - 1.2, TERR[2] + 1.6, HALL[3] + 1.2], [-38.2, 54.4, GUARD[2] + 0.8, 67.2], [PILLAR[0] - 0.6, PILLAR[1] - 0.6, PILLAR[2] + 0.6, PILLAR[3] + 0.6],
        [TRASH[0] - 0.4, TRASH[1] - 0.4, TRASH[2] + 0.4, LOT.z1], RES, [60.6, -3.9, 65.4, 0.9], [PET[2] - 5.2, PET[1], PET[2], PET[1] + 2]]
        .concat(KIOSKS.map(function (cx) { return [cx - 4.0, 16.8, cx + 4.0, 32.0]; }));
      TOWERS.forEach(function (t) { roofs_.push([t.x - HL - 1, t.z - HD - 1, t.x + HL + 1, t.z + HD + WING_DZ + 3.5]); });
      const paved = [POOLA.fence, PLAY, PET, PLAZA, [HALL[0], HALL[1], TERR[2] + 0.4, HALL[3]], [56, -21, HALL[0], PLAZA[1]], [56.5, 11.4, 101, 15.3], [74.2, PLAZA[3], 76.8, 11.4],
        [ROAD.x0, 9.5, ROAD.x1, 35], [ACCESS.x0 - 1.8, ACCESS.z0, ACCESS.x1 + 1.8, 90], [-46, 52, -12, 67],
        [-80, 46, ACCESS.x0 - 1.6, 47.6], [ACCESS.x1 + 1.6, 46, 101, 47.6], [99.4, 32.5, 101, 46], [TRASH[0] - 0.5, TRASH[1] - 0.5, TRASH[2] + 0.5, LOT.z1],
        [SITE.x0 - 100, -59.5, SITE.x1 + 100, -50], [-101.5, SITE.z0 - 100, -92, SITE.z1 + 100], [SITE.x0 - 100, 76, -23.5, 85.5],
        [BACK.aisle[0] - 0.5, BACK.rows[0][1] - 0.2, BACK.rows[0][2] + 0.5, BACK.rows[1][3] + 0.3]]
        .concat(BACK.links).concat(KIOSKS.map(function (cx) { return [cx - 4.2, 16.6, cx + 4.2, 31.8]; }))
        .concat([-62, -10, 30, 62.4].map(function (x) { return [x, 35, x + 1.6, 46]; }));
      houses.forEach(function (h) { const r = Math.max(h[2], h[3]) * 0.62; roofs_.push([h[0] - r, h[1] - r, h[0] + r, h[1] + r]); });
      const distRect = function (x, z, r) { const dx = Math.max(r[0] - x, 0, x - r[2]), dz = Math.max(r[1] - z, 0, z - r[3]); return Math.hypot(dx, dz); };
      const fit = function (x, z, s) {          // devolve a copa que cabe (0 = não cabe árvore ali)
        if (x > LOT.x0 - 0.8 && x < LOT.x1 + 0.8 && (Math.abs(z - LOT.z0) < 0.8 || Math.abs(z - LOT.z1) < 0.8)) return 0;
        if ((Math.abs(x - LOT.x0) < 0.8 || Math.abs(x - LOT.x1) < 0.8) && z > LOT.z0 && z < LOT.z1) return 0;
        for (let i = 0; i < paved.length; i++) if (distRect(x, z, paved[i]) < 0.8) return 0;
        for (let i = 0; i < roofs_.length; i++) { const d = distRect(x, z, roofs_[i]); if (d < 0.9) return 0; if (d - 0.3 < s) s = d - 0.3; }
        return s >= 1.0 ? s : 0;
      };
      const trees = [];
      // flor: 0 verde, 1 ipê-roxo, 2 ipê-amarelo, 3 flor rosa (as árvores floridas das imagens do lazer)
      const add = function (x, z, s, solid, flor) { s = fit(x, z, s); if (!s) return; trees.push([x, z, s, flor || 0]); if (solid) GROUND_SOLIDS.push([x - 0.3, z - 0.3, x + 0.3, z + 0.3]); };
      // no lote: fileira junto ao muro do fundo, nas laterais, no jardim da frente (duas fileiras) e em volta do lazer
      for (let x = -82; x <= LOT.x1 - 2; x += 6.5) add(x + R(), LOT.z0 + 1.05 + R() * 0.25, 1.5 + R() * 1.6, true);
      for (let z = 10; z <= 58; z += 7) add(-83 + R() * 0.6, z + R(), 1.5 + R() * 1.6, true);
      for (let z = 16; z <= 58; z += 7) add(LOT.x1 - 1.7 - R() * 0.5, z + R(), 1.4 + R() * 1.2, true, z % 3 ? 0 : 2);
      [39.5, 55].forEach(function (z, j) { for (let x = -80, k = 0; x <= 100; x += 8.5, k++) add(x + (R() - 0.5) * 2.5, z + (R() - 0.5) * 2.5, 1.6 + R() * 1.5, true, (k + j) % 4 === 1 ? 1 : (k + j) % 7 === 3 ? 3 : 0); });
      [[-61, 10], [-63, 1], [-1, -10], [1.5, 3], [101.2, 2.8, 1], [101.0, -3.2, 3], [80.8, 20.3, 1], [80.8, 28.6, 2], [57.8, -24.2, 1], [96.5, 18.0, 3], [96.5, 29.5, 1], [64.6, 36.6, 1]].forEach(function (p) { add(p[0], p[1], 1.7 + R() * 1.3, true, p[2] || 0); });
      // mata nativa: ao sul do lote (a leste da rua de acesso) e a leste; árvores esparsas nos quintais e nas calçadas
      const forest = function (x0, z0, x1, z1, step) {
        for (let x = x0; x < x1; x += step) for (let z = z0; z < z1; z += step) add(x + (R() - 0.5) * step * 0.9, z + (R() - 0.5) * step * 0.9, 2 + R() * 2.4);
      };
      forest(-21, 64.5, 175, 160, 4.2);
      forest(LOT.x1 + 2.5, -60, 175, 64.5, 4.2);
      forest(-200, 88, -21, 140, 5.5);
      forest(-90, 64, -49, 74.5, 6);
      for (let i = 0; i < 160; i++) {
        const x = (R() - 0.5) * 520, z = (R() - 0.5) * 440 - 30;
        if (x > -92 && x < LOT.x1 + 4 && z > -50 && z < 100) continue;
        if (x > LOT.x1) continue;
        add(x, z, 1.5 + R() * 1.7);
      }
      // copa: quatro bolhas juntas, sombreamento liso, mais escura embaixo (oclusão), textura de folhas; perto do lote, mais detalhe
      const leafTex = (function () {
        const c = canvas(128, 128), g = c.getContext('2d'), RR = rng(77);
        g.fillStyle = '#C8C8C8'; g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 1400; i++) { const v = 120 + RR() * 135 | 0; g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.beginPath(); g.ellipse(RR() * 128, RR() * 128, 1 + RR() * 2.5, 0.8 + RR() * 1.2, RR() * 3.14, 0, 6.3); g.fill(); }
        const t = tex(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
      })();
      const blobGeo = function (parts, det, seed) {
        const RR = rng(seed), geo = mergeGeos(parts.map(function (p) { return [new THREE.IcosahedronGeometry(p[3], det), mat4(p[0], p[1], p[2])]; }));
        const pos = geo.attributes.position, cols = [];
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), h = Math.sin(x * 4.1 + z * 2.3) * Math.cos(y * 3.7 + x * 1.9) * 0.07;
          pos.setXYZ(i, x * (1 + h), y * (1 + h), z * (1 + h));
          const k = 0.55 + 0.45 * Math.min(1, Math.max(0, (y + 0.85) / 1.7)); cols.push(k, k, k);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        return geo;
      };
      const crownNear = blobGeo([[0, 0, 0, 1], [0.48, -0.18, 0.22, 0.68], [-0.44, -0.12, -0.26, 0.7], [0.06, 0.38, -0.12, 0.62]], 1, 5);
      const crownFar = blobGeo([[0, 0, 0, 1]], 1, 6);
      const crownMat = std({ color: 0xffffff, map: leafTex, roughness: 0.92, vertexColors: true });
      const near = function (p) { return p[0] > LOT.x0 - 30 && p[0] < LOT.x1 + 30 && p[1] > LOT.z0 - 30 && p[1] < LOT.z1 + 30; };
      // em blocos (60 m perto do lote, 160 m longe), cada um com a sua esfera envolvente: o que está fora da tela nem é desenhado
      const trunkGeo = new THREE.CylinderGeometry(0.13, 0.22, 1, 7); trunkGeo.translate(0, 0.5, 0);
      const trunkMat = std({ color: 0x5E4635, roughness: 0.95 });
      const chunks = new Map();
      trees.forEach(function (p) {
        const nr = near(p), cs = nr ? 60 : 160;                    // longe do lote, blocos maiores (árvores esparsas: poucas chamadas)
        const key = (nr ? 'n' : 'f') + Math.floor(p[0] / cs) + ',' + Math.floor(p[1] / cs);
        if (!chunks.has(key)) chunks.set(key, []);
        chunks.get(key).push(p);
      });
      chunks.forEach(function (list, key) {
        const base = key[0] === 'n' ? crownNear : crownFar;
        let cx = 0, cz = 0; list.forEach(function (p) { cx += p[0]; cz += p[1]; }); cx /= list.length; cz /= list.length;
        let r = 0; list.forEach(function (p) { r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cz) + p[2] + 1); });
        const sphere = new THREE.Sphere(new THREE.Vector3(cx, 6, cz), Math.hypot(r, 8));
        const cg = base.clone(), tg = trunkGeo.clone(); cg.boundingSphere = sphere; tg.boundingSphere = sphere;
        const crowns = new THREE.InstancedMesh(cg, crownMat, list.length), trunk = new THREE.InstancedMesh(tg, trunkMat, list.length);
        list.forEach(function (p, i) {
          const s = p[2], h = 2.3 + s * 0.55;                      // copa começa a ~2,3 m: dá para passar embaixo
          dm.rotation.set(0, R() * 6.28, 0); dm.position.set(p[0], 0, p[1]); dm.scale.set(0.8 + s * 0.12, h + s * 0.5, 0.8 + s * 0.12); dm.updateMatrix(); trunk.setMatrixAt(i, dm.matrix);
          dm.position.set(p[0], h + s * 0.62, p[1]); dm.scale.set(s, s * (0.82 + R() * 0.2), s); dm.updateMatrix(); crowns.setMatrixAt(i, dm.matrix);
          if (p[3]) col.set(['', '#8E5BB4', '#E3B23C', '#E58AA8'][p[3]]).offsetHSL(0, 0, (R() - 0.5) * 0.06);
          else col.setHSL(0.21 + R() * 0.08, 0.36 + R() * 0.16, 0.25 + R() * 0.1);
          crowns.setColorAt(i, col.convertSRGBToLinear());
        });
        [crowns, trunk].forEach(function (im) { im.castShadow = true; im.receiveShadow = true; scene.add(im); });
      });
      dm.scale.set(1, 1, 1); dm.rotation.set(0, 0, 0);

      /* palmeiras em volta da piscina, do salão e da portaria: tronco fino e alto, folhas em arco com folíolos (alpha to coverage) */
      const palms = [[103.0, -27.0, 7.2], [84.6, -27.1, 6.4], [78.0, -26.9, 6.0], [-42.8, 60.0, 6.8], [-16.8, 59.6, 7.0]].filter(function (p) {
        return !trees.some(function (t) { return Math.hypot(t[0] - p[0], t[1] - p[1]) < t[2] + 1.5; });
      });
      if (palms.length) {
        const fc = canvas(64, 256), fg = fc.getContext('2d');
        fg.strokeStyle = '#5C8A3A'; fg.lineWidth = 3; fg.beginPath(); fg.moveTo(32, 0); fg.lineTo(32, 256); fg.stroke();
        for (let y = 6; y < 250; y += 5) { const w = 28 * Math.sin(Math.PI * (y / 256) * 0.9 + 0.15); fg.strokeStyle = y % 2 ? '#4C7E31' : '#5E9440'; fg.lineWidth = 2.2; fg.beginPath(); fg.moveTo(32, y); fg.lineTo(32 - w, y + 9); fg.moveTo(32, y); fg.lineTo(32 + w, y + 9); fg.stroke(); }
        const frondMat = std({ map: tex(fc), roughness: 0.85, alphaTest: 0.45, side: THREE.DoubleSide });
        frondMat.alphaToCoverage = true;
        const fgeo = new THREE.PlaneGeometry(1.1, 3.0, 1, 8), fp = fgeo.attributes.position;
        for (let i = 0; i < fp.count; i++) { const t = (fp.getY(i) + 1.5) / 3.0; fp.setXYZ(i, fp.getX(i) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.1))), t * 2.8, -2.2 * t * t); }
        fgeo.rotateX(-Math.PI / 2 + 0.5); fgeo.computeVertexNormals();
        const fronds = [], trunks = [];
        palms.forEach(function (p) {
          trunks.push(p);
          for (let k = 0; k < 10; k++) fronds.push([p[0], p[1], p[2], k * 0.628 + R() * 0.3, -0.15 + R() * 0.3]);
          GROUND_SOLIDS.push([p[0] - 0.25, p[1] - 0.25, p[0] + 0.25, p[1] + 0.25]);
        });
        const pt = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.19, 1, 8).translate(0, 0.5, 0), std({ color: 0x8C7A62, roughness: 0.95 }), trunks.length);
        trunks.forEach(function (p, i) { dm.position.set(p[0], 0, p[1]); dm.rotation.set(0.04, i, 0); dm.scale.set(1, p[2], 1); dm.updateMatrix(); pt.setMatrixAt(i, dm.matrix); });
        const pf = new THREE.InstancedMesh(fgeo, frondMat, fronds.length);
        fronds.forEach(function (f, i) { dm.position.set(f[0], f[2] - 0.1, f[1]); dm.rotation.set(f[4], f[3], 0, 'YXZ'); dm.scale.set(1, 1, 1); dm.updateMatrix(); pf.setMatrixAt(i, dm.matrix); });
        dm.rotation.set(0, 0, 0, 'XYZ'); dm.scale.set(1, 1, 1);
        [pt, pf].forEach(function (im) { im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); });
      }

      /* arbustos e canteiros: cerca viva junto ao muro do fundo e à grade da frente, entre as torres, na portaria e no espaço pet */
      const bushes = [];
      // force: canteiro desenhado de propósito (pode ficar junto do piso)
      const bush = function (x, z, r, c, force) { if ((!force && !fit(x, z, 1.2)) || trees.some(function (t) { return Math.hypot(t[0] - x, t[1] - z) < 0.9; })) return; bushes.push([x, z, r, c]); GROUND_SOLIDS.push([x - r * 0.7, z - r * 0.7, x + r * 0.7, z + r * 0.7]); };
      for (let x = LOT.x0 + 1.5; x < LOT.x1 - 1; x += 1.25) bush(x + R() * 0.3, LOT.z0 + 0.9, 0.6 + R() * 0.25, 0);
      for (let x = LOT.x0 + 2; x < LOT.x1 - 1; x += 1.4) if (x < -43 || x > -15) bush(x + R() * 0.3, LOT.z1 - 1.0, 0.55 + R() * 0.2, R() < 0.25 ? 1 : 0);
      for (let z = -4; z <= 8; z += 1.5) { bush(-0.6 + R() * 0.3, z, 0.5 + R() * 0.2, 0); }
      // canteiro de flores roxas na frente do pilar MILÃO (foto da portaria) e junto da guarita
      for (let x = -43.7; x < -37.0; x += 0.62) { bush(x + R() * 0.15, 63.95 + R() * 0.15, 0.42 + R() * 0.1, 3, true); bush(x + 0.3, 64.75 + R() * 0.12, 0.4 + R() * 0.1, 3, true); }
      [[-17.6, 61.0], [-16.4, 60.6], [-15.2, 61.0], [-41.6, 61.0], [-40.6, 60.7]].forEach(function (p) { bush(p[0], p[1], 0.5, 3, true); });
      // cerca viva florida roxa entre o espaço pet e a piscina e do lado de fora do pet (foto), flores junto aos quiosques e ao salão
      for (let x = PET[0] + 0.5; x < PET[2] - 0.3; x += 0.95) bush(x + R() * 0.2, PET[1] - 1.45 + R() * 0.15, 0.5 + R() * 0.12, R() < 0.8 ? 3 : 0, true);
      for (let z = PET[1] + 0.6; z < PET[3] - 0.5; z += 0.95) bush(PET[2] + 0.75 + R() * 0.15, z + R() * 0.2, 0.48 + R() * 0.12, R() < 0.8 ? 3 : 0, true);
      for (let z = 17.2; z < 31.5; z += 1.15) bush(66.65 + R() * 0.15, z + R() * 0.2, 0.42 + R() * 0.1, R() < 0.5 ? 1 : 2, true);
      [[58.3, -22.6], [58.3, -23.8], [57.4, -11.2], [76.4, -11.4], [76.4, -6.0]].forEach(function (p) { bush(p[0], p[1], 0.5, R() < 0.6 ? 3 : 1, true); });
      const bushCols = [['#3F6E34', '#4F7F3C', '#5B8A43'], ['#C8466A', '#E07A3A', '#D9B13A'], ['#6E5AA8', '#C8466A', '#F2F0EA'], ['#7B4FA8', '#8E5DB8', '#6A4596', '#A06CC8', '#5E8A43']];
      const bm = new THREE.InstancedMesh(blobGeo([[0, 0, 0, 1], [0.5, -0.2, 0.1, 0.6], [-0.45, -0.2, -0.1, 0.6]], 1, 9), crownMat, bushes.length);
      bushes.forEach(function (b, i) {
        dm.position.set(b[0], b[2] * 0.55, b[1]); dm.rotation.set(0, R() * 6.28, 0); dm.scale.set(b[2], b[2] * 0.75, b[2]); dm.updateMatrix(); bm.setMatrixAt(i, dm.matrix);
        const pal = bushCols[b[3]]; col.set(pal[Math.floor(R() * pal.length)]); if (b[3] === 0) col.offsetHSL(0, 0, (R() - 0.5) * 0.06); bm.setColorAt(i, col.convertSRGBToLinear());
      });
      dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1);
      bm.castShadow = true; bm.receiveShadow = true; bm.frustumCulled = false; scene.add(bm);
    })();

    /* ---------------- andar aberto: laje com os 12 apartamentos ---------------- */
    const unitMats = {};
    function unitMat(st, dim) {
      const key = st + (dim ? '-dim' : '');
      if (!unitMats[key]) {
        unitMats[key] = std({ color: colors[st], roughness: 0.6, transparent: !!dim, opacity: dim ? 0.28 : 1, depthWrite: !dim,
          emissive: st === 'reservado' ? colors[st] : 0x000000, emissiveIntensity: st === 'reservado' ? 0.5 : 0 });
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
    function miniModel(parent, tipo, w, d, lit, dim, res) {
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
      const mat = res ? (dim ? resMiniDim : resMini) : miniMats[(lit ? 'on' : 'off') + (dim ? 'Dim' : '')];
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
      PARTS.forEach(function (pt) { b(plateMats.slab, pt.x1 - pt.x0, 0.24, pt.z1 - pt.z0, (pt.x0 + pt.x1) / 2, y + 0.12, (pt.z0 + pt.z1) / 2); });
      b(plateMats.corridor, HL - 1.8 - 0.2, 0.04, 2 * CORR + 0.3, -(HL + 1.8 - 0.2) / 2, y + 0.26, 0);
      b(plateMats.corridor, HL - 1.8 - 0.2, 0.04, 2 * CORR + 0.3, (HL + 1.8 - 0.2) / 2, y + 0.26, WING_DZ);
      b(plateMats.corridor, 3.6, 0.04, WING_DZ + 2 * CORR, 0, y + 0.26, WING_DZ / 2);
      tw.shafts = [];
      SHAFTS.forEach(function (r) {                                // elevadores (frente), escada (fundos) e poços de ventilação
        const h = r[4] === 'poco' ? FH * 0.45 : FH * 0.55;
        tw.shafts.push(b(plateMats.shaft, r[2] - r[0], h, r[3] - r[1], (r[0] + r[2]) / 2, y + h / 2, (r[1] + r[3]) / 2));
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
        miniModel(inner, tp, w, d, st === 'livre', dim, st === 'reservado');
        const info = { unit: pos, torre: tw.T.id, andar: andar, status: st, tipo: tp, dim: dim, baseY: ug.position.y, base: base, plan: plan,
          front: pl.front, half: d / 2 };
        base.userData = info; plan.userData = info; ug.userData = info;
        tw.units.push(ug);
      }
      if (apt && sel && sel.torre === tw.T.id) tw.corr = buildCorridor(tw, andar, apt.pos, g);
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
        parede: tex(parede), piso: rep(tex(piso), 1, 1), madeira: tex(madeira), inox: tex(inox), veneziana: tex(veneziana),
        capacho: tex(capacho), luz: tex(luz, false), placa: placa
      };
    })();
    const corrMats = {
      wall: std({ color: 0xEAE2D5, map: CT.parede, roughness: 0.92 }),
      trim: std({ color: 0xFCFCFA, roughness: 0.42 }),
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

    /* ---------------- elevador: portas de pavimento, cabine com painel de botões, indicadores ----------------
       As folhas correm para dentro da parede (nos andares e no hall de entrada do térreo); o indicador em cima de cada porta e o
       mostrador da cabine contam os andares; o painel tem T e 1 a 12, abrir e fechar. Quem controla é a visita (apartamento/app.js). */
    const EL = (function () {
      const R = rng(612);
      const granite = canvas(256, 256), gg = granite.getContext('2d');
      gg.fillStyle = '#2E3034'; gg.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) { const c = R(); gg.fillStyle = c < 0.5 ? 'rgba(10,10,12,.5)' : c < 0.85 ? 'rgba(90,92,98,.45)' : 'rgba(170,170,176,.4)'; gg.beginPath(); gg.arc(R() * 256, R() * 256, 0.5 + R() * 1.5, 0, 6.3); gg.fill(); }
      const gt = tex(granite); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(2, 2);
      const caixas = canvas(128, 256), cx = caixas.getContext('2d');          // caixas de correio
      cx.fillStyle = '#C9CED4'; cx.fillRect(0, 0, 128, 256);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) {
        cx.fillStyle = '#B4BAC1'; cx.fillRect(4 + c * 31, 4 + r * 31, 28, 28); cx.fillStyle = '#3A3F47'; cx.fillRect(10 + c * 31, 9 + r * 31, 16, 3);
        cx.fillStyle = '#E6E9EC'; cx.fillRect(4 + c * 31, 4 + r * 31, 28, 1.5);
      }
      const m = {
        door: std({ map: CT.inox, color: 0xE4E7EA, roughness: 0.3, metalness: 0.55 }),
        frame: std({ map: CT.inox, color: 0xF2F3F5, roughness: 0.26, metalness: 0.6 }),
        sill: std({ color: 0x9EA3AA, roughness: 0.35, metalness: 0.6 }),
        wall: std({ map: CT.inox, color: 0xD3D7DC, roughness: 0.46, metalness: 0.45 }),
        floor: std({ map: gt, roughness: 0.22, metalness: 0.05 }),
        ceil: std({ color: 0xEDEDEA, roughness: 0.8 }),
        light: new THREE.MeshBasicMaterial({ color: lin(0xFFF4E2) }),
        rail: std({ color: 0xDADDE1, roughness: 0.18, metalness: 0.85 }),
        black: std({ color: 0x17191D, roughness: 0.35 }),
        caixas: std({ map: tex(caixas), roughness: 0.4, metalness: 0.3 })
      };
      // mostrador: andar do elevador e a seta (o mesmo nos indicadores dos andares e dentro da cabine)
      const dc = canvas(128, 64), dg = dc.getContext('2d'), dt = tex(dc);
      function drawDisplay(txt, dir) {
        dg.fillStyle = '#08090B'; dg.fillRect(0, 0, 128, 64);
        dg.fillStyle = '#FF5A3C'; dg.font = '700 40px ' + MONO; dg.textAlign = 'center'; dg.textBaseline = 'middle'; dg.fillText(txt, 76, 34);
        if (dir) { dg.beginPath(); if (dir > 0) { dg.moveTo(18, 40); dg.lineTo(30, 22); dg.lineTo(42, 40); } else { dg.moveTo(18, 24); dg.lineTo(30, 42); dg.lineTo(42, 24); } dg.fill(); }
        dt.needsUpdate = true;
      }
      drawDisplay('T', 0);
      m.disp = new THREE.MeshBasicMaterial({ map: dt, toneMapped: false });
      // painel da cabine: T e 1 a 12 em duas colunas (de baixo para cima), abrir e fechar a porta embaixo
      const PW = 128, PH = 448, keys = [];
      keys.push({ id: 'open', x: 38, y: 404 }, { id: 'close', x: 90, y: 404 });
      for (let n = 0; n <= FLOORS; n++) keys.push({ id: 'floor', n: n, x: n % 2 ? 90 : 38, y: 348 - Math.floor(n / 2) * 50 });
      const pc = canvas(PW, PH), pg = pc.getContext('2d'), pt = tex(pc);
      function drawPanel(sel, apt) {
        const gr = pg.createLinearGradient(0, 0, PW, 0); gr.addColorStop(0, '#B9BEC4'); gr.addColorStop(0.5, '#E3E6E9'); gr.addColorStop(1, '#B4B9BF');
        pg.fillStyle = gr; pg.fillRect(0, 0, PW, PH);
        pg.fillStyle = 'rgba(0,0,0,.18)'; pg.fillRect(0, 0, PW, 2); pg.fillRect(0, PH - 2, PW, 2);
        pg.fillStyle = '#3A3F47'; pg.font = '600 13px ' + FONT; pg.textAlign = 'center'; pg.textBaseline = 'middle'; pg.fillText('TORRE', 64, 18);
        pg.font = '600 10px ' + FONT; pg.fillText('8 PESSOAS · 600 kg', 64, 34);
        keys.forEach(function (k) {
          const on = k.id === 'floor' && sel === k.n;
          pg.beginPath(); pg.arc(k.x, k.y, 19, 0, 6.3); pg.fillStyle = '#8E949B'; pg.fill();
          pg.beginPath(); pg.arc(k.x, k.y, 16, 0, 6.3); pg.fillStyle = on ? '#FFE3A1' : '#F4F5F6'; pg.fill();
          pg.lineWidth = 3; pg.strokeStyle = on ? '#FFB21F' : '#C9CDD2'; pg.stroke();
          pg.fillStyle = on ? '#7A4B00' : '#22262C'; pg.font = '700 15px ' + FONT;
          if (k.id === 'floor') pg.fillText(k.n ? String(k.n) : 'T', k.x, k.y + 1);
          else {                                            // ◄|► abre, ►|◄ fecha
            const o = k.id === 'open' ? 1 : -1; pg.beginPath();
            pg.moveTo(k.x - 2, k.y - 6); pg.lineTo(k.x - 2 - 6 * o, k.y); pg.lineTo(k.x - 2, k.y + 6);
            pg.moveTo(k.x + 2, k.y - 6); pg.lineTo(k.x + 2 + 6 * o, k.y); pg.lineTo(k.x + 2, k.y + 6); pg.fill();
            pg.fillRect(k.x - 0.8, k.y - 7, 1.6, 14);
          }
          if (k.id === 'floor' && k.n === apt) { pg.fillStyle = '#22318A'; pg.beginPath(); pg.arc(k.x + 17, k.y - 15, 4, 0, 6.3); pg.fill(); }
        });
        pt.needsUpdate = true;
      }
      drawPanel(null, 0);
      m.panel = new THREE.MeshBasicMaterial({ map: pt });
      // botão de chamada no hall: apagado ou aceso
      const callTex = function (on) {
        const c = canvas(64, 160), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0);
        gr.addColorStop(0, '#B9BEC4'); gr.addColorStop(0.5, '#E6E8EB'); gr.addColorStop(1, '#B4B9BF'); g.fillStyle = gr; g.fillRect(0, 0, 64, 160);
        [[50, 1], [110, -1]].forEach(function (b) {
          g.beginPath(); g.arc(32, b[0], 17, 0, 6.3); g.fillStyle = '#8E949B'; g.fill();
          g.beginPath(); g.arc(32, b[0], 14, 0, 6.3); g.fillStyle = on ? '#FFE3A1' : '#F4F5F6'; g.fill(); g.lineWidth = 3; g.strokeStyle = on ? '#FFB21F' : '#C9CDD2'; g.stroke();
          g.fillStyle = on ? '#7A4B00' : '#22262C'; g.beginPath(); g.moveTo(24, b[0] + 5 * b[1]); g.lineTo(32, b[0] - 6 * b[1]); g.lineTo(40, b[0] + 5 * b[1]); g.fill();
        });
        return new THREE.MeshBasicMaterial({ map: tex(c) });
      };
      m.callOff = callTex(false); m.callOn = callTex(true);
      return { m: m, keys: keys, drawDisplay: drawDisplay, drawPanel: drawPanel, PW: PW, PH: PH, shown: 'T', dir: 0, sel: undefined };
    })();
    const elMats = EL.m;
    // portas de pavimento dos dois elevadores numa parede (face em z = zf): s = -1 hall em z < zf (andares), s = +1 em z > zf (térreo)
    function landingDoors(parent, y0, zf, s, solids) {
      const out = { leaves: [], call: null, y0: y0 };
      const zIn = function (d) { return zf - s * d; };                     // d metros para dentro da parede, longe do hall
      const add = function (mat, x0, x1, da, db, h0, h1) {
        const za = zIn(da), zb = zIn(db), m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h1 - h0, Math.abs(zb - za)), mat);
        m.position.set((x0 + x1) / 2, y0 + (h0 + h1) / 2, (za + zb) / 2); parent.add(m); return m;
      };
      [LIFT.x2, LIFT.x].forEach(function (x) {
        const a = x - LIFT.half, b = x + LIFT.half;
        const L = add(elMats.door, a, x + 0.004, 0.035, 0.07, 0, 2.15), Rr = add(elMats.door, x - 0.004, b, 0.035, 0.07, 0, 2.15);
        L.userData.x0 = L.position.x; Rr.userData.x0 = Rr.position.x; L.userData.keep = Rr.userData.keep = true;
        add(elMats.frame, a - 0.08, a, -0.022, 0.03, 0, 2.23); add(elMats.frame, b, b + 0.08, -0.022, 0.03, 0, 2.23);
        add(elMats.frame, a - 0.08, b + 0.08, -0.022, 0.03, 2.15, 2.23);
        add(elMats.sill, a - 0.02, b + 0.02, -0.06, 0.14, -0.012, 0.014);
        const ind = add(x === LIFT.x ? elMats.disp : elMats.black, x - 0.15, x + 0.15, -0.03, 0.0, 2.31, 2.41);
        if (x !== LIFT.x) ind.material = EL.idle || (EL.idle = (function () { const c = canvas(128, 64), g = c.getContext('2d'); g.fillStyle = '#08090B'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#FF5A3C'; g.font = '700 40px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('T', 76, 34); return new THREE.MeshBasicMaterial({ map: tex(c), toneMapped: false }); })());
        if (x === LIFT.x) out.leaves.push(L, Rr);
      });
      add(elMats.frame, -0.07, 0.07, -0.016, 0.0, 0.98, 1.32);
      const btn = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.25), elMats.callOff);
      btn.position.set(0, y0 + 1.15, zIn(-0.018)); if (s < 0) btn.rotation.y = Math.PI;
      btn.userData.elev = { id: 'call' }; btn.userData.keep = true; parent.add(btn);
      out.call = btn;
      if (solids) { const r = [LIFT.x2 - LIFT.half, Math.min(zIn(0), zIn(0.12)), LIFT.x2 + LIFT.half, Math.max(zIn(0), zIn(0.12))]; r.noSkirt = true; solids.push(r); }
      return out;
    }
    // cabine (no sistema da torre, piso em y = 0 do grupo): paredes de inox, piso de granito, forro com luz, corrimão,
    // portas da frente (andares) e de trás (térreo), painel de botões e mostrador dos dois lados
    function buildCab() {
      const g = new THREE.Group(), xc = LIFT.x, w = LIFT.w, z0 = LIFT.in0, z1 = LIFT.in1, H = LIFT.h;
      const add = function (mat, x0, x1, za, zb, h0, h1) { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h1 - h0, zb - za), mat); m.position.set((x0 + x1) / 2, (h0 + h1) / 2, (za + zb) / 2); m.receiveShadow = true; g.add(m); return m; };
      add(elMats.floor, xc - w - 0.04, xc + w + 0.04, z0 - 0.04, z1 + 0.04, -0.06, 0);
      add(elMats.wall, xc - w - 0.04, xc - w, z0 - 0.04, z1 + 0.04, 0, H);
      add(elMats.wall, xc + w, xc + w + 0.04, z0 - 0.04, z1 + 0.04, 0, H);
      [[z0 - 0.04, z0], [z1, z1 + 0.04]].forEach(function (zz) {
        add(elMats.wall, xc - w, xc - LIFT.half, zz[0], zz[1], 0, H); add(elMats.wall, xc + LIFT.half, xc + w, zz[0], zz[1], 0, H);
        add(elMats.wall, xc - LIFT.half, xc + LIFT.half, zz[0], zz[1], 2.15, H);
      });
      add(elMats.ceil, xc - w - 0.04, xc + w + 0.04, z0 - 0.04, z1 + 0.04, H, H + 0.04);
      add(elMats.light, xc - w + 0.12, xc + w - 0.12, z0 + 0.15, z1 - 0.15, H - 0.012, H);
      add(elMats.black, xc - w, xc + w, z0, z1, 0, 0.1).material = elMats.sill;                   // rodapé de inox
      // corrimão na parede do lado do poço vizinho
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, z1 - z0 - 0.3, 12), elMats.rail);
      rail.rotation.x = Math.PI / 2; rail.position.set(xc - w + 0.07, 0.92, (z0 + z1) / 2); g.add(rail);
      [z0 + 0.2, z1 - 0.2].forEach(function (z) { add(elMats.rail, xc - w, xc - w + 0.07, z - 0.012, z + 0.012, 0.9, 0.94); });
      // portas da cabine: folhas que correm por dentro, junto da parede
      const leaves = function (z) { const L = add(elMats.door, xc - LIFT.half, xc + 0.004, z - 0.012, z + 0.012, 0, 2.15), Rr = add(elMats.door, xc - 0.004, xc + LIFT.half, z - 0.012, z + 0.012, 0, 2.15); L.userData.x0 = L.position.x; Rr.userData.x0 = Rr.position.x; return [L, Rr]; };
      const front = leaves(z0 + 0.014), rear = leaves(z1 - 0.014);
      // painel de botões ao lado de cada porta e mostrador em cima
      const panelAt = function (x, z, ry) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.7), elMats.panel); p.position.set(x, 1.24, z); p.rotation.y = ry; p.userData.elev = { id: 'panel' }; g.add(p); return p; };
      const pf = panelAt(xc + LIFT.half + 0.15, z0 + 0.003, 0), pr = panelAt(xc - LIFT.half - 0.15, z1 - 0.003, Math.PI);
      [[z0 + 0.003, 0], [z1 - 0.003, Math.PI]].forEach(function (a) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), elMats.disp); d.position.set(xc, 2.24, a[0]); d.rotation.y = a[1]; g.add(d); });
      return { grp: g, front: front, rear: rear, panels: [pf, pr] };
    }
    // hall de entrada de cada torre, no térreo, dentro do núcleo: porta de vidro automática, caixas de correio, portas de trás dos elevadores
    const lobbies = {};
    function buildLobby(T) {
      const g = new THREE.Group(); g.position.set(T.x, 0, T.z); scene.add(g);
      const zb = LIFT.rear, zf = ENTRY_Z, H = 2.8;
      const add = function (mat, x0, x1, za, zb2, h0, h1, cast) { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h1 - h0, zb2 - za), mat); m.position.set((x0 + x1) / 2, (h0 + h1) / 2, (za + zb2) / 2); m.receiveShadow = true; m.castShadow = !!cast; g.add(m); return m; };
      add(corrMats.floor, -1.8, 1.8, zb - 0.16, zf, 0, 0.06);
      add(corrMats.ceil, -1.8, 1.8, zb - 0.16, zf - 0.006, H, H + 0.1);
      add(corrMats.wall, -1.8, -1.68, zb, zf - 0.006, 0, H); add(corrMats.wall, 1.68, 1.8, zb, zf - 0.006, 0, H);
      // parede do fundo azul-marinho com as portas de trás dos dois elevadores e o nome da torre
      [[-1.8, LIFT.x2 - LIFT.half], [LIFT.x2 + LIFT.half, LIFT.x - LIFT.half], [LIFT.x + LIFT.half, 1.8]].forEach(function (s) { add(corrMats.navy, s[0], s[1], zb - 0.14, zb, 0.06, H); });
      [LIFT.x2, LIFT.x].forEach(function (x) { add(corrMats.navy, x - LIFT.half, x + LIFT.half, zb - 0.14, zb, 2.21, H); });
      const doors = landingDoors(g, 0.06, zb, 1, null);
      const nome = sign('torre' + T.id, 256, 64, function (c) { c.fillStyle = '#22318A'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#E2B444'; c.font = '700 34px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TORRE ' + T.id, 128, 34); });
      const pn = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.225), nome); pn.position.set(0, 2.6, zb + 0.004); g.add(pn);
      // caixas de correio (oeste), vaso com planta e banco (leste), forro com luzes, rodapé
      add(elMats.caixas, -1.68, -1.42, LOBBY.mail[0], LOBBY.mail[1], 0.95, 2.05);
      add(corrMats.dark, -1.68, -1.40, LOBBY.mail[0] - 0.03, LOBBY.mail[1] + 0.03, 0.92, 0.95);
      const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.56, 24), corrMats.dark); vaso.position.set(1.41, 0.34, LOBBY.plant); g.add(vaso);
      const folhas = new THREE.Group(); folhas.position.set(1.41, 0.62, LOBBY.plant); g.add(folhas);
      const folhaM = std({ color: 0x3F7A3A, roughness: 0.7, side: THREE.DoubleSide });
      for (let i = 0; i < 9; i++) {                                          // costela-de-adão: folhas largas em hastes
        const f = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), folhaM), a = i * 2.4;
        f.position.set(Math.cos(a) * 0.17, 0.35 + (i % 3) * 0.22, Math.sin(a) * 0.17); f.rotation.set(-0.9 + (i % 2) * 0.3, -a + Math.PI / 2, 0); f.scale.set(1, 1.3, 1);
        folhas.add(f);
      }
      add(corrMats.door, 1.32, 1.68, LOBBY.bench[0], LOBBY.bench[1], 0.45, 0.5); [LOBBY.bench[0] + 0.1, LOBBY.bench[1] - 0.1].forEach(function (z) { add(corrMats.dark, 1.36, 1.64, z - 0.03, z + 0.03, 0.06, 0.45); });
      [[-0.9, zb + 0.95], [0.9, zb + 0.95], [0, zf - 0.7]].forEach(function (p) { add(elMats.light, p[0] - 0.22, p[0] + 0.22, p[1] - 0.22, p[1] + 0.22, H - 0.01, H); });
      add(corrMats.skirting, -1.68, -1.665, zb, zf, 0.06, 0.14); add(corrMats.skirting, 1.665, 1.68, zb, zf, 0.06, 0.14);
      // porta automática de vidro: duas folhas que correm para os lados, vidros fixos e caixilho escuro
      const glass = std({ color: 0xD5E3EE, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.3, depthWrite: false });
      add(S_.dark, -1.68, 1.68, zf - 0.07, zf - 0.006, 2.42, 2.52); add(S_.dark, -1.68, -1.6, zf - 0.07, zf - 0.006, 0.06, 2.42); add(S_.dark, 1.6, 1.68, zf - 0.07, zf - 0.006, 0.06, 2.42);
      add(glass, -1.6, -0.8, zf - 0.05, zf - 0.035, 0.06, 2.42); add(glass, 0.8, 1.6, zf - 0.05, zf - 0.035, 0.06, 2.42);
      const slide = [-1, 1].map(function (sx) {
        const lg = new THREE.Group(); g.add(lg);
        const a = sx < 0 ? -0.82 : 0, b = sx < 0 ? 0 : 0.82;
        const gl = new THREE.Mesh(new THREE.BoxGeometry(b - a, 2.34, 0.012), glass); gl.position.set((a + b) / 2, 0.06 + 1.19, zf - 0.02); lg.add(gl);
        [[a, a + 0.04], [b - 0.04, b]].forEach(function (r) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.36, 0.04), S_.dark); f.position.set((r[0] + r[1]) / 2, 0.06 + 1.18, zf - 0.02); lg.add(f); });
        const hb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.02), S_.steel); hb.position.set(sx < 0 ? b - 0.1 : a + 0.1, 1.1, zf + 0.0); lg.add(hb);
        return lg;
      });
      mergeStatic(g);
      lobbies[T.id] = { grp: g, doors: doors, slide: slide, k: 0 };
    }
    function setLeaves(list, k) { if (list) { list[0].position.x = list[0].userData.x0 - LIFT.half * k; list[1].position.x = list[1].userData.x0 + LIFT.half * k; } }
    TOWERS.forEach(buildLobby);
    function shownChain(o) { while (o) { if (o.visible === false) return false; o = o.parent; } return true; }
    function disposeGroup(g) { if (!g) return; if (g.parent) g.parent.remove(g); g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }

    // estado do elevador durante a visita: a visita (apartamento/app.js) manda o estado a cada mudança; aqui só se desenha
    let elev = null;
    function elevSetup(tw) {
      const cab = buildCab(); tw.root.add(cab.grp);
      elev = { tw: tw, cab: cab, y: stopY(0), cabVisible: false, st: null };
      cab.grp.position.y = elev.y; cab.grp.visible = false;
      EL.sel = undefined; EL.drawPanel(null, sel.andar); EL.drawDisplay('T', 0); EL.shown = 'T'; EL.dir = 0;
    }
    function elevTeardown() {
      if (!elev) return;
      disposeGroup(elev.cab.grp);
      if (elev.tw.corrN) { disposeGroup(elev.tw.corrN.grp); elev.tw.corrN = null; }
      Object.keys(lobbies).forEach(function (id) { const L = lobbies[id]; setLeaves(L.doors.leaves, 0); L.doors.call.material = elMats.callOff; L.k = 0; L.slide[0].position.x = 0; L.slide[1].position.x = 0; });
      EL.drawDisplay('T', 0); EL.shown = 'T'; EL.dir = 0;
      elev = null;
    }
    function elevLandings() { const tw = elev.tw; return [lobbies[tw.T.id].doors, tw.corr && tw.corr.lift, tw.corrN && tw.corrN.lift]; }
    // st: { at: parada onde a cabine está (ou null andando), y: piso da cabine, door: 0..1, shown: 'T'|'5', dir, sel, call, level, floor }
    function elevUpdate(st) {
      if (!elev) return;
      const tw = elev.tw;
      elevLandings().forEach(function (l) { if (l) { setLeaves(l.leaves, 0); l.call.material = st.call ? elMats.callOn : elMats.callOff; } });
      const L = st.at === null ? null : st.at === 0 ? lobbies[tw.T.id].doors : st.at === sel.andar ? (tw.corr && tw.corr.lift) : (tw.corrN && tw.corrN.andar === st.at ? tw.corrN.lift : null);
      if (L) setLeaves(L.leaves, st.door);
      setLeaves(elev.cab.front, st.at > 0 ? st.door : 0); setLeaves(elev.cab.rear, st.at === 0 ? st.door : 0);
      elev.cab.grp.position.y = elev.y = st.y;
      if (st.shown !== EL.shown || st.dir !== EL.dir) { EL.drawDisplay(st.shown, st.dir); EL.shown = st.shown; EL.dir = st.dir; }
      if (st.sel !== EL.sel) { EL.drawPanel(st.sel, sel.andar); EL.sel = st.sel; }
      elev.cabVisible = st.level === 'lift' || st.at === st.floor;
      elev.cab.grp.visible = elev.cabVisible;
      elev.st = st;
      placeCorrLights();
      dirty = true;
    }
    // botão que está na mira: chamada (hall do andar ou do térreo) ou um botão do painel da cabine
    function elevPick(ray) {
      if (!elev) return null;
      const list = [];
      elevLandings().forEach(function (l) { if (l && shownChain(l.call)) list.push(l.call); });
      if (elev.cabVisible) elev.cab.panels.forEach(function (p) { list.push(p); });
      const hit = ray.intersectObjects(list, false)[0];
      if (!hit || hit.distance > 3.2) return null;
      if (hit.object.userData.elev.id === 'call') return { id: 'call', distance: hit.distance };
      const u = hit.uv.x * EL.PW, v = (1 - hit.uv.y) * EL.PH;
      let best = null, bd = 24;
      EL.keys.forEach(function (k) { const d = Math.hypot(k.x - u, k.y - v); if (d < bd) { bd = d; best = k; } });
      return best ? { id: best.id, n: best.n, distance: hit.distance } : { id: 'panel', distance: hit.distance };
    }
    // outro andar (só o corredor, com todas as portas fechadas) para quem desce do elevador ali
    function elevFloor(n) {
      if (!elev || !n || n === sel.andar) return;
      const tw = elev.tw;
      if (tw.corrN && tw.corrN.andar === n) return;
      if (tw.corrN) disposeGroup(tw.corrN.grp);
      tw.corrN = buildCorridor(tw, n, 0, tw.root);
      applyVisibility();
      if (elev.st) elevUpdate(elev.st);
    }
    // luzes do corredor: seguem o visitante (andar do apto, outro andar, hall de entrada, cabine)
    const GL_COL = corrLights[0].color.clone(), glCam = new THREE.Vector3(0, 1.6, 0);
    function placeCorrLights() {
      const walking = !!(apt && sel && (apt.view === 'walk' || apt.view === 'free'));
      corrLights.forEach(function (l) { l.visible = walking; l.intensity = 0; l.distance = 10; l.color.copy(GL_COL); });
      if (!walking) return;
      if ((apt.level || 'apt') === 'ground') { groundLights(performance.now()); return; }
      const T = towers[sel.torre].T, lvl = apt.level || 'apt';
      const put = function (i, x, y, z, k) { corrLights[i].position.set(T.x + x, y, T.z + z); corrLights[i].intensity = k; };
      const cx = function (x) { return Math.max(-HL + 1, Math.min(HL - 1, x)); };
      if (lvl === 'apt' || lvl === 'floor') {
        const y = (lvl === 'apt' ? sel.andar : apt.floor) * FH + 0.28 + CEIL - 0.3;
        if (lvl === 'apt' && apt.door) {
          const dx = apt.door.x > 0 ? -1 : 1;
          [apt.door.x + dx * 1.2, apt.door.x - dx * 2.6].forEach(function (x, i) { const xc = cx(x); put(i, xc, y, dzAt(Math.abs(xc) < 1.8 ? apt.door.x : xc), 1.1); });
        } else { put(0, -5, y, 0, 1.0); put(1, 5, y, WING_DZ, 1.0); }
        put(2, 0, y, WING_DZ / 2 + 1.2, 0.9);
      }
      if (elev && elev.cabVisible) put(2, LIFT.x, elev.y + 2.26, (LIFT.in0 + LIFT.in1) / 2, lvl === 'lift' ? 0.42 : 0.38);
    }
    // no térreo as três luzes vão para o que está aceso mais perto do visitante: hall de entrada, cabine, salão, churrasqueiras
    function groundLights(now) {
      const T = towers[sel.torre].T, cand = [{ x: T.x, y: 2.45, z: T.z + (LIFT.rear + ENTRY_Z) / 2, k: 0.9, d: 10 }];
      if (elev && elev.cabVisible) cand.push({ x: T.x + LIFT.x, y: elev.y + 2.26, z: T.z + (LIFT.in0 + LIFT.in1) / 2, k: 0.38, d: 10 });
      LIGHT_SRC.forEach(function (f) { const q = f(now); if (q) cand.push(q); });
      cand.forEach(function (q) { q.dist = Math.hypot(q.x - glCam.x, q.z - glCam.z); });
      cand.sort(function (a, b) { return a.dist - b.dist; });
      corrLights.forEach(function (l, i) {
        const q = cand[i];
        if (!q || q.dist > 32) { l.intensity = 0; return; }
        l.position.set(q.x, q.y, q.z); l.intensity = q.k; l.distance = q.d; l.color.copy(q.col || GL_COL);
      });
    }
    // porta de vidro do hall de entrada: abre sozinha quando o visitante chega perto (só na torre visitada)
    let lastWorld = 0;
    function stepWorld(cam) {
      const now = performance.now(), dt = Math.min(0.05, (now - lastWorld) / 1000 || 0); lastWorld = now;
      let busy = false;
      if (apt && sel && apt.level === 'ground') {
        const L = lobbies[sel.torre], T = towers[sel.torre].T, dx = cam.position.x - T.x, dz = cam.position.z - (T.z + ENTRY_Z);
        const want = Math.abs(dx) < 1.7 && dz > -2.4 && dz < 2.6 ? 1 : 0;
        if (Math.abs(want - L.k) > 0.001) {
          L.k += Math.sign(want - L.k) * Math.min(Math.abs(want - L.k), dt * 1.9);
          const e = L.k * L.k * (3 - 2 * L.k); L.slide[0].position.x = -0.8 * e; L.slide[1].position.x = 0.8 * e; busy = true;
        }
        // ondinhas da piscina quando ela está por perto
        if (Math.hypot(cam.position.x - 90, cam.position.z + 20) < 45) { S_.water.normalMap.offset.set(now * 0.000011, now * 0.000007); busy = true; }
        // salão, churrasqueiras, brinquedos, guarda-sóis, portões, água das torneiras: o que estiver se mexendo
        glCam.copy(cam.position);
        if (stepProps(dt, now, cam)) busy = true;
        if (busy || now < propBusy || LIGHT_SRC.length) groundLights(now);
        if (now < propBusy) busy = true;
      }
      // sombra mais nítida para quem anda no térreo: o recorte do sol acompanha o visitante (passos de 8 m)
      const tight = !!(apt && apt.level === 'ground' && apt.view === 'walk');
      const gx = tight ? Math.round(cam.position.x / 8) * 8 : null, gz = tight ? Math.round(cam.position.z / 8) * 8 : null;
      if (gx !== SHADOW.x || gz !== SHADOW.z) {
        SHADOW.x = gx; SHADOW.z = gz;
        if (tight) { sun.target.position.set(gx, 0, gz); sun.position.set(gx + 70, 120, gz + 77); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 }); sun.shadow.normalBias = 0.04; }
        else { sun.position.fromArray(SUN_FULL.pos); sun.target.position.fromArray(SUN_FULL.tgt); Object.assign(sun.shadow.camera, { left: -SUN_FULL.lr, right: SUN_FULL.lr, top: SUN_FULL.tb, bottom: -SUN_FULL.tb }); sun.shadow.normalBias = 0.06; }
        sun.shadow.camera.updateProjectionMatrix(); sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
        shadowDirty = true;
      }
      return busy;
    }
    const SHADOW = { x: null, z: null };
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
    function buildCorridor(tw, andar, own, parent) {
      const y0 = andar * FH + 0.28, hgt = FLOOR_UP - 0.28 + CEIL, T = 0.12;
      const grp = new THREE.Group(); grp.visible = false; parent.add(grp);
      const ceilG = new THREE.Group(); ceilG.visible = false; grp.add(ceilG);
      const solids = [];                     // retângulos de colisão (na torre)
      const rodape = [];                     // rodapés (instanciados no fim)
      // a parede desenhada encosta na vizinha sem sobrepor (faces no mesmo plano tremiam); só a colisão avança 12 mm
      const box = function (mat, r, h0, h1, parent, solid, shadow) {
        const v = solid !== false ? [r[0] - 0.001, r[1], r[2] + 0.001, r[3]] : r;
        const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.005, v[2] - v[0]), h1 - h0, Math.max(0.005, v[3] - v[1])), mat);
        m.position.set((v[0] + v[2]) / 2, y0 + (h0 + h1) / 2, (v[1] + v[3]) / 2);
        m.castShadow = shadow !== undefined ? shadow : solid !== false; m.receiveShadow = true;
        (parent || grp).add(m);
        if (solid !== false) solids.push([r[0] - 0.012, r[1], r[2] + 0.012, r[3]]);
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
        // porta de entrada deste vizinho: vão [A, B] na parede da linha do corredor (a parede é cortada e a porta fica dentro do vão)
        const w = pos === own ? null : cp.P.walls.find(function (q) { return (q.open || []).some(function (o) { return o.door === 'entrada'; }); });
        const o = w ? w.open.find(function (q) { return q.door === 'entrada'; }) : null;
        const zd = o ? cp.Z(Math.max(w.r[1], w.r[3])) : 0, A = o ? cp.X(o.a) : 0, B = o ? cp.X(o.b) : 0;
        const jogs = [];                                                // laterais dos halls que avançam (as guarnições não podem entrar nelas)
        segs.forEach(function (sg, i) {
          const zf = cp.Z(sg[2]), x0 = cp.X(sg[0]), x1 = cp.X(sg[1]);
          if (o && Math.abs(zf - zd) < 0.02 && A > x0 - 0.01 && B < x1 + 0.01) {
            box(corrMats.wall, toTower(cp.pl, x0, zf - T, A, zf), 0, hgt);
            box(corrMats.wall, toTower(cp.pl, B, zf - T, x1, zf), 0, hgt);
            box(corrMats.wall, toTower(cp.pl, A, zf - T, B, zf), 2.13, hgt, grp, false, true);
            const r = toTower(cp.pl, A - 0.012, zf - T, B + 0.012, zf - 0.03); r.noSkirt = true; solids.push(r);    // a porta fechada também bloqueia
          } else box(corrMats.wall, toTower(cp.pl, x0, zf - T, x1, zf), 0, hgt);
          const nx = segs[i + 1];
          if (pos !== own && nx && Math.abs(nx[2] - sg[2]) > 1) {       // degrau entre dois trechos (lateral do hall)
            const zn = cp.Z(nx[2]), xj = cp.X(nx[0]);
            box(corrMats.wall, toTower(cp.pl, xj - T / 2, Math.min(zf, zn) - T, xj + T / 2, Math.max(zf, zn)), 0, hgt);
            jogs.push(xj);
          }
        });
        if (!o) continue;
        const zf = zd, mid = (A + B) / 2, hingeA = cp.P.doors.entrada.hinge === 'a';
        // guarnição branca em volta do vão (cortada se encosta na lateral de um hall), batente forrando o vão, folha de madeira recuada
        let ta = A - 0.065, tb = B + 0.065;
        jogs.forEach(function (xj) { if (xj <= A && xj + T / 2 > ta) ta = Math.min(A - 0.012, xj + T / 2 + 0.002); if (xj >= B && xj - T / 2 < tb) tb = Math.max(B + 0.012, xj - T / 2 - 0.002); });
        box(corrMats.trim, toTower(cp.pl, ta, zf, A + 0.008, zf + 0.016), 0, 2.2, grp, false, false);
        box(corrMats.trim, toTower(cp.pl, B - 0.008, zf, tb, zf + 0.016), 0, 2.2, grp, false, false);
        box(corrMats.trim, toTower(cp.pl, ta, zf, tb, zf + 0.016), 2.13, 2.2, grp, false, false);
        box(corrMats.trim, toTower(cp.pl, A, zf - T, A + 0.03, zf), 0, 2.13, grp, false, false);
        box(corrMats.trim, toTower(cp.pl, B - 0.03, zf - T, B, zf), 0, 2.13, grp, false, false);
        box(corrMats.trim, toTower(cp.pl, A, zf - T, B, zf), 2.1, 2.13, grp, false, false);
        box(corrMats.door, toTower(cp.pl, A + 0.03, zf - 0.075, B - 0.03, zf - 0.035), 0.006, 2.1, grp, false, false).userData.porta = andar * 100 + pos;
        box(corrMats.dark, toTower(cp.pl, A + 0.03, zf - 0.075, B - 0.03, zf - 0.035), 0, 0.006, grp, false, false);
        // maçaneta de alavanca com roseta, olho mágico e o número do apto em cima
        const zl = zf - 0.035, hx = hingeA ? B - 0.12 : A + 0.12, hs = hingeA ? -1 : 1;
        box(corrMats.handle, toTower(cp.pl, hx - 0.028, zl, hx + 0.028, zl + 0.012), 0.95, 1.09, grp, false, false);
        box(corrMats.handle, toTower(cp.pl, hx - 0.01, zl + 0.012, hx + 0.01, zl + 0.05), 1.01, 1.03, grp, false, false);
        box(corrMats.handle, toTower(cp.pl, Math.min(hx, hx + hs * 0.13), zl + 0.05, Math.max(hx, hx + hs * 0.13), zl + 0.07), 1.008, 1.032, grp, false, false);
        box(corrMats.handle, toTower(cp.pl, hx - 0.012, zl, hx + 0.012, zl + 0.008), 0.86, 0.9, grp, false, false);
        box(corrMats.handle, toTower(cp.pl, mid - 0.014, zl, mid + 0.014, zl + 0.01), 1.49, 1.518, grp, false, false);
        box(numberTex(andar * 100 + pos), toTower(cp.pl, mid - 0.11, zf, mid + 0.11, zf + 0.012), 2.27, 2.38, grp, false, false);
        // interruptor de minuteria (luz do corredor) do lado da fechadura
        const sx = cp.X(o.b + 16);
        box(corrMats.white, toTower(cp.pl, sx - 0.04, zf, sx + 0.04, zf + 0.012), 1.16, 1.27, grp, false, false);
        box(corrMats.amber, toTower(cp.pl, sx - 0.006, zf + 0.012, sx + 0.006, zf + 0.016), 1.235, 1.247, grp, false, false);
        // capacho na frente de algumas portas
        if (((pos * 37 + andar * 11) % 5) < 3) box(corrMats.mat, toTower(cp.pl, mid - 0.32, zf + 0.06, mid + 0.32, zf + 0.46), 0.012, 0.024, grp, false, false);
      }
      // ---------- poços de ventilação (com o armário dos medidores) e núcleo ----------
      [[-18.9, -17.4], [17.4, 18.9]].forEach(function (xr) {
        const zc = dzAt(xr[0]);
        [-1, 1].forEach(function (s) {
          box(corrMats.wall, s > 0 ? [xr[0], zc + CORR - 0.012, xr[1], zc + CORR + T] : [xr[0], zc - CORR - T, xr[1], zc - CORR + 0.012], 0, hgt);
          const xc = (xr[0] + xr[1]) / 2, zf = zc + (s > 0 ? CORR - 0.012 : -CORR + 0.012);   // porta veneziana dos medidores de água e gás
          box(corrMats.louver, [xc - 0.4, Math.min(zf, zf - s * 0.025), xc + 0.4, Math.max(zf, zf - s * 0.025)], 0.3, 1.9, grp, false, false);
        });
      });
      // hall do núcleo: liga o corredor da ala oeste (eixo z = 0) ao da ala leste (z = 4); elevadores na frente, escada nos fundos
      // parede dos elevadores (azul-marinho) com os dois vãos; as folhas correm para dentro dela
      [[-1.8, LIFT.x2 - LIFT.half], [LIFT.x2 + LIFT.half, LIFT.x - LIFT.half], [LIFT.x + LIFT.half, 1.8]].forEach(function (s) { box(corrMats.navy, [s[0], ZE - 0.012, s[1], ZE + T], 0, hgt); });
      [LIFT.x2, LIFT.x].forEach(function (x) { box(corrMats.navy, [x - LIFT.half, ZE - 0.012, x + LIFT.half, ZE + T], 2.15, hgt, grp, false); });
      box(corrMats.wall, [-1.8, -CORR - T, 1.8, -CORR + 0.012], 0, hgt);
      if (WING_DZ > 0) {                                                        // laterais do hall quando as alas são desencontradas
        box(corrMats.wall, [-1.8 - T, CORR, -1.8 + 0.012, ZE], 0, hgt);
        box(corrMats.wall, [1.8 - 0.012, -CORR, 1.8 + T, WING_DZ - CORR], 0, hgt);
      }
      // ---------- hall dos elevadores: portas de inox com batente, indicador do andar do elevador, botão de chamada ----------
      const liftDoors = landingDoors(grp, y0, ZE - 0.012, -1, solids);
      box(corrMats.hall, [-1.8, ZE - 1.25, 1.8, ZE - 0.012], 0, 0.014, grp, false, false);       // faixa de porcelanato grafite em frente aos elevadores
      panel(sign('andarInd' + andar, 128, 64, function (g) {                                     // número do andar ao lado das portas
        g.fillStyle = '#22318A'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#E2B444'; g.font = '700 34px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(andar + 'º', 64, 34);
      }), -1.61, ZE - 0.014, 0.24, 1.55, 1.67, '-z');
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
      }), [2.25, WING_DZ + ze, 2.95, WING_DZ + ze + 0.03], 0.75, 1.65, grp, false, false);
      // ---------- pontas do corredor, com a janelinha basculante da fachada lateral ----------
      [-1, 1].forEach(function (s) {
        const xi = s < 0 ? -HL + 0.2 : HL - 0.2, zc = dzAt(s * HL);
        box(corrMats.wall, s < 0 ? [-HL, zc - 1.7, -HL + 0.2, zc + 1.7] : [HL - 0.2, zc - 1.7, HL, zc + 1.7], 0, hgt);
        box(corrMats.frame, [Math.min(xi, xi - s * 0.04), zc - 0.36, Math.max(xi, xi - s * 0.04), zc + 0.36], 1.06, 1.83, grp, false, false);
        panel(corrMats.sky, xi - s * 0.045, zc, 0.6, 1.12, 1.77, s < 0 ? '+x' : '-x');
      });
      // ---------- piso de porcelanato, rodapés, forro com plafons e a luz deles no chão ----------
      const FLOORS_R = [[-HL + 0.2, -1.62, -1.8, 1.62], [-1.8, -CORR, 1.8, ZE], [1.8, WING_DZ - 1.62, HL - 0.2, WING_DZ + 1.62]];
      FLOORS_R.forEach(function (r) {                                // piso com UV em metros: a peça de 60 cm não estica
        const w = r[2] - r[0], d = r[3] - r[1], g = new THREE.PlaneGeometry(w, d), uv = g.attributes.uv, ps = g.attributes.position;
        g.rotateX(-Math.PI / 2); g.translate((r[0] + r[2]) / 2, 0, (r[1] + r[3]) / 2);
        for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / 0.6, -ps.getZ(i) / 0.6);
        const m = new THREE.Mesh(g, corrMats.floor); m.position.y = y0 + 0.012; m.receiveShadow = true; grp.add(m);
      });
      solids.forEach(function (r) {
        if (r.noSkirt) return;
        const lx = r[2] - r[0], lz = r[3] - r[1], cx = (r[0] + r[2]) / 2;
        if (lx >= lz) rodape.push((r[1] + r[3]) / 2 > dzAt(cx) ? [r[0], r[1] - 0.012, r[2], r[1]] : [r[0], r[3], r[2], r[3] + 0.012]);
        else if (Math.abs(cx) > HL - 1 || Math.abs(Math.abs(cx) - 1.8) < 0.2) rodape.push(cx < 0 ? [r[2], r[1], r[2] + 0.012, r[3]] : [r[0] - 0.012, r[1], r[0], r[3]]);
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
      [[-HL + 0.05, -1.62, -1.8, 1.62], [-1.8, -CORR, 1.8, ZE], [1.8, WING_DZ - 1.62, HL - 0.05, WING_DZ + 1.62]].forEach(function (r) {
        box(corrMats.ceil, r, hgt, hgt + 0.08, ceilG, false, true);
      });
      const xs = [[0, 0.1], [0, WING_DZ - 0.1]];
      for (let x = -HL + 1.9; x <= -2.6; x += 3.05) { xs.push([x, 0]); xs.push([-x, WING_DZ]); }
      inst(new THREE.CylinderGeometry(0.17, 0.15, 0.04, 28), corrMats.lamp, xs, function (p) { dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); dm.position.set(p[0], y0 + hgt - 0.02, p[1]); }, ceilG);
      inst(new THREE.PlaneGeometry(2.6, 2.6), corrMats.pool, xs, function (p) { dm.rotation.set(-Math.PI / 2, 0, 0); dm.scale.set(1, 1, 1); dm.position.set(p[0], y0 + 0.016, p[1]); }, ceilG).renderOrder = 3;
      mergeStatic(grp); mergeStatic(ceilG);
      return { grp: grp, ceil: ceilG, solids: solids, y0: y0, lift: liftDoors, andar: andar };
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
        labelEls.push({ el: el, p: new THREE.Vector3(T.x, TOP + CORE_UP + 3, T.z + WING_DZ / 2) });
      });
    }

    function applySelection() {
      TOWERS.forEach(function (T) {
        const tw = towers[T.id], open = sel && sel.torre === T.id ? sel.andar : 0;
        tw.ghost.children.slice().forEach(function (o) { tw.ghost.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        if (open) {
          const h = TOP + CROWN - (open + 1) * FH;
          PARTS.forEach(function (pt) {
            const gm = new THREE.Mesh(new THREE.BoxGeometry(pt.x1 - pt.x0 + 0.2, h, pt.z1 - pt.z0 + 0.2), new THREE.MeshBasicMaterial({ color: lin(colors.navy), transparent: true, opacity: 0.06, depthWrite: false }));
            gm.position.set((pt.x0 + pt.x1) / 2, (open + 1) * FH + h / 2, (pt.z0 + pt.z1) / 2); tw.ghost.add(gm);
            const ge = new THREE.LineSegments(new THREE.EdgesGeometry(gm.geometry), new THREE.LineBasicMaterial({ color: lin(colors.navy), transparent: true, opacity: 0.45 }));
            ge.position.copy(gm.position); tw.ghost.add(ge);
          });
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
      hallInt.visible = !!(apt && (apt.level === 'ground' || apt.view === 'free'));
      TOWERS.forEach(function (T) {
        const tw = towers[T.id], open = sel && sel.torre === T.id ? sel.andar : 0;
        const inApt = !!(apt && open), lvl = inApt ? apt.level : 'apt';
        // fora do andar do apto (térreo, outro andar, dentro do elevador andando) a torre aparece inteira, com o andar do apto fechado
        const ground = inApt && lvl !== 'apt', full = inApt && apt.view === 'walk' && !ground;
        const walking = inApt && (apt.view === 'walk' || apt.view === 'free');
        // andar que fica vazado para quem está dentro dele: o do apto (visita a pé) ou o outro andar onde o elevador parou
        // (fechado, as faces internas das alas tapavam a passagem do hall para os corredores)
        const hideLv = full ? open : walking && lvl === 'floor' ? apt.floor : 0;
        const allIn = (!open || ground) && !hideLv;                 // torre inteira: a malha juntada
        tw.whole.visible = allIn;
        tw.slices.forEach(function (m, lv) {
          const on = allIn || (hideLv ? lv !== hideLv : lv < open);
          m.visible = on && !allIn;
          m.children.forEach(function (c) { c.userData.on = on; });   // o mouse ainda acha o andar na torre inteira
          if (tw.resv[lv]) tw.resv[lv].visible = on;
        });
        tw.top.visible = !open || full || ground;
        tw.balc.forEach(function (im) {
          const ls = im.userData.ls;
          if (!im.userData.all) im.userData.all = im.instanceMatrix.array.slice();
          im.instanceMatrix.array.set(im.userData.all);
          if (hideLv) im.instanceMatrix.array.fill(0, ls[hideLv] * 16, ls[hideLv + 1] * 16);   // a sacada e as janelas do andar vazado
          im.instanceMatrix.needsUpdate = true;
          im.count = open && !full && !ground ? ls[open] : ls[LEVELS];
        });
        tw.ghost.visible = !!open && !inApt;
        if (tw.plate) tw.plate.visible = !ground;
        if (tw.units) tw.units.forEach(function (ug) { ug.visible = !(inApt && ug.userData.unit === apt.pos); });
        if (tw.corr) { tw.corr.grp.visible = walking && !ground; tw.corr.ceil.visible = walking && !ground && apt.ceil; }
        if (tw.shafts) tw.shafts.forEach(function (m) { m.visible = !(walking && !ground); });   // o bloco do núcleo da maquete some quando se anda no corredor (a cabine está ali)
        if (tw.corrN) { const on = walking && lvl === 'floor' && apt.floor === tw.corrN.andar; tw.corrN.grp.visible = on; tw.corrN.ceil.visible = on; }
      });
      placeCorrLights();
      shadowDirty = true; dirty = true;
    }

    function refreshUnitLook() {
      if (!sel || apt) return;
      towers[sel.torre].units.forEach(function (ug) {
        const on = ug.userData.unit === selUnit, hv = ug.userData.unit === hoverUnit;
        ug.position.y = ug.userData.baseY + (on ? 0.7 : hv ? 0.32 : 0);
        ug.userData.base.scale.y = on ? 2.2 : 1;
      });
      shadowDirty = true;
      labelEls.forEach(function (l, i) { l.el.classList.toggle('is-on', !!sel && (i + 1) === selUnit); });
      dirty = true;
    }

    /* ---------------- câmera ---------------- */
    const HOME = { target: new THREE.Vector3(8, 8, 15), r: 222, phi: 0.98, theta: 0.42 };
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
      const T = towers[torre].T, tgt = new THREE.Vector3(T.x, andar * FH + 0.8, T.z + WING_DZ / 2);
      flyTo(tgt, spherical(tgt, fitR(70), 0.55, currentTheta()), ms);
    }

    /* ---------------- tema: dia (claro) e noite (escuro) ---------------- */
    let night = false;
    function setNight(on) {
      night = !!on;
      scene.background = night ? SKY.night.tex : SKY.day.tex;
      scene.fog.color.copy(lin(night ? SKY.night.fog : SKY.day.fog));
      scene.environment = night ? ENV.night : ENV.day;
      hemi.intensity = night ? 0.12 : (ENV.day ? 0.36 : 0.72);
      hemi.color.setHex(night ? 0x7C8CC4 : 0xE4EEF8);
      sun.intensity = night ? 0.22 : 1.28;
      M.winGlass.opacity = night ? 0.16 : 0.4;
      S_.water.emissiveIntensity = night ? 0.9 : 0.12; S_.poolLight.emissiveIntensity = night ? 2.4 : 0;
      sun.color.setHex(night ? 0x9FB2FF : 0xFFF2DE);
      amb.intensity = night ? 0.22 : 0;
      facadeMats.forEach(function (m) { m.emissiveIntensity = night ? 1.35 : 0.62; });
      M.gold.emissiveIntensity = night ? 0.55 : 0;
      miniMats.on.emissiveIntensity = night ? 0.32 : 0.12;
      corrMats.sky.color.copy(lin(night ? 0x1B2A52 : 0xDCE9F4));
      if (sel) applySelection();
      lamps.forEach(function (l) { l.intensity = night ? 1.6 : 0; l.visible = night; });
      lampHeads.emissiveIntensity = night ? 2.2 : 0; S_.yellow.emissiveIntensity = night ? 0.35 : 0;
      NIGHT_HOOKS.forEach(function (f) { f(night); });
      renderer.toneMappingExposure = night ? 1.12 : 0.96;
      dirty = true;
    }

    /* ---------------- interação ---------------- */
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let hoverFloor = null, down = null, interacted = false;
    function pick(cx, cy) {
      const r = cv.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickables, false).filter(function (h) { return h.object.userData.unit ? h.object.visible : h.object.userData.on !== false; })[0];
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
    let visible = true, raf = 0, paused = false, lastBlink = 0;
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
      let blink = false;                                    // os reservados piscam: redesenha a ~25 quadros/s, sem refazer a sombra
      if (anyReserved && now - lastBlink > 40) { blink = true; lastBlink = now; }
      if (!dirty && !moving && !blink) { perf.last = 0; return; }
      dirty = false;
      if (moving || tween) perfTick(now); else perf.last = 0;      // só mede quadros seguidos de câmera andando (o pisca é de propósito lento)
      setPulse(now);
      renderer.autoClear = true;
      renderer.toneMappingExposure = night ? 1.12 : 0.96;
      // a sombra do sol só é refeita quando a cena muda (andar aberto, apto destacado), nunca só porque a câmera girou
      renderer.shadowMap.needsUpdate = shadowDirty; shadowDirty = false;
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

    if (window.__DEBUG) window.__predio = { camera: camera, controls: controls, scene: scene, renderer: renderer, redraw: function () { dirty = true; }, GROUND_SOLIDS: GROUND_SOLIDS, PROPS: PROPS, props: propApi, propHits: propHits };
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
        hlMat.color.copy(lin(colors.gold)); hlEdgeMat.color.copy(lin(colors.gold));
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
          walk: [[-HL + 0.2, -1.62, -1.55, 1.62], [-2.05, -CORR, 2.05, WING_DZ + CORR], [1.55, WING_DZ - 1.62, HL - 0.2, WING_DZ + 1.62]]
            .map(function (r) { return [r[0] + T.x, r[1] + T.z, r[2] + T.x, r[3] + T.z]; }),
          camera: { pos: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov }
        };
        if (apt.door) {                                            // vista do corredor: no corredor, olhando de lado para a porta do apto
          const zw = dzAt(apt.door.x), dx = apt.door.x > 0 ? -1 : 1, sg = apt.door.z > zw ? 1 : -1, eye = sel.andar * FH + 0.28 + 1.6;
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
            return [zw, zw - sg * 0.3].some(function (zc) { const x = apt.door.x + dx * d; if (Math.abs(x) < HL - 0.5 && (Math.abs(x) > 1.9 || Math.abs(apt.door.x) < 1.9) && livre(x, zc)) { at = [x, zc]; return true; } return false; });
          });
          let to = [T.x + apt.door.x, eye - 0.35, T.z + apt.door.z];
          if (!at) {                                               // porta no fundo do corredor (apto de canto): na frente dela, olhando o corredor
            at = [apt.door.x, apt.door.z - sg * 0.95];
            to = [T.x + apt.door.x + dx * 8, eye - 0.15, T.z + zw];
          }
          out.corridor = { name: 'Corredor do ' + sel.andar + 'º andar', at: [T.x + at[0], eye, T.z + at[1]], to: to };
        }
        // térreo do condomínio: colisão (torres, muro, piscina, prédios, carros...), áreas com nome; a porta de vidro da outra torre fica fechada
        const zf = T.z + ENTRY_Z, W = function (r) { return [r[0] + T.x, r[1] + T.z, r[2] + T.x, r[3] + T.z]; };
        out.ground = {
          name: 'Térreo do condomínio',
          walls: GROUND_SOLIDS.concat(TOWERS.filter(function (t) { return t.id !== T.id; }).map(function (t) { return DOOR_SOLIDS[t.id]; })),
          walk: [[LOT.x0 + 0.35, LOT.z0 + 0.35, LOT.x1 - 0.35, LOT.z1 - 0.2]],
          zones: [{ id: 'hall', name: 'Hall de entrada da Torre ' + T.id, r: W([-1.68, LIFT.rear - 0.2, 1.68, ENTRY_Z + 0.05]) }]
            .concat(TOWERS.map(function (t) { const f = t.z + ENTRY_Z; return { id: 'entrada' + t.id, name: 'Entrada da Torre ' + t.id, r: [t.x - 7.5, f - 0.5, t.x + 7.5, 15.5] }; }))
            .concat(ZONES).concat([{ id: 'passeio', name: 'Passeio na frente das torres', r: [LOT.x0, 7, LOT.x1, 15.5] }]),
          spawn: { at: [T.x, 1.6, zf + 1.6], to: [T.x, 1.3, zf + 16] },
          // atalhos para as áreas de lazer (lista do painel) e o que se usa nelas
          spots: [
            { id: 'salao', name: 'Salão de festas', at: [55.6, 1.6, -18.5], to: [62, 1.4, -20] },
            { id: 'piscina', name: 'Piscina', at: [78.6, 1.6, -10.6], to: [90, 1.0, -20] },
            { id: 'pracinha', name: 'Pracinha', at: [66.5, 1.6, 13.4], to: [66.5, 1.2, 2] },
            { id: 'pet', name: 'Espaço pet', at: [86.2, 1.6, 13.4], to: [88, 1.0, 2] },
            { id: 'quiosques', name: 'Quiosques', at: [64.8, 1.6, 24.0], to: [72, 1.3, 24] },
            { id: 'portaria', name: 'Portaria', at: [-29.5, 1.6, 52.0], to: [-29.5, 1.5, 62] }
          ],
          props: propApi
        };
        // elevador: cabine, paredes, portas (frente nos andares, trás no térreo), onde se chama, corredor dos outros andares
        elevSetup(tw);
        const other = buildCorridor(tw, sel.andar, 0, new THREE.Group());
        const cabR = [LIFT.x - LIFT.w, LIFT.in0, LIFT.x + LIFT.w, LIFT.in1];
        out.elevator = {
          aptFloor: sel.andar, floors: FLOORS, tower: T.id,
          stopY: Array.from({ length: FLOORS + 1 }, function (_, i) { return stopY(i); }),
          cab: W(cabR),
          walls: [[LIFT.x - LIFT.w - 0.04, ZE + 0.12, LIFT.x - LIFT.w, LIFT.in1 + 0.04], [LIFT.x + LIFT.w, ZE + 0.12, LIFT.x + LIFT.w + 0.04, LIFT.in1 + 0.04],
            [LIFT.x - LIFT.w, LIFT.in0 - 0.04, LIFT.x - LIFT.half, LIFT.in0], [LIFT.x + LIFT.half, LIFT.in0 - 0.04, LIFT.x + LIFT.w, LIFT.in0],
            [LIFT.x - LIFT.w, LIFT.in1, LIFT.x - LIFT.half, LIFT.in1 + 0.04], [LIFT.x + LIFT.half, LIFT.in1, LIFT.x + LIFT.w, LIFT.in1 + 0.04]].map(W),
          front: W([LIFT.x - LIFT.half - 0.02, ZE - 0.03, LIFT.x + LIFT.half + 0.02, LIFT.in0 + 0.02]),
          rear: W([LIFT.x - LIFT.half - 0.02, LIFT.in1 - 0.02, LIFT.x + LIFT.half + 0.02, LIFT.rear + 0.02]),
          hall: W([-1.8, ZE - 1.9, 1.8, ZE + 0.1]),
          lobby: W([-1.68, LIFT.rear - 0.1, 1.68, ENTRY_Z]),
          doorFront: W([LIFT.x - 0.55, ZE - 0.4, LIFT.x + 0.55, LIFT.in0 + 0.35]),
          doorRear: W([LIFT.x - 0.55, LIFT.in1 - 0.35, LIFT.x + 0.55, LIFT.rear + 0.4]),
          floorWalls: other.solids.map(W),
          // onde se chega a pé: o hall dos andares (de frente para as portas) e o hall de entrada no térreo
          hallSpot: { at: [T.x + LIFT.x - 0.2, 0, T.z + ZE - 1.25], to: [T.x + LIFT.x, 0, T.z + ZE + 2] },
          update: elevUpdate, pick: elevPick, prepare: elevFloor,
          name: function (n) { return n === 0 ? 'Térreo' : n + 'º andar'; }
        };
        disposeGroup(other.grp);
        out.reservado = statusOf(T.id, sel.andar, pos) === 'reservado';
        return out;
      },
      // vista atual da maquete: 3d, top, walk ou free; ceil = forro da maquete visível (o do corredor acompanha)
      setAptView: function (view, ceil, level, floor) {
        if (!apt) return;
        const lv = level || 'apt', fl = floor || 0;
        if (apt.view === view && apt.ceil === !!ceil && apt.level === lv && apt.floor === fl) return;
        apt.view = view; apt.ceil = !!ceil; apt.level = lv; apt.floor = fl;
        applyVisibility();
      },
      // desenha o prédio com a câmera da maquete (a maquete desenha o apto por cima, no mesmo quadro);
      // devolve true quando algo do mundo ainda está se mexendo (porta de vidro, água) e precisa de outro quadro
      renderWith: function (cam, moving) {
        const now = performance.now();
        if (moving) perfTick(now); else perf.last = 0;
        const busy = stepWorld(cam);
        setPulse(now);
        renderer.autoClear = true;
        renderer.toneMappingExposure = night ? 1.12 : 0.96;
        renderer.shadowMap.needsUpdate = shadowDirty; shadowDirty = false;
        renderer.render(scene, cam);
        return busy;
      },
      // sai da visita: a câmera do prédio começa onde a da maquete estava e volta voando para o andar
      exitUnit: function (cam) {
        if (!apt) return;
        apt = null;
        elevTeardown();
        resetProps(); placeCorrLights();
        stepWorld(camera);
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

  window.Predio3D = { create: create, unitRect: unitRect, unitPlace: unitPlace, planCanvas: planCanvas, planPose: planPose, BAYS: BAYS, FH: FH, L: L, D: D, HD: HD, CORR: CORR,
    PARTS: PARTS, SHAFTS: SHAFTS, WING_DZ: WING_DZ, Z_MIN: Z_MIN, Z_MAX: Z_MAX };
})();
