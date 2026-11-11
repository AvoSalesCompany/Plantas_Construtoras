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

  // cada torre tem duas alas desencontradas ligadas pelo núcleo (elevadores e escada), como nas fotomontagens da Baliza:
  // a ala leste (aptos 4–9) avança 4 m para a frente; o núcleo fica no meio do caminho entre as duas
  const WING_DZ = 4;
  const PARTS = [
    { id: 'W', x0: -HL, x1: -1.8, z0: -HD, z1: HD },
    { id: 'C', x0: -1.8, x1: 1.8, z0: -HD + WING_DZ / 2, z1: HD + WING_DZ / 2 },
    { id: 'E', x0: 1.8, x1: HL, z0: -HD + WING_DZ, z1: HD + WING_DZ }
  ];
  function dzAt(x) { return x > 1.8 - 1e-6 ? WING_DZ : x < -1.8 + 1e-6 ? 0 : WING_DZ / 2; }   // eixo do corredor em cada ala
  function partAt(x) { return x < -1.8 ? PARTS[0] : x > 1.8 ? PARTS[2] : PARTS[1]; }
  const Z_MIN = -HD, Z_MAX = HD + WING_DZ;
  // poços (núcleo e ventilação) no sistema da torre, para a laje do andar aberto e a planta do painel
  const SHAFTS = [
    [-1.8, WING_DZ + CORR, 1.8, WING_DZ / 2 + HD - 0.5, 'elev'], [-1.8, -HD + WING_DZ / 2 + 0.5, 1.8, -CORR, 'escada'],
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

  // as duas torres ficam lado a lado ao longo do muro do fundo do terreno, de frente para o estacionamento e o lazer
  // (imagem de satélite e fotomontagens: quase alinhadas, a B 1,5 m mais à frente)
  const TOWERS = [
    { id: 'A', x: -29.5, z: 0 },
    { id: 'B', x: 29.5, z: 1.5 }
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

  /* ---------------- terreno do condomínio ----------------
     Montado a partir da imagem de satélite (obra na Rua Marieta Fialho Blessmann, Feitoria) e das fotomontagens da Baliza:
     as duas torres lado a lado junto ao muro do fundo (casas da Rua Gastão atrás), estacionamento descoberto e rua interna
     na frente, portaria com o pilar MILÃO de frente para a Torre A, piscina e salão de festas na ponta leste, quiosques,
     pracinha, espaço pet, reservatórios azuis na ponta oeste e mata nativa nos fundos do lote ao sul e a leste.
     Metros; x para leste, z para o sul (a frente das torres). */
  const LOT = { x0: -85, x1: 66, z0: -14, z1: 62 };
  const ROAD = { x0: -80, x1: 61, z0: 21, z1: 27 };               // rua interna, entre as duas fileiras de vagas
  const PARK = [[-80, 15.5, 61, 21], [-80, 27, 61, 32.5]];       // vagas de 2,5 m x 5 m (90°)
  const ACCESS = { x0: -33, x1: -26, z0: 27, z1: 62 };           // acesso de carros: do portão (de frente para a Torre A) até a rua interna
  const GATE = { x0: -33, x1: -26, z: 62 };
  const PLAY = [-22, 37, -5, 52], KIOSK = [0, 37, 20, 52], PET = [-80, 38, -58, 55], RES = [-81, -9, -66, 7];
  const POOLA = { fence: [24, 35.5, 48.5, 58.5], adult: [27, 41, 39.5, 47], kids: [42, 42, 46, 45.6] };
  const HALL = [50, 37, 63, 51];                                  // salão de festas, com a frente de vidro para a piscina
  const GUARD = [-40.5, 54.5, -35, 60];                            // guarita
  const TRASH = [-52, 57, -46, 61];                                // abrigo de lixo
  // áreas com nome (para o visitante saber onde está quando desce do elevador)
  const ZONES = [
    { id: 'piscina', name: 'Piscina', r: POOLA.fence },
    { id: 'salao', name: 'Salão de festas', r: HALL },
    { id: 'quiosques', name: 'Quiosques com churrasqueira', r: KIOSK },
    { id: 'pracinha', name: 'Pracinha', r: PLAY },
    { id: 'pet', name: 'Espaço pet', r: PET },
    { id: 'portaria', name: 'Portaria', r: [-46, 50, -20, 62] },
    { id: 'reservatorios', name: 'Reservatórios', r: RES },
    { id: 'estacionamento', name: 'Estacionamento', r: [-80, 15.5, 61, 32.5] },
    { id: 'acesso', name: 'Acesso de carros', r: [ACCESS.x0, ACCESS.z0, ACCESS.x1, ACCESS.z1] }
  ];
  const SITE = { x0: -112, x1: 92, z0: -52, z1: 98 };            // chão desenhado (o lote e a vizinhança em volta)
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
    rect(SURF.asphalt, SITE.x0, -45, SITE.x1, -38);                 // Rua Gastão (atrás das casas do fundo)
    rect(SURF.asphalt, -101, SITE.z0, -94, SITE.z1);                 // Rua Gustavo Veter
    rect(SURF.asphalt, SITE.x0, 78, -24, 85);                        // Rua Marieta Fialho Blessmann
    rect(SURF.asphalt, ACCESS.x0, LOT.z1, ACCESS.x1, 85);            // chegada ao portão
    g.strokeStyle = 'rgba(240,232,200,.8)'; g.lineWidth = 2; g.setLineDash([3 * SITE_PX, 3 * SITE_PX]);
    [[SITE.x0, -41.5, SITE.x1, -41.5], [-97.5, SITE.z0, -97.5, SITE.z1], [SITE.x0, 81.5, -24, 81.5]].forEach(function (l) { g.beginPath(); g.moveTo(X(l[0]), Z(l[1])); g.lineTo(X(l[2]), Z(l[3])); g.stroke(); });
    g.setLineDash([]);
    rect(SURF.walk, SITE.x0, -38, SITE.x1, -36.5); rect(SURF.walk, SITE.x0, 76.5, -33, 78); rect(SURF.walk, -94, SITE.z0, -92.5, SITE.z1);
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
      rect(SURF.walk, t.x - HL - 1.2, t.z - HD - 1.2, t.x - 1.8, t.z + HD + 1.2);
      rect(SURF.walk, t.x - 1.8, t.z - HD + 2 - 1.2, t.x + 1.8, t.z + HD + 2 + 1.2);
      rect(SURF.walk, t.x + 1.8, t.z - HD + WING_DZ - 1.2, t.x + HL + 1.2, t.z + HD + WING_DZ + 1.2);
      rect(SURF.paving, t.x - 3.2, t.z + HD + 2, t.x + 3.2, 15.5);      // chegada à entrada da torre
    });
    // rua interna, acesso e vagas (faixas amarelas)
    rect(SURF.asphalt, ROAD.x0, ROAD.z0, ROAD.x1, ROAD.z1);
    rect(SURF.asphalt, ACCESS.x0, ACCESS.z0, ACCESS.x1, ACCESS.z1);
    PARK.forEach(function (p) { rect(SURF.asphalt2, p[0], p[1], p[2], p[3]); });
    speckle(ROAD.x0, 15.5, ROAD.x1, 32.5, 9000, 'rgba(0,0,0,.12)', 'rgba(255,255,255,.06)');
    g.strokeStyle = '#E3B53A'; g.lineWidth = 2;
    PARK.forEach(function (p, i) {
      for (let x = p[0]; x <= p[2] + 0.01; x += 2.5) {
        if (Math.abs(x - ACCESS.x0 - 3.5) < 4.5 && i === 1) continue;
        if (TOWERS.some(function (t) { return Math.abs(x - t.x) < 3.4; }) && i === 0) continue;
        g.beginPath(); g.moveTo(X(x), Z(i ? p[1] : p[1] + 0.6)); g.lineTo(X(x), Z(i ? p[3] - 0.6 : p[3])); g.stroke();
      }
    });
    // faixas de pedestre em frente às entradas das torres e na pracinha
    [TOWERS[0].x, TOWERS[1].x, -12, 36].forEach(function (x) {
      for (let k = -2.4; k <= 2.4; k += 0.8) rect('rgba(245,245,240,.9)', x + k - 0.25, 15.6, x + k + 0.25, 32.4);
    });
    // rampas sem vaga na frente das entradas (calçada continua)
    TOWERS.forEach(function (t) { rect(SURF.paving, t.x - 3.2, 15.5, t.x + 3.2, 21); });
    rect(SURF.asphalt, ACCESS.x0, 27, ACCESS.x1, 32.5);
    // passeio de tijolinho do lado sul do estacionamento e caminhos do lazer
    rect(SURF.brick, -80, 32.5, 61, 35);
    rect(SURF.walk, ACCESS.x1, 35, ACCESS.x1 + 1.6, 62);              // calçada do acesso, do portão para dentro
    rect(SURF.walk, ACCESS.x0 - 1.6, 35, ACCESS.x0, 62);
    rect(SURF.walk, -5, 35, 0, 52); rect(SURF.walk, 20, 35, 24, 54); rect(SURF.walk, -58, 35, -54, 46);
    // pracinha: piso emborrachado
    rect(SURF.rubber, PLAY[0], PLAY[1], PLAY[2], PLAY[3]);
    rect(SURF.rubber2, PLAY[0] + 2, PLAY[1] + 2, PLAY[0] + 8, PLAY[1] + 8);
    rect(SURF.sand, PLAY[2] - 7, PLAY[3] - 7, PLAY[2] - 1, PLAY[3] - 1);
    // quiosques: piso de pedra; piscina: deque; espaço pet: grama com areia; reservatórios: concreto
    rect(SURF.paving, KIOSK[0], KIOSK[1], KIOSK[2], KIOSK[3]);
    rect(SURF.deck, POOLA.fence[0], POOLA.fence[1], POOLA.fence[2], POOLA.fence[3]);
    for (let z = POOLA.fence[1]; z < POOLA.fence[3]; z += 0.6) { g.fillStyle = 'rgba(120,100,70,.12)'; g.fillRect(X(POOLA.fence[0]), Z(z), (POOLA.fence[2] - POOLA.fence[0]) * SITE_PX, 1); }
    rect(SURF.paving, HALL[0] - 1.5, HALL[1] - 1.5, HALL[2] + 1, HALL[3] + 1.5);
    rect(SURF.lawn2, PET[0], PET[1], PET[2], PET[3]);
    rect(SURF.sand, PET[0] + 2, PET[1] + 2, PET[0] + 9, PET[1] + 8);
    rect(SURF.gravel, RES[0], RES[1], RES[2], RES[3]);
    rect(SURF.paving, GUARD[0] - 1.5, GUARD[1] - 1.5, GUARD[2] + 1.5, LOT.z1);
    rect(SURF.paving, TRASH[0] - 0.5, TRASH[1] - 0.5, TRASH[2] + 0.5, LOT.z1);
    // muro do condomínio
    g.strokeStyle = 'rgba(40,44,52,.7)'; g.lineWidth = 3; g.strokeRect(X(LOT.x0), Z(LOT.z0), (LOT.x1 - LOT.x0) * SITE_PX, (LOT.z1 - LOT.z0) * SITE_PX);
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
    sun.position.set(62, 120, 95); sun.target.position.set(-8, 0, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -105, right: 105, top: 92, bottom: -92, near: 10, far: 380 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    const amb = new THREE.AmbientLight(0x8090C0, 0); scene.add(amb);
    const lamps = [];
    [[TOWERS[0].x, 14], [TOWERS[1].x, 15], [-29.5, 57], [36, 46], [10, 45], [-13, 45], [-69, 46], [0, 24]].forEach(function (p) {
      const l = new THREE.PointLight(0xFFC98A, 0, 24, 2); l.position.set(p[0], 4.2, p[1]); scene.add(l); lamps.push(l);
    });

    /* chão: vizinhança, ruas e o lote desenhados numa textura só */
    // o chão distante fica meio metro abaixo do lote: rente a ele, triângulos enormes brigam com o lote quando se anda no térreo
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 8, 8), std({ color: 0x6F8A57 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; ground.receiveShadow = true; scene.add(ground);
    const siteW = SITE.x1 - SITE.x0, siteD = SITE.z1 - SITE.z0;
    const site = new THREE.Mesh(new THREE.PlaneGeometry(siteW, siteD, 34, 25), std({ map: tex(siteCanvas()), roughness: 0.95 }));
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
      const slices = [];
      for (let lv = 0; lv < LEVELS; lv++) {
        const sg = new THREE.Group(); sg.position.y = lv * FH + FH / 2; root.add(sg);
        PARTS.forEach(function (pt, pi) {
          const m = new THREE.Mesh(SLICE_GEOS[pi][lv], partMats[pi]);
          m.castShadow = true; m.receiveShadow = true;
          m.userData = { torre: T.id, andar: lv };
          sg.add(m);
          if (lv > 0) pickables.push(m);
        });
        const rg = reservedGeo(T.id, lv);
        if (rg) { const rm = new THREE.Mesh(rg, resMat); rm.renderOrder = 2; sg.add(rm); anyReserved = true; }
        slices.push(sg);
      }
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
      [balcSlab, balcGlass, balcRail].forEach(function (im) { im.instanceMatrix.needsUpdate = true; im.castShadow = im !== balcGlass; root.add(im); });
      // destaque do andar sob o mouse
      const hl = new THREE.Group(); hl.visible = false; root.add(hl);
      PARTS.forEach(function (pt) {
        const hb = new THREE.Mesh(new THREE.BoxGeometry(pt.x1 - pt.x0 + 0.7, FH - 0.06, pt.z1 - pt.z0 + 0.7), hlMat);
        hb.position.set((pt.x0 + pt.x1) / 2, 0, (pt.z0 + pt.z1) / 2); hl.add(hb);
        const he = new THREE.LineSegments(new THREE.EdgesGeometry(hb.geometry), hlEdgeMat); he.position.copy(hb.position); hl.add(he);
      });
      // volume fantasma dos andares acima do andar aberto
      const ghost = new THREE.Group(); ghost.visible = false; root.add(ghost);
      towers[T.id] = { T: T, root: root, slices: slices, top: top, balc: [balcSlab, balcGlass, balcRail], hl: hl, ghost: ghost, plate: null };
    });

    /* ---------------- condomínio: muro, portaria, entradas das torres, lazer ---------------- */
    const S_ = { };                                              // materiais do térreo
    (function buildSite() {
      const solid = function (x0, z0, x1, z1) { GROUND_SOLIDS.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]); };
      const box = function (mat, w, h, d, x, y, z, block, shadow) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
        m.castShadow = shadow !== false; m.receiveShadow = true; scene.add(m);
        if (block) solid(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
        return m;
      };
      const rbox = function (mat, r, y0, y1, block, shadow) { return box(mat, r[2] - r[0], y1 - y0, r[3] - r[1], (r[0] + r[2]) / 2, (y0 + y1) / 2, (r[1] + r[3]) / 2, block, shadow); };
      const inst = function (geo, mat, list, place, shadow) {
        if (!list.length) return null;
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach(function (it, i) { dm.position.set(0, 0, 0); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); place(it, i); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); });
        im.instanceMatrix.needsUpdate = true; im.castShadow = shadow !== false; im.receiveShadow = true; scene.add(im);
        return im;
      };
      const noiseTex = function (base, n, seed, w, h) {
        const c = canvas(w || 128, h || 128), g = c.getContext('2d'), R = rng(seed);
        g.fillStyle = base; g.fillRect(0, 0, c.width, c.height);
        for (let i = 0; i < n; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.07)'; g.fillRect(R() * c.width, R() * c.height, 1 + R() * 3, 1 + R() * 3); }
        const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
      };
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
        floorIn: std({ color: 0xE8E4DC, roughness: 0.4 }),
        water: std({ color: 0x40B3D6, roughness: 0.06, metalness: 0.05, emissive: new THREE.Color(0x0F6F92), emissiveIntensity: 0.35, transparent: true, opacity: 0.92 })
      });
      // gradil (grade de barras verticais) desenhado com transparência
      const gradilTex = (function () {
        const c = canvas(64, 128), g = c.getContext('2d');
        g.fillStyle = '#2E3238';
        for (let x = 2; x < 64; x += 8) g.fillRect(x, 0, 2.6, 128);
        g.fillRect(0, 2, 64, 5); g.fillRect(0, 121, 64, 5);
        const t = tex(c); t.wrapS = THREE.RepeatWrapping; return t;
      })();
      const gradil = function (x0, z0, x1, z1, y0, h) {
        const len = Math.hypot(x1 - x0, z1 - z0), t = gradilTex.clone(); t.needsUpdate = true; t.repeat.set(len / 0.55, 1);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshStandardMaterial({ map: t, color: 0xFFFFFF, roughness: 0.6, alphaTest: 0.5, side: THREE.DoubleSide }));
        m.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); m.castShadow = true; scene.add(m);
        solid(Math.min(x0, x1) - 0.06, Math.min(z0, z1) - 0.06, Math.max(x0, x1) + 0.06, Math.max(z0, z1) + 0.06);
        return m;
      };

      // ---------- muro: alto no fundo e nas laterais, mureta com gradil na frente (sul) ----------
      rbox(S_.wall, [LOT.x0, LOT.z0 - 0.2, LOT.x1, LOT.z0], 0, 2.4, true);
      rbox(S_.wall, [LOT.x0 - 0.2, LOT.z0, LOT.x0, LOT.z1], 0, 2.4, true);
      rbox(S_.wall, [LOT.x1, LOT.z0, LOT.x1 + 0.2, LOT.z1], 0, 2.4, true);
      [[LOT.x0, -46.5], [-24.2, LOT.x1]].forEach(function (s) {
        rbox(S_.wall, [s[0], LOT.z1, s[1], LOT.z1 + 0.25], 0, 0.6, true);
        gradil(s[0], LOT.z1 + 0.12, s[1], LOT.z1 + 0.12, 0.6, 1.6);
      });
      for (let x = LOT.x0; x <= LOT.x1; x += 3) if (x < -46.5 || x > -24.2) box(S_.wall, 0.35, 2.3, 0.35, x, 1.15, LOT.z1 + 0.12);

      // ---------- portaria (pilar MILÃO, marquise escura, guarita, portões) ----------
      const nameC = canvas(256, 512), ng = nameC.getContext('2d');
      ng.fillStyle = '#9C9A95'; ng.fillRect(0, 0, 256, 512);
      const NR = rng(5); for (let i = 0; i < 900; i++) { ng.fillStyle = NR() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)'; ng.fillRect(NR() * 256, NR() * 512, 2 + NR() * 4, 2 + NR() * 4); }
      ng.fillStyle = '#3A3A3A'; ng.font = '600 50px Archivo, Arial, sans-serif'; ng.textAlign = 'center'; ng.textBaseline = 'middle';
      ng.fillText('MILÃO', 128, 300);
      const pillarFront = std({ map: tex(nameC), roughness: 0.95 });
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 6.2, 1.3), [S_.concrete, S_.concrete, S_.concrete, S_.concrete, pillarFront, S_.concrete]);
      pillar.position.set(-48, 3.1, LOT.z1 + 0.5); pillar.castShadow = true; scene.add(pillar); solid(-49.3, LOT.z1 - 0.15, -46.7, LOT.z1 + 1.15);
      rbox(S_.wall, [-46.7, LOT.z1, -40.5, LOT.z1 + 0.25], 0, 2.4, true);           // muro entre o pilar e a guarita
      // guarita: alvenaria clara, faixa de vidro, laje escura que vira a marquise sobre os portões
      rbox(S_.white, [GUARD[0], GUARD[1], GUARD[2], GUARD[3]], 0, 1.0, true);
      rbox(S_.white, [GUARD[0], GUARD[1], GUARD[0] + 0.25, GUARD[3]], 1.0, 3.0, false);
      rbox(S_.white, [GUARD[0], GUARD[1], GUARD[2], GUARD[1] + 0.25], 1.0, 3.0, false);
      rbox(M.glass, [GUARD[0] + 0.25, GUARD[3] - 0.08, GUARD[2], GUARD[3]], 1.0, 2.6, false, false);
      rbox(M.glass, [GUARD[2] - 0.08, GUARD[1] + 0.25, GUARD[2], GUARD[3] - 0.08], 1.0, 2.6, false, false);
      rbox(S_.white, [GUARD[0], GUARD[3] - 0.08, GUARD[2], GUARD[3]], 2.6, 3.0, false);
      rbox(S_.white, [GUARD[2] - 0.08, GUARD[1], GUARD[2], GUARD[3]], 2.6, 3.0, false);
      rbox(S_.dark, [-42, 53.5, -23.6, 63.6], 3.0, 3.35, false);                         // marquise
      [[-24.2, 54], [-24.2, 63.2]].forEach(function (p) { box(S_.dark, 0.3, 3.0, 0.3, p[0], 1.5, p[1], true); });
      rbox(S_.navy, [-42, 63.3, -23.6, 63.6], 2.55, 3.0, false);                         // testeira azul da marquise
      // portão de carros (gradil de correr) e portão de pedestres ao lado da guarita
      gradil(ACCESS.x0, LOT.z1 + 0.12, ACCESS.x1, LOT.z1 + 0.12, 0.05, 2.1);
      gradil(-35, LOT.z1 + 0.12, -33, LOT.z1 + 0.12, 0.05, 2.1);
      [-35, -33, -26, -24.2].forEach(function (x) { box(S_.dark, 0.18, 2.4, 0.18, x, 1.2, LOT.z1 + 0.12, true); });
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
        // torres no térreo: colisão das três partes
        PARTS.forEach(function (pt) { solid(T.x + pt.x0 - 0.1, T.z + pt.z0 - 0.1, T.x + pt.x1 + 0.1, T.z + pt.z1 + 0.1); });
        const zf = T.z + HD + WING_DZ / 2;                       // frente do núcleo (porta da portaria da torre)
        box(S_.navy, 0.45, 3.5, 0.45, T.x - 2.3, 1.75, zf + 2.6, true);
        box(S_.navy, 0.45, 3.5, 0.45, T.x + 2.3, 1.75, zf + 2.6, true);
        rbox(S_.navy, [T.x - 2.55, zf, T.x + 2.55, zf + 2.85], 3.5, 3.95, false);
        rbox(S_.dark, [T.x - 1.75, zf + 0.01, T.x + 1.75, zf + 0.06], 2.5, 3.5, false, false);
        rbox(S_.floorIn, [T.x - 2.55, zf, T.x + 2.55, zf + 2.85], 0, 0.06, false, false);
        // porta de vidro da portaria da torre: caixilho escuro, folhas duplas e puxadores de inox (o hall claro aparece atrás)
        [[-1.62, -1.52], [1.52, 1.62], [-0.03, 0.03]].forEach(function (j) { rbox(S_.dark, [T.x + j[0], zf, T.x + j[1], zf + 0.07], 0, 2.5, false, false); });
        rbox(S_.dark, [T.x - 1.62, zf, T.x + 1.62, zf + 0.07], 2.42, 2.52, false, false);
        rbox(S_.dark, [T.x - 1.62, zf, T.x + 1.62, zf + 0.07], 0, 0.1, false, false);
        [-0.16, 0.16].forEach(function (dx) { rbox(S_.steel, [T.x + dx - 0.02, zf + 0.07, T.x + dx + 0.02, zf + 0.11], 0.7, 1.55, false, false); });
        rbox(M.glass, [T.x - 1.52, zf + 0.03, T.x + 1.52, zf + 0.05], 0.1, 2.42, false, false);
        // letra gigante amarela sobre o canteiro, à esquerda de quem chega
        const lg = new THREE.ExtrudeGeometry(letterShape(T.id), { depth: 0.32, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 10 });
        const letter = new THREE.Mesh(lg, S_.yellow); letter.scale.set(1.15, 1.15, 1); letter.position.set(T.x - 5.6, 0.55, zf + 1.6); letter.castShadow = true; scene.add(letter);
        rbox(S_.navy, [T.x - 7.2, zf + 1.3, T.x - 4.0, zf + 2.3], 0, 0.55, true);
        for (let i = 0; i < 5; i++) bikes.push([T.x - 12 + i * 0.75, zf + 2.4]);
      });
      // bicicletários: arcos de inox
      inst(new THREE.TorusGeometry(0.42, 0.03, 6, 16, Math.PI), S_.steel, bikes, function (p) { dm.position.set(p[0], 0, p[1]); });
      bikes.forEach(function (p) { solid(p[0] - 0.1, p[1] - 0.45, p[0] + 0.1, p[1] + 0.45); });

      // ---------- piscina adulto e infantil, deque, espreguiçadeiras, guarda-sóis, cerca de vidro ----------
      const poolTex = (function () {
        const c = canvas(128, 128), g = c.getContext('2d');
        g.fillStyle = '#8FD6EA'; g.fillRect(0, 0, 128, 128);
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5;
        for (let i = 0; i <= 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
        const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
      })();
      [POOLA.adult, POOLA.kids].forEach(function (p, i) {
        const w = p[2] - p[0], d = p[3] - p[1], cx = (p[0] + p[2]) / 2, cz = (p[1] + p[3]) / 2;
        rbox(S_.stone, [p[0] - 0.45, p[1] - 0.45, p[2] + 0.45, p[3] + 0.45], 0, 0.08, false, false);
        const t = poolTex.clone(); t.needsUpdate = true; t.repeat.set(w / 2, d / 2);
        const floorM = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std({ map: t, roughness: 0.6 }));
        floorM.rotation.x = -Math.PI / 2; floorM.position.set(cx, 0.03, cz); scene.add(floorM);
        const wm = new THREE.Mesh(new THREE.PlaneGeometry(w, d), S_.water); wm.rotation.x = -Math.PI / 2; wm.position.set(cx, 0.1, cz); wm.renderOrder = 1; scene.add(wm);
        solid(p[0] - 0.1, p[1] - 0.1, p[2] + 0.1, p[3] + 0.1);
        if (!i) { // escadinha
          [-0.3, 0.3].forEach(function (dx) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 12, Math.PI), S_.steel); r.position.set(p[0] + 1.2 + dx, 0.36, p[1] - 0.08); scene.add(r); });
        }
      });
      const loungers = [];
      for (let x = 27.5; x <= 39; x += 1.6) { loungers.push([x, 38.4, 0]); loungers.push([x, 49.8, Math.PI]); }
      inst(new THREE.BoxGeometry(0.7, 0.32, 1.9), S_.white, loungers, function (p) { dm.position.set(p[0], 0.16, p[1]); dm.rotation.y = p[2]; });
      inst(new THREE.BoxGeometry(0.66, 0.5, 0.12), S_.white, loungers, function (p) { dm.position.set(p[0], 0.5, p[1] + (p[2] ? 0.8 : -0.8)); dm.rotation.set(p[2] ? -0.55 : 0.55, p[2], 0); });
      loungers.forEach(function (p) { solid(p[0] - 0.35, p[1] - 0.95, p[0] + 0.35, p[1] + 0.95); });
      [[26, 52.5], [33, 53.5], [40, 52.5], [45.5, 38.5]].forEach(function (p) {
        box(S_.white, 0.06, 2.4, 0.06, p[0], 1.2, p[1], true);
        const u = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 8, 1, true), std({ color: 0xF4F0E6, roughness: 0.8, side: THREE.DoubleSide }));
        u.position.set(p[0], 2.45, p[1]); u.castShadow = true; scene.add(u);
      });
      // cerca de vidro com corrimão; a entrada fica do lado do passeio
      const pf = POOLA.fence;
      [[pf[0], pf[1], pf[2], pf[1]], [pf[0], pf[3], pf[2], pf[3]], [pf[2], pf[1], pf[2], pf[3]], [pf[0], pf[1], pf[0], 43.5], [pf[0], 45.5, pf[0], pf[3]]].forEach(function (s) {
        const horiz = Math.abs(s[3] - s[1]) < 0.01;
        rbox(M.glass, horiz ? [s[0], s[1] - 0.02, s[2], s[1] + 0.02] : [s[0] - 0.02, s[1], s[0] + 0.02, s[3]], 0, 1.2, true, false);
        rbox(S_.steel, horiz ? [s[0], s[1] - 0.03, s[2], s[1] + 0.03] : [s[0] - 0.03, s[1], s[0] + 0.03, s[3]], 1.2, 1.25, false);
      });
      box(S_.steel, 0.08, 2.3, 0.08, 46.8, 1.15, 56.8, true);       // ducha
      box(S_.steel, 0.5, 0.05, 0.08, 46.6, 2.3, 56.8, false);

      // ---------- salão de festas: frente de vidro para a piscina, faixa azul-marinho no alto ----------
      const H0 = HALL[0], H1 = HALL[2], Z0 = HALL[1], Z1 = HALL[3], HH = 3.9;
      rbox(S_.floorIn, HALL, 0, 0.12, false, false);
      rbox(S_.white, [H1 - 0.25, Z0, H1, Z1], 0, HH, true);
      rbox(S_.white, [H0, Z0, H1, Z0 + 0.25], 0, HH, true);
      rbox(S_.white, [H0 + 6, Z1 - 0.25, H1, Z1], 0, HH, true);
      rbox(M.glass, [H0 + 0.25, Z1 - 0.06, H0 + 6, Z1], 0.12, 2.9, true, false);
      rbox(M.glass, [H0, Z0 + 0.25, H0 + 0.06, Z0 + 5.5], 0.12, 2.9, true, false);
      rbox(M.glass, [H0, Z0 + 7.5, H0 + 0.06, Z1], 0.12, 2.9, true, false);
      [[H0, Z0 + 5.5], [H0, Z0 + 7.5], [H0, Z1], [H0 + 6, Z1]].forEach(function (p) { box(S_.dark, 0.12, 2.9, 0.12, p[0] + 0.06, 1.45, p[1] - 0.06, true); });
      rbox(S_.white, [H0, Z0, H0 + 0.25, Z1], 2.9, HH, false);
      rbox(S_.white, [H0, Z1 - 0.25, H0 + 6, Z1], 2.9, HH, false);
      [[H0 - 0.15, Z0 - 0.15, H1 + 0.15, Z0 + 0.1], [H0 - 0.15, Z1 - 0.1, H1 + 0.15, Z1 + 0.15], [H0 - 0.15, Z0, H0 + 0.1, Z1], [H1 - 0.1, Z0, H1 + 0.15, Z1]].forEach(function (r) { rbox(S_.navy, r, HH, HH + 0.7, false); });
      rbox(std({ color: 0x9FA3A9, roughness: 0.95 }), [H0, Z0, H1, Z1], HH, HH + 0.45, false);
      // dentro: mesas redondas com cadeiras, balcão e copa
      const tables = [[H0 + 4, Z0 + 3.5], [H0 + 8, Z0 + 3.5], [H0 + 4, Z0 + 8], [H0 + 8, Z0 + 8], [H0 + 6, Z0 + 11.2]];
      inst(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 20), S_.white, tables, function (p) { dm.position.set(p[0], 0.86, p[1]); });
      inst(new THREE.CylinderGeometry(0.06, 0.12, 0.74, 8), S_.dark, tables, function (p) { dm.position.set(p[0], 0.49, p[1]); });
      const chairs = []; tables.forEach(function (t) { for (let a = 0; a < 6; a++) chairs.push([t[0] + Math.cos(a * 1.047) * 0.95, t[1] + Math.sin(a * 1.047) * 0.95, -a * 1.047]); });
      inst(new THREE.BoxGeometry(0.42, 0.9, 0.42), S_.wood, chairs, function (p) { dm.position.set(p[0], 0.57, p[1]); dm.rotation.y = p[2]; dm.scale.set(1, 1, 1); });
      tables.forEach(function (t) { solid(t[0] - 0.75, t[1] - 0.75, t[0] + 0.75, t[1] + 0.75); });
      rbox(S_.wood, [H1 - 1.2, Z0 + 2, H1 - 0.25, Z1 - 2], 0.12, 1.05, true);
      rbox(S_.stone, [H1 - 1.25, Z0 + 2, H1 - 0.2, Z1 - 2], 1.05, 1.1, false);

      // ---------- quiosques com churrasqueira e pérgola ----------
      [[KIOSK[0] + 5, 43.5], [KIOSK[0] + 15, 43.5]].forEach(function (k) {
        rbox(S_.dark, [k[0] - 2.9, k[1] - 2.5, k[0] + 2.9, k[1] + 2.5], 3.0, 3.25, false);
        [[-2.6, -2.2], [2.6, -2.2], [-2.6, 2.2], [2.6, 2.2]].forEach(function (c) { box(S_.white, 0.24, 3.0, 0.24, k[0] + c[0], 1.5, k[1] + c[1], true); });
        rbox(S_.brick, [k[0] - 1.6, k[1] - 2.4, k[0] + 0.2, k[1] - 1.7], 0, 1.05, true);          // churrasqueira
        rbox(S_.brick, [k[0] - 1.25, k[1] - 2.4, k[0] - 0.15, k[1] - 1.9], 1.05, 3.6, false);
        rbox(S_.dark, [k[0] - 1.45, k[1] - 1.72, k[0] + 0.05, k[1] - 1.68], 0.6, 0.9, false, false);
        rbox(S_.white, [k[0] + 0.4, k[1] - 2.4, k[0] + 2.4, k[1] - 1.75], 0, 0.9, true);           // bancada com pia
        rbox(S_.stone, [k[0] + 0.35, k[1] - 2.45, k[0] + 2.45, k[1] - 1.7], 0.9, 0.95, false);
        rbox(S_.wood, [k[0] - 1.3, k[1] + 0.2, k[0] + 1.3, k[1] + 1.2], 0.72, 0.78, true);          // mesa e bancos
        rbox(S_.wood, [k[0] - 1.3, k[1] - 0.35, k[0] + 1.3, k[1] - 0.05], 0.42, 0.47, false);
        rbox(S_.wood, [k[0] - 1.3, k[1] + 1.45, k[0] + 1.3, k[1] + 1.75], 0.42, 0.47, false);
        [[-1.1, 0.7], [1.1, 0.7]].forEach(function (c) { box(S_.wood, 0.08, 0.72, 0.6, k[0] + c[0], 0.36, k[1] + c[1], false); });
      });
      const beams = []; for (let x = 1; x <= 19; x += 0.6) beams.push(x);
      inst(new THREE.BoxGeometry(0.08, 0.16, 3.4), S_.wood, beams, function (x) { dm.position.set(x, 2.75, 49.6); });
      [1, 10, 19].forEach(function (x) { [48, 51.2].forEach(function (z) { box(S_.wood, 0.16, 2.7, 0.16, x, 1.35, z, true); }); });
      rbox(S_.wood, [1, 47.95, 19, 48.1], 2.6, 2.7, false); rbox(S_.wood, [1, 51.1, 19, 51.25], 2.6, 2.7, false);

      // ---------- pracinha: torre com escorregador, balanço, gangorra, gira-gira e bancos ----------
      const px = PLAY[0], pz = PLAY[1];
      [[px + 4, pz + 4], [px + 6, pz + 4], [px + 4, pz + 6], [px + 6, pz + 6]].forEach(function (p) { box(S_.yellow, 0.14, 2.4, 0.14, p[0], 1.2, p[1], false); });
      solid(px + 3.8, pz + 3.8, px + 6.2, pz + 6.2);
      rbox(S_.wood, [px + 3.9, pz + 3.9, px + 6.1, pz + 6.1], 1.2, 1.32, false);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.1, 4), S_.red); roof.rotation.y = Math.PI / 4; roof.position.set(px + 5, 2.95, pz + 5); roof.castShadow = true; scene.add(roof);
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 3.2), S_.blue); slide.position.set(px + 5, 0.68, pz + 7.6); slide.rotation.x = 0.42; slide.castShadow = true; scene.add(slide);
      solid(px + 4.6, pz + 6.1, px + 5.4, pz + 9.1);
      const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 1.6), S_.green); ladder.position.set(px + 2.95, 0.65, pz + 5); ladder.rotation.z = 0.95; scene.add(ladder);
      // balanço
      const sx = px + 12, sz = pz + 4;
      [[-1.8, -0.5], [-1.8, 0.5], [1.8, -0.5], [1.8, 0.5]].forEach(function (c) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.7, 8), S_.blue); leg.position.set(sx + c[0], 1.3, sz + c[1] * 0.8); leg.rotation.x = c[1] * 0.35; leg.castShadow = true; scene.add(leg); });
      box(S_.blue, 3.8, 0.12, 0.12, sx, 2.55, sz, false);
      [-0.8, 0.8].forEach(function (dx) { box(S_.dark, 0.02, 2.0, 0.02, sx + dx - 0.2, 1.55, sz, false); box(S_.dark, 0.02, 2.0, 0.02, sx + dx + 0.2, 1.55, sz, false); box(S_.red, 0.5, 0.05, 0.22, sx + dx, 0.55, sz, false); });
      solid(sx - 2, sz - 0.9, sx + 2, sz + 0.9);
      // gangorra e gira-gira
      const gang = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.28), S_.red); gang.position.set(px + 12, 0.45, pz + 10); gang.rotation.z = 0.18; gang.castShadow = true; scene.add(gang);
      box(S_.dark, 0.2, 0.4, 0.2, px + 12, 0.2, pz + 10, true);
      const gira = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.12, 20), S_.green); gira.position.set(px + 5, 0.32, pz + 12); gira.castShadow = true; scene.add(gira);
      box(S_.yellow, 0.08, 0.9, 0.08, px + 5, 0.75, pz + 12, false); solid(px + 4, pz + 11, px + 6, pz + 13);
      // bancos (pracinha, passeio e pet) e lixeiras
      const benches = [[px - 1, pz + 7, Math.PI / 2], [px + 9, pz + 15.5, 0], [-52, 36.5, 0], [-40, 36.5, 0], [8, 36.5, 0], [-64, 56, Math.PI], [26, 33.6, 0], [50, 33.6, 0], [-70, 33.6, 0]];
      inst(new THREE.BoxGeometry(1.8, 0.08, 0.45), S_.wood, benches, function (p) { dm.position.set(p[0], 0.45, p[1]); dm.rotation.y = p[2]; });
      inst(new THREE.BoxGeometry(1.8, 0.4, 0.06), S_.wood, benches, function (p) { dm.position.set(p[0] - Math.sin(p[2]) * 0.22, 0.75, p[1] - Math.cos(p[2]) * 0.22); dm.rotation.y = p[2]; });
      inst(new THREE.BoxGeometry(1.7, 0.42, 0.1), S_.dark, benches, function (p) { dm.position.set(p[0], 0.21, p[1]); dm.rotation.y = p[2]; });
      benches.forEach(function (p) { const a = Math.abs(Math.sin(p[2])) > 0.5; solid(p[0] - (a ? 0.3 : 0.95), p[1] - (a ? 0.95 : 0.3), p[0] + (a ? 0.3 : 0.95), p[1] + (a ? 0.95 : 0.3)); });

      // ---------- espaço pet: cerca baixa, agility, bebedouro ----------
      [[PET[0], PET[1], PET[2], PET[1]], [PET[0], PET[3], PET[2], PET[3]], [PET[0], PET[1], PET[0], PET[3]], [PET[2], PET[1], PET[2], 44.5], [PET[2], 46.5, PET[2], PET[3]]].forEach(function (s) { gradil(s[0], s[1], s[2], s[3], 0, 1.2); });
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 3.6), S_.yellow); ramp.position.set(PET[0] + 14, 0.55, PET[1] + 6); ramp.rotation.x = 0.35; ramp.castShadow = true; scene.add(ramp);
      [0, 1, 2].forEach(function (i) {
        const hx = PET[0] + 6 + i * 3, hz = PET[1] + 13;
        box(S_.blue, 0.06, 0.6, 0.06, hx - 0.5, 0.3, hz, false); box(S_.blue, 0.06, 0.6, 0.06, hx + 0.5, 0.3, hz, false); box(S_.red, 1.0, 0.05, 0.05, hx, 0.45, hz, false);
      });
      const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.6, 16, 1, true), std({ color: 0x2E8A5A, roughness: 0.7, side: THREE.DoubleSide }));
      tunnel.rotation.z = Math.PI / 2; tunnel.position.set(PET[0] + 17, 0.45, PET[1] + 12); tunnel.castShadow = true; scene.add(tunnel);
      for (let i = 0; i < 6; i++) box(S_.yellow, 0.05, 1.0, 0.05, PET[0] + 4 + i * 0.7, 0.5, PET[1] + 4, false);
      box(S_.steel, 0.25, 0.9, 0.25, PET[2] - 2, 0.45, PET[1] + 2, true);

      // ---------- reservatórios d'água (cilindros azuis), na ponta oeste ----------
      rbox(S_.concrete, RES, 0, 0.4, true);
      [-78.4, -73.5, -68.6].forEach(function (x) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 6.2, 28), S_.tank); t.position.set(x, 3.5, -1); t.castShadow = true; t.receiveShadow = true; scene.add(t);
        const c = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.6, 28), S_.tank); c.position.set(x, 6.9, -1); c.castShadow = true; scene.add(c);
        [1.0, 2.6, 4.2, 5.8].forEach(function (y) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.76, 0.03, 4, 28), S_.dark); r.rotation.x = Math.PI / 2; r.position.set(x, y + 0.4, -1); scene.add(r); });
      });
      box(S_.steel, 13, 0.18, 0.18, -73.5, 1.0, 1.4, false);
      [[RES[0], RES[1], RES[2], RES[1]], [RES[0], RES[3], RES[2], RES[3]], [RES[2], RES[1], RES[2], RES[3]]].forEach(function (s) { gradil(s[0], s[1], s[2], s[3], 0.4, 1.6); });

      // ---------- postes de luz (passeios e rua interna) ----------
      const posts = [];
      for (let x = -76; x <= 58; x += 12) {
        if (!TOWERS.some(function (t) { return Math.abs(x - t.x) < 4; })) posts.push([x, 15.1]);
        if (Math.abs(x + 6 - (ACCESS.x0 + ACCESS.x1) / 2) > 5) posts.push([x + 6, 33.0]);
      }
      [[-24.6, 40], [-24.6, 50], [-34.4, 45], [-2.5, 44], [22, 44], [-56, 41]].forEach(function (p) { posts.push(p); });
      inst(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8), S_.dark, posts, function (p) { dm.position.set(p[0], 2.1, p[1]); });
      inst(new THREE.BoxGeometry(0.5, 0.14, 0.5), lampHeads, posts, function (p) { dm.position.set(p[0], 4.25, p[1]); }, false);
      posts.forEach(function (p) { solid(p[0] - 0.12, p[1] - 0.12, p[0] + 0.12, p[1] + 0.12); });

      // ---------- carros estacionados (mais ou menos metade das vagas) ----------
      const cars = [], CR = rng(31), carCols = ['#E9EAEC', '#1F2328', '#8D939B', '#B9BEC4', '#6B1F24', '#2B3E66', '#D7D2C6', '#3C4A3A'];
      PARK.forEach(function (p, i) {
        for (let x = p[0] + 1.25; x < p[2]; x += 2.5) {
          if (i === 0 && TOWERS.some(function (t) { return Math.abs(x - t.x) < 3.4; })) continue;
          if (i === 1 && Math.abs(x - (ACCESS.x0 + ACCESS.x1) / 2) < 4.5) continue;
          if ([-12, 36].some(function (c) { return Math.abs(x - c) < 3; })) continue;
          if (CR() < 0.48) cars.push([x, i ? p[1] + 2.6 : p[3] - 2.6, i ? 0 : Math.PI, carCols[Math.floor(CR() * carCols.length)]]);
        }
      });
      const carBody = inst(new THREE.BoxGeometry(1.78, 0.72, 4.3), std({ color: 0xFFFFFF, roughness: 0.35, metalness: 0.25 }), cars, function (c) { dm.position.set(c[0], 0.62, c[1]); dm.rotation.y = c[2]; });
      const carTop = inst(new THREE.BoxGeometry(1.6, 0.55, 2.3), std({ color: 0xFFFFFF, roughness: 0.25, metalness: 0.2 }), cars, function (c) { dm.position.set(c[0], 1.25, c[1] + (c[2] ? 0.25 : -0.25)); dm.rotation.y = c[2]; });
      inst(new THREE.BoxGeometry(1.7, 0.32, 3.9), std({ color: 0x1A1C20, roughness: 0.8 }), cars, function (c) { dm.position.set(c[0], 0.3, c[1]); dm.rotation.y = c[2]; });
      const col = new THREE.Color();
      cars.forEach(function (c, i) {
        if (carBody) carBody.setColorAt(i, col.set(c[3]).convertSRGBToLinear());
        if (carTop) carTop.setColorAt(i, col.set(c[3]).lerp(new THREE.Color('#1B2B3A'), 0.55).convertSRGBToLinear());
        solid(c[0] - 1.0, c[1] - 2.25, c[0] + 1.0, c[1] + 2.25);
      });
      if (carBody && carBody.instanceColor) carBody.instanceColor.needsUpdate = true;
      if (carTop && carTop.instanceColor) carTop.instanceColor.needsUpdate = true;
    })();

    /* árvores (no lote e a mata em volta) e casas da vizinhança (instanciadas) */
    (function buildContext() {
      const R = rng(2026);
      const trees = [], inLot = [];
      const add = function (x, z, s) { trees.push([x, z, s || 1.5 + R() * 1.7]); };
      // no lote: fileira junto ao muro do fundo, nas laterais, entre as áreas de lazer e na frente
      for (let x = -82; x <= 63; x += 6.5) { if (!TOWERS.some(function (t) { return Math.abs(x - t.x) < HL + 2; })) inLot.push([x + R(), -11.5 + R()]); }
      for (let z = 10; z <= 58; z += 7) { inLot.push([-83 + R() * 0.6, z + R()]); inLot.push([64 + R() * 0.6, z + R()]); }
      [[-55, 39], [-55, 50], [-45, 42], [-45, 50], [-22.5, 56], [-14, 56], [-5, 57], [4, 56], [13, 56], [22, 57.5], [51, 56], [57, 56], [61, 40], [-60, 10], [-62, 1], [61, 4], [61, -6]].forEach(function (p) { inLot.push(p); });
      inLot.forEach(function (p) { add(p[0], p[1]); GROUND_SOLIDS.push([p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3]); });
      // mata nativa: ao sul do lote (a leste da rua de acesso) e a leste
      const forest = function (x0, z0, x1, z1, step) {
        for (let x = x0; x < x1; x += step) for (let z = z0; z < z1; z += step) add(x + (R() - 0.5) * step * 0.9, z + (R() - 0.5) * step * 0.9, 2 + R() * 2.4);
      };
      forest(-21, 64.5, 150, 160, 4.2);
      forest(68.5, -60, 160, 64.5, 4.2);
      forest(-200, 88, -21, 140, 5.5);
      forest(-90, 64, -36, 74.5, 6);
      // árvores esparsas nos quintais e nas calçadas
      for (let i = 0; i < 140; i++) {
        const x = (R() - 0.5) * 520, z = (R() - 0.5) * 440 - 30;
        if (x > -92 && x < 70 && z > -36 && z < 100) continue;
        if (x > 66) continue;
        add(x, z);
      }
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 2.4, 6), std({ color: 0x6B5240 }), trees.length);
      const crownG = new THREE.IcosahedronGeometry(1, 1);
      const crowns = new THREE.InstancedMesh(crownG, std({ color: 0xffffff, roughness: 0.9, flatShading: true }), trees.length);
      const col = new THREE.Color();
      trees.forEach(function (p, i) {
        const s = p[2];
        dm.rotation.set(0, R() * 6.28, 0);
        dm.position.set(p[0], 1.2, p[1]); dm.scale.set(1, 1, 1); dm.updateMatrix(); trunk.setMatrixAt(i, dm.matrix);
        dm.position.set(p[0], 2.2 + s * 0.85, p[1]); dm.scale.set(s, s * (0.85 + R() * 0.25), s); dm.updateMatrix(); crowns.setMatrixAt(i, dm.matrix);
        col.setHSL(0.22 + R() * 0.09, 0.32 + R() * 0.18, 0.22 + R() * 0.12); crowns.setColorAt(i, col.convertSRGBToLinear());
      });
      dm.scale.set(1, 1, 1);
      trunk.castShadow = true; crowns.castShadow = true; crowns.receiveShadow = true;
      scene.add(trunk); scene.add(crowns);

      // casas: atrás do muro do fundo (Rua Gastão), a oeste (Rua Gustavo Veter) e na Rua Marieta Fialho Blessmann
      const houses = [];
      const row = function (x0, x1, z, depth, face) {
        for (let x = x0; x < x1; x += 11 + R() * 4) houses.push([x + R() * 2, z + (R() - 0.5) * 2, 7 + R() * 4, depth * (0.8 + R() * 0.3), 3 + R() * 3.2, face + (R() - 0.5) * 0.08]);
      };
      row(-108, 92, -27, 9, 0); row(-108, 92, -55, 9, 0); row(-108, 92, -68, 9, 0);
      for (let z = -30; z < 76; z += 12 + R() * 3) { houses.push([-110 + R() * 2, z, 9 + R() * 3, 8 + R() * 4, 3 + R() * 3, Math.PI / 2]); }
      for (let z = -30; z < 76; z += 13 + R() * 3) { houses.push([-124 + R() * 2, z, 9 + R() * 3, 8 + R() * 4, 3 + R() * 3, Math.PI / 2]); }
      row(-90, -38, 70.5, 8, Math.PI); row(-200, -26, 91, 8, Math.PI);
      for (let i = 0; i < 420 && houses.length < 190; i++) {
        const x = (R() - 0.5) * 600, z = (R() - 0.5) * 520 - 20;
        if (x > -132 && x < 160 && z > -80 && z < 165) continue;
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
      scene.add(walls); scene.add(roofs);
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
      SHAFTS.forEach(function (r) {                                // elevadores (frente), escada (fundos) e poços de ventilação
        const h = r[4] === 'poco' ? FH * 0.45 : FH * 0.55;
        b(plateMats.shaft, r[2] - r[0], h, r[3] - r[1], (r[0] + r[2]) / 2, y + h / 2, (r[1] + r[3]) / 2);
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
        parede: tex(parede), piso: rep(tex(piso), 1, 1), madeira: tex(madeira), inox: tex(inox), veneziana: tex(veneziana),
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
      [[-18.9, -17.4], [17.4, 18.9]].forEach(function (xr) {
        const zc = dzAt(xr[0]);
        [-1, 1].forEach(function (s) {
          box(corrMats.wall, s > 0 ? [xr[0], zc + CORR - 0.012, xr[1], zc + CORR + T] : [xr[0], zc - CORR - T, xr[1], zc - CORR + 0.012], 0, hgt);
          const xc = (xr[0] + xr[1]) / 2, zf = zc + (s > 0 ? CORR - 0.012 : -CORR + 0.012);   // porta veneziana dos medidores de água e gás
          box(corrMats.louver, [xc - 0.4, Math.min(zf, zf - s * 0.025), xc + 0.4, Math.max(zf, zf - s * 0.025)], 0.3, 1.9, grp, false, false);
        });
      });
      // hall do núcleo: liga o corredor da ala oeste (eixo z = 0) ao da ala leste (z = 4); elevadores na frente, escada nos fundos
      const ZE = WING_DZ + CORR;                                     // parede dos elevadores
      box(corrMats.navy, [-1.8, ZE - 0.012, 1.8, ZE + T], 0, hgt);
      box(corrMats.wall, [-1.8, -CORR - T, 1.8, -CORR + 0.012], 0, hgt);
      box(corrMats.wall, [-1.8 - T, CORR, -1.8 + 0.012, ZE], 0, hgt);            // lateral oeste (apto 3)
      box(corrMats.wall, [1.8 - 0.012, -CORR, 1.8 + T, WING_DZ - CORR], 0, hgt);  // lateral leste (apto 9)
      // ---------- hall dos elevadores: parede azul-marinho, portas de inox, indicador de andar, botoeira ----------
      const ind = sign('ind' + andar, 128, 48, function (g) {
        g.fillStyle = '#0B0D10'; g.fillRect(0, 0, 128, 48);
        g.fillStyle = '#FF4436'; g.font = '700 30px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(andar), 64, 25);
        g.beginPath(); g.moveTo(22, 30); g.lineTo(30, 18); g.lineTo(38, 30); g.fill();
      }, true);
      const liftDoors = [];
      [-0.85, 0.85].forEach(function (x) {
        box(corrMats.dark, [x - 0.52, ZE - 0.032, x + 0.52, ZE], 0, 2.2, grp, false, false);
        const l = box(corrMats.steel, [x - 0.45, ZE - 0.042, x - 0.004, ZE - 0.005], 0, 2.12, grp, false, false);
        const r = box(corrMats.steel, [x + 0.004, ZE - 0.042, x + 0.45, ZE - 0.005], 0, 2.12, grp, false, false);
        liftDoors.push({ l: l, r: r, x: x });
        box(ind, [x - 0.15, ZE - 0.04, x + 0.15, ZE - 0.012], 2.27, 2.38, grp, false, false);
      });
      box(corrMats.steel, [-0.06, ZE - 0.03, 0.06, ZE - 0.012], 1.0, 1.32, grp, false, false);   // botoeira
      box(corrMats.amber, [-0.022, ZE - 0.04, 0.022, ZE - 0.03], 1.2, 1.235, grp, false, false);
      box(corrMats.handle, [-0.022, ZE - 0.04, 0.022, ZE - 0.03], 1.09, 1.125, grp, false, false);
      box(corrMats.hall, [-1.8, ZE - 1.25, 1.8, ZE - 0.012], 0, 0.014, grp, false, false);       // faixa de porcelanato grafite em frente aos elevadores
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
      tw.corr = { grp: grp, ceil: ceilG, solids: solids, y0: y0, lift: liftDoors, ze: ZE };
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
      TOWERS.forEach(function (T) {
        const tw = towers[T.id], open = sel && sel.torre === T.id ? sel.andar : 0;
        const inApt = !!(apt && open), ground = inApt && apt.level === 'ground', full = inApt && apt.view === 'walk' && !ground;
        // no térreo (desceu de elevador) a torre aparece inteira, com o andar do apto fechado
        tw.slices.forEach(function (m, lv) { m.visible = !open || lv < open || (full && lv > open) || ground; });
        tw.top.visible = !open || full || ground;
        tw.balc.forEach(function (im) {
          if (!im.userData.all) im.userData.all = im.instanceMatrix.array.slice();
          im.instanceMatrix.array.set(im.userData.all);
          if (full) im.instanceMatrix.array.fill(0, (open - 1) * 4 * 16, open * 4 * 16);   // a sacada do próprio andar vem da maquete
          im.instanceMatrix.needsUpdate = true;
          im.count = open && !full && !ground ? 4 * (open - 1) : 4 * FLOORS;
        });
        tw.ghost.visible = !!open && !inApt;
        if (tw.plate) tw.plate.visible = !ground;
        if (tw.units) tw.units.forEach(function (ug) { ug.visible = !(inApt && ug.userData.unit === apt.pos); });
        if (tw.corr) {
          const walking = inApt && (apt.view === 'walk' || apt.view === 'free') && !ground;
          tw.corr.grp.visible = walking; tw.corr.ceil.visible = walking && apt.ceil;
        }
      });
      const lit = !!(apt && sel && apt.door && (apt.view === 'walk' || apt.view === 'free') && apt.level !== 'ground');
      corrLights.forEach(function (l, i) {
        l.intensity = lit ? (i === 2 ? 0.9 : 1.1) : 0; l.visible = lit;
        if (lit) {
          const T = towers[sel.torre].T, dx = apt.door.x > 0 ? -1 : 1, x = i === 2 ? 0 : apt.door.x + dx * (i ? -2.6 : 1.2);
          const xc = Math.max(-HL + 1, Math.min(HL - 1, x)), zc = i === 2 ? WING_DZ / 2 : dzAt(Math.abs(xc) < 1.8 ? apt.door.x : xc);
          l.position.set(T.x + xc, sel.andar * FH + 0.28 + CEIL - 0.3, T.z + zc);
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
    const HOME = { target: new THREE.Vector3(-4, 8, 16), r: 205, phi: 0.98, theta: 0.42 };
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
      lamps.forEach(function (l) { l.intensity = night ? 1.6 : 0; l.visible = night; });
      lampHeads.emissiveIntensity = night ? 2.2 : 0; S_.yellow.emissiveIntensity = night ? 0.35 : 0;
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
      if (!dirty && !moving && !blink) return;
      const full = dirty || moving;
      dirty = false;
      setPulse(now);
      renderer.autoClear = true;
      renderer.toneMappingExposure = night ? 1.12 : 1.02;
      renderer.shadowMap.needsUpdate = full;
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

    if (window.__DEBUG) window.__predio = { camera: camera, controls: controls, scene: scene, redraw: function () { dirty = true; }, GROUND_SOLIDS: GROUND_SOLIDS };
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
          // elevador: o hall em frente às portas chama o elevador; quem sobe chega ali, de costas para as portas, olhando a ala do apto
          const ZE = WING_DZ + CORR;
          out.lift = { zone: [T.x - 1.8, T.z + ZE - 1.35, T.x + 1.8, T.z + ZE], at: [T.x + (apt.door.x > 0 ? 0.6 : -0.6), eye, T.z + ZE - 0.75],
            to: [T.x + (apt.door.x > 0 ? 7 : -7), eye - 0.3, T.z + dzAt(apt.door.x)] };
        }
        // térreo do condomínio para descer de elevador: colisão (torres, muro, piscina, prédios, carros...), áreas com nome e a portaria da torre
        const zf = T.z + HD + WING_DZ / 2;
        out.ground = {
          name: 'Térreo do condomínio',
          walls: GROUND_SOLIDS.slice(),
          walk: [[LOT.x0 + 0.35, LOT.z0 + 0.35, LOT.x1 - 0.35, LOT.z1 - 0.2]],
          zones: TOWERS.map(function (t) { const f = t.z + HD + WING_DZ / 2; return { id: 'entrada' + t.id, name: 'Entrada da Torre ' + t.id, r: [t.x - 7.5, f - 0.5, t.x + 7.5, 15.5] }; })
            .concat(ZONES).concat([{ id: 'passeio', name: 'Passeio na frente das torres', r: [LOT.x0, 7, LOT.x1, 15.5] }]),
          spawn: { at: [T.x, 1.6, zf + 1.5], to: [T.x, 1.3, zf + 16] },
          lift: [T.x - 2.3, zf - 0.1, T.x + 2.3, zf + 2.9]
        };
        out.reservado = statusOf(T.id, sel.andar, pos) === 'reservado';
        return out;
      },
      // vista atual da maquete: 3d, top, walk ou free; ceil = forro da maquete visível (o do corredor acompanha)
      setAptView: function (view, ceil, level) {
        if (!apt) return;
        const lv = level || 'apt';
        if (apt.view === view && apt.ceil === !!ceil && apt.level === lv) return;
        apt.view = view; apt.ceil = !!ceil; apt.level = lv;
        applyVisibility();
      },
      // desenha o prédio com a câmera da maquete (a maquete desenha o apto por cima, no mesmo quadro)
      renderWith: function (cam) {
        setPulse(performance.now());
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

  window.Predio3D = { create: create, unitRect: unitRect, unitPlace: unitPlace, planCanvas: planCanvas, planPose: planPose, BAYS: BAYS, FH: FH, L: L, D: D, HD: HD, CORR: CORR,
    PARTS: PARTS, SHAFTS: SHAFTS, WING_DZ: WING_DZ, Z_MIN: Z_MIN, Z_MAX: Z_MAX };
})();
