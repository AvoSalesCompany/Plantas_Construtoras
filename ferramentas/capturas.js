#!/usr/bin/env node
/*
 * Capturas de tela reais (WebGL) do site, num Chromium sem janela (Playwright).
 * Diferente do teste de fumaça, aqui o 3D é desenhado de verdade: serve para conferir se a maquete abriu no lugar certo,
 * se o corredor aparece, se o elevador desce ao térreo do condomínio, se a câmera voltou para o andar etc.
 *
 * Uso (dentro da pasta do repositório):
 *   node ferramentas/capturas.js empreendimentos/residencial-milao/site [pasta-de-saida] [--libs /caminho/do/three]
 *
 * --libs: pasta com build/three.min.js, examples/js/controls/OrbitControls.js e examples/js/objects/Reflector.js
 *         (por exemplo um clone do three.js na tag r128) para rodar sem internet; sem ela, as bibliotecas vêm da CDN.
 * Variáveis: LARGURA e ALTURA da janela (padrão 1280x800), APTO (posição no andar, padrão 3), ANDAR (padrão 8).
 * Sem placa de vídeo o Chromium desenha por software: cada quadro dentro do apto pode levar vários segundos.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const libsIdx = args.indexOf('--libs');
const libs = libsIdx >= 0 ? args.splice(libsIdx, 2)[1] : null;
const [siteArg, saidaArg] = args;
if (!siteArg) { console.error('uso: node ferramentas/capturas.js <pasta-do-site> [saida] [--libs pasta-three]'); process.exit(2); }
const site = path.resolve(siteArg), saida = path.resolve(saidaArg || 'capturas');
fs.mkdirSync(saida, { recursive: true });
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('instale o Playwright: npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const servidor = http.createServer((req, res) => {
  const arq = path.join(site, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
  if (!arq.startsWith(site) || !fs.existsSync(arq)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
});

(async () => {
  await new Promise((ok) => servidor.listen(0, ok));
  const url = 'http://localhost:' + servidor.address().port + '/index.html';
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +(process.env.LARGURA || 1280), height: +(process.env.ALTURA || 800) } });
  page.setDefaultTimeout(240000);
  const avisos = [];
  page.on('pageerror', (e) => avisos.push('erro: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) avisos.push('console: ' + m.text()); });
  if (libs) {
    await page.route(/three\.min\.js/, (r) => r.fulfill({ path: path.join(libs, 'build/three.min.js'), contentType: 'text/javascript' }));
    await page.route(/OrbitControls\.js/, (r) => r.fulfill({ path: path.join(libs, 'examples/js/controls/OrbitControls.js'), contentType: 'text/javascript' }));
    await page.route(/Reflector\.js/, (r) => r.fulfill({ path: path.join(libs, 'examples/js/objects/Reflector.js'), contentType: 'text/javascript' }));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  }
  const foto = async (nome) => { await page.screenshot({ path: path.join(saida, nome + '.png') }); console.log('  ' + nome + '.png'); };
  const clicar = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
  const andar = process.env.ANDAR || '8', apto = process.env.APTO || '3';
  try {
    await page.goto(url);
    await page.waitForTimeout(3000);
    await foto('01-predio');
    await clicar('.floor-btn[data-andar="' + andar + '"]');
    await page.waitForTimeout(2500);
    await foto('02-andar');
    await page.evaluate((p) => {                          // dois cliques no apto, na planta do painel
      const g = document.querySelector('#planta .pl-u[data-pos="' + p + '"]');
      g.dispatchEvent(new MouseEvent('click', { bubbles: true })); g.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }, apto);
    await page.waitForFunction(() => window.__aptReady === true);
    await page.waitForTimeout(5000);
    await foto('03-apto-3d');
    await clicar('#viewApto [data-cmd="vTop"]'); await page.waitForTimeout(5000); await foto('04-apto-planta');
    await clicar('#viewApto [data-cmd="vVisit"]'); await page.waitForTimeout(8000); await foto('05-visita');
    await clicar('#aptoComodos [data-room="corredor"]'); await page.waitForTimeout(8000); await foto('06-corredor');
    await clicar('#aptoComodos [data-room="terreo"]'); await page.waitForTimeout(12000); await foto('07-terreo');
    await clicar('#viewApto [data-cmd="vFree"]'); await page.waitForTimeout(8000); await foto('08-voar');
    await clicar('#btnSairApto'); await page.waitForTimeout(6000); await foto('09-de-volta-ao-andar');
  } catch (e) { avisos.push('passo falhou: ' + String(e.message).split('\n')[0]); }
  await browser.close(); servidor.close();
  console.log(avisos.length ? avisos.join('\n') : 'sem erros no navegador');
  process.exit(avisos.some((a) => /^erro|passo/.test(a)) ? 1 : 0);
})();
