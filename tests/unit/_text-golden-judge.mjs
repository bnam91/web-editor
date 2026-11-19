/* _text-golden-judge — 텍스트 패널 골든(tests/fixtures/text-props-golden*.html)을 «판정식»으로만 다시 뜬다. (right-panel-unify U2 · 2026-11-13)
 *
 * ★왜 — U2 는 절을 틀(_panel-frame.js)로 옮겼다: 껍데기(절·제목·접기 머리)가 통째 바뀌어 골든 바이트 diff 가 서지 않는다.
 *   ⛔눈 diff · 그냥 덮어쓰기 금지. --write 는 아래 판정이 «모든 상태»에서 통과할 때만 골든 둘을 쓴다.
 * ★차분(differential) — 옛 판(BASE = U0 끝 2040a3339)의 prop-text-template.js · _typo-section.js · _helpers.js · prop-text-utils.js 를
 *   `git show` 로 두 번째 vm 에 올려, 같은 상태 행렬을 옛/새로 그려 견준다. (fx 명부·text-type-class 는 양쪽에 «지금» 판 — 판정 밖)
 *   상태 행렬: plain · label · label+circle · bubble · iconText 가로/세로 · overlay · bullet · liner+mix · stroke 켬/끔 · fx 0/1 · gif(보임).
 * ★판정식(상태마다 전부 참이어야 한다):
 *   J1 컨트롤 — <input|select|button|textarea> 여는 태그 + <option>(value · selected) 다중집합이 같다.
 *      허용 = 옛 판 «숨김 껍데기»(display:none 절 · 그 상태에 해당 없는 절)를 걷은 뒤 · RENAME(의도 치환)만.
 *   J2 라벨 — .prop-label/.prop-field-label 글자 다중집합이 같다(허용: Position 머리 라벨 삭제 · L/R → field-label · 패딩 꼬리).
 *   J4 id — id 를 가진 «모든» 요소의 다중집합이 같다(허용 = ID_ADDED / ID_REMOVED 명시 목록).
 *   J5 절 — tests/dom/_panel-sections.js judgePanel(게이트와 «같은» 판정: 순서·제목·라벨 되풀이·소유(data-own·제외 그릇·색짝)·힌트 ≤2) 위반 0
 *      + 손 표 MOVED(옮긴 컨트롤 → 있어야 할 절) 일치.
 *   J6 placeholder — 숫자 칸·색 hex 칸의 placeholder ∈ {'' · 자동 · 상속 · Mix · 없음}(그 밖 글 칸은 자유 안내문).
 *   J7 골든 상태(plain=GOLDEN_STATE · liner+mix=GOLDEN_STATE_MIX)의 새 산출 == 새로 쓸 골든(쓰는 것이 곧 잰 것).
 * ★내장 양성대조(매번 먼저 돈다): 새 템플릿 소스에서 id 한 글자를 바꿔 그리면 판정이 실패해야 한다 — 아니면 rc 1(자가 눈멀었다).
 * 실행(인텔 · 레포 루트): node tests/unit/_text-golden-judge.mjs           ← 판정만(rc 0/1)
 *                        node tests/unit/_text-golden-judge.mjs --write   ← 판정 통과 때만 골든 둘을 쓴다
 * (파일명이 _ 로 시작 — 테스트 글롭 밖 · 도구다.)
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { loadTextTemplate, GOLDEN_STATE, GOLDEN_STATE_MIX, ROOT, FX_STUB } = req('./_text-template-harness.js');
const { loadSectionSpec, judgePanel } = req('../dom/_panel-sections.js');
const BASE = '2040a3339';
const FIX = path.join(ROOT, 'tests/fixtures');
const SPEC = loadSectionSpec();

/* ── 소스 → vm ───────────────────────────────────────────────── */
const readNow = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readBase = (rel) => execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
const stripEsm = (src) => String(src).replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '').replace(/^export\s*\{[\s\S]*?\};\s*$/gm, '');
/* 시험 식구 둘(FX_STUB) = _text-template-harness.js 한 벌(U6 · T1 과 같은 것) */
function load(files, { mutate } = {}) {
  const ctx = { window: { getBlockBreadcrumb: () => 'Section 1 / Row 1', addEventListener() {} }, console };
  vm.createContext(ctx);
  let src = files.map(([rel, s]) => stripEsm(s) + (rel === 'js/effects-registry.js' ? FX_STUB : '')).join('\n;\n');
  if (mutate) src = mutate(src);
  vm.runInContext(src + '\n;globalThis.__T = { buildTextPropsHtml };', ctx, { filename: 'judge-vm' });
  return ctx.__T.buildTextPropsHtml;
}
const SHARED = ['js/props/text-type-class.js', 'js/effects-registry.js'];
const NOW = ['js/props/prop-text-utils.js', 'js/props/_helpers.js', 'js/props/_section-spec.js', 'js/props/_panel-frame.js', 'js/props/_typo-section.js', ...SHARED, 'js/props/prop-text-template.js'];
const OLD = ['js/props/prop-text-utils.js', 'js/props/_helpers.js', 'js/props/_typo-section.js', ...SHARED, 'js/props/prop-text-template.js'];
const OLD_FROM_BASE = new Set(['js/props/prop-text-utils.js', 'js/props/_helpers.js', 'js/props/_typo-section.js', 'js/props/prop-text-template.js']);
const nowFiles = () => NOW.map((r) => [r, readNow(r)]);
const oldFiles = () => OLD.map((r) => [r, OLD_FROM_BASE.has(r) ? readBase(r) : readNow(r)]);

