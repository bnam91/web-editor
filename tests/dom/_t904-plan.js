/* _t904-plan — t9-04 매트릭스 분모·종 묶음·칸 표. 소스에서 기계로 뜬다, 손으로 종을 적지 않는다.
 * 축 A 종 = js/editor.js SECTION_BLOCK_TYPE_SEL. 축 B 자리 넷. 조작 18 = 플랜 기본 10 + 심층 11 − 판정이 흡수하는 셋(⌫ ⌘Z 저장).
 * 묶음(겹친다): G1 입구 몸에 제 프레임 분기(_activeFrame·resolveInsertFrame) · G2 입구가 insertAfterSelected 를 부른다 · G3 RERENDER_KINDS 또는 제 바인더 · G4 CHILD_BLOCK_SEL 에 없다.
 * ⌘D · 다중 선택 패널 손 명부에 없는 종은 gaps 칸에 적는다. 입구 없는 종은 빨강이 아니라 회색(gray). route:group = 떠 있는 종이라 프레임 안 칸은 ⌘G 로 넣는다. */
const fs = require('fs');
const path = require('path');
const PLACES = ['section', 'free', 'stack', 'deep2'];
/* 칸 조작 — ticket 은 어느 건이 재는가 · perPlace false 면 자리와 안 곱한다(플랜 t9-07) */
const OPS = [
  ['insert', 't9-05'], ['drag', 't9-05'], ['pick', 't9-05'], ['dup', 't9-05'], ['copypaste', 't9-05'],
  ['panel', 't9-06'], ['freestack', 't9-06'], ['group', 't9-06'], ['layerorder', 't9-06'], ['multipanel', 't9-06'], ['effects', 't9-06'], ['clip', 't9-06'], ['scratch', 't9-06'], ['ab', 't9-06'], ['framebg', 't9-06'],
  ['export', 't9-07', false], ['mcp', 't9-07', false], ['crosspaste', 't9-07', false],
].map(([id, ticket, perPlace = true]) => ({ id, ticket, perPlace }));

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
const kindsOf = (root) => { const m = read(root, 'js/editor.js').match(/const SECTION_BLOCK_TYPE_SEL = \[([\s\S]*?)\]\.join\(', '\);/); if (!m) throw new Error('SECTION_BLOCK_TYPE_SEL 을 못 떴다'); return [...m[1].matchAll(/'\.([a-z0-9-]+)'/g)].map((x) => x[1]); };
const flat = (s) => s.replace(/-/g, '').toLowerCase();
/* 줄 시작 선언 함수 전부의 몸 표(이 저장소 꼴: 줄 시작 } 로 닫는다). 이름으로 찾아 없으면 아래에서 멈춘다 — 조용히 눈멀지 않는다 */
const fnTable = (sources) => { const t = new Map(); for (const src of sources) for (const m of src.matchAll(/^(?:export )?(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/gm)) { if (t.has(m[1])) continue; const rest = src.slice(m.index); const e = rest.search(/\n}\s*(?:\n|$)/); t.set(m[1], e < 0 ? rest : rest.slice(0, e)); } return t; };
const tokens = (s) => new Set([...s.matchAll(/\.([a-z0-9][\w-]*-block)\b/g)].map((x) => x[1]));
/* 줄 앵커 뒤 첫 묶음의 토큰 */
const listAfter = (src, anchor, stop) => { const i = src.indexOf(anchor); if (i < 0) return null; const rest = src.slice(i); return tokens(rest.slice(0, rest.indexOf(stop) + stop.length)); };

