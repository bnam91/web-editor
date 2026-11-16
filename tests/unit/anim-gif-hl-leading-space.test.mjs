/* anim-gif-hl-leading-space — NEW-현빈QA-GIF-HL-LEADING-SPACE-LOST-01(현빈 QA · <span class="tb-hl">&nbsp;안녕하세요</span> 재생하면 앞 빈칸 몫 형광펜이 빠진다 · 화면==GIF).
 *   원인 둘(코드 읽기 · 0.9.12 판에서 이미 — V3 fade-char·hl:fixed 없이도): ⑴ animation-engine.js _extractText/_extractCs 의 .trim() 이 \u00a0 까지 깎음(DOM 시험 몫)
 *   ⑵ layoutLines 의 wrap 이 «cur 가 빈 글»을 «줄 없음»으로 봐 ' 안녕하세요' → '안녕하세요' 로 접고 조각 cs 도 한 칸 밀어 자름(여기서 잰다).
 * H1 앞 빈칸 글: 접힌 조각 = ' 안녕하세요' 그대로 · cs 6칸(첫 칸 = 형광펜) · 폭 = 6글자 · fade-in 끝 프레임 형광 띠 = 줄 왼끝부터 6글자 폭(빈칸 몫 포함)
 * H2 옛 접기 그대로: 앞 빈칸 없는 글은 옛 조각 · 접힌 자리 뒤 겹빈칸은 옛처럼 버림 · 폭 넘으면 접힘
 * 양성대조(예측 · CTL 패치 — DOM D1 과 같은 패치): wrap 을 옛 truthy 판정(`let cur = ''` · `cur ? … : word` · `s0 = cur ? c0 : at` · `cur = word`)으로 → H1 빨강 · H2 초록
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutLines, drawTracks } from '../../js/fx/anim-gif-tracks.js';

function fakeCtx() {
  const calls = [];
  const ctx = {
    calls, font: '', textBaseline: '', textAlign: '', fillStyle: '', globalAlpha: 1, shadowColor: '', shadowBlur: 0, filter: 'none', letterSpacing: '0px',
    measureText: (s) => ({ width: String(s).length * 10 }),
    fillText: (s, x, y) => calls.push({ op: 'text', s: String(s), x, y, fill: ctx.fillStyle }),
    fillRect: (x, y, w, h) => calls.push({ op: 'rect', x, y, w, h, fill: ctx.fillStyle }),
    save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, rect() {}, clip() {}, fill() {}, arc() {},
  };
  return ctx;
}
const HLC = 'rgb(255, 0, 255)';
const HL = Object.freeze({ color: '#111', weight: '700', italic: false, sizeK: 1, ul: null, lt: null, hl: { color: HLC, h: { pct: 0.4 }, y: 0 }, bg: null });
const BASE = { fontWeight: '700', fontFamily: 'sans-serif', color: '#111', textAlign: 'left', lineHeight: 1.4, letterSpacing: 0 };

test('H1 앞 빈칸(&nbsp;) 형광펜 — 조각·cs·폭이 빈칸을 품는다 · 끝 프레임 띠 = 6글자 폭', () => {
  const style = { ...BASE, text: ' 안녕하세요', cs: Array(6).fill(HL) };
  const L = layoutLines(fakeCtx(), style, 480, 200, 24);
  assert.deepEqual([L.segs.length, L.segs[0].text, L.segs[0].cs && L.segs[0].cs.length, L.segs[0].cs && L.segs[0].cs[0] === HL, L.segs[0].w],
    [1, ' 안녕하세요', 6, true, 60], '★앞 빈칸이 접기에서 빠졌다');
  const c = fakeCtx();
  drawTracks(c, 480, 200, style, 24, [{ line: 0, fx: 'fade-in', at: 0, dur: 500 }], 500);
  const band = c.calls.filter((x) => x.op === 'rect' && x.fill === HLC);
  assert.ok(band.length > 0, '[전제] 형광 띠를 그림');
  const x0 = Math.min(...band.map((b) => b.x)), x1 = Math.max(...band.map((b) => b.x + b.w));
  assert.deepEqual([x0, x1 - x0], [L.segs[0].x0, 60], `★형광 띠가 빈칸 몫을 뺐다 — ${JSON.stringify(band)}`);
});

test('H2 옛 접기 그대로 — 앞 빈칸 없는 글 · 접힌 자리 겹빈칸 버림 · 폭 넘으면 접힘', () => {
  const plain = layoutLines(fakeCtx(), { ...BASE, text: '안녕하세요 반가워요' }, 480, 200, 24).segs.map((s) => s.text);
  assert.deepEqual(plain, ['안녕하세요 반가워요']);
  /* 폭 좁게(wrapEm) — 'aaaa' 두 개 사이 겹빈칸: 접힌 다음 줄은 옛처럼 'aaaa'(빈칸 안 붙음) */
  const narrow = layoutLines(fakeCtx(), { ...BASE, text: 'aaaa  aaaa', wrapEm: 50 / 24 }, 480, 200, 24).segs.map((s) => s.text);
  assert.deepEqual(narrow, ['aaaa', 'aaaa'], '접힌 자리 뒤 겹빈칸은 버림(옛 그대로)');
});