/* ── 작은 HTML 나무(판정용 — 앱 DOM 대역) ───────────────────────── */
const VOID = new Set(['input', 'br', 'img', 'hr', 'meta', 'link', 'source', 'wbr', 'col', 'area']);
function parse(html) {
  const root = { tag: '#root', attrs: {}, kids: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  for (let m; (m = re.exec(html));) {
    if (m[0].startsWith('<!--')) continue;
    if (m[4] != null) { cur.kids.push({ text: m[4], parent: cur }); continue; }
    const tag = m[2].toLowerCase();
    if (m[1]) { let n = cur; while (n && n.tag !== tag) n = n.parent; if (n) cur = n.parent; continue; }
    const attrs = {};
    for (const a of m[3].matchAll(/([^\s=/]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+))?/g)) attrs[a[1].toLowerCase()] = a[3] ?? a[4] ?? (a[2] ?? '');
    const el = { tag, attrs, kids: [], parent: cur, raw: m[0] };
    cur.kids.push(el);
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) cur = el;
  }
  return root;
}
const els = (n) => n.kids.filter((k) => k.tag);
const all = (n, out = []) => { for (const k of els(n)) { out.push(k); all(k, out); } return out; };
const cls = (n) => (n.attrs?.class || '').split(/\s+/);
const has = (n, c) => cls(n).includes(c);
const text = (n) => (n.text != null ? n.text : n.kids.map(text).join(''));
const closest = (n, f) => { for (let x = n; x && x.tag; x = x.parent) if (f(x)) return x; return null; };
const prevEl = (n) => { const s = els(n.parent); return s[s.indexOf(n) - 1] || null; };
const hidden = (n) => /display\s*:\s*none/.test(n.attrs?.style || '');

/** judgePanel 이 먹는 꼴로 — tests/dom/_panel-sections.js readPanel 을 그대로 옮긴 판정 재료(브라우저 대신 나무에서). */
function panelModel(html) {
  const root = parse(html);
  const secs = els(root).filter((e) => has(e, 'prop-section')).map((e) => {
    const head = els(e).find((k) => has(k, 'prop-sec-head'));
    const title = head && els(head).find((k) => has(k, 'prop-section-title'));
    return {
      sec: e.attrs['data-sec'] || null,
      isHeader: els(e).some((k) => has(k, 'prop-block-label')),
      title: title ? text(title).trim() : null,
      labels: all(e).filter((k) => has(k, 'prop-label') || has(k, 'prop-field-label')).map((k) => text(k).trim()),
      controls: all(e).filter((k) => ['input', 'select', 'button', 'textarea'].includes(k.tag)).map((c) => {
        const type = c.tag === 'input' ? (c.attrs.type || 'text') : c.tag;
        const prev = prevEl(c);
        const field = closest(c, (x) => has(x, 'prop-color-field'));
        const pair = type === 'color' ? null : ((field && all(field).find((k) => k.tag === 'input' && k.attrs.type === 'color'))
          || (prev && prev.tag === 'input' && prev.attrs.type === 'color' ? prev : prev && has(prev, 'prop-color-swatch') ? all(prev).find((k) => k.tag === 'input' && k.attrs.type === 'color') : null) || null);   // U6 ⑶ — readPanel 과 같은 좁힌 색짝
        const ownEl = closest(c, (x) => x.attrs && 'data-own' in x.attrs);
        return {
          id: c.attrs.id || '', type, pairedColor: !!pair, pairId: pair?.attrs.id || null,
          itemCard: !!closest(c, (x) => x !== e && x.attrs && ('data-sec-item' in x.attrs || has(x, 'prop-cell-card') || 'data-card-index' in x.attrs)),
          own: ownEl && closest(ownEl, (x) => x === e) ? ownEl.attrs['data-own'] : null,
          data: Object.entries(c.attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5), v]),
          scope: Object.keys(SPEC.OWNERSHIP_EXEMPT_SCOPES).find((sid) => closest(c, (x) => x.attrs?.id === sid)) || null,
        };
      }),
    };
  });
  const order = els(root).find((e) => has(e, 'prop-section') && e.attrs['data-order'])?.attrs['data-order'] || '';   // readPanel 과 같은 «패널 순서 이름»(재설계 1차 ④ text 예외)
  return { root, secs, hints: all(root).filter((k) => has(k, 'prop-hint')).length, order };
}

