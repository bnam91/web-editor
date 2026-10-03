/* _graph-gr-harness — GR 묶음 DOM 시험 공용 부품(graph-gr1-gradient · graph-gr-overlay). 기준판 30984c67 부팅(git show)·판 세우기·배율·기하 계측. */
const { expect } = require('@playwright/test');
const path = require('path');
const { execFileSync } = require('child_process');
const { bootApp, ORIGIN } = require('./_root-harness.js');

const BASE = '30984c67';
const REPO = path.join(__dirname, '..', '..');
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
const _baseCache = new Map();
function baseFile(rel) {
  if (_baseCache.has(rel)) return _baseCache.get(rel);
  let buf = null;
  try { buf = execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) { buf = null; }
  _baseCache.set(rel, buf);
  return buf;
}
async function bootBase(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
  await page.route(`${ORIGIN}/**`, async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, '');
    const buf = baseFile(rel);
    if (!buf) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(rel)] || 'application/octet-stream', body: buf });
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.renderGraph === 'function', null, { timeout: 20000 });
  return errs;
}

const G_RB = 'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)';
const ITEMS = [
  { label: '1월', value: 3.2 }, { label: '2월', value: 4.6 }, { label: '3월', value: 2.1 },
  { label: '4월', value: 4 }, { label: '5월', value: 3.8 },
];

async function setup(page, { type = 'bar-v', extra = {}, items = ITEMS, padX = 32, boot = bootApp } = {}) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await boot(page);
  await page.evaluate(({ type, extra, items, padX }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="grS" data-section="1" style="background:#1a1a2e"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="${padX}" style="padding-left:${padX}px;padding-right:${padX}px;"></div></div>`);
    const { row, block } = window.makeGraphBlock();
    block.id = 'grG'; block.dataset.chartType = type; block.dataset.preset = 'dark';
    block.dataset.items = JSON.stringify(items);
    for (const [k, v] of Object.entries(extra)) block.dataset[k] = v;
    document.querySelector('#grS .section-inner').appendChild(row);
    window.renderGraph(block);
    window.rebindAll?.(); window.deselectAll?.();
  }, { type, extra, items, padX });
  await page.waitForTimeout(200);
  return errs;
}
async function setZoom(page, z) {
  await page.evaluate((z) => window.applyZoom(z), z);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.currentZoom), `전제: 배율이 실제로 ${z}% 로 섰다`).toBe(z);
}
const openPanel = (page) => page.evaluate(() => window.showGraphProperties(document.getElementById('grG')));
const itemsOf = (page) => page.evaluate(() => JSON.parse(document.getElementById('grG').dataset.items));
const setDs = (page, kv) => page.evaluate((kv) => { const b = document.getElementById('grG'); for (const [k, v] of Object.entries(kv)) { if (v == null) delete b.dataset[k]; else b.dataset[k] = v; } window.renderGraph(b); }, kv);

/* 막대 꼭대기(fill 위 가운데) vs 점 div 중심 vs polyline 꼭짓점(getScreenCTM) — 화면 px. root = 그래프 블럭(클론도 됨). */
const MEASURE = (root) => {
  const g = typeof root === 'string' ? document.querySelector(root) : root;
  const fills = [...g.querySelectorAll('.grb-bars-v > .grb-bar-col .grb-bar-fill')];
  const dots = [...g.querySelectorAll('.grb-ov-dot')];
  const svg = g.querySelector('.grb-ov-svg'); const pl = g.querySelector('.grb-ov-line');
  if (!svg || !pl || dots.length !== fills.length) return { ok: false, nFills: fills.length, nDots: dots.length, hasSvg: !!svg, hasLine: !!pl };
  const ctm = svg.getScreenCTM();
  const rows = fills.map((f, i) => {
    const r = f.getBoundingClientRect(); const bx = (r.left + r.right) / 2, by = r.top;
    const dr = dots[i].getBoundingClientRect(); const dx = (dr.left + dr.right) / 2, dy = (dr.top + dr.bottom) / 2;
    const p = svg.createSVGPoint(); p.x = pl.points.getItem(i).x; p.y = pl.points.getItem(i).y; const s = p.matrixTransform(ctm);
    return { i, dot: Math.max(Math.abs(dx - bx), Math.abs(dy - by)), line: Math.max(Math.abs(s.x - bx), Math.abs(s.y - by)), barH: r.height };
  });
  return { ok: true, maxDot: Math.max(...rows.map(r => r.dot)), maxLine: Math.max(...rows.map(r => r.line)), rows };
};
const meas = (page, sel = '#grG') => page.evaluate(MEASURE, sel);
const ALL_ON = { showAxis: '1', showGrid: '1', showLine: '1' };

module.exports = { BASE, bootBase, G_RB, ITEMS, setup, setZoom, openPanel, itemsOf, setDs, MEASURE, meas, ALL_ON };
