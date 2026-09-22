/* ══════════════════════════════════════════════════════════════════════════
   name-axes-to-markup — T-049 2차 : 「이름」의 **나머지 축**을 잠근다
   ──────────────────────────────────────────────────────────────────────────
   ★왜 이 파일이 따로 필요한가
     project-name-to-markup.test.mjs 는 로스터를 «행위»로 만들었다. 훌륭하다.
     그런데 **로스터에 들어올 자격(ORIGINS)이 손목록**이라 — 프로젝트·폴더·탭 한 축만
     열려 있었다. 레이어·섹션·변수·브랜치·아이콘·폰트·채팅프로필 이름은
     **검사 대상에 한 번도 들어온 적이 없다.** 그래서 «초록인 채로» 열려 있었다.
     ⇒ 여기서는 같은 판정기를 «넓힌 축»(AXES.NAMES)으로 돌린다.
       판정기·로스터 만드는 법은 그대로다. 바뀐 것은 «문»뿐이다.

   ★이 파일이 잠그는 것도 «자리»가 아니라 «꼴»이다.
     ⛔파일:줄을 적지 마라. 몇 곳인지도 적지 마라(31·56 같은 수는 늙는다).
       X4 가 「로스터의 어느 파일에 새 줄이 생겨도 빨개지는가」를 기계에게 묻는다 —
       그게 「한 곳만 고치면 안 고친 것과 같다」를 기계로 옮긴 것이다.

   ⛔소스 «모양»만 잰다. 화면에서 어떻게 보이는지는 짝 검사가 잰다 —
     tests/dom/name-render-text-not-structure.dom.spec.js (진짜 렌더러로 «글자냐 구조냐»).
   ⛔공격 문자열을 적지 않는다. 재는 것은 «값이 틀로 이어지는가»라는 구조뿐이다.
   ⚠️고치는 모양은 레포에 이미 있다 — 이름은 textContent/value/createTextNode 로 «항상 글자»로.
     **이름을 «검사»하지 마라**(멀쩡한 이름이 죽는다). N3 가 못박은 규약 그대로다.
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');
const { normalizeEol, toPosix } = _req('./_srcread.js');
const { AXES, scan, touchesOrigin, lineOf } = _req('./_name-to-markup.js');
const SINK = _req('../_name-sink-scan.js');   // 규칙 S/P — «그리는 자리»로 훑는 두 번째 계측기
/* 레포 전수 훑기는 «한 번»만 — X5 와 XS3 가 같은 것을 두 번 훑으면 그만큼 느려진다. */
let _sinkHits = null;
const sinkHits = () => (_sinkHits ||= SINK.scan(ROOT));

const AXIS = AXES.NAMES;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

/* ★제거기의 맹점을 «내 눈 앞에서만» 막는다.
   tests/unit/_strip-comments.js 는 «줄 주석 안의 블록 주석 여는 표기»를 진짜 블록 주석으로 읽어
   그 뒤 코드를 통째로 지운다(실측: js/branch-system.js:9 하나가 그 파일 74줄을 가렸고,
   그 안에 인라인 핸들러 2개가 들어 있었다 — 아래 XS4 가 그 자리를 빨갛게 만든다).
   ⛔공용 제거기를 여기서 «고치지» 않는다 — 다른 게이트 수십 개가 그걸 쓴다. 정본 수리는 따로다.
   ⇒ 넣기 «전»에 줄 주석 안의 그 표기만 무해한 두 글자로 바꿔 둔다.
     ★두 글자를 두 글자로 바꾼다 — 길이가 같아야 줄번호·오프셋이 안 밀린다.
   ⛔원문(raw)을 그냥 쓰면 안 된다: 주석 속 백틱이 템플릿 토크나이저를 끌고 가서
     줄번호가 통째로 어긋난다(실측: G7 이 117→169 로 틀리게 가리켰다). */