/* ── 상태 행렬 ──────────────────────────────────────────────── */
const S = (name, over) => [name, { ...GOLDEN_STATE, ...over, tb: { ...GOLDEN_STATE.tb, ...(over.tb || {}) } }];
const STROKE_ON = { on: true, width: 2, align: 'center', color: '#000000' };
const STATES = [
  ['plain', GOLDEN_STATE],
  S('label', { isLabel: true, currentClass: 'tb-label', labelShape: 'pill', currentBgColor: '#111111', labelPadX: 12 }),
  S('label+circle', { isLabel: true, currentClass: 'tb-label', labelShape: 'circle', labelIsCircle: true, currentBgColor: 'transparent' }),
  S('bubble', { isSpeechBubble: true, currentBubbleStyle: 'imessage', bubbleSizeFixed: true, bubbleW: 240, bubbleH: 80, showSender: true }),
  S('iconText-h', { isIconText: true, itbVertical: false }),
  S('iconText-v', { isIconText: true, itbVertical: true }),
  S('overlay', { isOverlayTb: true }),
  S('bullet', { currentClass: 'tb-bullet' }),
  ['liner+mix', GOLDEN_STATE_MIX],
  S('stroke-on', { stroke: STROKE_ON, strokeColorHtml: '' }),
  S('stroke-off', { stroke: { ...STROKE_ON, on: false }, strokeColorHtml: '' }),
  S('fx0', {}),
  S('fx1', { tb: { __fxReflect: true } }),
  S('gif', { showAnimGif: true }),   /* GIF 단추가 보이는 판 — Export 절 */
];

