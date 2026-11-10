#!/usr/bin/env node
/*
 * Teste de fumaça: roda os scripts de uma página com um THREE e um DOM "de mentira"
 * (todo objeto aceita qualquer chamada) e falha se aparecer erro de JavaScript:
 * variável que não existe, função chamada em algo indefinido, dado da planta faltando etc.
 * Não desenha nada — serve para pegar quebras antes de publicar.
 *
 * Uso:
 *   node ferramentas/teste_fumaca.js <pagina.html> [hash] [quadros] [roteiro.js]
 *   node ferramentas/teste_fumaca.js empreendimentos/residencial-milao/site/apartamento/index.html "#tipo=com-sacada&embed=1&andar=8"
 * O roteiro (opcional) simula cliques e mensagens depois que a página carrega: module.exports = function (t) { ... }
 * com t.clicar(id, alvo), t.mensagem(dados, origem), t.el(id), t.avancar(quadros) e t.esperar().
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const [, , pagina, hash = '', quadrosArg = '6', roteiroArg] = process.argv;
if (!pagina) { console.error('uso: node ferramentas/teste_fumaca.js <pagina.html> [hash] [quadros]'); process.exit(2); }
const html = fs.readFileSync(pagina, 'utf8');
const pasta = path.dirname(pagina);

// objeto universal: qualquer propriedade, chamada ou "new" devolve outro objeto universal; vira 0 em contas
const handler = {
  get(t, k) {
    if (k === Symbol.toPrimitive) return () => 0;
    if (k === Symbol.iterator) return function* () {};
    if (k === 'then') return undefined;
    if (k === 'length') return 0;
    if (k in t) return t[k];
    const v = U(); t[k] = v; return v;
  },
  apply() { return U(); },
  construct() { return U(); },
  set(t, k, v) { t[k] = v; return true; }
};
function U() { return new Proxy(function () {}, handler); }

const erros = [];
const rafs = [];
const timers = [];
const elementos = {};
const ouvintes = {};
const htmlDinamico = [];
function elemento() {
  const e = U(), ev = {};
  e.dataset = {}; e.style = {}; e.__ev = ev;
  e.addEventListener = (tipo, fn) => { (ev[tipo] = ev[tipo] || []).push(fn); };
  return new Proxy(e, { set(t, k, v) { t[k] = v; if (k === 'innerHTML' && typeof v === 'string') htmlDinamico.push(v); return true; }, get: (t, k) => t[k] });
}
function el(id) { if (!elementos[id]) { const e = elemento(); e.id = id; elementos[id] = e; } return elementos[id]; }
const documento = U();
documento.getElementById = (id) => (html.includes('id="' + id + '"') || htmlDinamico.some((h) => h.includes('id="' + id + '"')) ? el(id) : null);
documento.querySelector = () => U();
documento.querySelectorAll = () => [];
documento.createElement = () => elemento();
documento.readyState = 'complete';
documento.hidden = false;
documento.documentElement = U();
documento.addEventListener = (tipo, fn) => { (ouvintes['doc:' + tipo] = ouvintes['doc:' + tipo] || []).push(fn); };

const janela = {
  console: {
    log() {}, info() {}, debug() {},
    warn() {},
    error(...a) { erros.push(a.map((x) => (x && x.stack) || String(x)).join(' ')); }
  },
  document: documento,
  location: { hash, href: 'http://teste/' + pagina + hash, search: '' },
  navigator: { userAgent: 'teste', clipboard: U() },
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  requestAnimationFrame: (fn) => { rafs.push(fn); return rafs.length; },
  cancelAnimationFrame() {},
  setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  performance: { now: () => Date.now() },
  addEventListener: (tipo, fn) => { (ouvintes['win:' + tipo] = ouvintes['win:' + tipo] || []).push(fn); },
  removeEventListener() {},
  getComputedStyle: () => ({ getPropertyValue: () => '#123456' }),
  devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800,
  ResizeObserver: function () { return { observe() {} }; },
  IntersectionObserver: function () { return { observe() {} }; },
  MutationObserver: function () { return { observe() {} }; },
  Intl, Math, JSON, Date, Array, Object, Float32Array, Uint8Array, Uint16Array, Map, Set, Promise, RegExp, String, Number, Boolean, Symbol, Error,
  parseInt, parseFloat, isFinite, isNaN, encodeURIComponent, decodeURIComponent,
  WebGLRenderingContext: function () {},
  AudioContext: function () { return U(); },
  Image: function () { return U(); },
  THREE: U()
};
janela.window = janela;
janela.self = janela;
janela.parent = { postMessage(m) { janela.__mensagens = (janela.__mensagens || []).concat([m]); } };
// THREE: o que o código testa com typeof precisa ter o tipo certo
janela.THREE.ShaderChunk = { lights_fragment_begin: '' };
janela.THREE.MathUtils = { degToRad: (d) => d * Math.PI / 180, clamp: (v, a, b) => Math.max(a, Math.min(b, v)) };
janela.THREE.REVISION = '128';

const ctx = vm.createContext(janela);
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
let rodados = 0;
for (const m of scripts) {
  const sm = /\ssrc="([^"]+)"/.exec(m[1]), src = sm && sm[1], code = m[2];
  if (src && /^https?:/.test(src)) continue;                 // bibliotecas da CDN: o THREE falso faz o papel delas
  const texto = src ? fs.readFileSync(path.join(pasta, src), 'utf8') : code;
  if (!texto.trim()) continue;
  try { vm.runInContext(texto, ctx, { filename: src || 'inline' }); rodados++; }
  catch (e) { erros.push((src || 'inline') + ': ' + (e.stack || e)); }
}
(ouvintes['doc:DOMContentLoaded'] || []).forEach((fn) => { try { fn(); } catch (e) { erros.push('DOMContentLoaded: ' + e.stack); } });
let relogio = 1000;
function avancar(qtd) {
  for (let q = 0; q < qtd && rafs.length; q++) {
    const lista = rafs.splice(0);
    relogio += 16;
    lista.forEach((fn) => { try { fn(relogio); } catch (e) { erros.push('quadro: ' + e.stack); } });
  }
}
function esperar() {                                   // roda os setTimeout pendentes (inclusive os que eles agendarem)
  for (let i = 0; i < 20 && timers.length; i++) timers.splice(0).forEach((fn) => { try { fn(); } catch (e) { erros.push('setTimeout: ' + e.stack); } });
}
avancar(parseInt(quadrosArg, 10));
esperar();
if (roteiroArg) {
  const roteiro = require(path.resolve(roteiroArg));
  const t = {
    el,
    avancar, esperar,
    clicar(id, alvo) {
      const e = el(id), ev = { target: alvo || e, preventDefault() {}, stopPropagation() {} };
      if (alvo && !alvo.closest) ev.target = Object.assign({ closest: () => alvo }, alvo);
      (e.__ev.click || []).concat(e.__ev.submit || []).forEach((fn) => { try { fn(ev); } catch (er) { erros.push('clique em ' + id + ': ' + er.stack); } });
    },
    mensagem(dados, origem) {
      (ouvintes['win:message'] || []).forEach((fn) => { try { fn({ data: dados, source: origem }); } catch (er) { erros.push('mensagem ' + (dados && dados.type) + ': ' + er.stack); } });
    }
  };
  try { roteiro(t); } catch (e) { erros.push('roteiro: ' + e.stack); }
}
const msgs = (janela.__mensagens || []).map((m) => m.type).filter(Boolean);
console.log(`${pagina}${hash}: ${rodados} scripts${roteiroArg ? ', roteiro ' + path.basename(roteiroArg) : ''}${msgs.length ? ', mensagens: ' + [...new Set(msgs)].join(' ') : ''}`);
if (erros.length) {
  console.log('ERROS:');
  erros.forEach((e) => console.log(' - ' + e.split('\n').slice(0, 4).join('\n   ')));
  process.exit(1);
}
console.log('ok');