function safeStrip(raw) {
  const masked = raw.split('\n').map((ln) => {
    const i = ln.indexOf('//');
    if (i < 0) return ln;
    return ln.slice(0, i) + ln.slice(i).replace(/\/\*/g, '/#').replace(/\*\//g, '#/');
  }).join('\n');
  return stripComments(masked);
}

let _sources = null;
function sources() {
  if (_sources) return _sources;
  const files = [];
  for (const d of ['js', 'pages', 'main']) walk(path.join(ROOT, d), files);
  const idx = path.join(ROOT, 'index.html');
  if (fs.existsSync(idx)) files.push(idx);
  _sources = files.map(f => {
    const raw = normalizeEol(fs.readFileSync(f, 'utf8'));
    return { rel: toPosix(path.relative(ROOT, f)), raw, code: safeStrip(raw) };
  });
  return _sources;
}

let _roster = null;
const roster = () => (_roster ||= sources().filter(s => touchesOrigin(s.code, AXIS)));
const _scans = new Map();
const scanOf = (f) => { if (!_scans.has(f.rel)) _scans.set(f.rel, scan(f.code, AXIS)); return _scans.get(f.rel); };

/* ───────────────────────────── 전제 · 양성대조 ───────────────────────────── */

test('X1 ★전제 + 양성대조 — 넓힌 «문»이 전부 소스에 실재한다', () => {
  const all = sources();
  assert.ok(all.length > 50, `★훑은 파일이 ${all.length}개뿐이다 — 이 검사가 «안 돈» 것이지 통과가 아니다`);
  const blob = all.map(s => s.code).join('\n');
  const missing = AXIS.ORIGINS.filter(o => !blob.includes(o));
  assert.deepEqual(missing, [],
    '★접근자가 소스에서 사라졌다: ' + missing.join(', ') + '. ' +
    '리팩터로 이름이 바뀐 것이라면 _name-to-markup.js 의 AXIS_NAMES 부터 고쳐라 — ' +
    '안 고치면 이 검사가 «조용히 0건»이 되어 늘 초록이 된다');
  assert.ok(roster().length > 0, '★로스터가 비었다 — 위와 같은 사유다');
});

test('X2 ★검사가 헛돌지 않는다 — 이름을 «실제로 그리는» 파일이 로스터에 들고 값도 잡힌다', () => {
  /* ⛔여기 적은 셋은 «표본»이지 명부가 아니다. 로스터 자체는 위에서 행위로 만든다.
     레이어(⑤) · 변수(⑥) · 브랜치(⑦) — 서로 다른 축에서 하나씩 골랐다. */
  const probes = ['js/panels/layer-panel-items.js', 'js/variable-binding.js', 'js/branch-system.js'];
  for (const rel of probes) {
    const f = roster().find(s => s.rel === rel);
    assert.ok(f, `★${rel} 이 로스터에 없다 — 이름을 내주는 문에 안 닿는다고 읽혔다. ` +
                 '파일이 옮겨졌으면 이 표본을 고치고, 아니라면 AXIS_NAMES 의 문을 봐라');
    const { objects, names } = scanOf(f);
    assert.ok(objects.size + names.size > 0,
      `★${rel} 에서 이름이 실린 값을 하나도 못 잡았다 — 이 검사가 그 파일을 «안 보고» 있다`);
  }
});

test('X3 ★대조군 — 같은 판정기가 «막힌 자리»는 초록으로 읽는다', () => {
  /* 이게 없으면 X5 의 빨강이 「검사가 그냥 다 빨간 것」과 구분되지 않는다.
     ★«지금 트리에 초록 자리가 있나»로 재지 않는다 — 고치고 나면 그런 자리가 «없어질 수»
       있고(공용 함수로 걷으면 보간 자체가 사라진다), 그러면 대조군이 고친 뒤에 무너진다.
       그래서 같은 로스터 파일에 «두 줄»을 넣어 판정기가 둘을 갈라 보는지로 잰다. */
  const f = roster()[0];
  assert.ok(f, '★로스터가 비었다 — X1 부터 봐라');

  const bare = f.code + '\n;(function(){ var _p = document.createElement("div");'
             + ' _p.innerHTML = `<span>${document.body.dataset.layerName}</span>`; })();\n';
  const wrapped = f.code + '\n;(function(){ var _p = document.createElement("div");'
             + ' _p.innerHTML = `<span>${_escHtml(document.body.dataset.layerName)}</span>`; })();\n';

  const base = scan(f.code, AXIS).hits.length;
  assert.equal(scan(bare, AXIS).hits.length, base + 1,
    '★안 거른 줄을 넣었는데 빨강이 안 늘었다 — 판정기가 그 꼴을 «못 본다»');
  assert.equal(scan(wrapped, AXIS).hits.length, base,
    '★이스케이프를 지나는 줄까지 빨강으로 셌다 — 그러면 이 검사는 «전부 빨강»이라 못 믿는다');
  assert.equal(scan(wrapped, AXIS).escaped.length, scan(f.code, AXIS).escaped.length + 1,
    '★막힌 줄을 «막혔다»로도 안 셌다 — 초록 쪽 계수가 죽어 있다');

  /* 참고(판정 아님) — 지금 트리에서 «이스케이프를 지나는» 이름 보간이 몇 건인지 같이 적는다. */
  let live = 0;
  for (const g of roster()) live += scanOf(g).escaped.length;
  assert.ok(live >= 0, `참고: 지금 트리의 초록 보간 ${live}건`);
});

/* ───────────────────────────── 음성대조 (G3) ───────────────────────────── */

test('X4 ★음성대조(로스터 전수) — 로스터의 «어느 파일»에 새 줄이 생겨도 잡힌다', () => {
  /* ★이 카드의 핵심. 「한 곳만 막으면 안 막은 것과 같다」를 기계에게 맡기는 자리다.
     파일마다 «그 파일에서 잡힌 이름 값»을 틀에 이어붙이는 줄을 한 줄 덧붙여 빨개지는지 본다.
     별명이 안 잡힌 파일은 «그 축의 문 자체»를 탐침으로 쓴다(그 파일에 새 자리가 생기는 꼴). */
  const blind = [];
  let byAlias = 0, byOrigin = 0;
  for (const f of roster()) {
    const { objects, names } = scanOf(f);
    let carrier;
    if (names.size) { carrier = [...names][0]; byAlias++; }
    else if (objects.size) { carrier = `${[...objects][0]}.name`; byAlias++; }
    else { carrier = '_probeEl.dataset.layerName'; byOrigin++; }
    const mutated = f.code
      + '\n;(function(){ var _probeEl = document.body; var _probe = document.createElement("div");'
      + ' _probe.innerHTML = `<span>${' + carrier + '}</span>`; })();\n';
    if (scan(mutated, AXIS).hits.length === 0) blind.push(`${f.rel} (${carrier})`);
  }
  const probed = byAlias + byOrigin;
  assert.ok(probed >= 40,
    `★탐침을 ${probed}개 파일에만 놨다(별명 ${byAlias} · 문 ${byOrigin}) — 로스터가 얇아졌다. X1/X2 부터 봐라`);
  assert.deepEqual(blind, [],
    '★로스터 안인데 새 자리를 못 잡는 파일이 있다 — 이 검사의 사각지대다:\n  ' + blind.join('\n  '));
});

/* ───────────────────────────── 전수 (G1) ───────────────────────────── */

/* ═══════════════════════════════════════════════════════════════════════
   ★두 계측기를 «함께» 돌린다 — 하나로는 반쪽이다 (실측)
     · 축(AXES.NAMES)  — 「앱이 이름을 내주는 문」에서 출발한다. 브랜치·변수 속성 자리를 잡는다.
     · 규칙 S/P(_name-sink-scan) — 「class 가 …-name 인 칸에 무엇이 박히나」로 본다.
       문으로는 안 잡히는 갈래(층 이름표 label · 글꼴 표시 이름)를 잡는다.
     기준선 1972a80 에서 축 64 · 싱크 62 였고 «합집합»은 66(자리) = 61(파일+앵커)이었다.
     ⇒ 한쪽만 초록으로 만들면 다른 쪽이 그대로 열린다. 그래서 «합쳐서» 하나의 목록으로 낸다.
   ═══════════════════════════════════════════════════════════════════════ */

const anchorOf = (s) => String(s).replace(/\s+/g, ' ').trim().slice(0, 90);

/* ═══ 검증된 «안전한 싱크» ═══════════════════════════════════════════════
   이름을 «인자»로 받아 자기 안에서 글자로 넣는 공용 함수. 그 자리의 보간은
   「이름을 틀에 이어붙이는 것」이 아니라 「안전한 함수에 넘기는 것」이라 빨강이 아니다.
   ⛔말로 믿지 않는다 — 아래 SAFE_SINKS 의 각 줄은 «그것을 증명하는 검사»를 함께 적고,
     X8 이 ⑴그 함수가 소스에 실재하나 ⑵증명하는 검사 파일이 실재하나 를 «매번» 다시 본다.
     둘 중 하나라도 없어지면 빨강 — 안전 근거가 조용히 사라지는 길을 막는다.
   ★증명의 알맹이는 «소스»가 아니라 «화면»이다: 그 spec 이 진짜 렌더러로 30여 자리를 그려
     표식이 글자로 남는지 센다(기준선에서 구조 30 → 이 판 구조 0 · 글자 32 로 뒤집혔다). */
const SAFE_SINKS = [
  { fn: 'blockHeaderHTML', by: 'tests/dom/name-render-text-not-structure.dom.spec.js',
    why: '속성 패널 헤더 공용 함수 — 이름을 인자로 받아 안에서 글자로 넣는다' },
];
const SAFE_SINK_CALL = new RegExp(`^\\s*(?:${SAFE_SINKS.map(s => s.fn).join('|')})\\s*\\(`);

test('X8 ★안전한 싱크의 «근거»가 살아 있다', () => {
  const blob = sources().map(s => s.code).join('\n');
  const dead = [];
  for (const s of SAFE_SINKS) {
    if (!new RegExp(`\\b${s.fn}\\b`).test(blob)) dead.push(`${s.fn} — 소스에서 사라졌다`);
    if (!fs.existsSync(path.join(ROOT, s.by))) dead.push(`${s.fn} — 증명하는 검사(${s.by})가 없다`);
  }
  assert.deepEqual(dead, [],
    '★«안전하다»고 빼 준 자리의 근거가 사라졌다 — 근거 없이 빼면 그게 조용한 구멍이다:\n  ' + dead.join('\n  '));
});

/** 두 계측기의 빨강을 합쳐 [{file, line, anchor, by}] 로. 같은 (파일,앵커)는 한 줄로 묶는다. */
let _red = null;
function redSites() {
  if (_red) return _red;
  const map = new Map();
  const add = (file, line, anchor, by) => {
    const k = `${file}|${anchor}`;
    if (!map.has(k)) map.set(k, { file, line, anchor, by: new Set([by]) });
    else { map.get(k).by.add(by); map.get(k).line = Math.min(map.get(k).line, line); }
  };
  const toSafeSink = (txt) => SAFE_SINK_CALL.test(txt);
  for (const f of roster()) for (const h of scanOf(f).hits) if (!toSafeSink(h.text)) add(f.rel, lineOf(f.code, h.at), anchorOf(h.text), '축');
  for (const h of sinkHits()) if (!h.escaped && !toSafeSink(h.expr)) add(h.file, h.line, anchorOf(h.expr), '싱크');
  _red = [...map.values()].sort((a, b) => (a.file + String(a.line).padStart(6, '0')).localeCompare(b.file + String(b.line).padStart(6, '0')));
  return _red;
}

/* ══════════════════════════════════════════════════════════════════════════
   ★면제 목록 = «아직 안 닫은 자리» 목록이다. 남은 줄 수가 곧 진척도고, 0 이 완료다.
   ──────────────────────────────────────────────────────────────────────────
   ⛔「이름만 빼는 면제」 금지 — 줄마다 «왜 아직 면제인지»를 적는다(N3 규약).
   ★키는 «줄번호가 아니라 앵커»(그 자리에 실제로 적혀 있는 식)다.
     줄번호로 잠그면 위쪽을 한 줄만 고쳐도 명부가 통째로 어긋나 «엉뚱한 자리»를 면제한다.
     앵커로 잠그면 그 자리를 고치는 순간 앵커가 사라지고 → X7 이 「죽은 면제」로 빨개진다.
     ⇒ 덩이를 닫으면 그 뭉치를 «지워야» 초록이 된다. 지울 수밖에 없게 만든 것이다.
   ★덩이 단위로 묶어 뒀다 — 한 덩이를 닫고 한 뭉치를 지운다.
   ⛔여기에 공격 문자열은 없다. 적힌 것은 «소스에 이미 있는 식» 그대로다.
═══════════════════════════════════════════════════════════════════════════ */
const EXEMPT = [
  /* ★지금은 «비어 있다» — 이 게이트는 «빨갛게» 둔다.
     워크트리는 서로 분리돼 있어 여기가 빨개도 남의 트리는 안 막힌다. 막히는 건 dev 에 머지할 때뿐이고,
     게이트와 고침을 «같이» 올리기로 했다(2026-09-22 방침). ⇒ 남은 빨강 건수가 그대로 남은 일이다.
     면제를 정말 둬야 한다면 [파일, 앵커, 이유] 로 적어라 — ⛔이름만 빼는 면제는 금지(N3 규약).
     ★키는 «줄번호가 아니라 앵커»다. 줄번호로 잠그면 위를 한 줄만 고쳐도 엉뚱한 자리를 면제한다.
     아래 X7 이 «죽은 면제»를 빨갛게 만들어, 닫은 자리는 지울 수밖에 없게 한다. */
];

const exemptKey = new Map(EXEMPT.map(([f, a, why]) => [`${f}|${a}`, why]));

test('X5 ★전수 — 이름이 마크업 틀로 이어지는 «안 닫힌» 자리가 면제 목록 밖에 없다', () => {
  const bad = redSites()
    .filter(r => !exemptKey.has(`${r.file}|${r.anchor}`))
    .map(r => `${r.file}:${r.line} [${[...r.by].join('+')}]  \${${r.anchor}}`);
  assert.deepEqual(bad, [],
    `★이름이 «걸러지지 않고» 마크업 틀로 들어가는 자리 ${bad.length}건. ` +
    '고치는 모양은 레포에 이미 있다(이름은 textContent/value/createTextNode 로 «항상 글자»). ' +
    '⛔새 esc 헬퍼를 만들지 마라. ⛔이름을 «검사»하지 마라. ' +
    '정말 무해하면 EXEMPT 에 «이유와 함께» 올려라:\n  ' + bad.join('\n  '));
});

test('X7 ★면제가 살아 있다 — 죽은 면제 줄은 «지워야» 한다(진척도)', () => {
  /* ★이게 없으면 면제 목록이 그냥 쓰레기통이 된다. 고친 자리는 앵커가 사라지므로
     그 줄은 «죽은 면제»가 되고, 여기서 빨개져 지우게 만든다.
     ⇒ 남은 줄 수 = 남은 일. 0 이 되는 순간이 이 카드의 완료다. */
  const live = new Set(redSites().map(r => `${r.file}|${r.anchor}`));
  const dead = EXEMPT.filter(([f, a]) => !live.has(`${f}|${a}`)).map(([f, a, why]) => `${f}  \${${a}}  — ${why}`);
  const left = EXEMPT.length - dead.length;
  assert.deepEqual(dead, [],
    `★닫힌 자리가 면제 목록에 남아 있다 — 그 줄을 지워라(남은 면제 ${left}줄). ` +
    '지우지 않으면 다음에 같은 꼴이 생겨도 조용히 통과한다:\n  ' + dead.join('\n  '));
});

/* ── 싱크 계측기 자체 검사 — 「검사가 있다」와 「그 자리를 잰다」는 다른 말이다 ── */

test('XS1 ★싱크 계측기 — 막힌 자리·안 막힌 자리·안전한 길을 가려낸다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'namesink-'));
  fs.mkdirSync(path.join(dir, 'js'));
  fs.writeFileSync(path.join(dir, 'js', 'probe.js'), `
    const _escHtml = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    function 안막힘(el)   { box.innerHTML = \`<span class="thing-name">\${el.dataset.layerName || 'X'}</span>\`; }
    function 막힘(el)     { box.innerHTML = \`<span class="thing-name">\${_escHtml(el.dataset.layerName || 'X')}</span>\`; }
    function 별칭으로막힘(el) {
      const safe = _escHtml(el.dataset.layerName || 'X');
      box.innerHTML = \`<span class="thing-name">\${safe}</span>\`;
    }
    function 안전한길(el) { const s = document.createElement('span'); s.textContent = el.dataset.layerName; box.appendChild(s); }
    function 숫자칸(list) { box.innerHTML = \`<span class="thing-name">\${list.length}개</span>\`; }
  `, 'utf8');
  const hits = SINK.scan(dir);
  assert.equal(hits.filter(h => !h.escaped).length, 1, '안 막힌 자리는 1건이어야 한다');
  assert.equal(hits.filter(h => h.escaped).length, 2, '막힌 자리는 2건이어야 한다(직접·별칭)');
  assert.equal(hits.length, 3, 'textContent 로 넣는 «안전한 길»과 «숫자 칸»은 아예 안 걸려야 한다');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('XS2 ★싱크 계측기 — «새로 생긴» 자리가 손 안 대고 걸린다', () => {
  /* 오늘 레포에 «없는» 모양 — 파일명도 클래스도 dataset 키도 처음 보는 것 */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'namesink-new-'));
  fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'js', 'props'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'js', 'props', 'prop-future.js'), `
    export function showFutureProperties(b) {
      panel.innerHTML = \`<div class="future-widget-name">\${b.dataset.widgetName}</div>\`;
    }
  `, 'utf8');
  const hits = SINK.scan(dir);
  assert.equal(hits.length, 1, '새 자리가 저절로 걸려야 한다');
  assert.equal(hits[0].escaped, false);
  assert.equal(hits[0].rules, 'SP', '규칙 S·P 가 둘 다 걸려야 한다');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('XS3 ★싱크 대조군 — 초록이 부르는 esc 함수는 «진짜로» 꺾쇠를 막는다', () => {
  const hits = sinkHits();
  const green = hits.filter(h => h.escaped);
  assert.ok(green.length > 0, '★싱크 축에 초록이 하나도 없다 — 대조군이 없으면 빨강을 못 믿는다');
  assert.ok(new Set(green.map(g => g.file)).size >= 2, '★초록이 한 파일에만 몰려 있다');
  const used = SINK.escapersUsedBy(hits);
  const fake = SINK.verifyEscapers(ROOT, used).filter(d => !d.blocksAngle);
  assert.deepEqual(fake.map(d => `${d.file}:${d.line} ${d.name}`), [],
    '★이름만 esc 이고 꺾쇠를 안 막는 함수가 있다 — 그 함수를 쓰는 자리는 «막힌 게 아니다»');
});


