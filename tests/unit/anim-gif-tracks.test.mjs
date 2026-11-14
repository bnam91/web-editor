/* anim-gif-tracks.test.mjs — GIF V2 «줄별 타임라인»(js/fx/anim-gif-tracks.js)을 «실제로 그려» 잠근다(가짜 ctx = 호출 기록기).
 * 렌더 실행 단위다 — node --check 는 스코프 밖 이름을 못 잡는다(e32eabd44 교훈 · 브리프 운영 규칙).
 * F1·F2(도장 · 흐림→선명 · 블러 휩): T6 곡선 수 · T7 끝 프레임 = 제자리·흐림 없음·변형 없음 · 시작 = 흐림.
 *   양성대조(실측은 커밋 메시지): stampParams 의 «쾅» 갈래(p ≥ 0.7)를 지우면 T6 빨강 · FX.stamp 의 `_blur(ctx, m.blur)` 삭제 → T7(시작 흐림) 빨강.
 * 양성대조(예측): drawTracks 의 `if (p == null || …) continue;` 를 지우면 T4(아직 안 나온 줄이 그려짐) 빨강 ·
 *   normTracks 의 «앞 줄 끝에 시작»(prev.at + prev.dur) 을 0 으로 → T1 빨강.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normTracks, totalMs, localT, layoutLines, drawTracks, TRACK_FX, FX, V2_FX, stampParams, blurInParams, whipParams } from '../../js/fx/anim-gif-tracks.js';

function fakeCtx() {
  const calls = [];
  const ctx = {
    calls, font: '', textBaseline: '', textAlign: '', fillStyle: '', globalAlpha: 1, shadowColor: '', shadowBlur: 0, filter: 'none', letterSpacing: '0px',
    measureText: (s) => ({ width: String(s).length * 10 }),
    fillText: (s, x, y) => calls.push({ op: 'text', s: String(s), x, y, a: ctx.globalAlpha, f: ctx.filter, tf: ctx._tf }),
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