function planOf(root) {
  const kinds = kindsOf(root);
  const sources = walk(path.join(root, 'js')).map((f) => fs.readFileSync(f, 'utf8'));
  const adds = new Map();
  for (const s of sources) for (const m of s.matchAll(/window\.(add[A-Za-z0-9]*Block)\s*=/g)) adds.set(m[1].toLowerCase(), m[1]);
  const sl = read(root, 'js/io/save-load.js');
  const rerender = new Set([...sl.slice(sl.indexOf('const RERENDER_KINDS'), sl.indexOf('const RERENDER_SEL')).matchAll(/\['([a-z0-9-]+-block)'/g)].map((x) => x[1]));
  const ownBinder = new Set(['sticker-block', 'gradient-block'].filter((k) => sl.includes(`bind${k[0].toUpperCase()}${k.slice(1, k.indexOf('-'))}Select`)));
  const child = listAfter(read(root, 'js/block-drag.js'), 'const CHILD_BLOCK_SEL', ';');
  const fns = fnTable(sources);
  if (!fns.has('duplicateSelected')) throw new Error('duplicateSelected 를 못 찾았다 — 자가 낡았다');
  const dup = listAfter(fns.get('duplicateSelected'), 'const selBlock = document.querySelector(', ');');
  const multi = listAfter(read(root, 'js/props/prop-multisel.js'), 'const BLOCK_SEL', ';');
  for (const [n, l] of [['CHILD_BLOCK_SEL', child], ['⌘D selBlock', dup], ['prop-multisel BLOCK_SEL', multi]]) if (!l || l.size < 10) throw new Error(`${n} 를 못 떴다 — 자가 낡았다`);
  const rows = kinds.map((cls) => {
    /* 이름이 안 맞으면(icon-block ↔ addIconifyBlock) 그 클래스를 만드는 파일의 입구를 본다 */
    let entry = adds.get('add' + flat(cls)) || null;
    if (!entry) for (const s of sources) if (new RegExp(`className\\s*=\\s*['"]${cls}['"]`).test(s)) { entry = [...s.matchAll(/window\.(add[A-Za-z0-9]*Block)\s*=/g)].map((x) => x[1])[0] || null; if (entry) break; }
    const body = entry ? fns.get(entry) : null;
    if (entry && !body) throw new Error(`입구 ${entry} 의 몸을 못 찾았다 — 묶음을 못 가른다`);
    const groups = [];
    if (body && /_activeFrame|resolveInsertFrame/.test(body)) groups.push('G1');
    if (body && body.includes('insertAfterSelected(')) groups.push('G2');
    if (rerender.has(cls) || ownBinder.has(cls)) groups.push('G3');
    if (!child.has(cls)) groups.push('G4');
    /* 입구 몸에 프레임 분기도 insertAfterSelected 도 없다 = 섹션 직속으로 떠 있는 종 — 프레임 안은 ⌘G 로만 든다 */
    const floats = !!body && !groups.includes('G1') && !groups.includes('G2');
    return { cls, entry, floats, groups, gaps: [!dup.has(cls) && 'dup', !multi.has(cls) && 'multipanel'].filter(Boolean) };
  });
  /* 전수 = G1·G3·G4 또는 손 명부 빈 종 · G2 만이면 대표(묶음 첫 종)가 잰다 */
  const onlyG2 = rows.filter((r) => r.groups.join() === 'G2' && !r.gaps.length);
  const rep = onlyG2[0]?.cls || null;
  rows.forEach((r) => { r.tier = !r.entry ? 'gray' : onlyG2.includes(r) ? (r.cls === rep ? 'rep' : 'covered') : 'all'; });
  /* 칸 — 전 칸을 적는다. 페어와이즈: 종 번호+조작 번호로 자리 둘을 돌린다 */
  const cells = [];
  rows.forEach((r, i) => OPS.forEach((op, j) => {
    const a = (i + j) % PLACES.length, picked = op.perPlace ? [PLACES[a], PLACES[(a + 2) % PLACES.length]] : [];
    PLACES.forEach((place) => {
      let run = false, why = null;
      if (r.tier === 'gray') why = '입구 없음';
      else if (r.tier === 'covered') why = `G2 대표 ${rep} 가 잰다`;
      else if (!op.perPlace) { run = place === 'section'; if (!run) why = '자리와 안 곱한다'; }
      else { run = picked.includes(place); if (!run) why = '페어와이즈 밖'; }
      cells.push({ kind: r.cls, place, op: op.id, ticket: op.ticket, run, why, route: run && r.floats && place !== 'section' ? 'group' : 'entry', measured: false });
    });
  }));
  return { kinds: rows, places: PLACES, ops: OPS, cells };
}
const summary = (p) => { const n = (f) => p.cells.filter(f).length; return { kinds: p.kinds.length, groups: Object.fromEntries(['G1', 'G2', 'G3', 'G4'].map((g) => [g, p.kinds.filter((k) => k.groups.includes(g)).length])), tiers: Object.fromEntries(['all', 'rep', 'covered', 'gray'].map((t) => [t, p.kinds.filter((k) => k.tier === t).length])), total: p.cells.length, run: n((c) => c.run), byTicket: Object.fromEntries(['t9-05', 't9-06', 't9-07'].map((t) => [t, n((c) => c.run && c.ticket === t)])) }; };
module.exports = { planOf, summary, kindsOf, PLACES, OPS };