/* ═══════════════════════════════════════════════════════════════════════
   X9 (G8) — ★esc 사본이 «새로» 나지 않는다
   ──────────────────────────────────────────────────────────────────────
   X6 은 「반쪽이냐·한 파일에 둘이냐」를 잰다. 그건 «있는 사본의 품질»이다.
   여기서 재는 건 다른 양이다 — 「사본이 «늘었나»」. 새 파일에 31번째 사본이 나는 길은
   X6 이 못 잡는다(그 파일엔 하나뿐이고 두껍게 쓰면 반쪽도 아니다).
   ⛔«수»로 잠그지 않는다 — 수 하나는 늙는다. «명부»로 잠그되 그 명부는 손으로 적은 게 아니라
     레포에서 «세어서» 뜬 것이고, 아래 둘이 양쪽에서 문다:
       ⑴ 명부 «밖»의 정의가 생기면 빨강 — 새 사본이 난 것이다.
       ⑵ 명부에 있는데 소스에 없으면 빨강 — 합쳤으면 그 줄을 «지워야» 한다.
     ⇒ 줄 수가 줄기만 하는 래칫이다. 합칠수록 짧아지고, 새로 나면 즉시 빨개진다.
   ★세는 것은 «이름이 esc 스러운 것»이 아니라 «HTML 실체참조를 만드는 것»이다 —
     이 레포엔 «Escape 키» 뜻의 _escHandler/_escRaf 가 많아서, 이름으로 세면 그게 곧 오탐이다.
     (그래서 이 명부는 36줄이다. 이름만으로 세면 84줄이 나온다 — 다른 양이다.)
   기준: 브랜치 57063f6. 1972a80 대비 «증가 0»(prop-comparison 반쪽 하나 빠지고 _helpers SSOT 하나 남).
   ═══════════════════════════════════════════════════════════════════════ */
