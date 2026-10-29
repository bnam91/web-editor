/* _golden-guard — bt2-safety 골든 «갱신 가드»의 순수 함수(★224 에서 spec 밖으로 뺌 · 유닛이 잰다: tests/unit/golden-guard-224.test.mjs).
 *   ⛔골든에 «쓰는» 값은 손대지 않는다 — 이 파일은 «견주기»만 한다(공백 정규화 · 토막 diff · 지움 판정).
 * ★224(GOLDEN-GUARD-READS-ATTR-CHANGE-AS-DELETE-01 · 지디 09:0x 판정) — «id 로 맞춘 뒤 속성 차집합».
 *   ⚰️옛 꼴: 토막(태그 통째) 차집합이라 «같은 id 의 속성만 바뀜»(예: 421798a8 열 간격 min 0 → −50)을 «지움 + 더함»으로 읽어
 *     정당한 갱신을 거절했다(170 실측: 8 상태 × 2 = 16 «지움» 이 전부 그 min 바뀜). 옛 머리말은 «그것도 사람이 봐야 하니 거절이 맞다»였으나
 *     ⇒ 거절은 가드를 끄는 쪽으로 몰고(죽은 가드) · 사람이 볼 몫은 «바뀐 id» 목록으로 남긴다(거절 아님).
 *   판정: 지운 토막과 더한 토막 중 «같은 태그 이름 ∧ 같은 id» 짝은 «바뀜»(changed) — 지움에서 뺀다.
 *     id 가 사라진 토막 · id 없는 토막의 지움 · 태그가 바뀐 같은 id 는 그대로 «지움»(BT2_T6_MUT=del 은 id 없는 prop-row 를 빼므로 여전히 거절). */
'use strict';
const _tokRaw = (s) => String(s).split(/(?<=>)/);
const _tok = (s) => _tokRaw(s).map(t => t.replace(/\s+/g, ' ').trim()).filter(t => t !== '');
function _diffTokens(a, b) {           // Myers O(ND) — 같은 토막이 대부분이라 싸다
  const N = a.length, M = b.length, max = N + M, v = new Map([[1, 0]]), trace = [];
  for (let d = 0; d <= max; d++) {
    trace.push(new Map(v));
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1))) ? (v.get(k + 1) ?? 0) : (v.get(k - 1) ?? 0) + 1;
      let y = x - k;
      while (x < N && y < M && a[x] === b[y]) { x++; y++; }
      v.set(k, x);
      if (x >= N && y >= M) {
        const del = [], add = [];
        let cx = N, cy = M;
        for (let dd = d; dd > 0; dd--) {
          const pv = trace[dd]; const kk = cx - cy;
          const prevK = (kk === -dd || (kk !== dd && (pv.get(kk - 1) ?? -1) < (pv.get(kk + 1) ?? -1))) ? kk + 1 : kk - 1;
          const px = pv.get(prevK) ?? 0, py = px - prevK;
          while (cx > px && cy > py) { cx--; cy--; }
          if (cx === px) add.push(b[py]); else del.push(a[px]);
          cx = px; cy = py;
        }
        return { del, add };
      }
    }
  }
  return { del: a.slice(), add: b.slice() };
}
const _idOf = (t) => (/^<([a-zA-Z][\w-]*)\b[^>]*\sid="([^"]+)"/.exec(t) || []);
/** 지운·더한 토막에서 «같은 태그 ∧ 같은 id» 짝을 «바뀜»으로 뽑아낸다 → { del, add, changed:[{ id, from, to }] } */
function _pairChanged(del, add) {
  const left = [], changed = [], used = new Set();
  for (const d of del) {
    const [, tag, id] = _idOf(d);
    const k = id ? add.findIndex((a, i) => !used.has(i) && _idOf(a)[1] === tag && _idOf(a)[2] === id) : -1;
    if (k >= 0) { used.add(k); changed.push({ id, from: d, to: add[k] }); } else left.push(d);
  }
  return { del: left, add: add.filter((_, i) => !used.has(i)), changed };
}
/* ★292 ⒠ — 이 가드가 «읽을 수 있는 꼴»은 상태마다 «<태그> 를 품은 문자열» 하나뿐이다.
 *   그 밖(Buffer · 수 · 객체 · 배열 안 객체 · 태그 없는 글자)을 넣으면 ⒤PNG=모든 바뀜을 지움으로 셈 · ⒥수=metrics 안이 안 보임 ·
 *   ⒦섞인 객체=배열 원소 개수만 봄 ⇒ 조용한 통과도 조용한 거절도 아니게 «무엇이 · 왜»를 대고 던진다.
 *   ★배열 골든(잎이 전부 HTML)은 읽는다 — 다만 키가 자리(0,1,…)라 첫 원소를 빼거나 앞에 끼우면 뒤가 다 밀려
 *     dels 가 원소 수만큼 뜬다(s3v-icon-text 5 → 5) · 그 수는 «실제 지움»이 아니라 «자리 밀림»이다. */
const _READABLE = /<[a-zA-Z][\w-]*[\s>]/;
function _assertReadable(name, side, obj) {
  if (obj === null || typeof obj !== 'object' || Buffer.isBuffer(obj)) {
    throw new Error(`★_golden-guard(${name}): ${side} 골든 통째가 «상태 → HTML 문자열» 묶음이 아니다(꼴 ${Buffer.isBuffer(obj) ? 'Buffer' : obj === null ? 'null' : typeof obj}) — 이 가드는 이 꼴을 못 잰다`);
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'string' && _READABLE.test(v)) continue;
    const kind = Buffer.isBuffer(v) ? 'Buffer' : Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v === 'string' ? 'string(태그 없음)' : typeof v;
    throw new Error(`★_golden-guard(${name}): ${side} 상태 «${k}» 는 이 가드가 못 잰다 — 값이 «<태그> 를 품은 문자열»이 아니다(꼴 ${kind})`);
  }
}
function _guardNoDeletes(name, oldObj, got) {
  _assertReadable(name, '옛', oldObj || {});
  _assertReadable(name, '새', got);
  const report = [];
  for (const k of new Set([...Object.keys(oldObj || {}), ...Object.keys(got)])) {
    if (!(k in got)) { report.push({ state: k, del: ['(상태 통째로 사라짐)'], add: [] }); continue; }
    if (!(k in (oldObj || {}))) continue;
    const raw = _diffTokens(_tok(oldObj[k]), _tok(got[k]));
    const { del, add, changed } = _pairChanged(raw.del, raw.add);
    if (del.length || add.length || changed.length) report.push({ state: k, del, add, changed });
  }
  const dels = report.filter(r => r.del.length);
  const addedIds = [...new Set(report.flatMap(r => r.add.join('').match(/id="[^"]+"/g) || []))];
  const changedIds = [...new Set(report.flatMap(r => (r.changed || []).map(c => `id="${c.id}"`)))];
  return { dels, addedIds, changedIds, report };
}

module.exports = { _tok, _diffTokens, _pairChanged, _guardNoDeletes };
