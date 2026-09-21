/* ══════════════════════════════════════════════════════════════════════════
   project-name-to-markup — T-049 : 「사람이 지은 이름이 «마크업 틀»로 이어지는 자리」를 잠근다
   ──────────────────────────────────────────────────────────────────────────
   무슨 자리인가 — 프로젝트/폴더 «이름»과 «아이디»는 사용자가 적는 값이다.
   그 값을 템플릿 리터럴로 HTML 에 이어붙이면, 이름 안의 글자가 «글자»가 아니라
   «틀의 일부»로 읽힌다. 고친 모양은 반대다 — 이름은 textContent/value/createTextNode 로,
   아이디는 dataset/클로저로 «항상 글자»로 넣는다.

   ★이 파일이 잠그는 것은 «그 자리 일곱»이 아니라 «그 꼴»이다.
     T-049 는 손으로 센 명부를 네 번 덜 셌다(둘 → 여덟 → 열 → 열하나).
     ⇒ 여기서는 이름을 열거하지 않는다. 로스터를 «행위»로 만든다 —
       「앱이 이름을 내주는 문(접근자)에 닿는 파일」이 곧 로스터다.
       선례 — js/insert-history.js 의 MATCH · release-gate-wiring.test.mjs 의 R5.
     ⇒ 새 파일이 조용히 들어와 같은 꼴을 써도 걸린다. 면제는 «이유»와 함께만 둔다.

   ⛔이 파일은 «소스 모양»만 잰다. 화면에서 어떻게 보이는지는 여기서 «안 쟀다».
     초록을 「앱에서 안전하다」로 읽지 마라.
   ⚠️정상 리팩터링에도 빨강이 날 수 있다. 그때 검사를 지우지 말고
     「그 보간에 실린 값이 바깥에서 오는가」를 먼저 확인해라.
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');
const { normalizeEol, toPosix } = _req('./_srcread.js');
const { ORIGINS, scan, touchesOrigin, lineOf } = _req('./_name-to-markup.js');

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

/** 훑는 범위 — 화면을 그리는 코드가 사는 곳 전부. (한 번만 읽는다) */
let _sources = null;
function sources() {
  if (_sources) return _sources;
  const files = [];
  for (const d of ['js', 'pages', 'main']) walk(path.join(ROOT, d), files);
  const idx = path.join(ROOT, 'index.html');
  if (fs.existsSync(idx)) files.push(idx);
  _sources = files.map(f => ({
    rel: toPosix(path.relative(ROOT, f)),
    code: stripComments(normalizeEol(fs.readFileSync(f, 'utf8'))),
  }));
  return _sources;
}

/** 로스터 = «이름을 내주는 문»에 닿는 파일. 이름을 열거하지 않는다. */
let _roster = null;
const roster = () => (_roster ||= sources().filter(s => touchesOrigin(s.code)));
/** 한 파일의 측정값도 한 번만 낸다(N2·N3·N5 가 같은 것을 되 잰다). */
const _scans = new Map();
const scanOf = (f) => { if (!_scans.has(f.rel)) _scans.set(f.rel, scan(f.code)); return _scans.get(f.rel); };

test('N1 ★전제 + 양성대조 — «이름을 내주는 문»이 실재한다', () => {
  const all = sources();
  assert.ok(all.length > 50, `★훑은 파일이 ${all.length}개뿐이다 — 이 검사가 «안 돈» 것이지 통과가 아니다`);
  const blob = all.map(s => s.code).join('\n');
  const missing = ORIGINS.filter(o => !blob.includes(o));
  assert.deepEqual(missing, [],
    '★접근자가 소스에서 사라졌다: ' + missing.join(', ') + '. ' +
    '이름이 바뀐 것이라면 _name-to-markup.js 의 ORIGINS 부터 고쳐라 — ' +
    '안 고치면 이 검사가 «조용히 0건»이 되어 늘 초록이 된다');
  assert.ok(roster().length > 0, '★로스터가 비었다 — 위와 같은 사유다');
});

test('N2 ★검사가 헛돌지 않는다 — 이름을 «실제로 그리는» 파일이 로스터에 들고 값도 잡힌다', () => {
  /* 이게 없으면 N3 의 초록이 「없어서」가 아니라 「못 봐서」일 수 있다.
     ⛔여기 적은 셋은 «표본»이다 — 로스터 자체는 위에서 행위로 만든다(수를 여기 적지 않는다). */
  const probes = ['js/tab-system.js', 'js/commit-system.js', 'js/scratch-pad.js'];
  for (const rel of probes) {
    const f = roster().find(s => s.rel === rel);
    assert.ok(f, `★${rel} 이 로스터에 없다 — 이름을 내주는 문에 안 닿는다고 읽혔다. ` +
                 '파일이 옮겨졌으면 이 표본을 고치고, 아니라면 ORIGINS 를 봐라');
    const { objects, names } = scanOf(f);
    assert.ok(objects.size + names.size > 0,
      `★${rel} 에서 이름이 실린 값을 하나도 못 잡았다 — 흐름이 바뀌었다. ` +
      '이 검사가 그 파일을 «안 보고» 있다는 뜻이다');
  }
});

