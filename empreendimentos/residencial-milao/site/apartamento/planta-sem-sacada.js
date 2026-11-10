/* Planta medida em pixels sobre a imagem oficial (871 x 749 px) e convertida por escala.
   Escala calibrada pelas cotas 2,37 / 2,39 / 2,39 / 4,32 / 3,14 / 3,74 / 2,10 / 4,04 => 105,43 px por metro.
   Retângulos: [x1, y1, x2, y2] em px; origem no canto externo superior esquerdo (32, 48). */
window.PLANS = window.PLANS || {};
window.PLANS['sem-sacada'] = {
  id: 'sem-sacada',
  meta: { titulo: 'Apartamento sem sacada', area: '47,08', comodos: '40,54', img: 'planta-sem-sacada.jpg', imgSize: [871, 749] },
  extent: [852, 728],
  scale: 105.43,
  origin: [32, 48],
  H: 2.50,
  doorTop: 2.10,
  frame: 0.045,
  outline: [[32,48],[584,48],[584,80],[852,80],[852,508],[757,508],[757,728],[32,728]],
  walls: [
    { id: 'V1', r: [32, 48, 48, 728] },
    { id: 'H1', r: [48, 48, 567, 66], open: [ { a: 110, b: 237, kind: 'win', win: 'd1' }, { a: 378, b: 506, kind: 'win', win: 'd2' } ] },
    { id: 'V3', r: [567, 48, 584, 413] },
    { id: 'H2', r: [584, 80, 852, 98], open: [ { a: 630, b: 789, kind: 'win', win: 'estar' } ] },
    { id: 'V4', r: [836, 98, 852, 508] },
    { id: 'H5', r: [757, 491, 836, 508] },
    { id: 'V5', r: [741, 491, 757, 728], open: [ { a: 570, b: 634, kind: 'win', win: 'coz' } ] },
    { id: 'H6', r: [48, 712, 741, 728], open: [ { a: 330, b: 437, kind: 'door', door: 'entrada' } ] },
    { id: 'V2', r: [299, 66, 315, 712], open: [ { a: 420, b: 516, kind: 'door', door: 'd1' }, { a: 554, b: 650, kind: 'door', door: 'banho' } ] },
    { id: 'H3', r: [315, 397, 567, 413], open: [ { a: 330, b: 427, kind: 'door', door: 'd2' } ] },
    { id: 'H4', r: [48, 522, 299, 539] },
    { id: 'H7', r: [48, 678, 128, 692] },
    { id: 'V6', r: [128, 678, 142, 712] }
  ],
  shaft: [48, 692, 128, 712],
  windows: {
    d1:    { sill: 1.10, top: 2.10, type: 'persiana', inside: 1 },
    d2:    { sill: 1.10, top: 2.10, type: 'persiana', inside: 1 },
    estar: { sill: 0.90, top: 2.10, type: 'correr',   inside: 1 },
    coz:   { sill: 1.20, top: 2.10, type: 'maximar',  inside: -1 }
  },
  doors: {
    d1:      { hinge: 'b', swing: -1, leaf: 0.80 },
    banho:   { hinge: 'a', swing: -1, leaf: 0.80 },
    d2:      { hinge: 'a', swing: -1, leaf: 0.80, pivotOff: 12 },
    entrada: { hinge: 'a', swing: -1, leaf: 0.90 }
  },
  floors: [
    { r: [48, 66, 299, 522], m: 'lam' },
    { r: [315, 66, 567, 397], m: 'lam' },
    { r: [584, 98, 836, 491], m: 'lam' },
    { r: [315, 413, 584, 491], m: 'lam' },
    { r: [315, 491, 539, 712], m: 'lam' },
    { r: [299, 420, 315, 516], m: 'lam' },
    { r: [299, 554, 315, 650], m: 'lam' },
    { r: [330, 397, 427, 413], m: 'lam' },
    { r: [330, 712, 437, 728], m: 'lam' },
    { r: [539, 491, 741, 712], m: 'tileK' },
    { r: [48, 539, 299, 678], m: 'tileB' },
    { r: [142, 678, 299, 712], m: 'tileB' }
  ],
  finishes: [
    { dir: 'S', at: 539, from: 48,  to: 299, m: 'tileW' },
    { dir: 'E', at: 48,  from: 539, to: 678, m: 'tileW' },
    { dir: 'N', at: 678, from: 48,  to: 142, m: 'tileW' },
    { dir: 'E', at: 142, from: 678, to: 712, m: 'tileW' },
    { dir: 'N', at: 712, from: 142, to: 299, m: 'tileW' },
    { dir: 'W', at: 299, from: 539, to: 554, m: 'tileW' },
    { dir: 'W', at: 299, from: 650, to: 712, m: 'tileW' },
    { dir: 'W', at: 299, from: 554, to: 650, h0: 2.145, m: 'tileW' },
    { dir: 'N', at: 712, from: 539, to: 741, h1: 1.60, m: 'tileW' },
    { dir: 'W', at: 741, from: 491, to: 570, h1: 1.60, m: 'tileW' },
    { dir: 'W', at: 741, from: 570, to: 634, h1: 1.175, m: 'tileW' },
    { dir: 'W', at: 741, from: 634, to: 712, h1: 1.60, m: 'tileW' }
  ],
  rooms: [
    { id: 'd1',    name: 'Dormitório 1',       area: '10,24', dims: '2,37 × 4,32', label: [175, 385],
      view: { at: [262, 468], to: [110, 190] }, lights: [[173, 294]],
      rects: [[48, 66, 299, 522], [299, 420, 315, 516]] },
    { id: 'd2',    name: 'Dormitório 2',       area: '7,50',  dims: '2,39 × 3,14', label: [448, 312],
      view: { at: [372, 372], to: [470, 110] }, lights: [[441, 232]],
      rects: [[315, 66, 567, 397], [330, 397, 427, 413]] },
    { id: 'estar', name: 'Estar / Jantar',     area: '10,00', dims: '2,39 × 3,74', label: [735, 328],
      view: { at: [628, 462], to: [800, 160] }, lights: [[700, 215], [745, 428]],
      rects: [[584, 98, 836, 491], [440, 413, 584, 491]] },
    { id: 'coz',   name: 'Cozinha / Á. Serv.', area: '4,00',  dims: 'prof. 2,10',  label: [642, 605],
      view: { at: [585, 612], to: [730, 520] }, lights: [[640, 600]],
      rects: [[539, 491, 741, 712]] },
    { id: 'banho', name: 'Banho',              area: '3,53',  dims: '2,36 × 1,61', label: [215, 600],
      view: { at: [282, 602], to: [80, 632] }, lights: [[220, 605]],
      rects: [[48, 539, 299, 712], [299, 554, 315, 650]] },
    { id: 'circ',  name: 'Circulação',         area: '5,27',  dims: '',            label: [432, 600],
      view: { at: [385, 688], to: [440, 430] }, lights: [[430, 560]],
      rects: [[315, 413, 440, 491], [315, 491, 539, 712], [330, 712, 437, 728]] }
  ],
  // parede de destaque amarela na sala, atrás da mesa de jantar (como na planta decorada)
  accentWalls: [{ dir: 'W', at: 836, from: 282, to: 491, m: 'accentYellow' }],
  switches: { d1: [299, 406, 'W'], d2: [438, 397, 'N'], banho: [315, 662, 'E'], circ: [449, 712, 'N'], estar: [584, 400, 'E'], coz: [741, 558, 'W'] },
  shaftRooms: { d1: [48, 66, 299, 522], d2: [315, 66, 567, 397], estar: [584, 98, 836, 491] },
  // zonas de luz: 0 dorm.1, 1 vão d1, 2 dorm.2, 3 vão d2, 4 banho, 5 vão banho, 6–9 sala/cozinha/circulação
  zoneRects: [[33.6, 49.6, 302, 525], [296, 417, 318, 519], [312, 49.6, 570, 400], [327, 394, 430, 416], [33.6, 536, 302, 726.4], [296, 551, 318, 653],
    [312, 410, 587, 494], [581, 81.6, 850.4, 494], [754, 491, 850.4, 506.4], [312, 488, 755.4, 726.4]],
  // janelas vistas de fora nos andares de baixo: [id, a, b, face externa, lado]
  facadeWins: [['d1', 110, 237, 48, 'N'], ['d2', 378, 506, 48, 'N'], ['estar', 630, 789, 80, 'N'], ['coz', 570, 634, 757, 'E']],
  poses: {
    cama1: { kind: 'lie', label: 'Deitar na cama', at: [100, 206], y: 0.80, yaw: 90, pitch: 0.24, stand: [180, 336] },
    cama2: { kind: 'lie', label: 'Deitar na cama', at: [361, 100], y: 0.76, yaw: 0, pitch: 0.24, stand: [443, 270] },
    cama3: { kind: 'lie', label: 'Deitar na cama', at: [523, 100], y: 0.76, yaw: 0, pitch: 0.24, stand: [443, 270] },
    sofa: { kind: 'sit', label: 'Sentar no sofá', at: [655, 212], y: 1.12, yaw: 90, pitch: 0.05, stand: [742, 212] }
  },
  toilet: { c: [186.5, 664], tank: [167, 689, 207, 712], btn: [187, 700] },
  console: { xf: 808, xb: 831, padX: 815 }
};
