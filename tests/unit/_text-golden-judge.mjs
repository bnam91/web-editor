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
const NOW = ['js/props/prop-text-utils.js', 'js/props/_helpers.js', 'js/props/_section-spec.js', 'js/props/_panel-frame.js', 'js/props/_fill-section.js', 'js/props/_typo-section.js', 'js/props/_stroke-section.js', 'js/props/_appearance-section.js', 'js/props/_layout-section.js', ...SHARED, 'js/props/prop-text-template.js'];   // 표준 Stroke(태양 261123~) — 텍스트 Stroke 절 = 부품 strokeSectionHTML(탑 261124 P2 실측 «not defined»)
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
  /* ★Q1 · Q2(시안 v10) — readPanel 과 같은 펴기: Type 띠 = kind 절 · Layout 묶음 안 몸 = 그 key 절(제목 data-title · 작은 제목은 라벨 아님) */
  const units = [];
  for (const e of els(root).filter((x) => has(x, 'prop-section'))) {
    const band = els(e).find((k) => has(k, 'prop-kind-band'));
    if (e.attrs['data-sec-group'] != null) { for (const part of els(e).filter((k) => has(k, 'prop-sec-part') && k.attrs['data-sec'])) units.push({ e: part, sec: part.attrs['data-sec'], title: part.attrs['data-title'], isHeader: false }); }
    else {
      const head = els(e).find((k) => has(k, 'prop-sec-head'));
      const t = head && els(head).find((k) => has(k, 'prop-section-title'));
      units.push({ e, sec: e.attrs['data-sec'] || null, title: t ? text(t).trim() : null, isHeader: els(e).some((k) => has(k, 'prop-block-label')), band });
    }
    if (band) units.push({ e: band, sec: 'kind', title: band.attrs['data-title'], isHeader: false });
  }
  const inBand = (k, band) => !!band && !!closest(k, (x) => x === band);
  const secs = units.map(({ e, sec, title, isHeader, band }) => {
    return {
      sec,
      isHeader,
      title,
      labels: all(e).filter((k) => (has(k, 'prop-label') || has(k, 'prop-field-label')) && !has(k, 'prop-sec-sub') && !inBand(k, band)).map((k) => text(k).trim()),
      controls: all(e).filter((k) => ['input', 'select', 'button', 'textarea'].includes(k.tag) && !inBand(k, band)).map((c) => {
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
  const order = all(root).find((e) => (has(e, 'prop-section') || has(e, 'prop-kind-band')) && e.attrs['data-order'])?.attrs['data-order'] || '';   // readPanel 과 같은 «패널 순서 이름»(재설계 1차 ④ text 예외)
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
  /* ⑨ 머리 «＋» — Effects 추가 select 꼴 · Stroke 켜기 체크박스(단추꼴 label 안 · 이름 aria-label) */
  [/^(<input type="checkbox" id="txt-stroke-on"(?: checked)?) ?>$/, '$1 aria-label="Stroke">'],
  /* Q20 각도 칸 — 이름은 aria-label(«회전°» 라벨 글 걷음 · 시안 v10) */
  [/^(<input type="number" class="prop-number" id="txt-rot-number" min="-180" max="180" step="1" value="[^"]*")>$/, '$1 aria-label="회전 각도">'],
  /* ⑤ 사슬 단추 — 잠금 상태를 aria-pressed 로 */
  [/^(<button class="prop-chain-btn(?: active)?" id="txt-ph-chain" title=")좌우 연동(")>$/, (m, a, b) => `${a}좌우 잠금/풂${b} aria-pressed="${/ active"/.test(a)}">`],   // ⑦(현빈 261122) 사슬 툴팁 «좌우 연동» → «좌우 잠금/풂»
  /* ⑥ 너비 = 칸 안 라벨 숫자 칸(.prop-icon-input 안 · prop-number 클래스는 남김 = 포커스 전체선택 · aria-label) */
  [/^(<input type="number" class="prop-number" id="txt-width-number" min="80" max="860" value="[^"]*")>$/, '$1 aria-label="너비">'],
  /* 1120b B5 후속(지디 261121) — 스타일 번호 칸 placeholder «형광펜/점/밑줄 번호 붙여넣기» → «번호 붙여넣기»(이름은 줄 라벨로 · 잘림 없게) */
  [/ placeholder="(?:형광펜|점|밑줄) 번호 붙여넣기"/, ' placeholder="번호 붙여넣기"'],
  /* IAL-01(0.9.13 186행 · 현빈 승인 261122) — 띄우기 단추 이름 «Ignore Auto Layout»: aria-label 더함 · 툴팁 = IAL_TITLE(아이콘 svg 는 컨트롤 태그 밖) */
  [/^(<button type="button" class="prop-chain-btn prop-chain-btn--overlay(?: active)?" id="txt-overlay-toggle" aria-pressed="(?:true|false)")( title=")[^"]*(">)$/, '$1 aria-label="Ignore Auto Layout"$2Ignore Auto Layout — 자동배치에서 빼서 그 자리에 둔다(옛 «오버레이»). 다시 누르면 원래 자리로 돌아간다.$3'],
  /* ★1120b 기준으로 다시 세움(지디 261121 · 판정기 빨강 9줄 = 1120b 앞 커밋들의 의도된 변화 · 항목마다 한 줄) */
  [/^(<input type="checkbox" id="txt-shadow-on"(?: checked)?)>$/, '$1 aria-label="Shadow">'],   /* B3 b338d175c — Effects 머리 토글 → «＋»(이름 = aria-label) */
  [/^(<input type="number" class="prop-number" id="bubble-w-number" (?![^>]*aria-label)[^>]*")>$/, '$1 aria-label="말풍선 너비">'],   /* B4 0e362728a — Size 절 두 칸(칸 안 라벨 · 이름 aria-label) */
  [/^(<input type="number" class="prop-number" id="bubble-h-number" (?![^>]*aria-label)[^>]*")>$/, '$1 aria-label="말풍선 최소 높이">'],   /* B4 · ★L4b — (?!aria-label) = 옛 판 칸만 고친다(새 판은 Layout 부품 칸이라 이미 aria-label · LAYAPP_STD ② 가 받는다) */
  [/^<button class="prop-anim-btn" id="open-anim-btn">$/, '<button type="button" class="prop-chain-btn" id="open-anim-btn" title="애니메이션 GIF 만들기" aria-label="애니메이션 GIF 만들기">']];   /* F1 83e0afbf1 — GIF 절 머리 ＋ = 이 단추 */
const ctl = (root) => all(root).flatMap((k) => (['input', 'select', 'button', 'textarea'].includes(k.tag) ? [tagNorm(k.raw)]
  : k.tag === 'option' ? [`<option value="${k.attrs.value ?? ''}"${'selected' in k.attrs ? ' selected' : ''}${(() => { const sel = closest(k, (x) => x.tag === 'select'); return sel?.attrs.id ? ` in="${sel.attrs.id}"` : ''; })()}>`] : []));   // QA2 — 옵션에 «어느 고르개»를 붙여 허용을 그 고르개로 묶는다
const labels = (root) => all(root).filter((k) => (has(k, 'prop-label') || has(k, 'prop-field-label')) && !has(k, 'prop-sec-sub')).map((k) => text(k).trim());   // 묶음 작은 제목(Q1)은 라벨 아님
const ids = (root) => all(root).filter((k) => k.attrs.id).map((k) => k.attrs.id);
const minus = (a, b) => { const r = [...a]; for (const x of b) { const i = r.indexOf(x); if (i >= 0) r.splice(i, 1); } return r; };

/* ⑤ 패딩 새 이름(Q25 · Q24 태그) — BASE 의 «왼쪽 패딩»·«오른쪽 패딩»(→ U2 «왼쪽»·«오른쪽») 도 한 걸음에 */
const LABEL_RENAME = { '왼쪽 패딩': '좌측패딩', '오른쪽 패딩': '우측패딩', '왼쪽': '좌측패딩', '오른쪽': '우측패딩', '상하': '상하패딩', '좌우 패딩': '태그 좌우' };   /* 태그 = Q24 «태그 좌우패딩»의 짧은 라벨(시안 v9 · 이름 전체는 title) */
const LABEL_DROPPED = ['Font', '글자색', '너비', '회전°'];   /* 회전° = Q20 각도 칸(라벨 글 대신 아이콘 · aria-label) */   /* 너비 = ⑥ 칸 안 라벨(.prop-xy-label)로 */   /* 재설계 1차 ⑩ — 라벨 글 걷음(칸은 그대로 · J1 이 잰다) */
const ID_ADDED = [/^psec-[a-z]+(-head|-body|-group)?$/, /^(type-section|bullet-style-section|txt-stroke-section|txt-shadow-section|txt-fx-section|txt-bubble-section|txt-anim-section)-(head|body)$/,
  /^txt-bubble-section$/, /^txt-anim-section$/, /^txt-align-group$/];
const ID_REMOVED = ['icon-text-style-section', 'txt-width-slider', 'txt-rot-slider', 'txt-fx-add',
  'txt-pv-bubble-hint',   /* 1120b B1 3edf31a99 — 힌트 걷음 */
  'bubble-bg-color', 'bubble-bg-hex'];   /* 1120b B2 1d13c6842 — 배경색 줄 = colorFieldHTML(prop-text.js 배선 때 그림) · 템플릿 밖 */   /* txt-fx-add = ＋ 메뉴로(시안 v10) */   /* txt-rot-slider = Q20 */   /* txt-width-slider = 재설계 1차 ⑥(너비 = 숫자 칸만) */
/* ★바닥 판부터 빨강(이번 일과 무관) — 태그 Oval 모양(label-shape-oval)이 BASE(2040a3339) 뒤 별건으로 생겼는데 이 판정기가 못 따라왔다:
 *   패널 재설계 1차 바닥(17b20888b)에서 이미 label · label+circle 상태 J1/J4 빨강. 그 한 단추·한 id 만, 태그 상태에서만 허용한다. */
const DRIFT_PRE = { states: ['label', 'label+circle'], ctl: /^<button class="prop-btn-full(?: active)?" id="label-shape-oval">$/, id: /^label-shape-oval$/ };
/* 기준판(BASE) 뒤에 «의도해서» 더한 컨트롤·id — 판정이 «생김»으로 안 세게. (패널 재설계 1차 261120 — 항목마다 까닭) */
const PH_ATTRS = ' min="0" max="120"(?: step="4")? value="\\d+"(?: style="visibility:hidden")?';   /* ⑤ 실제로 생기는 속성만 */
const CTL_ADDED = [
  /^<input type="number" id="txt-height-number" disabled placeholder="auto" data-empty="invalid" aria-label="[^"]*">$/,   /* ⑥ 텍스트 높이 칸(꺼짐 · auto) */
  /^<button class="prop-type-btn(?: active)?" disabled title="(?:Tags\(태그 블럭\)|Icon Text|Bubble|Liner) — [^"]*">$/,   /* ⑫ 타입 12칸 중 «바꾸기 없음» 넷(꺼짐) */
  new RegExp(`^<input type="range" class="prop-slider" id="txt-ph-slider"${PH_ATTRS}>$`),   /* ⑤ «좌우패딩» 한 줄(잠금 때 둘을 같이) */
  new RegExp(`^<input type="number" class="prop-number" id="txt-ph-number"${PH_ATTRS}>$`),
];
const CTL_DROPPED = [/^<input type="range" class="prop-slider" id="txt-width-slider" /,   /* ⑥ 너비 슬라이더 걷음 */
  /^<select class="prop-select" id="txt-fx-add" /, /^<option value="(?:|shadow|reflect)" in="txt-fx-add">$/,   /* ⑨ · 시안 v10 — Effects 고르개 → ＋ 단추 + 종류 메뉴(옵션 = 메뉴 항목) */
  /^<input type="range" class="prop-slider" id="txt-rot-slider" /,
  /^<input type="color" id="bubble-bg-color" /, /^<input type="text" class="prop-color-hex" id="bubble-bg-hex" /];   /* 1120b B2 — 위 ID_REMOVED 와 짝 */   /* Q20 회전 슬라이더 걷음(각도 칸만 · 시안 v10) */
/* ★기대 바뀜(L4b · 현빈 L-2) — 말풍선 크기 «자동/고정» 세그먼트(#bubble-size-group [data-bsz] 둘 · 줄 라벨 «크기») → 표준 W/H 줄의 모드 드롭다운(#bubble-size-mode · 고정/자동 두 옵션 = 이미 있는 두 모드만). W/H 숫자 칸은 LAYAPP_STD ②가 잰다(같은 id·범위). */
CTL_DROPPED.push(/^<button class="prop-type-btn (?:active)?" data-bsz="(?:auto|fixed)">$/);
CTL_ADDED.push(/^<select class="prop-select" id="bubble-size-mode" aria-label="(?:너비 모드|Width sizing)">$/, /^<option value="(?:fixed|auto)"(?: selected)? in="bubble-size-mode">$/);   // ★기대 바뀜(표준 Layout · 탑 워커 261125 — aria Width sizing)
ID_REMOVED.push('bubble-size-group'); ID_ADDED.push(/^bubble-size-mode$/);
/* Q17 회전 줄 단추 셋(시안 v10 · 현빈 GO 261120) */
CTL_ADDED.push(/^<button type="button" class="prop-align-btn(?: active)?" id="txt-(?:rot-90|flip-h|flip-v)" title="[^"]*" aria-label="[^"]*"(?: aria-pressed="(?:true|false)")?>$/,
  /^<button type="button" class="prop-chain-btn prop-fx-add-btn" id="txt-fx-add-btn" [^>]*>$/, /^<button type="button" class="fp-menu-item" role="menuitem" data-fx="(?:shadow|reflect)">$/);
ID_ADDED.push(/^txt-fx-(?:add-btn|menu)$/, /^txt-rot-number-scrub$/, /^txt-(?:rot-90|flip-h|flip-v)$/, /^txt-width-scrub$/, /^txt-height-number$/, /^txt-kind-group$/, /^txt-(?:ph|pl|pr)-row$/, /^txt-ph-(?:slider|number)$/);
/* 1120b R2c(현빈 261121 «형광펜·점·글로우 최근 = 셋 합쳐 한 줄») — kind 별 최근 줄 둘(골든엔 글로우 칸 없음) → 합친 줄 하나 */
ID_REMOVED.push('txt-hl-recent-row', 'txt-dot-recent-row'); ID_ADDED.push(/^txt-fx-recent-row$/);
/* 옮긴 컨트롤 → 있어야 할 절(손 표 · OWNERSHIP 과 «다른 길»로 적었다) */
const MOVED = {
  'label-radius-slider': 'appearance', 'label-radius-number': 'appearance', 'label-bg-color': 'fill', 'label-bg-hex': 'fill', 'label-bg-none': 'fill',
  'label-pill-height-slider': 'size', 'label-pill-height-number': 'size', 'itb-icon-size-slider': 'size', 'itb-icon-size-number': 'size',
  'itb-dy-slider': 'layout', 'itb-dy-number': 'layout', 'itb-gap-slider': 'layout', 'itb-gap-number': 'layout',
  'txt-x-number': 'position', 'txt-rot-number': 'position', 'txt-width-number': 'size', 'txt-pv-number': 'padding', 'bubble-bg-color': 'special',
};
const PH_OK = new Set(['', '자동', '상속', 'Mix', '없음', 'auto', 'Hug']);   // ★기대 바뀜(표준 Layout · 탑 워커 261125 — 크기 모드 낱말 영어 Hug · 현빈 17:36)   /* auto = ⑥ 텍스트 높이 칸(현빈 v9 «auto») */
/* 옛 판(U0) 뒤에 «기능으로» 더한 컨트롤 — 티켓마다 한 줄 · 정확한 개수까지(그 밖의 생김은 그대로 빨강).
   TEXT-LOREM-FILL-01(261121): Content 절 «더미 글» = select 2(+option 3·2) · number 1 · button 1 = 9 · 라벨 1 · id 4 (줄 모드 말풍선이면 0). */
/* 2749254f8 Tag Style «Oval» 단추(label·label+circle 상태) — origin/dev 9a724fb78 에서 이 판정이 이미 빨강이었다(태양 261121 실측 · 골든 2벌은 plain·liner 라 그 단추 0) · 같은 꼴로 한 줄. */
const FEATURE_ADDED = [{ ticket: 'LABEL-OVAL(2749254f8)', n: 1, isCtl: (t) => /id="label-shape-oval"/.test(t), label: null, id: /^label-shape-oval$/ },
  /* ★기대 바뀜(t13E-08·09 2차 · 현빈 확정 261123): 개수 = 슬라이더+숫자(공용 sliderRowHTML) ⇒ range 1 더해 10 · 줄 라벨 «개수» 하나 더 · id txt-lorem-count-slider 하나 더(같은 txt-lorem- 꼴) · option 정규식 = 통일판(dev)의 in="txt-lorem-…" 꼴 그대로(train/0913-a 충돌 풂) */
  /* ★기대 바뀜(표준 Position P2 · 0.9.14 73행 · 현빈 6-2 확정 261124): 흐름 안 글 = 부모 기준 정렬 6칸을 disabled 로 보인다(숨김 아님) + 윗줄 «Alignment» — 흐름 상태에서만 6(떠 있으면 0 = S1-4 그대로 · 아래 PS_P2_XY 와 짝) */
  { ticket: 'POSITION-STD-P2', n: 6, isCtl: (t) => /^<button disabled aria-disabled="true" title="흐름 안 블럭은[^"]*" class="prop-align-btn" type="button" data-float-align="[lcrtmb]"/.test(t), label: ['Alignment'], id: /^$/ },
  { ticket: 'TEXT-LOREM-FILL-01', n: 10, isCtl: (t) => /id="txt-lorem-/.test(t) || /^<option value="(word|sentence|paragraph|en|ko)"( selected)?( in="txt-lorem-[a-z]+")?>$/.test(t), label: ['더미 글', '개수'], id: /^txt-lorem-/ }];

/* ★표준 Position P2(6-2) — 흐름 상태(새 산출에 data-float-align-row="flow")에서만: 옛 X/Y 칸(값 있음) → 같은 id 의 disabled · 값 비움 · 툴팁(숨김 아님) */
const PS_P2_XY = (t) => t.replace(/^<input type="number" id="txt-([xy])-number" value="[^"]*" aria-label="([XY]) position">$/, '<input type="number" id="txt-$1-number" value="" aria-label="$2 position" disabled aria-disabled="true" title="흐름 안 블럭은 자리가 흐름으로 정해져요 — 괄호 단추(Ignore Auto Layout)를 켜면 써요">');
/* ★표준 Stroke 이관(태양 · 지디 261124 · bt2-safety T6 strokeStd 절과 같은 꼴) — Stroke 절(id txt-stroke-section) «안»의 바뀜만 허용:
 *   옛 굵기 슬라이더·숫자·위치 select → 부품(굵기 칸 · 위치 select · ⫶ 설정 팝오버: 스타일·점선 길이·간격·점선 끝·꼭짓점·Miter) · 라벨 두께·색상·위치 → 팝오버 라벨.
 *   절 «밖»에 같은 컨트롤·라벨·id 가 생기면 그대로 빨강 — 내장 양성대조 ②(Position 절에 ⫶ 단추 + «스타일» 라벨 심기)가 매번 잰다. */
const STROKE_STD = {
  scope: (root) => all(root).find((k) => k.attrs.id === 'txt-stroke-section') || null,
  ctlLost: [/^<input type="range" class="prop-slider" id="txt-stroke-w-slider" /, /^<input type="number" class="prop-number" id="txt-stroke-w-number" /, /^<select class="prop-select" id="txt-stroke-align">$/],
  ctlAdded: [/^<select class="prop-select" id="txt-stroke-(?:align|style)" data-part="select" data-field="stroke-(?:align|style)" /, /^<input type="number" id="txt-stroke-w-number" [^>]*aria-label="굵기">$/,
    /^<button type="button" class="prop-chain-btn ui-stroke-(?:more" id="txt-stroke-more"|pop-close") /, /^<option value="(?:solid|dashed|dotted|custom)"(?: selected)? in="txt-stroke-style">$/,
    /^<input type="number" [^>]*aria-label="(?:점선 길이|간격|Miter 각도)"[^>]*>$/, /^<button type="button" class="prop-type-btn(?: active)?" data-value="(?:none|square|round|miter|bevel)" aria-label="[^"]*" aria-pressed="(?:true|false)"[^>]*>$/],
  labelLost: ['두께', '색상', '위치'], labelAdded: ['스타일', '점선 길이', '간격', '점선 끝', '꼭짓점', 'Miter 각도'],
  idLost: ['txt-stroke-w-slider'], idAdded: ['txt-stroke-more', 'txt-stroke-pop', 'txt-stroke-style'],
};
/** 그 상태 Stroke 절 안에서만 «잃음/생김» 허용 목록을 만든다(옛·새 절 둘 다 있을 때만 · 개수 그대로 = 절 밖 같은 것은 못 빠진다) */
function strokeStdAllow(o, n) {   // ★표준 Fill F4 — 부르는 자리(탑 P2 줄 옆)를 안 건드리려 FILL_STD 허용을 여기서 합친다(fillStdAllow · 아래)
  const fx = fillStdAllow(n), so = STROKE_STD.scope(o), sn = STROKE_STD.scope(n);
  if (!so || !sn) return fx;
  const co = ctl(so).map((t) => RENAME.reduce((x, [a, b]) => x.replace(a, b), t)), cn = ctl(sn);
  const pick = (xs, rs) => xs.filter((t) => rs.some((r) => (r instanceof RegExp ? r.test(t) : r === t)));
  return { cLost: pick(minus(co, cn), STROKE_STD.ctlLost), cAdd: pick(minus(cn, co), STROKE_STD.ctlAdded).concat(fx.cAdd),
    lLost: pick(minus(labels(so), labels(sn)), STROKE_STD.labelLost), lAdd: pick(minus(labels(sn), labels(so)), STROKE_STD.labelAdded),
    iLost: pick(minus(ids(so), ids(sn)), STROKE_STD.idLost), iAdd: pick(minus(ids(sn), ids(so)), STROKE_STD.idAdded).concat(fx.iAdd) };
}
/* ★표준 Fill 이관(태양 F4 · 현빈 GO 261124 · 시안 #mkp-fillstd) — 글자색 줄 → 표준 겹 줄: Fill 부품(data-part=fill) «안»에 눈·− 단추 둘(막힘 · F6/다음 단계)만 더함.
 *   옛 판엔 그 부품이 없으니 «생김»만 · 개수 = 부품 안 것만(절 밖 같은 단추는 그대로 빨강 — 내장 양성대조 ①c) · 라벨 바뀜 0(텍스트는 이미 라벨 없음 · 재설계 ⑩). */
const FILL_STD = {
  scope: (root) => all(root).find((k) => k.attrs['data-part'] === 'fill') || null,
  ctlAdded: [/^<button type="button" class="prop-icon-btn ui-fill-btn" id="txt-fill-(?:eye|remove)" aria-label="(?:숨기기|칠 지우기)"[^>]*>$/],
  idAdded: [/^txt-fill-(?:eye|remove)$/],
};
function fillStdAllow(n) {
  const sc = FILL_STD.scope(n), none = { cLost: [], cAdd: [], lLost: [], lAdd: [], iLost: [], iAdd: [] };
  if (!sc) return none;
  return { ...none, cAdd: ctl(sc).filter((t) => FILL_STD.ctlAdded.some((r) => r.test(t))), iAdd: ids(sc).filter((i) => FILL_STD.idAdded.some((r) => r.test(i))) };
}

/* ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C3) — LAYAPP_STD:
 *   ① 옛 슬라이더 «X-slider» 잃음 = 새 판에 «X-number» 숫자 칸이 «같은 min/max» 로 있을 때만(범위 바뀌면 빨강 · 내장 양성대조 ①f).
 *   ② 부품(data-part=layout|appearance) «안» 숫자 칸 = 옛 같은 id 숫자 칸의 바꿈(같은 min/max 일 때만 · step·aria-label 덧붙음 허용) — 그 옛 줄 라벨은 부품 칸 이름으로 옮겨가 잃음 허용.
 *      옛 짝 없는 새 칸은 둘만: Appearance 부품 안 «*-opacity»(0~100) · 꺼진 텍스트 높이 칸(⑥ · 옛 CTL_ADDED «auto» 꼴의 부품판).
 *   ③ 그렇게 받아준 칸의 끌기 손잡이 «{id}-scrub» · 부품 안 끝 칸 단추(data-part=end-slot · 사슬/눈/모서리 막힘) 생김 허용.
 *   부품 «밖»에 같은 꼴(손잡이·끝 칸 단추)이 생기면 그대로 빨강 — 내장 양성대조 ①e. */
const ctlStr = (k) => RENAME.reduce((x, [a, b]) => x.replace(a, b), tagNorm(k.raw));
const rangeOf = (k) => `${k.attrs.min}|${k.attrs.max}`;
function layAppStdAllow(o, n) {
  const out = { cLost: [], cAdd: [], lLost: [], iLost: [], iAdd: [] };
  const inputs = (root, type) => all(root).filter((k) => k.tag === 'input' && k.attrs.type === type && k.attrs.id);
  const nNum = new Map(inputs(n, 'number').map((k) => [k.attrs.id, k])), oNum = new Map(inputs(o, 'number').map((k) => [k.attrs.id, k]));
  const nIds = new Set(ids(n));
  for (const sl of inputs(o, 'range')) {   // ①
    const num = /-slider$/.test(sl.attrs.id) && nNum.get(sl.attrs.id.replace(/-slider$/, '-number'));
    if (!nIds.has(sl.attrs.id) && num && rangeOf(num) === rangeOf(sl)) { out.cLost.push(ctlStr(sl)); out.iLost.push(sl.attrs.id); }
  }
  for (const p of all(n).filter((k) => ['layout', 'appearance'].includes(k.attrs['data-part']))) {
    for (const k of all(p)) {
      if (k.tag === 'input' && k.attrs.type === 'number') {   // ②
        const was = oNum.get(k.attrs.id);
        const ok = was ? rangeOf(was) === rangeOf(k)
          : (p.attrs['data-part'] === 'appearance' && /-opacity$/.test(k.attrs.id) && rangeOf(k) === '0|100') || (k.attrs.id === 'txt-height-number' && 'disabled' in k.attrs);
        if (!ok) continue;
        out.cAdd.push(ctlStr(k)); if (nIds.has(`${k.attrs.id}-scrub`)) out.iAdd.push(`${k.attrs.id}-scrub`);   // ③ 손잡이
        if (!was) out.iAdd.push(k.attrs.id);
        if (was) { out.cLost.push(ctlStr(was)); const row = closest(was, (x) => has(x, 'prop-row')); if (row) out.lLost.push(...labels(row).map((t) => LABEL_RENAME[t] ?? t)); }
      } else if (k.tag === 'button' && k.attrs['data-part'] === 'end-slot') { out.cAdd.push(ctlStr(k)); if (k.attrs.id) out.iAdd.push(k.attrs.id); }   // ③ 끝 칸
    }
  }
  /* ③b Appearance 절 머리 눈(ui-app-eye · 보류 막힘) — 그 절 몸에 Appearance 부품이 있을 때만 */
  for (const sec of all(n).filter((k) => has(k, 'prop-section') && all(k).some((x) => x.attrs['data-part'] === 'appearance'))) {
    for (const head of els(sec).filter((k) => has(k, 'prop-sec-head'))) for (const b of all(head).filter((k) => k.tag === 'button' && has(k, 'ui-app-eye') && k.attrs['data-part'] === 'end-slot')) { out.cAdd.push(ctlStr(b)); out.iAdd.push(b.attrs.id); }
  }
  return out;
}
function withLayAppStd(sx, lx) { return { ...sx, cLost: sx.cLost.concat(lx.cLost), cAdd: sx.cAdd.concat(lx.cAdd), lLost: sx.lLost.concat(lx.lLost), iLost: sx.iLost.concat(lx.iLost), iAdd: sx.iAdd.concat(lx.iAdd) }; }

function judge(name, st, oldHtml, newHtml) {
  const bad = [];
  const flowNow = /data-float-align-row="flow"/.test(newHtml);
  const o = stripOldHidden(parse(oldHtml), st), nm = panelModel(newHtml), n = nm.root;
  /* ⑫ 매핑 교정 — 말풍선이면 Bubble 만 켜짐: 옛 판이 함께 켜던 Body(내용 칸 클래스 기준)는 꺼진 것이 맞다 */
  const oc = ctl(o).map((t) => RENAME.reduce((s, [a, b]) => s.replace(a, b), t)).map((t) => (flowNow ? PS_P2_XY(t) : t)).map((t) => (name === 'bubble' ? t.replace(/^<button class="prop-type-btn active" (data-cls="tb-[a-z0-9]+")>$/, '<button class="prop-type-btn " $1>') : t)).filter((t) => !CTL_DROPPED.some((r) => r.test(t))), nc0 = ctl(n);
  /* 병합(탑 261122): dev 쪽 «기능으로 더한 컨트롤»(FEATURE_ADDED — 더미 글 · Tag Oval)을 정확한 개수로 걷고 나서 저쪽(재설계) 규칙으로 잰다 */
  let nc = nc0, featLabels = [], featHit = [];
  for (const f of FEATURE_ADDED) {
    const hit = nc.filter(f.isCtl);
    if (hit.length && hit.length !== f.n) bad.push(`J1 ${f.ticket}: 더한 컨트롤 ${hit.length}개(기대 ${f.n}) ${JSON.stringify(hit)}`);
    if (hit.length === f.n) { nc = nc.filter((t) => !f.isCtl(t)); featHit.push(f); if (f.label) featLabels.push(...[].concat(f.label)); }
  }
  const drift = DRIFT_PRE.states.includes(name);
  const sx = withLayAppStd(withCheckStd(strokeStdAllow(o, n), checkStdAllow(o, n)), layAppStdAllow(o, n));   // ★+ 온/오프 → 체크 부품(CHECK_STD · 탑 261124) · ★+ 표준 Layout/Appearance(LAYAPP_STD)
  nc = minus(nc, sx.cAdd);
  const l1 = minus(minus(oc, sx.cLost), nc), e1 = minus(nc, minus(oc, sx.cLost)).filter((t) => !CTL_ADDED.some((r) => r.test(t)) && !(drift && DRIFT_PRE.ctl.test(t)));
  if (l1.length || e1.length) bad.push(`J1 컨트롤: 잃음 ${JSON.stringify(l1)} · 생김 ${JSON.stringify(e1)}`);
  /* 옛 가짜 절 제목 → 새 field-label: L/R(패딩 연동 머리) · Tag Style(태그 모양 묶음) */
  /* 1120b B5 후속(지디 261121) — 스타일 번호 세 줄 라벨 «번호»×3 → «형광펜»·«점»·«밑줄»(한 말이 셋으로 갈려 LABEL_RENAME 표로는 못 적는다 · 옛 수만큼만) */
  const codeN = labels(o).filter((t) => t === '번호').length;
  const ol = minus(labels(o).map((t) => LABEL_RENAME[t] ?? t), ['Position', ...LABEL_DROPPED, ...Array(codeN).fill('번호'), ...(name === 'bubble' ? ['너비', '높이', '크기'] : [])])   /* 1120b B4 — 말풍선 너비·높이 라벨 글 → 칸 안 라벨(.prop-xy-label) · ★기대 바뀜(L4b · 현빈 L-2) «크기» = 옛 자동/고정 세그먼트 줄 라벨(→ 모드 드롭다운) */.concat(['형광펜', '점', '밑줄'].slice(0, codeN))
    .concat(ids(n).includes('txt-ph-chain') ? ['좌우패딩'] : [], ids(n).includes('label-style-section') ? ['Tag Style'] : []);   // ⑤ 옛 «L/R» 머리 → «좌우패딩» 줄
  const nl = minus(minus(labels(n), featLabels), sx.lAdd), ol2 = minus(ol, sx.lLost), l2 = minus(ol2, nl), e2 = minus(nl, ol2);
  if (l2.length || e2.length) bad.push(`J2 라벨: 잃음 ${JSON.stringify(l2)} · 생김 ${JSON.stringify(e2)}`);
  const oi = minus(ids(o).filter((i) => !ID_REMOVED.includes(i)), sx.iLost), ni = minus(ids(n), sx.iAdd).filter((i) => !ID_ADDED.some((r) => r.test(i)) && !(drift && DRIFT_PRE.id.test(i)) && !featHit.some((f) => f.id.test(i)));
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
/* ★온/오프 → 체크 부품 이관(현빈 261123 «온/오프 = 체크» · 태양 §2c · 탑 tp/0913-check → dev) — 옛 맨 체크박스(+ 옆 .prop-label)가
 *   label.ui-check[data-part=check] > input.ui-check-box + span.ui-check-label 로 감싸였다.
 *   허용 = 그 부품 «안» 체크박스가 옛 맨 체크박스와 id·type·checked 가 같을 때만 «class=ui-check-box 덧붙음» · 그 옛 라벨 글이 부품 글(.ui-check-label)과 같을 때만 라벨이 옮겨감.
 *   부품 밖 체크박스·옛 짝 없는 체크박스·checked 가 바뀐 것 = 그대로 빨강(내장 양성대조 ①d). */
function checkStdAllow(o, n) {
  const out = { cLost: [], cAdd: [], lLost: [] };
  const oldBox = (id) => all(o).find((k) => k.tag === 'input' && k.attrs.type === 'checkbox' && k.attrs.id === id && !has(k, 'ui-check-box'));
  for (const part of all(n).filter((k) => k.tag === 'label' && has(k, 'ui-check') && k.attrs['data-part'] === 'check')) {
    const box = all(part).find((k) => k.tag === 'input' && has(k, 'ui-check-box') && k.attrs.type === 'checkbox');
    const ob = box && box.attrs.id && oldBox(box.attrs.id);
    if (!ob || ('checked' in ob.attrs) !== ('checked' in box.attrs)) continue;
    out.cLost.push(tagNorm(ob.raw)); out.cAdd.push(tagNorm(box.raw));
    const lt = all(part).filter((k) => has(k, 'ui-check-label')).map((k) => text(k).trim())[0];
    if (lt && labels(o).includes(lt)) out.lLost.push(lt);
  }
  return out;
}
function withCheckStd(sx, cx) { return { ...sx, cLost: (sx.cLost || []).concat(cx.cLost), cAdd: (sx.cAdd || []).concat(cx.cAdd), lLost: (sx.lLost || []).concat(cx.lLost),
  lAdd: sx.lAdd || [], iLost: sx.iLost || [], iAdd: sx.iAdd || [] }; }
/* ①d 내장 양성대조(CHECK_STD) — 옛 짝 없는 체크 부품을 Position 절 X 칸 뒤에 심으면 J1·J4 가 잡아야 한다(옛 체크박스 «바꿈»만 허용) */
{ const PLANT = '<label class="ui-check" data-part="check"><input type="checkbox" class="ui-check-box" id="txt-fake-check"><span class="ui-check-label">가짜 체크</span></label>';
  const nowD = load(nowFiles());
  const planted = runAll((st) => nowD(st).replace(/(<input[^>]*id="txt-x-number"[^>]*>)/, `$1${PLANT}`)).filter((f) => f.startsWith('plain '));
  const caught = ['J1', 'J4'].every((j) => planted.some((f) => f.startsWith(`plain ${j}`) && /txt-fake-check/.test(f)));
  if (!caught) { console.error('★양성대조 실패(CHECK_STD) — 옛 짝 없는 체크 부품을 못 잡는다:\n  ' + planted.join('\n  ')); process.exit(1); }
  console.log(`양성대조 OK(CHECK_STD) — 옛 짝 없는 체크 부품을 잡았다 (${planted.length}건)`); }
/* ①b 내장 양성대조(STROKE_STD) — Stroke 절 «밖»(Position 절 X 칸 뒤)에 ⫶ 단추 + «스타일» 라벨을 심으면 J1·J2·J4 가 잡아야 한다(절 안만 허용) */
{ const PLANT = '<button type="button" class="prop-chain-btn ui-stroke-more" id="txt-stroke-more" aria-haspopup="dialog" aria-expanded="false" aria-label="Stroke 설정"></button><span class="prop-label">스타일</span>';
  const nowB = load(nowFiles());
  const planted = runAll((st) => nowB(st).replace(/(<input[^>]*id="txt-x-number"[^>]*>)/, `$1${PLANT}`)).filter((f) => f.startsWith('stroke-on '));
  const caught = ['J1', 'J2', 'J4'].every((j) => planted.some((f) => f.startsWith(`stroke-on ${j}`) && /txt-stroke-more|스타일/.test(f)));
  if (!caught) { console.error('★양성대조 실패(STROKE_STD) — Stroke 절 밖에 심은 것을 못 잡는다:\n  ' + planted.join('\n  ')); process.exit(1); }
  console.log(`양성대조 OK(STROKE_STD) — 절 밖에 심은 ⫶·«스타일»을 잡았다 (${planted.length}건)`); }
/* ①c 내장 양성대조(FILL_STD) — Fill 부품 «밖»(Position 절 X 칸 뒤)에 Fill 눈 단추를 심으면 J1·J4 가 잡아야 한다 */
{ const PLANT = '<button type="button" class="prop-icon-btn ui-fill-btn" id="txt-fill-eye" aria-label="숨기기" aria-pressed="false" aria-disabled="true" tabindex="0" title="숨기기 — 곧 지원"></button>';
  const nowC = load(nowFiles());
  const planted = runAll((st) => nowC(st).replace(/(<input[^>]*id="txt-x-number"[^>]*>)/, `$1${PLANT}`)).filter((f) => f.startsWith('plain '));
  const caught = ['J1', 'J4'].every((j) => planted.some((f) => f.startsWith(`plain ${j}`) && /txt-fill-eye/.test(f)));
  if (!caught) { console.error('★양성대조 실패(FILL_STD) — Fill 부품 밖에 심은 것을 못 잡는다:\n  ' + planted.join('\n  ')); process.exit(1); }
  console.log(`양성대조 OK(FILL_STD) — 부품 밖에 심은 눈 단추를 잡았다 (${planted.length}건)`); }

/* ①e 내장 양성대조(LAYAPP_STD) — 부품 «밖»(Position 절 X 칸 뒤)에 끌기 손잡이 + 끝 칸 단추를 심으면 J1·J4 가 잡아야 한다(부품 안만 허용) */
{ const PLANT = '<span class="prop-xy-label ui-app-scrub" id="txt-x-number-scrub"></span><button type="button" class="prop-chain-btn" id="txt-fake-end" data-part="end-slot"></button>';
  const nowE = load(nowFiles());
  const planted = runAll((st) => nowE(st).replace(/(<input[^>]*id="txt-x-number"[^>]*>)/, `$1${PLANT}`)).filter((f) => f.startsWith('plain '));
  const caught = planted.some((f) => f.startsWith('plain J1') && /txt-fake-end/.test(f)) && planted.some((f) => f.startsWith('plain J4') && /txt-x-number-scrub/.test(f));
  if (!caught) { console.error('★양성대조 실패(LAYAPP_STD ①e) — 부품 밖에 심은 손잡이·끝 칸을 못 잡는다:\n  ' + planted.join('\n  ')); process.exit(1); }
  console.log(`양성대조 OK(LAYAPP_STD ①e) — 부품 밖 손잡이·끝 칸을 잡았다 (${planted.length}건)`); }
/* ①f 내장 양성대조(LAYAPP_STD) — 부품 안 칸의 범위를 한 칸 바꾸면(태그 모서리 max 40 → 41) J1 이 잡아야 한다(같은 범위일 때만 허용) */
{ const nowF = load(nowFiles());
  const bent = runAll((st) => nowF(st).replace('id="label-radius-number" min="0" max="40"', 'id="label-radius-number" min="0" max="41"')).filter((f) => f.startsWith('label '));
  if (!bent.some((f) => f.startsWith('label J1') && f.includes('id=\\"label-radius-number\\" min=\\"0\\" max=\\"41\\"'))) { console.error('★양성대조 실패(LAYAPP_STD ①f) — 범위 바뀐 칸을 못 잡는다:\n  ' + bent.join('\n  ')); process.exit(1); }
  console.log(`양성대조 OK(LAYAPP_STD ①f) — 범위 바뀐 칸을 잡았다 (${bent.length}건)`); }

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