test('N3 ★전수 — 바깥 이름이 «마크업 틀»로 이어지는 자리가 없다', () => {
  /* ⛔면제를 두려면 «이유»를 여기 적어라. 이름만 빼면 같은 구멍이 다시 열린다(R5 규약). */
  const EXEMPT = {
    /* (지금은 비어 있다) */
  };
  const bad = [];
  for (const f of roster()) {
    if (f.rel in EXEMPT) continue;
    for (const h of scanOf(f).hits) bad.push(`${f.rel}:${lineOf(f.code, h.at)}  \${${h.text}}`);
  }
  assert.deepEqual(bad, [],
    '★사용자가 지은 이름/아이디가 마크업 틀에 이어붙는다. ' +
    '고치는 모양은 레포에 이미 있다 — 이름은 textContent/value/createTextNode, ' +
    '아이디는 dataset/클로저로 «항상 글자»로 넣어라(이름을 «검사»하지 마라). ' +
    '면제하려면 EXEMPT 에 «이유와 함께» 적어라');
});

/* ── 음성대조 ─────────────────────────────────────────────────────────────
   ⛔화석을 베끼지 않는다 — «지금» 소스에서 안전한 쓰기를 «틀로 잇는» 쪽으로 되돌린다.
     변환이 원본과 같아지면(=앵커가 늙으면) 그것부터 빨갛게 만든다.
   ★공격 문자열은 쓰지 않는다. 재는 것은 «값이 틀로 이어지는가»라는 구조뿐이다. */
const REVERSALS = [
  { at: 'js/tab-system.js',   what: '탭 줄 — 이름',
    from: "nameEl.textContent = tab.name ?? '';",
    to:   'nameEl.innerHTML = `<span>${tab.name}</span>`;' },
  { at: 'js/tab-system.js',   what: '탭 줄 — 아이디(속성)',
    from: "el.dataset.id = tab.id ?? '';",
    to:   'el.innerHTML = `<span data-id="${tab.id}"></span>`;' },
  { at: 'js/tab-system.js',   what: '탭 줄 — 아이디(속성 + 인라인 JS)',
    from: 'closeBtn.innerHTML = TAB_CLOSE_SVG;',
    to:   'closeBtn.innerHTML = `<i onclick="closeTab(\'${tab.id}\')"></i>`;' },
  { at: 'js/tab-system.js',   what: '＋탭 드롭다운 — 이름',
    from: "nameEl.textContent = p.name ?? '';",
    to:   'nameEl.innerHTML = `<span>${p.name}</span>`;' },
  { at: 'js/tab-system.js',   what: '＋탭 드롭다운 — 아이디',
    from: 'row.innerHTML = TAB_MENU_DOC_SVG;',
    to:   'row.innerHTML = `<i data-id="${p.id}"></i>`;' },
  { at: 'js/commit-system.js', what: '커밋 모달 — 프로젝트 이름',
    from: '<span class="cm-project"></span>',
    to:   '<span class="cm-project">${projectName}</span>' },
  { at: 'js/scratch-pad.js',  what: '자산 폴더 메뉴 — 폴더 이름',
    from: "btn.appendChild(document.createTextNode(f.name || '(이름 없음)'));",
    to:   'btn.innerHTML += `<span>${f.name}</span>`;' },
];

test('N4 ★음성대조(전수) — 되돌린 자리마다 «하나씩» 빨개진다', () => {
  const byRel = new Map(sources().map(s => [s.rel, s.code]));
  const blind = [];
  for (const r of REVERSALS) {
    const code = byRel.get(r.at);
    assert.ok(code, `★${r.at} 이 없다 — 검사가 «안 돈» 것이다`);
    const mutated = code.replace(r.from, r.to);
    assert.notEqual(mutated, code,
      `★앵커가 늙었다 — ${r.at} 의 「${r.what}」 자리를 못 찾아 변형본이 원본과 같다. ` +
      'N3 의 초록은 «없어서»가 아니라 «못 봐서»일 수 있다. 이 앵커부터 고쳐라');
    if (scan(mutated).hits.length === 0) blind.push(`${r.at} — ${r.what}`);
  }
  assert.deepEqual(blind, [],
    '★되돌렸는데도 안 잡힌 자리가 있다 — 이 검사가 그 자리를 «못 본다». ' +
    '_name-to-markup.js 의 ORIGINS/홉 수를 봐라');
});

test('N5 ★음성대조(로스터 전수) — 로스터의 «어느 파일»에 새로 생겨도 잡힌다', () => {
  /* N4 는 «알고 있는 일곱 자리»를 잰다. 여기는 «앞으로 생길 자리»를 잰다 —
     이름이 잡힌 파일마다 그 값을 틀에 이어붙이는 줄을 «덧붙여» 빨개지는지 본다. */
  const blind = [];
  let probed = 0;
  for (const f of roster()) {
    const { objects, names } = scanOf(f);
    const carrier = names.size ? `${[...names][0]}` : (objects.size ? `${[...objects][0]}.name` : null);
    if (!carrier) continue;
    probed++;
    const mutated = f.code + '\n;(function(){ var _probe = document.createElement("div");'
                  + ' _probe.innerHTML = `<span>${' + carrier + '}</span>`; })();\n';
    if (scan(mutated).hits.length === 0) blind.push(`${f.rel} (${carrier})`);
  }
  assert.ok(probed >= 10, `★탐침을 ${probed}개 파일에만 놨다 — 로스터가 얇아졌다. N1/N2 부터 봐라`);
  assert.deepEqual(blind, [],
    '★로스터 안인데 새 자리를 못 잡는 파일이 있다: 이 검사의 사각지대다');
});
