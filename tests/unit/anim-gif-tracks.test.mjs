/* anim-gif-tracks.test.mjs — GIF V2 «줄별 타임라인»(js/fx/anim-gif-tracks.js)을 «실제로 그려» 잠근다(가짜 ctx = 호출 기록기).
 * 렌더 실행 단위다 — node --check 는 스코프 밖 이름을 못 잡는다(e32eabd44 교훈 · 브리프 운영 규칙).
 * F1·F2(도장 · 흐림→선명 · 블러 휩): T6 곡선 수 · T7 끝 프레임 = 제자리·흐림 없음·변형 없음 · 시작 = 흐림.
 *   양성대조(실측은 커밋 메시지): stampParams 의 «쾅» 갈래(p ≥ 0.7)를 지우면 T6 빨강 · FX.stamp 의 `_blur(ctx, m.blur)` 삭제 → T7(시작 흐림) 빨강.
 * 양성대조(예측): drawTracks 의 `if (p == null || …) continue;` 를 지우면 T4(아직 안 나온 줄이 그려짐) 빨강 ·
 *   normTracks 의 «앞 줄 끝에 시작»(prev.at + prev.dur) 을 0 으로 → T1 빨강.
 * T10·T11(RICHTEXT C1): 조각 스타일 cs 가 접힌 줄마다 제 글자에 붙는다 · 카운트업처럼 글이 바뀌어도 앞뒤 글자는 제 스타일.
 *   양성대조(실측은 커밋 메시지): layoutLines 의 `off += line.length + 1` 삭제 → T10 빨강.
 * T12(RICHTEXT C2): 조각마다 제 글자색·굵기·기울임·크기로 이어 그림 · 큰 조각 줄은 줄높이도 큼 · 굵은 조각은 제 폭으로 접음.
 *   양성대조(실측은 커밋 메시지): fillStyled 첫 줄을 늘 평글로(`if (true)`) → T12 빨강.
 * T13(RICHTEXT C3): 배경색·형광펜 띠·밑줄은 글 «앞»(뒤에 깔림) · 취소선은 글 «뒤» · 조각 폭 그대로 · 형광 띠 = 글꼴 상자 아래 h% · 그림자 0.
 *   양성대조(실측은 커밋 메시지): fillStyled 의 `if (p.st) _decor(…, false)` 줄 삭제 → T13 빨강.
 * T14(RICHTEXT C4): 계산된 text-shadow 읽기 · 그림자는 맨 뒤 것부터 «화면 밖 글 + 옮긴 그림자» · 글은 그 위에 원래 그림자 상태로.
 *   양성대조(아이맥 실측 예정): _shadows 첫 줄 return → T14 빨강.
 * T15(RICHTEXT C5): 방점 = 그 글자 가운데 + ::before transform · 아래끝 = 글자 상자 윗변 + ty · 지름 = size × 배율 · 그림자 0.
 *   양성대조(아이맥 실측 예정): _decor 의 `if (st.dot) {` → `if (false) {` → T15 빨강.
 * T16(RICHTEXT C6): 줄별 효과 10개 전부 끝 프레임에서 꾸밈 유지(색 조각 · 방점 · 글로우 층) · 슬롯머신도 멈춘 자리의 방점이 안 잘린다.
 *   양성대조(아이맥 실측 예정): 줄별 slot-machine 의 `const roll = r.frac > 0;` → `const roll = true;` → T16(slot-machine) 빨강.
 * T17(RICHTEXT ⑫): 글자 그라데이션 → 캔버스 그라데이션(제품 gradientLine · 글 테두리 상자) = 기본 채움색 · 대체 단색 solid · 그라데이션 없으면 style 그대로.
 *   양성대조(아이맥 실측 예정): withGradFill 첫 줄을 `return style;` → T17 빨강.
 * T18(0.9.12 GIF-STAMP-START-CLIPPED-AT-LEFT-EDGE-01 · 지디 «네!» 45% 프레임 왼쪽 잘림): 왼쪽·오른쪽 정렬 패딩 0(wrapEm = W/size) 블럭 도장 «내려오는» 프레임(0~70%)마다
 *   그려진 글 상자(가로 변형 적용)가 캔버스 [0, W] 안 · 가운데 정렬 짧은 글은 확대 기준점 = 줄 가운데 그대로 · 끝 프레임 = 제자리(T7 과 같은 값).
 *   양성대조(아이맥 실측 예정): FX.stamp 의 `if (m.scale > 1 + 1e-6) {` → `if (false) {` → T18 빨강(왼쪽 정렬 글 왼끝 < 0).
 * T9(G4 481.49>480): textBox 가 캔버스 폭으로 안 자르면(Math.min(W, …) 삭제) T9 빨강(실측은 커밋 메시지).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normTracks, totalMs, localT, layoutLines, drawTracks, TRACK_FX, FX, V2_FX, stampParams, blurInParams, whipParams } from '../../js/fx/anim-gif-tracks.js';

function fakeCtx() {
  const calls = [];
  const ctx = {
    calls, font: '', textBaseline: '', textAlign: '', fillStyle: '', globalAlpha: 1, shadowColor: '', shadowBlur: 0, filter: 'none', letterSpacing: '0px',
    measureText: (s) => ({ width: String(s).length * 10 }),
    fillText: (s, x, y) => calls.push({ op: 'text', s: String(s), x, y, a: ctx.globalAlpha, f: ctx.filter, tf: ctx._tf, font: ctx.font, fill: ctx.fillStyle, sc: ctx.shadowColor, sb: ctx.shadowBlur, sox: ctx.shadowOffsetX, soy: ctx.shadowOffsetY, clip: ctx._clip }),
    fillRect: (x, y, w, h) => calls.push({ op: 'rect', x, y, w, h, fill: ctx.fillStyle, sb: ctx.shadowBlur }),
    _tf: 0, _stack: [],
    _clip: false, save() { ctx._stack.push([ctx.filter, ctx._tf, ctx.globalAlpha, ctx._clip]); }, restore() { [ctx.filter, ctx._tf, ctx.globalAlpha, ctx._clip] = ctx._stack.pop(); },
    translate() { ctx._tf++; }, scale() { ctx._tf++; }, beginPath() {}, rect() {}, clip() { ctx._clip = true; }, fill() {},
    arc: (x, y, r) => calls.push({ op: 'arc', x, y, r, fill: ctx.fillStyle, sb: ctx.shadowBlur, clip: ctx._clip }),
  };
  return ctx;
}
const STYLE = { text: '오늘 주문하면?\n네!', fontWeight: '700', fontFamily: 'sans-serif', color: '#111', textAlign: 'center', lineHeight: 1.4, letterSpacing: 0 };

test('T1 normTracks — 메우기(앞 줄 효과 · 앞 줄 끝에 시작) · 범위 고정 · 허용 목록 · 남는 줄 버림', () => {
  const t = normTracks([{ line: 0, fx: 'typewriter', at: 0, dur: 1000 }, { line: 5, fx: 'fade-in' }, { line: 0, fx: 'fade-in' }], 3);
  assert.deepEqual(t, [
    { line: 0, fx: 'typewriter', at: 0, dur: 1000 },
    { line: 1, fx: 'typewriter', at: 1000, dur: 1000 },
    { line: 2, fx: 'typewriter', at: 2000, dur: 1000 },
  ]);
  const c = normTracks([{ line: 0, fx: '<img onerror>', at: -50, dur: 99999 }], 1, { fx: 'slide-up' });
  assert.deepEqual(c, [{ line: 0, fx: 'slide-up', at: 0, dur: 5000 }]);
  assert.deepEqual(normTracks(null, 2, { fx: 'fade-in', dur: 600 }), [{ line: 0, fx: 'fade-in', at: 0, dur: 600 }, { line: 1, fx: 'fade-in', at: 600, dur: 600 }]);
});

test('T2 시계 — totalMs = 가장 늦게 끝나는 줄 · localT 시작 전 null · 끝 뒤 1', () => {
  const t = [{ line: 0, fx: 'fade-in', at: 0, dur: 1000 }, { line: 1, fx: 'fade-in', at: 1100, dur: 500 }];
  assert.equal(totalMs(t), 1600);
  assert.equal(localT(t[1], 1000), null);
  assert.equal(localT(t[1], 1350), 0.5);
  assert.equal(localT(t[1], 9999), 1);
});

test('T3 배치 — 줄마다 src · 세로 가운데 · 접힌 조각도 같은 src', () => {
  const ctx = fakeCtx();
  const L = layoutLines(ctx, { ...STYLE, text: 'aaaa bbbb cccc dddd\nee' }, 200, 300, 20);   // 폭 200 · 여백 10 ⇒ 180 = 18글자
  assert.deepEqual(L.segs.map((s) => [s.src, s.text]), [[0, 'aaaa bbbb cccc'], [0, 'dddd'], [1, 'ee']]);
  const mid = (L.segs[0].y + L.segs[2].y) / 2;
  assert.ok(Math.abs(mid - 150) < 1e-9, '세로 가운데');
  assert.equal(L.srcCount, 2);
});

test('T4 P076 꼴 — 질문 타이핑(0~1000) · 답은 1100 부터: 그 전엔 안 그림', () => {
  const tracks = normTracks([{ line: 0, fx: 'typewriter', at: 0, dur: 1000 }, { line: 1, fx: 'fade-in', at: 1100, dur: 400 }], 2);
  const at = (tau) => { const ctx = fakeCtx(); const drawn = drawTracks(ctx, 480, 200, STYLE, 24, tracks, tau); return { drawn, texts: ctx.calls.filter((c) => c.op === 'text').map((c) => c.s) }; };
  const a = at(500);
  assert.deepEqual(a.drawn, [0]);
  assert.ok(!a.texts.includes('네!'), '★답 줄이 시작 전에 보인다');
  assert.ok(a.texts[0].length > 0 && a.texts[0].length < '오늘 주문하면?'.length, '타이핑 중간');
  const b = at(1600);
  assert.deepEqual(b.drawn, [0, 1]);
  assert.ok(b.texts.includes('오늘 주문하면?') && b.texts.includes('네!'));
  assert.equal(totalMs(tracks), 1500);
});

test('T5 모든 효과가 «실제로 돈다» — 줄 2 × p 표본(0 · 0.3 · 0.7 · 1) · 숫자 줄 포함 · 던지지 않고 글자를 그린다', () => {
  assert.deepEqual(Object.keys(FX).sort(), [...TRACK_FX].sort(), '효과 표 = 허용 목록');
  const style = { ...STYLE, text: '할인 12,345원\n지금 바로' };
  for (const fx of TRACK_FX) for (const tau of [0, 300, 700, 1000]) {
    const ctx = fakeCtx();
    drawTracks(ctx, 480, 200, style, 24, normTracks([{ line: 0, fx, at: 0, dur: 1000 }, { line: 1, fx, at: 0, dur: 1000 }], 2), tau);
    if (tau === 1000) assert.ok(ctx.calls.some((c) => c.op === 'text'), `${fx} 끝 프레임에 글자 0`);
  }
  const end = fakeCtx();
  drawTracks(end, 480, 200, style, 24, normTracks([{ line: 0, fx: 'count-up', at: 0, dur: 1000 }], 2), 1000);
  assert.ok(end.calls.some((c) => c.s === '할인 12,345원'), '카운트업 끝 = 원문');
});

test('T6 F1·F2 곡선 — 도장 2.2배·흐림10 → 70% 에서 1·선명 → 눌림 0.94 → 1 · 흐림→선명 14→0 · 휩 끝 = 제자리·잔상 0', () => {
  assert.deepEqual(V2_FX, ['stamp', 'blur-in', 'blur-whip']);
  const s0 = stampParams(0), s70 = stampParams(0.7), sq = stampParams(0.7 + 0.3 * 0.35), s1 = stampParams(1);
  assert.deepEqual([s0.scale, s0.blur, s0.alpha], [2.2, 10, 0]);
  assert.ok(Math.abs(s70.scale - 1) < 1e-9 && s70.blur === 0 && s70.alpha === 1, '70% = 찍힘');
  assert.ok(Math.abs(sq.scale - 0.94) < 1e-9, '«쾅» 눌림 0.94');
  assert.ok(Math.abs(s1.scale - 1) < 1e-9 && Math.abs(s1.dx) < 1e-9, '끝 = 원래 크기·제자리');
  for (let p = 0; p < 0.7; p += 0.05) assert.ok(stampParams(p + 0.05 > 0.7 ? 0.7 : p + 0.05).scale <= stampParams(p).scale + 1e-9, '내려오는 동안 작아지기만');
  assert.equal(stampParams(0.5, 2).blur, 2 * stampParams(0.5, 1).blur, '배율 k 만큼 흐림 px');
  assert.deepEqual([blurInParams(0).blur, blurInParams(0).alpha, blurInParams(1).blur, blurInParams(1).alpha], [14, 0.2, 0, 1]);
  const w1 = whipParams(1, 1, 480);
  assert.deepEqual([w1.dx === 0 || Object.is(w1.dx, -0), w1.ghosts, w1.blur, w1.alpha], [true, 0, 0, 1]);
  assert.ok(whipParams(0.2, 1, 480).dx < 0 && whipParams(0.2).ghosts === 5, '들어오는 중 = 왼쪽 · 잔상 5');
});

test('T7 새 효과의 시작·끝 프레임(실제로 그림) — 시작 = 흐림 · 끝 = 제자리 x0 · 흐림 none · 변형 0', () => {
  const style = { ...STYLE, text: '네!' };
  for (const fx of V2_FX) {
    const tracks = [{ line: 0, fx, at: 0, dur: 500 }];
    const a = fakeCtx(); drawTracks(a, 480, 200, style, 24, tracks, 50);
    assert.ok(a.calls.some((c) => c.op === 'text' && /^blur\(/.test(c.f)), `${fx} 시작에 흐림이 없다`);
    const z = fakeCtx(); drawTracks(z, 480, 200, style, 24, tracks, 500);
    const L = layoutLines(fakeCtx(), style, 480, 200, 24);
    const last = z.calls.filter((c) => c.op === 'text').pop();
    assert.deepEqual([last.s, last.x, last.f, last.tf, last.a], ['네!', L.segs[0].x0, 'none', 0, 1], `${fx} 끝 프레임`);
  }
});

test('T8 F3 저장 꼴 — 왕복 · 소독(허용 목록·범위·없는 줄) · 못 읽으면 perLine false · 정해진 키만', async () => {
  const { parseAnimGif, serializeAnimGif, scaleTracks } = await import('../../js/fx/anim-gif-tracks.js');
  const tracks = [{ line: 0, fx: 'typewriter', at: 0, dur: 1000 }, { line: 1, fx: 'stamp', at: 1100, dur: 560 }];
  const s = serializeAnimGif({ tracks, speed: 1.5, repeat: 2 });
  assert.deepEqual(parseAnimGif(s, 2), { perLine: true, tracks, speed: 1.5, repeat: 2 });
  const evil = JSON.stringify({ v: 2, tracks: [{ line: 0, fx: '<img src=x onerror=alert(1)>', at: -9, dur: 1e9, html: '<b>' }, { line: 7, fx: 'stamp' }], speed: 99, repeat: -3, extra: 1 });
  assert.deepEqual(parseAnimGif(evil, 2), { perLine: true, tracks: [{ line: 0, fx: 'fade-in', at: 0, dur: 5000 }, { line: 1, fx: 'fade-in', at: 5000, dur: 5000 }], speed: 3, repeat: 1 });
  for (const bad of ['', 'x{', '{"v":1,"tracks":[]}', 'null', '[]']) assert.equal(parseAnimGif(bad, 2).perLine, false, bad);
  assert.deepEqual(Object.keys(JSON.parse(serializeAnimGif({ tracks: [{ line: 0, fx: 'stamp', at: 0, dur: 500, junk: 1 }] }))), ['v', 'tracks', 'speed', 'repeat']);
  assert.deepEqual(scaleTracks(tracks, 2)[1], { line: 1, fx: 'stamp', at: 550, dur: 280 });
});

test('T9 블럭 줄바꿈 폭이 캔버스보다 넓어도(글자 크기 반올림) 글 오른끝 ≤ 캔버스 − 여유 · 왼끝 ≥ 0', async () => {
  const { textBox, TEXT_SLACK } = await import('../../js/fx/anim-gif-tracks.js');
  const style = { ...STYLE, text: 'aaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbb', wrapEm: 9.876 };   // 9.876em × 49px = 483.9 > 480
  assert.ok(textBox(480, 49, style).maxW <= 480 - TEXT_SLACK, '접는 폭 ≤ 캔버스 − 여유');
  const ctx = fakeCtx(); ctx.measureText = (s) => ({ width: String(s).length * 10.05 });   // 48자 = 482.4 — 483.9 엔 한 줄 · 478 엔 두 줄
  const L = layoutLines(ctx, style, 480, 200, 49);
  for (const s of L.segs) assert.ok(s.x0 >= 0 && s.x0 + s.w <= 480 - 0.5, `★캔버스 밖: «${s.text}» ${s.x0}..${s.x0 + s.w}`);
  assert.equal(L.segs.length, 2, '[전제] 캔버스 폭에서 접힘');
});

test('T10 RICHTEXT C1 — 조각 스타일 cs 가 접힌 줄마다 제 글자에 붙는다(\n 뒤 줄 포함)', () => {
  const B = { b: 1 }, D = { d: 1 }, E = { e: 1 };
  const text = 'aaaa bbbb cccc dddd\nee';
  const cs = [...text].map((_, i) => (i >= 5 && i <= 8 ? B : i >= 15 && i <= 18 ? D : i >= 20 ? E : null));
  const L = layoutLines(fakeCtx(), { ...STYLE, text, cs }, 200, 300, 20);   // 폭 200 · 여백 10 ⇒ 18글자
  assert.deepEqual(L.segs.map((s) => s.text), ['aaaa bbbb cccc', 'dddd', 'ee'], '[전제] 접힘');
  assert.deepEqual(L.segs[0].cs, [null, null, null, null, null, B, B, B, B, null, null, null, null, null]);
  assert.deepEqual(L.segs[1].cs, [D, D, D, D]);
  assert.deepEqual(L.segs[2].cs, [E, E], '★\n 뒤 줄의 스타일이 어긋났다');
  assert.deepEqual(layoutLines(fakeCtx(), { ...STYLE, text }, 200, 300, 20).segs.map((s) => s.cs), [null, null, null], '꾸밈 없으면 null(평글)');
});

test('T11 RICHTEXT C1 — remapCs: 카운트업 «12,345원» → «3,086원» · 앞뒤 같은 글자는 제 스타일 · 바뀐 가운데는 첫 글자 스타일', async () => {
  const { remapCs } = await import('../../js/fx/anim-gif-text.js');
  const N = { n: 1 }, W = { w: 1 };
  const src = '할인 12,345원', cs = [...src].map((ch) => (ch === '원' ? W : /[\d,]/.test(ch) ? N : null));
  const out = '할인 3,086원', r = remapCs(src, cs, out);
  assert.equal(r.length, out.length);
  assert.deepEqual(r, [null, null, null, N, N, N, N, N, W]);
  assert.equal(remapCs(src, null, out), null);
  assert.equal(remapCs(src, cs, src), cs);
});

test('T12 RICHTEXT C2 — 조각마다 제 색·굵기·기울임·크기 · 이어 붙음(x) · 가운데 정렬 유지 · 큰 조각 줄높이 · 제 폭으로 접기', () => {
  const R = Object.freeze({ color: '#ff0000', weight: '900', italic: true, sizeK: 1.5 });
  const text = 'aa bb cc';
  const cs = [...text].map((_, i) => (i >= 3 && i <= 4 ? R : null));
  const ctx = fakeCtx(); ctx.measureText = (s) => ({ width: String(s).length * (parseFloat(/([\d.]+)px/.exec(ctx.font)?.[1]) || 20) * 0.5 });
  const style = { ...STYLE, text, cs, textAlign: 'center' };
  drawTracks(ctx, 480, 200, style, 20, [{ line: 0, fx: 'fade-in', at: 0, dur: 100 }], 100);
  const t = ctx.calls.filter((c) => c.op === 'text');
  assert.deepEqual(t.map((c) => [c.s, c.fill, c.font]), [
    ['aa ', '#111', '700 20px sans-serif'],
    ['bb', '#ff0000', 'italic 900 30px sans-serif'],
    [' cc', '#111', '700 20px sans-serif'],
  ], '★조각 스타일이 안 실렸다');
  const w = 3 * 10 + 2 * 15 + 3 * 10;   // 조각마다 제 글자 크기로 잰 폭
  assert.equal(t[0].x, 240 - w / 2, '가운데 정렬 = 조각 폭 합 기준');
  assert.equal(t[1].x, t[0].x + 30); assert.equal(t[2].x, t[1].x + 30);
  const L = layoutLines(ctx, { ...style, text: 'aa bb cc\nzz' }, 480, 200, 20);
  assert.ok(Math.abs((L.segs[1].y - L.segs[0].y) - (20 * 1.4 * 1.5 / 2 + 20 * 1.4 / 2)) < 1e-9, '큰 조각 줄 = 줄높이 1.5배');
  assert.equal(L.totalH, 20 * 1.4 * 1.5 + 20 * 1.4);
  // 굵게·크게 한 조각이 폭을 넘기면 접힌다(평글 폭이면 한 줄)
  const wide = 'aaaa bbbb', wcs = [...wide].map((_, i) => (i >= 5 ? R : null));
  const nar = layoutLines(ctx, { ...STYLE, text: wide, wrapEm: (40 + 10 + 40 + 2) / 20 }, 480, 200, 20).segs.length;
  const fat = layoutLines(ctx, { ...STYLE, text: wide, cs: wcs, wrapEm: (40 + 10 + 40 + 2) / 20 }, 480, 200, 20).segs.length;
  assert.deepEqual([nar, fat], [1, 2], '★크게 한 조각을 평글 폭으로 쟀다');
});

test('T13 RICHTEXT C3 — 배경색·형광펜·밑줄은 글 앞에(뒤로 깔림) · 취소선은 글 뒤에 · 조각 폭 · 형광 띠 = 상자 아래 40% · 장식엔 그림자 0', () => {
  const U = Object.freeze({ color: '#111', weight: '700', italic: false, sizeK: 1, ul: { color: '#0000ff', thick: 0, off: null }, lt: null, hl: null, bg: null });
  const S = Object.freeze({ ...U, ul: null, lt: { color: '#ff0000', thick: 2, off: null } });
  const Hh = Object.freeze({ ...U, ul: null, hl: { color: 'rgba(255, 230, 0, 0.6)', h: { pct: 0.4 }, y: 0 } });
  const G = Object.freeze({ ...U, ul: null, bg: '#00ff00' });
  const text = 'u s h g';
  const cs = [U, null, S, null, Hh, null, G];
  const ctx = fakeCtx(); ctx.shadowBlur = 9;
  drawTracks(ctx, 480, 200, { ...STYLE, text, cs, fontSize: 20 }, 20, [{ line: 0, fx: 'glow-pulse', at: 0, dur: 100 }], 100);
  const seq = ctx.calls.map((c) => (c.op === 'text' ? `T:${c.s}` : `R:${c.fill}`));
  assert.deepEqual(seq.filter((x) => x !== 'T: '), ['R:#0000ff', 'T:u', 'T:s', 'R:#ff0000', 'R:rgba(255, 230, 0, 0.6)', 'T:h', 'R:#00ff00', 'T:g'], `★장식 순서·색 ${JSON.stringify(seq)}`);
  const rects = ctx.calls.filter((c) => c.op === 'rect');
  const texts = ctx.calls.filter((c) => c.op === 'text');
  const xOf = (s) => texts.find((c) => c.s === s).x;
  for (const [r, s] of [[rects[0], 'u'], [rects[1], 's'], [rects[2], 'h'], [rects[3], 'g']]) assert.deepEqual([r.x, r.w], [xOf(s), 10], `${s} 장식 = 그 조각 자리·폭`);
  assert.ok(Math.abs(rects[2].h - 20 * 0.4) < 1e-9 && Math.abs(rects[2].y + rects[2].h - (texts[0].y + 20 * 0.2)) < 1e-9, '형광 띠 = 상자(0.8em/0.2em) 아래 40%');
  assert.equal(rects[1].h, 2, '취소선 두께 = CSS px × 배율(1)');
  assert.ok(rects.every((r) => r.sb === 0), '장식엔 그림자 0');
});

test('T14 RICHTEXT C4 — parseTextShadow · 조각 그림자 = 맨 뒤 것부터 화면 밖 글 + 옮긴 그림자 · 글은 마지막에 원래 상태', async () => {
  const { parseTextShadow } = await import('../../js/fx/anim-gif-text.js');
  assert.deepEqual(parseTextShadow('rgb(255, 0, 255) 0px 0px 5.88px, rgba(0, 0, 0, 0.5) 2px -3px 14px'), [
    { color: 'rgb(255, 0, 255)', x: 0, y: 0, blur: 5.88 }, { color: 'rgba(0, 0, 0, 0.5)', x: 2, y: -3, blur: 14 }]);
  for (const v of ['none', '', undefined]) assert.equal(parseTextShadow(v), null);
  const G = Object.freeze({ color: '#111', weight: '700', italic: false, sizeK: 1, shadows: parseTextShadow('rgb(255, 0, 255) 0px 0px 4px, rgb(0, 0, 255) 1px 2px 10px') });
  const ctx = fakeCtx(); ctx.shadowColor = 'keep'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  drawTracks(ctx, 480, 200, { ...STYLE, text: 'a g', cs: [null, null, G], fontSize: 20 }, 20, [{ line: 0, fx: 'fade-in', at: 0, dur: 100 }], 100);
  const t = ctx.calls.filter((c) => c.op === 'text');
  const gx = t.at(-1).x;
  assert.deepEqual(t.map((c) => [c.s, c.sc, c.sb, c.x === gx ? 'x' : c.x - gx, c.sox, c.soy]), [
    ['a ', 'keep', 0, t[0].x - gx, 0, 0],
    ['g', 'rgb(0, 0, 255)', 10, -10000, 10001, 2],
    ['g', 'rgb(255, 0, 255)', 4, -10000, 10000, 0],
    ['g', 'keep', 0, 'x', 0, 0],
  ], `★그림자 층 ${JSON.stringify(t)}`);
});

test('T15 RICHTEXT C5 — 방점: 그 글자 가운데 + transform(tx 에 −size/2 포함) · 아래끝 = 글자 상자 윗변 + ty · 지름 size · 그림자 0 · 다른 글자엔 점 0', () => {
  const D = Object.freeze({ color: '#111', weight: '700', italic: false, sizeK: 1, dot: { color: '#ff0000', size: 4, tx: -2 + 3, ty: -1 } });
  const ctx = fakeCtx(); ctx.shadowBlur = 7;
  drawTracks(ctx, 480, 200, { ...STYLE, text: 'a점b', cs: [null, D, null], fontSize: 20 }, 20, [{ line: 0, fx: 'glow-pulse', at: 0, dur: 100 }], 100);
  const arcs = ctx.calls.filter((c) => c.op === 'arc'), t = ctx.calls.filter((c) => c.op === 'text' && c.s === '점')[0];
  assert.equal(arcs.length, 1, `★점 수 ${JSON.stringify(arcs)}`);
  const a = arcs[0];
  assert.deepEqual([a.fill, a.r, a.sb], ['#ff0000', 2, 0]);
  assert.ok(Math.abs(a.x - (t.x + 10 / 2 + 1 + 2)) < 1e-9, `점 x = 글자 가운데 + tx + r (${a.x} vs ${t.x})`);
  assert.ok(Math.abs(a.y - (t.y - 20 * 0.8 - 1 - 2)) < 1e-9, `점 y = 상자 윗변 + ty − r (${a.y} vs ${t.y})`);
});

test('T16 RICHTEXT C6 — 줄별 효과 10개 끝 프레임: 빨강 조각 · 방점(안 잘림) · 글로우 층 유지(슬롯머신 멈춘 자리 포함)', async () => {
  const { parseTextShadow } = await import('../../js/fx/anim-gif-text.js');
  const text = '할인 12,345원';   // 할0 인1 ␠2 1 2 , 3 4 5(8) 원(9)
  const G = Object.freeze({ color: '#111', weight: '700', italic: false, sizeK: 1, shadows: parseTextShadow('rgb(255, 0, 255) 0px 0px 6px') });
  const D = Object.freeze({ color: '#111', weight: '700', italic: false, sizeK: 1, dot: { color: '#0000ff', size: 4, tx: -2, ty: 0 } });
  const R = Object.freeze({ color: '#ff0000', weight: '700', italic: false, sizeK: 1 });
  const cs = [...text].map((_, i) => (i === 0 ? G : i === 8 ? D : i === 9 ? R : null));
  for (const fx of TRACK_FX) {
    const ctx = fakeCtx();
    drawTracks(ctx, 480, 200, { ...STYLE, text, cs, fontSize: 24 }, 24, [{ line: 0, fx, at: 0, dur: 1000 }], 1000);
    const t = ctx.calls.filter((c) => c.op === 'text'), arcs = ctx.calls.filter((c) => c.op === 'arc');
    assert.ok(t.some((c) => c.s === '원' && c.fill === '#ff0000'), `★${fx} 빨강 조각 ${JSON.stringify(t.map((c) => [c.s, c.fill]))}`);
    assert.ok(arcs.length === 1 && !arcs[0].clip, `★${fx} 방점(안 잘림) ${JSON.stringify(arcs)}`);
    assert.ok(t.some((c) => c.s === '할' && c.sox), `★${fx} 글로우 층`);
  }
});

test('T17 RICHTEXT ⑫ — withGradFill: 90deg 그라데이션 = 글 왼끝→오른끝(가운데 줄) · 스탑 그대로 · 글 채움 = 그 그라데이션 · solid = 원래 색', async () => {
  const fs = await import('node:fs'), path = await import('node:path'), url = await import('node:url');
  const { mkTmpRoot } = await import('./_tmproot.js');
  const { withGradFill } = await import('../../js/fx/anim-gif-tracks.js');
  const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
  const dir = mkTmpRoot('anim-gif-grad-');   // 제품 gradient-model.js(js/props · .js = CommonJS 로 읽힘)를 .mjs 로 — 파서·선 기하는 제품 것 그대로
  fs.writeFileSync(path.join(dir, 'gradient-model.mjs'), fs.readFileSync(path.join(root, 'js/props/gradient-model.js'), 'utf8'));
  const { parseGradient, gradientLine } = (await import(url.pathToFileURL(path.join(dir, 'gradient-model.mjs')).href)).default;
  const grad = parseGradient('linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)');
  const ctx = fakeCtx(); const made = [];
  ctx.createLinearGradient = (x0, y0, x1, y1) => { const g = { kind: 'lin', x0, y0, x1, y1, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }; made.push(g); return g; };
  const style = { ...STYLE, text: 'aaaa', grad, gradLine: gradientLine };
  const out = withGradFill(ctx, style, 480, 200, 20);
  assert.equal(made.length, 1, '★캔버스 그라데이션을 안 만들었다');
  const g = made[0];
  const near = (a, b) => Math.abs(a - b) < 1e-6;   // 90deg 의 cos = 6e-17 — 정확히 같진 않다
  assert.ok(near(g.x0, 220) && near(g.x1, 260) && near(g.y0, 100) && near(g.y1, 100), `선 = 글 왼끝→오른끝 · 가운데 줄 ${JSON.stringify(g)}`);
  assert.deepEqual(g.stops, [[0, 'rgb(255, 0, 0)'], [1, 'rgb(0, 0, 255)']]);
  assert.deepEqual([out.color, out.solid], [g, '#111']);
  drawTracks(ctx, 480, 200, out, 20, [{ line: 0, fx: 'fade-in', at: 0, dur: 100 }], 100);
  assert.ok(ctx.calls.filter((c) => c.op === 'text').every((c) => c.fill === g), '★글 채움 = 그라데이션');
  assert.equal(withGradFill(ctx, STYLE, 480, 200, 20), STYLE, '그라데이션 없으면 style 그대로');
});

test('T18 도장 — 왼쪽·오른쪽 정렬 패딩 0 블럭: 내려오는 프레임마다 글 상자가 캔버스 안 · 가운데 짧은 글은 기준점 그대로 · 끝 = 제자리', () => {
  const W = 480, H = 200, size = 24, dur = 560;
  // 가로 변형(배율·이동)을 따라가는 기록기 — 글 한 번 그릴 때 캔버스 위 왼끝·오른끝
  const mk = () => {
    const c = fakeCtx(); let m = [1, 0]; const st = [], boxes = [];
    Object.assign(c, {
      translate(x) { c._tf++; m = [m[0], m[1] + m[0] * x]; }, scale(a) { c._tf++; m = [m[0] * a, m[1]]; },
      save() { st.push([m, c.filter, c._tf, c.globalAlpha]); }, restore() { [m, c.filter, c._tf, c.globalAlpha] = st.pop(); },
      fillText(s, x) { const w = c.measureText(s).width; boxes.push({ s: String(s), l: m[1] + m[0] * x, r: m[1] + m[0] * (x + w), k: m[0] }); },
    });
    return { c, boxes, reset: () => { m = [1, 0]; } };
  };
  for (const textAlign of ['left', 'right']) {
    const style = { ...STYLE, text: '네!', textAlign, wrapEm: W / size };   // 패딩 0 = 블럭 안쪽 폭 = 캔버스 폭
    const L = layoutLines(fakeCtx(), style, W, H, size);
    assert.ok(textAlign === 'left' ? L.segs[0].x0 <= 1 : L.segs[0].x0 + L.segs[0].w >= W - 1, `[전제] ${textAlign} 글이 캔버스 가장자리에 붙음`);
    let zoomed = 0;
    for (let tau = 0; tau < dur * 0.7; tau += 14) {
      const { c, boxes } = mk(); drawTracks(c, W, H, style, size, [{ line: 0, fx: 'stamp', at: 0, dur }], tau);
      const b = boxes.find((x) => x.s.includes('네'));
      assert.ok(b, `[전제] ${tau}ms 글이 그려짐`);
      if (b.k > 1.5) zoomed++;
      assert.ok(b.l >= -1e-6 && b.r <= W + 1e-6, `★${textAlign} ${tau}ms 글 상자 ${b.l.toFixed(1)}~${b.r.toFixed(1)} 가 캔버스 0~${W} 밖`);
    }
    assert.ok(zoomed >= 5, `[전제] ${textAlign} 크게 확대된 프레임(>1.5배)을 쟀다 — ${zoomed}`);
    const { c, boxes } = mk(); drawTracks(c, W, H, style, size, [{ line: 0, fx: 'stamp', at: 0, dur }], dur);
    const e = boxes.find((x) => x.s.includes('네'));
    assert.deepEqual([e.l, e.k], [L.segs[0].x0, 1], `${textAlign} 끝 프레임 = 제자리`);
  }
  // 가운데 정렬 짧은 글 — 확대해도 안 넘친다 ⇒ 기준점(줄 가운데) 그대로: 커진 상자의 가운데 = 줄 가운데
  const style = { ...STYLE, text: '네!', wrapEm: W / size };
  const s0 = layoutLines(fakeCtx(), style, W, H, size).segs[0];
  const { c, boxes } = mk(); drawTracks(c, W, H, style, size, [{ line: 0, fx: 'stamp', at: 0, dur }], 0);
  const b = boxes.find((x) => x.s.includes('네'));
  assert.ok(b.k > 2 && Math.abs((b.l + b.r) / 2 - (s0.x0 + s0.w / 2)) < 1e-6, `가운데 정렬 기준점이 움직였다 — ${b.l}~${b.r}`);
});

/* T19 NEW-현빈QA-GIF-CANVAS-STAMP-CLIPPED-BY-FRAME-01 — 캔버스(= 블럭 W×H · 화면 «캔버스에서 보기»와 저장 GIF 가 같은 drawTracks) 안에 커진 글 상자가 «가로·세로 둘 다» 든다.
 *   ⑴ 높이 딱 맞는 한 줄(H = 줄높이) ⑵ 블럭 폭을 거의 채운 긴 줄 — 둘 다 옛 판(가로 기준점만 밀기)은 위아래·오른쪽이 잘렸다.
 *   ⑶ 현빈 안내 «블럭에 위아래 여백을 주면 쾅이 커진다» — 같은 글 · H 를 3배로 하면 최대 배율이 커진다(상한 = 들어가는 만큼).
 *   양성대조(예측 · CTL): FX.stamp 의 배율 상한 줄(`sc = Math.min(sc, …)`) 삭제 + cy 밀기 삭제 → ⑴⑵ 빨강 · ⑶ 빨강(두 높이 최대 배율이 같은 2.2). */