const ESC_DEFS = [
  "js/badge-transform.js|escapeHtml",
  "js/block-factory.js|_escHtml",
  "js/block-factory.js|esc",
  "js/blocks/grid-block.js|_esc",
  "js/blocks/infocard-block.js|_esc",
  "js/blocks/laurel-block.js|_escLaurelText",
  "js/blocks/modal-block.js|_esc",
  "js/blocks/qa-block.js|_escHtml",
  "js/checklist-data.js|_escHtml",
  "js/component-shelf.js|_escHtml",
  "js/drag-utils.js|_escGraphHtml",
  "js/io/font-substitute.js|_esc",
  "js/io/import-figma-json.js|_escapeAttr",
  "js/io/import-figma-json.js|_escapeHtml",
  "js/market.js|_esc",
  "js/panels/iconify-panel.js|_escAttr",
  "js/panels/template-browser.js|_esc",
  "js/panels/template-system.js|escHtml",
  "js/props/_helpers.js|escHtml",
  "js/props/prop-annotation.js|_escape",
  "js/props/prop-banner02.js|_escAttr",
  "js/props/prop-infocard.js|_esc",
  "js/props/prop-innercard.js|_esc",
  "js/props/prop-laurel.js|_esc",
  "js/props/prop-qa.js|_esc",
  "js/props/prop-simple-card.js|_escHtml",
  "js/props/prop-sticker.js|_esc",
  "js/props/prop-zoom.js|_esc",
  "js/report-modal.js|esc",
  "js/section-protection.js|_escapeHtml",
  "js/settings/settings-admin.js|esc",
  "js/settings/settings-modal.js|_escapeHtml",
  "js/version-history-ui.js|_esc",
  "js/version-history-ui.js|_escHandler",
  "pages/projects.html|_escHtml",
  "pages/projects.html|esc",
];

