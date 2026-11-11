/*
 * Interface do site: painel de andares e apartamentos, ficha do apto, visita 3D, seções e mensagem de interesse.
 * Conversa com o prédio 3D (js/predio3d.js) e lê os dados de js/dados.js.
 */
(function () {
  'use strict';
  const DATA = window.MILAO;
  const FH = DATA.peDireitoAndar;
  const $ = function (id) { return document.getElementById(id); };
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = function (v, d) { return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- regras do prédio ---------- */
  const STATUS_TXT = { livre: 'Disponível', reservado: 'Reservado', vendido: 'Vendido' };
  function typeOf(pos) { return DATA.tipos['com-sacada'].posicoes.indexOf(pos) >= 0 ? 'com-sacada' : 'sem-sacada'; }
  // disponibilidade ilustrativa, sempre a mesma para cada apto (andares baixos vendem antes)
  function statusOf(torre, andar, pos) {
    let h = Math.imul((torre.charCodeAt(0) * 2654435761) ^ (andar * 40503) ^ (pos * 9973), 2246822519);
    h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
    const r = (h >>> 0) / 4294967296, sold = 0.66 - andar * 0.028;
    return r < sold ? 'vendido' : r < sold + 0.12 ? 'reservado' : 'livre';
  }
  function info(torre, andar, pos) {
    const tipo = typeOf(pos), T = DATA.tipos[tipo];
    return { torre: torre, andar: andar, pos: pos, num: andar * 100 + pos, tipo: tipo, T: T, status: statusOf(torre, andar, pos), front: pos <= 6, altura: andar * FH };
  }
  function matches(pos) { return state.filtro === 'todos' || typeOf(pos) === state.filtro; }

  const state = { torre: 'A', andar: 0, pos: 0, filtro: 'todos', escolhido: null };
  let predio = null;

  /* ---------- tema e cores ---------- */
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function tokens() {
    const cs = getComputedStyle(document.documentElement), v = function (n) { return cs.getPropertyValue(n).trim(); };
    return { gold: v('--gold') || '#D3A02B', navy: v('--navy') || '#1F2E86', livre: v('--livre') || '#1E8A62', reservado: v('--reservado') || '#C9821A', vendido: v('--vendido') || '#A9AEBB' };
  }
  function onTheme() {
    if (predio) { predio.setColors(tokens()); predio.setNight(isDark()); }
    if (apto && apto.engine) apto.engine.setNight(isDark());
  }
  if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); (mq.addEventListener ? mq.addEventListener('change', onTheme) : mq.addListener(onTheme)); }
  new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- painel: andares ---------- */
  const lista = $('listaAndares');
  function renderAndares() {
    $('tituloTorre').textContent = 'Torre ' + state.torre;
    let total = 0, html = '';
    for (let a = DATA.andares; a >= 1; a--) {
      let livres = 0, cells = '';
      for (let p = 1; p <= DATA.aptosPorAndar; p++) {
        const st = statusOf(state.torre, a, p), ok = matches(p);
        if (st === 'livre' && ok) livres++;
        cells += '<i class="is-' + st + (ok ? '' : ' is-dim') + (typeOf(p) === 'com-sacada' ? ' is-sac' : '') + '"></i>';
      }
      total += livres;
      html += '<li><button type="button" class="floor-btn" data-andar="' + a + '" aria-label="' + a + 'º andar, ' + livres + ' disponíveis">' +
        '<span class="floor-n">' + a + 'º</span><span class="cells" aria-hidden="true">' + cells + '</span>' +
        '<span class="floor-free' + (livres ? '' : ' is-zero') + '">' + livres + (livres === 1 ? ' livre' : ' livres') + '</span></button></li>';
    }
    lista.innerHTML = html;
    $('livresTorre').textContent = total;
  }
  lista.addEventListener('click', function (ev) {
    const b = ev.target.closest('.floor-btn'); if (b) abrirAndar(parseInt(b.dataset.andar, 10));
  });

  function setTorre(t) {
    if (apto) sairApto();                 // trocar de torre durante a visita: sai do apto antes
    state.torre = t;
    $('torreA').setAttribute('aria-pressed', t === 'A'); $('torreB').setAttribute('aria-pressed', t === 'B');
    renderAndares();
    if (state.andar) abrirAndar(state.andar);
  }
  $('torreA').addEventListener('click', function () { setTorre('A'); });
  $('torreB').addEventListener('click', function () { setTorre('B'); });
  $('filtroTipo').addEventListener('change', function (ev) {
    if (apto) sairApto();
    state.filtro = ev.target.value;
    renderAndares();
    if (state.andar) renderPlanta();
    if (predio) predio.setFilter(state.filtro);
  });

  /* ---------- andar aberto ---------- */
  function abrirAndar(andar, fromScene) {
    if (apto) sairApto();
    state.andar = andar; state.pos = 0;
    $('viewAndares').hidden = true; $('viewAndar').hidden = false;
    $('andarTitulo').textContent = andar + 'º andar';
    $('andarSub').textContent = 'Torre ' + state.torre + ' · piso a ' + num(andar * FH, 1) + ' m do chão';
    renderPlanta();
    renderUnidade();
    if (predio) predio.selectFloor(state.torre, andar, true);
    if (!fromScene && window.innerWidth <= 980) $('canvasBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function fecharAndar() {
    state.andar = 0; state.pos = 0;
    $('viewAndar').hidden = true; $('viewAndares').hidden = false;
    if (predio) predio.clearFloor();
  }
  $('btnVoltar').addEventListener('click', fecharAndar);
  $('btnHome').addEventListener('click', function () { if (apto) return; if (state.andar) fecharAndar(); else if (predio) predio.home(); });

  // planta do andar em SVG: frente (entrada) embaixo, fundos em cima; 10 px por metro.
  // Cada apartamento mostra a planta oficial (com ou sem sacada) virada como no prédio:
  // disponível fica clara, reservado amarelado e vendido apagado.
  const miniaturas = {};
  ['sem-sacada', 'com-sacada'].forEach(function (tipo) {
    Predio3D.planCanvas(tipo, function (c) {
      if (!c) return;
      try {
        const m = document.createElement('canvas'); m.width = Math.round(c.width / 2); m.height = Math.round(c.height / 2);
        m.getContext('2d').drawImage(c, 0, 0, m.width, m.height);
        miniaturas[tipo] = m.toDataURL('image/png');
      } catch (e) { return; }
      if (state.andar) renderPlanta();
    });
  });
  function renderPlanta() {
    const S = 10, HLm = Predio3D.L / 2, Z0 = Predio3D.Z_MIN, X = function (x) { return (x + HLm) * S; }, Y = function (z) { return (z - Z0) * S; };
    const R = Predio3D.unitRect, W = Predio3D.L * S, H = (Predio3D.Z_MAX - Z0) * S;
    $('planta').setAttribute('viewBox', '-10 -26 ' + (W + 20) + ' ' + (H + 58));
    let svg = '';
    Predio3D.PARTS.forEach(function (pt) {                 // as duas alas desencontradas e o núcleo entre elas
      svg += '<rect class="pl-slab" x="' + X(pt.x0) + '" y="' + Y(pt.z0) + '" width="' + (pt.x1 - pt.x0) * S + '" height="' + (pt.z1 - pt.z0) * S + '" rx="3"/>';
    });
    Predio3D.SHAFTS.forEach(function (c) {
      svg += '<rect class="pl-core" x="' + X(c[0]) + '" y="' + Y(c[1]) + '" width="' + (c[2] - c[0]) * S + '" height="' + (c[3] - c[1]) * S + '" rx="2"/>';
    });
    svg += '<text class="pl-txt" x="' + W / 2 + '" y="-12" text-anchor="middle">Fundos</text>';
    svg += '<text class="pl-txt" x="' + W / 2 + '" y="' + (H + 26) + '" text-anchor="middle">Frente · entrada</text>';
    for (let p = 1; p <= 12; p++) {
      const r = R(p), u = info(state.torre, state.andar, p), dim = !matches(p), pose = Predio3D.planPose(p);
      const x = X(r.x0) + 1, w = (r.x1 - r.x0) * S - 2, y = Y(r.z0) + 1, h = (r.z1 - r.z0) * S - 2;
      const cx = x + w / 2, cy = y + h / 2;
      const tf = pose.front ? (pose.mirror ? 'matrix(1,0,0,-1,0,' + 2 * cy + ')' : 'matrix(-1,0,0,-1,' + 2 * cx + ',' + 2 * cy + ')')
        : (pose.mirror ? 'matrix(-1,0,0,1,' + 2 * cx + ',0)' : '');
      const img = miniaturas[u.tipo] ? '<image href="' + miniaturas[u.tipo] + '" x="' + (x + 1.5) + '" y="' + (y + 1.5) + '" width="' + (w - 3) + '" height="' + (h - 3) + '" preserveAspectRatio="none"' + (tf ? ' transform="' + tf + '"' : '') + '/>' : '';
      const ny = pose.front ? y + h - 15 : y + 3, nw = 36;
      svg += '<g class="pl-u is-' + u.status + (dim ? ' is-dim' : '') + (p === state.pos ? ' is-on' : '') + '" data-pos="' + p + '" tabindex="0" role="button" aria-label="Apartamento ' + u.num + ', ' + u.T.nome.toLowerCase() + ', ' + STATUS_TXT[u.status].toLowerCase() + '">' +
        '<rect class="pl-base" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3"/>' + img +
        '<rect class="pl-tint" x="' + (x + 1.5) + '" y="' + (y + 1.5) + '" width="' + (w - 3) + '" height="' + (h - 3) + '"/>' +
        '<rect class="pl-frame" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3"/>' +
        '<rect class="pl-tag" x="' + (cx - nw / 2) + '" y="' + ny + '" width="' + nw + '" height="13" rx="3"/>' +
        '<text x="' + cx + '" y="' + (ny + 10) + '" text-anchor="middle">' + u.num + '</text></g>';
    }
    $('planta').innerHTML = svg;
  }
  $('planta').addEventListener('click', function (ev) { const g = ev.target.closest('.pl-u'); if (g) escolher(parseInt(g.dataset.pos, 10)); });
  $('planta').addEventListener('dblclick', function (ev) {          // dois cliques na planta: entra no apto
    const g = ev.target.closest('.pl-u'); if (!g) return;
    const p = parseInt(g.dataset.pos, 10); escolher(p); entrarApto(info(state.torre, state.andar, p));
  });
  $('planta').addEventListener('keydown', function (ev) {
    const g = ev.target.closest && ev.target.closest('.pl-u');
    if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); escolher(parseInt(g.dataset.pos, 10)); }
  });

  /* ---------- ficha do apartamento ---------- */
  function escolher(pos) {
    if (!state.andar) return;
    state.pos = pos;
    state.escolhido = info(state.torre, state.andar, pos);
    document.querySelectorAll('#planta .pl-u').forEach(function (g) { g.classList.toggle('is-on', parseInt(g.dataset.pos, 10) === pos); });
    if (predio) predio.selectUnit(pos);
    renderUnidade();
    atualizarMensagem(true);
  }
  function roomsHTML(T) {
    const max = 10.29;
    return '<ul class="rooms">' + T.comodos.map(function (c) {
      return '<li><span>' + esc(c[0]) + '</span><span class="bar"><i style="width:' + (c[1] / max * 100).toFixed(1) + '%"></i></span><span class="m2">' + num(c[1], 2) + ' m²</span></li>';
    }).join('') + '</ul>';
  }
  function renderUnidade() {
    const box = $('unidade');
    if (!state.pos) { box.innerHTML = '<p class="unit-empty">Toque num apartamento na planta ou no prédio.</p>'; return; }
    const u = info(state.torre, state.andar, state.pos), T = u.T;
    const pode = u.status !== 'vendido';
    box.innerHTML =
      '<div class="unit-top"><p class="unit-num">' + u.num + '<small>Torre ' + u.torre + '</small></p><span class="badge is-' + u.status + '">' + STATUS_TXT[u.status] + '</span></div>' +
      '<dl class="facts">' +
        '<div><dt>Planta</dt><dd>' + T.nome + '</dd></div>' +
        '<div><dt>Área privativa</dt><dd>' + num(T.area, 2) + ' m²</dd></div>' +
        '<div><dt>Posição</dt><dd>' + (T.posicoes.length === 4 ? 'Canto' : 'Meio') + ', ' + (u.front ? 'frente' : 'fundos') + '</dd></div>' +
        '<div><dt>A partir de</dt><dd>' + brl.format(T.preco) + '</dd></div>' +
      '</dl>' +
      roomsHTML(T) +
      '<div class="unit-actions">' +
        '<button class="btn btn-ink" type="button" id="btnTour">Ver por dentro em 3D</button>' +
        '<button class="btn btn-gold" type="button" id="btnInteresse"' + (pode ? '' : ' disabled') + '>' + (u.status === 'reservado' ? 'Entrar na fila' : 'Tenho interesse') + '</button>' +
      '</div>' +
      '<p class="unit-note">A câmera entra no apto no lugar dele no bloco, a ' + num(u.altura, 1) + ' m do chão. Dois cliques no apê fazem o mesmo; pela porta de entrada você sai no corredor.</p>' +
      (pode ? '' : '<p class="unit-note">Este apartamento já foi vendido. Os disponíveis aparecem em verde.</p>');
    const bt = $('btnTour'); if (bt) bt.addEventListener('click', function () { entrarApto(u); });
    const bi = $('btnInteresse'); if (bi) bi.addEventListener('click', function () { atualizarMensagem(true); $('interesse').scrollIntoView({ behavior: 'smooth' }); $('msgNome').focus({ preventScroll: true }); });
  }

  /* ---------- visita ao apartamento: a maquete abre no lugar do apto, dentro da cena do prédio ----------
     Dois cliques no apto (no prédio, no número ou na planta) ou "Ver por dentro em 3D": a maquete completa substitui a miniatura,
     a câmera sai de onde está e voa até o apartamento. A maquete desenha o prédio junto (mesma câmera), deixa sair pela porta
     para o corredor do andar e, ao voltar, a câmera do prédio continua de onde a visita parou. O painel controla a maquete direto. */
  const explorer = $('explorar');
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let apto = null;
  const VIEW_CMD = { '3d': 'v3d', top: 'vTop', walk: 'vVisit', free: 'vFree' };
  function mostrarView(id) { ['viewAndares', 'viewAndar', 'viewApto'].forEach(function (v) { $(v).hidden = v !== id; }); }
  function hudDom() {
    const d = { app: $('aptHud'), stage: $('canvasBox'), labels: $('aptLabels'), crosshair: $('aptCross'), visitBar: $('aptVisit'), hudMode: $('aptMode'),
      visitName: $('aptRoom'), standBtn: $('aptStand'), exitVisit: $('aptExitVisit'), hint: $('aptHint'), touch: $('aptTouch'), joy: $('aptJoy'),
      knob: $('aptKnob'), updown: $('aptUpdown'), btnUp: $('aptUp'), btnDown: $('aptDown'), tip: $('aptTip') };
    document.querySelectorAll('#viewApto [data-cmd]').forEach(function (b) { d[b.dataset.cmd] = b; });   // os botões do painel são os da maquete
    return d;
  }
  function avisoEntrada(txt) { $('aptEnteringTxt').textContent = txt || ''; $('aptEntering').hidden = !txt; }
  function entrarApto(u) {
    if (apto || !u) return;
    if (!predio || !window.AptEngine) { avisoEntrada(''); return; }
    if (state.andar !== u.andar || state.torre !== u.torre) return;
    if (state.pos !== u.pos) escolher(u.pos);
    const T = u.T;
    apto = { u: u, engine: null, pronto: false };
    $('aptoTitulo').textContent = 'Apto ' + u.num;
    $('aptoSub').textContent = 'Torre ' + u.torre + ' · ' + u.andar + 'º andar · ' + T.nome + ' · ' + num(T.area, 2) + ' m²';
    $('voltarRotulo').textContent = u.andar + 'º andar';
    $('aptoTotal').textContent = '—';
    $('aptoComodos').innerHTML = '<li class="unit-empty">Carregando os cômodos…</li>';
    mostrarView('viewApto');
    explorer.classList.add('is-apto');
    avisoEntrada('Entrando no apto ' + u.num + '…');
    if (window.innerWidth <= 980) $('canvasBox').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    // um quadro para o aviso aparecer antes de montar a maquete (leva um instante)
    requestAnimationFrame(function () {
      setTimeout(function () {
        if (!apto || apto.u !== u) return;
        let lugar = null;
        try {
          lugar = predio.enterUnit(u.pos);
          if (!lugar) throw new Error('andar fechado');
          lugar.renderWorld = predio.renderWith;
          lugar.onView = function (v, forro, nivel, andar) { predio.setAptView(v, forro, nivel, andar); };
          $('aptHud').hidden = false;
          $('aptRes').hidden = !lugar.reservado;
          apto.temElevador = !!(lugar.elevator && lugar.ground);
          apto.lazer = lugar.ground && lugar.ground.spots ? lugar.ground.spots : [];
          apto.engine = window.AptEngine.create({
            tipo: u.tipo, andar: u.andar, apto: u.num, torre: u.torre, base: 'apartamento/',
            integrated: lugar, renderer: predio.renderer, canvas: predio.canvas, dom: hudDom(), onMessage: mensagemApto
          });
        } catch (e) {
          console.error(e);
          $('aptHud').hidden = true;
          if (lugar) predio.exitUnit(null);
          apto = null;
          explorer.classList.remove('is-apto');
          mostrarView(state.andar ? 'viewAndar' : 'viewAndares');
          avisoEntrada('A visita não abriu neste navegador.');
          setTimeout(function () { avisoEntrada(''); }, 4000);
        }
      }, 30);
    });
  }
  function sairApto() {
    if (!apto) return;
    const a = apto; apto = null;
    let cam = null;
    if (a.engine) {
      try { cam = a.engine.worldCamera(); } catch (e) { cam = null; }
      try { a.engine.dispose(); } catch (e) { console.error(e); }
    }
    $('aptHud').hidden = true; avisoEntrada('');
    $('aptLift').hidden = true; $('aptCab').hidden = true;
    explorer.classList.remove('is-apto');
    if (predio) predio.exitUnit(cam);
    if (state.andar) { mostrarView('viewAndar'); if (state.pos && predio) predio.selectUnit(state.pos); } else mostrarView('viewAndares');
  }
  $('btnSairApto').addEventListener('click', sairApto);
  $('aptoComodos').addEventListener('click', function (ev) {
    const b = ev.target.closest('[data-room]'); if (!b || !apto || !apto.engine) return;
    if (b.dataset.room === 'terreo' || b.dataset.room.indexOf('terreo:') === 0) { apto.engine.teleport(b.dataset.room); return; }
    if (b.dataset.room === 'elevador') { apto.engine.teleport('hall'); return; }
    apto.engine.room(b.dataset.room);
  });
  /* ---------- elevador: no hall, chamar (a porta abre quando a cabine chega); dentro, o painel com T e 1 a 12 ----------
     O mesmo que os botões de verdade (no 3D, com a mira ou o toque): a visita cuida da cabine, das portas e da viagem. */
  const nomeAndar = function (n) { return n ? n + 'º andar' : 'térreo'; };
  function teclasCabine(d) {
    const box = $('aptCabKeys');
    if (box.dataset.n === String(d.floors) + '|' + d.apt) return;
    box.dataset.n = String(d.floors) + '|' + d.apt;
    // posição de cada botão em duas colunas (computador) e em quatro (celular), sempre de baixo para cima, T embaixo
    const linhas2 = Math.ceil(d.floors / 2), linhas4 = Math.ceil(d.floors / 4);
    let h = '';
    for (let k = d.floors; k >= 1; k--) {
      const st = '--r2:' + (linhas2 - Math.floor((k - 1) / 2)) + ';--c2:' + ((k - 1) % 2 + 1) + ';--r4:' + (linhas4 - Math.floor((k - 1) / 4)) + ';--c4:' + ((k - 1) % 4 + 1);
      h += '<button type="button" data-lift="' + k + '" style="' + st + '"' + (k === d.apt ? ' class="is-apt" title="Andar do seu apto"' : '') + ' aria-label="' + nomeAndar(k) + (k === d.apt ? ' (seu apto)' : '') + '">' + k + '</button>';
    }
    h += '<button type="button" class="is-t" data-lift="0" style="--r2:' + (linhas2 + 1) + ';--r4:' + (linhas4 + 1) + '" aria-label="Térreo">T</button>';
    box.innerHTML = h;
  }
  function painelElevador(d) {
    if (!apto) return;
    apto.lift = d;
    const hall = d.spot === 'hall' || d.spot === 'lobby', cab = d.spot === 'cab';
    const seta = d.dir > 0 ? '▲' : d.dir < 0 ? '▼' : '';
    $('aptLift').hidden = !hall; $('aptCab').hidden = !cab;
    if (hall) {
      $('aptLiftArrow').textContent = seta; $('aptLiftFloor').textContent = d.shown;
      $('aptLiftBtn').classList.toggle('is-on', !!d.call || d.phase === 'coming');
      $('aptLiftTxt').textContent = d.phase === 'coming' ? 'Elevador a caminho' : d.here && (d.phase === 'opening' || d.phase === 'open') ? 'Porta aberta · entre no elevador'
        : d.here && d.phase === 'closing' ? 'Porta fechando' : '';
    }
    if (cab) {
      teclasCabine(d);
      $('aptCabArrow').textContent = seta; $('aptCabFloor').textContent = d.shown;
      $('aptCabTxt').textContent = d.phase === 'moving' ? (d.dir > 0 ? 'Subindo' : 'Descendo') + (d.sel !== null && d.sel !== undefined ? ' · ' + nomeAndar(d.sel) : '')
        : d.phase === 'closing' ? 'Porta fechando' : d.phase === 'opening' || d.phase === 'open' ? 'Torre ' + d.tower + ' · escolha o andar' : 'Escolha o andar';
      document.querySelectorAll('#aptCabKeys [data-lift]').forEach(function (b) { b.setAttribute('aria-pressed', String(d.sel !== null && d.sel !== undefined && +b.dataset.lift === d.sel)); });
    }
  }
  $('aptLiftBtn').addEventListener('click', function () { if (apto && apto.engine) apto.engine.lift('call'); });
  $('aptCab').addEventListener('click', function (ev) {
    const b = ev.target.closest('[data-lift]'); if (!b || !apto || !apto.engine) return;
    const v = b.dataset.lift;
    apto.engine.lift(v === 'open' || v === 'close' ? v : Number(v));
  });
  $('btnTelaCheia').addEventListener('click', function () {
    const alvo = $('canvasBox');
    try {
      const req = alvo.requestFullscreen || alvo.webkitRequestFullscreen;
      if (req) { const r = req.call(alvo); if (r && r.catch) r.catch(function () { $('btnTelaCheia').textContent = 'Tela cheia indisponível aqui'; }); }
      else $('btnTelaCheia').textContent = 'Tela cheia indisponível aqui';
    } catch (e) { $('btnTelaCheia').textContent = 'Tela cheia indisponível aqui'; }
  });
  $('btnInteresseApto').addEventListener('click', function () {
    if (apto && apto.u) { state.escolhido = apto.u; atualizarMensagem(true); }
    $('interesse').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); $('msgNome').focus({ preventScroll: true });
  });
  // avisos da maquete: pronta (lista de cômodos), estado da visita (vista, opções, cômodo atual) e erro
  function mensagemApto(d) {
    if (!apto || !d) return;
    if (d.type === 'apt:ready') {
      apto.pronto = true;
      avisoEntrada('');
      $('aptoTotal').textContent = d.comodos + ' m²';
      const lista = d.rooms.concat(apto.temElevador ? [{ id: 'elevador', name: 'Hall do elevador', area: '', dims: '', nota: 'chamar e descer' }, { id: 'terreo', name: 'Térreo do condomínio', area: '', dims: '', nota: 'ir direto' }]
        .concat((apto.lazer || []).map(function (s) { return { id: 'terreo:' + s.id, name: s.name, area: '', dims: '', nota: 'lazer · ir direto', sub: true }; })) : []);
      $('aptoComodos').innerHTML = lista.map(function (r) {
        return '<li><button type="button" class="room-btn' + (r.id === 'corredor' || r.id.indexOf('terreo') === 0 || r.id === 'elevador' ? ' is-corr' : '') + (r.sub ? ' is-sub' : '') + '" data-room="' + esc(r.id) + '"><span class="rn">' + esc(r.name) + '</span>' +
          (r.area ? '<span class="ra">' + esc(r.area) + ' m²</span>' : '<span class="ra">' + (r.nota || 'fora do apto') + '</span>') +
          (r.dims ? '<span class="rd">' + esc(r.dims) + ' m</span>' : '') + '</button></li>';
      }).join('');
    } else if (d.type === 'apt:state') {
      document.querySelectorAll('#viewApto .seg-btn').forEach(function (b) { b.setAttribute('aria-pressed', String(VIEW_CMD[d.view] === b.dataset.cmd)); });
      document.querySelectorAll('#viewApto .tgl').forEach(function (b) { b.disabled = !!d.imm && (b.dataset.cmd === 'tRotate' || b.dataset.cmd === 'tWalls'); });
      apto.nivel = d.level || 'apt';
      const terreo = apto.nivel === 'ground', u = apto.u;
      document.querySelectorAll('#aptoComodos .room-btn').forEach(function (b) {
        const lz = terreo && (apto.lazer || []).some(function (s) { return s.id === d.room; });
        b.setAttribute('aria-current', String(!!d.imm && (terreo ? b.dataset.room === (lz ? 'terreo:' + d.room : 'terreo') : d.room === 'elevador' ? b.dataset.room === 'elevador' : d.room === b.dataset.room)));
      });
      $('aptoDica').textContent = d.room === 'elevador'
        ? 'Você está no elevador. Aperte o andar no painel (T é o térreo; o seu apto fica no ' + u.andar + 'º): a porta fecha, a cabine anda e abre no andar escolhido.'
        : terreo
          ? 'Você está no térreo do condomínio. Dá para usar quase tudo: no salão de festas (a porta de vidro abre sozinha), acender as luzes, ligar a TV, a churrasqueira e a torneira, abrir a geladeira e sentar; nos quiosques, acender as churrasqueiras; na pracinha, andar de balanço, descer o escorregador, brincar na gangorra, no gira-gira e no cavalinho; na piscina, deitar na espreguiçadeira, abrir e fechar o guarda-sol, ligar a ducha e entrar na água; no espaço pet, abrir a torneira do pet care; na portaria, abrir os portões. Para subir, entre no hall da Torre ' + u.torre + ', chame o elevador e escolha o ' + u.andar + 'º andar.'
          : apto.nivel === 'floor'
            ? 'Este é outro andar: as portas dos vizinhos ficam fechadas. Volte ao elevador, chame e escolha o ' + u.andar + 'º andar para voltar ao apto.'
            : d.imm
              ? 'Clique nas portas, luzes e interruptores, janelas e persianas, TVs, torneiras, chuveiro, fogão, privada, camas e sofá. A porta de entrada dá para o corredor; no hall, aperte o botão do elevador, entre e escolha o andar.'
              : 'Toque num cômodo para entrar nele, em Visitar para andar pelo apartamento ou em Voar para ver o prédio em volta.';
      if (!d.imm) { $('aptLift').hidden = true; $('aptCab').hidden = true; }
    } else if (d.type === 'apt:lift') {
      painelElevador(d);
    } else if (d.type === 'apt:error') {
      avisoEntrada('A maquete não abriu neste navegador. Ela precisa de WebGL.');
    }
  }

  /* ---------- seções ---------- */
  (function renderSecoes() {
    const cards = ['sem-sacada', 'com-sacada'].map(function (k) {
      const T = DATA.tipos[k];
      return '<article class="plan">' +
        '<div class="plan-top"><h3>' + T.nome + '</h3><p class="plan-area">' + num(T.area, 2) + ' <small>m²</small></p></div>' +
        '<p class="plan-sub">' + T.planta + ' · ' + T.posicoes.length + ' por andar · 2 dormitórios</p>' +
        roomsHTML(T) +
        '<div class="plan-price"><p>A partir de<strong>' + brl.format(T.preco) + '</strong></p>' +
        '<button class="btn btn-line" type="button" data-tour="' + k + '">Ver por dentro em 3D</button>' +
        '</div></article>';
    });
    $('cartoesPlantas').innerHTML = cards.join('');
    $('cartoesPlantas').addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-tour]'); if (!b) return;
      $('explorar').scrollIntoView({ behavior: 'smooth', block: 'start' });
      visitarExemplo(b.dataset.tour);
    });
    $('acabamentos').innerHTML = DATA.acabamentos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('');

    const ICON = {
      festas: '<path d="M8 3h8l-1 7a3 3 0 0 1-6 0L8 3zM12 13v6M8 21h8"/>',
      quiosque: '<path d="M3 10 12 4l9 6M5 10v10M19 10v10M8 14h8M9.5 14l1 6M14.5 14l-1 6"/>',
      piscina: '<path d="M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2-1.5 4.5-1.5S19 17 21 17M3 21c2 0 2-1.5 4.5-1.5S10 21 12 21s2-1.5 4.5-1.5S19 21 21 21M8 14V5.5a2 2 0 0 1 4 0M14 14V5.5a2 2 0 0 1 4 0M8 8.5h6M8 11.5h6"/>',
      playground: '<path d="M4 20V8h4v12M4 12h4M8 8l9 10h3M4 8l2-3 2 3"/>',
      pet: '<circle cx="6.5" cy="10" r="1.6"/><circle cx="10" cy="6.3" r="1.6"/><circle cx="14" cy="6.3" r="1.6"/><circle cx="17.5" cy="10" r="1.6"/><path d="M12 11.2c-2.6 0-5 3.2-5 5.6 0 1.6 1.3 2.4 2.6 2.4 1 0 1.6-.6 2.4-.6s1.4.6 2.4.6c1.3 0 2.6-.8 2.6-2.4 0-2.4-2.4-5.6-5-5.6z"/>',
      bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l2 7M14 6h3"/>',
      portaria: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4"/>',
      elevador: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9.5 10 12 7.5l2.5 2.5M9.5 14 12 16.5l2.5-2.5"/>'
    };
    $('listaLazer').innerHTML = DATA.lazer.map(function (l) {
      return '<li><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[l[0]] + '</svg><b>' + esc(l[1]) + '</b><span>' + esc(l[2]) + '</span></li>';
    }).join('');
    $('vagas').textContent = 'Estacionamento: ' + DATA.vagas + '.';

    const F = DATA.financiamento;
    const termos = [
      ['Financiamento', F.financiamento], ['Parcelas a partir de', brl.format(F.parcelaMinima).replace(',00', '')],
      ['Renda familiar a partir de', brl.format(F.rendaMinima).replace(',00', '')], ['Entrada', F.entrada.replace('em até ', 'até ').replace(' vezes', 'x')],
      ['Sem sacada a partir de', brl.format(DATA.tipos['sem-sacada'].preco)], ['Com sacada a partir de', brl.format(DATA.tipos['com-sacada'].preco)]
    ];
    $('condicoesLista').innerHTML = termos.map(function (t) { return '<div><dt>' + t[0] + '</dt><dd>' + t[1] + '</dd></div>'; }).join('');
    $('obraStatus').textContent = DATA.obra.status;
    $('obraEntrega').textContent = DATA.obra.entrega;
    $('obraLinha').innerHTML =
      '<li><b>' + DATA.obra.inicioContrato + '</b>Início da vigência do contrato</li>' +
      '<li><b>36 meses</b>Prazo de obra, contado do desembolso da Caixa</li>' +
      '<li><b>' + DATA.obra.entrega + '</b>Entrega prevista das chaves</li>';

    $('endereco').textContent = DATA.endereco;
    $('bairro').textContent = DATA.bairro + ' · ' + DATA.cidade;
    $('linkMapa').href = DATA.mapa;
    $('perto').innerHTML = DATA.referencias.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');
    $('incorp').textContent = DATA.incorporacao;
  })();

  // "Ver por dentro" de um tipo de planta: um apto disponível desse tipo, perto do 8º andar, na torre escolhida
  function visitarExemplo(tipo) {
    if (apto) sairApto();
    const T = DATA.tipos[tipo]; let alvo = null;
    for (let d = 0; d < DATA.andares && !alvo; d++) {
      [8 + d, 8 - d].forEach(function (a) {
        if (alvo || a < 1 || a > DATA.andares) return;
        T.posicoes.forEach(function (p) { if (!alvo && statusOf(state.torre, a, p) === 'livre') alvo = { a: a, p: p }; });
      });
    }
    if (!alvo) alvo = { a: 8, p: T.posicoes[0] };
    if (state.andar !== alvo.a) abrirAndar(alvo.a, true);
    escolher(alvo.p);
    setTimeout(function () { entrarApto(info(state.torre, alvo.a, alvo.p)); }, reduce ? 0 : 1200);
  }

  /* ---------- mensagem de interesse ---------- */
  let editada = false;
  function textoPadrao() {
    const nome = $('msgNome').value.trim(), u = state.escolhido;
    const ola = 'Olá!' + (nome ? ' Meu nome é ' + nome + '.' : '');
    if (!u) return ola + ' Tenho interesse no Residencial Milão, em São Leopoldo. Pode me passar os apartamentos disponíveis e as condições?';
    return ola + ' Tenho interesse no apartamento ' + u.num + ' da Torre ' + u.torre + ' do Residencial Milão (' + u.T.nome.toLowerCase() + ', ' + num(u.T.area, 2) + ' m², ' + u.andar + 'º andar). Ele ainda está disponível? Pode me passar as condições?';
  }
  function atualizarMensagem(forcar) {
    const u = state.escolhido;
    $('msgUnidade').textContent = u ? 'Apto ' + u.num + ' · Torre ' + u.torre + ' · ' + u.andar + 'º andar · ' + u.T.nome + ' · ' + STATUS_TXT[u.status] : 'Nenhum apartamento escolhido ainda.';
    if (forcar || !editada) { $('msgTexto').value = textoPadrao(); editada = false; }
  }
  $('msgTexto').addEventListener('input', function () { editada = true; });
  $('msgNome').addEventListener('input', function () { atualizarMensagem(false); });
  $('formMsg').addEventListener('submit', function (ev) {
    ev.preventDefault();
    const t = $('msgTexto'), done = $('msgFeito');
    const fallback = function () { t.focus(); t.select(); done.textContent = 'Texto selecionado. Use Ctrl+C ou Copiar do seu aparelho.'; };
    try {
      navigator.clipboard.writeText(t.value).then(function () { done.textContent = 'Mensagem copiada.'; }, fallback);
    } catch (e) { fallback(); }
  });
  atualizarMensagem(true);

  /* ---------- dica e tooltip sobre o 3D ---------- */
  const tip = $('tip'), box = $('canvasBox');
  function showTip(inf, cx, cy) {
    document.querySelectorAll('.floor-btn.is-hover').forEach(function (b) { b.classList.remove('is-hover'); });
    if (!inf) { tip.hidden = true; return; }
    let html;
    if (inf.unit) {
      const u = info(inf.torre, inf.andar, inf.unit);
      html = '<b>Apto ' + u.num + '</b><small>' + u.T.nome + ' · ' + STATUS_TXT[u.status] + '</small>';
    } else {
      let livres = 0; for (let p = 1; p <= 12; p++) if (statusOf(inf.torre, inf.andar, p) === 'livre' && matches(p)) livres++;
      html = '<b>Torre ' + inf.torre + ' · ' + inf.andar + 'º andar</b><small>' + livres + (livres === 1 ? ' disponível' : ' disponíveis') + ' · clique para abrir</small>';
      if (inf.torre === state.torre && !state.andar) { const b = lista.querySelector('[data-andar="' + inf.andar + '"]'); if (b) b.classList.add('is-hover'); }
    }
    tip.innerHTML = html; tip.hidden = false;
    const r = box.getBoundingClientRect(), tw = tip.offsetWidth;
    const x = Math.min(Math.max(8, cx - r.left + 14), r.width - tw - 8), y = Math.max(8, cy - r.top - 46);
    tip.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }
  let hintTimer = 0;
  function fadeHint() { clearTimeout(hintTimer); hintTimer = setTimeout(function () { $('stageHint').classList.add('is-faded'); }, 3500); }
  box.addEventListener('pointerdown', fadeHint, { once: true });

  /* ---------- prédio 3D ---------- */
  renderAndares();
  function webglOk() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }
  function falhou() { $('loading').classList.add('is-done'); $('stageError').hidden = false; $('stageHint').hidden = true; }
  let tentativas = 0;
  function iniciar() {
    // a biblioteca 3D pode chegar depois deste script (CDN lenta ou carregamento fora de ordem): espera até ~8 s
    if (!window.__libFail && (!window.THREE || !THREE.OrbitControls) && tentativas++ < 50) { setTimeout(iniciar, 160); return; }
    if (window.__libFail || !window.THREE || !THREE.OrbitControls || !webglOk()) { falhou(); return; }
    try {
      predio = Predio3D.create({
        canvas: $('predio'), host: box, labels: $('labels'),
        statusOf: statusOf, typeOf: typeOf, colors: tokens, night: isDark(),
        onHover: showTip,
        onPickFloor: function (t, a) { if (apto) return; if (t !== state.torre) { state.torre = t; $('torreA').setAttribute('aria-pressed', t === 'A'); $('torreB').setAttribute('aria-pressed', t === 'B'); renderAndares(); } abrirAndar(a, true); showTip(null); },
        onPickUnit: function (p) { if (!apto) escolher(p); },
        onEnterUnit: function (p) { if (apto || !state.andar) return; escolher(p); entrarApto(info(state.torre, state.andar, p)); },
        onPickTower: function (t) { setTorre(t); }
      });
      requestAnimationFrame(function () { $('loading').classList.add('is-done'); });
    } catch (e) { console.error(e); falhou(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