test('T19 도장 — 커진 글 상자가 캔버스 안(가로·세로) · 그래도 확대는 한다 · 높이를 늘리면 최대 배율이 커진다', () => {
  const size = 24, dur = 560;
  const mk = () => {   // 가로·세로 변형을 따라가는 기록기 — 글 한 번 그릴 때 캔버스 위 상자(글자 높이 = size)
    const c = fakeCtx(); let m = [1, 0, 0]; const st = [], boxes = [];
    Object.assign(c, {
      translate(x, y) { c._tf++; m = [m[0], m[1] + m[0] * x, m[2] + m[0] * y]; }, scale(a) { c._tf++; m = [m[0] * a, m[1], m[2]]; },
      save() { st.push([m, c.filter, c._tf, c.globalAlpha]); }, restore() { [m, c.filter, c._tf, c.globalAlpha] = st.pop(); },
      fillText(s, x, y) { const w = c.measureText(s).width; boxes.push({ s: String(s), l: m[1] + m[0] * x, r: m[1] + m[0] * (x + w), t: m[2] + m[0] * (y - size / 2), b: m[2] + m[0] * (y + size / 2), k: m[0] }); },
    });
    return { c, boxes };
  };
  const run = (W, H, text) => {
    const style = { ...STYLE, text, wrapEm: W / size };
    let kmax = 0;
    for (let tau = 0; tau < dur * 0.7; tau += 14) {
      const { c, boxes } = mk(); drawTracks(c, W, H, style, size, [{ line: 0, fx: 'stamp', at: 0, dur }], tau);
      assert.ok(boxes.length, `[전제] ${W}×${H} ${tau}ms 글이 그려짐`);
      for (const b of boxes) {
        kmax = Math.max(kmax, b.k);
        assert.ok(b.l >= -1e-6 && b.r <= W + 1e-6 && b.t >= -1e-6 && b.b <= H + 1e-6,
          `★${W}×${H} «${text}» ${tau}ms 글 상자 x ${b.l.toFixed(1)}~${b.r.toFixed(1)} · y ${b.t.toFixed(1)}~${b.b.toFixed(1)} 가 캔버스 밖`);
      }
    }
    return kmax;
  };
  const tight = run(480, Math.round(size * 1.4), '네!');            // ⑴ 높이 딱 맞는 한 줄
  assert.ok(tight > 1.3, `그래도 확대는 한다(높이 딱 맞음 · 최대 ${tight.toFixed(2)}배)`);
  const long = run(480, 200, '가'.repeat(46));   // ⑵ 폭을 거의 채운 긴 줄(46자×10px)
  assert.ok(long >= 1 && long < 1.1, `[전제] 긴 줄은 상한이 거의 1 — ${long.toFixed(3)}`);
  const tall = run(480, Math.round(size * 1.4) * 3, '네!');          // ⑶ 같은 글 · 위아래 여백(높이 3배)
  assert.ok(tall > tight + 0.5, `★높이를 늘려도 최대 배율이 안 커진다 — ${tight.toFixed(2)} → ${tall.toFixed(2)}`);
});