/* 옛 판의 «숨김 껍데기» — 그 상태에서 display:none 으로 그려졌던 그릇(새 판은 안 그린다). 나무에서 걷는다. */
const OLD_HIDDEN_IDS = ['label-style-section', 'bubble-style-section', 'icon-text-style-section', 'type-section'];
function stripOldHidden(root, st) {
  for (const e of all(root)) {
    if (!e.parent) continue;
    const top = e.parent.tag === '#root';
    const deadGif = top && has(e, 'prop-section--anim') && !st.showAnimGif;   /* U2 ④ — GIF 가 안 보일 판이면 새 판은 Export 절째 없음(옛 판은 disabled 단추를 그렸다) */
    if ((OLD_HIDDEN_IDS.includes(e.attrs.id) && hidden(e)) || (top && has(e, 'prop-section') && hidden(e)) || deadGif) e.parent.kids = e.parent.kids.filter((k) => k !== e);
  }
  return root;
}
const tagNorm = (t) => t.replace(/\s+/g, ' ').replace(/ data-own="[^"]*"/g, '');   // data-own = 새 판 소유 표식(판정 재료 · J5 가 잰다)
const RENAME = [[/placeholder="auto"( aria-label="밑줄 (?:두께|위치)")/, 'placeholder="자동"$1'], [/ placeholder="없음"( aria-label="Color")/, '$1'],
  /* 재설계 1차 ⑩ — «Font»·«글자색» 라벨 글을 걷고 이름을 칸의 aria-label 로 옮겼다 */
  [/(id="txt-font-trigger" type="button")>/, '$1 aria-label="Font" title="Font">'], [/(<input type="color" id="txt-color" value="[^"]*")>/, '$1 aria-label="글자색">'],
  /* ⑥ 너비 = 칸 안 라벨 숫자 칸(.prop-icon-input 안 · prop-number 클래스 없음 · aria-label) */
  [/^<input type="number" class="prop-number" id="txt-width-number" (min="80" max="860" value="[^"]*")>$/, '<input type="number" id="txt-width-number" $1 aria-label="너비">']];
const ctl = (root) => all(root).flatMap((k) => (['input', 'select', 'button', 'textarea'].includes(k.tag) ? [tagNorm(k.raw)]
  : k.tag === 'option' ? [`<option value="${k.attrs.value ?? ''}"${'selected' in k.attrs ? ' selected' : ''}>`] : []));
const labels = (root) => all(root).filter((k) => has(k, 'prop-label') || has(k, 'prop-field-label')).map((k) => text(k).trim());
const ids = (root) => all(root).filter((k) => k.attrs.id).map((k) => k.attrs.id);
const minus = (a, b) => { const r = [...a]; for (const x of b) { const i = r.indexOf(x); if (i >= 0) r.splice(i, 1); } return r; };

const LABEL_RENAME = { '왼쪽 패딩': '왼쪽', '오른쪽 패딩': '오른쪽' };
const LABEL_DROPPED = ['Font', '글자색', '너비'];   /* 너비 = ⑥ 칸 안 라벨(.prop-xy-label)로 */   /* 재설계 1차 ⑩ — 라벨 글 걷음(칸은 그대로 · J1 이 잰다) */
const ID_ADDED = [/^psec-[a-z]+(-head|-body)?$/, /^(type-section|bullet-style-section|txt-stroke-section|txt-shadow-section|txt-fx-section|txt-bubble-section|txt-anim-section)-(head|body)$/,
  /^txt-bubble-section$/, /^txt-anim-section$/, /^txt-align-group$/];
const ID_REMOVED = ['icon-text-style-section', 'txt-width-slider'];   /* txt-width-slider = 재설계 1차 ⑥(너비 = 숫자 칸만) */
/* 기준판(BASE) 뒤에 «의도해서» 더한 컨트롤·id — 판정이 «생김»으로 안 세게. (패널 재설계 1차 261120 — 항목마다 까닭)
 *   label-shape-oval = 태그 Oval 모양(BASE 뒤 별건 · 이 판정기가 못 따라온 드리프트를 같이 적음) */
const CTL_ADDED = [/^<button class="prop-btn-full(?: active)?" id="label-shape-oval">$/,
  /^<input type="number" id="txt-height-number" disabled placeholder="auto" aria-label="[^"]*">$/,   /* ⑥ 텍스트 높이 칸(꺼짐 · auto) */
  /^<button class="prop-type-btn(?: active)?" disabled title="(?:Tags|Icon Text|Bubble|Liner) — [^"]*">$/];   /* ⑫ 타입 12칸 중 «바꾸기 없음» 넷(꺼짐) */
const CTL_DROPPED = [/^<input type="range" class="prop-slider" id="txt-width-slider" /];   /* ⑥ 너비 슬라이더 걷음 */
ID_ADDED.push(/^label-shape-oval$/, /^txt-width-scrub$/, /^txt-height-number$/, /^txt-kind-group$/);
/* 옮긴 컨트롤 → 있어야 할 절(손 표 · OWNERSHIP 과 «다른 길»로 적었다) */
const MOVED = {
  'label-radius-slider': 'appearance', 'label-radius-number': 'appearance', 'label-bg-color': 'fill', 'label-bg-hex': 'fill', 'label-bg-none': 'fill',
  'label-pill-height-slider': 'size', 'label-pill-height-number': 'size', 'itb-icon-size-slider': 'size', 'itb-icon-size-number': 'size',
  'itb-dy-slider': 'layout', 'itb-dy-number': 'layout', 'itb-gap-slider': 'layout', 'itb-gap-number': 'layout',
  'txt-x-number': 'position', 'txt-rot-number': 'position', 'txt-width-number': 'size', 'txt-pv-number': 'padding', 'bubble-bg-color': 'special',
};
const PH_OK = new Set(['', '자동', '상속', 'Mix', '없음', 'auto']);   /* auto = ⑥ 텍스트 높이 칸(현빈 v9 «auto») */

function judge(name, st, oldHtml, newHtml) {
  const bad = [];
  const o = stripOldHidden(parse(oldHtml), st), nm = panelModel(newHtml), n = nm.root;
  const oc = ctl(o).map((t) => RENAME.reduce((s, [a, b]) => s.replace(a, b), t)).filter((t) => !CTL_DROPPED.some((r) => r.test(t))), nc = ctl(n);
  const l1 = minus(oc, nc), e1 = minus(nc, oc).filter((t) => !CTL_ADDED.some((r) => r.test(t)));
  if (l1.length || e1.length) bad.push(`J1 컨트롤: 잃음 ${JSON.stringify(l1)} · 생김 ${JSON.stringify(e1)}`);
  /* 옛 가짜 절 제목 → 새 field-label: L/R(패딩 연동 머리) · Tag Style(태그 모양 묶음) */
  const ol = minus(labels(o).map((t) => LABEL_RENAME[t] ?? t), ['Position', ...LABEL_DROPPED])
    .concat(ids(n).includes('txt-ph-chain') ? ['L/R'] : [], ids(n).includes('label-style-section') ? ['Tag Style'] : []);
  const l2 = minus(ol, labels(n)), e2 = minus(labels(n), ol);
  if (l2.length || e2.length) bad.push(`J2 라벨: 잃음 ${JSON.stringify(l2)} · 생김 ${JSON.stringify(e2)}`);
  const oi = ids(o).filter((i) => !ID_REMOVED.includes(i)), ni = ids(n).filter((i) => !ID_ADDED.some((r) => r.test(i)));
  const l4 = minus(oi, ni), e4 = minus(ni, oi);
  if (l4.length || e4.length) bad.push(`J4 id: 잃음 ${JSON.stringify(l4)} · 생김 ${JSON.stringify(e4)}`);
  for (const v of judgePanel(nm, SPEC)) bad.push(`J5 게이트: ${v}`);
  for (const s of nm.secs) for (const c of s.controls) if (MOVED[c.id] && MOVED[c.id] !== s.sec) bad.push(`J5 옮김표: ${c.id} 는 ${MOVED[c.id]} 절이어야 하는데 ${s.sec}`);
  for (const k of all(n)) {
    const ph = k.attrs.placeholder;
    if (ph == null) continue;
    if ((k.attrs.type === 'number' || has(k, 'prop-color-hex')) && !PH_OK.has(ph)) bad.push(`J6 placeholder: ${k.attrs.id} = 「${ph}」`);
  }
  return bad.map((b) => `${name} ${b}`);
}

function runAll(buildNew) {
  const buildOld = load(oldFiles());
  const fails = [];
  for (const [name, st] of STATES) {
    let oh, nh;
    try { oh = buildOld(st); nh = buildNew(st); } catch (e) { fails.push(`${name} 렌더 실패: ${e.message}`); continue; }
    fails.push(...judge(name, st, oh, nh));
  }
  return fails;
}

/* ① 내장 양성대조 — 새 템플릿의 id 하나를 바꾸면 판정이 실패해야 한다 */
const blind = runAll(load(nowFiles(), { mutate: (s) => s.replace('id="txt-x-number"', 'id="txt-x-numbr"') }));
if (!blind.some((f) => f.includes('txt-x-numbr'))) { console.error('★양성대조 실패 — id 를 바꿔도 판정이 못 잡는다(자가 눈멀었다)'); process.exit(1); }
console.log(`양성대조 OK — 바꾼 id 를 잡았다 (${blind.length}건)`);

/* ② 본 판정 */
const buildNew = load(nowFiles());
const fails = runAll(buildNew);
if (fails.length) { console.error('★판정 실패 — 골든을 쓰지 않는다:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`★판정 통과 — ${STATES.length} 상태 × J1·J2·J4·J5·J6`);

/* ③ 골든 — 쓰는 것 == T1 이 견주는 것(J7). ★U6: T1(typo-section-ssot)과 «같은 길»(_text-template-harness · 진짜 명부 + 같은 FX_STUB)로 쓴다.
   (r0913rp·9ec2dcacc T1 23351 ≠ 22367 = 판정기만 식구를 싣고 하네스는 0 이던 어긋남 — 이제 식구는 하네스 한 벌.) */
const GOLD = [['text-props-golden.html', GOLDEN_STATE], ['text-props-golden-mix.html', GOLDEN_STATE_MIX]];
const buildGold = loadTextTemplate().buildTextPropsHtml;
if (process.argv.includes('--write')) {
  for (const [file, st] of GOLD) fs.writeFileSync(path.join(FIX, file), buildGold(st));
  console.log('골든 둘을 썼다(plain · liner+mix 상태 산출) — 같은 커밋에 넣고 이 출력을 메시지에');
} else {
  for (const [file, st] of GOLD) console.log(`${file}: ${fs.readFileSync(path.join(FIX, file), 'utf8') === buildGold(st) ? '이미 같다' : '다르다(--write 로 갱신)'}`);
}
