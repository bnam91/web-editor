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
    fillText: (s, x, y) => calls.push({ op: 'text', s: String(s), x, y, a: ctx.globalAlpha, f: ctx.filter, tf: ctx._tf, font: ctx.font, fill: ctx.fillStyle }),
    fillRect: (x, y, w, h) => calls.push({ op: 'rect', x, y, w, h }),
    _tf: 0, _stack: [],
    save() { ctx._stack.push([ctx.filter, ctx._tf, ctx.globalAlpha]); }, restore() { [ctx.filter, ctx._tf, ctx.globalAlpha] = ctx._stack.pop(); },
    translate() { ctx._tf++; }, scale() { ctx._tf++; }, beginPath() {}, rect() {}, clip() {},
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