test('X9 ★esc 사본이 늘지도, 죽은 채 남지도 않는다', () => {
  const found = [];
  for (const f of sources()) {
    const re = /\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)\s*[=(]/g;
    let m;
    while ((m = re.exec(f.raw))) {
      if (!/(?:^|_)(?:esc|escape|sanitiz|htmlsafe)/i.test(m[1])) continue;
      if (!/&(?:amp|lt|gt|quot|#\d+|#x[0-9a-f]+);/i.test(f.raw.slice(m.index, m.index + 600))) continue;
      found.push(`${f.rel}|${m[1]}`);
    }
  }
  const now = new Set(found);
  const known = new Set(ESC_DEFS);
  const added = [...now].filter(k => !known.has(k)).sort();
  const gone = [...known].filter(k => !now.has(k)).sort();

  assert.deepEqual(added, [],
    `★HTML 이스케이프 사본이 «새로» 났다 — ${added.length}벌. ` +
    '⛔새로 만들지 말고 js/props/_helpers.js 의 escHtml 을 쓰거나, ' +
    '이름을 «항상 글자»로 넣는 쪽(textContent/value/createTextNode)으로 가라. ' +
    '정말 필요하면 ESC_DEFS 에 올리되 «왜 정본을 못 쓰는지»를 그 줄에 적어라:\n  ' + added.join('\n  '));
  assert.deepEqual(gone, [],
    `★합쳐서 없어진 사본이 명부에 남아 있다 — 그 줄을 지워라(남은 ${known.size - gone.length}벌). ` +
    '안 지우면 다음에 같은 자리에 사본이 나도 조용히 통과한다:\n  ' + gone.join('\n  '));
});

/* ═══════════════════════════════════════════════════════════════════════
   XS4 — ★계측기가 «자기 눈»을 잰다
   ──────────────────────────────────────────────────────────────────────
   이 레포의 소스 게이트는 전부 tests/unit/_strip-comments.js 로 주석을 걷고 시작한다.
   그 제거기가 «줄 주석 안에 /* 가 들어 있는 줄»을 만나면 거기서 블록 주석이 열린 것으로 읽고,
   다음 *​/ 까지 «진짜 코드»를 통째로 지운다. 지워진 자리는 어떤 게이트에도 안 보인다.
   ⇒ 초록이 「없어서」가 아니라 «안 봐서»가 된다. 제일 나쁜 초록이다.
   실측(기준선 1972a80): js/branch-system.js:9 의 줄 주석 하나가 그 파일 74줄을 가렸고,
   그 안에 인라인 핸들러 2개(브랜치 이름이 실린 것 1개 포함)가 들어 있었다.
   ⛔이 검사를 지우지 마라 — 고치는 길은 둘이다. ⑴그 주석의 표기를 바꾸거나
     ⑵_strip-comments.js 가 줄 주석 안의 /* 를 안 열게 고치거나(그쪽이 정본 수리다).
   ═══════════════════════════════════════════════════════════════════════ */
test('XS4 ★주석 제거기가 «코드»를 먹는 자리가 없다', () => {
  const bad = [];
  for (const f of sources()) {
    const lines = f.raw.split('\n');
    lines.forEach((ln, i) => {
      const cut = ln.indexOf('//');
      if (cut < 0) return;
      if (!ln.slice(cut).includes('/*')) return;
      bad.push(`${f.rel}:${i + 1}  줄 주석 안에 블록 주석 여는 표기가 있다`);
    });
  }
  /* 실제로 코드가 지워졌는지까지 «같이» 보인다 — 표기만으로 겁주지 않으려고.
     ⛔«걸린 파일»에서만 센다. 전 파일에서 세면 «블록 주석 안의 예시 코드»까지
       「가려졌다」로 읽혀 겁만 준다(실측: js/drag-history.js 의 머리 주석 속 예시 3줄).
       가려진 결과는 위 bad 의 «증거»지 그 자체로 판정이 아니다. */
  const suspects = new Set(bad.map(b => b.split(':')[0]));
  const eaten = [];
  for (const f of sources().filter(x => suspects.has(x.rel))) {
    const R = f.raw.split('\n'), C = stripComments(f.raw).split('\n');   // ★공용 제거기 그대로
    let n = 0;
    for (let i = 0; i < R.length; i++) {
      if (!R[i].trim() || (C[i] || '').trim()) continue;
      if (/^\s*(?:(?:export\s+)?(?:async\s+)?function\s|const\s|let\s|var\s|class\s)/.test(R[i])) n++;
    }
    if (n) eaten.push(`${f.rel} — 선언 ${n}줄이 안 보인다`);
  }
  assert.deepEqual(bad, [],
    '★줄 주석 안의 «블록 주석 여는 표기» 때문에 제거기가 그 뒤 코드를 삼킨다 — ' +
    '그 구간은 «어떤 소스 게이트에도 안 보인다»(초록이 «안 봐서»가 된다).\n' +
    `  가려진 결과: ${eaten.length ? eaten.join(' · ') : '(선언 기준 0줄)'}\n  ` + bad.join('\n  '));
});

/* ═══════════════════════════════════════════════════════════════════════
   G7 — 인라인 핸들러(on*="…") 자리. ★다른 눈의 그물이다.
   ──────────────────────────────────────────────────────────────────────
   ★왜 «따로» 재나
     ⑴ **이스케이프로 안 닫힌다.** on* 속성값은 HTML 실체참조가 «먼저 풀린 뒤» JS 로 읽힌다 —
        `&#39;` 는 JS 에 닿을 땐 다시 홑따옴표다. 그래서 이 자리는 감싸는 것으로 못 막고
        «인라인 핸들러를 없애는 것»(dataset + 위임 리스너)으로만 닫힌다.
     ⑵ **내 보간 추적이 여기서 눈이 먼다.** 브랜치 이름은
        store → Object.keys → filter → new Set → map 으로 흘러서 세 세대를 넘는다(실측: 9자리 중 2자리만 잡힘).
        ⇒ 추적이 못 닿는 자리를 «모양»으로 덮는다. 체인 깊이와 무관하다.
   ═══════════════════════════════════════════════════════════════════════ */

const INLINE_ATTR = /\son[a-z]+\s*=\s*"/gi;

/** 마크업 템플릿 안의 on*="…" 값 구간을 [시작,끝] 로. (리터럴 안 오프셋) */
function inlineHandlerRanges(raw) {
  const out = []; INLINE_ATTR.lastIndex = 0;
  let m;
  while ((m = INLINE_ATTR.exec(raw))) {
    const open = m.index + m[0].length;
    const close = raw.indexOf('"', open);
    if (close < 0) continue;
    out.push([open, close]);
    INLINE_ATTR.lastIndex = close;
  }
  return out;
}

/** 기계가 지은 아이디인가 — 이 자리에서 «빼도 되는» 유일한 근거다.
 *  아이디는 genId() 가 짓고(js/drag-utils.js), 프로젝트 아이디는 정규식 게이트를 한 번 더 지난다.
 *  ⛔이름은 그 다리가 없다 — 형식 제약이 0이다(createBranch 는 trim 과 중복만 본다).
 *  ★빼는 수를 «메시지에 찍는다» — 조용히 빼면 그게 곧 다음 사각지대다. */
const MACHINE_ID = /^[\w$.?]*\b(?:id|[A-Za-z]*Id)$/;

test('G7-a ★전수 — 인라인 핸들러 «안»에 «기계 아이디가 아닌» 값이 실리는 자리가 없다', () => {
  /* ⛔감싸서 닫는 게 아니다 — 위임 리스너로 옮겨야 닫힌다.
     ⚠️여기서 「이름이 실렸나」로 좁히면 안 된다 — 브랜치 이름은 세 세대를 넘어 흘러서
       내 보간 추적이 «못 본다»(실측). 그러면 초록이 「없어서」가 아니라 «안 봐서»가 된다.
       ⇒ 이 자리는 «값의 모양»으로 가른다: 기계 아이디만 빼고 나머지는 전부 빨강. */
  const { templates } = _req('./_name-to-markup.js');
  const bad = [];
  let skippedIds = 0;
  for (const f of sources()) {
    for (const t of templates(f.code)) {
      const ranges = inlineHandlerRanges(t.raw);
      if (!ranges.length) continue;
      for (const e of t.exprs) {
        if (e.outer && /`/.test(e.text)) continue;
        const off = e.at - t.start;
        if (!ranges.some(([a, b]) => off >= a && off < b)) continue;
        const txt = e.text.trim();
        if (MACHINE_ID.test(txt)) { skippedIds++; continue; }
        bad.push(`${f.rel}:${lineOf(f.code, e.at)}  on*="… \${${txt.slice(0, 50)}} …"`);
      }
    }
  }
  assert.deepEqual(bad, [],
    `★인라인 JS 문자열 안으로 «기계 아이디가 아닌» 값이 들어간다 — ${bad.length}건 ` +
    `(기계 아이디라 뺀 것 ${skippedIds}건). ` +
    '⛔이스케이프로는 안 닫힌다 — on* 값은 HTML 실체참조가 «먼저 풀린 뒤» JS 로 읽힌다. ' +
    'dataset + 위임 리스너로 옮겨라:\n  ' + bad.join('\n  '));
});

test('G7-b ★브랜치 패널에 인라인 핸들러가 0건이다', () => {
  /* ★여기만 파일을 «이름으로» 집는다 — 이 축은 「그 파일에서 인라인 핸들러가 사라졌는가」가
     곧 합격선이기 때문이다(G7-a 가 이름 실린 것만 세는 데 반해, 여기는 «모양 자체»를 센다).
     ⛔파일이 없으면 «통과»가 아니라 빨강이다 — 옮겨졌는데 조용히 0건이 되는 길을 막는다. */
  const f = sources().find(s => s.rel === 'js/branch-system.js');
  assert.ok(f, '★js/branch-system.js 이 없다 — 옮겨졌으면 이 검사의 대상부터 고쳐라(«안 돈» 것이지 통과가 아니다)');
  const found = [...f.code.matchAll(/\son([a-z]+)\s*=\s*"([^"]*)"/gi)]
    .map(m => `js/branch-system.js:${lineOf(f.code, m.index)}  on${m[1]}="…"${/\$\{/.test(m[2]) ? '  ★값에 보간이 있다' : ''}`);
  assert.deepEqual(found, [],
    `★브랜치 패널에 인라인 핸들러가 ${found.length}건 남아 있다. ` +
    'dataset + 위임 리스너로 옮겨야 이 축이 닫힌다(이스케이프로는 안 닫힌다):\n  ' + found.join('\n  '));
});

test('G7-c ★음성대조 — 위임으로 옮긴 꼴은 초록, 되돌리면 빨강', () => {
  /* 「0건이라 초록」과 「안 봐서 초록」을 가른다. 같은 계측기로 둘 다 보인다. */
  const clean = 'el.innerHTML = `<button data-branch="x">가기</button>`;';
  assert.equal(inlineHandlerRanges(clean).length, 0, '★위임 꼴인데 인라인으로 읽혔다');
  const dirty = 'el.innerHTML = `<button onclick="go(\'x\')">가기</button>`;';
  assert.equal(inlineHandlerRanges(dirty).length, 1, '★인라인 핸들러를 못 봤다 — 이 계측기가 눈이 멀었다');
});

/* ─────────────────── 이스케이프 헬퍼가 늘지도, 반쪽이지도 않게 (G8) ─────────────────── */

/** esc 스럽게 «생긴» 이름 중, 몸통이 실체참조를 만드는 것만 «진짜 HTML 이스케이프»로 본다.
 *  (레포엔 «Escape 키» 뜻의 _escHandler/_escRaf 가 많다 — 이름만 보고 세면 그게 곧 오탐이다.) */
function escHelpers(code) {
  const out = [];
  const re = /\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)\s*[=(]/g;
  let m;
  while ((m = re.exec(code))) {
    if (!/(?:^|_)(?:esc|escape|sanitiz|htmlsafe)/i.test(m[1])) continue;
    const body = code.slice(m.index, m.index + 600);
    if (!/&(?:amp|lt|gt|quot|#\d+|#x[0-9a-f]+);/i.test(body)) continue;   // 실체참조를 안 만들면 HTML esc 가 아니다
    out.push({ name: m[1], at: m.index, body });
  }
  return out;
}

test('X6 ★이스케이프 헬퍼 — 사본이 한 파일에 둘씩 늘지 않고, 꺾쇠를 «양쪽 다» 덮는다', () => {
  const dup = [];
  const half = [];
  for (const f of sources()) {
    const defs = escHelpers(f.code);
    const seen = new Map();
    for (const d of defs) {
      if (seen.has(d.name)) dup.push(`${f.rel}:${lineOf(f.code, d.at)} ${d.name} (같은 파일에 또)`);
      seen.set(d.name, d.at);
      /* ★문맥마다 «덮어야 할 글자»가 다르다 — 이름에 Attr 가 든 헬퍼는 «속성 값» 전용이라
         꺾쇠가 무력하고 따옴표·앰퍼샌드가 요긴하다. 같은 잣대로 재면 그게 곧 오탐이다. */
      const has = (re) => re.test(d.body);
      const amp   = has(/&amp;|&#0*38\b/i);
      const opens = has(/&lt;|&#0*60\b|&#x0*3c/i);
      const closes= has(/&gt;|&#0*62\b|&#x0*3e/i);
      const quot  = has(/&quot;|&#0*34\b|&#x0*22/i);
      const attrOnly = /attr/i.test(d.name);
      const need = attrOnly ? { '앰퍼샌드': amp, '큰따옴표': quot }
                            : { '앰퍼샌드': amp, '여는 꺾쇠': opens, '닫는 꺾쇠': closes, '큰따옴표': quot };
      const miss = Object.keys(need).filter(k => !need[k]);
      if (miss.length) {
        half.push(`${f.rel}:${lineOf(f.code, d.at)} ${d.name}` +
                  `${attrOnly ? '(속성용)' : ''} — ${miss.join('·')} 미포함`);
      }
    }
  }
  /* ★면제 — X5 와 같은 규약이다. 줄마다 «왜 아직 면제인지»를 적고, 닫으면 그 줄을 지운다.
     ⚠️셋(laurel·figma·comparison)은 «지금 쓰이는 문맥»에서는 안 샌다 — 설계자가 확인했다.
       그래도 「막혔다고 적힌 자리가 반쪽」이라 남긴다. 표시 깨짐(&)과 잠재 위험이 남아 있다. */
  /* ★면제는 비워 둔다(2026-09-22 방침) — 남은 빨강이 곧 남은 일이다.
     둬야 한다면 ['파일|헬퍼이름', '이유'] 로. ⛔이름만 빼는 면제는 금지. */
  const ESC_EXEMPT = new Map([]);
  /* 앵커 = «파일 + 헬퍼 이름». 줄번호는 메시지에만 쓰고 잠금에는 안 쓴다(위를 고치면 어긋난다). */
  const key = (line) => { const m = /^([^:]+):\d+\s+([A-Za-z_$][\w$]*)/.exec(line); return m ? `${m[1]}|${m[2]}` : line; };
  const raw = [...dup.map(d => `[사본 또 만듦] ${d}`), ...half.map(h => `[반쪽] ${h}`)];
  const bad = raw.filter(l => !ESC_EXEMPT.has(key(l.replace(/^\[[^\]]+\]\s*/, ''))));
  const dead = [...ESC_EXEMPT.keys()].filter(k => !raw.some(l => key(l.replace(/^\[[^\]]+\]\s*/, '')) === k));
  assert.deepEqual(dead, [],
    `★닫힌 헬퍼가 면제에 남아 있다 — 그 줄을 지워라(남은 면제 ${ESC_EXEMPT.size - dead.length}줄)`);
  assert.deepEqual(bad, [],
    '★이스케이프 헬퍼 문제 — ⑴같은 파일에 또 만든 사본, ⑵꺾쇠를 한쪽만 덮는 반쪽. ' +
    '반쪽인 헬퍼를 쓰는 자리는 «막힌 게 아니다». ' +
    '⛔새 사본을 만들지 말고 있는 사본을 고쳐라:\n  ' + bad.join('\n  '));
});
