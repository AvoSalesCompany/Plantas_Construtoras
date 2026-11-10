/* Planta COM SACADA (apartamento de canto, "Apto Canto-101" da Baliza) medida em pixels sobre a imagem oficial (825 x 768 px).
   Escala calibrada pelas cotas 2,39 (dorm. 1, dorm. 2, estar, cozinha) / 2,36 (banho, sacada) / 4,34 / 3,14 / 2,25 / 2,61 / 1,46 / 5,09
   => 101,9 px por metro. Retângulos: [x1, y1, x2, y2] em px; origem no canto externo superior esquerdo (21, 23).
   A fachada fica em cima (janelas dos quartos e sacada); a porta de entrada fica embaixo, na circulação do prédio.
   O lado direito é a ponta do prédio; o recorte embaixo à esquerda é o poço onde ficam as janelas do banho e da área de serviço. */
window.PLANS = window.PLANS || {};
window.PLANS['com-sacada'] = {
  id: 'com-sacada',
  meta: { titulo: 'Apartamento com sacada', area: '49,69', comodos: '42,58', img: 'planta-com-sacada.jpg', imgSize: [825, 768] },
  extent: [801, 752],
  scale: 101.9,
  origin: [21, 23],
  H: 2.50,
  doorTop: 2.10,
  frame: 0.045,
  outline: [[21, 23], [801, 23], [801, 669], [666, 669], [666, 752], [398, 752], [398, 656], [142, 656], [142, 491], [21, 491]],
  // contorno do prédio nos andares de baixo (sem a área da sacada, que vira sacadas empilhadas)
  body: [[21, 23], [547, 23], [547, 129], [790, 129], [790, 23], [801, 23], [801, 669], [666, 669], [666, 752], [398, 752], [398, 656], [142, 656], [142, 491], [21, 491]],
  walls: [
    { id: 'V1', r: [21, 23, 34, 491] },
    { id: 'H1', r: [34, 23, 534, 37], open: [ { a: 93, b: 220, kind: 'win', win: 'd1' }, { a: 350, b: 476, kind: 'win', win: 'd2' } ] },
    { id: 'V3', r: [534, 23, 546, 368] },
    { id: 'V9', r: [790, 23, 801, 669] },
    { id: 'H2', r: [546, 129, 790, 142], open: [ { a: 605, b: 732, kind: 'win', win: 'estar' } ] },
    { id: 'H3', r: [289, 356, 534, 368], open: [ { a: 303, b: 400, kind: 'door', door: 'd2' } ] },
    { id: 'V2', r: [278, 37, 289, 476], open: [ { a: 374, b: 471, kind: 'door', door: 'd1' } ] },
    { id: 'H4', r: [34, 476, 398, 491], open: [ { a: 296, b: 393, kind: 'door', door: 'banho' } ] },
    { id: 'V4', r: [142, 491, 155, 641], open: [ { a: 520, b: 577, kind: 'win', win: 'banho' } ] },
    { id: 'H5', r: [142, 641, 398, 656] },
    { id: 'V5', r: [398, 477, 411, 752], open: [ { a: 672, b: 739, kind: 'win', win: 'coz' } ] },
    { id: 'H6', r: [411, 740, 666, 752] },
    { id: 'V6', r: [655, 657, 666, 740] },
    { id: 'H7', r: [666, 657, 790, 669], open: [ { a: 676, b: 782, kind: 'door', door: 'entrada' } ] },
    { id: 'H9', r: [155, 612, 244, 624] },
    { id: 'V7', r: [233, 624, 244, 641] }
  ],
  shaft: [155, 624, 233, 641],
  windows: {
    d1:    { sill: 1.10, top: 2.10, type: 'persiana', inside: 1 },
    d2:    { sill: 1.10, top: 2.10, type: 'persiana', inside: 1 },
    estar: { sill: 0.00, top: 2.10, type: 'correr',   inside: 1, walk: true },   // porta de correr da sala para a sacada
    banho: { sill: 1.50, top: 2.10, type: 'maximar',  inside: 1 },
    coz:   { sill: 1.10, top: 2.10, type: 'maximar',  inside: 1 }
  },
  doors: {
    d1:      { hinge: 'b', swing: -1, leaf: 0.80 },
    d2:      { hinge: 'a', swing: -1, leaf: 0.80 },
    banho:   { hinge: 'b', swing: 1,  leaf: 0.80 },
    entrada: { hinge: 'b', swing: -1, leaf: 0.90 }
  },
  floors: [
    { r: [34, 37, 278, 476], m: 'lam' },
    { r: [278, 374, 289, 471], m: 'lam' },
    { r: [289, 37, 534, 356], m: 'lam' },
    { r: [303, 356, 400, 368], m: 'lam' },
    { r: [289, 368, 546, 477], m: 'lam' },
    { r: [546, 142, 790, 477], m: 'lam' },
    { r: [666, 477, 790, 657], m: 'lam' },
    { r: [676, 657, 782, 669], m: 'lam' },
    { r: [411, 477, 666, 740], m: 'tileK' },
    { r: [547, 23, 790, 129], m: 'tileK' },
    { r: [605, 129, 732, 142], m: 'tileK' },
    { r: [155, 491, 397, 612], m: 'tileB' },
    { r: [244, 612, 397, 641], m: 'tileB' },
    { r: [296, 476, 393, 491], m: 'tileB' }
  ],
  finishes: [
    // banho: azulejo até o teto
    { dir: 'S', at: 491, from: 155, to: 296, m: 'tileW' },
    { dir: 'S', at: 491, from: 393, to: 397, m: 'tileW' },
    { dir: 'S', at: 491, from: 296, to: 393, h0: 2.145, m: 'tileW' },
    { dir: 'E', at: 155, from: 491, to: 520, m: 'tileW' },
    { dir: 'E', at: 155, from: 520, to: 577, h1: 1.50, m: 'tileW' },
    { dir: 'E', at: 155, from: 520, to: 577, h0: 2.10, m: 'tileW' },
    { dir: 'E', at: 155, from: 577, to: 612, m: 'tileW' },
    { dir: 'W', at: 397, from: 491, to: 641, m: 'tileW' },
    { dir: 'N', at: 612, from: 155, to: 244, m: 'tileW' },
    { dir: 'E', at: 244, from: 612, to: 641, m: 'tileW' },
    { dir: 'N', at: 641, from: 244, to: 397, m: 'tileW' },
    // cozinha e área de serviço: azulejo até 1,60 m
    { dir: 'N', at: 740, from: 411, to: 655, h1: 1.60, m: 'tileW' },
    { dir: 'E', at: 411, from: 640, to: 672, h1: 1.60, m: 'tileW' },
    { dir: 'E', at: 411, from: 672, to: 740, h1: 1.10, m: 'tileW' },
    { dir: 'W', at: 655, from: 669, to: 740, h1: 1.60, m: 'tileW' }
  ],
  rooms: [
    { id: 'd1',     name: 'Dormitório 1',       area: '10,24', dims: '2,39 × 4,34', label: [156, 370],
      view: { at: [250, 420], to: [120, 160] }, lights: [[156, 256]],
      rects: [[34, 37, 278, 476], [278, 374, 289, 471]] },
    { id: 'd2',     name: 'Dormitório 2',       area: '7,50',  dims: '2,39 × 3,14', label: [380, 245],
      view: { at: [350, 330], to: [470, 110] }, lights: [[411, 197]],
      rects: [[289, 37, 534, 356], [303, 356, 400, 368]] },
    { id: 'estar',  name: 'Estar / Jantar',     area: '10,29', dims: '2,39 × 2,25', label: [700, 390],
      view: { at: [600, 430], to: [770, 210] }, lights: [[668, 258], [720, 448]],
      rects: [[546, 142, 790, 477], [666, 477, 790, 657], [605, 129, 732, 142]] },
    { id: 'sacada', name: 'Sacada',             area: '2,48',  dims: '2,36 × 1,05', label: [668, 76],
      view: { at: [668, 112], to: [690, -60] }, lights: [],
      rects: [[547, 23, 790, 129]] },
    { id: 'coz',    name: 'Cozinha / Á. Serv.', area: '6,24',  dims: '2,39 × 2,61', label: [520, 628],
      view: { at: [630, 615], to: [460, 560] }, lights: [[533, 632]],
      rects: [[411, 477, 666, 740]] },
    { id: 'banho',  name: 'Banho',              area: '3,18',  dims: '2,36 × 1,46', label: [300, 545],
      view: { at: [345, 505], to: [190, 590] }, lights: [[290, 556]],
      rects: [[155, 491, 397, 641], [296, 476, 393, 491]] },
    { id: 'circ',   name: 'Circulação',         area: '2,65',  dims: '',            label: [418, 420],
      view: { at: [500, 400], to: [300, 420] }, lights: [[418, 422]],
      rects: [[289, 368, 546, 477]] }
  ],
  switches: { d1: [278, 362, 'W'], d2: [412, 356, 'N'], banho: [397, 515, 'W'], circ: [420, 368, 'S'], estar: [671, 657, 'N'], coz: [655, 676, 'W'] },
  shaftRooms: { d1: [34, 37, 278, 476], d2: [289, 37, 534, 356], estar: [546, 142, 790, 657] },
  // zonas de luz: 0 dorm.1, 1 vão d1, 2 dorm.2, 3 vão d2, 4 banho, 5 vão banho, 6–9 sala/cozinha/circulação (a sacada fica de fora: é ao ar livre)
  zoneRects: [[19, 21, 284, 480], [276, 370, 293, 475], [284, 21, 540, 362], [299, 354, 404, 372], [140, 486, 404, 658], [292, 472, 397, 495],
    [540, 136, 803, 482], [284, 362, 546, 482], [396, 474, 803, 671], [396, 660, 668, 754]],
  facadeWins: [['d1', 93, 220, 23, 'N'], ['d2', 350, 476, 23, 'N'], ['estar', 605, 732, 129, 'N'], ['banho', 520, 577, 142, 'W'], ['coz', 672, 739, 398, 'W']],
  balcony: { r: [547, 23, 790, 129] },
  poses: {
    cama1: { kind: 'lie', label: 'Deitar na cama', at: [88, 178], y: 0.80, yaw: 90, pitch: 0.24, stand: [170, 320] },
    cama2: { kind: 'lie', label: 'Deitar na cama', at: [486, 72], y: 0.76, yaw: 0, pitch: 0.24, stand: [400, 200] },
    sofa: { kind: 'sit', label: 'Sentar no sofá', at: [610, 262], y: 1.12, yaw: 90, pitch: 0.05, stand: [600, 400] }
  },
  toilet: { c: [276, 577], tank: [256, 602, 296, 626], btn: [276, 614] },
  console: { xf: 758, xb: 781, padX: 766 }
};
